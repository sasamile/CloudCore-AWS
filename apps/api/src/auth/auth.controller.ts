import { Controller, Post, Body } from '@nestjs/common';
import { IsEmail, IsString, MinLength, Length } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class RegisterDto extends LoginDto {
  @IsString()
  @MinLength(2)
  name: string;
}

class MfaLoginDto {
  @IsString()
  ticket: string;

  @IsString()
  @Length(6, 11)
  code: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /** Segundo paso: TOTP o codigo de respaldo tras password / Google. */
  @Post('mfa')
  mfa(@Body() dto: MfaLoginDto) {
    return this.authService.completeMfa(dto.ticket, dto.code);
  }
}
