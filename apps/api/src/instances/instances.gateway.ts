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
export class InstancesGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InstancesGateway.name);
  private terminalStreams = new Map<string, any>();

  constructor(
    private dockerService: DockerService,
    private prisma: PrismaService,
  ) {}

  @SubscribeMessage('terminal:connect')
  async handleTerminalConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
  ) {
    try {
      const instance = await this.prisma.instance.findUnique({
        where: { id: data.instanceId },
      });

      if (!instance?.containerId || instance.status !== 'running') {
        client.emit('terminal:error', 'La instancia no esta corriendo');
        return;
      }

      const exec = await this.dockerService.attachToContainer(instance.containerId);
      const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

      const key = `${client.id}:${data.instanceId}`;
      this.terminalStreams.set(key, stream);

      stream.on('data', (chunk: Buffer) => {
        client.emit('terminal:output', chunk.toString('utf8'));
      });

      stream.on('end', () => {
        client.emit('terminal:output', '\r\n\x1b[31mConexion cerrada.\x1b[0m\r\n');
        this.terminalStreams.delete(key);
      });

      client.emit('terminal:connected');
      this.logger.log(`Terminal connected: ${instance.name}`);
    } catch (error) {
      this.logger.error(`Terminal connect error: ${error.message}`);
      client.emit('terminal:error', error.message);
    }
  }

  @SubscribeMessage('terminal:input')
  handleTerminalInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string; data: string },
  ) {
    const key = `${client.id}:${data.instanceId}`;
    const stream = this.terminalStreams.get(key);
    if (stream) {
      stream.write(data.data);
    }
  }

  @SubscribeMessage('terminal:resize')
  async handleTerminalResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string; cols: number; rows: number },
  ) {
    // Resize is handled by the exec instance
  }

  @SubscribeMessage('terminal:disconnect')
  handleTerminalDisconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
  ) {
    const key = `${client.id}:${data.instanceId}`;
    const stream = this.terminalStreams.get(key);
    if (stream) {
      stream.end();
      this.terminalStreams.delete(key);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [key, stream] of this.terminalStreams.entries()) {
      if (key.startsWith(client.id)) {
        stream.end();
        this.terminalStreams.delete(key);
      }
    }
  }
}
