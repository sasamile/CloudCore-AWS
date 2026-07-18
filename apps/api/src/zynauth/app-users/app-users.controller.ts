import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard, CurrentUser } from '../../auth/auth.guard';
import { AppUserService } from './app-user.service';

class CreateAppUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class ResetPasswordDto {
  @IsString()
  @MinLength(6)
  newPassword: string;
}

/**
 * Gestiona los usuarios de cada app registrada en ZynAuth.
 * El dueno de la app puede listar, crear y eliminar sus usuarios.
 * Equivale a gestionar usuarios de un Cognito User Pool.
 */
@Controller('zynauth/clients/:clientId/users')
@UseGuards(JwtAuthGuard)
export class AppUsersController {
  constructor(private readonly appUsers: AppUserService) {}

  @Get()
  list(
    @CurrentUser() user: { id: string },
    @Param('clientId') clientId: string,
  ) {
    return this.appUsers.listUsers(clientId, user.id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Param('clientId') clientId: string,
    @Body() dto: CreateAppUserDto,
  ) {
    return this.appUsers.createUser(clientId, user.id, dto);
  }

  @Patch(':userId/reset-password')
  resetPassword(
    @CurrentUser() user: { id: string },
    @Param('clientId') clientId: string,
    @Param('userId') userId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.appUsers.resetPassword(clientId, user.id, userId, dto.newPassword);
  }

  @Delete(':userId')
  remove(
    @CurrentUser() user: { id: string },
    @Param('clientId') clientId: string,
    @Param('userId') userId: string,
  ) {
    return this.appUsers.deleteUser(clientId, user.id, userId);
  }
}
