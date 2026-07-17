import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../../common/crypto.util';
import {
  generateTotpSecret,
  verifyTotp,
  otpauthUri,
  generateBackupCodes,
} from './totp.util';

@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Paso 1: genera un secreto y devuelve el otpauth URI para el QR. Aun NO activa MFA. */
  async setup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const secret = generateTotpSecret();
    // Se guarda cifrado pero MFA sigue deshabilitado hasta confirmar con un codigo.
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: encryptSecret(secret) },
    });

    return {
      secret,
      otpauthUri: otpauthUri(secret, user.email),
    };
  }

  /** Paso 2: confirma el codigo del autenticador y activa MFA. Devuelve codigos de respaldo. */
  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecretEnc) {
      throw new BadRequestException('Primero ejecuta el setup de MFA');
    }
    const secret = decryptSecret(user.mfaSecretEnc);
    if (!verifyTotp(secret, code)) {
      throw new BadRequestException('Codigo invalido');
    }

    const backupCodes = generateBackupCodes();
    const hashes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaBackupCodes: JSON.stringify(hashes) },
    });

    return { enabled: true, backupCodes };
  }

  async disable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled) return { enabled: false };
    if (!(await this.verifyForUser(user, code))) {
      throw new BadRequestException('Codigo invalido');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEnc: null, mfaBackupCodes: null },
    });
    return { enabled: false };
  }

  /** Verifica un TOTP o un codigo de respaldo (consumiendolo). Usado en el login. */
  async verifyForUser(
    user: { id: string; mfaSecretEnc: string | null; mfaBackupCodes: string | null },
    code: string,
  ): Promise<boolean> {
    if (user.mfaSecretEnc) {
      const secret = decryptSecret(user.mfaSecretEnc);
      if (verifyTotp(secret, code)) return true;
    }
    // Codigo de respaldo (un solo uso).
    if (user.mfaBackupCodes) {
      const hashes = JSON.parse(user.mfaBackupCodes) as string[];
      for (let i = 0; i < hashes.length; i++) {
        if (await bcrypt.compare(code.trim(), hashes[i])) {
          hashes.splice(i, 1);
          await this.prisma.user.update({
            where: { id: user.id },
            data: { mfaBackupCodes: JSON.stringify(hashes) },
          });
          return true;
        }
      }
    }
    return false;
  }

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const remaining = user?.mfaBackupCodes
      ? (JSON.parse(user.mfaBackupCodes) as string[]).length
      : 0;
    return { enabled: !!user?.mfaEnabled, backupCodesRemaining: remaining };
  }
}
