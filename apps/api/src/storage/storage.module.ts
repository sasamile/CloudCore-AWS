import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CredentialsModule } from '../zynauth/credentials/credentials.module';

@Module({
  imports: [PrismaModule, AuthModule, CredentialsModule],
  controllers: [StorageController],
  providers: [StorageService],
})
export class StorageModule {}
