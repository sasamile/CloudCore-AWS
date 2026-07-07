# ZynCloud

Panel web para gestionar servidores Docker (mini-AWS personal).

## Arquitectura de despliegue

```mermaid
flowchart LR
  subgraph host [PC vieja]
    GH[GitHub Actions runner]
    DC[Docker Compose]
    APP[zyncloud app]
    DB[(PostgreSQL)]
    VOL[(zyncloud-db-data)]
    SOCK[/var/run/docker.sock/]
    GH --> DC
    DC --> APP
    DC --> DB
    DB --> VOL
    APP --> DB
    APP --> SOCK
  end
  Browser --> APP
```

- **App** (`zyncloud`): API NestJS + frontend Next.js. Se reconstruye en cada deploy.
- **DB** (`db`): PostgreSQL 16 en contenedor aparte. Los datos viven en el volumen `zyncloud-db-data` y **persisten** aunque actualices la app.
- **Instancias**: contenedores Ubuntu creados por la app vía Docker socket.

## Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit: ZynCloud con deploy Docker"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/zyncloud.git
git push -u origin main
```

## Configurar la PC vieja (self-hosted runner)

Requisitos: Linux con Docker y Docker Compose v2.

### 1. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Cierra sesión y vuelve a entrar para aplicar el grupo docker
```

### 2. Clonar el repo (solo la primera vez)

```bash
mkdir -p ~/zyncloud && cd ~/zyncloud
git clone https://github.com/sasamile/CloudCore-AWS.git .
cp .env.example .env
nano .env   # Pon la IP de la PC y contraseñas
```

### 3. Variables en GitHub (para construir el frontend con tu IP)

En GitHub: **Settings → Secrets and variables → Actions → Variables** (pestaña Variables).

Crea las mismas URLs que en tu `.env` del servidor:

| Variable | Ejemplo |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `http://192.168.1.100:4000` |
| `NEXT_PUBLIC_PUBLIC_HOST` | `192.168.1.100` |

GitHub Actions construye la imagen con esos valores; el servidor solo hace **pull**, no compila.

### 4. Registrar GitHub Actions runner

En GitHub: **Settings → Actions → Runners → New self-hosted runner** (Linux).

Ejecuta los comandos que te da GitHub en la PC vieja, dentro de `~/zyncloud`.

### 5. Primer deploy

Tras el primer `push` a `main`, GitHub publica las imágenes en GHCR. En el servidor:

```bash
cd ~/zyncloud
git pull   # solo esta vez, para obtener scripts actualizados
bash scripts/deploy.sh
```

O deja que el runner lo haga solo si ya está registrado.

Abre `http://IP-DE-LA-PC:3000`.

### 6. Deploy automático (sin git pull manual)

Cada `push` a `main`:

1. GitHub **construye** la app y sube imágenes a `ghcr.io`
2. El runner en la PC vieja **descarga** las imágenes y ejecuta `docker compose up`

No necesitas `git pull` en el servidor para actualizar la app (el runner hace checkout solo de scripts/compose).

> Si cambias `NEXT_PUBLIC_*`, actualiza las **Variables** en GitHub y vuelve a hacer push.

## Variables de entorno

Ver `.env.example`. Lo más importante:

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL |
| `JWT_SECRET` | Secreto para tokens de sesión |
| `PUBLIC_HOST` | IP/hostname de la PC (para URLs de instancias) |
| `FRONTEND_URL` | URL del panel web |
| `NEXT_PUBLIC_API_URL` | URL de la API (se embebe en el build del frontend) |
| `ZYNCLOUD_IMAGE` | Imagen de la app en GHCR (deploy automático) |
| `UBUNTU_BASE_IMAGE` | Imagen base para instancias en GHCR |

> **Nota:** Si cambias `NEXT_PUBLIC_*`, actualiza las **Variables** en GitHub (Settings → Actions → Variables) y haz push a `main` para reconstruir la imagen.

## Desarrollo local

```bash
npm install
cp .env.example .env
# Levanta solo la DB:
docker compose up -d db
# En .env local:
# DATABASE_URL=postgresql://zyncloud:zyncloud@localhost:5432/zyncloud

npm run db:migrate
npm run dev
```

## Comandos útiles

```bash
# Ver logs
docker compose logs -f

# Backup manual de la DB
docker compose exec db pg_dump -U zyncloud zyncloud > backup.sql

# Restaurar
cat backup.sql | docker compose exec -T db psql -U zyncloud zyncloud

# Ver volúmenes (la DB está en zyncloud-db-data)
docker volume ls | grep zyncloud
```

## Estructura

```
apps/api/     NestJS + Prisma
apps/web/     Next.js dashboard
docker/       Scripts e imagen Ubuntu base para instancias
scripts/      deploy.sh
```
