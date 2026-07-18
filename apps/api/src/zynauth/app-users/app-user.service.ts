import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { OAuthClientService } from '../clients/oauth-client.service';
import { verifyTotp } from '../mfa/totp.util';
import { decryptSecret, encryptSecret } from '../../common/crypto.util';
import { generateTotpSecret, otpauthUri, generateBackupCodes } from '../mfa/totp.util';

const SALT_ROUNDS = 10;
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AppUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: OAuthClientService,
  ) {}

  // -------------------------------------------------------------------------
  // CRUD (admin del panel ZynCloud)
  // -------------------------------------------------------------------------

  async createUser(
    clientId: string,
    ownerId: string,
    input: { email: string; password: string; name?: string },
  ) {
    await this.assertOwner(clientId, ownerId);

    const existing = await this.prisma.appUser.findUnique({
      where: { clientId_email: { clientId, email: input.email.trim().toLowerCase() } },
    });
    if (existing) throw new BadRequestException('Ya existe un usuario con ese email en esta app');

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await this.prisma.appUser.create({
      data: {
        clientId,
        email: input.email.trim().toLowerCase(),
        name: input.name?.trim() || null,
        passwordHash,
      },
    });
    return this.mapUser(user);
  }

  async listUsers(clientId: string, ownerId: string) {
    await this.assertOwner(clientId, ownerId);
    const users = await this.prisma.appUser.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.mapUser(u));
  }

  async deleteUser(clientId: string, ownerId: string, userId: string) {
    await this.assertOwner(clientId, ownerId);
    const user = await this.prisma.appUser.findFirst({ where: { id: userId, clientId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.appUser.delete({ where: { id: userId } });
    return { ok: true };
  }

  async resetPassword(clientId: string, ownerId: string, userId: string, newPassword: string) {
    await this.assertOwner(clientId, ownerId);
    const user = await this.prisma.appUser.findFirst({ where: { id: userId, clientId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.appUser.update({
      where: { id: userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Auto-registro (Hosted UI)
  // -------------------------------------------------------------------------

  async selfRegister(clientId: string, input: { email: string; password: string; name?: string }) {
    const existing = await this.prisma.appUser.findUnique({
      where: { clientId_email: { clientId, email: input.email.trim().toLowerCase() } },
    });
    if (existing) throw new BadRequestException('Ya existe una cuenta con ese email');

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await this.prisma.appUser.create({
      data: {
        clientId,
        email: input.email.trim().toLowerCase(),
        name: input.name?.trim() || null,
        passwordHash,
      },
    });
    return user;
  }

  // -------------------------------------------------------------------------
  // Autenticacion (usada por OidcService)
  // -------------------------------------------------------------------------

  async validateCredentials(clientId: string, email: string, password: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { clientId_email: { clientId, email: email.trim().toLowerCase() } },
    });
    if (!user) return null;
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Cuenta bloqueada temporalmente');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.registerFailedLogin(user.id);
      return null;
    }
    if (user.failedLoginAttempts > 0) {
      await this.prisma.appUser.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    return user;
  }

  async findById(id: string) {
    return this.prisma.appUser.findUnique({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // MFA para app users
  // -------------------------------------------------------------------------

  async verifyMfa(
    user: { id: string; mfaSecretEnc: string | null; mfaBackupCodes: string | null },
    code: string,
  ): Promise<boolean> {
    if (user.mfaSecretEnc) {
      const secret = decryptSecret(user.mfaSecretEnc);
      if (verifyTotp(secret, code)) return true;
    }
    if (user.mfaBackupCodes) {
      const hashes = JSON.parse(user.mfaBackupCodes) as string[];
      for (let i = 0; i < hashes.length; i++) {
        if (await bcrypt.compare(code.trim(), hashes[i])) {
          hashes.splice(i, 1);
          await this.prisma.appUser.update({
            where: { id: user.id },
            data: { mfaBackupCodes: JSON.stringify(hashes) },
          });
          return true;
        }
      }
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // helpers privados
  // -------------------------------------------------------------------------

  private async assertOwner(clientId: string, ownerId: string) {
    const client = await this.prisma.oAuthClient.findFirst({
      where: { clientId, ownerId },
    });
    if (!client) throw new NotFoundException('App no encontrada o no te pertenece');
    return client;
  }

  private async registerFailedLogin(userId: string) {
    const user = await this.prisma.appUser.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });
    if (user.failedLoginAttempts >= MAX_FAILED) {
      await this.prisma.appUser.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_MS) },
      });
    }
  }

  private mapUser(u: {
    id: string;
    clientId: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    mfaEnabled: boolean;
    failedLoginAttempts: number;
    createdAt: Date;
  }) {
    return {
      id: u.id,
      clientId: u.clientId,
      email: u.email,
      name: u.name,
      emailVerified: u.emailVerified,
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt,
    };
  }
}
