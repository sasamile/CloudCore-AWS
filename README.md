<p align="center">
  <img src="apps/web/public/logo.svg" alt="ZynCloud" width="64" height="64" />
</p>

<h1 align="center">ZynCloud</h1>

<p align="center">
  <strong>Tu mini-AWS self-hosted — compute, identidad, storage y agentes IA en un solo panel.</strong><br/>
  Instancias Docker, ZynAuth (OIDC + MFA), Object Storage con SDKs npm, dominios, deploy desde GitHub y servidor MCP.
</p>

<p align="center">
  <a href="#características">Características</a> ·
  <a href="#capturas">Capturas</a> ·
  <a href="#sdks">SDKs</a> ·
  <a href="#arquitectura">Arquitectura</a> ·
  <a href="#stack">Stack</a> ·
  <a href="#despliegue">Despliegue</a> ·
  <a href="#desarrollo-local">Desarrollo</a>
</p>

---

## ¿Qué es ZynCloud?

ZynCloud es una plataforma de gestión de infraestructura que corre en tu propio servidor. Combina un **panel tipo AWS Console** con servicios reutilizables para tus apps:

| Capa | Qué ofrece |
|------|------------|
| **Console** | Instancias Ubuntu en Docker, dominios (Cloudflare Tunnel), snapshots, consola web y deploy desde GitHub |
| **ZynAuth** | Identidad OIDC (≈ Cognito): apps registradas, user pools, MFA TOTP, Access Keys |
| **Object Storage** | Buckets y objetos estilo S3 con firma ZYN1 y SDK `@zyntek/storage` |
| **MCP Server** | Agentes IA (Claude Desktop / Claude Code) que operan tu infra vía Model Context Protocol |

Ideal para desarrolladores con VPS o lab casero, equipos pequeños que quieren un PaaS propio, y quien integra auth + storage en productos como Orbidev sin depender de AWS.

> Detalle de ZynAuth: [`apps/api/src/zynauth/README.md`](apps/api/src/zynauth/README.md) · Storage SDK: [`packages/storage-sdk/README.md`](packages/storage-sdk/README.md)

---

## Características

| Módulo | Descripción |
|--------|-------------|
| **Compute** | Crear, iniciar, detener y eliminar instancias Ubuntu con límites de CPU/RAM |
| **Consola web** | Terminal en el navegador (xterm.js) con setup rápido de herramientas |
| **Asistente IA** | Chat integrado para despliegues, Docker, npm, Git y configuración |
| **Deploy / Auto-Deploy** | Conecta GitHub y despliega repos en una instancia (estilo Vercel) |
| **Dominios** | Subdominios a instancias con Cloudflare Tunnel y SSL |
| **Object Storage** | Buckets y objetos estilo S3, Access Keys y docs de API en consola |
| **ZynAuth** | Apps OIDC, user pools por app, login embebido y SDK `@zyntek/zynauth` |
| **MFA** | Verificación en dos pasos (TOTP) para cuentas de consola y pools |
| **Databases** | Bases de datos gestionadas (DBaaS) desde el panel |
| **MCP Server** | Tools para listar/crear instancias, buckets y más desde agentes IA |
| **Snapshots / SSH Keys** | Backups de instancias y gestión de key pairs |
| **Auth consola** | Email/contraseña, Google OAuth y MFA |

---

## Capturas

### Inicio de sesión

Autenticación con credenciales o Google OAuth. Interfaz limpia con tema claro/oscuro.

<p align="center">
  <img src="apps/web/public/md/login.png" alt="Pantalla de login de ZynCloud" width="800" />
</p>

---

### Dashboard

Vista general de la infraestructura: instancias, CPU/RAM, dominios, buckets y snapshots.

<p align="center">
  <img src="apps/web/public/md/dashboard.png" alt="Dashboard principal de ZynCloud" width="800" />
</p>

---

### Seguridad — MFA

Verificación en dos pasos con app de autenticación (TOTP). Actívala desde **Identity → Security**.

<p align="center">
  <img src="apps/web/public/md/MFA.png" alt="Configuración de MFA en ZynCloud" width="800" />
</p>

---

### Apps (ZynAuth)

Registra aplicaciones OIDC — equivalentes a los App Clients de Cognito — para autenticar usuarios de tus productos.

<p align="center">
  <img src="apps/web/public/md/Auth-sdk.png" alt="Apps registradas en ZynAuth" width="800" />
</p>

---

### Instancias

Gestión de instancias: estado, recursos, dirección pública y acciones (conectar, iniciar, detener, eliminar).

<p align="center">
  <img src="apps/web/public/md/instancias.png" alt="Lista de instancias" width="800" />
</p>

---

### Consola web + Asistente IA

Terminal en el navegador, setup rápido (Git, Node, Python, Docker…) y asistente de despliegue con IA.

<p align="center">
  <img src="apps/web/public/md/consola.png" alt="Consola web con asistente IA" width="800" />
</p>

---

### Despliegue desde GitHub

Conecta GitHub, elige un repo y despliega en una instancia con un flujo similar a Vercel.

<p align="center">
  <img src="apps/web/public/md/deploy-vercel.png" alt="Despliegue desde GitHub" width="800" />
</p>

---

### Object Storage (S3)

Buckets, subida de archivos y API documentada. Acceso por JWT o Access Key + firma ZYN1.

<p align="center">
  <img src="apps/web/public/md/s3.png" alt="Object Storage estilo S3" width="800" />
</p>

---

### API Docs

Documentación integrada: ZynAuth, pools, storage, Access Keys, SDKs npm y referencia REST.

<p align="center">
  <img src="apps/web/public/md/api-docs.png" alt="API Docs para desarrolladores" width="800" />
</p>

---

### MCP Server

Conecta Claude Desktop o Claude Code a tu infra: el agente puede crear instancias, buckets y bases de datos por ti.

<p align="center">
  <img src="apps/web/public/md/mcp-server.png" alt="Servidor MCP de ZynCloud" width="800" />
</p>

---

## SDKs

Publicados en npm para integrar ZynCloud en backends (Node 18+). Las secrets nunca van al navegador.

```bash
# Identidad (OIDC / login embebido + MFA)
bun add @zyntek/zynauth

# Object Storage (firma ZYN1)
bun add @zyntek/storage
```

```ts
import { ZynAuthClient } from "@zyntek/zynauth"
import { ZynStorageClient } from "@zyntek/storage"

const zynauth = new ZynAuthClient({
  issuer: process.env.ZYNAUTH_ISSUER!,
  clientId: process.env.ZYNAUTH_CLIENT_ID!,
  clientSecret: process.env.ZYNAUTH_CLIENT_SECRET,
})

const storage = new ZynStorageClient({
  endpoint: process.env.ZYNCLOUD_STORAGE_ENDPOINT!,
  accessKeyId: process.env.ZYNCLOUD_ACCESS_KEY_ID!,
  secretAccessKey: process.env.ZYNCLOUD_SECRET!,
})
```

Más detalle en la consola: **Data → API Docs**.

---

## Arquitectura

```mermaid
flowchart TB
  subgraph browser [Navegador]
    WEB[Next.js Dashboard]
  end

  subgraph server [Servidor / PC]
    subgraph compose [Docker Compose]
      APP[ZynCloud App<br/>NestJS + Next.js]
      DB[(PostgreSQL 16)]
    end

    SOCK[/var/run/docker.sock/]
    CF[Cloudflared Tunnel]
    STORAGE[(Volúmenes<br/>DB · Backups · S3)]
    MCP[MCP Server]
  end

  subgraph instances [Instancias cliente]
    I1[Ubuntu Container 1]
    I2[Ubuntu Container 2]
    IN[Ubuntu Container N]
  end

  subgraph agents [Agentes IA]
    CLAUDE[Claude Desktop / Code]
  end

  WEB -->|HTTPS| CF
  CF --> APP
  APP --> DB
  APP --> STORAGE
  APP -->|Docker API| SOCK
  SOCK --> I1
  SOCK --> I2
  SOCK --> IN
  CLAUDE --> MCP
  MCP -->|API + JWT| APP
```

| Componente | Rol |
|------------|-----|
| **App** (`zyncloud`) | API NestJS + frontend Next.js en una sola imagen |
| **DB** (`db`) | PostgreSQL 16; volumen `zyncloud-db-data` |
| **Instancias** | Contenedores Ubuntu vía Docker socket |
| **Cloudflare Tunnel** | Panel y apps de clientes con dominios y SSL |
| **MCP Server** | Bridge Model Context Protocol → API ZynCloud |
| **GHCR** | Imágenes construidas por CI y desplegadas en el servidor |

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js, React, Tailwind CSS, shadcn/ui, Recharts |
| Terminal | xterm.js + WebSocket |
| Backend | NestJS, Prisma, PostgreSQL |
| Auth | JWT, Google OAuth, OIDC (ZynAuth), MFA TOTP |
| SDKs | `@zyntek/zynauth`, `@zyntek/storage` |
| Agentes | MCP Server (Claude Desktop / Claude Code) |
| Infra | Docker, Docker Compose, Cloudflare Tunnel |
| CI/CD | GitHub Actions → GHCR → self-hosted runner |
| IA | Groq, Gemini, Kimi, Anthropic, OpenAI (configurable) |

---

## Estructura del repositorio

```
zyncloud/
├── apps/
│   ├── api/              # API NestJS + Prisma + ZynAuth
│   └── web/              # Dashboard Next.js
├── packages/
│   ├── auth-sdk/         # @zyntek/zynauth
│   ├── storage-sdk/      # @zyntek/storage
│   ├── mcp-server/       # Servidor MCP
│   └── shared/
├── docker/
│   └── ubuntu-base/      # Imagen base para instancias
├── scripts/
│   └── deploy.sh
├── .github/workflows/
├── docker-compose.yml
├── Dockerfile.app
└── .env.example
```

---

## Despliegue

### Requisitos del servidor

- Linux con **Docker** y **Docker Compose v2**
- GitHub Actions **self-hosted runner** registrado
- (Opcional) **Cloudflare Tunnel** para dominios públicos

### 1. Clonar y configurar

```bash
mkdir -p ~/zyncloud && cd ~/zyncloud
git clone https://github.com/sasamile/CloudCore-AWS.git .
cp .env.example .env
nano .env
```

> **Importante:** Los valores con espacios deben ir entre comillas en `.env`:
> ```bash
> GOOGLE_OAUTH_SCOPES="openid email profile"
> GITHUB_OAUTH_SCOPES="repo read:user read:org"
> HOST_CONSOLE_LABEL="ZynCloud Server"
> ```

### 2. Variables en GitHub Actions

En **Settings → Secrets and variables → Actions → Variables**:

| Variable | Ejemplo |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://apicloud.tudominio.com` |
| `NEXT_PUBLIC_PUBLIC_HOST` | `cloud.tudominio.com` |

### 3. Registrar runner y desplegar

```bash
cd ~/zyncloud
bash scripts/deploy.sh
```

Cada `push` a `main` construye la imagen, la publica en GHCR y el runner ejecuta el deploy.

### Variables de entorno principales

Ver [`.env.example`](.env.example) para la lista completa.

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL |
| `JWT_SECRET` | Secreto para tokens de sesión |
| `PUBLIC_HOST` | Hostname público del panel |
| `FRONTEND_URL` | URL del dashboard |
| `NEXT_PUBLIC_API_URL` | URL de la API (embebida en el build del frontend) |
| `CORS_ORIGINS` | Orígenes extra permitidos (coma-separados) |
| `CLOUDFLARE_API_TOKEN` | Token para túnel y DNS |
| `CLOUDFLARE_TUNNEL_ID` | ID del túnel Cloudflare |
| `ZYNCLOUD_IMAGE` | Imagen de la app en GHCR |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | Proveedor de IA para el asistente |

---

## Desarrollo local

```bash
# Instalar dependencias
bun install   # o npm install

# Configurar entorno
cp .env.example .env

# Levantar solo PostgreSQL
docker compose up -d db

# En .env local:
# DATABASE_URL=postgresql://zyncloud:zyncloud@localhost:5432/zyncloud

# Migraciones y arranque
bun run db:migrate
bun run dev
```

| Servicio | URL |
|----------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:4000 |

### Comandos útiles

```bash
# Logs en producción
docker compose logs -f

# Backup de la base de datos
docker compose exec db pg_dump -U zyncloud zyncloud > backup.sql

# Restaurar backup
cat backup.sql | docker compose exec -T db psql -U zyncloud zyncloud

# Construir imagen base Ubuntu para instancias
bun run docker:base
```

---

## Licencia

Proyecto privado — Zyntek.
