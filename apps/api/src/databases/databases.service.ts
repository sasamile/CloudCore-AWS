import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { Client } from 'pg';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../common/crypto.util';

/**
 * DBaaS: crea un database + rol dedicados en un Postgres gestionado.
 * Requiere credenciales de administrador en DBAAS_ADMIN_URL (con permiso CREATEDB/CREATEROLE).
 * El host que se entrega al usuario es DBAAS_PUBLIC_HOST (por defecto el del admin).
 */
@Injectable()
export class DatabasesService {
  private readonly logger = new Logger(DatabasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private adminUrl(): string {
    const url = process.env.DBAAS_ADMIN_URL || process.env.DATABASE_URL;
    if (!url) {
      throw new ServiceUnavailableException(
        'DBaaS no configurado: define DBAAS_ADMIN_URL (Postgres admin con CREATEDB/CREATEROLE)',
      );
    }
    return url;
  }

  private publicHost(): { host: string; port: number } {
    const admin = new URL(this.adminUrl());
    return {
      host: process.env.DBAAS_PUBLIC_HOST || admin.hostname,
      port: Number(process.env.DBAAS_PUBLIC_PORT || admin.port || 5432),
    };
  }

  private sanitize(name: string): string {
    const safe = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!safe || !/^[a-z]/.test(safe)) {
      throw new BadRequestException('El nombre debe empezar por letra y usar solo a-z, 0-9, _');
    }
    return safe.slice(0, 40);
  }

  async list(userId: string) {
    const dbs = await this.prisma.database.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return dbs.map((d) => ({
      id: d.id,
      name: d.name,
      dbName: d.dbName,
      username: d.username,
      host: d.host,
      port: d.port,
      status: d.status,
      createdAt: d.createdAt,
    }));
  }

  async create(userId: string, name: string) {
    const base = this.sanitize(name);
    const suffix = randomBytes(3).toString('hex');
    const dbName = `zdb_${base}_${suffix}`;
    const username = `zu_${base}_${suffix}`;
    const password = randomBytes(18).toString('base64url');
    const { host, port } = this.publicHost();

    const record = await this.prisma.database.create({
      data: {
        name, dbName, username,
        passwordEnc: encryptSecret(password),
        host, port, userId, status: 'creating',
      },
    });

    const admin = new Client({ connectionString: this.adminUrl() });
    try {
      await admin.connect();
      // Identificadores no admiten placeholders; ya estan saneados. La contrasena via literal escapado.
      await admin.query(`CREATE ROLE "${username}" LOGIN PASSWORD '${password.replace(/'/g, "''")}'`);
      await admin.query(`CREATE DATABASE "${dbName}" OWNER "${username}"`);
      await this.prisma.database.update({ where: { id: record.id }, data: { status: 'ready' } });
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.error(`DBaaS create fallo: ${msg}`);
      await this.prisma.database.update({
        where: { id: record.id },
        data: { status: 'error', error: msg },
      });
      // rollback best-effort
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`).catch(() => undefined);
      await admin.query(`DROP ROLE IF EXISTS "${username}"`).catch(() => undefined);
      throw new BadRequestException(`No se pudo crear la base de datos: ${msg}`);
    } finally {
      await admin.end().catch(() => undefined);
    }

    return {
      id: record.id, name, dbName, username, host, port, status: 'ready',
      connectionString: this.buildConnString(username, password, host, port, dbName),
    };
  }

  async connectionString(userId: string, id: string) {
    const db = await this.prisma.database.findFirst({ where: { id, userId } });
    if (!db) throw new NotFoundException('Base de datos no encontrada');
    const password = decryptSecret(db.passwordEnc);
    return {
      connectionString: this.buildConnString(db.username, password, db.host, db.port, db.dbName),
    };
  }

  async remove(userId: string, id: string) {
    const db = await this.prisma.database.findFirst({ where: { id, userId } });
    if (!db) throw new NotFoundException('Base de datos no encontrada');
    await this.prisma.database.update({ where: { id }, data: { status: 'deleting' } });

    const admin = new Client({ connectionString: this.adminUrl() });
    try {
      await admin.connect();
      // Cortar conexiones activas antes de soltar.
      await admin.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
        [db.dbName],
      ).catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS "${db.dbName}"`);
      await admin.query(`DROP ROLE IF EXISTS "${db.username}"`);
    } catch (e) {
      this.logger.error(`DBaaS delete fallo: ${(e as Error).message}`);
    } finally {
      await admin.end().catch(() => undefined);
    }
    await this.prisma.database.delete({ where: { id } });
    return { ok: true };
  }

  private buildConnString(user: string, pass: string, host: string, port: number, db: string) {
    return `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${db}`;
  }
}
