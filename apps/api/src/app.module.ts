import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InstancesModule } from './instances/instances.module';
import { DomainsModule } from './domains/domains.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { BackupsModule } from './backups/backups.module';
import { DockerModule } from './docker/docker.module';
import { SshKeysModule } from './ssh-keys/ssh-keys.module';

@Module({
  imports: [
    PrismaModule,
    DockerModule,
    AuthModule,
    InstancesModule,
    DomainsModule,
    MonitoringModule,
    BackupsModule,
    SshKeysModule,
  ],
})
export class AppModule {}
