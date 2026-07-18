import { Controller, Post, Body, Headers, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OidcService } from '../oidc/oidc.service';
import { OAuthClientService } from '../clients/oauth-client.service';
import { AppUserService } from './app-user.service';

/**
 * Autenticacion embebida para apps cliente (equivalente a Cognito InitiateAuth).
 *
 * A diferencia de /oauth2/token (OIDC puro: authorization_code + refresh_token),
 * este endpoint recibe email+password del backend de la app y devuelve:
 *   - tokens, si el usuario no tiene MFA, o
 *   - un CHALLENGE (`MFA_REQUIRED` + session), que la app debe responder en /mfa.
 *
 * Seguridad:
 *   - Exige client_id + client_secret (solo backends de confianza; el browser
 *     nunca ve el secret). Un endpoint publico "abierto" NO seria seguro.
 *   - El lockout por intentos fallidos vive en AppUserService.validateCredentials.
 *   - MFA NUNCA se salta: si el user la tiene, no se emiten tokens sin el codigo.
 */
function parseBasicAuth(header?: string): { id: string; secret: string } | null {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) return null;
    return { id: decoded.slice(0, idx), secret: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

@Controller('zynauth/auth')
export class AppAuthController {
  constructor(
    private readonly oidc: OidcService,
    private readonly clients: OAuthClientService,
    private readonly appUsers: AppUserService,
  ) {}

  // ---- POST /zynauth/auth/login ---------------------------------------------
  @Post('login')
  async login(
    @Body() body: Record<string, string>,
    @Headers('authorization') authHeader: string | undefined,
    @Res() res: Response,
  ) {
    const basic = parseBasicAuth(authHeader);
    const clientId = basic?.id || body.client_id || body.clientId;
    const clientSecret = basic?.secret || body.client_secret;
    const email = body.username || body.email || '';
    const password = body.password || '';

    if (!clientId) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'client_id requerido' });
    }

    try {
      const client = await this.clients.authenticateClient(clientId, clientSecret);

      const appUser = await this.appUsers.validateCredentials(clientId, email, password);
      if (!appUser) {
        return res.status(401).json({ error: 'invalid_grant', error_description: 'Credenciales invalidas' });
      }

      // Challenge: el usuario tiene MFA → no emitimos tokens todavia.
      if (appUser.mfaEnabled) {
        const session = await this.oidc.createMfaTicket(appUser.id, true);
        return res.json({ challenge: 'MFA_REQUIRED', session });
      }

      const scope = body.scope || client.allowedScopes || 'openid profile email offline_access';
      const tokens = await this.oidc.issueTokens(
        this.subjectFrom(appUser),
        client,
        scope,
        undefined,
        true,
      );
      return res.json({ tokens });
    } catch (e) {
      // authenticateClient (secret invalido) o cuenta bloqueada.
      return res.status(401).json({ error: 'invalid_client', error_description: (e as Error).message });
    }
  }

  // ---- POST /zynauth/auth/mfa -----------------------------------------------
  @Post('mfa')
  async mfa(
    @Body() body: Record<string, string>,
    @Headers('authorization') authHeader: string | undefined,
    @Res() res: Response,
  ) {
    const basic = parseBasicAuth(authHeader);
    const clientId = basic?.id || body.client_id || body.clientId;
    const clientSecret = basic?.secret || body.client_secret;
    const sessionTicket = body.session || '';
    const code = body.code || '';

    if (!clientId) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'client_id requerido' });
    }

    try {
      const client = await this.clients.authenticateClient(clientId, clientSecret);

      const ticket = await this.oidc.verifyMfaTicket(sessionTicket);
      if (!ticket || !ticket.isAppUser) {
        return res.status(401).json({ error: 'invalid_grant', error_description: 'La sesion de verificacion expiro' });
      }

      const appUser = await this.appUsers.findById(ticket.id);
      // El ticket solo sirve para el pool de este client_id.
      if (!appUser || appUser.clientId !== clientId) {
        return res.status(401).json({ error: 'invalid_grant', error_description: 'Usuario no encontrado' });
      }

      const ok = await this.appUsers.verifyMfa(appUser, code);
      if (!ok) {
        return res.status(401).json({ error: 'invalid_grant', error_description: 'Codigo invalido' });
      }

      const scope = body.scope || client.allowedScopes || 'openid profile email offline_access';
      const tokens = await this.oidc.issueTokens(
        this.subjectFrom(appUser),
        client,
        scope,
        undefined,
        true,
      );
      return res.json({ tokens });
    } catch (e) {
      return res.status(401).json({ error: 'invalid_client', error_description: (e as Error).message });
    }
  }

  private subjectFrom(appUser: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
  }) {
    return {
      id: appUser.id,
      email: appUser.email,
      name: appUser.name ?? '',
      emailVerified: appUser.emailVerified,
      picture: null,
    };
  }
}
