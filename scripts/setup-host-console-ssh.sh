#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS_DIR="$ROOT_DIR/secrets"
KEY_PATH="$SECRETS_DIR/host_console_key"
PUB_PATH="${KEY_PATH}.pub"

mkdir -p "$SECRETS_DIR"

if [[ ! -f "$KEY_PATH" ]]; then
  echo "==> Generando llave SSH para Server Console..."
  ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "zyncloud-host-console"
  chmod 600 "$KEY_PATH"
  chmod 644 "$PUB_PATH"
else
  echo "==> La llave ya existe: $KEY_PATH"
fi

SSH_USER="${HOST_CONSOLE_SSH_USER:-$USER}"

echo ""
echo "Agrega esta llave pública al host (authorized_keys de $SSH_USER):"
echo ""
cat "$PUB_PATH"
echo ""
echo "Ejemplo:"
echo "  mkdir -p ~/.ssh && chmod 700 ~/.ssh"
echo "  cat >> ~/.ssh/authorized_keys <<'EOF'"
cat "$PUB_PATH"
echo "EOF"
echo "  chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "En ~/zyncloud/.env configura:"
echo "  HOST_CONSOLE_ENABLED=true"
echo "  HOST_CONSOLE_MODE=ssh"
echo "  HOST_CONSOLE_SSH_HOST=172.17.0.1"
echo "  HOST_CONSOLE_SSH_USER=$SSH_USER"
echo ""
echo "Luego recrea el contenedor (importante si la llave se creó después del primer up):"
echo "  docker compose down && docker compose up -d"
