import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SigningKeyService } from './keys/signing-key.service';
import { OAuthClientService } from './clients/oauth-client.service';
import { OAuthClientsController } from './clients/oauth-clients.controller';
import { OidcService } from './oidc/oidc.service';
import { OidcController } from './oidc/oidc.controller';
import { OidcDiscoveryController } from './oidc/oidc-discovery.controller';
import { MfaModule } from './mfa/mfa.module';
import { CredentialsModule } from './credentials/credentials.module';
import { AppUserService } from './app-users/app-user.service';
import { AppUsersController, AppUserSelfRegisterController } from './app-users/app-users.controller';
import { AppAuthController } from './app-users/app-auth.controller';

@Module({
  imports: [PrismaModule, AuthModule, CredentialsModule, MfaModule],
  controllers: [
    OidcDiscoveryController,
    OidcController,
    OAuthClientsController,
    AppUsersController,
    AppUserSelfRegisterController,
    AppAuthController,
  ],
  providers: [SigningKeyService, OAuthClientService, AppUserService, OidcService],
  exports: [OidcService, SigningKeyService, OAuthClientService, MfaModule, AppUserService],
})
export class ZynAuthModule {}
