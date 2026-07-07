import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { createReadStream, existsSync } from 'fs';

@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(private prisma: PrismaService) {
    this.root = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
  }

  private bucketPath(userId: string, bucketName: string) {
    return path.join(this.root, userId, bucketName);
  }

  private objectPath(userId: string, bucketName: string, key: string) {
    return path.join(this.bucketPath(userId, bucketName), key);
  }

  async listBuckets(userId: string) {
    const buckets = await this.prisma.storageBucket.findMany({
      where: { userId },
      include: { _count: { select: { objects: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return buckets.map((b) => ({
      id: b.id,
      name: b.name,
      createdAt: b.createdAt,
      objectCount: b._count.objects,
    }));
  }

  async createBucket(userId: string, name: string) {
    const safe = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!safe) throw new ConflictException('Nombre de bucket inválido');

    const bucket = await this.prisma.storageBucket.create({
      data: { name: safe, userId },
    });
    await fsp.mkdir(this.bucketPath(userId, safe), { recursive: true });
    return bucket;
  }

  async deleteBucket(userId: string, id: string) {
    const bucket = await this.prisma.storageBucket.findFirst({ where: { id, userId } });
    if (!bucket) throw new NotFoundException('Bucket no encontrado');

    await fsp.rm(this.bucketPath(userId, bucket.name), { recursive: true, force: true });
    await this.prisma.storageBucket.delete({ where: { id } });
    return { ok: true };
  }

  async listObjects(userId: string, bucketId: string) {
    const bucket = await this.prisma.storageBucket.findFirst({ where: { id: bucketId, userId } });
    if (!bucket) throw new NotFoundException('Bucket no encontrado');

    return this.prisma.storageObject.findMany({
      where: { bucketId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadObject(
    userId: string,
    bucketId: string,
    key: string,
    buffer: Buffer,
    mimeType?: string,
  ) {
    const bucket = await this.prisma.storageBucket.findFirst({ where: { id: bucketId, userId } });
    if (!bucket) throw new NotFoundException('Bucket no encontrado');

    const safeKey = key.replace(/\.\./g, '').replace(/^\/+/, '');
    const filePath = this.objectPath(userId, bucket.name, safeKey);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, buffer);

    return this.prisma.storageObject.upsert({
      where: { bucketId_key: { bucketId, key: safeKey } },
      create: {
        bucketId,
        key: safeKey,
        size: buffer.length,
        mimeType: mimeType || 'application/octet-stream',
      },
      update: {
        size: buffer.length,
        mimeType: mimeType || 'application/octet-stream',
      },
    });
  }

  async deleteObject(userId: string, bucketId: string, objectId: string) {
    const obj = await this.prisma.storageObject.findFirst({
      where: { id: objectId, bucket: { id: bucketId, userId } },
      include: { bucket: true },
    });
    if (!obj) throw new NotFoundException('Objeto no encontrado');

    const filePath = this.objectPath(userId, obj.bucket.name, obj.key);
    await fsp.unlink(filePath).catch(() => {});
    await this.prisma.storageObject.delete({ where: { id: objectId } });
    return { ok: true };
  }

  getObjectStream(userId: string, bucketId: string, objectId: string) {
    return this.prisma.storageObject
      .findFirst({
        where: { id: objectId, bucket: { id: bucketId, userId } },
        include: { bucket: true },
      })
      .then((obj) => {
        if (!obj) throw new NotFoundException('Objeto no encontrado');
        const filePath = this.objectPath(userId, obj.bucket.name, obj.key);
        if (!existsSync(filePath)) throw new NotFoundException('Archivo no encontrado en disco');
        return { stream: createReadStream(filePath), meta: obj };
      });
  }
}
