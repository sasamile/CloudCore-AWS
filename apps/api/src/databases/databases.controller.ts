import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.guard';
import { DatabasesService } from './databases.service';

class CreateDatabaseDto {
  @IsString()
  @MinLength(2)
  name: string;
}

@Controller('databases')
@UseGuards(JwtAuthGuard)
export class DatabasesController {
  constructor(private readonly databases: DatabasesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.databases.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateDatabaseDto) {
    return this.databases.create(user.id, dto.name);
  }

  @Get(':id/connection-string')
  connectionString(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.databases.connectionString(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.databases.remove(user.id, id);
  }
}
