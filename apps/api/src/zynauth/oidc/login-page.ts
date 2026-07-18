import { ZYNAUTH } from '../zynauth.config';
import { HOSTED_UI_CSS, esc, PASS_THROUGH, hiddenFields } from './hosted-ui-shared';

export function renderLoginPage(opts: {
  params: Record<string, string>;
  error: string | null;
  appName?: string;
}): string {
  const errorHtml = opts.error ? `<div class="error">${esc(opts.error)}</div>` : '';
  const subtitle = opts.appName
    ? `Inicia sesi&oacute;n en ${esc(opts.appName)}`
    : 'Inicia sesi&oacute;n para continuar';

  const registerQs = PASS_THROUGH.filter((k) => opts.params[k] != null)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(opts.params[k])}`)
    .join('&');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Iniciar sesion &middot; ZynAuth</title>
  <style>${HOSTED_UI_CSS}</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div class="logo">Z</div>
      <h1>ZynAuth</h1>
      <p>${subtitle}</p>
    </div>
    <form class="card" method="post" action="${ZYNAUTH.paths.login}">
      ${errorHtml}
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" name="email" autocomplete="username" required autofocus value="${esc(opts.params.email)}" />
      </div>
      <div class="field">
        <label for="password">Contrase&ntilde;a</label>
        <input id="password" type="password" name="password" autocomplete="current-password" required />
      </div>
      ${hiddenFields(opts.params)}
      <button type="submit">Continuar</button>
      <div class="foot">
        &iquest;No tienes cuenta? <a href="${ZYNAUTH.paths.register}?${registerQs}">Reg&iacute;strate</a>
      </div>
    </form>
  </div>
</body>
</html>`;
}
