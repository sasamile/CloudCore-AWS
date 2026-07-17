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
  ) {}

  // ---------------------------------------------------------------------------
  // Sesion SSO del IdP (cookie httpOnly). Es el "estoy logueado en ZynAuth".
  // ---------------------------------------------------------------------------
  async createSessionToken(userId: string): Promise<string> {
    return new SignJWT({ typ: 'zynauth-session' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${ZYNAUTH.ttl.sessionSeconds}s`)
      .sign(sessionSecret());
  }

  async verifySessionToken(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, sessionSecret());
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Credenciales (backend del "user pool": reutiliza los usuarios de ZynCloud).
  // ---------------------------------------------------------------------------
  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !user.password) return null;
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Cuenta bloqueada temporalmente');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      await this.registerFailedLogin(user.id);
      return null;
    }
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    return user;
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
  async createAuthCode(userId: string, params: AuthorizeParams): Promise<string> {
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
        userId,
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
      include: { user: true, client: true },
    });
    if (!record) throw new BadRequestException('code invalido');
    if (record.consumedAt) throw new BadRequestException('code ya utilizado');
    if (record.expiresAt < new Date())
      throw new BadRequestException('code expirado');
    if (record.clientId !== input.clientId)
      throw new BadRequestException('client_id no coincide');
    if (record.redirectUri !== input.redirectUri)
      throw new BadRequestException('redirect_uri no coincide');

    // PKCE
    if (record.codeChallenge) {
      if (!input.codeVerifier)
        throw new BadRequestException('code_verifier requerido (PKCE)');
      const method = record.codeChallengeMethod || 'plain';
      const derived =
        method === 'S256'
          ? sha256base64url(input.codeVerifier)
          : input.codeVerifier;
      const a = Buffer.from(derived);
      const b = Buffer.from(record.codeChallenge);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new BadRequestException('code_verifier invalido (PKCE)');
      }
    }

    // Consumir el code (uso unico).
    await this.prisma.authCode.update({
      where: { code: record.code },
      data: { consumedAt: new Date() },
    });

    return this.issueTokens(record.user, record.client, record.scope, record.nonce);
  }

  // ---------------------------------------------------------------------------
  // Emision de tokens (id / access / refresh)
  // ---------------------------------------------------------------------------
  async issueTokens(
    user: { id: string; email: string; name: string; emailVerified: boolean; picture: string | null },
    client: { id: string; clientId: string },
    scope: string,
    nonce?: string | null,
  ) {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await this.signAccessToken(user, client.clientId, scope, now);
    const idToken = await this.signIdToken(user, client.clientId, scope, now, nonce);

    const result: Record<string, unknown> = {
      access_token: accessToken,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: ZYNAUTH.ttl.accessTokenSeconds,
      scope,
    };

    if (scope.split(' ').includes('offline_access')) {
      result.refresh_token = await this.createRefreshToken(user.id, client.id, scope);
    }
    return result;
  }

  private async signAccessToken(
    user: { id: string; email: string },
    aud: string,
    scope: string,
    now: number,
  ) {
    const { privateKey, kid, alg } = await this.keys.getSigningKey();
    return new SignJWT({
      token_use: 'access',
      scope,
      client_id: aud,
      email: user.email,
    })
      .setProtectedHeader({ alg, kid })
      .setIssuer(getIssuer())
      .setSubject(user.id)
      .setAudience(aud)
      .setIssuedAt(now)
      .setExpirationTime(now + ZYNAUTH.ttl.accessTokenSeconds)
      .sign(privateKey);
  }

  private async signIdToken(
    user: { id: string; email: string; name: string; emailVerified: boolean; picture: string | null },
    aud: string,
    scope: string,
    now: number,
    nonce?: string | null,
  ) {
    const { privateKey, kid, alg } = await this.keys.getSigningKey();
    const scopes = scope.split(' ');
    const claims: Record<string, unknown> = { token_use: 'id', auth_time: now };
    if (scopes.includes('email')) {
      claims.email = user.email;
      claims.email_verified = user.emailVerified;
    }
    if (scopes.includes('profile')) {
      claims.name = user.name;
      if (user.picture) claims.picture = user.picture;
    }
    if (nonce) claims.nonce = nonce;

    return new SignJWT(claims)
      .setProtectedHeader({ alg, kid })
      .setIssuer(getIssuer())
      .setSubject(user.id)
      .setAudience(aud)
      .setIssuedAt(now)
      .setExpirationTime(now + ZYNAUTH.ttl.idTokenSeconds)
      .sign(privateKey);
  }

  // ---------------------------------------------------------------------------
  // Refresh tokens (opacos, con rotacion; solo se guarda el hash)
  // ---------------------------------------------------------------------------
  private async createRefreshToken(userId: string, oauthClientId: string, scope: string) {
    const raw = randomBytes(40).toString('base64url');
    await this.prisma.oidcRefreshToken.create({
      data: {
        tokenHash: sha256base64url(raw),
        scope,
        userId,
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
      include: { user: true, client: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('refresh_token invalido o expirado');
    }
    if (record.oauthClientId !== client.id) {
      throw new UnauthorizedException('refresh_token no pertenece a este cliente');
    }

    // Rotacion: revoca el actual y emite uno nuevo.
    await this.prisma.oidcRefreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(record.user, record.client, record.scope);
  }

  // ---------------------------------------------------------------------------
  // Verificacion local + /userinfo
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
    const user = await this.prisma.user.findUnique({
      where: { id: String(payload.sub) },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    const scopes = String(payload.scope || '').split(' ');
    const info: Record<string, unknown> = { sub: user.id };
    if (scopes.includes('email')) {
      info.email = user.email;
      info.email_verified = user.emailVerified;
    }
    if (scopes.includes('profile')) {
      info.name = user.name;
      if (user.picture) info.picture = user.picture;
    }
    return info;
  }
}
