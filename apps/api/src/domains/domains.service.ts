import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { TunnelService } from '../tunnel/tunnel.service';
import { getRoutingMode } from '../common/networking.util';

const NGINX_SITES_PATH = '/etc/nginx/sites-available';
const NGINX_ENABLED_PATH = '/etc/nginx/sites-enabled';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private prisma: PrismaService,
    private tunnel: TunnelService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.domain.findMany({
      where: { userId },
      include: { instance: { select: { id: true, name: true, internalPort: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: { domain: string; targetPort?: number; instanceId: string }) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: data.instanceId, userId },
    });
    if (!instance) throw new NotFoundException('Instancia no encontrada');

    const targetPort = data.targetPort ?? instance.internalPort;
    if (!targetPort) throw new ConflictException('La instancia no tiene puerto asignado');

    const domain = await this.prisma.domain.create({
      data: {
        domain: data.domain,
        targetPort,
        instanceId: data.instanceId,
        userId,
        sslEnabled: getRoutingMode() === 'tunnel',
      },
      include: { instance: { select: { id: true, name: true, internalPort: true } } },
    });

    if (this.tunnel.isTunnelMode()) {
      await this.tunnel.syncIngress();
    } else {
      await this.generateNginxConfig(domain.id, data.domain, targetPort);
    }

    return domain;
  }

  async remove(id: string, userId: string) {
    const domain = await this.prisma.domain.findFirst({ where: { id, userId } });
    if (!domain) throw new NotFoundException('Dominio no encontrado');

    if (this.tunnel.isTunnelMode()) {
      await this.tunnel.syncIngress();
    } else {
      await this.removeNginxConfig(domain.domain);
    }

    return this.prisma.domain.delete({ where: { id } });
  }

  async enableSsl(id: string, userId: string) {
    const domain = await this.prisma.domain.findFirst({ where: { id, userId } });
    if (!domain) throw new NotFoundException('Dominio no encontrado');

    if (this.tunnel.isTunnelMode()) {
      return this.prisma.domain.update({
        where: { id },
        data: { sslEnabled: true },
      });
    }

    try {
      execSync(
        `certbot --nginx -d ${domain.domain} --non-interactive --agree-tos --email admin@${domain.domain}`,
        { stdio: 'pipe' },
      );

      return this.prisma.domain.update({
        where: { id },
        data: { sslEnabled: true },
      });
    } catch (error) {
      this.logger.error(`SSL error for ${domain.domain}: ${(error as Error).message}`);
      throw error;
    }
  }

  async getTunnelStatus() {
    const configPath = process.env.CLOUDFLARED_CONFIG_PATH || '/var/lib/zyncloud/cloudflared-ingress.yml';
    let ingressPreview = '';
    try {
      ingressPreview = await fsp.readFile(configPath, 'utf8');
    } catch {
      ingressPreview = '';
    }
    return {
      mode: getRoutingMode(),
      baseDomain: process.env.BASE_DOMAIN || null,
      configPath,
      ingressPreview,
    };
  }

  private async generateNginxConfig(domainId: string, domain: string, targetPort: number) {
    const config = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${targetPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;

    try {
      const configPath = path.join(NGINX_SITES_PATH, domain);
      await fsp.writeFile(configPath, config);

      const enabledPath = path.join(NGINX_ENABLED_PATH, domain);
      try {
        await fsp.symlink(configPath, enabledPath);
      } catch {}

      execSync('nginx -t && nginx -s reload', { stdio: 'pipe' });

      await this.prisma.domain.update({
        where: { id: domainId },
        data: { nginxConfig: configPath },
      });

      this.logger.log(`Nginx configured for ${domain}`);
    } catch (error) {
      this.logger.warn(`Could not configure nginx for ${domain}: ${(error as Error).message}`);
    }
  }

  private async removeNginxConfig(domain: string) {
    try {
      await fsp.unlink(path.join(NGINX_ENABLED_PATH, domain)).catch(() => {});
      await fsp.unlink(path.join(NGINX_SITES_PATH, domain)).catch(() => {});
      execSync('nginx -s reload', { stdio: 'pipe' });
    } catch (error) {
      this.logger.warn(`Could not remove nginx config for ${domain}: ${(error as Error).message}`);
    }
  }
}
