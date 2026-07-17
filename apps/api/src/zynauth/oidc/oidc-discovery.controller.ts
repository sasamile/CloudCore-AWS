import { Controller, Get } from '@nestjs/common';
import { SigningKeyService } from '../keys/signing-key.service';
import { endpoint, getIssuer, ZYNAUTH } from '../zynauth.config';

/**
 * Endpoints de descubrimiento estandar OIDC. Con esto, librerias como
 * openid-client (la que ya usa orbidev) autoconfiguran todo apuntando a:
 *   GET {issuer}/.well-known/openid-configuration
 */
@Controller()
export class OidcDiscoveryController {
  constructor(private readonly keys: SigningKeyService) {}

  @Get('.well-known/openid-configuration')
  discovery() {
    return {
      issuer: getIssuer(),
      authorization_endpoint: endpoint(ZYNAUTH.paths.authorize),
      token_endpoint: endpoint(ZYNAUTH.paths.token),
      userinfo_endpoint: endpoint(ZYNAUTH.paths.userinfo),
      jwks_uri: endpoint(ZYNAUTH.paths.jwks),
      end_session_endpoint: endpoint(ZYNAUTH.paths.logout),
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ZYNAUTH.supportedScopes,
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
        'none',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
      claims_supported: [
        'sub',
        'email',
        'email_verified',
        'name',
        'picture',
        'auth_time',
        'nonce',
      ],
    };
  }

  @Get('.well-known/jwks.json')
  async jwks() {
    return this.keys.getJwks();
  }
}
