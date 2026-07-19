import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import { TunnelService } from '../tunnel/tunnel.service';
import { encryptSecret, decryptSecret } from '../common/crypto.util';
import { buildDeployScript, buildStartScript } from '../deployments/deploy-script.util';

interface OAuthState {
  userId?: string;
  mode: 'github' | 'google-login';
  nonce: string;
  exp: number;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private prisma: PrismaService,
    private docker: DockerService,
    private tunnel: TunnelService,
  ) {}

  private stateSecret() {
    return (
      process.env.GITHUB_OAUTH_STATE_SECRET ||
      process.env.GOOGLE_OAUTH_STATE_SECRET ||
      process.env.JWT_SECRET ||
      'dev-oauth-state'
    );
  }

  signState(payload: Omit<OAuthState, 'exp' | 'nonce'> & { exp?: number }) {
    const state: OAuthState = {
      ...payload,
      nonce: Math.random().toString(36).slice(2),
      exp: payload.exp ?? Date.now() + 10 * 60 * 1000,
    };
    const data = Buffer.from(JSON.stringify(state)).toString('base64url');
    const sig = createHmac('sha256', this.stateSecret()).update(data).digest('base64url');
    return `${data}.${sig}`;
  }

  verifyState(state: string): OAuthState {
    const [data, sig] = state.split('.');
    if (!data || !sig) throw new BadRequestException('Estado OAuth inválido');
    const expected = createHmac('sha256', this.stateSecret()).update(data).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Estado OAuth inválido');
    }
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString()) as OAuthState;
    if (parsed.exp < Date.now()) throw new BadRequestException('Estado OAuth expirado');
    return parsed;
  }

  async listIntegrations(userId: string) {
    const accounts = await this.prisma.integrationAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        username: true,
        email: true,
        scope: true,
        createdAt: true,
      },
    });
    return accounts;
  }

  async disconnect(userId: string, provider: string) {
    await this.prisma.integrationAccount.deleteMany({ where: { userId, provider } });
    return { ok: true };
  }

  getGithubAuthorizeUrl(userId: string) {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new BadRequestException('GitHub OAuth no configurado en el servidor');
    }
    const scopes = process.env.GITHUB_OAUTH_SCOPES || 'repo read:user';
    const state = this.signState({ userId, mode: 'github' });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state,
    });
    return { url: `https://github.com/login/oauth/authorize?${params}` };
  }

  async handleGithubCallback(code: string, state: string) {
    const parsed = this.verifyState(state);
    if (parsed.mode !== 'github' || !parsed.userId) {
      throw new BadRequestException('Estado OAuth inválido');
    }

    const token = await this.exchangeGithubCode(code);
    const profile = await this.fetchGithubProfile(token.access_token);

    await this.prisma.integrationAccount.upsert({
      where: {
        userId_provider: { userId: parsed.userId, provider: 'github' },
      },
      create: {
        provider: 'github',
        providerUserId: String(profile.id),
        username: profile.login,
        email: profile.email,
        accessTokenEnc: encryptSecret(token.access_token),
        scope: token.scope,
        userId: parsed.userId,
        metadata: JSON.stringify({ avatar: profile.avatar_url }),
      },
      update: {
        providerUserId: String(profile.id),
        username: profile.login,
        email: profile.email,
        accessTokenEnc: encryptSecret(token.access_token),
        scope: token.scope,
        metadata: JSON.stringify({ avatar: profile.avatar_url }),
      },
    });

    return { userId: parsed.userId };
  }

  private async exchangeGithubCode(code: string) {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await res.json();
    if (!data.access_token) {
      throw new BadRequestException(data.error_description || 'No se pudo obtener token de GitHub');
    }
    return data as { access_token: string; scope?: string };
  }

  private async fetchGithubProfile(accessToken: string) {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ZynCloud',
      },
    });
    if (!res.ok) throw new BadRequestException('No se pudo leer perfil de GitHub');
    return res.json() as Promise<{ id: number; login: string; email?: string; avatar_url?: string }>;
  }

  async getGithubToken(userId: string) {
    const account = await this.prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'github' } },
    });
    if (!account) throw new BadRequestException('Conecta tu cuenta de GitHub primero');
    return decryptSecret(account.accessTokenEnc);
  }

  /**
   * Detecta el framework de un repo leyendo su package.json vía la API de GitHub
   * y devuelve los comandos de build/start sugeridos (modelo Vercel: cero config).
   * Las apps escuchan en $PORT, que inyecta el script de deploy.
   */
  async detectFramework(
    userId: string,
    repoFullName: string,
    branch = 'main',
    rootDir = '.',
  ): Promise<{ framework: string; buildCommand: string; startCommand: string }> {
    let pkg: {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    } | null = null;

    try {
      const token = await this.getGithubToken(userId);
      const [owner, repo] = repoFullName.split('/');
      const path = !rootDir || rootDir === '.' ? 'package.json' : `${rootDir.replace(/\/+$/, '')}/package.json`;
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'ZynCloud',
          },
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { content?: string; encoding?: string };
        if (data.content) {
          const raw = Buffer.from(data.content, (data.encoding as BufferEncoding) || 'base64').toString('utf8');
          pkg = JSON.parse(raw);
        }
      }
    } catch (err) {
      this.logger.warn(`detectFramework: no se pudo leer package.json de ${repoFullName}: ${(err as Error).message}`);
    }

    return this.frameworkFromPackageJson(pkg);
  }

  private frameworkFromPackageJson(
    pkg: {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    } | null,
  ): { framework: string; buildCommand: string; startCommand: string } {
    // Sin package.json → sitio estático.
    if (!pkg) {
      return {
        framework: 'Static',
        buildCommand: '',
        startCommand: 'npx --yes serve -s . -l $PORT',
      };
    }

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const scripts = pkg.scripts || {};
    // Borra node_modules y package-lock.json antes de instalar para evitar el bug de npm
    // con optional native deps (ej. rolldown, esbuild, swc) cuando el lockfile fue generado
    // en otro OS/arquitectura. https://github.com/npm/cli/issues/4828
    const install = 'rm -rf node_modules package-lock.json && npm install';

    if (deps['next']) {
      // Usamos el CLI directamente con -p $PORT para evitar que el package.json
      // tenga "next start -p 3000" hardcodeado y bloquee el puerto asignado.
      return {
        framework: 'Next.js',
        buildCommand: `${install} && npm run build`,
        startCommand: 'node_modules/.bin/next start -p $PORT',
      };
    }
    if (deps['@nestjs/core']) {
      // NestJS lee process.env.PORT en main.ts; pasamos PORT como env var.
      return {
        framework: 'NestJS',
        buildCommand: `${install} && npm run build`,
        startCommand: 'node dist/main.js',
      };
    }
    if (deps['vite']) {
      // Vite build produce dist/ estático; se sirve con `serve`.
      return {
        framework: 'Vite',
        buildCommand: `${install} && npm run build`,
        startCommand: 'npx --yes serve -s dist -l $PORT',
      };
    }
    if (deps['react-scripts']) {
      return {
        framework: 'Create React App',
        buildCommand: `${install} && npm run build`,
        startCommand: 'npx --yes serve -s build -l $PORT',
      };
    }
    if (deps['@angular/core']) {
      return {
        framework: 'Angular',
        buildCommand: `${install} && npm run build`,
        startCommand: 'npx --yes serve -s dist -l $PORT',
      };
    }
    if (deps['astro']) {
      return {
        framework: 'Astro',
        buildCommand: `${install} && npm run build`,
        startCommand: 'npx --yes serve -s dist -l $PORT',
      };
    }
    // Node genérico: inyectamos PORT explícitamente en el script.
    if (scripts['start']) {
      return {
        framework: 'Node',
        buildCommand: scripts['build'] ? `${install} && npm run build` : install,
        startCommand: 'npm run start',
      };
    }
    // Último recurso: instala y sirve estático.
    return {
      framework: 'Static',
      buildCommand: install,
      startCommand: 'npx --yes serve -s . -l $PORT',
    };
  }

  async listGithubRepos(userId: string) {
    const token = await this.getGithubToken(userId);
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ZynCloud',
      },
    });
    if (!res.ok) throw new BadRequestException('No se pudieron listar repositorios');
    const repos = await res.json() as Array<{
      id: number;
      full_name: string;
      default_branch: string;
      private: boolean;
      html_url: string;
    }>;
    return repos.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      private: r.private,
      url: r.html_url,
    }));
  }

  async deployFromGithub(
    userId: string,
    data: {
      instanceId: string;
      repoFullName: string;
      branch?: string;
      rootDir?: string;
      buildCommand?: string;
      startCommand?: string;
    },
  ) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: data.instanceId, userId },
    });
    if (!instance?.containerId || instance.status !== 'running') {
      throw new BadRequestException('La instancia debe estar en ejecución');
    }

    const token = await this.getGithubToken(userId);
    const branch = data.branch || 'main';
    const rootDir = data.rootDir || '.';
    const buildCommand = data.buildCommand || 'npm install && npm run build';
    const startCommand = data.startCommand || 'nohup npm start > /tmp/app.log 2>&1 &';

    const deployment = await this.prisma.deployment.create({
      data: {
        repoFullName: data.repoFullName,
        branch,
        rootDir,
        buildCommand,
        startCommand,
        status: 'deploying',
        instanceId: data.instanceId,
        userId,
      },
    });

    const cloneUrl = `https://x-access-token:${token}@github.com/${data.repoFullName}.git`;
    const appDir = '/home/ubuntu/app';
    const workDir = rootDir === '.' ? appDir : `${appDir}/${rootDir}`;

    const script = [
      'set -e',
      `mkdir -p ${appDir}`,
      `cd ${appDir}`,
      `if [ -d .git ]; then git fetch origin && git checkout ${branch} && git pull origin ${branch}; else git clone --branch ${branch} --depth 1 "${cloneUrl}" .; fi`,
      `cd ${workDir}`,
      buildCommand,
      'pkill -f "node /home/ubuntu/app" 2>/dev/null || true',
      startCommand,
      'sleep 2',
      'echo DEPLOY_OK',
    ].join(' && ');

    try {
      const output = await this.docker.execDetached(instance.containerId, ['/bin/bash', '-c', script]);
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'success', lastLog: output.slice(-4000) },
      });
      return { deploymentId: deployment.id, status: 'success', log: output };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'error', lastLog: msg },
      });
      throw error;
    }
  }

  /**
   * Registra automáticamente el webhook en el repo de GitHub para que cada push
   * dispare un auto-deploy. Si ya existe un webhook apuntando a nuestra URL, no duplica.
   */
  async ensureGithubWebhook(userId: string, repoFullName: string): Promise<void> {
    const webhookUrl = process.env.GITHUB_WEBHOOK_CALLBACK_URL?.trim();
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
    if (!webhookUrl || !webhookSecret) {
      this.logger.warn('GITHUB_WEBHOOK_CALLBACK_URL o GITHUB_WEBHOOK_SECRET no configurados: webhook auto-registro omitido');
      return;
    }

    let token: string;
    try {
      token = await this.getGithubToken(userId);
    } catch {
      return;
    }

    const [owner, repo] = repoFullName.split('/');
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ZynCloud',
      'Content-Type': 'application/json',
    };

    // Verifica si ya existe un webhook con nuestra URL
    try {
      const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, { headers });
      if (listRes.ok) {
        const hooks = await listRes.json() as Array<{ config?: { url?: string } }>;
        const alreadyExists = hooks.some((h) => h.config?.url === webhookUrl);
        if (alreadyExists) {
          this.logger.log(`Webhook ya existía en ${repoFullName}`);
          return;
        }
      }
    } catch { /* no bloquear si falla el check */ }

    // Crea el webhook
    try {
      const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: webhookSecret,
            insecure_ssl: '0',
          },
        }),
      });

      if (createRes.ok) {
        this.logger.log(`Webhook registrado en ${repoFullName} → ${webhookUrl}`);
      } else {
        const err = await createRes.text();
        this.logger.warn(`No se pudo registrar webhook en ${repoFullName}: ${createRes.status} ${err}`);
      }
    } catch (err) {
      this.logger.warn(`Error registrando webhook en ${repoFullName}: ${(err as Error).message}`);
    }
  }

  async listDeployments(userId: string, instanceId?: string) {
    return this.prisma.deployment.findMany({
      where: { userId, ...(instanceId ? { instanceId } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: { instance: { select: { id: true, name: true } } },
    });
  }

  /** Verifica firma HMAC-SHA256 del webhook de GitHub. */
  verifyGithubWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
    if (!secret || !signatureHeader?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      const a = Buffer.from(signatureHeader.slice('sha256='.length), 'utf8');
      const b = Buffer.from(expected, 'utf8');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Maneja el webhook de push de GitHub.
   * Encuentra todos los Deployments configurados para ese repo+rama y los re-dispara.
   */
  async handleGithubWebhookPush(payload: {
    ref: string;
    repository: { full_name: string };
    pusher?: { name?: string };
    head_commit?: { message?: string; id?: string };
  }) {
    const branch = payload.ref?.replace('refs/heads/', '');
    const repoFullName = payload.repository?.full_name;
    if (!branch || !repoFullName) return { triggered: 0 };

    // Ignora pushes de borrado de rama
    if (payload.ref === '0000000000000000000000000000000000000000') return { triggered: 0 };

    const configs = await this.prisma.deployment.findMany({
      where: { repoFullName, branch },
      include: { instance: true, user: { select: { id: true } } },
    });

    if (configs.length === 0) {
      this.logger.log(`GitHub webhook push ${repoFullName}@${branch}: sin deployments configurados`);
      return { triggered: 0 };
    }

    let triggered = 0;
    for (const dep of configs) {
      try {
        if (!dep.instance.containerId || dep.instance.status !== 'running') {
          this.logger.warn(`Deployment ${dep.id}: instancia ${dep.instanceId} no está corriendo, omitiendo`);
          continue;
        }
        await this.triggerDeploymentInternal(dep, dep.user.id);
        triggered++;
      } catch (err) {
        this.logger.error(`Auto-deploy ${dep.id} falló: ${(err as Error).message}`);
      }
    }

    this.logger.log(`GitHub webhook push ${repoFullName}@${branch}: ${triggered}/${configs.length} disparados`);
    return { triggered };
  }

  /** Dispara un deployment existente (reutiliza la config guardada). */
  private async triggerDeploymentInternal(
    dep: {
      id: string;
      repoFullName: string;
      branch: string;
      rootDir: string;
      buildCommand: string | null;
      startCommand: string | null;
      port: number | null;
      hostname: string | null;
      instance: { containerId: string | null };
    },
    userId: string,
  ) {
    await this.prisma.deployment.update({
      where: { id: dep.id },
      data: { status: 'deploying', lastLog: 'Auto-deploy iniciado por push a GitHub...' },
    });

    const token = await this.getGithubToken(userId);
    const script = buildDeployScript(dep, token);

    // Corre en background — el webhook responde rápido
    setImmediate(async () => {
      try {
        const { output, timedOut, exitCode } = await this.docker.runScript(dep.instance.containerId!, script);
        const success = !timedOut && (exitCode === 0 || (exitCode === null && /== OK ==/.test(output)));
        let finalLog = output;
        if (success && dep.startCommand) {
          try {
            await this.docker.startDetached(dep.instance.containerId!, buildStartScript(dep));
            finalLog += `\n== START ==\nApp arrancada en background (puerto ${dep.port ?? 3000}).`;
          } catch (e) {
            finalLog += `\n== START FAIL ==\n${(e as Error).message}`;
          }
        }
        await this.prisma.deployment.update({
          where: { id: dep.id },
          data: { status: success ? 'success' : 'error', lastLog: finalLog.slice(-8000) },
        });
        if (success && dep.hostname && this.tunnel.isTunnelMode()) {
          try {
            await this.tunnel.syncIngress();
          } catch (e) {
            this.logger.warn(`No se pudo sincronizar la ruta ${dep.hostname}: ${(e as Error).message}`);
          }
        }
      } catch (err) {
        await this.prisma.deployment.update({
          where: { id: dep.id },
          data: { status: 'error', lastLog: (err as Error).message },
        });
      }
    });
  }

  // Google OAuth for login
  getGoogleLoginUrl() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Google OAuth no configurado');
    }
    const scopes = process.env.GOOGLE_OAUTH_SCOPES || 'openid email profile';
    const state = this.signState({ mode: 'google-login' });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }

  async handleGoogleLoginCallback(code: string, state: string) {
    const parsed = this.verifyState(state);
    if (parsed.mode !== 'google-login') throw new BadRequestException('Estado OAuth inválido');

    const tokens = await this.exchangeGoogleCode(code);
    const profile = await this.fetchGoogleProfile(tokens.access_token);

    if (!profile.email) throw new BadRequestException('Google no devolvió email');

    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          password: null,
        },
      });
    }

    await this.prisma.integrationAccount.upsert({
      where: {
        userId_provider: { userId: user.id, provider: 'google' },
      },
      create: {
        provider: 'google',
        providerUserId: profile.sub,
        username: profile.name,
        email: profile.email,
        accessTokenEnc: encryptSecret(tokens.access_token),
        scope: process.env.GOOGLE_OAUTH_SCOPES,
        userId: user.id,
        metadata: JSON.stringify({ picture: profile.picture }),
      },
      update: {
        accessTokenEnc: encryptSecret(tokens.access_token),
        username: profile.name,
        metadata: JSON.stringify({ picture: profile.picture }),
      },
    });

    return { userId: user.id, email: user.email };
  }

  private async exchangeGoogleCode(code: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });
    const data = await res.json();
    if (!data.access_token) {
      throw new BadRequestException(data.error_description || 'Error de Google OAuth');
    }
    return data as { access_token: string };
  }

  private async fetchGoogleProfile(accessToken: string) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new BadRequestException('No se pudo leer perfil de Google');
    return res.json() as Promise<{
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    }>;
  }
}
