import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import { InstancesService } from '../instances/instances.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { TunnelService } from '../tunnel/tunnel.service';
import { buildDeployScript, buildStartScript } from './deploy-script.util';
import { buildDeploymentHostname } from '../common/networking.util';

export interface CreateDeploymentInput {
  repoFullName: string; // "owner/repo"
  branch?: string;
  rootDir?: string;
  buildCommand?: string;
  startCommand?: string;
  framework?: string;
}

/**
 * Despliegue estilo Vercel: el usuario importa un repo de GitHub y se despliega
 * en la instancia de deploy por defecto (oculta). Varios proyectos conviven en la
 * misma instancia, cada uno en su propio puerto. Cada push re-despliega vía webhook.
 */
@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly docker: DockerService,
    private readonly instances: InstancesService,
    private readonly integrations: IntegrationsService,
    private readonly tunnel: TunnelService,
  ) {}

  async list(userId: string) {
    return this.prisma.deployment.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(userId: string, id: string) {
    const dep = await this.prisma.deployment.findFirst({ where: { id, userId } });
    if (!dep) throw new NotFoundException('Proyecto no encontrado');
    return dep;
  }

  /** Puerto interno único por proyecto dentro de la instancia (3000, 3001, ...). */
  private async nextAppPort(userId: string): Promise<number> {
    const last = await this.prisma.deployment.findFirst({
      where: { userId, port: { not: null } },
      orderBy: { port: 'desc' },
    });
    return (last?.port ?? 2999) + 1;
  }

  /**
   * Importa un proyecto: resuelve la instancia default, auto-detecta el framework
   * si no vienen comandos, asigna puerto y crea el registro. No dispara el deploy
   * (eso lo hace trigger()).
   */
  async create(userId: string, input: CreateDeploymentInput) {
    const instance = await this.instances.getOrCreateDefaultInstance(userId);
    if (!instance) {
      throw new BadRequestException('No se pudo preparar la instancia de despliegue');
    }

    const branch = input.branch || 'main';
    const rootDir = input.rootDir || '.';

    // Auto-detección tipo Vercel si el usuario no especificó comandos.
    let framework = input.framework;
    let buildCommand = input.buildCommand;
    let startCommand = input.startCommand;
    if (!buildCommand || !startCommand) {
      const detected = await this.integrations.detectFramework(userId, input.repoFullName, branch, rootDir);
      framework = framework || detected.framework;
      buildCommand = buildCommand || detected.buildCommand;
      startCommand = startCommand || detected.startCommand;
    }

    const port = await this.nextAppPort(userId);
    const hostname = buildDeploymentHostname(input.repoFullName);

    return this.prisma.deployment.create({
      data: {
        userId,
        instanceId: instance.id,
        repoFullName: input.repoFullName,
        branch,
        rootDir,
        framework: framework || null,
        buildCommand: buildCommand || null,
        startCommand: startCommand || null,
        port,
        hostname,
        status: 'idle',
      },
    });
  }

  /** Dispara el pipeline. Devuelve de inmediato; el trabajo corre en background. */
  async trigger(userId: string, deploymentId: string) {
    const dep = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, userId },
      include: { instance: true },
    });
    if (!dep) throw new NotFoundException('Deployment no encontrado');

    // Asegura que la instancia default esté corriendo antes de desplegar.
    if (!dep.instance.containerId || dep.instance.status !== 'running') {
      await this.instances.getOrCreateDefaultInstance(userId);
    }
    const fresh = await this.prisma.instance.findUnique({ where: { id: dep.instanceId } });
    if (!fresh?.containerId || fresh.status !== 'running') {
      throw new BadRequestException('La instancia de despliegue no está corriendo');
    }

    // Backfill de hostname para proyectos creados antes de esta feature.
    if (!dep.hostname) {
      const hostname = buildDeploymentHostname(dep.repoFullName);
      if (hostname) {
        await this.prisma.deployment.update({ where: { id: dep.id }, data: { hostname } });
        dep.hostname = hostname;
      }
    }

    await this.prisma.deployment.update({
      where: { id: dep.id },
      data: { status: 'building', lastLog: 'Iniciando despliegue...' },
    });

    // No esperamos: corre en background y actualiza estado/logs.
    this.runPipeline(dep.id, fresh.containerId, userId, dep).catch(async (e) => {
      const msg = (e as Error).message || 'Error desconocido al iniciar despliegue';
      this.logger.error(`Deploy ${dep.id} falló: ${msg}`);
      await this.prisma.deployment.update({
        where: { id: dep.id },
        data: { status: 'error', lastLog: msg },
      }).catch(() => {});
    });

    return { status: 'building', deploymentId: dep.id };
  }

  /** Elimina el proyecto: detiene el proceso en la instancia y borra el registro. */
  async remove(userId: string, deploymentId: string) {
    const dep = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, userId },
      include: { instance: true },
    });
    if (!dep) throw new NotFoundException('Proyecto no encontrado');

    if (dep.instance.containerId && dep.instance.status === 'running') {
      const dirName = dep.repoFullName.split('/').pop() || 'app';
      const appName = dirName.replace(/[^a-zA-Z0-9_-]/g, '-');
      const cleanup = [
        'set +e',
        `pkill -f "${appName}-run" || true`,
        `rm -rf "/apps/${dirName}" || true`,
        `rm -f "/var/log/${appName}.log" || true`,
        'echo "== REMOVED =="',
      ].join('\n');
      try {
        await this.docker.runScript(dep.instance.containerId, cleanup);
      } catch (e) {
        this.logger.warn(
          `Cleanup de ${deploymentId} falló (se borra el registro igual): ${(e as Error).message}`,
        );
      }
    }

    await this.prisma.deployment.delete({ where: { id: dep.id } });
    return { ok: true };
  }

  private async runPipeline(
    deploymentId: string,
    containerId: string,
    userId: string,
    dep: {
      repoFullName: string;
      branch: string;
      rootDir: string;
      buildCommand: string | null;
      startCommand: string | null;
      port: number | null;
      hostname: string | null;
    },
  ) {
    // Token del usuario para clonar repos privados.
    let token: string | undefined;
    try {
      token = await this.integrations.getGithubToken(userId);
    } catch {
      token = undefined;
    }

    const script = buildDeployScript(dep, token);
    const { output, timedOut, exitCode } = await this.docker.runScript(containerId, script);
    // Éxito por código de salida real (fiable); cae al marcador == OK == si Docker
    // no reportó exit code por alguna razón.
    const success = !timedOut && (exitCode === 0 || (exitCode === null && /== OK ==/.test(output)));

    let finalLog = output;

    // Arranca la app en un exec DETACHED aparte (no bloquea ni rompe el stream).
    if (success && dep.startCommand) {
      try {
        await this.docker.startDetached(containerId, buildStartScript(dep));
        finalLog += `\n== START ==\nApp arrancada en background (puerto ${dep.port ?? 3000}).`;
      } catch (e) {
        this.logger.warn(`Deploy ${deploymentId}: build OK pero arranque falló: ${(e as Error).message}`);
        finalLog += `\n== START FAIL ==\n${(e as Error).message}`;
      }
    }

    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: success ? 'success' : 'error',
        lastLog: finalLog.slice(-8000),
      },
    });
    this.logger.log(`Deploy ${deploymentId}: ${success ? 'success' : 'error'}`);

    // Publica la ruta pública: registra DNS + ingress del hostname en el túnel.
    if (success && dep.hostname && this.tunnel.isTunnelMode()) {
      try {
        await this.tunnel.syncIngress();
        this.logger.log(`Ruta pública sincronizada: https://${dep.hostname}`);
      } catch (e) {
        this.logger.warn(`No se pudo sincronizar la ruta ${dep.hostname}: ${(e as Error).message}`);
      }
    }
  }
}
