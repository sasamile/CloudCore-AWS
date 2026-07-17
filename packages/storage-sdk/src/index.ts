import { createHmac, createHash } from 'node:crypto';

/**
 * @zyncloud/storage — SDK para el object storage de ZynCloud.
 *
 * Uso:
 *   import { ZynStorage } from '@zyncloud/storage';
 *   const s = new ZynStorage({
 *     endpoint: 'https://apizyncloud.suescun.sbs',
 *     accessKeyId: 'ZYNAK...',
 *     secretAccessKey: '...',
 *   });
 *   const bucket = await s.createBucket('mi-app');
 *   await s.putObject(bucket.id, 'hola.txt', 'contenido');
 */

const ZYN1_PREFIX = 'ZYN1-HMAC-SHA256';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

export interface ZynStorageOptions {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface Bucket {
  id: string;
  name: string;
  createdAt: string;
  objectCount?: number;
}

export interface StorageObject {
  id: string;
  key: string;
  size: number;
  mimeType?: string | null;
  createdAt: string;
}

export class ZynStorageError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ZynStorageError';
  }
}

export class ZynStorage {
  private readonly endpoint: string;

  constructor(private readonly opts: ZynStorageOptions) {
    this.endpoint = opts.endpoint.replace(/\/+$/, '');
  }

  // --- Buckets ---------------------------------------------------------------
  createBucket(name: string): Promise<Bucket> {
    return this.request('POST', '/storage/buckets', { json: { name } });
  }

  listBuckets(): Promise<Bucket[]> {
    return this.request('GET', '/storage/buckets');
  }

  deleteBucket(bucketId: string): Promise<{ ok: boolean }> {
    return this.request('DELETE', `/storage/buckets/${bucketId}`);
  }

  // --- Objetos ---------------------------------------------------------------
  listObjects(bucketId: string): Promise<StorageObject[]> {
    return this.request('GET', `/storage/buckets/${bucketId}/objects`);
  }

  async putObject(
    bucketId: string,
    key: string,
    data: Buffer | Uint8Array | string,
    contentType = 'application/octet-stream',
  ): Promise<StorageObject> {
    const bytes = typeof data === 'string' ? Buffer.from(data) : data;
    const form = new FormData();
    form.append('key', key);
    form.append('file', new Blob([bytes], { type: contentType }), key.split('/').pop() || key);
    // multipart: firmamos con UNSIGNED-PAYLOAD (el body es un stream multipart).
    return this.request('POST', `/storage/buckets/${bucketId}/upload`, {
      body: form,
      contentSha: UNSIGNED_PAYLOAD,
    });
  }

  async getObject(bucketId: string, objectId: string): Promise<Buffer> {
    const path = `/storage/buckets/${bucketId}/objects/${objectId}/download`;
    const res = await fetch(`${this.endpoint}${path}`, {
      method: 'GET',
      headers: this.signedHeaders('GET', path, this.sha256Hex('')),
    });
    if (!res.ok) throw new ZynStorageError(`GET ${path} -> ${res.status}`, res.status);
    return Buffer.from(await res.arrayBuffer());
  }

  deleteObject(bucketId: string, objectId: string): Promise<{ ok: boolean }> {
    return this.request('DELETE', `/storage/buckets/${bucketId}/objects/${objectId}`);
  }

  // --- interno ---------------------------------------------------------------
  private async request(
    method: string,
    path: string,
    opts: { json?: unknown; body?: BodyInit; contentSha?: string } = {},
  ): Promise<any> {
    let body: BodyInit | undefined = opts.body;
    let contentSha = opts.contentSha ?? this.sha256Hex('');
    const headers: Record<string, string> = {};

    if (opts.json !== undefined) {
      const raw = JSON.stringify(opts.json);
      body = raw;
      contentSha = this.sha256Hex(raw);
      headers['content-type'] = 'application/json';
    }

    Object.assign(headers, this.signedHeaders(method, path, contentSha));

    const res = await fetch(`${this.endpoint}${path}`, { method, headers, body });
    const text = await res.text();
    const parsed = text ? safeJson(text) : undefined;
    if (!res.ok) {
      throw new ZynStorageError(
        `${method} ${path} -> ${res.status}`,
        res.status,
        parsed ?? text,
      );
    }
    return parsed;
  }

  private signedHeaders(method: string, path: string, contentSha: string): Record<string, string> {
    const date = new Date().toISOString();
    const canonical = `${method.toUpperCase()}\n${path}\n${date}\n${contentSha}`;
    const signature = createHmac('sha256', this.opts.secretAccessKey)
      .update(canonical)
      .digest('hex');
    return {
      authorization: `${ZYN1_PREFIX} Credential=${this.opts.accessKeyId}, Signature=${signature}`,
      'x-zyn-date': date,
      'x-zyn-content-sha256': contentSha,
    };
  }

  private sha256Hex(data: Buffer | string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
