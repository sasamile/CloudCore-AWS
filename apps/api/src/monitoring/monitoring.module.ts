import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MonitoringGateway } from './monitoring.gateway';

@Module({
  controllers: [MonitoringController],
  providers: [MonitoringService, MonitoringGateway],
})
export class MonitoringModule {}
