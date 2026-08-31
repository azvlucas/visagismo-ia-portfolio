import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  assertTransition,
  planPaymentEffect,
  validateCheckout,
} from '@visagismo/domain';
import {
  packageSnapshotSchema,
  type PackageSnapshot,
} from '@visagismo/shared';
import { type Db } from '@visagismo/db';
import { DB } from '../db/db.module.js';
import { ApiHttpException } from '../common/http-error.js';
import { OrdersService } from '../orders/orders.service.js';
import { PhotosService } from '../orders/photos.service.js';
import type { OrderRecord } from '../orders/order.types.js';
import { toPublicOrder } from '../orders/order.types.js';
import {
  getMercadoPagoClient,
  getMockMercadoPagoClient,
  isMercadoPagoConfigured,
  normalizeMpStatus,
  resolvePublicApiUrl,
  resolvePublicAppUrl,
  type MercadoPagoClient,
} from './mercadopago.client.js';
import { type PaymentRecord } from './payments.memory.js';
import { PaymentsRepository } from './payments.repository.js';
import { GenerationService } from '../generation/generation.service.js';
import { enqueueGeneration, isQueueEnabled } from '@visagismo/queue';
import { env } from '../config/env.js';
import { AdminSettingsService } from '../admin/admin-settings.service.js';
import { PackagesService } from '../packages/packages.service.js';

const PAYMENT_TTL_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class PaymentsService {
  private readonly mp: MercadoPagoClient;

  constructor(
    @Inject(DB) private readonly db: Db | null,
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(PhotosService) private readonly photos: PhotosService,
    @Inject(GenerationService) private readonly generation: GenerationService,
    @Inject(PaymentsRepository) private readonly payRepo: PaymentsRepository,
    @Inject(AdminSettingsService)
    private readonly settings: AdminSettingsService,
    @Inject(PackagesService) private readonly packages: PackagesService,
  ) {
    this.mp = getMercadoPagoClient();
  }

  isMockMode() {
    return !isMercadoPagoConfigured();
  }

  paymentsEnabled(): boolean {
    const flag = (process.env.PAYMENTS_ENABLED ?? '').trim().toLowerCase();
    if (flag === 'false' || flag === '0' || flag === 'no' || flag === 'off') {
      return false;
    }
    if (flag === 'true' || flag === '1' || flag === 'yes' || flag === 'on') {
      return true;
    }
    // Default: enabled (mock local works out of the box).
    return true;
  }

  async checkout(orderId: string, sessionJwt: string | undefined) {
    const order = await this.orders.requireSession(orderId, sessionJwt);
    const hasFrontal = await this.photos.hasConfirmedFrontal(orderId);
    const freeGeneration = await this.settings.isFreeGenerationEnabled();

    const guard = validateCheckout({
      status: order.status,
      questionnaireCompletedAt: order.questionnaireCompletedAt,
      hasFrontalPhotoConfirmed: hasFrontal,
      consentPrivacyAt: order.consentPrivacyAt,
      consentImageProcessingAt: order.consentImageProcessingAt,
      ageAttestedAt: order.ageAttestedAt,
      packageActive: true,
      hasPackageSnapshot: Boolean(order.packageSnapshot),
      // Gratuidade bypassa a flag de pagamentos (admin ligou free generation).
      paymentsEnabled: freeGeneration || this.paymentsEnabled(),
    });

    if (!guard.ok) {
      throw new ApiHttpException(guard.code, HttpStatus.BAD_REQUEST);
    }

    // Freeze package snapshot on first checkout (imageCount do pacote real, não default 3)
    await this.ensurePackageSnapshotFrozen(order);

    if (freeGeneration) {
      return this.checkoutFree(order);
    }

    await this.payRepo.supersedeActive(orderId);
    const n = (await this.payRepo.countCheckouts(orderId)) + 1;
    const idempotencyKey = `${orderId}:checkout:${n}`;

    const appUrl = resolvePublicAppUrl();
    const apiUrl = resolvePublicApiUrl();

    if (!appUrl || /localhost|127\.0\.0\.1/.test(appUrl)) {
      if (isMercadoPagoConfigured() && process.env.NODE_ENV === 'production') {
        throw new ApiHttpException(
          'INTERNAL_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
          'APP_URL do site não está configurada (HTTPS público). No Coolify, defina APP_URL=https://seu-dominio.com no serviço API.',
        );
      }
    }
    if (!apiUrl || /localhost|127\.0\.0\.1/.test(apiUrl)) {
      if (isMercadoPagoConfigured() && process.env.NODE_ENV === 'production') {
        throw new ApiHttpException(
          'INTERNAL_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
          'API_PUBLIC_URL não está configurada. Defina a URL pública da API (ex.: https://api.seu-dominio.com) no serviço API.',
        );
      }
    }

    let preference;
    try {
      preference = await this.mp.createPreference({
        orderId: order.id,
        orderNumber: order.orderNumber,
        title: `Visagismo — ${order.packageName}`,
        amountCents: order.packagePriceCents,
        payerEmail: order.customerEmail,
        payerName: order.customerName,
        idempotencyKey,
        successUrl: `${appUrl}/pedido/${order.id}/aguardando?status=success`,
        failureUrl: `${appUrl}/pedido/${order.id}/aguardando?status=failure`,
        pendingUrl: `${appUrl}/pedido/${order.id}/aguardando?status=pending`,
        notificationUrl: `${apiUrl}/v1/webhooks/mercadopago`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('checkout preference error', msg);
      // Mensagem legível no cliente (evita só "Erro HTTP 500")
      if (/auto_return|back_url/i.test(msg)) {
        throw new ApiHttpException(
          'INTERNAL_ERROR',
          HttpStatus.BAD_REQUEST,
          'Pagamento: configure APP_URL com a URL pública HTTPS do site (ex.: https://visagismo.example) no serviço da API. O Mercado Pago exige back_urls.success válido.',
        );
      }
      throw new ApiHttpException(
        'INTERNAL_ERROR',
        HttpStatus.BAD_GATEWAY,
        `Não foi possível iniciar o pagamento. ${msg.slice(0, 280)}`,
      );
    }

    const now = new Date();
    const payment: PaymentRecord = {
      id: randomUUID(),
      orderId: order.id,
      provider: 'mercadopago',
      externalPreferenceId: preference.preferenceId,
      externalPaymentId: null,
      status: 'pending',
      amountCents: order.packagePriceCents,
      idempotencyKey,
      isActiveCheckout: true,
      rawPayload: preference,
      initPoint: preference.initPoint,
      sandboxInitPoint: preference.sandboxInitPoint,
      createdAt: now,
      updatedAt: now,
    };
    await this.payRepo.save(payment);

    // Transition to awaiting_payment
    if (order.status === 'draft') {
      assertTransition('draft', 'awaiting_payment');
      order.status = 'awaiting_payment';
    } else if (order.status === 'payment_pending') {
      assertTransition('payment_pending', 'awaiting_payment');
      order.status = 'awaiting_payment';
    }
    // awaiting_payment re-entry: stay
    order.expiresAt = new Date(now.getTime() + PAYMENT_TTL_MS);
    order.updatedAt = now;
    order.version += 1;
    await this.orders.saveOrder(order);

    return {
      order: toPublicOrder(order),
      payment: {
        id: payment.id,
        status: payment.status,
        amountCents: payment.amountCents,
        preferenceId: payment.externalPreferenceId,
        initPoint: payment.initPoint,
        sandboxInitPoint: payment.sandboxInitPoint,
        mock: preference.mock,
      },
    };
  }

  async handleWebhook(input: {
    body: Record<string, unknown>;
    xSignature?: string;
    xRequestId?: string;
  }) {
    const data = (input.body.data as { id?: string } | undefined) ?? {};
    const dataId =
      data.id != null
        ? String(data.id)
        : input.body['data.id'] != null
          ? String(input.body['data.id'])
          : undefined;

    const topic =
      (input.body.type as string | undefined) ??
      (input.body.topic as string | undefined) ??
      'payment';

    const action = (input.body.action as string | undefined) ?? '';

    const notificationId =
      input.xRequestId ||
      createHash('sha256')
        .update(`${topic}|${dataId ?? ''}|${action}|${JSON.stringify(input.body)}`)
        .digest('hex');

    const inserted = await this.payRepo.tryInsertWebhook({
      id: randomUUID(),
      provider: 'mercadopago',
      notificationId,
      externalPaymentId: dataId ?? null,
      topic,
      payload: input.body,
      processedAt: null,
      processResult: null,
      createdAt: new Date(),
    });

    if (!inserted) {
      return { ok: true, duplicate: true };
    }

    // Signature: for real MP webhooks
    if (isMercadoPagoConfigured()) {
      const ok = this.mp.verifyWebhookSignature({
        xSignature: input.xSignature,
        xRequestId: input.xRequestId,
        dataId,
      });
      if (!ok) {
        await this.payRepo.markWebhookProcessed(
          'mercadopago',
          notificationId,
          'invalid_signature',
        );
        throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
      }
    }

    if (!dataId || (topic !== 'payment' && action && !action.includes('payment'))) {
      // Still process if dataId present
      if (!dataId) {
        await this.payRepo.markWebhookProcessed(
          'mercadopago',
          notificationId,
          'ignored_no_id',
        );
        return { ok: true, ignored: true };
      }
    }

    const result = await this.approveFromExternalPaymentId(dataId!);
    await this.payRepo.markWebhookProcessed(
      'mercadopago',
      notificationId,
      result.applied,
    );
    return { ok: true, ...result };
  }

  async syncPayment(orderId: string, sessionJwt: string | undefined, paymentId?: string) {
    await this.orders.requireSession(orderId, sessionJwt);

    if (paymentId) {
      return this.approveFromExternalPaymentId(paymentId, orderId);
    }

    // Mock convenience: if no paymentId, no-op status
    const order = await this.orders.getOrderRecord(orderId);
    return {
      applied: 'status_only',
      order: order ? toPublicOrder(order) : null,
    };
  }

  /**
   * Mock-only: simulate approved payment for an order.
   */
  async mockApprove(orderId: string, sessionJwt: string | undefined) {
    if (isMercadoPagoConfigured()) {
      throw new ApiHttpException(
        'FORBIDDEN',
        HttpStatus.FORBIDDEN,
        'Mock pay indisponível com MP real configurado.',
      );
    }

    const order = await this.orders.requireSession(orderId, sessionJwt);
    const mock = getMockMercadoPagoClient();
    if (!mock) {
      throw new ApiHttpException('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const paymentId = `mock-pay-${randomUUID()}`;
    mock.registerMockPayment({
      paymentId,
      status: 'approved',
      orderId: order.id,
      amountCents: order.packagePriceCents,
    });

    // Link active payment row
    const active = await this.payRepo.getActiveCheckout(orderId);
    if (active) {
      active.externalPaymentId = paymentId;
      active.status = 'approved';
      active.updatedAt = new Date();
      await this.payRepo.save(active);
    }

    return this.approveFromExternalPaymentId(paymentId, orderId);
  }

  async approveFromExternalPaymentId(
    externalPaymentId: string,
    expectedOrderId?: string,
  ) {
    const details = await this.mp.getPayment(externalPaymentId);
    if (!details) {
      // Mock race: payment not registered
      throw new ApiHttpException(
        'NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Pagamento não encontrado no provedor.',
      );
    }

    const orderId = details.externalReference ?? expectedOrderId;
    if (!orderId) {
      return { applied: 'no_order_ref', order: null };
    }
    if (expectedOrderId && orderId !== expectedOrderId) {
      throw new ApiHttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    const order = await this.orders.getOrderRecord(orderId);
    if (!order) {
      return { applied: 'order_missing', order: null };
    }

    // Upsert payment by external id
    let payment = await this.payRepo.getByExternal(
      'mercadopago',
      externalPaymentId,
    );
    if (!payment) {
      payment = await this.payRepo.getActiveCheckout(orderId);
    }
    if (payment) {
      payment.externalPaymentId = externalPaymentId;
      payment.rawPayload = details.raw;
      payment.updatedAt = new Date();
    }

    const mpStatus = normalizeMpStatus(details.status);
    const plan = planPaymentEffect(order.status, mpStatus);

    if (plan.kind === 'noop') {
      if (payment) await this.payRepo.save(payment);
      return { applied: `noop:${plan.reason}`, order: toPublicOrder(order) };
    }

    if (plan.kind === 'set_payment_pending') {
      assertTransition(order.status, 'payment_pending');
      order.status = 'payment_pending';
      order.updatedAt = new Date();
      order.version += 1;
      if (payment) {
        payment.status = 'pending';
        await this.payRepo.save(payment);
      }
      await this.orders.saveOrder(order);
      return { applied: 'payment_pending', order: toPublicOrder(order) };
    }

    if (plan.kind === 'cancel') {
      assertTransition(order.status, 'cancelled');
      order.status = 'cancelled';
      order.updatedAt = new Date();
      order.version += 1;
      if (payment) {
        payment.status = 'rejected';
        payment.isActiveCheckout = false;
        await this.payRepo.save(payment);
      }
      await this.orders.saveOrder(order);
      return { applied: 'cancelled', order: toPublicOrder(order) };
    }

    if (plan.kind === 'refund') {
      if (order.status !== 'refunded') {
        assertTransition(order.status, 'refunded');
        order.status = 'refunded';
        order.accessRevokedAt = new Date();
        order.tokenVersion += 1;
        order.updatedAt = new Date();
        order.version += 1;
      }
      if (payment) {
        payment.status =
          plan.refundReason === 'chargeback' ? 'charged_back' : 'refunded';
        await this.payRepo.save(payment);
      }
      await this.orders.saveOrder(order);
      return { applied: 'refunded', order: toPublicOrder(order) };
    }

    if (plan.kind === 'path_a_approve') {
      const now = new Date();

      if (
        order.status === 'awaiting_payment' ||
        order.status === 'payment_pending'
      ) {
        assertTransition(order.status, 'payment_approved');
        order.status = 'payment_approved';
        order.paidAt = order.paidAt ?? now;
        order.updatedAt = now;
        order.version += 1;
      }

      if (order.status === 'payment_approved') {
        assertTransition('payment_approved', 'queued');
        order.status = 'queued';
        order.updatedAt = now;
        order.version += 1;

        await this.payRepo.insertOutbox({
          id: randomUUID(),
          aggregateType: 'order',
          aggregateId: order.id,
          eventType: 'enqueue_generation',
          payload: { orderId: order.id, cycle: 1 },
          createdAt: now,
          processedAt: null,
        });
      }

      if (payment) {
        payment.status = 'approved';
        payment.externalPaymentId = externalPaymentId;
        payment.updatedAt = now;
        await this.payRepo.save(payment);
      }

      await this.orders.saveOrder(order);
      // Enqueue generation: BullMQ when Redis available, else in-process.
      const q = await enqueueGeneration(order.id, 1, env().redisUrl);
      if (q.mode === 'inline') {
        this.generation.trigger(order.id, 1);
      } else {
        console.log(
          JSON.stringify({
            generation_enqueue: 'bullmq',
            orderId: order.id,
            jobId: q.jobId,
            redis: isQueueEnabled(env().redisUrl),
          }),
        );
      }
      return { applied: 'path_a_queued', order: toPublicOrder(order) };
    }

    return { applied: 'unknown', order: toPublicOrder(order) };
  }

  /**
   * Aprovação manual pelo admin (falha de webhook/gateway, PIX confirmado fora do fluxo, etc.).
   * Path A: awaiting_payment|payment_pending → payment_approved → queued + enqueue generation.
   */
  async manualApproveByAdmin(
    orderId: string,
    opts?: { note?: string; externalPaymentId?: string },
  ) {
    const order = await this.orders.getOrderRecord(orderId);
    if (!order) {
      throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (
      order.status !== 'awaiting_payment' &&
      order.status !== 'payment_pending'
    ) {
      throw new ApiHttpException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        'Só é possível aprovar pagamento em pedidos com status “Aguardando pagamento” ou “Pagamento pendente”.',
      );
    }

    const now = new Date();
    const note = opts?.note?.trim() || null;
    const externalPaymentId =
      opts?.externalPaymentId?.trim() ||
      `manual-${order.orderNumber}-${now.getTime()}`;

    let payment = await this.payRepo.getActiveCheckout(orderId);
    if (payment) {
      payment.status = 'approved';
      payment.externalPaymentId =
        payment.externalPaymentId || externalPaymentId;
      payment.updatedAt = now;
      payment.rawPayload = {
        ...(typeof payment.rawPayload === 'object' && payment.rawPayload
          ? (payment.rawPayload as object)
          : {}),
        manualApproval: true,
        approvedAt: now.toISOString(),
        note,
      };
      await this.payRepo.save(payment);
    } else {
      payment = {
        id: randomUUID(),
        orderId: order.id,
        provider: 'manual',
        externalPreferenceId: null,
        externalPaymentId,
        status: 'approved',
        amountCents: order.packagePriceCents,
        idempotencyKey: `manual-admin-${order.id}-${now.getTime()}`,
        isActiveCheckout: true,
        rawPayload: {
          manualApproval: true,
          approvedAt: now.toISOString(),
          note,
        },
        initPoint: null,
        sandboxInitPoint: null,
        createdAt: now,
        updatedAt: now,
      };
      await this.payRepo.save(payment);
    }

    assertTransition(order.status, 'payment_approved');
    order.status = 'payment_approved';
    order.paidAt = order.paidAt ?? now;
    order.updatedAt = now;
    order.version += 1;

    assertTransition('payment_approved', 'queued');
    order.status = 'queued';
    order.updatedAt = now;
    order.version += 1;

    await this.payRepo.insertOutbox({
      id: randomUUID(),
      aggregateType: 'order',
      aggregateId: order.id,
      eventType: 'enqueue_generation',
      payload: {
        orderId: order.id,
        cycle: 1,
        source: 'admin_manual_approve',
        note,
      },
      createdAt: now,
      processedAt: null,
    });

    await this.orders.saveOrder(order);

    const q = await enqueueGeneration(order.id, 1, env().redisUrl);
    if (q.mode === 'inline') {
      this.generation.trigger(order.id, 1);
    } else {
      console.log(
        JSON.stringify({
          generation_enqueue: 'bullmq',
          orderId: order.id,
          jobId: q.jobId,
          source: 'admin_manual_approve',
        }),
      );
    }

    console.log(
      JSON.stringify({
        payment: 'admin_manual_approve',
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: payment.id,
        externalPaymentId: payment.externalPaymentId,
        note,
      }),
    );

    return {
      applied: 'manual_path_a_queued',
      order: toPublicOrder(order),
      payment: {
        id: payment.id,
        status: payment.status,
        externalPaymentId: payment.externalPaymentId,
        amountCents: payment.amountCents,
      },
      queue: q.mode,
    };
  }

  /**
   * Checkout gratuito (feature flag admin `free_generation_enabled`).
   * Mesmos guards de foto/consent/questionário; sem Mercado Pago.
   * Path A: payment_approved → queued + enqueue generation.
   */
  private async checkoutFree(order: OrderRecord) {
    const now = new Date();
    await this.payRepo.supersedeActive(order.id);

    const n = (await this.payRepo.countCheckouts(order.id)) + 1;
    const externalPaymentId = `free-${order.orderNumber}-${now.getTime()}`;
    const payment: PaymentRecord = {
      id: randomUUID(),
      orderId: order.id,
      provider: 'free',
      externalPreferenceId: null,
      externalPaymentId,
      status: 'approved',
      amountCents: 0,
      idempotencyKey: `${order.id}:free-checkout:${n}`,
      isActiveCheckout: true,
      rawPayload: {
        freeGeneration: true,
        approvedAt: now.toISOString(),
        source: 'admin_feature_flag',
      },
      initPoint: null,
      sandboxInitPoint: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.payRepo.save(payment);

    // draft | awaiting_payment | payment_pending → payment_approved → queued
    // (Path A: nunca hop único draft → queued)
    if (
      order.status === 'draft' ||
      order.status === 'awaiting_payment' ||
      order.status === 'payment_pending'
    ) {
      if (order.status === 'draft') {
        assertTransition('draft', 'awaiting_payment');
        order.status = 'awaiting_payment';
      }
      assertTransition(order.status, 'payment_approved');
      order.status = 'payment_approved';
      order.paidAt = order.paidAt ?? now;
      order.updatedAt = now;
      order.version += 1;
    }

    if (order.status === 'payment_approved') {
      assertTransition('payment_approved', 'queued');
      order.status = 'queued';
      order.updatedAt = now;
      order.version += 1;

      await this.payRepo.insertOutbox({
        id: randomUUID(),
        aggregateType: 'order',
        aggregateId: order.id,
        eventType: 'enqueue_generation',
        payload: {
          orderId: order.id,
          cycle: 1,
          source: 'free_generation',
        },
        createdAt: now,
        processedAt: null,
      });
    }

    await this.orders.saveOrder(order);

    const q = await enqueueGeneration(order.id, 1, env().redisUrl);
    if (q.mode === 'inline') {
      this.generation.trigger(order.id, 1);
    } else {
      console.log(
        JSON.stringify({
          generation_enqueue: 'bullmq',
          orderId: order.id,
          jobId: q.jobId,
          source: 'free_generation',
        }),
      );
    }

    console.log(
      JSON.stringify({
        payment: 'free_generation_checkout',
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: payment.id,
      }),
    );

    return {
      order: toPublicOrder(order),
      payment: {
        id: payment.id,
        status: payment.status,
        amountCents: 0,
        preferenceId: null,
        initPoint: null,
        sandboxInitPoint: null,
        mock: false,
        free: true,
      },
    };
  }

  /**
   * Garante package_snapshot completo com imageCount do catálogo.
   * Antes: buildSnapshot forçava imageCount=3 (bug: Premium virava Essencial).
   * Também cobre pedidos cujo create não persistiu o snapshot no DB.
   */
  private async ensurePackageSnapshotFrozen(order: OrderRecord): Promise<void> {
    const existing =
      order.packageSnapshot && typeof order.packageSnapshot === 'object'
        ? (order.packageSnapshot as Partial<PackageSnapshot> & {
            imageCount?: number;
          })
        : null;

    const hasValidImageCount =
      typeof existing?.imageCount === 'number' &&
      existing.imageCount > 0 &&
      Number.isFinite(existing.imageCount);

    const slug = existing?.slug || order.packageSlug;
    const expectedBySlug = imageCountBySlug(slug);
    // Stub antigo: slug premium/completo + imageCount forçado em 3
    const looksLikeBrokenDefaultStub =
      hasValidImageCount &&
      existing?.slug &&
      expectedBySlug != null &&
      existing.imageCount === 3 &&
      expectedBySlug > 3;

    // Snapshot confiável: tem imageCount, slug e não é o stub quebrado
    if (
      hasValidImageCount &&
      existing?.slug &&
      !looksLikeBrokenDefaultStub
    ) {
      return;
    }

    // Snapshot parcial do create (imageCount do pacote, sem slug) — completo via catálogo
    // mas preserva imageCount se já for maior que o default
    const snapshot = await this.buildSnapshot(order);
    if (
      hasValidImageCount &&
      existing &&
      !looksLikeBrokenDefaultStub &&
      existing.imageCount! > snapshot.imageCount
    ) {
      snapshot.imageCount = existing.imageCount!;
    }
    if (Array.isArray(existing?.features) && existing!.features!.length) {
      snapshot.features = existing!.features as string[];
    }
    if (typeof existing?.estimatedSlaHours === 'number') {
      snapshot.estimatedSlaHours = existing.estimatedSlaHours;
    }
    order.packageSnapshot = snapshot;
    order.packagePriceCents = snapshot.priceCents;
  }

  private async buildSnapshot(order: OrderRecord): Promise<PackageSnapshot> {
    const fromCatalog = await this.resolvePackageForSnapshot(order);
    const imageCount =
      fromCatalog?.imageCount ??
      imageCountBySlug(order.packageSlug) ??
      3;
    const styleVariationCount =
      fromCatalog?.styleVariationCount ??
      Math.max(2, Math.ceil(imageCount / 2));
    const estimatedSlaHours =
      fromCatalog?.estimatedSlaHours ??
      (order.packageSlug === 'premium'
        ? 12
        : order.packageSlug === 'completo'
          ? 18
          : 24);

    const snapshot: PackageSnapshot = {
      packageId: fromCatalog?.id ?? order.packageId,
      slug: fromCatalog?.slug ?? order.packageSlug,
      name: fromCatalog?.name ?? order.packageName,
      description: fromCatalog?.description ?? '',
      priceCents: fromCatalog?.priceCents ?? order.packagePriceCents,
      currency: 'BRL',
      imageCount,
      styleVariationCount,
      estimatedSlaHours,
      features: Array.isArray(fromCatalog?.features)
        ? (fromCatalog.features as string[])
        : [],
      compareModels: Boolean(fromCatalog?.compareModels),
      promoText: fromCatalog?.promoText ?? null,
      discountPercent: fromCatalog?.discountPercent ?? null,
      models: [],
      frozenAt: new Date().toISOString(),
    };
    packageSnapshotSchema.safeParse(snapshot);
    return snapshot;
  }

  private async resolvePackageForSnapshot(order: OrderRecord) {
    try {
      if (order.packageSlug && order.packageSlug !== 'package') {
        return await this.packages.getBySlug(order.packageSlug);
      }
    } catch {
      // pacote inativo/ausente — tenta catálogo completo
    }
    try {
      const all = await this.packages.listAllCatalog();
      return (
        all.find((p) => p.id === order.packageId) ??
        all.find((p) => p.slug === order.packageSlug) ??
        null
      );
    } catch {
      return null;
    }
  }
}

function imageCountBySlug(slug: string | undefined | null): number | null {
  if (!slug) return null;
  if (slug === 'premium') return 12;
  if (slug === 'completo') return 6;
  if (slug === 'essencial') return 3;
  return null;
}
