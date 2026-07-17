import { createHmac, createHash } from 'crypto';

/**
 * Esquema de firma ZYN1 (inspirado en AWS SigV4, simplificado).
 * Cadena canonica = METHOD \n PATH \n X-Zyn-Date \n contentSha256
 * Firma = HMAC-SHA256(secret, canonica) en hex.
 * Cabeceras: Authorization: ZYN1-HMAC-SHA256 Credential=<id>, Signature=<sig>
 *            X-Zyn-Date: <ISO8601>
 *            X-Zyn-Content-Sha256: <hex | UNSIGNED-PAYLOAD>
 */
export const ZYN1_PREFIX = 'ZYN1-HMAC-SHA256';
export const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

export function canonicalString(
  method: string,
  path: string,
  date: string,
  contentSha: string,
): string {
  return `${method.toUpperCase()}\n${path}\n${date}\n${contentSha}`;
}

export function signCanonical(secret: string, canonical: string): string {
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function parseAuthHeader(
  header?: string,
): { credential: string; signature: string } | null {
  if (!header || !header.startsWith(ZYN1_PREFIX)) return null;
  const rest = header.slice(ZYN1_PREFIX.length).trim();
  const cred = /Credential=([^,\s]+)/.exec(rest)?.[1];
  const sig = /Signature=([^,\s]+)/.exec(rest)?.[1];
  if (!cred || !sig) return null;
  return { credential: cred, signature: sig };
}
