import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';

@Controller('backups')
@UseGuards(JwtAuthGuard)
export class BackupsController {
  constructor(private backupsService: BackupsService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.backupsService.findAll(user.id);
  }

  @Get(':instanceId')
  findByInstance(
    @Param('instanceId') instanceId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.backupsService.findByInstance(instanceId, user.id);
  }

  @Post(':instanceId')
  create(
    @Param('instanceId') instanceId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.backupsService.create(instanceId, user.id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.backupsService.restore(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.backupsService.remove(id, user.id);
  }
}
