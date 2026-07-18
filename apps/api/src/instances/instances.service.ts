import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import { SshKeysService } from '../ssh-keys/ssh-keys.service';
import { enrichInstance, extractContainerIp, getPublicHost } from '../common/networking.util';
import { TunnelService } from '../tunnel/tunnel.service';

@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);

  constructor(
    private prisma: PrismaService,
    private dockerService: DockerService,
    private sshKeysService: SshKeysService,
    private tunnel: TunnelService,
  ) {}

  async findAll(userId: string) {
    const instances = await this.prisma.instance.findMany({
      // Ocultamos la instancia de sistema (default de deployments) de la lista de Compute.
      where: { userId, isSystem: false },
      orderBy: { createdAt: 'desc' },
      include: { sshKey: { select: { name: true } }, domains: { select: { domain: true } } },
    });
    return instances.map((i) => enrichInstance(i));
  }

  async findOne(id: string, userId: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id, userId },
      include: { domains: true, sshKey: { select: { name: true } } },
    });
    if (!instance) throw new NotFoundException('Instancia no encontrada');

    if (instance.containerId && instance.status === 'running') {
      try {
        const info = await this.dockerService.getContainerInfo(instance.containerId);
        const ip = extractContainerIp(info);
        if (ip && ip !== instance.ipAddress) {
          await this.prisma.instance.update({ where: { id }, data: { ipAddress: ip } });
          instance.ipAddress = ip;
        }
      } catch {}
    }

    return enrichInstance(instance);
  }

  private async getNextPort(): Promise<number> {
    const lastInstance = await this.prisma.instance.findFirst({
      where: { internalPort: { not: null } },
      orderBy: { internalPort: 'desc' },
    });
    return (lastInstance?.internalPort || 9999) + 3;
  }

  async create(
    userId: string,
    data: { name: string; memoryLimit: number; cpuLimit: number; sshKeyId?: string },
    isSystem = false,
  ) {
    const hostPort = await this.getNextPort();
    const httpPort = hostPort + 1;
    const sshPort = hostPort + 2;

    const instance = await this.prisma.instance.create({
      data: {
        name: data.name,
        memoryLimit: data.memoryLimit,
        cpuLimit: data.cpuLimit,
        status: 'creating',
        internalPort: hostPort,
        httpPort,
        sshPort,
        sshKeyId: data.sshKeyId || null,
        isSystem,
        userId,
      },
    });

    try {
      const container = await this.dockerService.createContainer({
        name: `${instance.id}-${data.name}`,
        image: process.env.UBUNTU_BASE_IMAGE || 'zyncloud/ubuntu-base:latest',
        memoryLimit: data.memoryLimit,
        cpuLimit: data.cpuLimit,
        hostPort,
      });

      await container.start();
      const info = await container.inspect();
      const ipAddress = extractContainerIp(info);

      const updated = await this.prisma.instance.update({
        where: { id: instance.id },
        data: {
          containerId: container.id,
          status: 'running',
          ipAddress,
        },
        include: { sshKey: { select: { name: true } } },
      });

      await this.setupSsh(updated.containerId!);

      if (data.sshKeyId) {
        await this.injectSshKey(updated.containerId!, data.sshKeyId, userId);
      }

      await this.tunnel.syncIngress();

      const full = await this.prisma.instance.findUnique({
        where: { id: instance.id },
        include: { sshKey: { select: { name: true } }, domains: { select: { domain: true } } },
      });
      return enrichInstance(full!);
    } catch (error) {
      this.logger.error(`Failed to create container: ${error.message}`);
      await this.prisma.instance.update({
        where: { id: instance.id },
        data: { status: 'error' },
      });
      throw error;
    }
  }

  private async setupSsh(containerId: string) {
    try {
      await this.dockerService.execDetached(containerId, [
        '/bin/bash', '-c',
        'mkdir -p /var/run/sshd /root/.ssh && chmod 700 /root/.ssh && (pgrep sshd > /dev/null || /usr/sbin/sshd)',
      ]);
    } catch (error) {
      this.logger.warn(`Could not start SSH: ${error.message}`);
    }
  }

  private async injectSshKey(containerId: string, sshKeyId: string, userId: string) {
    try {
      const key = await this.sshKeysService.findPublicKey(sshKeyId, userId);
      const line = key.publicKey.replace(/"/g, '\\"');

      await this.dockerService.execDetached(containerId, [
        '/bin/bash', '-c',
        `mkdir -p /root/.ssh /home/ubuntu/.ssh && chmod 700 /root/.ssh /home/ubuntu/.ssh && echo "${line}" >> /root/.ssh/authorized_keys && echo "${line}" >> /home/ubuntu/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys`,
      ]);
    } catch (error) {
      this.logger.warn(`Could not inject SSH key: ${error.message}`);
    }
  }

  private async refreshNetworking(id: string, containerId: string) {
    const info = await this.dockerService.getContainerInfo(containerId);
    const ipAddress = extractContainerIp(info);
    return this.prisma.instance.update({
      where: { id },
      data: { ipAddress, status: 'running' },
    });
  }

  async start(id: string, userId: string) {
    const instance = await this.findOne(id, userId);
    if (!instance.containerId) throw new NotFoundException('Contenedor no encontrado');

    await this.dockerService.startContainer(instance.containerId);
    await this.setupSsh(instance.containerId);
    await this.refreshNetworking(id, instance.containerId);
    await this.tunnel.syncIngress();
    const withKey = await this.prisma.instance.findUnique({
      where: { id },
      include: { sshKey: { select: { name: true } }, domains: true },
    });
    return enrichInstance(withKey!);
  }

  async stop(id: string, userId: string) {
    const instance = await this.findOne(id, userId);
    if (!instance.containerId) throw new NotFoundException('Contenedor no encontrado');

    await this.dockerService.stopContainer(instance.containerId);
    return this.prisma.instance.update({
      where: { id },
      data: { status: 'stopped' },
    });
  }

  async restart(id: string, userId: string) {
    const instance = await this.findOne(id, userId);
    if (!instance.containerId) throw new NotFoundException('Contenedor no encontrado');

    await this.dockerService.restartContainer(instance.containerId);
    await this.setupSsh(instance.containerId);
    await this.refreshNetworking(id, instance.containerId);
    await this.tunnel.syncIngress();
    const withKey = await this.prisma.instance.findUnique({
      where: { id },
      include: { sshKey: { select: { name: true } }, domains: true },
    });
    return enrichInstance(withKey!);
  }

  async remove(id: string, userId: string) {
    const instance = await this.findOne(id, userId);

    if (instance.containerId) {
      try {
        await this.dockerService.removeContainer(instance.containerId);
      } catch (error) {
        this.logger.warn(`Could not remove container: ${error.message}`);
      }
    }

    await this.prisma.instance.delete({ where: { id } });
    await this.tunnel.syncIngress();
    return { ok: true };
  }

  async update(id: string, userId: string, data: { name?: string }) {
    await this.findOne(id, userId);
    return this.prisma.instance.update({
      where: { id },
      data,
    });
  }

  /**
   * Devuelve la instancia de deploy por defecto del usuario (modelo Vercel).
   * La crea y la arranca si no existe. Es invisible en la lista de Compute.
   * Todos los proyectos de GitHub se despliegan aquí sin que el usuario cree instancias.
   */
  async getOrCreateDefaultInstance(userId: string) {
    const existing = await this.prisma.instance.findFirst({
      where: { userId, isSystem: true },
    });

    if (existing) {
      // Asegura que esté corriendo antes de desplegar.
      if (existing.status !== 'running') {
        try {
          await this.start(existing.id, userId);
        } catch (e) {
          this.logger.warn(`No se pudo arrancar la instancia default: ${(e as Error).message}`);
        }
      }
      return this.prisma.instance.findUnique({ where: { id: existing.id } });
    }

    // Crea la instancia default con recursos suficientes para builds (Next.js, etc.).
    const created = await this.create(
      userId,
      { name: 'Deployments', memoryLimit: 2048, cpuLimit: 1.0 },
      true,
    );
    return this.prisma.instance.findUnique({ where: { id: created.id } });
  }

  async getStats(userId: string) {
    const instances = await this.prisma.instance.findMany({
      where: { userId, isSystem: false },
    });
    const domains = await this.prisma.domain.count({ where: { userId } });

    const running = instances.filter((i) => i.status === 'running');
    const stopped = instances.filter((i) => i.status === 'stopped');

    let totalCpuUsage = 0;
    let totalMemoryUsage = 0;
    const totalMemoryLimit = instances.reduce((sum, i) => sum + i.memoryLimit, 0);

    for (const inst of running) {
      if (inst.containerId) {
        try {
          const stats = await this.dockerService.getContainerStats(inst.containerId);
          totalCpuUsage += stats.cpuPercent;
          totalMemoryUsage += stats.memoryUsageMb;
        } catch {}
      }
    }

    return {
      totalInstances: instances.length,
      runningInstances: running.length,
      stoppedInstances: stopped.length,
      totalDomains: domains,
      totalCpuUsage,
      totalMemoryUsage: Math.round(totalMemoryUsage),
      totalMemoryLimit,
    };
  }
}
