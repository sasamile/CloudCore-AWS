import { Injectable, Logger } from '@nestjs/common';
import * as Docker from 'dockerode';
import { Readable } from 'stream';

@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  getClient(): Docker {
    return this.docker;
  }

  async createContainer(options: {
    name: string;
    image: string;
    memoryLimit: number;
    cpuLimit: number;
    hostPort?: number;
  }) {
    const { name, image, memoryLimit, cpuLimit, hostPort } = options;

    await this.ensureImage(image);

    const portBindings: any = {};
    const exposedPorts: any = {};

    if (hostPort) {
      exposedPorts['3000/tcp'] = {};
      exposedPorts['80/tcp'] = {};
      exposedPorts['22/tcp'] = {};
      portBindings['3000/tcp'] = [{ HostPort: String(hostPort) }];
      portBindings['80/tcp'] = [{ HostPort: String(hostPort + 1) }];
      portBindings['22/tcp'] = [{ HostPort: String(hostPort + 2) }];
    }

    const container = await this.docker.createContainer({
      Image: image,
      name: `zyncloud-${name}`,
      Hostname: name,
      Tty: true,
      OpenStdin: true,
      ExposedPorts: exposedPorts,
      HostConfig: {
        Memory: memoryLimit * 1024 * 1024,
        NanoCpus: Math.floor(cpuLimit * 1e9),
        RestartPolicy: { Name: 'unless-stopped' },
        PortBindings: portBindings,
      },
      Labels: {
        'zyncloud.managed': 'true',
        'zyncloud.name': name,
      },
    });

    return container;
  }

  async startContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  async stopContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    await container.stop();
  }

  async restartContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    await container.restart();
  }

  async removeContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    try {
      await container.stop();
    } catch {}
    await container.remove({ force: true });
  }

  async getContainerInfo(containerId: string) {
    const container = this.docker.getContainer(containerId);
    return container.inspect();
  }

  async getContainerStats(containerId: string) {
    const container = this.docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });
    return this.parseStats(stats);
  }

  async execInContainer(containerId: string, cmd: string[]) {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
    });
    return exec.start({ hijack: true, stdin: true, Tty: true });
  }

  async execDetached(containerId: string, cmd: string[]) {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });
    const stream = await exec.start({ Detach: false, Tty: false });
    return new Promise<string>((resolve) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
      setTimeout(() => resolve(Buffer.concat(chunks).toString()), 5000);
    });
  }

  /** Ejecuta un script bash dentro del contenedor y devuelve stdout+stderr. Para builds/deploys. */
  async runScript(
    containerId: string,
    script: string,
    timeoutMs = 10 * 60 * 1000,
  ): Promise<{ output: string; timedOut: boolean }> {
    const container = this.docker.getContainer(containerId);
    // Usamos Tty:true para evitar el multiplexado binario de stdout/stderr.
    // Con Tty:true el stream es raw text (stdout+stderr mezclados), lo que
    // es perfecto para capturar el output del build/deploy.
    const exec = await container.exec({
      Cmd: ['bash', '-c', script],
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });
    const stream = await exec.start({ Detach: false, Tty: true });
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let done = false;
      const finish = (timedOut: boolean) => {
        if (done) return;
        done = true;
        resolve({ output: Buffer.concat(chunks).toString('utf8'), timedOut });
      };
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => finish(false));
      setTimeout(() => finish(true), timeoutMs);
    });
  }

  async attachToContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['/bin/bash'],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
    });
    return exec;
  }

  async commitContainer(containerId: string, repo: string, tag: string) {
    const container = this.docker.getContainer(containerId);
    return container.commit({ repo, tag });
  }

  async loadImage(tarBuffer: Buffer): Promise<string> {
    const input = Readable.from(tarBuffer);
    return new Promise((resolve, reject) => {
      this.docker.loadImage(input, {}, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          const output = Buffer.concat(chunks).toString();
          const match = output.match(/Loaded image: (.+)/);
          resolve(match?.[1]?.trim() || '');
        });
        stream.on('error', reject);
      });
    });
  }

  streamStats(containerId: string, callback: (stats: any) => void) {
    const container = this.docker.getContainer(containerId);
    container.stats({ stream: true }, (err, stream) => {
      if (err || !stream) return;
      stream.on('data', (data: Buffer) => {
        try {
          const stats = JSON.parse(data.toString());
          callback(this.parseStats(stats));
        } catch {}
      });
    });
  }

  private parseStats(stats: any) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats?.system_cpu_usage || 0);
    const numCpus = stats.cpu_stats.online_cpus || 1;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 1;
    const memoryUsageMb = memoryUsage / (1024 * 1024);
    const memoryLimitMb = memoryLimit / (1024 * 1024);

    const networks = stats.networks || {};
    let rxBytes = 0, txBytes = 0;
    for (const iface of Object.values(networks) as any[]) {
      rxBytes += iface.rx_bytes || 0;
      txBytes += iface.tx_bytes || 0;
    }

    const blkioStats = stats.blkio_stats?.io_service_bytes_recursive || [];
    let blockRead = 0, blockWrite = 0;
    for (const entry of blkioStats) {
      if (entry.op === 'read' || entry.op === 'Read') blockRead += entry.value;
      if (entry.op === 'write' || entry.op === 'Write') blockWrite += entry.value;
    }

    return {
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsageMb: Math.round(memoryUsageMb * 100) / 100,
      memoryLimitMb: Math.round(memoryLimitMb * 100) / 100,
      memoryPercent: Math.round((memoryUsage / memoryLimit) * 10000) / 100,
      networkRxMb: Math.round((rxBytes / (1024 * 1024)) * 100) / 100,
      networkTxMb: Math.round((txBytes / (1024 * 1024)) * 100) / 100,
      blockReadMb: Math.round((blockRead / (1024 * 1024)) * 100) / 100,
      blockWriteMb: Math.round((blockWrite / (1024 * 1024)) * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }

  private async ensureImage(image: string) {
    try {
      await this.docker.getImage(image).inspect();
    } catch {
      this.logger.log(`Pulling image ${image}...`);
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(image, (err: any, stream: any) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (err2: any) => {
            if (err2) reject(err2);
            else resolve();
          });
        });
      });
    }
  }
}
