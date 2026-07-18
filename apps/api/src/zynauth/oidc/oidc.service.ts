import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SignJWT,
  jwtVerify,
  createLocalJWKSet,
  type JSONWebKeySet,
} from 'jose';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { SigningKeyService } from '../keys/signing-key.service';
import { OAuthClientService } from '../clients/oauth-client.service';
import { AppUserService } from '../app-users/app-user.service';
import { getIssuer, ZYNAUTH } from '../zynauth.config';

const enc = new TextEncoder();

function sha256base64url(input: string): string {
  return createHash('sha256').update(input).digest('base64url');
}

function sessionSecret(): Uint8Array {
  return enc.encode(
    process.env.ZYNAUTH_SESSION_SECRET ||
      process.env.JWT_SECRET ||
      'zyncloud-secret-change-in-production',
  );
}

/** Sujeto normalizado valido tanto para User (ZynCloud) como AppUser. */
export interface AuthSubject {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  picture: string | null;
}

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

@Injectable()
export class OidcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: SigningKeyService,
    private readonly clients: OAuthClientService,
    private readonly appUsers: AppUserService,
  ) {}

  // ---------------------------------------------------------------------------
  // Sesion SSO del IdP (cookie httpOnly).
  // ---------------------------------------------------------------------------
  async createSessionToken(subjectId: string, isAppUser: boolean): Promise<string> {
    return new SignJWT({ typ: 'zynauth-session', ...(isAppUser ? { app: true } : {}) })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subjectId)
      .setIssuedAt()
      .setExpirationTime(`${ZYNAUTH.ttl.sessionSeconds}s`)
      .sign(sessionSecret());
  }

  async verifySessionToken(token: string): Promise<{ id: string; isAppUser: boolean } | null> {
    try {
      const { payload } = await jwtVerify(token, sessionSecret());
      if (payload.typ && payload.typ !== 'zynauth-session') return null;
      if (typeof payload.sub !== 'string') return null;
      return { id: payload.sub, isAppUser: payload.app === true };
    } catch {
      return null;
    }
  }

  /** Ticket efimero entre "password OK" y "verifica tu 2FA". Vive 5 min. */
  async createMfaTicket(subjectId: string, isAppUser: boolean): Promise<string> {
    return new SignJWT({ typ: 'zynauth-mfa', ...(isAppUser ? { app: true } : {}) })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subjectId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(sessionSecret());
  }

  async verifyMfaTicket(token: string): Promise<{ id: string; isAppUser: boolean } | null> {
    try {
      const { payload } = await jwtVerify(token, sessionSecret());
      if (payload.typ !== 'zynauth-mfa') return null;
      if (typeof payload.sub !== 'string') return null;
      return { id: payload.sub, isAppUser: payload.app === true };
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Credenciales: autentica AppUser del pool de ese client_id.
  // ---------------------------------------------------------------------------
  async validateCredentials(email: string, password: string, clientId: string) {
    return this.appUsers.validateCredentials(clientId, email, password);
  }

  private async registerFailedLogin(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });
    if (user.failedLoginAttempts >= 5) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Authorization Code + PKCE
  // ---------------------------------------------------------------------------
  async createAuthCode(
    subjectId: string,
    params: AuthorizeParams,
    isAppUser: boolean,
  ): Promise<string> {
    const client = await this.clients.getOrThrow(params.clientId);
    if (!this.clients.isRedirectAllowed(client, params.redirectUri)) {
      throw new BadRequestException('redirect_uri no permitido para este cliente');
    }
    const code = randomBytes(32).toString('base64url');
    await this.prisma.authCode.create({
      data: {
        code,
        clientId: params.clientId,
        oauthClientId: client.id,
        ...(isAppUser ? { appUserId: subjectId } : { userId: subjectId }),
        redirectUri: params.redirectUri,
        scope: params.scope,
        nonce: params.nonce,
        codeChallenge: params.codeChallenge,
        codeChallengeMethod: params.codeChallengeMethod,
        expiresAt: new Date(Date.now() + ZYNAUTH.ttl.authCodeSeconds * 1000),
      },
    });
    return code;
  }

  async exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
    clientId: string;
    codeVerifier?: string;
  }) {
    const record = await this.prisma.authCode.findUnique({
      where: { code: input.code },
      include: { user: true, appUser: true, client: true },
    });
    if (!record) throw new BadRequestException('code invalido');
    if (record.consumedAt) throw new BadRequestException('code ya utilizado');
    if (record.expiresAt < new Date()) throw new BadRequestException('code expirado');
    if (record.clientId !== input.clientId) throw new BadRequestException('client_id no coincide');
    if (record.redirectUri !== input.redirectUri)
      throw new BadRequestException('redirect_uri no coincide');

    // PKCE
    if (record.codeChallenge) {
      if (!input.codeVerifier)
        throw new BadRequestException('code_verifier requerido (PKCE)');
      const method = record.codeChallengeMethod || 'plain';
      const derived =
        method === 'S256' ? sha256base64url(input.codeVerifier) : input.codeVerifier;
      const a = Buffer.from(derived);
      const b = Buffer.from(record.codeChallenge);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new BadRequestException('code_verifier invalido (PKCE)');
      }
    }

    await this.prisma.authCode.update({
      where: { code: record.code },
      data: { consumedAt: new Date() },
    });

    const isAppUser = !!record.appUser && !record.user;
    const raw = record.appUser ?? record.user;
    if (!raw) throw new BadRequestException('usuario no encontrado');
    const subject: AuthSubject = {
      id: raw.id,
      email: raw.email,
      name: raw.name ?? '',
      emailVerified: raw.emailVerified,
      picture: 'picture' in raw ? (raw.picture as string | null) : null,
    };

    return this.issueTokens(subject, record.client, record.scope, record.nonce, isAppUser);
  }

  // ---------------------------------------------------------------------------
  // Emision de tokens
  // ---------------------------------------------------------------------------
  async issueTokens(
    subject: AuthSubject,
    client: { id: string; clientId: string },
    scope: string,
    nonce?: string | null,
    isAppUser = false,
  ) {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await this.signAccessToken(subject, client.clientId, scope, now, isAppUser);
    const idToken = await this.signIdToken(subject, client.clientId, scope, now, nonce, isAppUser);

    const result: Record<string, unknown> = {
      access_token: accessToken,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: ZYNAUTH.ttl.accessTokenSeconds,
      scope,
    };

    if (scope.split(' ').includes('offline_access')) {
      result.refresh_token = await this.createRefreshToken(
        subject.id,
        isAppUser,
        client.id,
        scope,
      );
    }
    return result;
  }

  private async signAccessToken(
    subject: AuthSubject,
    aud: string,
    scope: string,
    now: number,
    isAppUser: boolean,
  ) {
    const { privateKey, kid, alg } = await this.keys.getSigningKey();
    return new SignJWT({
      token_use: 'access',
      scope,
      client_id: aud,
      email: subject.email,
      ...(isAppUser ? { user_source: 'app' } : {}),
    })
      .setProtectedHeader({ alg, kid })
      .setIssuer(getIssuer())
      .setSubject(subject.id)
      .setAudience(aud)
      .setIssuedAt(now)
      .setExpirationTime(now + ZYNAUTH.ttl.accessTokenSeconds)
      .sign(privateKey);
  }

  private async signIdToken(
    subject: AuthSubject,
    aud: string,
    scope: string,
    now: number,
    nonce?: string | null,
    isAppUser = false,
  ) {
    const { privateKey, kid, alg } = await this.keys.getSigningKey();
    const scopes = scope.split(' ');
    const claims: Record<string, unknown> = {
      token_use: 'id',
      auth_time: now,
      ...(isAppUser ? { user_source: 'app' } : {}),
    };
    if (scopes.includes('email')) {
      claims.email = subject.email;
      claims.email_verified = subject.emailVerified;
    }
    if (scopes.includes('profile')) {
      claims.name = subject.name;
      if (subject.picture) claims.picture = subject.picture;
    }
    if (nonce) claims.nonce = nonce;

    return new SignJWT(claims)
      .setProtectedHeader({ alg, kid })
      .setIssuer(getIssuer())
      .setSubject(subject.id)
      .setAudience(aud)
      .setIssuedAt(now)
      .setExpirationTime(now + ZYNAUTH.ttl.idTokenSeconds)
      .sign(privateKey);
  }

  // ---------------------------------------------------------------------------
  // Refresh tokens
  // ---------------------------------------------------------------------------
  private async createRefreshToken(
    subjectId: string,
    isAppUser: boolean,
    oauthClientId: string,
    scope: string,
  ) {
    const raw = randomBytes(40).toString('base64url');
    await this.prisma.oidcRefreshToken.create({
      data: {
        tokenHash: sha256base64url(raw),
        scope,
        ...(isAppUser ? { appUserId: subjectId } : { userId: subjectId }),
        oauthClientId,
        expiresAt: new Date(Date.now() + ZYNAUTH.ttl.refreshTokenSeconds * 1000),
      },
    });
    return raw;
  }

  async refresh(input: { refreshToken: string; clientId: string }) {
    const client = await this.clients.getOrThrow(input.clientId);
    const hash = sha256base64url(input.refreshToken);
    const record = await this.prisma.oidcRefreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true, appUser: true, client: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('refresh_token invalido o expirado');
    }
    if (record.oauthClientId !== client.id) {
      throw new UnauthorizedException('refresh_token no pertenece a este cliente');
    }

    await this.prisma.oidcRefreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const isAppUser = !!record.appUser && !record.user;
    const raw = record.appUser ?? record.user;
    if (!raw) throw new UnauthorizedException('usuario no encontrado');
    const subject: AuthSubject = {
      id: raw.id,
      email: raw.email,
      name: raw.name ?? '',
      emailVerified: raw.emailVerified,
      picture: 'picture' in raw ? (raw.picture as string | null) : null,
    };

    return this.issueTokens(subject, record.client, record.scope, undefined, isAppUser);
  }

  // ---------------------------------------------------------------------------
  // Verificacion + /userinfo
  // ---------------------------------------------------------------------------
  private async localJwks() {
    const jwks = (await this.keys.getJwks()) as JSONWebKeySet;
    return createLocalJWKSet(jwks);
  }

  async verifyAccessToken(token: string) {
    const jwks = await this.localJwks();
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer: getIssuer() });
      if (payload.token_use !== 'access') {
        throw new UnauthorizedException('Se esperaba un access_token');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('access_token invalido o expirado');
    }
  }

  async getUserInfo(accessToken: string) {
    const payload = await this.verifyAccessToken(accessToken);
    const sub = String(payload.sub);
    const isApp = payload.user_source === 'app';
    const scopes = String(payload.scope || '').split(' ');
    const info: Record<string, unknown> = { sub };

    if (isApp) {
      const appUser = await this.prisma.appUser.findUnique({ where: { id: sub } });
      if (!appUser) throw new UnauthorizedException('Usuario no encontrado');
      if (scopes.includes('email')) {
        info.email = appUser.email;
        info.email_verified = appUser.emailVerified;
      }
      if (scopes.includes('profile')) {
        info.name = appUser.name ?? '';
      }
    } else {
      const user = await this.prisma.user.findUnique({ where: { id: sub } });
      if (!user) throw new UnauthorizedException('Usuario no encontrado');
      if (scopes.includes('email')) {
        info.email = user.email;
        info.email_verified = user.emailVerified;
      }
      if (scopes.includes('profile')) {
        info.name = user.name;
        if (user.picture) info.picture = user.picture;
      }
    }
    return info;
  }
}
