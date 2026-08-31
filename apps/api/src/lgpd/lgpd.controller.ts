import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LgpdService } from './lgpd.service.js';
import { AdminAuthGuard, Roles } from '../admin/admin.guard.js';

const requestSchema = z.object({
  email: z
    .string()
    .min(3)
    .refine((v) => /^[^\s@]+@[^\s@]+$/.test(v), 'E-mail inválido'),
  orderId: z.string().uuid().optional(),
});

const confirmSchema = z.object({
  id: z.string().uuid(),
  token: z.string().min(10),
});

@Controller()
export class LgpdController {
  constructor(@Inject(LgpdService) private readonly lgpd: LgpdService) {}

  @Post('public/data-deletion-requests')
  request(
    @Body(new ZodValidationPipe(requestSchema))
    body: z.infer<typeof requestSchema>,
  ) {
    return this.lgpd.requestDeletion(body);
  }

  @Post('public/data-deletion-requests/confirm')
  confirm(
    @Body(new ZodValidationPipe(confirmSchema))
    body: z.infer<typeof confirmSchema>,
  ) {
    return this.lgpd.confirmDeletion(body);
  }

  @Get('admin/data-deletion-requests')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  list() {
    return this.lgpd.listAdmin();
  }

  @Post('admin/data-deletion-requests/:id/execute')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  execute(@Param('id') id: string) {
    return this.lgpd.executeDeletion(id);
  }

  @Post('admin/retention/run')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  retention() {
    return this.lgpd.runRetentionSweep();
  }
}
