import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { AccessKeyService } from './access-key.service';
import { AccessKeysController } from './access-keys.controller';
import { StorageAuthGuard } from './storage-auth.guard';

/** Credenciales de maquina (Access Keys) + guard de firma ZYN1. */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AccessKeysController],
  providers: [AccessKeyService, StorageAuthGuard],
  exports: [AccessKeyService, StorageAuthGuard],
})
export class CredentialsModule {}
