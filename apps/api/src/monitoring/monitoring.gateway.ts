import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DockerService } from '../docker/docker.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class MonitoringGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MonitoringGateway.name);
  private subscriptions = new Map<string, NodeJS.Timeout>();

  constructor(
    private dockerService: DockerService,
    private prisma: PrismaService,
  ) {}

  @SubscribeMessage('stats:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
  ) {
    const key = `${client.id}:${data.instanceId}`;

    if (this.subscriptions.has(key)) return;

    const interval = setInterval(async () => {
      try {
        const instance = await this.prisma.instance.findUnique({
          where: { id: data.instanceId },
        });

        if (!instance?.containerId || instance.status !== 'running') {
          return;
        }

        const stats = await this.dockerService.getContainerStats(instance.containerId);
        client.emit('stats:data', stats);
      } catch (error) {
        this.logger.debug(`Stats error: ${error.message}`);
      }
    }, 2000);

    this.subscriptions.set(key, interval);
    this.logger.log(`Stats subscription started: ${data.instanceId}`);
  }

  @SubscribeMessage('stats:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
  ) {
    const key = `${client.id}:${data.instanceId}`;
    const interval = this.subscriptions.get(key);
    if (interval) {
      clearInterval(interval);
      this.subscriptions.delete(key);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [key, interval] of this.subscriptions.entries()) {
      if (key.startsWith(client.id)) {
        clearInterval(interval);
        this.subscriptions.delete(key);
      }
    }
  }
}
