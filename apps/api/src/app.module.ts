import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InstancesModule } from './instances/instances.module';
import { DomainsModule } from './domains/domains.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { BackupsModule } from './backups/backups.module';
import { DockerModule } from './docker/docker.module';
import { SshKeysModule } from './ssh-keys/ssh-keys.module';
import { TunnelModule } from './tunnel/tunnel.module';
import { StorageModule } from './storage/storage.module';
import { HostConsoleModule } from './host-console/host-console.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AiModule } from './ai/ai.module';
import { ZynAuthModule } from './zynauth/zynauth.module';

@Module({
  imports: [
    PrismaModule,
    DockerModule,
    TunnelModule,
    AuthModule,
    InstancesModule,
    DomainsModule,
    MonitoringModule,
    BackupsModule,
    SshKeysModule,
    StorageModule,
    HostConsoleModule,
    IntegrationsModule,
    AiModule,
    ZynAuthModule,
  ],
})
export class AppModule {}
