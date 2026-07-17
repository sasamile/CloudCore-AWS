import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AccessKeyService } from './access-key.service';
import { ZYN1_PREFIX } from './signing';

/**
 * Autenticacion dual para las rutas de storage:
 *  - Humanos (panel web): Bearer JWT de ZynCloud (passport 'jwt').
 *  - Maquinas/SDK: firma ZYN1 con Access Key/Secret.
 * En ambos casos deja `req.user = { id }`.
 */
@Injectable()
export class StorageAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly accessKeys: AccessKeyService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];

    if (typeof auth === 'string' && auth.startsWith(ZYN1_PREFIX)) {
      const identity = await this.accessKeys.verifyRequest({
        authorization: auth,
        date: req.headers['x-zyn-date'] as string | undefined,
        contentSha: req.headers['x-zyn-content-sha256'] as string | undefined,
        method: req.method,
        path: req.originalUrl.split('?')[0],
      });
      (req as any).user = { id: identity.userId, accessKeyId: identity.accessKeyId };
      return true;
    }

    // Cae al flujo JWT de passport.
    return super.canActivate(context) as Promise<boolean>;
  }
}
