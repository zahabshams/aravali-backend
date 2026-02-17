import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../config/prisma.module';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role, region: user.region };

    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: this.jwt.sign(payload, {
        expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '7d'),
      }),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, region: user.region },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = this.jwt.verify(refreshToken);
      const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException();

      const payload = { sub: user.id, email: user.email, role: user.role, region: user.region };
      return {
        accessToken: this.jwt.sign(payload),
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async createUser(data: { email: string; name: string; password: string; role?: string; region?: string }) {
    const hash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: hash,
        role: (data.role as any) || 'SALES',
        region: (data.region as any) || undefined,
      },
      select: { id: true, name: true, email: true, role: true, region: true },
    });
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, region: true, isActive: true },
    });
  }
}
