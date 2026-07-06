import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private monitoringService: MonitoringService) {}

  @Get(':instanceId')
  getStats(
    @Param('instanceId') instanceId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.monitoringService.getStats(instanceId, user.id);
  }
}
