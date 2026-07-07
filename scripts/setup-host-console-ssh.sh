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
echo "==> Verificando SSH en el host..."
if ! systemctl is-active --quiet ssh 2>/dev/null && ! systemctl is-active --quiet sshd 2>/dev/null; then
  echo "WARN: SSH no parece estar activo. Instálalo y arráncalo:"
  echo "  sudo apt update && sudo apt install -y openssh-server"
  echo "  sudo systemctl enable --now ssh"
else
  echo "OK: servicio SSH activo"
fi

AUTH_KEYS="$HOME/.ssh/authorized_keys"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
PUB_LINE="$(cat "$PUB_PATH")"
if [[ -f "$AUTH_KEYS" ]] && grep -qF "$PUB_LINE" "$AUTH_KEYS" 2>/dev/null; then
  echo "OK: llave pública ya está en $AUTH_KEYS"
else
  echo "==> Agregando llave pública a $AUTH_KEYS"
  echo "$PUB_LINE" >> "$AUTH_KEYS"
  chmod 600 "$AUTH_KEYS"
fi

echo ""
echo "En ~/zyncloud/.env usa:"
echo "  HOST_CONSOLE_ENABLED=true"
echo "  HOST_CONSOLE_MODE=ssh"
echo "  HOST_CONSOLE_SSH_HOST=host.docker.internal"
echo "  HOST_CONSOLE_SSH_USER=$SSH_USER"
echo ""
echo "Recrea el contenedor:"
echo "  cd ~/zyncloud && docker compose down && docker compose up -d"
echo ""
echo "Prueba desde el contenedor:"
echo "  docker compose exec zyncloud ssh -i /run/secrets/zyncloud/host_console_key \\"
echo "    -o StrictHostKeyChecking=no -o BatchMode=yes ${SSH_USER}@host.docker.internal echo OK"
