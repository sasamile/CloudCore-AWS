<p align="center">
  <img src="apps/web/public/logo.svg" alt="ZynCloud" width="64" height="64" />
</p>

<h1 align="center">ZynCloud</h1>

<p align="center">
  <strong>Panel de gestión cloud self-hosted — tu mini-AWS personal sobre Docker.</strong><br/>
  Instancias, dominios, almacenamiento S3, consola web y despliegues desde GitHub en un solo lugar.
</p>

<p align="center">
  <a href="#características">Características</a> ·
  <a href="#capturas">Capturas</a> ·
  <a href="#arquitectura">Arquitectura</a> ·
  <a href="#stack">Stack</a> ·
  <a href="#despliegue">Despliegue</a> ·
  <a href="#desarrollo-local">Desarrollo</a>
</p>

---

## ¿Qué es ZynCloud?

ZynCloud es una plataforma de gestión de infraestructura que corre en tu propio servidor. Permite crear y administrar **instancias Ubuntu en Docker**, asignar **dominios personalizados** vía Cloudflare Tunnel, gestionar **almacenamiento de objetos estilo S3**, hacer **snapshots**, conectar una **consola web interactiva** y **desplegar aplicaciones desde GitHub** — todo desde un dashboard moderno inspirado en AWS Console y Vercel.

Ideal para:

- Desarrolladores que quieren su propio PaaS en casa o en un VPS
- Equipos pequeños que necesitan gestionar múltiples apps sin depender de servicios cloud costosos
- Laboratorios de aprendizaje de infraestructura, Docker y DevOps

---

## Características

| Módulo | Descripción |
|--------|-------------|
| **Compute** | Crear, iniciar, detener y eliminar instancias Ubuntu con límites de CPU/RAM configurables |
| **Consola web** | Terminal interactiva en el navegador (xterm.js) con setup rápido de herramientas |
| **Asistente IA** | Chat integrado para ayudar con despliegues, Docker, npm, Git y configuración |
| **Deploy** | Conecta GitHub y despliega repos automáticamente en una instancia (estilo Vercel) |
| **Dominios** | Asigna subdominios a instancias con Cloudflare Tunnel y SSL automático |
| **Object Storage** | Buckets y objetos compatibles con API S3, con documentación integrada |
| **Snapshots** | Backups de instancias para restauración rápida |
| **SSH Keys** | Gestión de pares de claves para acceso a instancias |
| **Server Console** | Terminal web del host físico (opcional, vía SSH) |
| **Auth** | Login con email/contraseña y Google OAuth |

---

## Capturas

### Inicio de sesión

Autenticación con credenciales o Google OAuth. Interfaz limpia con soporte de tema claro/oscuro.

<p align="center">
  <img src="apps/web/public/md/login.png" alt="Pantalla de login de ZynCloud" width="800" />
</p>

---

### Dashboard

Vista general de la infraestructura: instancias activas, uso de CPU/RAM, dominios, buckets y snapshots. Gráficos en tiempo real de los últimos 5 minutos.

<p align="center">
  <img src="apps/web/public/md/dashboard.png" alt="Dashboard principal de ZynCloud" width="800" />
</p>

---

### Instancias

Gestión completa de instancias: estado, recursos, dirección pública, puerto y acciones (conectar, iniciar, detener, eliminar). Diseño responsive con vista de tarjetas en móvil.

<p align="center">
  <img src="apps/web/public/md/instancias.png" alt="Lista de instancias" width="800" />
</p>

---

### Consola web + Asistente IA

Terminal en el navegador conectada a la instancia, panel de **setup rápido** (Git, Node.js, Python, Docker…) y **asistente de despliegue con IA** para resolver errores y guiar la configuración.

<p align="center">
  <img src="apps/web/public/md/consola.png" alt="Consola web con asistente IA" width="800" />
</p>

---

### Despliegue desde GitHub

Conecta tu cuenta de GitHub, selecciona un repositorio y despliega en una instancia con un flujo similar a Vercel.

<p align="center">
  <img src="apps/web/public/md/deploy-vercel.png" alt="Despliegue desde GitHub" width="800" />
</p>

---

### Object Storage (S3)

Almacenamiento de objetos con buckets, subida de archivos y API documentada. Compatible con clientes S3 estándar.

<p align="center">
  <img src="apps/web/public/md/s3.png" alt="Object Storage estilo S3" width="800" />
</p>

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
  end

  subgraph instances [Instancias cliente]
    I1[Ubuntu Container 1]
    I2[Ubuntu Container 2]
    IN[Ubuntu Container N]
  end

  WEB -->|HTTPS| CF
  CF --> APP
  APP --> DB
  APP --> STORAGE
  APP -->|Docker API| SOCK
  SOCK --> I1
  SOCK --> I2
  SOCK --> IN
```

| Componente | Rol |
|------------|-----|
| **App** (`zyncloud`) | API NestJS + frontend Next.js empaquetados en una sola imagen |
| **DB** (`db`) | PostgreSQL 16; datos persistentes en volumen `zyncloud-db-data` |
| **Instancias** | Contenedores Ubuntu creados dinámicamente vía Docker socket |
| **Cloudflare Tunnel** | Expone el panel y las apps de clientes con dominios propios y SSL |
| **GHCR** | GitHub Container Registry — imágenes construidas por CI y descargadas en el servidor |

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS, shadcn/ui, Recharts |
| Terminal | xterm.js + WebSocket |
| Backend | NestJS, Prisma, PostgreSQL |
| Infra | Docker, Docker Compose, Cloudflare Tunnel |
| CI/CD | GitHub Actions → GHCR → self-hosted runner |
| IA | Groq, Gemini, Kimi, Anthropic, OpenAI (configurable) |
| Auth | JWT, Google OAuth, GitHub OAuth |

---

## Estructura del repositorio

```
zyncloud/
├── apps/
│   ├── api/          # API NestJS + Prisma
│   └── web/          # Dashboard Next.js
├── docker/
│   └── ubuntu-base/  # Imagen base para instancias
├── scripts/
│   └── deploy.sh     # Script de deploy en el servidor
├── .github/workflows/
│   └── deploy.yml    # CI: build → GHCR → deploy
├── docker-compose.yml
├── Dockerfile.app
└── .env.example
```

---

## Despliegue

### Requisitos del servidor

- Linux con **Docker** y **Docker Compose v2**
- GitHub Actions **self-hosted runner** registrado
- (Opcional) **Cloudflare Tunnel** configurado para dominios públicos

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
| `NEXT_PUBLIC_API_URL` | `https://apizyncloud.tudominio.com` |
| `NEXT_PUBLIC_PUBLIC_HOST` | `zyncloud.tudominio.com` |

### 3. Registrar runner y desplegar

```bash
# Registrar self-hosted runner (instrucciones en GitHub → Settings → Actions → Runners)
cd ~/zyncloud
bash scripts/deploy.sh
```

Cada `push` a `main` construye la imagen, la publica en GHCR y el runner ejecuta el deploy automáticamente.

### Variables de entorno principales

Ver [`.env.example`](.env.example) para la lista completa.

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL |
| `JWT_SECRET` | Secreto para tokens de sesión |
| `PUBLIC_HOST` | Hostname público del panel |
| `FRONTEND_URL` | URL del dashboard |
| `NEXT_PUBLIC_API_URL` | URL de la API (embebida en el build del frontend) |
| `CLOUDFLARE_API_TOKEN` | Token para gestionar el túnel y DNS |
| `CLOUDFLARE_TUNNEL_ID` | ID del túnel Cloudflare |
| `ZYNCLOUD_IMAGE` | Imagen de la app en GHCR |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | Proveedor de IA para el asistente |

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Configurar entorno
cp .env.example .env

# Levantar solo PostgreSQL
docker compose up -d db

# En .env local:
# DATABASE_URL=postgresql://zyncloud:zyncloud@localhost:5432/zyncloud

# Migraciones y arranque
npm run db:migrate
npm run dev
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
npm run docker:base
```

---

## Licencia

Proyecto privado — Zyntek.
