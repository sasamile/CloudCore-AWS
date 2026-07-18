import { HOSTED_UI_CSS, esc, hiddenFields } from './hosted-ui-shared';

/** Segundo paso del login: pedir el codigo TOTP (o de respaldo). */
export function renderMfaPage(opts: {
  params: Record<string, string>;
  ticket: string;
  error: string | null;
}): string {
  const errorHtml = opts.error ? `<div class="error">${esc(opts.error)}</div>` : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verificacion en dos pasos &middot; ZynAuth</title>
  <style>${HOSTED_UI_CSS}</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div class="logo">Z</div>
      <h1>Verificaci&oacute;n MFA</h1>
      <p>C&oacute;digo del autenticador o de respaldo</p>
    </div>
    <form class="card" method="post" action="/oauth2/mfa">
      ${errorHtml}
      <div class="field">
        <label for="code">C&oacute;digo de verificaci&oacute;n</label>
        <input id="code" class="otp" type="text" name="code" inputmode="numeric" autocomplete="one-time-code"
          pattern="[0-9A-Za-z-]*" maxlength="11" required autofocus placeholder="000000" />
        <p class="hint">6 d&iacute;gitos TOTP, o un c&oacute;digo de respaldo de un solo uso.</p>
      </div>
      <input type="hidden" name="mfa_ticket" value="${esc(opts.ticket)}" />
      ${hiddenFields(opts.params)}
      <button type="submit">Verificar y continuar</button>
    </form>
  </div>
</body>
</html>`;
}
