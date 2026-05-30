import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { EventsService } from './events.service';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Roles('VIEWER', 'OPERATOR', 'ADMIN')
  @ApiOperation({ summary: '감지 이벤트 목록 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'size', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: '페이지네이션된 감지 이벤트 목록',
    schema: {
      example: {
        total: 42,
        page: 1,
        size: 20,
        data: [
          {
            event_id: 1,
            camera_id: 3,
            camera_ip: '192.168.0.101',
            image_url: '/cam-images/192.168.0.101/1748650000000.jpg',
            severity: 'CRITICAL',
            detected_at: '2026-05-31T10:00:00.000Z',
          },
        ],
      },
    },
  })
  list(
    @Query('page') page = '1',
    @Query('size') size = '20',
  ) {
    return this.eventsService.list(Number(page), Number(size));
  }
}
