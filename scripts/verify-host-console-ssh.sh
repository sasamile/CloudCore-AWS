#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_PATH="$ROOT_DIR/secrets/host_console_key"
PUB_PATH="${KEY_PATH}.pub"
SSH_USER="${HOST_CONSOLE_SSH_USER:-$USER}"
AUTH_KEYS="$HOME/.ssh/authorized_keys"

echo "==> Usuario SSH: $SSH_USER"
echo "==> Llave privada: $KEY_PATH"
echo "==> Llave pública:  $PUB_PATH"
echo ""

if [[ ! -f "$KEY_PATH" || ! -f "$PUB_PATH" ]]; then
  echo "ERROR: Ejecuta primero: bash scripts/setup-host-console-ssh.sh"
  exit 1
fi

echo "==> Fingerprint de la llave activa:"
ssh-keygen -lf "$PUB_PATH"
echo ""

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
PUB_LINE="$(cat "$PUB_PATH")"

if [[ ! -f "$AUTH_KEYS" ]] || ! grep -qF "$PUB_LINE" "$AUTH_KEYS"; then
  echo "==> La llave pública NO está en authorized_keys. Agregando..."
  echo "$PUB_LINE" >> "$AUTH_KEYS"
else
  echo "OK: llave pública presente en $AUTH_KEYS"
fi
chmod 600 "$AUTH_KEYS"

echo ""
echo "==> Permisos de home (sshd exige que no sea escribible por otros):"
ls -ld "$HOME"
ls -la "$HOME/.ssh"
ls -l "$AUTH_KEYS"
echo ""

echo "==> Prueba 1: SSH desde el host (127.0.0.1)"
if ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no -o BatchMode=yes -o IdentitiesOnly=yes \
  "${SSH_USER}@127.0.0.1" echo "OK-host"; then
  echo "OK: autenticación local funciona"
else
  echo "FAIL: revisa logs → sudo journalctl -u ssh -n 30 --no-pager"
  exit 1
fi

echo ""
echo "==> Prueba 2: SSH desde el contenedor"
cd "$ROOT_DIR"
if docker compose exec zyncloud ssh -i /run/secrets/zyncloud/host_console_key \
  -o StrictHostKeyChecking=no -o BatchMode=yes -o IdentitiesOnly=yes \
  "${SSH_USER}@host.docker.internal" echo "OK-container"; then
  echo ""
  echo "Todo listo. Server Console debería funcionar."
else
  echo ""
  echo "FAIL desde contenedor. Verifica .env:"
  echo "  HOST_CONSOLE_SSH_HOST=host.docker.internal"
  echo "  HOST_CONSOLE_SSH_USER=$SSH_USER"
  echo "Luego: docker compose down && docker compose up -d"
  exit 1
fi
