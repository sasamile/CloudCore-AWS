#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: Falta .env — copia .env.example y configura los valores."
  echo "  cp .env.example .env"
  exit 1
fi

if grep -qE '^CLOUDFLARE_API_TOKEN[^=]' .env 2>/dev/null; then
  echo "ERROR: En .env falta '=' en CLOUDFLARE_API_TOKEN."
  echo "  Debe ser: CLOUDFLARE_API_TOKEN=cfat_tu_token"
  exit 1
fi

if grep -qE '^CLOUDFLARE_ACCOUNT_ID[^=]' .env 2>/dev/null; then
  echo "ERROR: En .env falta '=' en CLOUDFLARE_ACCOUNT_ID."
  exit 1
fi

if grep -qE '^[A-Z_]+=[^"'\''\s].*\s' .env 2>/dev/null; then
  echo "ERROR: En .env hay valores con espacios sin comillas (ej. HOST_CONSOLE_LABEL=\"ZynCloud Server\")."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

ZYNCLOUD_IMAGE="${ZYNCLOUD_IMAGE:-ghcr.io/sasamile/cloudcore-aws/app:latest}"
UBUNTU_BASE_IMAGE="${UBUNTU_BASE_IMAGE:-ghcr.io/sasamile/cloudcore-aws/ubuntu-base:latest}"
export ZYNCLOUD_IMAGE

echo "==> Descargando imágenes desde GHCR..."
docker pull "$ZYNCLOUD_IMAGE"
docker pull "$UBUNTU_BASE_IMAGE"

echo "==> Etiquetando imagen base para instancias Ubuntu..."
docker tag "$UBUNTU_BASE_IMAGE" zyncloud/ubuntu-base:latest

echo "==> Levantando ZynCloud (app + postgres)..."
docker compose up -d --no-build --pull always

echo "==> Estado de los contenedores:"
docker compose ps

echo ""
echo "Deploy listo."
echo "  Web:  ${FRONTEND_URL:-http://localhost:3000}"
echo "  API:  ${NEXT_PUBLIC_API_URL:-http://localhost:4000}"
echo ""
echo "La base de datos vive en el volumen 'zyncloud-db-data' y NO se borra al actualizar la app."
