import { Controller, Get, UseGuards } from '@nestjs/common';
import { HostConsoleService } from './host-console.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('host-console')
@UseGuards(JwtAuthGuard)
export class HostConsoleController {
  constructor(private hostConsole: HostConsoleService) {}

  @Get('status')
  status() {
    return this.hostConsole.getStatus();
  }
}
