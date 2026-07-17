import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';
import { DeploymentsService } from './deployments.service';

class CreateDeploymentDto {
  @IsString()
  instanceId: string;

  @IsString()
  @MinLength(3)
  repoFullName: string; // owner/repo

  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsString() rootDir?: string;
  @IsOptional() @IsString() buildCommand?: string;
  @IsOptional() @IsString() startCommand?: string;
}

@Controller('deployments')
@UseGuards(JwtAuthGuard)
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.deployments.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateDeploymentDto) {
    return this.deployments.create(user.id, dto);
  }

  @Post(':id/trigger')
  trigger(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.deployments.trigger(user.id, id);
  }
}
