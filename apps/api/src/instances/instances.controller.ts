import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { InstancesService } from './instances.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

class CreateInstanceDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(128)
  @Max(2048)
  memoryLimit: number;

  @IsNumber()
  @Min(0.25)
  @Max(2)
  cpuLimit: number;

  @IsOptional()
  @IsString()
  sshKeyId?: string;
}

class UpdateInstanceDto {
  @IsOptional()
  @IsString()
  name?: string;
}

@Controller('instances')
@UseGuards(JwtAuthGuard)
export class InstancesController {
  constructor(private instancesService: InstancesService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.instancesService.findAll(user.id);
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string }) {
    return this.instancesService.getStats(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateInstanceDto) {
    return this.instancesService.create(user.id, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.instancesService.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: { id: string }, @Body() dto: UpdateInstanceDto) {
    return this.instancesService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.instancesService.remove(id, user.id);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.instancesService.start(id, user.id);
  }

  @Post(':id/stop')
  stop(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.instancesService.stop(id, user.id);
  }

  @Post(':id/restart')
  restart(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.instancesService.restart(id, user.id);
  }
}
