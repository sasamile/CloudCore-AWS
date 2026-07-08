import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { SshKeysService } from './ssh-keys.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';

class CreateSshKeyDto {
  @IsString()
  @MinLength(1)
  name: string;
}

class RenameSshKeyDto {
  @IsString()
  @MinLength(1)
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

  @Patch(':id')
  rename(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RenameSshKeyDto,
  ) {
    return this.sshKeysService.rename(id, user.id, dto.name);
  }

  @Get(':id/download')
  download(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.sshKeysService.downloadPrivateKey(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.sshKeysService.remove(id, user.id);
  }
}
