import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import { extractContainerIp } from '../common/networking.util';
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

  async findByInstance(instanceId: string, userId: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: instanceId, userId },
    });
    if (!instance) throw new NotFoundException('Instancia no encontrada');

    return this.prisma.backup.findMany({
      where: { instanceId },
      include: { instance: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(userId: string) {
    return this.prisma.backup.findMany({
      where: { instance: { userId } },
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
    const repo = `zyncloud-backup/${instance.name}`;
    const tag = timestamp;
    const imageRef = `${repo}:${tag}`;

    try {
      await this.dockerService.commitContainer(instance.containerId, repo, tag);

      const docker = this.dockerService.getClient();
      const image = docker.getImage(imageRef);
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
    const backup = await this.prisma.backup.findFirst({
      where: { id: backupId, instance: { userId } },
      include: { instance: true },
    });
    if (!backup) throw new NotFoundException('Backup no encontrado');

    const instance = backup.instance;
    if (!instance.internalPort) {
      throw new NotFoundException('La instancia no tiene puerto asignado');
    }

    const timestamp = backup.fileName.slice(instance.name.length + 1, -4);
    const imageRef = `zyncloud-backup/${instance.name}:${timestamp}`;

    try {
      if (instance.containerId) {
        await this.dockerService.removeContainer(instance.containerId);
      }

      const fileContent = await fs.readFile(backup.filePath);
      const loadedImage = await this.dockerService.loadImage(fileContent);
      const image = loadedImage || imageRef;

      const container = await this.dockerService.createContainer({
        name: `${instance.id}-${instance.name}`,
        image,
        memoryLimit: instance.memoryLimit,
        cpuLimit: instance.cpuLimit,
        hostPort: instance.internalPort,
      });

      await container.start();
      const info = await container.inspect();
      const ipAddress = extractContainerIp(info);

      await this.prisma.instance.update({
        where: { id: instance.id },
        data: {
          containerId: container.id,
          status: 'running',
          ipAddress,
        },
      });

      this.logger.log(`Backup restored: ${backup.fileName}`);
      return { message: 'Snapshot restaurado. La instancia está en ejecución.' };
    } catch (error) {
      this.logger.error(`Restore failed: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    const backup = await this.prisma.backup.findFirst({
      where: { id, instance: { userId } },
    });
    if (!backup) throw new NotFoundException('Backup no encontrado');

    try {
      await fs.unlink(backup.filePath);
    } catch {}

    return this.prisma.backup.delete({ where: { id } });
  }
}
