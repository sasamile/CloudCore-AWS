import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { IsString, IsOptional } from 'class-validator';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';

class DeployDto {
  @IsString()
  instanceId: string;

  @IsString()
  repoFullName: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  rootDir?: string;

  @IsOptional()
  @IsString()
  buildCommand?: string;

  @IsOptional()
  @IsString()
  startCommand?: string;
}

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private integrations: IntegrationsService,
    private auth: AuthService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: { id: string }) {
    return this.integrations.listIntegrations(user.id);
  }

  @Get('github/authorize')
  @UseGuards(JwtAuthGuard)
  githubAuthorize(@CurrentUser() user: { id: string }) {
    return this.integrations.getGithubAuthorizeUrl(user.id);
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      await this.integrations.handleGithubCallback(code, state);
      res.redirect(`${frontend}/dashboard/integrations?github=connected`);
    } catch {
      res.redirect(`${frontend}/dashboard/integrations?github=error`);
    }
  }

  @Get('github/repos')
  @UseGuards(JwtAuthGuard)
  githubRepos(@CurrentUser() user: { id: string }) {
    return this.integrations.listGithubRepos(user.id);
  }

  @Post('github/deploy')
  @UseGuards(JwtAuthGuard)
  deploy(@CurrentUser() user: { id: string }, @Body() dto: DeployDto) {
    return this.integrations.deployFromGithub(user.id, dto);
  }

  @Get('deployments')
  @UseGuards(JwtAuthGuard)
  deployments(
    @CurrentUser() user: { id: string },
    @Query('instanceId') instanceId?: string,
  ) {
    return this.integrations.listDeployments(user.id, instanceId);
  }

  @Delete('account/:provider')
  @UseGuards(JwtAuthGuard)
  disconnect(@CurrentUser() user: { id: string }, @Param('provider') provider: string) {
    return this.integrations.disconnect(user.id, provider);
  }

  @Get('google/authorize')
  googleAuthorize() {
    return this.integrations.getGoogleLoginUrl();
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      const result = await this.integrations.handleGoogleLoginCallback(code, state);
      const session = await this.auth.sessionAfterExternalLogin(
        result.userId,
        result.email,
      );
      if (session.mfaRequired) {
        res.redirect(
          `${frontend}/?mfa=1&ticket=${encodeURIComponent(session.mfaTicket)}`,
        );
        return;
      }
      res.redirect(
        `${frontend}/auth/callback?token=${encodeURIComponent(session.access_token)}`,
      );
    } catch (err) {
      console.error('Google OAuth callback failed', err);
      res.redirect(`${frontend}/?google=error`);
    }
  }
}
