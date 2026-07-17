import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { HostConsoleService, HostConsoleSession } from './host-console.service';
import { WsJwtGuard } from '../auth/ws-jwt.guard';

@WebSocketGateway({
  cors: { origin: '*' },
  // Terminal = muchos mensajes pequenos: sin compresion se reduce la latencia por frame.
  perMessageDeflate: false,
  httpCompression: false,
})
export class HostConsoleGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(HostConsoleGateway.name);
  private sessions = new Map<string, HostConsoleSession>();

  constructor(private hostConsole: HostConsoleService) {}

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('host:connect')
  async handleConnect(@ConnectedSocket() client: Socket) {
    try {
      if (!this.hostConsole.isEnabled()) {
        client.emit('host:error', 'Host console is not enabled on this server');
        return;
      }

      const existing = this.sessions.get(client.id);
      existing?.close();

      const session = await this.hostConsole.openSession();
      this.sessions.set(client.id, session);

      session.onData((data) => client.emit('host:output', data));
      session.onClose(() => {
        client.emit('host:output', '\r\n\x1b[31mSession closed.\x1b[0m\r\n');
        this.sessions.delete(client.id);
      });

      client.emit('host:connected');
      this.logger.log(`Host console connected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Host console error: ${(error as Error).message}`);
      client.emit('host:error', (error as Error).message);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('host:input')
  handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { data: string },
  ) {
    this.sessions.get(client.id)?.write(data.data);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('host:resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cols: number; rows: number },
  ) {
    this.sessions.get(client.id)?.resize(data.cols, data.rows);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('host:disconnect')
  handleDisconnectSession(@ConnectedSocket() client: Socket) {
    const session = this.sessions.get(client.id);
    session?.close();
    this.sessions.delete(client.id);
  }

  handleDisconnect(client: Socket) {
    const session = this.sessions.get(client.id);
    session?.close();
    this.sessions.delete(client.id);
  }
}
