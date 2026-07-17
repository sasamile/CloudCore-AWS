import { ZYNAUTH } from '../zynauth.config';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PASS_THROUGH = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method',
];

/** Segundo paso del login: pedir el codigo TOTP (o de respaldo). */
export function renderMfaPage(opts: {
  params: Record<string, string>;
  ticket: string;
  error: string | null;
}): string {
  const hidden = PASS_THROUGH.filter((k) => opts.params[k] != null)
    .map((k) => `<input type="hidden" name="${k}" value="${esc(opts.params[k])}" />`)
    .join('\n      ');

  const errorHtml = opts.error ? `<div class="error">${esc(opts.error)}</div>` : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verificacion en dos pasos &middot; ZynAuth</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      background:#0a0e1a; color:#e2e8f0; }
    .card { width:100%; max-width:380px; padding:32px; background:#111827;
      border:1px solid #1f2937; border-radius:16px; }
    .brand { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
    .logo { width:36px; height:36px; border-radius:9px; display:grid; place-items:center;
      background:#2563eb; color:#fff; font-weight:800; }
    h1 { font-size:16px; margin:0; }
    p.hint { font-size:13px; color:#64748b; margin:6px 0 18px; }
    input[type=text] { width:100%; padding:14px; border-radius:9px; background:#0a0e1a;
      border:1px solid #1f2937; color:#e2e8f0; font-size:22px; text-align:center;
      letter-spacing:8px; font-variant-numeric:tabular-nums; }
    input:focus { outline:none; border-color:#2563eb; }
    button { width:100%; margin-top:20px; padding:12px; border:0; border-radius:9px;
      background:#2563eb; color:#fff; font-size:14px; font-weight:600; cursor:pointer; }
    button:hover { background:#1d4ed8; }
    .error { margin-bottom:14px; padding:10px 12px; border-radius:9px; font-size:13px;
      background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.3); color:#fca5a5; }
  </style>
</head>
<body>
  <form class="card" method="post" action="/oauth2/mfa">
    <div class="brand"><div class="logo">Z</div><h1>Verificacion en dos pasos</h1></div>
    <p class="hint">Ingresa el codigo de tu app de autenticacion (o un codigo de respaldo).</p>
    ${errorHtml}
    <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code"
      pattern="[0-9A-Za-z-]*" maxlength="11" required autofocus placeholder="000000" />
    <input type="hidden" name="mfa_ticket" value="${esc(opts.ticket)}" />
    ${hidden}
    <button type="submit">Verificar</button>
  </form>
</body>
</html>`;
}
