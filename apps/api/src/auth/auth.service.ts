import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MfaService } from '../zynauth/mfa/mfa.service';

const MFA_TICKET_TYP = 'zyncloud-mfa';
const MFA_TICKET_TTL = '5m';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mfa: MfaService,
  ) {}

  async register(email: string, password: string, name: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('El email ya esta registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    return this.generateToken(user.id, user.email);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (!user.password) {
      throw new UnauthorizedException('Esta cuenta usa inicio de sesión con Google');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (user.mfaEnabled) {
      return {
        mfaRequired: true as const,
        mfaTicket: await this.createMfaTicket(user.id),
      };
    }

    return this.generateToken(user.id, user.email);
  }

  /** Completa el login tras verificar TOTP / codigo de respaldo. */
  async completeMfa(ticket: string, code: string) {
    const userId = await this.verifyMfaTicket(ticket);
    if (!userId) {
      throw new UnauthorizedException('Sesion MFA expirada. Vuelve a iniciar sesion.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled) {
      throw new UnauthorizedException('MFA no esta activo para esta cuenta');
    }

    const ok = await this.mfa.verifyForUser(user, code);
    if (!ok) {
      throw new BadRequestException('Codigo invalido');
    }

    return this.generateToken(user.id, user.email);
  }

  /**
   * Tras Google OAuth: si el usuario tiene MFA, devolver ticket en vez de access_token.
   */
  async sessionAfterExternalLogin(userId: string, email: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (user.mfaEnabled) {
      return {
        mfaRequired: true as const,
        mfaTicket: await this.createMfaTicket(user.id),
        email: user.email,
      };
    }
    return {
      mfaRequired: false as const,
      access_token: this.tokenForUser(userId, email),
    };
  }

  tokenForUser(userId: string, email: string) {
    return this.generateToken(userId, email).access_token;
  }

  async createMfaTicket(userId: string): Promise<string> {
    return this.jwtService.sign(
      { typ: MFA_TICKET_TYP, sub: userId },
      { expiresIn: MFA_TICKET_TTL },
    );
  }

  async verifyMfaTicket(ticket: string): Promise<string | null> {
    try {
      const payload = this.jwtService.verify<{ typ?: string; sub?: string }>(ticket);
      if (payload.typ !== MFA_TICKET_TYP || typeof payload.sub !== 'string') {
        return null;
      }
      return payload.sub;
    } catch {
      return null;
    }
  }

  private generateToken(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
