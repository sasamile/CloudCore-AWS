export interface DeployTarget {
  repoFullName: string;
  branch: string;
  rootDir: string;
  buildCommand: string | null;
  startCommand: string | null;
  port?: number | null;
}

export function buildDeployScript(dep: DeployTarget, token?: string): string {
  const repoUrl = token
    ? `https://x-access-token:${token}@github.com/${dep.repoFullName}.git`
    : `https://github.com/${dep.repoFullName}.git`;
  const dirName = dep.repoFullName.split('/').pop() || 'app';
  const appName = dirName.replace(/[^a-zA-Z0-9_-]/g, '-');
  const port = dep.port || 3000;
  const rootDir = dep.rootDir && dep.rootDir.trim() ? dep.rootDir : '.';

  return [
    'set -e',
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

    // ── Arrancar app en background ─────────────────────────────────────────────
    // Usamos nohup + disown (más portables que setsid) para que el proceso
    // sobreviva cuando el exec de Docker se cierra.
    // El bloque completo está en una subshell con || true para que cualquier
    // fallo al arrancar NO bloquee el echo "== OK ==" final.
    dep.startCommand
      ? [
          'echo "== START =="',
          `( pkill -f "${appName}-run" > /dev/null 2>&1 || true`,
          `  nohup bash -c '. "$NVM_DIR/nvm.sh" 2>/dev/null || true; nvm use "$_NVER" > /dev/null 2>&1 || true; ${dep.startCommand}' \\`,
          `    > "/var/log/${appName}.log" 2>&1 &`,
          `  disown $!`,
          ') || true',
        ].join('\n')
      : 'echo "(sin start)"',

    'echo "== OK =="',
  ].join('\n');
}
