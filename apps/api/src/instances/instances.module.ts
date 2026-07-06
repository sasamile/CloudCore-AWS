import { Module } from '@nestjs/common';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';
import { InstancesGateway } from './instances.gateway';
import { SshKeysModule } from '../ssh-keys/ssh-keys.module';

@Module({
  imports: [SshKeysModule],
  controllers: [InstancesController],
  providers: [InstancesService, InstancesGateway],
  exports: [InstancesService],
})
export class InstancesModule {}
