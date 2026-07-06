import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

const NGINX_SITES_PATH = '/etc/nginx/sites-available';
const NGINX_ENABLED_PATH = '/etc/nginx/sites-enabled';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.domain.findMany({
      where: { userId },
      include: { instance: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: { domain: string; targetPort: number; instanceId: string }) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: data.instanceId, userId },
    });
    if (!instance) throw new NotFoundException('Instancia no encontrada');

    const domain = await this.prisma.domain.create({
      data: {
        domain: data.domain,
        targetPort: data.targetPort,
        instanceId: data.instanceId,
        userId,
      },
      include: { instance: { select: { id: true, name: true } } },
    });

    await this.generateNginxConfig(domain.id, data.domain, data.targetPort);
    return domain;
  }

  async remove(id: string, userId: string) {
    const domain = await this.prisma.domain.findFirst({ where: { id, userId } });
    if (!domain) throw new NotFoundException('Dominio no encontrado');

    await this.removeNginxConfig(domain.domain);
    return this.prisma.domain.delete({ where: { id } });
  }

  async enableSsl(id: string, userId: string) {
    const domain = await this.prisma.domain.findFirst({ where: { id, userId } });
    if (!domain) throw new NotFoundException('Dominio no encontrado');

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
      this.logger.error(`SSL error for ${domain.domain}: ${error.message}`);
      throw error;
    }
  }

  private async generateNginxConfig(domainId: string, domain: string, targetPort: number) {
    const config = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://localhost:${targetPort};
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
      await fs.writeFile(configPath, config);

      const enabledPath = path.join(NGINX_ENABLED_PATH, domain);
      try {
        await fs.symlink(configPath, enabledPath);
      } catch {}

      execSync('nginx -t && nginx -s reload', { stdio: 'pipe' });

      await this.prisma.domain.update({
        where: { id: domainId },
        data: { nginxConfig: configPath },
      });

      this.logger.log(`Nginx configured for ${domain}`);
    } catch (error) {
      this.logger.warn(`Could not configure nginx for ${domain}: ${error.message}`);
    }
  }

  private async removeNginxConfig(domain: string) {
    try {
      await fs.unlink(path.join(NGINX_ENABLED_PATH, domain)).catch(() => {});
      await fs.unlink(path.join(NGINX_SITES_PATH, domain)).catch(() => {});
      execSync('nginx -s reload', { stdio: 'pipe' });
    } catch (error) {
      this.logger.warn(`Could not remove nginx config for ${domain}: ${error.message}`);
    }
  }
}
