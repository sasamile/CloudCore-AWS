import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';

export interface CreateDeploymentInput {
  instanceId: string;
  repoFullName: string; // "owner/repo"
  branch?: string;
  rootDir?: string;
  buildCommand?: string;
  startCommand?: string;
}

/**
 * Despliegue automatico dentro de una instancia:
 * clona/actualiza el repo, corre el build y arranca la app (detached).
 */
@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly docker: DockerService,
  ) {}

  async list(userId: string) {
    return this.prisma.deployment.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(userId: string, input: CreateDeploymentInput) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: input.instanceId, userId },
    });
    if (!instance) throw new NotFoundException('Instancia no encontrada');

    return this.prisma.deployment.create({
      data: {
        userId,
        instanceId: input.instanceId,
        repoFullName: input.repoFullName,
        branch: input.branch || 'main',
        rootDir: input.rootDir || '.',
        buildCommand: input.buildCommand,
        startCommand: input.startCommand,
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
    if (!dep.instance.containerId || dep.instance.status !== 'running') {
      throw new NotFoundException('La instancia no esta corriendo');
    }

    await this.prisma.deployment.update({
      where: { id: dep.id },
      data: { status: 'building', lastLog: 'Iniciando despliegue...' },
    });

    // No esperamos: corre en background y actualiza estado/logs.
    this.runPipeline(dep.id, dep.instance.containerId, dep).catch((e) =>
      this.logger.error(`Deploy ${dep.id} fallo: ${(e as Error).message}`),
    );

    return { status: 'building', deploymentId: dep.id };
  }

  private buildScript(dep: {
    repoFullName: string;
    branch: string;
    rootDir: string;
    buildCommand: string | null;
    startCommand: string | null;
  }): string {
    const token = process.env.GITHUB_DEPLOY_TOKEN;
    const repoUrl = token
      ? `https://${token}@github.com/${dep.repoFullName}.git`
      : `https://github.com/${dep.repoFullName}.git`;
    const dirName = dep.repoFullName.split('/').pop() || 'app';
    const appName = dirName.replace(/[^a-zA-Z0-9_-]/g, '-');

    return [
      'set -e',
      'export DEBIAN_FRONTEND=noninteractive',
      'mkdir -p /apps && cd /apps',
      `if [ -d "${dirName}/.git" ]; then`,
      `  cd "${dirName}" && git fetch --all && git reset --hard "origin/${dep.branch}";`,
      `else`,
      `  git clone --branch "${dep.branch}" --depth 1 "${repoUrl}" "${dirName}" && cd "${dirName}";`,
      `fi`,
      `cd "${dep.rootDir}"`,
      dep.buildCommand ? `echo "== BUILD =="; ${dep.buildCommand}` : 'echo "(sin build)"',
      // arranca la app en background, log en /var/log
      dep.startCommand
        ? `echo "== START =="; pkill -f "${appName}-run" || true; ` +
          `setsid bash -c 'exec -a ${appName}-run ${dep.startCommand}' > "/var/log/${appName}.log" 2>&1 < /dev/null &`
        : 'echo "(sin start)"',
      'echo "== OK =="',
    ].join('\n');
  }

  private async runPipeline(
    deploymentId: string,
    containerId: string,
    dep: {
      repoFullName: string;
      branch: string;
      rootDir: string;
      buildCommand: string | null;
      startCommand: string | null;
    },
  ) {
    const script = this.buildScript(dep);
    const { output, timedOut } = await this.docker.runScript(containerId, script);
    const success = !timedOut && /== OK ==/.test(output);

    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: success ? 'live' : 'error',
        lastLog: output.slice(-8000), // ultimas lineas
      },
    });
    this.logger.log(`Deploy ${deploymentId}: ${success ? 'live' : 'error'}`);
  }
}
