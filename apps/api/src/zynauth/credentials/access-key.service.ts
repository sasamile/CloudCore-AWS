import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../../common/crypto.util';
import {
  canonicalString,
  signCanonical,
  parseAuthHeader,
  UNSIGNED_PAYLOAD,
} from './signing';

const MAX_SKEW_MS = 5 * 60 * 1000;

export interface VerifiedIdentity {
  userId: string;
  accessKeyId: string;
}

@Injectable()
export class AccessKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea una credencial. El secret se muestra UNA sola vez. */
  async create(userId: string, label: string, scopes: string[] = ['storage']) {
    const accessKeyId = `ZYNAK${randomBytes(9).toString('hex').toUpperCase()}`;
    const secret = randomBytes(32).toString('base64url');
    await this.prisma.accessKey.create({
      data: {
        accessKeyId,
        secretEnc: encryptSecret(secret),
        label,
        scopes: scopes.join(','),
        userId,
      },
    });
    return { accessKeyId, secretAccessKey: secret, label, scopes };
  }

  async list(userId: string) {
    const keys = await this.prisma.accessKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => ({
      id: k.id,
      accessKeyId: k.accessKeyId,
      label: k.label,
      scopes: k.scopes.split(','),
      lastUsedAt: k.lastUsedAt,
      revoked: !!k.revokedAt,
      createdAt: k.createdAt,
    }));
  }

  async revoke(userId: string, id: string) {
    await this.prisma.accessKey.updateMany({
      where: { id, userId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  /** Verifica una peticion firmada ZYN1 y devuelve la identidad. */
  async verifyRequest(input: {
    authorization?: string;
    date?: string;
    contentSha?: string;
    method: string;
    path: string;
  }): Promise<VerifiedIdentity> {
    const parsed = parseAuthHeader(input.authorization);
    if (!parsed) throw new UnauthorizedException('Firma ZYN1 ausente o malformada');
    if (!input.date) throw new UnauthorizedException('X-Zyn-Date requerido');

    const ts = Date.parse(input.date);
    if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
      throw new UnauthorizedException('X-Zyn-Date fuera de rango (reloj desfasado)');
    }

    const key = await this.prisma.accessKey.findUnique({
      where: { accessKeyId: parsed.credential },
    });
    if (!key || key.revokedAt) {
      throw new UnauthorizedException('Access key invalida o revocada');
    }

    const secret = decryptSecret(key.secretEnc);
    const canonical = canonicalString(
      input.method,
      input.path,
      input.date,
      input.contentSha || UNSIGNED_PAYLOAD,
    );
    const expected = signCanonical(secret, canonical);
    const a = Buffer.from(expected);
    const b = Buffer.from(parsed.signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Firma invalida');
    }

    // touch lastUsedAt (best-effort)
    this.prisma.accessKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return { userId: key.userId, accessKeyId: key.accessKeyId };
  }
}
