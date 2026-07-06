#!/bin/bash
set -e

cd /app/apps/api
echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting ZynCloud API..."
node dist/main.js &
API_PID=$!

cd /app/apps/web
echo "Starting ZynCloud Web..."
npm run start &
WEB_PID=$!

trap 'kill $API_PID $WEB_PID 2>/dev/null' SIGTERM SIGINT
wait $API_PID $WEB_PID
