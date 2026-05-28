import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

class LoginDto {
  @ApiProperty({ example: 'admin' }) username: string;
  @ApiProperty({ example: '1234' }) password: string;
}

class RegisterDto {
  @ApiProperty({ example: 'admin' }) username: string;
  @ApiProperty({ example: '1234' }) password: string;
  @ApiPropertyOptional({ enum: ['VIEWER', 'OPERATOR', 'ADMIN'], example: 'VIEWER' })
  role?: 'VIEWER' | 'OPERATOR' | 'ADMIN';
}

class RefreshDto {
  @ApiProperty({ description: '로그인 시 발급받은 refresh_token' }) refresh_token: string;
}

class TokenResponse {
  @ApiProperty() access_token: string;
  @ApiProperty() refresh_token: string;
}

class AccessTokenResponse {
  @ApiProperty() access_token: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: '회원가입', description: '기본 역할은 VIEWER' })
  @ApiResponse({ status: 201, description: '생성된 사용자 정보' })
  @ApiResponse({ status: 409, description: '중복 사용자명' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.username, dto.password, dto.role);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: '로그인', description: 'access_token(30분) + refresh_token(7일) 반환' })
  @ApiResponse({ status: 200, type: TokenResponse })
  @ApiResponse({ status: 401, description: '아이디 또는 비밀번호 불일치' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Access token 재발급', description: 'refresh_token으로 새 access_token 발급' })
  @ApiResponse({ status: 200, type: AccessTokenResponse })
  @ApiResponse({ status: 401, description: '유효하지 않거나 만료된 refresh_token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '현재 로그인 사용자 정보' })
  @ApiResponse({ status: 200, description: 'user_id, username, role' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  me(@Req() req: any) {
    return { user_id: req.user.user_id, username: req.user.username, role: req.user.role };
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: '로그아웃', description: 'refresh_token 무효화' })
  @ApiResponse({ status: 200, description: '{ message: "로그아웃되었습니다." }' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  logout(@Req() req: any) {
    return this.authService.logout(req.user.user_id);
  }
}
