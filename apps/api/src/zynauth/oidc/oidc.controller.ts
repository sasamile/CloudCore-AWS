import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  Body,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OidcService, type AuthorizeParams } from './oidc.service';
import { OAuthClientService } from '../clients/oauth-client.service';
import { AppUserService } from '../app-users/app-user.service';
import { MfaService } from '../mfa/mfa.service';
import { ZYNAUTH } from '../zynauth.config';
import { renderLoginPage } from './login-page';
import { renderMfaPage } from './mfa-page';
import { renderRegisterPage } from './register-page';
import { PrismaService } from '../../prisma/prisma.service';

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function parseBasicAuth(header?: string): { id: string; secret: string } | null {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) return null;
    return { id: decoded.slice(0, idx), secret: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

@Controller('oauth2')
export class OidcController {
  constructor(
    private readonly oidc: OidcService,
    private readonly clients: OAuthClientService,
    private readonly appUsers: AppUserService,
    private readonly mfa: MfaService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- GET /oauth2/authorize -------------------------------------------------
  @Get('authorize')
  async authorize(@Query() q: Record<string, string>, @Req() req: Request, @Res() res: Response) {
    const params = await this.validateAuthorize(q);

    const cookies = parseCookies(req.headers.cookie);
    const session = cookies[ZYNAUTH.sessionCookie]
      ? await this.oidc.verifySessionToken(cookies[ZYNAUTH.sessionCookie])
      : null;

    if (session) {
      const code = await this.oidc.createAuthCode(session.id, params, session.isAppUser);
      return res.redirect(this.buildRedirect(params.redirectUri, { code, state: params.state }));
    }

    const client = await this.clients.findByClientId(params.clientId);
    const appName = client?.name;

    return res
      .status(200)
      .type('html')
      .send(renderLoginPage({ params: q, error: null, appName }));
  }

  // ---- POST /oauth2/login ---------------------------------------------------
  @Post('login')
  async login(@Body() body: Record<string, string>, @Res() res: Response) {
    const params = await this.validateAuthorize(body);
    const { email, password } = body;

    const client = await this.clients.findByClientId(params.clientId);
    const appName = client?.name;

    let appUser: Awaited<ReturnType<OidcService['validateCredentials']>> = null;
    try {
      appUser = await this.oidc.validateCredentials(
        email ?? '',
        password ?? '',
        params.clientId,
      );
    } catch (e) {
      return res
        .status(200)
        .type('html')
        .send(renderLoginPage({ params: body, error: (e as Error).message, appName }));
    }
    if (!appUser) {
      return res
        .status(200)
        .type('html')
        .send(renderLoginPage({ params: body, error: 'Credenciales invalidas', appName }));
    }

    // MFA para app users
    if (appUser.mfaEnabled) {
      const ticket = await this.oidc.createMfaTicket(appUser.id, true);
      return res
        .status(200)
        .type('html')
        .send(renderMfaPage({ params: body, ticket, error: null }));
    }

    return this.completeLogin(res, appUser.id, true, params, body);
  }

  // ---- POST /oauth2/mfa -----------------------------------------------------
  @Post('mfa')
  async mfaStep(@Body() body: Record<string, string>, @Res() res: Response) {
    const params = await this.validateAuthorize(body);
    const ticket = await this.oidc.verifyMfaTicket(body.mfa_ticket ?? '');
    if (!ticket) {
      return res
        .status(200)
        .type('html')
        .send(renderLoginPage({ params: body, error: 'La sesion de verificacion expiro, inicia de nuevo' }));
    }

    if (ticket.isAppUser) {
      const appUser = await this.appUsers.findById(ticket.id);
      if (!appUser) {
        return res.status(200).type('html').send(renderLoginPage({ params: body, error: 'Usuario no encontrado' }));
      }
      const ok = await this.appUsers.verifyMfa(appUser, body.code ?? '');
      if (!ok) {
        const newTicket = await this.oidc.createMfaTicket(appUser.id, true);
        return res.status(200).type('html').send(renderMfaPage({ params: body, ticket: newTicket, error: 'Codigo invalido' }));
      }
      return this.completeLogin(res, appUser.id, true, params, body);
    }

    // ZynCloud user MFA — fallback: exigir codigo antes de completar.
    const user = await this.prisma.user.findUnique({ where: { id: ticket.id } });
    if (!user) {
      return res.status(200).type('html').send(renderLoginPage({ params: body, error: 'Usuario no encontrado' }));
    }
    const ok = await this.mfa.verifyForUser(user, body.code ?? '');
    if (!ok) {
      const newTicket = await this.oidc.createMfaTicket(user.id, false);
      return res
        .status(200)
        .type('html')
        .send(renderMfaPage({ params: body, ticket: newTicket, error: 'Codigo invalido' }));
    }
    return this.completeLogin(res, user.id, false, params, body);
  }

  // ---- GET /oauth2/register --------------------------------------------------
  @Get('register')
  async registerPage(@Query() q: Record<string, string>, @Res() res: Response) {
    const clientId = q.client_id;
    if (!clientId) throw new BadRequestException('client_id requerido');
    const client = await this.clients.findByClientId(clientId);
    if (!client) throw new BadRequestException('client_id desconocido');

    return res
      .status(200)
      .type('html')
      .send(renderRegisterPage({ params: q, error: null, appName: client.name }));
  }

  // ---- POST /oauth2/register -------------------------------------------------
  @Post('register')
  async register(@Body() body: Record<string, string>, @Res() res: Response) {
    const params = await this.validateAuthorize(body);
    const client = await this.clients.findByClientId(params.clientId);
    const appName = client?.name;

    const { email, password, password2, name } = body;

    if (!email || !password) {
      return res.status(200).type('html').send(
        renderRegisterPage({ params: body, error: 'Email y contrasena son obligatorios', appName }),
      );
    }
    if (password !== password2) {
      return res.status(200).type('html').send(
        renderRegisterPage({ params: body, error: 'Las contrasenas no coinciden', appName }),
      );
    }
    if (password.length < 6) {
      return res.status(200).type('html').send(
        renderRegisterPage({ params: body, error: 'La contrasena debe tener al menos 6 caracteres', appName }),
      );
    }

    try {
      const appUser = await this.appUsers.selfRegister(params.clientId, { email, password, name });
      return this.completeLogin(res, appUser.id, true, params, body);
    } catch (e) {
      return res.status(200).type('html').send(
        renderRegisterPage({ params: body, error: (e as Error).message, appName }),
      );
    }
  }

  // ---- POST /oauth2/token ---------------------------------------------------
  @Post('token')
  async token(
    @Body() body: Record<string, string>,
    @Headers('authorization') authHeader: string | undefined,
    @Res() res: Response,
  ) {
    const grantType = body.grant_type;
    const basic = parseBasicAuth(authHeader);
    const clientId = basic?.id || body.client_id;
    const clientSecret = basic?.secret || body.client_secret;

    if (!clientId) throw new BadRequestException('client_id requerido');

    try {
      if (grantType === 'authorization_code') {
        await this.clients.authenticateClient(clientId, clientSecret);
        const tokens = await this.oidc.exchangeAuthorizationCode({
          code: body.code,
          redirectUri: body.redirect_uri,
          clientId,
          codeVerifier: body.code_verifier,
        });
        return res.json(tokens);
      }
      if (grantType === 'refresh_token') {
        await this.clients.authenticateClient(clientId, clientSecret);
        const tokens = await this.oidc.refresh({
          refreshToken: body.refresh_token,
          clientId,
        });
        return res.json(tokens);
      }
      // Login embebido (email+password) NO va aqui: como AWS Cognito, /oauth2/token
      // es OIDC puro. El grant `password` (ROPC) esta deprecado en OAuth 2.1 y ademas
      // se saltaria el MFA. El flujo embebido seguro vive en POST /zynauth/auth/login.
      return res.status(400).json({ error: 'unsupported_grant_type' });
    } catch (e) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: (e as Error).message,
      });
    }
  }

  // ---- GET /oauth2/userinfo -------------------------------------------------
  @Get('userinfo')
  async userinfo(@Headers('authorization') authHeader: string | undefined, @Res() res: Response) {
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    try {
      const info = await this.oidc.getUserInfo(authHeader.slice(7));
      return res.json(info);
    } catch (e) {
      return res.status(401).json({ error: 'invalid_token', error_description: (e as Error).message });
    }
  }

  // ---- GET /oauth2/logout ---------------------------------------------------
  @Get('logout')
  async logout(@Query() q: Record<string, string>, @Res() res: Response) {
    res.clearCookie(ZYNAUTH.sessionCookie, { path: '/' });
    const target = q.post_logout_redirect_uri;
    if (target) {
      const client = q.client_id ? await this.clients.findByClientId(q.client_id) : null;
      if (client) {
        const allowed = JSON.parse(client.postLogoutUris) as string[];
        if (allowed.includes(target)) return res.redirect(target);
      }
    }
    return res.status(200).type('html').send('<h3>Sesion cerrada en ZynAuth.</h3>');
  }

  // ---- helpers ---------------------------------------------------------------
  private async completeLogin(
    res: Response,
    subjectId: string,
    isAppUser: boolean,
    params: AuthorizeParams,
    rawParams: Record<string, string>,
  ) {
    const session = await this.oidc.createSessionToken(subjectId, isAppUser);
    res.cookie(ZYNAUTH.sessionCookie, session, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ZYNAUTH.ttl.sessionSeconds * 1000,
      path: '/',
    });
    const code = await this.oidc.createAuthCode(subjectId, params, isAppUser);
    return res.redirect(this.buildRedirect(params.redirectUri, { code, state: rawParams.state }));
  }

  private async validateAuthorize(q: Record<string, string>): Promise<AuthorizeParams> {
    if (q.response_type && q.response_type !== 'code') {
      throw new BadRequestException('response_type debe ser "code"');
    }
    if (!q.client_id) throw new BadRequestException('client_id requerido');
    if (!q.redirect_uri) throw new BadRequestException('redirect_uri requerido');

    const client = await this.clients.getOrThrow(q.client_id);
    if (!this.clients.isRedirectAllowed(client, q.redirect_uri)) {
      throw new BadRequestException('redirect_uri no permitido para este cliente');
    }
    if (client.requirePkce && !q.code_challenge && client.isPublic) {
      throw new BadRequestException('PKCE (code_challenge) requerido para clientes publicos');
    }

    const requested = (q.scope || 'openid').split(/\s+/).filter(Boolean);
    const allowed = client.allowedScopes.split(' ');
    const scope = requested.filter((s) => allowed.includes(s));
    if (!scope.includes('openid')) scope.unshift('openid');

    return {
      clientId: q.client_id,
      redirectUri: q.redirect_uri,
      scope: scope.join(' '),
      state: q.state,
      nonce: q.nonce,
      codeChallenge: q.code_challenge,
      codeChallengeMethod: q.code_challenge_method,
    };
  }

  private buildRedirect(base: string, params: Record<string, string | undefined>): string {
    const url = new URL(base);
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, v);
    }
    return url.toString();
  }
}
