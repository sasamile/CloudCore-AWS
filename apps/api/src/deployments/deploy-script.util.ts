export interface DeployTarget {
  repoFullName: string;
  branch: string;
  rootDir: string;
  buildCommand: string | null;
  startCommand: string | null;
  port?: number | null;
  hostname?: string | null;
}

function dirNameOf(dep: DeployTarget): string {
  return dep.repoFullName.split('/').pop() || 'app';
}

function appNameOf(dep: DeployTarget): string {
  return dirNameOf(dep).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function workDir(dep: DeployTarget): string {
  const rootDir = dep.rootDir && dep.rootDir.trim() ? dep.rootDir : '.';
  return `/apps/${dirNameOf(dep)}/${rootDir}`.replace(/\/\.$/, '');
}

/**
 * Script de BUILD: clona/actualiza, ajusta la versión de Node, compila y
 * configura el enrutado nginx. NO arranca la app (eso keep-alive rompería el
 * stream del `docker exec`). Termina con exit 0 explícito para señalar éxito.
 */
export function buildDeployScript(dep: DeployTarget, token?: string): string {
  const repoUrl = token
    ? `https://x-access-token:${token}@github.com/${dep.repoFullName}.git`
    : `https://github.com/${dep.repoFullName}.git`;
  const dirName = dirNameOf(dep);
  const appName = appNameOf(dep);
  const port = dep.port || 3000;
  const rootDir = dep.rootDir && dep.rootDir.trim() ? dep.rootDir : '.';
  const hostname = dep.hostname && dep.hostname.trim() ? dep.hostname.trim() : null;

  return [
    'set -e',
    // Si algo falla (comando no protegido con || true), el trap imprime la línea
    // exacta antes de que set -e corte el script. Facilita el diagnóstico en logs.
    `trap 'echo "== FAIL (exit $?) en comando: $BASH_COMMAND =="' ERR`,
    'export DEBIAN_FRONTEND=noninteractive',
    `export PORT=${port}`,
    'export HOST=0.0.0.0',
    'export CI=true',

    // ── NVM: instala si no existe y carga en el PATH ──────────────────────────
    'export NVM_DIR="/root/.nvm"',
    'if [ ! -s "$NVM_DIR/nvm.sh" ]; then',
    '  echo "Instalando NVM..."',
    '  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | PROFILE=/dev/null bash > /dev/null 2>&1 || true',
    'fi',
    '. "$NVM_DIR/nvm.sh" > /dev/null 2>&1 || true',

    // ── Clonar / actualizar repo ───────────────────────────────────────────────
    'mkdir -p /apps && cd /apps',
    `if [ -d "${dirName}/.git" ]; then`,
    `  cd "${dirName}" && git fetch --all && git reset --hard "origin/${dep.branch}";`,
    `else`,
    `  git clone --branch "${dep.branch}" --depth 1 "${repoUrl}" "${dirName}" && cd "${dirName}";`,
    `fi`,
    `cd "${rootDir}"`,

    // ── Auto-detectar versión de Node y cambiar con NVM ───────────────────────
    // Lee .nvmrc primero, luego engines.node de package.json, fallback a 22.
    'if [ -f ".nvmrc" ]; then',
    '  _NVER="$(cat .nvmrc | tr -d \'[:space:]\')"',
    'elif [ -f "package.json" ]; then',
    '  _NVER=$(node -e "try{var p=JSON.parse(require(\'fs\').readFileSync(\'package.json\',\'utf8\'));var n=p.engines&&p.engines.node;var m=n&&n.match(/(\\d+)/);console.log(m?m[1]:\'22\')}catch(e){console.log(\'22\')}" 2>/dev/null || echo "22")',
    'else',
    '  _NVER="22"',
    'fi',
    'export _NVER',
    'echo "Node requerido: v${_NVER}"',
    // nvm install es idempotente: si ya está instalado, no descarga de nuevo.
    'nvm install "$_NVER" > /dev/null 2>&1 && nvm use "$_NVER" > /dev/null 2>&1 || true',
    'echo "Node activo: $(node --version 2>/dev/null || echo desconocido)"',

    dep.buildCommand ? `echo "== BUILD =="; ${dep.buildCommand}` : 'echo "(sin build)"',

    // ── Enrutado público: nginx dentro del contenedor por Host header ──────────
    // El túnel manda {hostname} → contenedor:80; nginx aquí lo pasa al puerto
    // interno del proyecto. Así cada proyecto tiene su propia URL.
    ...(hostname
      ? [
          '( echo "== ROUTE =="',
          '  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled',
          // rm del default para que no capture con listen 80 default_server.
          '  rm -f /etc/nginx/sites-enabled/default',
          `  cat > "/etc/nginx/sites-available/${appName}.conf" <<'NGINXCONF'`,
          'server {',
          '    listen 80;',
          `    server_name ${hostname};`,
          '    location / {',
          `        proxy_pass http://127.0.0.1:${port};`,
          '        proxy_http_version 1.1;',
          '        proxy_set_header Host $host;',
          '        proxy_set_header Upgrade $http_upgrade;',
          '        proxy_set_header Connection "upgrade";',
          '        proxy_set_header X-Real-IP $remote_addr;',
          '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
          '        proxy_set_header X-Forwarded-Proto $scheme;',
          '    }',
          '}',
          'NGINXCONF',
          `  ln -sf "/etc/nginx/sites-available/${appName}.conf" "/etc/nginx/sites-enabled/${appName}.conf"`,
          // Arranca nginx si no corre; si ya corre, recarga la config.
          '  nginx -t > /dev/null 2>&1 && { nginx -s reload 2>/dev/null || nginx 2>/dev/null; }',
          `  echo "URL: https://${hostname}"`,
          ') || true',
        ]
      : []),

    'echo "== OK =="',
    // Salida explícita 0: garantiza exitCode 0 pese al trap.
    'exit 0',
  ].join('\n');
}

/**
 * Script de ARRANQUE: mata la instancia previa (por PID file) y lanza la app
 * en PRIMER PLANO con `exec`. Se corre en un `docker exec -d` (detached), así
 * la app ES el proceso principal del exec y Docker la mantiene viva. La salida
 * va a su log. Usar `exec` (no `&`) es clave: con `&` el shell salía y Docker
 * mataba al proceso huérfano.
 */
export function buildStartScript(dep: DeployTarget): string {
  if (!dep.startCommand) return 'echo "(sin start)"';
  const appName = appNameOf(dep);
  const port = dep.port || 3000;
  const wd = workDir(dep);
  const log = `/var/log/${appName}.log`;
  const pidf = `/var/run/deploy-${appName}.pid`;

  return [
    'export NVM_DIR="/root/.nvm"',
    '. "$NVM_DIR/nvm.sh" > /dev/null 2>&1 || true',
    `export PORT=${port}`,
    'export HOST=0.0.0.0',
    `cd "${wd}" 2>/dev/null || cd "/apps/${dirNameOf(dep)}"`,
    // Detecta la versión de Node ya instalada por el build (misma lógica).
    'if [ -f ".nvmrc" ]; then _NVER="$(cat .nvmrc | tr -d \'[:space:]\')";',
    'elif [ -f "package.json" ]; then _NVER=$(node -e "try{var p=JSON.parse(require(\'fs\').readFileSync(\'package.json\',\'utf8\'));var n=p.engines&&p.engines.node;var m=n&&n.match(/(\\d+)/);console.log(m?m[1]:\'22\')}catch(e){console.log(\'22\')}" 2>/dev/null || echo "22");',
    'else _NVER="22"; fi',
    'nvm use "$_NVER" > /dev/null 2>&1 || true',
    // Mata la instancia previa de ESTA app por su PID file (fiable, no toca otras apps).
    `if [ -f "${pidf}" ]; then kill "$(cat "${pidf}")" > /dev/null 2>&1 || true; sleep 1; fi`,
    // Guarda el PID (se conserva tras exec) y lanza la app en primer plano.
    `echo $$ > "${pidf}"`,
    `exec env PORT=${port} HOST=0.0.0.0 ${dep.startCommand} > "${log}" 2>&1 < /dev/null`,
  ].join('\n');
}

/**
 * Health check: espera hasta ~25s a que la app responda en su puerto interno.
 * Devuelve un script que imprime "APP UP" o "APP DOWN" para reflejar en logs.
 */
export function buildHealthCheckScript(dep: DeployTarget): string {
  const port = dep.port || 3000;
  const appName = appNameOf(dep);
  const log = `/var/log/${appName}.log`;
  return [
    'set +e',
    `for i in $(seq 1 25); do`,
    `  if curl -sS -m 3 -o /dev/null "http://127.0.0.1:${port}"; then echo "APP UP en puerto ${port}"; exit 0; fi`,
    '  sleep 1',
    'done',
    `echo "APP DOWN: no respondió en el puerto ${port} tras 25s"`,
    `echo "--- últimas líneas del log de la app ---"`,
    `tail -20 "${log}" 2>/dev/null || echo "(sin log)"`,
    'exit 0',
  ].join('\n');
}
