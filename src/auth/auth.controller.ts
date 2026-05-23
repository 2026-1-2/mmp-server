import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';

class LoginDto {
  username: string;
  password: string;
}

class RegisterDto {
  username: string;
  password: string;
  role?: 'VIEWER' | 'OPERATOR' | 'ADMIN';
}

class RefreshDto {
  refresh_token: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: '회원가입 (기본 역할: VIEWER)' })
  @ApiResponse({ status: 201, description: '생성된 사용자 정보' })
  @ApiResponse({ status: 409, description: '중복 사용자' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.username, dto.password, dto.role);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: '로그인 — access_token(30분) + refresh_token(7일) 반환' })
  @ApiResponse({ status: 200, description: '{ access_token, refresh_token }' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Access token 재발급' })
  @ApiResponse({ status: 200, description: '{ access_token }' })
  @ApiResponse({ status: 401, description: '유효하지 않은 refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: '로그아웃 — refresh token 무효화' })
  logout(@Req() req: any) {
    return this.authService.logout(req.user.user_id);
  }
}
