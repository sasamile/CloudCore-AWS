import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, generateKeyPairSync, randomBytes, scryptSync } from 'crypto';
import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SshKeysService {
  constructor(private prisma: PrismaService) {}

  private getEncryptionKey() {
    const secret = process.env.SSH_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'dev-secret';
    return scryptSync(secret, 'zyncloud-ssh-keys', 32);
  }

  private encrypt(text: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decrypt(payload: string): string {
    const [ivB64, tagB64, encB64] = payload.split(':');
    const key = this.getEncryptionKey();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  async findAll(userId: string) {
    return this.prisma.sshKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        fingerprint: true,
        createdAt: true,
        privateKeyEnc: true,
      },
    }).then((keys) =>
      keys.map(({ privateKeyEnc, ...key }) => ({
        ...key,
        canDownload: !!privateKeyEnc,
      })),
    );
  }

  async create(userId: string, name: string) {
    const existing = await this.prisma.sshKey.findFirst({
      where: { userId, name },
    });
    if (existing) throw new ConflictException('Ya existe un key pair con ese nombre');

    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const opensshPublicKey = this.extractOpenSshPublicKey(privateKey, name);
    const fingerprint = createHash('sha256')
      .update(opensshPublicKey.split(' ')[1], 'base64')
      .digest('base64')
      .replace(/=+$/, '');

    const key = await this.prisma.sshKey.create({
      data: {
        name,
        fingerprint: `SHA256:${fingerprint}`,
        publicKey: opensshPublicKey,
        privateKeyEnc: this.encrypt(privateKey),
        userId,
      },
      select: { id: true, name: true, fingerprint: true, createdAt: true },
    });

    return { ...key, privateKey, canDownload: true };
  }

  async rename(id: string, userId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('El nombre no puede estar vacío');

    const key = await this.prisma.sshKey.findFirst({ where: { id, userId } });
    if (!key) throw new NotFoundException('Key pair no encontrado');

    const duplicate = await this.prisma.sshKey.findFirst({
      where: { userId, name: trimmed, NOT: { id } },
    });
    if (duplicate) throw new ConflictException('Ya existe un key pair con ese nombre');

    const updated = await this.prisma.sshKey.update({
      where: { id },
      data: { name: trimmed },
      select: { id: true, name: true, fingerprint: true, createdAt: true, privateKeyEnc: true },
    });

    return {
      id: updated.id,
      name: updated.name,
      fingerprint: updated.fingerprint,
      createdAt: updated.createdAt,
      canDownload: !!updated.privateKeyEnc,
    };
  }

  async downloadPrivateKey(id: string, userId: string) {
    const key = await this.prisma.sshKey.findFirst({ where: { id, userId } });
    if (!key) throw new NotFoundException('Key pair no encontrado');
    if (!key.privateKeyEnc) {
      throw new BadRequestException('Esta clave se creó antes de guardar copias. Crea un key pair nuevo.');
    }

    return {
      name: key.name,
      privateKey: this.decrypt(key.privateKeyEnc),
    };
  }

  async remove(id: string, userId: string) {
    const key = await this.prisma.sshKey.findFirst({ where: { id, userId } });
    if (!key) throw new NotFoundException('Key pair no encontrado');
    await this.prisma.sshKey.delete({ where: { id } });
    return { deleted: true };
  }

  async findPublicKey(id: string, userId: string) {
    const key = await this.prisma.sshKey.findFirst({ where: { id, userId } });
    if (!key) throw new NotFoundException('Key pair no encontrado');
    return key;
  }

  private extractOpenSshPublicKey(privateKey: string, comment: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'zyncloud-key-'));
    const keyPath = join(dir, 'key.pem');
    try {
      writeFileSync(keyPath, privateKey, { mode: 0o600 });
      const pub = execSync(`ssh-keygen -y -f "${keyPath}"`, { encoding: 'utf8' }).trim();
      return `${pub} ${comment}`;
    } finally {
      try { unlinkSync(keyPath); rmSync(dir, { recursive: true }); } catch {}
    }
  }
}
