/** Estilos compartidos Hosted UI — alineados al panel ZynCloud (neutral, calmado). */
export const HOSTED_UI_CSS = `
  :root { color-scheme: dark light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    background:
      linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px),
      #0a0a0a;
    background-size: 40px 40px, 40px 40px, auto;
    color: #f5f5f5;
    padding: 24px;
  }
  .wrap { width: 100%; max-width: 380px; }
  .head { text-align: center; margin-bottom: 28px; }
  .logo {
    width: 36px; height: 36px; border-radius: 10px; margin: 0 auto 14px;
    display: grid; place-items: center;
    background: #fafafa; color: #0a0a0a; font-weight: 700; font-size: 16px;
  }
  .head h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 6px; }
  .head p { font-size: 14px; color: #a3a3a3; margin: 0; }
  .card {
    background: rgba(23,23,23,0.95); border: 1px solid #262626;
    border-radius: 16px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  label { display: block; font-size: 13px; font-weight: 500; color: #e5e5e5; margin: 0 0 6px; }
  .field { margin-bottom: 14px; }
  input[type=email], input[type=password], input[type=text] {
    width: 100%; height: 40px; padding: 0 12px; border-radius: 8px;
    background: #0a0a0a; border: 1px solid #262626; color: #f5f5f5; font-size: 14px;
  }
  input.otp {
    height: 48px; text-align: center; font-size: 18px; letter-spacing: 0.35em;
    font-variant-numeric: tabular-nums; font-family: ui-monospace, monospace;
  }
  input:focus { outline: none; border-color: #a3a3a3; box-shadow: 0 0 0 2px rgba(163,163,163,0.25); }
  button[type=submit] {
    width: 100%; height: 40px; margin-top: 8px; border: 0; border-radius: 8px;
    background: #fafafa; color: #0a0a0a; font-size: 14px; font-weight: 600; cursor: pointer;
    transition: opacity 0.15s;
  }
  button[type=submit]:hover { opacity: 0.92; }
  .error {
    margin-bottom: 14px; padding: 10px 12px; border-radius: 8px; font-size: 13px;
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #fca5a5;
  }
  .hint { font-size: 12px; color: #737373; margin: 6px 0 0; }
  .foot { margin-top: 18px; font-size: 13px; color: #737373; text-align: center; }
  .foot a { color: #e5e5e5; text-decoration: underline; text-underline-offset: 3px; }
`;

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const PASS_THROUGH = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method',
];

export function hiddenFields(params: Record<string, string>): string {
  return PASS_THROUGH.filter((k) => params[k] != null)
    .map((k) => `<input type="hidden" name="${k}" value="${esc(params[k])}" />`)
    .join('\n      ');
}
