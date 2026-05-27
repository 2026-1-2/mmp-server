import { Controller, Query, Sse, MessageEvent, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Public } from '../auth/decorators/public.decorator';
import { EventBusService } from './event-bus.service';

function matchesTopic(pattern: string, topic: string): boolean {
  return pattern.endsWith('.*')
    ? topic.startsWith(pattern.slice(0, -2) + '.')
    : pattern === topic;
}

@Controller('sse')
export class SseController {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Sse('events')
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
