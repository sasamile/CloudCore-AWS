#!/bin/bash
# Script de prueba - crea una app Node.js simple para verificar que el deploy funciona
# Ejecutar dentro de la consola de una instancia ZynCloud

echo "=== Creando app de prueba ==="

mkdir -p /home/ubuntu/test-app
cd /home/ubuntu/test-app

# Crear package.json
cat > package.json << 'PKGJSON'
{
  "name": "zyncloud-test",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  }
}
PKGJSON

# Crear servidor Node.js simple
cat > server.js << 'SERVERJS'
const http = require('http');
const os = require('os');

const PORT = 3000;

const server = http.createServer((req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZynCloud Test App</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0e1a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #0f1321;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 48px;
      max-width: 500px;
      width: 90%;
      text-align: center;
    }
    .logo {
      width: 64px;
      height: 64px;
      background: #3b82f6;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;
      font-weight: bold;
      color: #0a0e1a;
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; margin-bottom: 32px; }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      text-align: left;
    }
    .stat {
      background: #1e293b;
      padding: 16px;
      border-radius: 12px;
    }
    .stat-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; }
    .stat-value { font-size: 20px; font-weight: bold; margin-top: 4px; }
    .success {
      margin-top: 24px;
      padding: 12px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 8px;
      color: #22c55e;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Z</div>
    <h1>ZynCloud funciona!</h1>
    <p class="subtitle">App desplegada exitosamente en tu instancia</p>
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Hostname</div>
        <div class="stat-value">${os.hostname()}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Uptime</div>
        <div class="stat-value">${Math.floor(uptime)}s</div>
      </div>
      <div class="stat">
        <div class="stat-label">RAM Usada</div>
        <div class="stat-value">${Math.round(memUsage.rss / 1024 / 1024)} MB</div>
      </div>
      <div class="stat">
        <div class="stat-label">Node.js</div>
        <div class="stat-value">${process.version}</div>
      </div>
    </div>
    <div class="success">
      Deploy exitoso - Puerto ${PORT} - ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ZynCloud Test App corriendo en puerto ${PORT}`);
});
SERVERJS

echo "=== App creada! ==="
echo "Para iniciar: cd /home/ubuntu/test-app && node server.js"
echo "La app correra en el puerto 3000 de esta instancia"
