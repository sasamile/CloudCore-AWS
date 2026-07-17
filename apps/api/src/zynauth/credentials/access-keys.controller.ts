import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard, CurrentUser } from '../../auth/auth.guard';
import { AccessKeyService } from './access-key.service';

class CreateAccessKeyDto {
  @IsString()
  @MinLength(2)
  label: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}

/** Panel: el usuario crea/lista/revoca sus Access Keys para el SDK. */
@Controller('zynauth/access-keys')
@UseGuards(JwtAuthGuard)
export class AccessKeysController {
  constructor(private readonly accessKeys: AccessKeyService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.accessKeys.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateAccessKeyDto) {
    return this.accessKeys.create(user.id, dto.label, dto.scopes);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.accessKeys.revoke(user.id, id);
  }
}
