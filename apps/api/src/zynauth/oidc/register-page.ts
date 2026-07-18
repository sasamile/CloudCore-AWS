import { ZYNAUTH } from '../zynauth.config';
import { HOSTED_UI_CSS, esc, PASS_THROUGH, hiddenFields } from './hosted-ui-shared';

export function renderRegisterPage(opts: {
  params: Record<string, string>;
  error: string | null;
  appName?: string;
}): string {
  const errorHtml = opts.error ? `<div class="error">${esc(opts.error)}</div>` : '';
  const subtitle = opts.appName ? `Crea tu cuenta en ${esc(opts.appName)}` : 'Crea tu cuenta';

  const loginQs = PASS_THROUGH.filter((k) => opts.params[k] != null)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(opts.params[k])}`)
    .join('&');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Registrarse &middot; ZynAuth</title>
  <style>${HOSTED_UI_CSS}</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div class="logo">Z</div>
      <h1>ZynAuth</h1>
      <p>${subtitle}</p>
    </div>
    <form class="card" method="post" action="${ZYNAUTH.paths.register}">
      ${errorHtml}
      <div class="field">
        <label for="name">Nombre</label>
        <input id="name" type="text" name="name" autocomplete="name" value="${esc(opts.params.name)}" />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" name="email" autocomplete="username" required autofocus value="${esc(opts.params.email)}" />
      </div>
      <div class="field">
        <label for="password">Contrase&ntilde;a</label>
        <input id="password" type="password" name="password" autocomplete="new-password" required minlength="6" />
      </div>
      <div class="field">
        <label for="password2">Confirmar contrase&ntilde;a</label>
        <input id="password2" type="password" name="password2" autocomplete="new-password" required />
      </div>
      ${hiddenFields(opts.params)}
      <button type="submit">Crear cuenta</button>
      <div class="foot">
        &iquest;Ya tienes cuenta? <a href="${ZYNAUTH.paths.login}?${loginQs}">Inicia sesi&oacute;n</a>
      </div>
    </form>
  </div>
</body>
</html>`;
}
