import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { runGenerationJob } from '@visagismo/generation';
import { assertTransition } from '@visagismo/domain';
import { OrdersService } from '../orders/orders.service.js';
import { StorageService } from '../storage/storage.service.js';
import {
  memoryEmails,
  memoryResults,
  type OrderResultRecord,
  type ResultImageRecord,
} from './results.memory.js';
import { EmailService } from './email.service.js';
import { ApiHttpException } from '../common/http-error.js';
import { toPublicOrder, type OrderRecord } from '../orders/order.types.js';
import { memoryCostLogs } from './cost-logs.memory.js';
import { AdminAuthService } from '../admin/admin-auth.service.js';
import { DB } from '../db/db.module.js';
import type { Db } from '@visagismo/db';
import {
  loadOrderResultFromDb,
  persistOrderResultToDb,
} from './results.persist.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { PhotosService } from '../orders/photos.service.js';
import { AdminSettingsService } from '../admin/admin-settings.service.js';

@Injectable()
export class GenerationService implements OnModuleInit {
  private running = new Set<string>();

  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(DB) private readonly db: Db | null,
    @Inject(PaymentsRepository) private readonly payRepo: PaymentsRepository,
    @Inject(PhotosService) private readonly photos: PhotosService,
    @Inject(AdminSettingsService)
    private readonly settings: AdminSettingsService,
  ) {}

  onModuleInit() {
    // Outbox no Postgres (+ fallback memória)
    setInterval(() => {
      void this.drainOutbox();
    }, 1500);
  }

  async drainOutbox() {
    const pending = await this.payRepo.listUnprocessedOutbox();
    for (const ev of pending) {
      if (ev.eventType !== 'enqueue_generation') {
        await this.payRepo.markOutboxProcessed(ev.id);
        continue;
      }
      const orderId = String(ev.payload.orderId ?? ev.aggregateId);
      await this.payRepo.markOutboxProcessed(ev.id);
      void this.processOrder(orderId, Number(ev.payload.cycle ?? 1));
    }
  }

  /** Immediate trigger after payment Path A (in addition to outbox poll). */
  trigger(orderId: string, cycle = 1) {
    void this.processOrder(orderId, cycle);
  }

  /** Used by worker process / external callers */
  async processOrderExternal(orderId: string, cycle = 1) {
    return this.processOrder(orderId, cycle);
  }

  async processOrder(orderId: string, cycle = 1) {
    if (this.running.has(orderId)) return;
    this.running.add(orderId);

    try {
      const order = await this.orders.getOrderRecord(orderId);
      if (!order) {
        console.warn('generation: order missing', orderId);
        return;
      }

      if (order.status !== 'queued' && order.status !== 'reprocessing') {
        // Allow payment_approved hop2 race: if still payment_approved, move to queued
        if (order.status === 'payment_approved') {
          assertTransition('payment_approved', 'queued');
          order.status = 'queued';
          order.version += 1;
          await this.orders.saveOrder(order);
        } else if (order.status === 'processing') {
          // already claimed
          return;
        } else {
          return;
        }
      }

      // Claim job
      if (order.status === 'queued' || order.status === 'reprocessing') {
        assertTransition(order.status, 'processing');
        order.status = 'processing';
        order.updatedAt = new Date();
        order.version += 1;
        await this.orders.saveOrder(order);
      }

      const snapshot = order.packageSnapshot as
        | { imageCount?: number; name?: string; slug?: string }
        | null;
      // Prioriza snapshot; se ausente/0, usa slug do pedido (Premium=12, não default 3)
      const fromSnap =
        typeof snapshot?.imageCount === 'number' && snapshot.imageCount > 0
          ? snapshot.imageCount
          : null;
      const slug = snapshot?.slug || order.packageSlug;
      const imageCount =
        fromSnap ??
        (slug === 'premium'
          ? 12
          : slug === 'completo'
            ? 6
            : 3);

      console.log(
        JSON.stringify({
          generation: 'image_count_resolved',
          orderId: order.id,
          packageSlug: slug,
          packageName: order.packageName,
          imageCount,
          fromSnapshot: fromSnap,
        }),
      );

      // Foto do cliente (frontal primeiro) — base da simulação (não gerar rosto do zero)
      const referenceImages: Array<{ bytes: Buffer; mime: string }> = [];
      const orderPhotos = await this.photos.listRecordsForOrder(order.id);
      const typeRank: Record<string, number> = {
        frontal: 0,
        lateral: 1,
        extra: 2,
      };
      const sortedPhotos = [...orderPhotos]
        .filter((p) => p.confirmedAt)
        .sort(
          (a, b) => (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9),
        );

      for (const photo of sortedPhotos) {
        try {
          const bytes = await this.storage.getObject(photo.r2Key);
          if (bytes?.length) {
            referenceImages.push({ bytes, mime: photo.mime || 'image/jpeg' });
          }
        } catch {
          // ignore missing refs
        }
      }

      if (!referenceImages.length) {
        console.error(
          JSON.stringify({
            generation: 'abort_no_client_photo',
            orderId: order.id,
            message:
              'Sem foto frontal/lateral no storage — não é possível simular sobre o rosto do cliente.',
          }),
        );
        order.status = 'failed';
        order.failureMessagePublic =
          'Não encontramos suas fotos para gerar as simulações. Reenvie as fotos ou contate o suporte.';
        order.updatedAt = new Date();
        order.version += 1;
        await this.orders.saveOrder(order);
        return;
      }

      console.log(
        JSON.stringify({
          generation: 'client_photo_refs',
          orderId: order.id,
          count: referenceImages.length,
          types: sortedPhotos.map((p) => p.type),
        }),
      );

      const imageSystemPrompt =
        await this.settings.resolveImageSystemPromptForGeneration();

      const jobResult = await runGenerationJob(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          packageName: order.packageName,
          imageCount,
          questionnaire: order.questionnaire,
          cycle,
        },
        {
          referenceImages,
          imageSystemPrompt,
          onCost: (entry) => {
            memoryCostLogs.add({
              id: randomUUID(),
              orderId: entry.orderId,
              phase: entry.phase,
              provider: entry.provider,
              modelId: entry.modelId,
              costUsdMicros: entry.costUsdMicros,
              latencyMs: entry.latencyMs,
              createdAt: new Date(),
            });
          },
        },
      );

      // Persist images to storage
      const imageRecords: ResultImageRecord[] = [];
      for (let i = 0; i < jobResult.images.length; i++) {
        const img = jobResult.images[i]!;
        const ext =
          img.mime === 'image/jpeg'
            ? 'jpg'
            : img.mime === 'image/webp'
              ? 'webp'
              : 'png';
        const key = `generated/${order.id}/${img.styleVariationKey}-${randomUUID().slice(0, 8)}.${ext}`;
        await this.storage.putObject({
          key,
          body: img.buffer,
          mime: img.mime,
        });
        const dataUrl = `data:${img.mime};base64,${img.buffer.toString('base64')}`;
        imageRecords.push({
          id: randomUUID(),
          orderId: order.id,
          r2Key: key,
          thumbR2Key: null,
          styleVariationKey: img.styleVariationKey,
          caption: img.caption,
          provider: img.provider,
          modelId: img.modelId,
          sortOrder: i,
          status: 'ready',
          dataUrl,
        });
      }

      const a = jobResult.analysis.data;
      const result: OrderResultRecord = {
        id: randomUUID(),
        orderId: order.id,
        schemaVersion: 1,
        summary: a.summary,
        perceptionAnalysis: a.perceptionAnalysis,
        hairRecommendations: a.hairRecommendations,
        beardRecommendations: a.beardRecommendations,
        makeupRecommendations: '', // escopo: cabelo + barba only
        accessoriesRecommendations: a.accessoriesRecommendations,
        maintenancePlan: a.maintenancePlan,
        salonBrief: a.salonBrief,
        styleDirections: a.styleDirections,
        disclaimerVersion: a.disclaimerVersion,
        analysisSource: jobResult.analysis.source,
        rawAnalysisJson: jobResult.analysis,
        images: imageRecords,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryResults.save(result);
      if (this.db) {
        try {
          await persistOrderResultToDb(this.db, result);
          console.log(
            JSON.stringify({
              event: 'order_result_persisted',
              orderId: order.id,
              images: result.images.length,
            }),
          );
        } catch (err) {
          console.error(
            'Failed to persist order result to Postgres (lost on redeploy)',
            err,
          );
        }
      }

      // Terminal status
      const from = 'processing' as const;
      assertTransition(from, jobResult.status);
      order.status = jobResult.status;
      if (jobResult.status === 'completed') {
        order.completedAt = new Date();
      }
      if (jobResult.failureMessagePublic) {
        order.failureMessagePublic = jobResult.failureMessagePublic;
      }
      order.updatedAt = new Date();
      order.version += 1;
      await this.orders.saveOrder(order);

      const emailKind =
        jobResult.status === 'completed'
          ? 'success'
          : jobResult.status === 'partially_completed'
            ? 'partial'
            : 'failure';

      await this.email.sendResultReady({
        orderId: order.id,
        orderNumber: order.orderNumber,
        to: order.customerEmail,
        customerName: order.customerName,
        packageName: order.packageName,
        kind: emailKind,
        accessCode: order.accessCode,
      });

      console.log(
        JSON.stringify({
          generation: 'done',
          orderId: order.id,
          status: order.status,
          images: imageRecords.length,
        }),
      );
    } catch (err) {
      console.error('generation failed', orderId, err);
      try {
        const order = await this.orders.getOrderRecord(orderId);
        if (order && order.status === 'processing') {
          order.status = 'failed';
          order.failureMessagePublic =
            'Falha no processamento. Nossa equipe pode reprocessar.';
          order.updatedAt = new Date();
          order.version += 1;
          await this.orders.saveOrder(order);
          await this.email.sendResultReady({
            orderId: order.id,
            orderNumber: order.orderNumber,
            to: order.customerEmail,
            customerName: order.customerName,
            packageName: order.packageName,
            kind: 'failure',
            accessCode: order.accessCode,
          });
        }
      } catch {
        // ignore
      }
    } finally {
      this.running.delete(orderId);
    }
  }

  /**
   * Resultado do pedido.
   * Acesso: cookie order_session (cliente) **ou** Bearer admin (painel).
   */
  async getResult(
    orderId: string,
    sessionJwt: string | undefined,
    adminBearer?: string | undefined,
  ) {
    const order = await this.resolveOrderForResult(
      orderId,
      sessionJwt,
      adminBearer,
    );

    if (order.accessRevokedAt && !adminBearer) {
      throw new ApiHttpException('ACCESS_REVOKED', HttpStatus.FORBIDDEN);
    }

    const allowed = [
      'completed',
      'partially_completed',
      'failed',
      'processing',
      'queued',
      'payment_approved',
    ];
    if (!allowed.includes(order.status) && !adminBearer) {
      throw new ApiHttpException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        'Resultado ainda não disponível para este status.',
      );
    }

    const result = await this.loadResult(orderId);
    // Previews leves em paralelo (timeout individual no storage) — evita 504 no proxy
    const images = result
      ? await mapLimited(result.images, 3, async (img) => ({
          id: img.id,
          styleVariationKey: img.styleVariationKey,
          caption: img.caption,
          provider: img.provider,
          modelId: img.modelId,
          sortOrder: img.sortOrder,
          status: img.status,
          url: await this.storage.resolvePreviewUrl(img.dataUrl || img.r2Key),
        }))
      : [];

    // Fotos originais (frontal/lateral) — admin e cliente autenticado
    const originals = await this.photos.listRecordsForOrder(orderId);
    const originalPhotos = await mapLimited(
      originals.filter((p) => p.confirmedAt),
      2,
      async (p) => ({
        id: p.id,
        type: p.type,
        mime: p.mime,
        bytes: p.bytes,
        width: p.width,
        height: p.height,
        url: await this.storage.resolvePreviewUrl(p.r2Key, p.mime),
      }),
    );

    return {
      order: toPublicOrder(order),
      result: result
        ? {
            summary: result.summary,
            perceptionAnalysis: result.perceptionAnalysis,
            hairRecommendations: result.hairRecommendations,
            beardRecommendations: result.beardRecommendations,
            makeupRecommendations: result.makeupRecommendations,
            accessoriesRecommendations: result.accessoriesRecommendations,
            maintenancePlan: result.maintenancePlan,
            salonBrief: result.salonBrief,
            styleDirections: result.styleDirections,
            disclaimerVersion: result.disclaimerVersion,
            analysisSource: result.analysisSource,
            images,
          }
        : null,
      originalPhotos,
      viewer: adminBearer ? 'admin' : 'customer',
      email: (() => {
        const last = memoryEmails.latest(orderId);
        if (!last) return null;
        return {
          subject: last.subject,
          kind: last.kind,
          resultUrl: last.resultUrl,
          sentAt: last.createdAt.toISOString(),
        };
      })(),
    };
  }

  async loadResult(orderId: string) {
    const mem = memoryResults.getByOrder(orderId);
    if (mem) return mem;
    if (this.db) {
      try {
        const fromDb = await loadOrderResultFromDb(this.db, orderId);
        if (fromDb) {
          memoryResults.save(fromDb);
          return fromDb;
        }
      } catch (err) {
        console.warn('loadOrderResultFromDb failed', err);
      }
    }
    return null;
  }

  /** Payload completo de resultado (admin detail). */
  async formatResultPayload(orderId: string) {
    const result = await this.loadResult(orderId);
    if (!result) return null;
    const images = await mapLimited(result.images, 3, async (img) => ({
      id: img.id,
      styleVariationKey: img.styleVariationKey,
      caption: img.caption,
      provider: img.provider,
      modelId: img.modelId,
      sortOrder: img.sortOrder,
      status: img.status,
      url: await this.storage.resolvePreviewUrl(img.dataUrl || img.r2Key),
    }));
    return {
      summary: result.summary,
      perceptionAnalysis: result.perceptionAnalysis,
      hairRecommendations: result.hairRecommendations,
      beardRecommendations: result.beardRecommendations,
      makeupRecommendations: result.makeupRecommendations,
      accessoriesRecommendations: result.accessoriesRecommendations,
      maintenancePlan: result.maintenancePlan,
      salonBrief: result.salonBrief,
      styleDirections: result.styleDirections,
      disclaimerVersion: result.disclaimerVersion,
      analysisSource: result.analysisSource,
      imageCount: images.length,
      images,
    };
  }

  private async resolveOrderForResult(
    orderId: string,
    sessionJwt: string | undefined,
    adminBearer?: string,
  ): Promise<OrderRecord> {
    if (adminBearer) {
      try {
        await this.adminAuth.verifyAccessToken(adminBearer);
        const order = await this.orders.getOrderRecord(orderId);
        if (!order) {
          throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
        }
        return order;
      } catch (err) {
        if (err instanceof ApiHttpException && err.getStatus() === 404) {
          throw err;
        }
        // Token admin inválido: tenta sessão do pedido
      }
    }
    return this.orders.requireSession(orderId, sessionJwt);
  }
}

/** Concorrência limitada — evita N downloads R2 simultâneos matando a API. */
async function mapLimited<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!, idx);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}
