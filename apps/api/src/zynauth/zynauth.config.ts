/**
 * Configuracion central de ZynAuth (tu proveedor de identidad tipo Cognito).
 * El `issuer` es la URL base publica de la API; todos los endpoints OIDC cuelgan de ahi.
 */
export function getIssuer(): string {
  const explicit = process.env.ZYNAUTH_ISSUER?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  // Fallback prod: si no se definió ZYNAUTH_ISSUER, derivar del host público de la API
  // (Cloudflare Tunnel) para no exponer "localhost" como issuer en producción.
  const apiHost = process.env.TUNNEL_API_HOST?.trim();
  if (apiHost) return `https://${apiHost.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  const port = process.env.PORT || process.env.API_PORT || '4000';
  return `http://localhost:${port}`;
}

export const ZYNAUTH = {
  get issuer() {
    return getIssuer();
  },
  paths: {
    discovery: '/.well-known/openid-configuration',
    jwks: '/.well-known/jwks.json',
    authorize: '/oauth2/authorize',
    token: '/oauth2/token',
    userinfo: '/oauth2/userinfo',
    logout: '/oauth2/logout',
    login: '/oauth2/login',
  },
  ttl: {
    authCodeSeconds: 60 * 5, // 5 min
    accessTokenSeconds: 60 * 60, // 1 h
    idTokenSeconds: 60 * 60, // 1 h
    refreshTokenSeconds: 60 * 60 * 24 * 30, // 30 dias
    sessionSeconds: 60 * 60 * 24 * 7, // cookie SSO del IdP: 7 dias
  },
  supportedScopes: ['openid', 'profile', 'email', 'offline_access'],
  sessionCookie: 'zynauth_session',
};

export function endpoint(path: string): string {
  return `${getIssuer()}${path}`;
}
