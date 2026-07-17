import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { createHash, randomBytes } from 'node:crypto';

/**
 * @zyncloud/auth — SDK cliente para autenticar contra ZynAuth (OIDC).
 *
 *   const auth = new ZynAuthClient({
 *     issuer: 'https://apizyncloud.suescun.sbs',
 *     clientId: 'zyn_...', clientSecret: '...',
 *     redirectUri: 'https://miapp.com/api/auth/callback',
 *   });
 *   // 1) redirigir al login
 *   const { url, state, codeVerifier } = await auth.createAuthorizationUrl();
 *   // 2) en el callback
 *   const tokens = await auth.exchangeCode({ code, codeVerifier });
 *   const claims = await auth.verifyIdToken(tokens.id_token);
 */

export interface ZynAuthOptions {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope?: string;
}

export interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

export interface TokenSet {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

export class ZynAuthClient {
  private readonly issuer: string;
  private readonly scope: string;
  private discovery: DiscoveryDocument | null = null;
  private jwks: JWTVerifyGetKey | null = null;

  constructor(private readonly opts: ZynAuthOptions) {
    this.issuer = opts.issuer.replace(/\/+$/, '');
    this.scope = opts.scope ?? 'openid profile email offline_access';
  }

  /** Descubre y cachea los endpoints OIDC. */
  async discover(): Promise<DiscoveryDocument> {
    if (this.discovery) return this.discovery;
    const res = await fetch(`${this.issuer}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error(`ZynAuth discovery fallo: ${res.status}`);
    this.discovery = (await res.json()) as DiscoveryDocument;
    this.jwks = createRemoteJWKSet(new URL(this.discovery.jwks_uri));
    return this.discovery;
  }

  /** Genera la URL de login + el state y code_verifier (PKCE) que debes guardar en sesion. */
  async createAuthorizationUrl(params: { scope?: string } = {}) {
    const disc = await this.discover();
    const state = randomBytes(16).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const url = new URL(disc.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.opts.clientId);
    url.searchParams.set('redirect_uri', this.opts.redirectUri);
    url.searchParams.set('scope', params.scope ?? this.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return { url: url.toString(), state, nonce, codeVerifier };
  }

  /** Canjea el `code` del callback por tokens. */
  async exchangeCode(input: { code: string; codeVerifier?: string }): Promise<TokenSet> {
    const disc = await this.discover();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: this.opts.redirectUri,
      client_id: this.opts.clientId,
    });
    if (this.opts.clientSecret) body.set('client_secret', this.opts.clientSecret);
    if (input.codeVerifier) body.set('code_verifier', input.codeVerifier);

    return this.tokenRequest(disc.token_endpoint, body);
  }

  /** Renueva tokens con un refresh_token. */
  async refresh(refreshToken: string): Promise<TokenSet> {
    const disc = await this.discover();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.opts.clientId,
    });
    if (this.opts.clientSecret) body.set('client_secret', this.opts.clientSecret);
    return this.tokenRequest(disc.token_endpoint, body);
  }

  /** Verifica un id_token contra el JWKS del issuer y devuelve sus claims. */
  async verifyIdToken(idToken: string): Promise<JWTPayload> {
    await this.discover();
    const { payload } = await jwtVerify(idToken, this.jwks!, {
      issuer: this.issuer,
      audience: this.opts.clientId,
    });
    return payload;
  }

  /** Verifica un access_token (emitido por ZynAuth). */
  async verifyAccessToken(accessToken: string): Promise<JWTPayload> {
    await this.discover();
    const { payload } = await jwtVerify(accessToken, this.jwks!, { issuer: this.issuer });
    return payload;
  }

  async getUserInfo(accessToken: string): Promise<Record<string, unknown>> {
    const disc = await this.discover();
    const res = await fetch(disc.userinfo_endpoint, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`userinfo fallo: ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  /** URL para cerrar la sesion SSO del IdP. */
  async logoutUrl(postLogoutRedirectUri?: string): Promise<string> {
    const disc = await this.discover();
    const base = disc.end_session_endpoint ?? `${this.issuer}/oauth2/logout`;
    const url = new URL(base);
    url.searchParams.set('client_id', this.opts.clientId);
    if (postLogoutRedirectUri) {
      url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
    }
    return url.toString();
  }

  private async tokenRequest(endpoint: string, body: URLSearchParams): Promise<TokenSet> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json()) as TokenSet & { error?: string; error_description?: string };
    if (!res.ok || json.error) {
      throw new Error(`token endpoint: ${json.error ?? res.status} ${json.error_description ?? ''}`);
    }
    return json;
  }
}

export type { JWTPayload };
