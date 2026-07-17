import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  Body,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OidcService, type AuthorizeParams } from './oidc.service';
import { OAuthClientService } from '../clients/oauth-client.service';
import { MfaService } from '../mfa/mfa.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZYNAUTH } from '../zynauth.config';
import { renderLoginPage } from './login-page';
import { renderMfaPage } from './mfa-page';

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

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

@Controller('oauth2')
export class OidcController {
  constructor(
    private readonly oidc: OidcService,
    private readonly clients: OAuthClientService,
    private readonly mfa: MfaService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- GET /oauth2/authorize -------------------------------------------------
  @Get('authorize')
  async authorize(@Query() q: Record<string, string>, @Req() req: Request, @Res() res: Response) {
    const params = await this.validateAuthorize(q);

    // Ya hay sesion SSO en ZynAuth?
    const cookies = parseCookies(req.headers.cookie);
    const sessionUser = cookies[ZYNAUTH.sessionCookie]
      ? await this.oidc.verifySessionToken(cookies[ZYNAUTH.sessionCookie])
      : null;

    if (sessionUser) {
      const code = await this.oidc.createAuthCode(sessionUser, params);
      return res.redirect(this.buildRedirect(params.redirectUri, { code, state: params.state }));
    }

    // Mostrar la Hosted UI de login.
    return res
      .status(200)
      .type('html')
      .send(renderLoginPage({ params: q, error: null }));
  }

  // ---- POST /oauth2/login (Hosted UI submit) --------------------------------
  @Post('login')
  async login(@Body() body: Record<string, string>, @Res() res: Response) {
    const params = await this.validateAuthorize(body);
    const { email, password } = body;

    let user: Awaited<ReturnType<OidcService['validateCredentials']>> = null;
    try {
      user = await this.oidc.validateCredentials(email ?? '', password ?? '');
    } catch (e) {
      return res
        .status(200)
        .type('html')
        .send(renderLoginPage({ params: body, error: (e as Error).message }));
    }
    if (!user) {
      return res
        .status(200)
        .type('html')
        .send(renderLoginPage({ params: body, error: 'Credenciales invalidas' }));
    }

    // Segundo factor: si el usuario tiene MFA, pedimos el codigo antes de crear sesion.
    if (user.mfaEnabled) {
      const ticket = await this.oidc.createMfaTicket(user.id);
      return res
        .status(200)
        .type('html')
        .send(renderMfaPage({ params: body, ticket, error: null }));
    }

    return this.completeLogin(res, user.id, params, body);
  }

  // ---- POST /oauth2/mfa (segundo paso) --------------------------------------
  @Post('mfa')
  async mfaStep(@Body() body: Record<string, string>, @Res() res: Response) {
    const params = await this.validateAuthorize(body);
    const userId = await this.oidc.verifyMfaTicket(body.mfa_ticket ?? '');
    if (!userId) {
      return res
        .status(200)
        .type('html')
        .send(renderLoginPage({ params: body, error: 'La sesion de verificacion expiro, inicia de nuevo' }));
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(200).type('html').send(renderLoginPage({ params: body, error: 'Usuario no encontrado' }));
    }
    const ok = await this.mfa.verifyForUser(user, body.code ?? '');
    if (!ok) {
      const ticket = await this.oidc.createMfaTicket(user.id);
      return res
        .status(200)
        .type('html')
        .send(renderMfaPage({ params: body, ticket, error: 'Codigo invalido' }));
    }
    return this.completeLogin(res, user.id, params, body);
  }

  /** Crea la cookie SSO, emite el code y redirige a la app. */
  private async completeLogin(
    res: Response,
    userId: string,
    params: AuthorizeParams,
    rawParams: Record<string, string>,
  ) {
    const session = await this.oidc.createSessionToken(userId);
    res.cookie(ZYNAUTH.sessionCookie, session, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ZYNAUTH.ttl.sessionSeconds * 1000,
      path: '/',
    });
    const code = await this.oidc.createAuthCode(userId, params);
    return res.redirect(this.buildRedirect(params.redirectUri, { code, state: rawParams.state }));
  }

  // ---- POST /oauth2/token ----------------------------------------------------
  @Post('token')
  async token(
    @Body() body: Record<string, string>,
    @Headers('authorization') authHeader: string | undefined,
    @Res() res: Response,
  ) {
    const grantType = body.grant_type;
    const basic = parseBasicAuth(authHeader);
    const clientId = basic?.id || body.client_id;
    const clientSecret = basic?.secret || body.client_secret;

    if (!clientId) throw new BadRequestException('client_id requerido');

    try {
      if (grantType === 'authorization_code') {
        await this.clients.authenticateClient(clientId, clientSecret);
        const tokens = await this.oidc.exchangeAuthorizationCode({
          code: body.code,
          redirectUri: body.redirect_uri,
          clientId,
          codeVerifier: body.code_verifier,
        });
        return res.json(tokens);
      }
      if (grantType === 'refresh_token') {
        await this.clients.authenticateClient(clientId, clientSecret);
        const tokens = await this.oidc.refresh({
          refreshToken: body.refresh_token,
          clientId,
        });
        return res.json(tokens);
      }
      return res.status(400).json({ error: 'unsupported_grant_type' });
    } catch (e) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: (e as Error).message,
      });
    }
  }

  // ---- GET /oauth2/userinfo --------------------------------------------------
  @Get('userinfo')
  async userinfo(@Headers('authorization') authHeader: string | undefined, @Res() res: Response) {
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    try {
      const info = await this.oidc.getUserInfo(authHeader.slice(7));
      return res.json(info);
    } catch (e) {
      return res.status(401).json({ error: 'invalid_token', error_description: (e as Error).message });
    }
  }

  // ---- GET /oauth2/logout ----------------------------------------------------
  @Get('logout')
  async logout(@Query() q: Record<string, string>, @Res() res: Response) {
    res.clearCookie(ZYNAUTH.sessionCookie, { path: '/' });
    const target = q.post_logout_redirect_uri;
    if (target) {
      const client = q.client_id ? await this.clients.findByClientId(q.client_id) : null;
      if (client) {
        const allowed = JSON.parse(client.postLogoutUris) as string[];
        if (allowed.includes(target)) return res.redirect(target);
      }
    }
    return res.status(200).type('html').send('<h3>Sesion cerrada en ZynAuth.</h3>');
  }

  // ---- helpers ---------------------------------------------------------------
  private async validateAuthorize(q: Record<string, string>): Promise<AuthorizeParams> {
    if (q.response_type && q.response_type !== 'code') {
      throw new BadRequestException('response_type debe ser "code"');
    }
    if (!q.client_id) throw new BadRequestException('client_id requerido');
    if (!q.redirect_uri) throw new BadRequestException('redirect_uri requerido');

    const client = await this.clients.getOrThrow(q.client_id);
    if (!this.clients.isRedirectAllowed(client, q.redirect_uri)) {
      throw new BadRequestException('redirect_uri no permitido para este cliente');
    }
    if (client.requirePkce && !q.code_challenge && client.isPublic) {
      throw new BadRequestException('PKCE (code_challenge) requerido para clientes publicos');
    }

    const requested = (q.scope || 'openid').split(/\s+/).filter(Boolean);
    const allowed = client.allowedScopes.split(' ');
    const scope = requested.filter((s) => allowed.includes(s));
    if (!scope.includes('openid')) scope.unshift('openid');

    return {
      clientId: q.client_id,
      redirectUri: q.redirect_uri,
      scope: scope.join(' '),
      state: q.state,
      nonce: q.nonce,
      codeChallenge: q.code_challenge,
      codeChallengeMethod: q.code_challenge_method,
    };
  }

  private buildRedirect(base: string, params: Record<string, string | undefined>): string {
    const url = new URL(base);
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, v);
    }
    return url.toString();
  }
}
