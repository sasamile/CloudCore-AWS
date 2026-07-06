import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import * as fs from 'fs/promises';
import * as path from 'path';

const BACKUP_DIR = process.env.BACKUP_DIR || '/var/lib/zyncloud/backups';

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    private prisma: PrismaService,
    private dockerService: DockerService,
  ) {}

  async findByInstance(instanceId: string) {
    return this.prisma.backup.findMany({
      where: { instanceId },
      include: { instance: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.backup.findMany({
      include: { instance: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(instanceId: string, userId: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: instanceId, userId },
    });
    if (!instance?.containerId) {
      throw new NotFoundException('Instancia no encontrada o sin contenedor');
    }

    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${instance.name}-${timestamp}.tar`;
    const filePath = path.join(BACKUP_DIR, fileName);

    try {
      const repoTag = `zyncloud-backup/${instance.name}:${timestamp}`;
      await this.dockerService.commitContainer(instance.containerId, repoTag);

      const docker = this.dockerService.getClient();
      const image = docker.getImage(repoTag);
      const stream = await image.get();

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const buffer = Buffer.concat(chunks);
      await fs.writeFile(filePath, buffer);

      await image.remove();

      const backup = await this.prisma.backup.create({
        data: {
          fileName,
          filePath,
          fileSize: buffer.length,
          instanceId,
        },
        include: { instance: { select: { id: true, name: true } } },
      });

      this.logger.log(`Backup created: ${fileName}`);
      return backup;
    } catch (error) {
      this.logger.error(`Backup failed: ${error.message}`);
      throw error;
    }
  }

  async restore(backupId: string, userId: string) {
    const backup = await this.prisma.backup.findUnique({
      where: { id: backupId },
      include: { instance: true },
    });
    if (!backup) throw new NotFoundException('Backup no encontrado');

    const instance = await this.prisma.instance.findFirst({
      where: { id: backup.instanceId, userId },
    });
    if (!instance) throw new NotFoundException('Instancia no encontrada');

    try {
      if (instance.containerId) {
        await this.dockerService.removeContainer(instance.containerId);
      }

      const docker = this.dockerService.getClient();
      const fileContent = await fs.readFile(backup.filePath);
      await new Promise<void>((resolve, reject) => {
        docker.loadImage(fileContent as any, {}, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.logger.log(`Backup restored: ${backup.fileName}`);
      return { message: 'Backup restaurado exitosamente' };
    } catch (error) {
      this.logger.error(`Restore failed: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string) {
    const backup = await this.prisma.backup.findUnique({ where: { id } });
    if (!backup) throw new NotFoundException('Backup no encontrado');

    try {
      await fs.unlink(backup.filePath);
    } catch {}

    return this.prisma.backup.delete({ where: { id } });
  }
}
