/** Cliente REST minimo hacia la API de ZynCloud, autenticado con un token de usuario. */
export interface ZynCloudApiOptions {
  baseUrl: string;
  token: string; // JWT de usuario de ZynCloud (/auth/login)
}

export class ZynCloudApi {
  private readonly baseUrl: string;

  constructor(private readonly opts: ZynCloudApiOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.opts.token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) {
      throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }

  listInstances() {
    return this.call('GET', '/instances');
  }
  createInstance(input: { name: string; memoryLimit?: number; cpuLimit?: number }) {
    return this.call('POST', '/instances', input);
  }
  startInstance(id: string) {
    return this.call('POST', `/instances/${id}/start`);
  }
  stopInstance(id: string) {
    return this.call('POST', `/instances/${id}/stop`);
  }
  listBuckets() {
    return this.call('GET', '/storage/buckets');
  }
  createBucket(name: string) {
    return this.call('POST', '/storage/buckets', { name });
  }
  listDatabases() {
    return this.call('GET', '/databases');
  }
  createDatabase(name: string) {
    return this.call('POST', '/databases', { name });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
