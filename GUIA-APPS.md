# Guía: conectar una app nueva a la plataforma Zyntek

Esta guía es el punto de partida para cualquier app futura que quiera usar tu
infraestructura (ZynCloud) como si fuera AWS: **autenticación (ZynAuth ≈ Cognito)**,
**object storage (≈ S3)**, **bases de datos gestionadas (DBaaS)** y **MCP** para agentes.

> Analogía rápida con AWS:
> | AWS | Zyntek |
> |-----|--------|
> | Cognito | **ZynAuth** (OIDC) — `apps/api/src/zynauth` |
> | S3 | **ZynCloud Storage** + SDK `@zyncloud/storage` |
> | RDS | **DBaaS** — endpoints `/databases` |
> | IAM Access Keys | **Access Keys** ZYN1 — `/zynauth/access-keys` |
> | (agentes) | **`@zyncloud/mcp`** |

---

## 1. Autenticación con ZynAuth (≈ Cognito)

### 1.1 Registrar tu app (una vez)
Con un JWT de usuario de ZynCloud (de `POST /auth/login`):

```bash
curl -X POST $ZYNCLOUD_API/zynauth/clients \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"name":"mi-app","redirectUris":["https://mi-app.com/api/auth/callback"],
       "postLogoutUris":["https://mi-app.com"],"isPublic":false}'
# -> guarda clientId y clientSecret (el secret solo se muestra aquí)
```

### 1.2 Usar el SDK `@zyncloud/auth` (Node/Next)

```ts
import { ZynAuthClient } from '@zyncloud/auth';

const auth = new ZynAuthClient({
  issuer: process.env.ZYNAUTH_ISSUER!,        // https://apizyncloud.suescun.sbs
  clientId: process.env.ZYNAUTH_CLIENT_ID!,
  clientSecret: process.env.ZYNAUTH_CLIENT_SECRET!,
  redirectUri: 'https://mi-app.com/api/auth/callback',
});

// (A) Iniciar login -> redirige al usuario
const { url, state, nonce, codeVerifier } = await auth.createAuthorizationUrl();
// guarda state/nonce/codeVerifier en la sesión, luego: res.redirect(url)

// (B) En el callback
const tokens = await auth.exchangeCode({ code, codeVerifier });
const claims = await auth.verifyIdToken(tokens.id_token); // { sub, email, name, ... }

// (C) Renovar / cerrar sesión
const fresh = await auth.refresh(tokens.refresh_token!);
const logout = await auth.logoutUrl('https://mi-app.com');
```

### 1.3 App que ya habla OIDC/Cognito (como orbidev)
No reescribas nada. Solo define `ZYNAUTH_ISSUER` y pon tu `clientId/secret` de ZynAuth
en `COGNITO_CLIENT_ID/COGNITO_CLIENT_SECRET`. La capa de auth descubre y verifica
contra ZynAuth automáticamente (ver `orbidev/apps/api/src/auth/services`).

### 1.4 Segundo factor (MFA)
Los usuarios activan 2FA desde ZynCloud (`/zynauth/mfa/setup` → QR → `/zynauth/mfa/enable`).
El login hospedado pide el código automáticamente; tu app no hace nada extra.

---

## 2. Object storage (≈ S3) con `@zyncloud/storage`

### 2.1 Crear una Access Key (una vez)
```bash
curl -X POST $ZYNCLOUD_API/zynauth/access-keys \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"label":"mi-app","scopes":["storage"]}'
# -> accessKeyId + secretAccessKey (guárdalos; el secret solo se ve aquí)
```

### 2.2 Usar el SDK
```ts
import { ZynStorage } from '@zyncloud/storage';

const s = new ZynStorage({
  endpoint: process.env.ZYNCLOUD_STORAGE_ENDPOINT!,   // https://apizyncloud.suescun.sbs
  accessKeyId: process.env.ZYNCLOUD_ACCESS_KEY_ID!,
  secretAccessKey: process.env.ZYNCLOUD_SECRET_ACCESS_KEY!,
});

const bucket = await s.createBucket('mi-app-uploads');
await s.putObject(bucket.id, 'avatars/1.png', pngBuffer, 'image/png');
const bytes = await s.getObject(bucket.id, objectId);
const objetos = await s.listObjects(bucket.id);
```

Las peticiones se firman con **ZYN1-HMAC-SHA256** (Access Key/Secret), igual que SigV4 en AWS.
El mismo endpoint acepta también el JWT de usuario para el panel web.

---

## 3. Base de datos gestionada (DBaaS ≈ RDS)

```bash
# Requiere DBAAS_ADMIN_URL configurado en ZynCloud
curl -X POST $ZYNCLOUD_API/databases \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"name":"miapp"}'
# -> { connectionString: "postgresql://zu_miapp_xx:...@host:5432/zdb_miapp_xx" }
```
Usa ese `connectionString` en tu app (Prisma, pg, etc.). Recupéralo luego con
`GET /databases/:id/connection-string`.

---

## 4. Despliegue automático (≈ App Runner)
```bash
# 1) crear el deployment
curl -X POST $ZYNCLOUD_API/deployments -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"instanceId":"<id>","repoFullName":"usuario/mi-app","branch":"main",
       "buildCommand":"npm ci && npm run build","startCommand":"npm start"}'
# 2) dispararlo
curl -X POST $ZYNCLOUD_API/deployments/<depId>/trigger -H "Authorization: Bearer <JWT>"
```
Clona el repo dentro de la instancia, corre el build y arranca la app. El log queda en `lastLog`.

---

## 5. Agentes IA (MCP)
Registra `@zyncloud/mcp` en Claude Desktop / Claude Code:
```json
{
  "mcpServers": {
    "zyncloud": {
      "command": "node",
      "args": ["packages/mcp-server/src/index.ts"],
      "env": { "ZYNCLOUD_API_URL": "https://apizyncloud.suescun.sbs", "ZYNCLOUD_TOKEN": "<JWT>" }
    }
  }
}
```
Herramientas: `list_instances`, `create_instance`, `create_bucket`, `create_database`, etc.

---

## Panel de control (UI)
Todo lo anterior también se gestiona visualmente desde el panel web de ZynCloud:

| Página | Ruta | Para qué |
|--------|------|----------|
| Security (MFA) | `/dashboard/security` | Activar/desactivar 2FA (QR + códigos de respaldo) |
| Access Keys | `/dashboard/access-keys` | Crear/revocar credenciales del SDK de storage |
| Apps (ZynAuth) | `/dashboard/apps` | Registrar apps y obtener client_id/secret |
| Databases | `/dashboard/databases` | Crear bases de datos y ver connection strings |
| Auto-Deploy | `/dashboard/deployments` | Configurar y disparar despliegues, ver logs |
| Object Storage | `/dashboard/storage` | Buckets y objetos |
| MCP Server | `/dashboard/mcp` | Config lista para pegar en Claude Desktop/Code |

## Referencias
- ZynAuth (protocolo, endpoints, seguridad): [`apps/api/src/zynauth/README.md`](apps/api/src/zynauth/README.md)
- SDK storage: [`packages/storage-sdk`](packages/storage-sdk)
- SDK auth: [`packages/auth-sdk`](packages/auth-sdk)
- Servidor MCP: [`packages/mcp-server`](packages/mcp-server)
