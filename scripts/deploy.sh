#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: Falta .env — copia .env.example y configura los valores."
  echo "  cp .env.example .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Construyendo imagen base para instancias Ubuntu..."
docker build -t zyncloud/ubuntu-base:latest docker/ubuntu-base

echo "==> Construyendo y levantando ZynCloud (app + postgres)..."
docker compose build
docker compose up -d

echo "==> Estado de los contenedores:"
docker compose ps

echo ""
echo "Deploy listo."
echo "  Web:  ${FRONTEND_URL:-http://localhost:3000}"
echo "  API:  ${NEXT_PUBLIC_API_URL:-http://localhost:4000}"
echo ""
echo "La base de datos vive en el volumen 'zyncloud-db-data' y NO se borra al actualizar la app."
