import { Injectable } from '@nestjs/common';
import { DockerService } from '../docker/docker.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(
    private dockerService: DockerService,
    private prisma: PrismaService,
  ) {}

  async getStats(instanceId: string, userId: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: instanceId, userId },
    });

    if (!instance?.containerId || instance.status !== 'running') {
      return null;
    }

    return this.dockerService.getContainerStats(instance.containerId);
  }
}
