#!/bin/bash
set -e

cd /app/apps/api
echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting ZynCloud API..."
if [ -f dist/main.js ]; then
  node dist/main.js &
elif [ -f dist/src/main.js ]; then
  node dist/src/main.js &
else
  echo "ERROR: No se encontró el build de la API en dist/main.js"
  ls -la dist/ || true
  exit 1
fi
API_PID=$!

cd /app/apps/web
echo "Starting ZynCloud Web..."
npm run start &
WEB_PID=$!

trap 'kill $API_PID $WEB_PID 2>/dev/null' SIGTERM SIGINT
wait $API_PID $WEB_PID
