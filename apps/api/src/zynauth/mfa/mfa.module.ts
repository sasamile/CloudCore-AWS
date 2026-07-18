import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MfaService } from './mfa.service';
import { MfaController } from './mfa.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
