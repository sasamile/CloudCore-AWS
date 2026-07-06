import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { createHash, generateKeyPairSync } from 'crypto';
import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SshKeysService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.sshKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, fingerprint: true, createdAt: true },
    });
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
        userId,
      },
      select: { id: true, name: true, fingerprint: true, createdAt: true },
    });

    return { ...key, privateKey };
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
