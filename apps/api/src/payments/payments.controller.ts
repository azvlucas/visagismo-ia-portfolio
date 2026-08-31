import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service.js';

const COOKIE_NAME = 'order_session';

@Controller()
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post('public/orders/:id/checkout')
  checkout(@Param('id') id: string, @Req() req: Request) {
    return this.payments.checkout(id, this.readSession(req));
  }

  @Post('public/orders/:id/sync-payment')
  syncPayment(
    @Param('id') id: string,
    @Body() body: { paymentId?: string },
    @Req() req: Request,
  ) {
    return this.payments.syncPayment(id, this.readSession(req), body?.paymentId);
  }

  /** Dev/mock only — simulate approved payment. */
  @Post('public/orders/:id/mock-approve')
  mockApprove(@Param('id') id: string, @Req() req: Request) {
    return this.payments.mockApprove(id, this.readSession(req));
  }

  @Post('webhooks/mercadopago')
  webhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') xSignature?: string,
    @Headers('x-request-id') xRequestId?: string,
  ) {
    return this.payments.handleWebhook({ body, xSignature, xRequestId });
  }

  private readSession(req: Request): string | undefined {
    const raw = req.cookies?.[COOKIE_NAME];
    return typeof raw === 'string' ? raw : undefined;
  }
}
