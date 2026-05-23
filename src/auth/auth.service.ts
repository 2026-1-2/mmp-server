import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from './decorators/roles.decorator';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(username: string, password: string, role: Role = 'VIEWER') {
    const exists = await this.prisma.user.findUnique({ where: { username } });
    if (exists) throw new ConflictException('이미 존재하는 사용자입니다.');

    const hashed = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { username, password: hashed, role },
    });
    return { user_id: user.user_id, username: user.username, role: user.role };
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    const payload = { sub: user.user_id, username: user.username, role: user.role };
    const access_token = this.jwt.sign(payload, { expiresIn: '30m' });
    const refresh_token = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    await this.prisma.user.update({
      where: { user_id: user.user_id },
      data: { refresh_token: await bcrypt.hash(refresh_token, 10) },
    });

    return { access_token, refresh_token };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: number; username: string; role: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { user_id: payload.sub } });
    if (!user?.refresh_token || !(await bcrypt.compare(refreshToken, user.refresh_token))) {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }

    const newPayload = { sub: user.user_id, username: user.username, role: user.role };
    const access_token = this.jwt.sign(newPayload, { expiresIn: '30m' });
    return { access_token };
  }

  async logout(userId: number) {
    await this.prisma.user.update({
      where: { user_id: userId },
      data: { refresh_token: null },
    });
    return { message: '로그아웃되었습니다.' };
  }
}
