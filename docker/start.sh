#!/bin/bash
set -e

cd /app/apps/api
echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting ZynCloud API..."
API_ENTRY=""
for candidate in dist/main.js dist/src/main.js; do
  if [ -f "$candidate" ]; then
    API_ENTRY="$candidate"
    break
  fi
done
if [ -z "$API_ENTRY" ]; then
  echo "ERROR: No se encontró el build de la API."
  find dist -maxdepth 2 -type f | sort || true
  exit 1
fi
node "$API_ENTRY" &
API_PID=$!

cd /app/apps/web
echo "Starting ZynCloud Web..."
npm run start &
WEB_PID=$!

trap 'kill $API_PID $WEB_PID 2>/dev/null' SIGTERM SIGINT
wait $API_PID $WEB_PID
