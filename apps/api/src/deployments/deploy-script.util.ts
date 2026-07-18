/**
 * Genera el script bash que clona/actualiza un repo y lo arranca dentro de una
 * instancia. Soporta múltiples proyectos en la misma instancia: cada uno vive en
 * /apps/<repo> y escucha en su propio $PORT.
 *
 * Se comparte entre el deploy manual (DeploymentsService) y el auto-deploy por
 * webhook (IntegrationsService) para que ambos produzcan exactamente el mismo build.
 */
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
    'mkdir -p /apps && cd /apps',
    `if [ -d "${dirName}/.git" ]; then`,
    `  cd "${dirName}" && git fetch --all && git reset --hard "origin/${dep.branch}";`,
    `else`,
    `  git clone --branch "${dep.branch}" --depth 1 "${repoUrl}" "${dirName}" && cd "${dirName}";`,
    `fi`,
    `cd "${rootDir}"`,
    dep.buildCommand ? `echo "== BUILD =="; ${dep.buildCommand}` : 'echo "(sin build)"',
    // Arranca la app en background bajo un nombre único; mata la instancia previa de este proyecto.
    dep.startCommand
      ? `echo "== START =="; pkill -f "${appName}-run" || true; ` +
        `setsid bash -c 'exec -a ${appName}-run env PORT=${port} HOST=0.0.0.0 ${dep.startCommand}' > "/var/log/${appName}.log" 2>&1 < /dev/null &`
      : 'echo "(sin start)"',
    'echo "== OK =="',
  ].join('\n');
}
