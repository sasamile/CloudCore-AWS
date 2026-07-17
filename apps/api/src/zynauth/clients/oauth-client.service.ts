import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../../common/crypto.util';

export interface RegisterClientInput {
  name: string;
  redirectUris: string[];
  postLogoutUris?: string[];
  allowedScopes?: string[];
  isPublic?: boolean; // SPA / mobile => solo PKCE, sin secret
}

export interface UpdateClientInput {
  name?: string;
  redirectUris?: string[];
  postLogoutUris?: string[];
  allowedScopes?: string[];
}

@Injectable()
export class OAuthClientService {
  constructor(private readonly prisma: PrismaService) {}

  private mapClient(c: {
    id: string;
    clientId: string;
    name: string;
    redirectUris: string;
    postLogoutUris: string;
    allowedScopes: string;
    isPublic: boolean;
    createdAt: Date;
  }) {
    return {
      id: c.id,
      clientId: c.clientId,
      name: c.name,
      redirectUris: JSON.parse(c.redirectUris) as string[],
      postLogoutUris: JSON.parse(c.postLogoutUris) as string[],
      allowedScopes: c.allowedScopes.split(' ').filter(Boolean),
      isPublic: c.isPublic,
      createdAt: c.createdAt,
    };
  }

  /** Registra una app y devuelve client_id + client_secret (el secret solo se muestra aqui). */
  async register(ownerId: string | null, input: RegisterClientInput) {
    const clientId = `zyn_${randomBytes(12).toString('hex')}`;
    const isPublic = input.isPublic ?? false;
    const plainSecret = isPublic ? null : randomBytes(24).toString('base64url');

    const client = await this.prisma.oAuthClient.create({
      data: {
        clientId,
        name: input.name,
        redirectUris: JSON.stringify(input.redirectUris),
        postLogoutUris: JSON.stringify(input.postLogoutUris ?? []),
        allowedScopes: (input.allowedScopes ?? [
          'openid',
          'profile',
          'email',
          'offline_access',
        ]).join(' '),
        isPublic,
        requirePkce: true,
        clientSecretEnc: plainSecret ? encryptSecret(plainSecret) : null,
        ownerId: ownerId ?? undefined,
      },
    });

    return {
      clientId: client.clientId,
      clientSecret: plainSecret, // null si es cliente publico
      name: client.name,
      redirectUris: input.redirectUris,
      allowedScopes: client.allowedScopes.split(' '),
      isPublic,
    };
  }

  async listForOwner(ownerId: string) {
    const clients = await this.prisma.oAuthClient.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return clients.map((c) => this.mapClient(c));
  }

  private async getOwnedOrThrow(ownerId: string, id: string) {
    const client = await this.prisma.oAuthClient.findFirst({
      where: { id, ownerId },
    });
    if (!client) throw new NotFoundException('App no encontrada');
    return client;
  }

  async updateForOwner(ownerId: string, id: string, input: UpdateClientInput) {
    await this.getOwnedOrThrow(ownerId, id);

    if (input.redirectUris !== undefined && input.redirectUris.length === 0) {
      throw new BadRequestException('Se requiere al menos una redirect URI');
    }

    const updated = await this.prisma.oAuthClient.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.redirectUris !== undefined
          ? { redirectUris: JSON.stringify(input.redirectUris) }
          : {}),
        ...(input.postLogoutUris !== undefined
          ? { postLogoutUris: JSON.stringify(input.postLogoutUris) }
          : {}),
        ...(input.allowedScopes !== undefined
          ? { allowedScopes: input.allowedScopes.join(' ') }
          : {}),
      },
    });

    return this.mapClient(updated);
  }

  async deleteForOwner(ownerId: string, id: string) {
    await this.getOwnedOrThrow(ownerId, id);
    await this.prisma.oAuthClient.delete({ where: { id } });
    return { ok: true };
  }

  async findByClientId(clientId: string) {
    return this.prisma.oAuthClient.findUnique({ where: { clientId } });
  }

  async getOrThrow(clientId: string) {
    const client = await this.findByClientId(clientId);
    if (!client) throw new NotFoundException('client_id desconocido');
    return client;
  }

  /** Valida que redirect_uri este en la lista blanca del cliente. */
  isRedirectAllowed(client: { redirectUris: string }, redirectUri: string) {
    const uris = JSON.parse(client.redirectUris) as string[];
    return uris.includes(redirectUri);
  }

  /** Autentica un cliente confidencial en /token (client_secret). Los publicos pasan solo con PKCE. */
  async authenticateClient(clientId: string, providedSecret?: string) {
    const client = await this.getOrThrow(clientId);
    if (client.isPublic || !client.clientSecretEnc) return client;

    if (!providedSecret) {
      throw new UnauthorizedException('client_secret requerido');
    }
    const real = decryptSecret(client.clientSecretEnc);
    const a = Buffer.from(real);
    const b = Buffer.from(providedSecret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('client_secret invalido');
    }
    return client;
  }
}
