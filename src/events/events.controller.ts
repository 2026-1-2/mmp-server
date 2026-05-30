import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Roles('VIEWER', 'OPERATOR', 'ADMIN')
  @ApiOperation({ summary: '감지 이벤트 목록 조회' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'size', required: false, example: 20 })
  list(
    @Query('page') page = '1',
    @Query('size') size = '20',
  ) {
    return this.eventsService.list(Number(page), Number(size));
  }
}
