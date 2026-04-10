import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    // Keep a harmless watched-file change available so a fresh Railway build can be forced when needed.
    return {
      success: true,
      data: {
        status: 'ok',
        debugVersion: 'health-debug-v4-order-fix',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
