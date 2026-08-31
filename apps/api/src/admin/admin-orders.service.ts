import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { assertTransition } from '@visagismo/domain';
import { toPublicOrder } from '../orders/order.types.js';
import { OrdersService } from '../orders/orders.service.js';
import { GenerationService } from '../generation/generation.service.js';
import { ApiHttpException } from '../common/http-error.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PhotosService } from '../orders/photos.service.js';

@Injectable()
export class AdminOrdersService {
  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(GenerationService) private readonly generation: GenerationService,
    @Inject(PaymentsRepository) private readonly payRepo: PaymentsRepository,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(PhotosService) private readonly photos: PhotosService,
  ) {}

  async list(filters: { status?: string; email?: string; q?: string }) {
    // Postgres primeiro — memória some no redeploy
    const rows = await this.orders.listRecords(filters);
    return rows.map((o) => ({
      ...toPublicOrder(o),
      packageSlug: o.packageSlug,
      packageName: o.packageName,
    }));
  }

  async get(id: string) {
    const order = await this.orders.getOrderRecord(id);
    if (!order) {
      throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    const result = await this.generation.loadResult(id);
    const payments = await this.payRepo.listByOrder(id);
    const photos = await this.photos.listRecordsForOrder(id);
    const resultPayload = await this.generation.formatResultPayload(id);
    const photosWithPreview = await this.photos.listWithPreviews(id);
    return {
      order: toPublicOrder(order),
      package: {
        id: order.packageId,
        slug: order.packageSlug,
        name: order.packageName,
        priceCents: order.packagePriceCents,
        snapshot: order.packageSnapshot,
      },
      questionnaire: order.questionnaire,
      photos: photosWithPreview,
      payments: payments.map((p) => ({
        id: p.id,
        status: p.status,
        amountCents: p.amountCents,
        externalPaymentId: p.externalPaymentId,
        externalPreferenceId: p.externalPreferenceId,
        isActiveCheckout: p.isActiveCheckout,
        createdAt: p.createdAt.toISOString(),
      })),
      result: resultPayload,
      resultSummary: result
        ? {
            summary: result.summary,
            analysisSource: result.analysisSource,
            imageCount: result.images.length,
            disclaimerVersion: result.disclaimerVersion,
          }
        : null,
    };
  }

  async reprocess(id: string) {
    const order = await this.orders.getOrderRecord(id);
    if (!order) {
      throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const reprocessable = [
      'completed',
      'partially_completed',
      'failed',
      'queued',
    ];
    if (!reprocessable.includes(order.status) && order.status !== 'processing') {
      // allow completed/failed/partial primarily
      if (
        !['completed', 'partially_completed', 'failed'].includes(order.status)
      ) {
        throw new ApiHttpException(
          'CONFLICT',
          HttpStatus.CONFLICT,
          'Este status não permite reprocessamento.',
        );
      }
    }

    if (
      order.status === 'completed' ||
      order.status === 'partially_completed' ||
      order.status === 'failed'
    ) {
      assertTransition(order.status, 'reprocessing');
      order.status = 'reprocessing';
      order.updatedAt = new Date();
      order.version += 1;
      order.failureMessagePublic = null;
      await this.orders.saveOrder(order);
    }

    const { enqueueGeneration } = await import('@visagismo/queue');
    const { env } = await import('../config/env.js');
    const cycle = Date.now();
    const q = await enqueueGeneration(order.id, cycle, env().redisUrl);
    if (q.mode === 'inline') {
      this.generation.trigger(order.id, cycle);
    }
    return { ok: true, order: toPublicOrder(order), queue: q.mode };
  }

  async cancel(id: string) {
    const order = await this.orders.getOrderRecord(id);
    if (!order) {
      throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (
      ['completed', 'refunded', 'cancelled', 'expired'].includes(order.status)
    ) {
      throw new ApiHttpException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        'Pedido não pode ser cancelado neste status.',
      );
    }
    assertTransition(order.status, 'cancelled');
    order.status = 'cancelled';
    order.updatedAt = new Date();
    order.version += 1;
    order.abortRequestedAt = new Date();
    await this.orders.saveOrder(order);
    return { ok: true, order: toPublicOrder(order) };
  }

  /**
   * Confirma pagamento manualmente e enfileira geração (Path A).
   * Use quando o gateway falhou mas o pagamento foi verificado (ex.: extrato MP).
   */
  async approvePayment(
    id: string,
    input?: { note?: string; externalPaymentId?: string },
  ) {
    return this.payments.manualApproveByAdmin(id, input);
  }
}
