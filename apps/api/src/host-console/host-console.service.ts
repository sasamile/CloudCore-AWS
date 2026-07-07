import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { readFileSync } from 'fs';
import { Client, ClientChannel } from 'ssh2';

export interface HostConsoleSession {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  close: () => void;
  onData: (cb: (data: string) => void) => void;
  onClose: (cb: () => void) => void;
}

@Injectable()
export class HostConsoleService {
  private readonly logger = new Logger(HostConsoleService.name);

  isEnabled(): boolean {
    return process.env.HOST_CONSOLE_ENABLED === 'true';
  }

  getStatus() {
    const mode = process.env.HOST_CONSOLE_MODE || 'local';
    return {
      enabled: this.isEnabled(),
      mode,
      host:
        mode === 'ssh'
          ? process.env.HOST_CONSOLE_SSH_HOST || '127.0.0.1'
          : 'localhost',
      user: process.env.HOST_CONSOLE_SSH_USER || process.env.USER || 'root',
      label: process.env.HOST_CONSOLE_LABEL || 'ZynCloud Server',
    };
  }

  async openSession(cols = 80, rows = 24): Promise<HostConsoleSession> {
    if (!this.isEnabled()) {
      throw new Error('Host console is disabled. Set HOST_CONSOLE_ENABLED=true');
    }

    const mode = process.env.HOST_CONSOLE_MODE || 'local';
    if (mode === 'ssh') {
      return this.openSshSession(cols, rows);
    }
    return this.openLocalSession();
  }

  private openLocalSession(): Promise<HostConsoleSession> {
    const shell = process.env.SHELL || '/bin/bash';
    const child: ChildProcessWithoutNullStreams = spawn(shell, ['-l'], {
      env: { ...process.env, TERM: 'xterm-256color' },
      cwd: process.env.HOME || '/',
    });

    let dataCb: ((d: string) => void) | null = null;
    let closeCb: (() => void) | null = null;

    child.stdout.on('data', (chunk: Buffer) => dataCb?.(chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => dataCb?.(chunk.toString('utf8')));
    child.on('close', () => closeCb?.());

    this.logger.log(`Local host console started (${shell})`);

    return Promise.resolve({
      write: (data) => child.stdin.write(data),
      resize: () => {},
      close: () => {
        child.kill();
      },
      onData: (cb) => {
        dataCb = cb;
      },
      onClose: (cb) => {
        closeCb = cb;
      },
    });
  }

  private openSshSession(cols: number, rows: number): Promise<HostConsoleSession> {
    const host = process.env.HOST_CONSOLE_SSH_HOST || '127.0.0.1';
    const port = Number(process.env.HOST_CONSOLE_SSH_PORT || 22);
    const username = process.env.HOST_CONSOLE_SSH_USER || 'root';
    const keyPath = process.env.HOST_CONSOLE_SSH_KEY_PATH;

    return new Promise((resolve, reject) => {
      const conn = new Client();
      let stream: ClientChannel | null = null;
      let dataCb: ((d: string) => void) | null = null;
      let closeCb: (() => void) | null = null;

      const config: Record<string, unknown> = { host, port, username };

      if (keyPath) {
        try {
          config.privateKey = readFileSync(keyPath);
        } catch (e) {
          const err = e as NodeJS.ErrnoException;
          const hint =
            err.code === 'EISDIR'
              ? ' (Docker montó un directorio; ejecuta: docker compose down && docker compose up -d)'
              : err.code === 'ENOENT'
                ? ' (la llave no está montada; verifica ./secrets/host_console_key y reinicia el contenedor)'
                : '';
          reject(new Error(`Cannot read SSH key at ${keyPath}${hint}`));
          return;
        }
      } else if (process.env.HOST_CONSOLE_SSH_PASSWORD) {
        config.password = process.env.HOST_CONSOLE_SSH_PASSWORD;
      } else {
        reject(new Error('HOST_CONSOLE_SSH_KEY_PATH or HOST_CONSOLE_SSH_PASSWORD required'));
        return;
      }

      conn
        .on('ready', () => {
          conn.shell(
            { term: 'xterm-256color', cols, rows },
            (err, shellStream) => {
              if (err) {
                conn.end();
                reject(err);
                return;
              }
              stream = shellStream;
              shellStream.on('data', (chunk: Buffer) =>
                dataCb?.(chunk.toString('utf8')),
              );
              shellStream.on('close', () => {
                closeCb?.();
                conn.end();
              });

              this.logger.log(`SSH host console: ${username}@${host}:${port}`);

              resolve({
                write: (data) => stream?.write(data),
                resize: (c, r) => stream?.setWindow(r, c, 0, 0),
                close: () => {
                  stream?.end();
                  conn.end();
                },
                onData: (cb) => {
                  dataCb = cb;
                },
                onClose: (cb) => {
                  closeCb = cb;
                },
              });
            },
          );
        })
        .on('error', (err) => reject(err))
        .connect(config);
    });
  }
}
