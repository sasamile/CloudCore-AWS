import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HostConsoleService } from './host-console.service';
import { HostConsoleGateway } from './host-console.gateway';
import { HostConsoleController } from './host-console.controller';
import { WsJwtGuard } from '../auth/ws-jwt.guard';

@Module({
  imports: [AuthModule],
  controllers: [HostConsoleController],
  providers: [HostConsoleService, HostConsoleGateway, WsJwtGuard],
})
export class HostConsoleModule {}
