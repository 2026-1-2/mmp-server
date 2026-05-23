import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'fallback-secret'),
    });
  }

  async validate(payload: { sub: number; username: string; role: string }) {
    const user = await this.prisma.user.findUnique({ where: { user_id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return { user_id: user.user_id, username: user.username, role: user.role };
  }
}
