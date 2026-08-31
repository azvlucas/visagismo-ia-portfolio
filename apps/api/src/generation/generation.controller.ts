import { Controller, Get, Headers, Inject, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { GenerationService } from './generation.service.js';

const COOKIE_NAME = 'order_session';

@Controller('public/orders')
export class GenerationController {
  constructor(
    @Inject(GenerationService) private readonly generation: GenerationService,
  ) {}

  @Get(':id/result')
  getResult(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('authorization') authorization?: string,
  ) {
    const adminBearer =
      authorization?.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : undefined;
    return this.generation.getResult(
      id,
      this.readSession(req),
      adminBearer || undefined,
    );
  }

  private readSession(req: Request): string | undefined {
    const raw = req.cookies?.[COOKIE_NAME];
    return typeof raw === 'string' ? raw : undefined;
  }
}
