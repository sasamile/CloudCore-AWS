#!/usr/bin/env node
/**
 * Limpia dev local: mata nest --watch huérfanos y procesos en el puerto del API.
 */
const { execSync, spawnSync } = require('child_process');
const path = require('path');

const port = process.env.PORT || '4000';
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '../..');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function kill(pid, label) {
  try {
    process.kill(Number(pid), 'SIGTERM');
    console.log(`[free-port] ${label} (PID ${pid})`);
    return true;
  } catch {
    return false;
  }
}

// Instancias viejas de nest --watch del monorepo (sesiones anteriores de bun/turbo dev)
const nestPatterns = [
  `${repoRoot}/node_modules/.bin/nest start --watch`,
  `${apiRoot}.*nest start --watch`,
];

const nestPids = new Set();
for (const pattern of nestPatterns) {
  for (const pid of run(`pgrep -f "${pattern}"`).split('\n').filter(Boolean)) {
    nestPids.add(pid);
  }
}

for (const pid of nestPids) {
  kill(pid, 'Detenido nest watch huérfano');
}

if (nestPids.size > 0) {
  spawnSync('sleep', ['0.5']);
}

// Cualquier node escuchando en el puerto del API
try {
  const pids = run(`lsof -ti :${port}`).split('\n').filter(Boolean);
  for (const pid of pids) {
    try {
      const cmd = run(`ps -p ${pid} -o comm=`).trim();
      if (cmd === 'node') {
        process.kill(Number(pid), 'SIGKILL');
        console.log(`[free-port] Liberado puerto ${port} (PID ${pid})`);
      }
    } catch {
      // proceso ya terminó
    }
  }
} catch {
  // puerto libre
}
