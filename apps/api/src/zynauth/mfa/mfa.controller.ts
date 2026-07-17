import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { JwtAuthGuard, CurrentUser } from '../../auth/auth.guard';
import { MfaService } from './mfa.service';

class CodeDto {
  @IsString()
  @Length(6, 11)
  code: string;
}

/** Gestion del segundo factor para el usuario autenticado en ZynCloud. */
@Controller('zynauth/mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get('status')
  status(@CurrentUser() user: { id: string }) {
    return this.mfa.status(user.id);
  }

  @Post('setup')
  setup(@CurrentUser() user: { id: string }) {
    return this.mfa.setup(user.id);
  }

  @Post('enable')
  enable(@CurrentUser() user: { id: string }, @Body() dto: CodeDto) {
    return this.mfa.enable(user.id, dto.code);
  }

  @Post('disable')
  disable(@CurrentUser() user: { id: string }, @Body() dto: CodeDto) {
    return this.mfa.disable(user.id, dto.code);
  }
}
