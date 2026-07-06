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
git clone https://github.com/TU_USUARIO/zyncloud.git .
cp .env.example .env
nano .env   # Pon la IP de la PC y contraseñas
```

### 3. Registrar GitHub Actions runner

En GitHub: **Settings → Actions → Runners → New self-hosted runner** (Linux).

Ejecuta los comandos que te da GitHub en la PC vieja. El runner debe quedar en la **misma carpeta del repo** (o configura el workflow para hacer checkout ahí).

### 4. Primer deploy manual

```bash
bash scripts/deploy.sh
```

Abre `http://IP-DE-LA-PC:3000`.

### 5. Deploy automático

Cada `push` a `main` dispara `.github/workflows/deploy.yml` en el runner de la PC vieja.

## Variables de entorno

Ver `.env.example`. Lo más importante:

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL |
| `JWT_SECRET` | Secreto para tokens de sesión |
| `PUBLIC_HOST` | IP/hostname de la PC (para URLs de instancias) |
| `FRONTEND_URL` | URL del panel web |
| `NEXT_PUBLIC_API_URL` | URL de la API (se embebe en el build del frontend) |

> **Nota:** Si cambias `NEXT_PUBLIC_*`, hay que reconstruir: `docker compose build --no-cache && docker compose up -d`.

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
