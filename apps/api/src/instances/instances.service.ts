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
      where: { userId },
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

  async create(userId: string, data: { name: string; memoryLimit: number; cpuLimit: number; sshKeyId?: string }) {
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

  async deployTestApp(id: string, userId: string) {
    const instance = await this.findOne(id, userId);
    if (!instance.containerId || instance.status !== 'running') {
      throw new NotFoundException('Instancia no encontrada o no esta corriendo');
    }

    const serverCode = [
      'const http = require("http");',
      'const os = require("os");',
      'const PORT = 3000;',
      'const server = http.createServer((req, res) => {',
      '  const up = Math.floor(process.uptime());',
      '  const ram = Math.round(process.memoryUsage().rss / 1024 / 1024);',
      '  const html = `<!DOCTYPE html>',
      '<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>ZynCloud - Servidor Activo</title>',
      '<style>',
      '*{margin:0;padding:0;box-sizing:border-box}',
      'body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#0a0e1a,#111827);color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}',
      '.c{max-width:580px;width:100%}',
      '.card{background:rgba(15,19,33,.95);border:1px solid #1e293b;border-radius:20px;padding:44px;text-align:center}',
      '.lr{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:28px}',
      '.logo{width:52px;height:52px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#fff;box-shadow:0 4px 20px rgba(59,130,246,.35)}',
      '.br{font-size:30px;font-weight:700;background:linear-gradient(135deg,#3b82f6,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}',
      '.st{display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:28px;font-size:14px;color:#94a3b8}',
      '.dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.6);animation:p 2s infinite}',
      '@keyframes p{0%,100%{opacity:1}50%{opacity:.4}}',
      '.g{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}',
      '.s{background:rgba(30,41,59,.5);padding:18px;border-radius:14px;border:1px solid rgba(30,41,59,.7);text-align:left}',
      '.si{font-size:22px;margin-bottom:6px}',
      '.sv{font-size:20px;font-weight:700;margin-bottom:2px}',
      '.sl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}',
      '.ok{background:linear-gradient(135deg,rgba(34,197,94,.1),rgba(34,197,94,.04));border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:14px}',
      '.ot{color:#22c55e;font-weight:600;font-size:14px;margin-bottom:3px}',
      '.os{color:#64748b;font-size:12px}',
      '.f{text-align:center;margin-top:20px;font-size:11px;color:#475569}',
      '</style></head><body><div class="c"><div class="card">',
      '<div class="lr"><div class="logo">Z</div><span class="br">ZynCloud</span></div>',
      '<div class="st"><span class="dot"></span> Servidor activo y funcionando</div>',
      '<div class="g">',
      '<div class="s"><div class="si">🖥️</div><div class="sv">${os.hostname().slice(0,12)}</div><div class="sl">Hostname</div></div>',
      '<div class="s"><div class="si">⏱️</div><div class="sv">${up}s</div><div class="sl">Uptime</div></div>',
      '<div class="s"><div class="si">💾</div><div class="sv">${ram} MB</div><div class="sl">RAM usada</div></div>',
      '<div class="s"><div class="si">⚙️</div><div class="sv">${process.version}</div><div class="sl">Node.js</div></div>',
      '</div>',
      '<div class="ok"><div class="ot">Deploy exitoso en ZynCloud</div><div class="os">Pagina servida desde un contenedor Docker gestionado por tu panel</div></div>',
      '</div><div class="f">ZynCloud v0.1.0 · Puerto ${PORT}</div></div></body></html>`;',
      '  res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});',
      '  res.end(html);',
      '});',
      'server.listen(PORT, "0.0.0.0", () => console.log("App en puerto " + PORT));',
    ].join('\n');

    const b64 = Buffer.from(serverCode).toString('base64');

    // Kill old process, write file, start new process
    await this.dockerService.execDetached(instance.containerId, [
      '/bin/bash', '-c',
      'pkill -f "node /home/ubuntu/app/server.js" 2>/dev/null || true',
    ]);

    await this.dockerService.execDetached(instance.containerId, [
      '/bin/bash', '-c',
      `mkdir -p /home/ubuntu/app && echo "${b64}" | base64 -d > /home/ubuntu/app/server.js`,
    ]);

    await this.dockerService.execDetached(instance.containerId, [
      '/bin/bash', '-c',
      'cd /home/ubuntu/app && nohup node server.js > /tmp/app.log 2>&1 & sleep 1 && curl -s http://localhost:3000 > /dev/null && echo OK || echo FAIL',
    ]);

    const port = instance.internalPort || 'N/A';
    const enriched = enrichInstance(instance);
    const url = enriched.appUrl || `http://${getPublicHost()}:${port}`;

    return {
      message: 'App desplegada exitosamente',
      url,
      internalPort: port,
    };
  }

  async getStats(userId: string) {
    const instances = await this.prisma.instance.findMany({
      where: { userId },
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
