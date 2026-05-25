import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SystemService } from './system.service';

@ApiTags('System')
@Controller()
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('version')
  @Public()
  @ApiOperation({ summary: 'API/DB/MediaMTX 버전 조회' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: { api: '0.0.1', db: 'MySQL 8.0.40', mediamtx: 'v1.9.0' },
      },
    },
  })
  version() {
    return this.systemService.version();
  }

  @Get('health')
  @Public()
  @ApiOperation({ summary: '헬스체크' })
  @ApiResponse({
    status: 200,
    description: 'API/DB/MediaMTX/Storage 상태',
    schema: {
      example: {
        data: { api: 'OK', db: 'OK', mediamtx: 'OK', storage: 'OK' },
      },
    },
  })
  health() {
    return this.systemService.healthCheck();
  }
}
