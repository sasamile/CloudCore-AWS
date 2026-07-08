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
    const domains = await this.prisma.domain.findMany({
      where: { userId },
      include: { instance: { select: { id: true, name: true, internalPort: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!this.tunnel.isTunnelMode()) return domains;

    const cnameTarget = process.env.CLOUDFLARE_TUNNEL_ID
      ? `${process.env.CLOUDFLARE_TUNNEL_ID}.cfargotunnel.com`
      : null;

    const cfHostnames = await this.tunnel.fetchCloudflareHostnames();

    return Promise.all(
      domains.map(async (d) => ({
        ...d,
        routeActive: cfHostnames.includes(d.domain) || (await this.tunnel.isHostnameRouted(d.domain)),
        cloudflareActive: cfHostnames.includes(d.domain),
        clientDns: cnameTarget
          ? { type: 'CNAME', name: d.domain.split('.')[0], target: cnameTarget }
          : null,
      })),
    );
  }

  async syncTunnel(userId: string) {
    if (!this.tunnel.isTunnelMode()) {
      return { ok: false, error: 'Tunnel mode is not enabled' };
    }

    const sync = await this.tunnel.syncIngress();
    const domains = await this.prisma.domain.findMany({ where: { userId } });
    const cfHostnames = await this.tunnel.fetchCloudflareHostnames();

    return {
      ok: sync.cloudflareSynced || sync.restarted,
      cloudflareSynced: sync.cloudflareSynced,
      cloudflareError: sync.cloudflareError,
      routeCount: sync.routeCount,
      domains: domains.map((d) => ({
        domain: d.domain,
        active: cfHostnames.includes(d.domain),
      })),
    };
  }

  async create(userId: string, data: { domain: string; targetPort?: number; instanceId: string }) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: data.instanceId, userId },
    });
    if (!instance) throw new NotFoundException('Instancia no encontrada');

    if (!instance.internalPort) throw new ConflictException('La instancia no tiene puerto asignado');

    // Siempre puerto del HOST (ej. 10002), no el 3000 del contenedor
    const targetPort = instance.internalPort;

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
      const sync = await this.tunnel.syncIngress();
      return { ...domain, tunnelSync: sync };
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
    const configPath = process.env.CLOUDFLARED_CONFIG_PATH || '/etc/cloudflared/config.yml';
    let ingressPreview = '';
    try {
      ingressPreview = await fsp.readFile(configPath, 'utf8');
    } catch {
      ingressPreview = '';
    }

    const tunnelName = process.env.CLOUDFLARE_TUNNEL_NAME || null;
    const tunnelId = process.env.CLOUDFLARE_TUNNEL_ID || null;
    const cnameTarget = tunnelId ? `${tunnelId}.cfargotunnel.com` : null;
    const autoDns = Boolean(tunnelName);
    const autoReload = Boolean(
      process.env.CLOUDFLARE_API_TOKEN ||
        process.env.CLOUDFLARED_RESTART_CMD ||
        process.env.HOST_CONSOLE_ENABLED === 'true' ||
        process.env.TUNNEL_USE_SSH === 'true',
    );
    const cloudflareApi = Boolean(
      process.env.CLOUDFLARE_API_TOKEN &&
        process.env.CLOUDFLARE_ACCOUNT_ID &&
        process.env.CLOUDFLARE_TUNNEL_ID,
    );

    return {
      mode: getRoutingMode(),
      baseDomain: process.env.BASE_DOMAIN || null,
      configPath,
      ingressPreview,
      tunnelName,
      cnameTarget,
      autoDns,
      autoReload,
      cloudflareApi,
      clientSteps: cloudflareApi
        ? [
            'ZynCloud → Domains → agrega tu dominio (ej. prueba.vekino.site) y elige la instancia.',
            'En TU Cloudflare: CNAME prueba → el target que muestra abajo (solo una vez por dominio).',
            'ZynCloud publica la ruta al túnel automáticamente. Espera 1–2 min.',
          ]
        : [
            'ZynCloud → Domains → agrega tu dominio (ej. prueba.vekino.site) y elige la instancia.',
            'En TU Cloudflare/Hostinger: CNAME del subdominio al túnel de ZynCloud (abajo).',
            'Espera 1–5 min y abre https://tu-dominio.',
          ],
      dnsExample: cnameTarget
        ? {
            type: 'CNAME',
            name: 'prueba',
            target: cnameTarget,
            note: 'NO uses tipo Tunnel en tu cuenta. Borra "Tunnel → zyncloud" y crea CNAME con este target.',
          }
        : null,
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
