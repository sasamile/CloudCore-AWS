import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard, CurrentUser } from '../../auth/auth.guard';
import { OAuthClientService } from './oauth-client.service';

class RegisterClientDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsArray()
  @IsString({ each: true })
  redirectUris: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postLogoutUris?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedScopes?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

/**
 * Panel de administracion de apps registradas en ZynAuth.
 * Un usuario logueado en ZynCloud registra sus apps (orbidev, etc.) y obtiene
 * client_id + client_secret para configurarlas.
 */
@Controller('zynauth/clients')
@UseGuards(JwtAuthGuard)
export class OAuthClientsController {
  constructor(private readonly clients: OAuthClientService) {}

  @Post()
  register(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterClientDto,
  ) {
    return this.clients.register(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.clients.listForOwner(user.id);
  }
}
