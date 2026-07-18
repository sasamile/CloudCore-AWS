import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';
import { DeploymentsService } from './deployments.service';
import { IntegrationsService } from '../integrations/integrations.service';

class CreateDeploymentDto {
  @IsString()
  @MinLength(3)
  repoFullName: string; // owner/repo

  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsString() rootDir?: string;
  @IsOptional() @IsString() buildCommand?: string;
  @IsOptional() @IsString() startCommand?: string;
  @IsOptional() @IsString() framework?: string;
}

@Controller('deployments')
@UseGuards(JwtAuthGuard)
export class DeploymentsController {
  constructor(
    private readonly deployments: DeploymentsService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.deployments.list(user.id);
  }

  /** Auto-detección de framework (build/start) para pre-llenar el import, estilo Vercel. */
  @Get('detect')
  detect(
    @CurrentUser() user: { id: string },
    @Query('repoFullName') repoFullName: string,
    @Query('branch') branch?: string,
    @Query('rootDir') rootDir?: string,
  ) {
    return this.integrations.detectFramework(user.id, repoFullName, branch || 'main', rootDir || '.');
  }

  @Get(':id')
  getOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.deployments.getOne(user.id, id);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateDeploymentDto) {
    const deployment = await this.deployments.create(user.id, dto);
    // Registra el webhook en GitHub automáticamente (no bloquea si falla).
    this.integrations.ensureGithubWebhook(user.id, dto.repoFullName).catch(() => {});
    return deployment;
  }

  @Post(':id/trigger')
  trigger(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.deployments.trigger(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.deployments.remove(user.id, id);
  }
}
