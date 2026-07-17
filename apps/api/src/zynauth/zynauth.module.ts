import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SigningKeyService } from './keys/signing-key.service';
import { OAuthClientService } from './clients/oauth-client.service';
import { OAuthClientsController } from './clients/oauth-clients.controller';
import { OidcService } from './oidc/oidc.service';
import { OidcController } from './oidc/oidc.controller';
import { OidcDiscoveryController } from './oidc/oidc-discovery.controller';

/**
 * ZynAuth — Proveedor de identidad OIDC de Zyntek (tu "Cognito").
 * Expone: descubrimiento OIDC, JWKS, /authorize, /token, /userinfo, /logout
 * y la administracion de apps (clients).
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    OidcDiscoveryController,
    OidcController,
    OAuthClientsController,
  ],
  providers: [SigningKeyService, OAuthClientService, OidcService],
  exports: [OidcService, SigningKeyService, OAuthClientService],
})
export class ZynAuthModule {}
