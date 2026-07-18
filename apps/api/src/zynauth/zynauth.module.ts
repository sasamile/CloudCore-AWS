import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SigningKeyService } from './keys/signing-key.service';
import { OAuthClientService } from './clients/oauth-client.service';
import { OAuthClientsController } from './clients/oauth-clients.controller';
import { OidcService } from './oidc/oidc.service';
import { OidcController } from './oidc/oidc.controller';
import { OidcDiscoveryController } from './oidc/oidc-discovery.controller';
import { MfaService } from './mfa/mfa.service';
import { MfaController } from './mfa/mfa.controller';
import { CredentialsModule } from './credentials/credentials.module';
import { AppUserService } from './app-users/app-user.service';
import { AppUsersController } from './app-users/app-users.controller';

@Module({
  imports: [PrismaModule, AuthModule, CredentialsModule],
  controllers: [
    OidcDiscoveryController,
    OidcController,
    OAuthClientsController,
    AppUsersController,
    MfaController,
  ],
  providers: [SigningKeyService, OAuthClientService, AppUserService, OidcService, MfaService],
  exports: [OidcService, SigningKeyService, OAuthClientService, MfaService, AppUserService],
})
export class ZynAuthModule {}
