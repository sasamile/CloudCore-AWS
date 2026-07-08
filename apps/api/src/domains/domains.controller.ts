import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { DomainsService } from './domains.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

class CreateDomainDto {
  @IsString()
  domain: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  targetPort?: number;

  @IsString()
  instanceId: string;
}

@Controller('domains')
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(private domainsService: DomainsService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.domainsService.findAll(user.id);
  }

  @Get('tunnel-status')
  getTunnelStatus() {
    return this.domainsService.getTunnelStatus();
  }

  @Post('sync-tunnel')
  syncTunnel(@CurrentUser() user: { id: string }) {
    return this.domainsService.syncTunnel(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateDomainDto) {
    return this.domainsService.create(user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.domainsService.remove(id, user.id);
  }

  @Post(':id/ssl')
  enableSsl(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.domainsService.enableSsl(id, user.id);
  }
}
