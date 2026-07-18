import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DockerModule } from '../docker/docker.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { InstancesModule } from '../instances/instances.module';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';

@Module({
  imports: [PrismaModule, AuthModule, DockerModule, IntegrationsModule, InstancesModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
