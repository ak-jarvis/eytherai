import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  readiness() {
    return {
      status: 'ok',
      service: 'eyther-api',
      scope: 'gov-01-scaffold',
      pii: 'synthetic-only'
    } as const;
  }
}
