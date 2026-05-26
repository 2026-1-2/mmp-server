import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';

function matchesTopic(pattern: string, topic: string): boolean {
  return pattern.endsWith('.*')
    ? topic.startsWith(pattern.slice(0, -2) + '.')
    : pattern === topic;
}

@Injectable()
@WebSocketGateway({ path: '/ws' })
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly subs = new Map<WebSocket, string[]>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // 날씨 mock — 10분 주기
    setInterval(
      () =>
        this.broadcast('weather.updated', {
          is_flyable: Math.random() > 0.2,
          wind_speed: parseFloat((Math.random() * 12).toFixed(1)),
          temperature: parseFloat((10 + Math.random() * 20).toFixed(1)),
        }),
      10 * 60 * 1000,
    );
  }

  handleConnection(client: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token') ?? '';

    try {
      this.jwt.verify(token, { secret: this.config.get<string>('JWT_SECRET') });
    } catch {
      client.close(1008, 'Unauthorized');
      return;
    }

    this.subs.set(client, []);

    client.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as { action: string; topics?: string[] };
        if (msg.action === 'subscribe' && Array.isArray(msg.topics)) {
          this.subs.set(client, msg.topics);
        }
      } catch {
        // 파싱 실패 무시
      }
    });
  }

  handleDisconnect(client: WebSocket) {
    this.subs.delete(client);
  }

  broadcast(type: string, payload: unknown) {
    const data = JSON.stringify({ type, payload, ts: new Date().toISOString() });
    for (const [client, topics] of this.subs) {
      if (
        client.readyState === WebSocket.OPEN &&
        topics.some((t) => matchesTopic(t, type))
      ) {
        client.send(data);
      }
    }
  }
}
