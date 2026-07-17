import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  generateKeyPair,
  exportJWK,
  exportPKCS8,
  importPKCS8,
  type JWK,
  type KeyLike,
} from 'jose';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../../common/crypto.util';

interface LoadedKey {
  kid: string;
  alg: string;
  privateKey: KeyLike;
  publicJwk: JWK;
}

/**
 * Gestiona las claves RSA con las que ZynAuth firma los tokens (access / id).
 * - Guarda la privada cifrada en la base de datos (rotable).
 * - Expone las publicas como JWKS en /.well-known/jwks.json.
 * Equivale al "signing key" administrado por Cognito, pero bajo tu control.
 */
@Injectable()
export class SigningKeyService implements OnModuleInit {
  private readonly logger = new Logger(SigningKeyService.name);
  private cache: LoadedKey[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Intento perezoso: si la DB no esta lista todavia, no tumbamos el arranque.
    try {
      await this.ensureKey();
    } catch (err) {
      this.logger.warn(
        `No se pudieron cargar/crear claves de firma al arrancar (se reintentara bajo demanda): ${(err as Error).message}`,
      );
    }
  }

  /** Garantiza que exista al menos una clave activa; devuelve todas las activas cargadas. */
  private async loadActive(): Promise<LoadedKey[]> {
    if (this.cache && this.cache.length) return this.cache;

    const rows = await this.prisma.signingKey.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    const loaded: LoadedKey[] = [];
    for (const row of rows) {
      const pem = decryptSecret(row.privatePemEnc);
      const privateKey = await importPKCS8(pem, row.algorithm);
      loaded.push({
        kid: row.kid,
        alg: row.algorithm,
        privateKey,
        publicJwk: { ...(JSON.parse(row.publicJwk) as JWK), kid: row.kid },
      });
    }
    this.cache = loaded;
    return loaded;
  }

  private async ensureKey(): Promise<LoadedKey[]> {
    const existing = await this.loadActive();
    if (existing.length) return existing;
    await this.generateAndStore();
    this.cache = null;
    return this.loadActive();
  }

  /** Crea un nuevo par RSA-2048 y lo persiste (privada cifrada). */
  async generateAndStore(): Promise<string> {
    const alg = 'RS256';
    const { publicKey, privateKey } = await generateKeyPair(alg, {
      modulusLength: 2048,
      extractable: true,
    });
    const kid = randomBytes(8).toString('hex');
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = kid;
    publicJwk.alg = alg;
    publicJwk.use = 'sig';
    const pem = await exportPKCS8(privateKey);

    await this.prisma.signingKey.create({
      data: {
        kid,
        algorithm: alg,
        publicJwk: JSON.stringify(publicJwk),
        privatePemEnc: encryptSecret(pem),
        active: true,
      },
    });
    this.cache = null;
    this.logger.log(`Nueva clave de firma generada (kid=${kid})`);
    return kid;
  }

  /** Clave activa mas reciente para firmar tokens nuevos. */
  async getSigningKey(): Promise<LoadedKey> {
    const keys = await this.ensureKey();
    return keys[0];
  }

  /** Documento JWKS publico (todas las claves activas). */
  async getJwks(): Promise<{ keys: JWK[] }> {
    const keys = await this.ensureKey();
    return { keys: keys.map((k) => k.publicJwk) };
  }
}
