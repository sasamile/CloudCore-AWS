import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { CurrentUser } from '../auth/auth.guard';
import { StorageAuthGuard } from '../zynauth/credentials/storage-auth.guard';
import { IsString, MinLength } from 'class-validator';

class CreateBucketDto {
  @IsString()
  @MinLength(2)
  name: string;
}

class UploadMetaDto {
  @IsString()
  key: string;
}

@Controller('storage')
@UseGuards(StorageAuthGuard)
export class StorageController {
  constructor(private storage: StorageService) {}

  @Get('buckets')
  listBuckets(@CurrentUser() user: { id: string }) {
    return this.storage.listBuckets(user.id);
  }

  @Post('buckets')
  createBucket(@CurrentUser() user: { id: string }, @Body() dto: CreateBucketDto) {
    return this.storage.createBucket(user.id, dto.name);
  }

  @Delete('buckets/:id')
  deleteBucket(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.storage.deleteBucket(user.id, id);
  }

  @Get('buckets/:id/objects')
  listObjects(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.storage.listObjects(user.id, id);
  }

  @Post('buckets/:id/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: UploadMetaDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('No file uploaded');
    const key = body.key || file.originalname;
    return this.storage.uploadObject(user.id, id, key, file.buffer, file.mimetype);
  }

  @Get('buckets/:bucketId/objects/:objectId/download')
  async download(
    @Param('bucketId') bucketId: string,
    @Param('objectId') objectId: string,
    @CurrentUser() user: { id: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, meta } = await this.storage.getObjectStream(user.id, bucketId, objectId);
    res.set({
      'Content-Type': meta.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${meta.key.split('/').pop()}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete('buckets/:bucketId/objects/:objectId')
  deleteObject(
    @Param('bucketId') bucketId: string,
    @Param('objectId') objectId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.storage.deleteObject(user.id, bucketId, objectId);
  }
}
