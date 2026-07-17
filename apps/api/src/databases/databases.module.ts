import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DatabasesService } from './databases.service';
import { DatabasesController } from './databases.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DatabasesController],
  providers: [DatabasesService],
  exports: [DatabasesService],
})
export class DatabasesModule {}
