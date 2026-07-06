import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { SshKeysService } from './ssh-keys.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';

class CreateSshKeyDto {
  @IsString()
  name: string;
}

@Controller('ssh-keys')
@UseGuards(JwtAuthGuard)
export class SshKeysController {
  constructor(private sshKeysService: SshKeysService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.sshKeysService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateSshKeyDto) {
    return this.sshKeysService.create(user.id, dto.name);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.sshKeysService.remove(id, user.id);
  }
}
