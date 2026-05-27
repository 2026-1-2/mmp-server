import { Controller, Query, Sse, MessageEvent, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Public } from '../auth/decorators/public.decorator';
import { EventBusService } from './event-bus.service';

function matchesTopic(pattern: string, topic: string): boolean {
  return pattern.endsWith('.*')
    ? topic.startsWith(pattern.slice(0, -2) + '.')
    : pattern === topic;
}

@ApiTags('SSE')
@Controller('sse')
export class SseController {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Sse('events')
  @ApiOperation({ summary: '실시간 이벤트 구독 (SSE)' })
  @ApiProduces('text/event-stream')
  @ApiQuery({ name: 'token', required: true, description: 'JWT 액세스 토큰' })
  @ApiQuery({
    name: 'topics',
    required: false,
    description: '구독할 topic 목록 (콤마 구분). 와일드카드 지원: event.* / weather.* / 생략 시 전체 수신',
    example: 'event.*,weather.updated',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE 스트림 연결 성공. 이하 이벤트가 text/event-stream 형식으로 전송됨',
    schema: {
      example: {
        type: 'event.created',
        payload: {
          event_id: 1748253600000,
          camera_id: 1,
          severity: 'CRITICAL',
          object_type: 'person',
          confidence: 0.95,
          detected_at: '2026-05-27T10:00:00.000Z',
        },
        ts: '2026-05-27T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'token 누락 또는 유효하지 않음' })
  stream(
    @Query('token') token: string,
    @Query('topics') topicsParam: string,
  ): Observable<MessageEvent> {
    try {
      this.jwt.verify(token, { secret: this.config.get<string>('JWT_SECRET') });
    } catch {
      throw new UnauthorizedException();
    }

    const topics = topicsParam?.split(',').filter(Boolean) ?? [];

    return this.eventBus.events$.pipe(
      filter(({ type }) => topics.length === 0 || topics.some((t) => matchesTopic(t, type))),
      map(({ type, payload }) => ({
        data: { type, payload, ts: new Date().toISOString() },
      })),
    );
  }
}
