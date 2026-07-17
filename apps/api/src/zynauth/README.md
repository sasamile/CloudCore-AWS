# ZynAuth — El "Cognito" de Zyntek

ZynAuth convierte a ZynCloud en un **proveedor de identidad OIDC/OAuth2 estándar**.
Cualquier app (orbidev, futuras apps, en cualquier lenguaje) se autentica contra tu
servidor usando librerías OIDC normales, igual que lo haría contra AWS Cognito — pero
bajo tu control y sobre tus propios usuarios de ZynCloud.

## Endpoints

Base (`issuer`) = `ZYNAUTH_ISSUER` (por defecto `http://localhost:4000`).

| Endpoint | Método | Qué hace |
|----------|--------|----------|
| `/.well-known/openid-configuration` | GET | Documento de descubrimiento. Las librerías OIDC leen esto y se autoconfiguran. |
| `/.well-known/jwks.json` | GET | Claves públicas (RS256) para verificar tokens. |
| `/oauth2/authorize` | GET | Inicio del flujo. Muestra el login hospedado o (si ya hay sesión) emite el `code`. |
| `/oauth2/login` | POST | Submit del login hospedado (email/password). |
| `/oauth2/token` | POST | Canjea `code` → tokens, o refresca (`refresh_token`). |
| `/oauth2/userinfo` | GET | Claims del usuario (Bearer access_token). |
| `/oauth2/logout` | GET | Cierra la sesión SSO del IdP. |
| `/zynauth/clients` | GET/POST | Admin: registrar/listar apps (requiere login de ZynCloud, Bearer JWT). |

## Flujo (Authorization Code + PKCE)

1. La app redirige a `/oauth2/authorize?response_type=code&client_id=...&redirect_uri=...&scope=openid%20email&state=...&code_challenge=...&code_challenge_method=S256`.
2. Si no hay sesión, ZynAuth muestra el **login hospedado**. El usuario entra con su cuenta de ZynCloud.
3. ZynAuth crea un `code` de un solo uso y redirige a `redirect_uri?code=...&state=...`.
4. La app hace `POST /oauth2/token` con `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id` (+ `client_secret` si es confidencial, + `code_verifier` si usó PKCE).
5. Recibe `access_token`, `id_token` (JWT RS256) y —si pidió `offline_access`— `refresh_token`.
6. La app verifica los tokens contra `/.well-known/jwks.json`.

## Registrar una app

Estando logueado en ZynCloud (Bearer JWT de `/auth/login`):

```bash
curl -X POST http://localhost:4000/zynauth/clients \
  -H "Authorization: Bearer <JWT_DE_ZYNCLOUD>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "orbidev",
    "redirectUris": ["http://localhost:3000/api/auth/callback"],
    "postLogoutUris": ["http://localhost:3000"],
    "allowedScopes": ["openid","profile","email","offline_access"],
    "isPublic": false
  }'
```

Respuesta (el `clientSecret` **solo se muestra aquí**):

```json
{ "clientId": "zyn_xxx", "clientSecret": "xxx", "isPublic": false, ... }
```

- **Cliente confidencial** (`isPublic: false`): backend con secret. Ideal para orbidev (Next/Nest).
- **Cliente público** (`isPublic: true`): SPA/móvil, sin secret, **PKCE obligatorio**.

## Conectar orbidev (que ya habla OIDC)

orbidev ya usa `openid-client` + `aws-jwt-verify`. Solo hay que reapuntarlo a ZynAuth:

```env
# orbidev/.env
AUTH_PROVIDER=cognito            # reutiliza la capa OIDC existente
COGNITO_REGION=zyntek            # placeholder, ya no se usa AWS
COGNITO_USER_POOL_ID=zynauth     # placeholder
COGNITO_CLIENT_ID=zyn_xxx
COGNITO_CLIENT_SECRET=xxx
# Clave: apuntar el discovery a ZynAuth
ZYNAUTH_ISSUER=http://localhost:4000
COGNITO_CALLBACK_URL=http://localhost:3000/api/auth/callback
```

> En la Fase 8 se ajusta la capa de orbidev para descubrir por `ZYNAUTH_ISSUER`
> (`Issuer.discover(ZYNAUTH_ISSUER)`) en lugar de construir la URL de AWS Cognito.
> El resto del código de orbidev (login, callback, verificación) no cambia.

## Seguridad

- Tokens firmados con **RS256**; la clave privada se guarda **cifrada** (AES-256-GCM) en `SigningKey`.
- Claves **rotables**: `SigningKeyService.generateAndStore()` crea una nueva; las públicas viejas siguen en el JWKS hasta desactivarlas.
- `code` de un solo uso, expira en 5 min; **PKCE** soportado (S256/plain).
- `refresh_token` opacos con **rotación** (solo se guarda el hash).
- Cuenta se **bloquea 15 min** tras 5 fallos de login (base para MFA — Fase 2).

## Variables de entorno

```env
ZYNAUTH_ISSUER=http://localhost:4000     # URL pública base de la API (issuer)
ZYNAUTH_SESSION_SECRET=                   # firma la cookie SSO (usa JWT_SECRET si vacío)
```

## Migración de base de datos

```bash
cd apps/api
npx prisma migrate deploy      # aplica 20260717000000_zynauth_oidc
# (o en dev)  npx prisma migrate dev
```
