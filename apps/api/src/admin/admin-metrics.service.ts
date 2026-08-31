import { Inject, Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service.js';
import { PaymentsRepository } from '../payments/payments.repository.js';

@Injectable()
export class AdminMetricsService {
  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(PaymentsRepository) private readonly payRepo: PaymentsRepository,
  ) {}

  async overview() {
    const orders = await this.orders.listRecords({ limit: 1000 });
    const allPayments = await this.payRepo.listAll();

    const byStatus: Record<string, number> = {};
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    }

    const paid = orders.filter((o) => o.paidAt);
    const revenueCents = allPayments
      .filter((p) => p.status === 'approved')
      .reduce((s, p) => s + p.amountCents, 0);

    const completed = orders.filter((o) => o.status === 'completed').length;
    const partial = orders.filter(
      (o) => o.status === 'partially_completed',
    ).length;
    const failed = orders.filter((o) => o.status === 'failed').length;
    const failedAfterPaid = orders.filter(
      (o) => o.paidAt && o.status === 'failed',
    ).length;

    const drafts = orders.filter((o) => o.status === 'draft').length;
    const awaiting = orders.filter((o) =>
      ['awaiting_payment', 'payment_pending'].includes(o.status),
    ).length;

    const conversionPaid =
      orders.length > 0 ? paid.length / orders.length : 0;

    // Conta resultados sem montar previews (evita timeout no dashboard)
    const resultsReady = orders.filter((o) =>
      ['completed', 'partially_completed'].includes(o.status),
    ).length;

    return {
      totals: {
        orders: orders.length,
        paid: paid.length,
        completed,
        partial,
        failed,
        failedAfterPaid,
        drafts,
        awaitingPayment: awaiting,
        revenueCents,
        ticketAverageCents:
          paid.length > 0 ? Math.round(revenueCents / paid.length) : 0,
        conversionPaid: Number(conversionPaid.toFixed(4)),
        emailsSent: 0,
        resultsReady,
        payments: allPayments.length,
      },
      byStatus,
      generatedAt: new Date().toISOString(),
      source: 'postgres',
    };
  }
}
