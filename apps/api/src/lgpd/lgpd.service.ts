import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { and, eq, lt, or } from 'drizzle-orm';
import {
  dataDeletionRequests,
  orderPhotos,
  orderQuestionnaires,
  orderResults,
  orderResultImages,
  orders,
  type Db,
} from '@visagismo/db';
import { DB } from '../db/db.module.js';
import { ApiHttpException } from '../common/http-error.js';
import { memoryOrders } from '../orders/orders.memory.js';
import { memoryPhotos } from '../orders/photos.memory.js';
import { memoryResults } from '../generation/results.memory.js';
import { StorageService } from '../storage/storage.service.js';
import { env } from '../config/env.js';
import {
  memoryDeletions,
  type DeletionRequestRecord,
} from './lgpd.memory.js';
import { EmailService } from '../generation/email.service.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class LgpdService {
  constructor(
    @Optional() @Inject(DB) private readonly db: Db | null,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  private async deleteKey(key: string): Promise<boolean> {
    try {
      await this.storage.getProvider().deleteObject(key);
      return true;
    } catch {
      return false;
    }
  }

  async requestDeletion(input: { email: string; orderId?: string }) {
    const email = normalizeEmail(input.email);
    const token = randomBytes(24).toString('base64url');
    const id = randomUUID();
    const now = new Date();
    const row: DeletionRequestRecord = {
      id,
      email,
      orderId: input.orderId ?? null,
      status: 'pending_verify',
      verifyTokenHash: hashToken(token),
      requestedAt: now,
      executeAfter: null,
      executedAt: null,
      resultMeta: null,
    };
    memoryDeletions.save(row);

    if (this.db) {
      try {
        await this.db.insert(dataDeletionRequests).values({
          id,
          email,
          orderId: input.orderId ?? null,
          status: 'pending_verify',
          verifyTokenHash: row.verifyTokenHash,
          requestedAt: now,
        });
      } catch (err) {
        console.warn('lgpd request DB insert failed', err);
      }
    }

    const appUrl = env().appUrl;
    const verifyUrl = `${appUrl}/lgpd/confirmar?id=${id}&token=${token}`;
    await this.email.sendGeneric({
      to: email,
      subject: 'Confirme a exclusão dos seus dados — Visagismo',
      bodyText: [
        'Recebemos um pedido de exclusão de dados (LGPD).',
        '',
        'Se foi você, confirme no link (válido por 48h):',
        verifyUrl,
        '',
        'Se não solicitou, ignore este e-mail.',
        (() => {
          const e = (
            process.env.SUPPORT_EMAIL ||
            process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
            ''
          ).trim();
          return e && !e.includes('dominio.com')
            ? `Suporte: ${e}`
            : 'Suporte: responda este e-mail se precisar de ajuda.';
        })(),
      ].join('\n'),
    });

    return {
      ok: true,
      message:
        'Se o e-mail existir em nossa base, enviaremos instruções de confirmação.',
    };
  }

  async confirmDeletion(input: { id: string; token: string }) {
    let row = memoryDeletions.get(input.id);
    if (!row && this.db) {
      try {
        const [dbRow] = await this.db
          .select()
          .from(dataDeletionRequests)
          .where(eq(dataDeletionRequests.id, input.id))
          .limit(1);
        if (dbRow) {
          row = {
            id: dbRow.id,
            email: dbRow.email,
            orderId: dbRow.orderId,
            status: dbRow.status as DeletionRequestRecord['status'],
            verifyTokenHash: dbRow.verifyTokenHash,
            requestedAt: dbRow.requestedAt,
            executeAfter: dbRow.executeAfter,
            executedAt: dbRow.executedAt,
            resultMeta: (dbRow.resultMeta as Record<string, unknown>) ?? null,
          };
          memoryDeletions.save(row);
        }
      } catch {
        // ignore
      }
    }

    if (!row || !row.verifyTokenHash) {
      throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (row.status === 'executed') {
      return { ok: true, status: row.status };
    }
    if (row.status !== 'pending_verify' && row.status !== 'pending') {
      return { ok: true, status: row.status };
    }
    if (hashToken(input.token) !== row.verifyTokenHash) {
      throw new ApiHttpException('INVALID_TOKEN', HttpStatus.UNAUTHORIZED);
    }

    const ageMs = Date.now() - row.requestedAt.getTime();
    if (ageMs > 48 * 60 * 60 * 1000) {
      throw new ApiHttpException(
        'INVALID_TOKEN',
        HttpStatus.UNAUTHORIZED,
        'Link de confirmação expirado.',
      );
    }

    row.status = 'pending';
    row.executeAfter = new Date(Date.now() + 60 * 60 * 1000);
    memoryDeletions.save(row);

    if (this.db) {
      try {
        await this.db
          .update(dataDeletionRequests)
          .set({
            status: 'pending',
            executeAfter: row.executeAfter,
          })
          .where(eq(dataDeletionRequests.id, row.id));
      } catch (err) {
        console.warn('lgpd confirm DB update failed', err);
      }
    }

    const immediate =
      (process.env.LGPD_EXECUTE_IMMEDIATE ?? 'true').toLowerCase() === 'true';
    if (immediate) {
      await this.executeDeletion(row.id);
      return {
        ok: true,
        status: 'executed',
        message: 'Seus dados foram processados para exclusão.',
      };
    }

    return {
      ok: true,
      status: 'pending',
      message: 'Pedido confirmado. A exclusão será executada em breve.',
    };
  }

  async listAdmin() {
    if (this.db) {
      try {
        const rows = await this.db.select().from(dataDeletionRequests);
        if (rows.length) {
          return rows.map((r) => ({
            id: r.id,
            email: r.email,
            orderId: r.orderId,
            status: r.status,
            requestedAt: r.requestedAt.toISOString(),
            executeAfter: r.executeAfter?.toISOString() ?? null,
            executedAt: r.executedAt?.toISOString() ?? null,
          }));
        }
      } catch {
        // fall through
      }
    }
    return memoryDeletions.list().map((r) => ({
      id: r.id,
      email: r.email,
      orderId: r.orderId,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      executeAfter: r.executeAfter?.toISOString() ?? null,
      executedAt: r.executedAt?.toISOString() ?? null,
    }));
  }

  async executeDeletion(requestId: string) {
    const row = memoryDeletions.get(requestId);
    if (!row) {
      throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (row.status === 'executed') {
      return { ok: true, already: true };
    }

    const email = normalizeEmail(row.email);
    let deletedKeys = 0;
    let ordersTouched = 0;

    const memOrders = memoryOrders
      .listAll()
      .filter(
        (o) =>
          o.customerEmailNormalized === email ||
          (row.orderId != null && o.id === row.orderId),
      );

    for (const order of memOrders) {
      ordersTouched += 1;
      for (const photo of memoryPhotos.listByOrder(order.id)) {
        if (await this.deleteKey(photo.r2Key)) deletedKeys += 1;
      }
      const result = memoryResults.getByOrder(order.id);
      if (result) {
        for (const img of result.images) {
          if (img.r2Key && (await this.deleteKey(img.r2Key))) deletedKeys += 1;
        }
        result.summary = '[REDACTED]';
        result.perceptionAnalysis = '[REDACTED]';
        result.hairRecommendations = '[REDACTED]';
        result.beardRecommendations = '[REDACTED]';
        result.makeupRecommendations = '[REDACTED]';
        result.accessoriesRecommendations = '[REDACTED]';
        result.maintenancePlan = '[REDACTED]';
        result.salonBrief = '[REDACTED]';
        result.images = result.images.map((i) => ({
          ...i,
          r2Key: '',
          dataUrl: undefined,
          caption: '[REDACTED]',
        }));
        memoryResults.save(result);
      }

      const digest = createHash('sha256')
        .update(order.customerEmailNormalized)
        .digest('hex')
        .slice(0, 12);
      order.customerName = 'REDACTED';
      order.customerEmail = `redacted+${digest}@invalid.local`;
      order.customerEmailNormalized = order.customerEmail.toLowerCase();
      order.questionnaire = {};
      order.accessRevokedAt = new Date();
      order.tokenVersion += 1;
      order.deletedAt = new Date();
      memoryOrders.save(order);
    }

    if (this.db) {
      try {
        const dbOrders = await this.db
          .select()
          .from(orders)
          .where(
            row.orderId
              ? eq(orders.id, row.orderId)
              : eq(orders.customerEmailNormalized, email),
          );

        for (const o of dbOrders) {
          ordersTouched += 1;
          const photos = await this.db
            .select()
            .from(orderPhotos)
            .where(eq(orderPhotos.orderId, o.id));
          for (const p of photos) {
            if (await this.deleteKey(p.r2Key)) deletedKeys += 1;
          }
          await this.db
            .delete(orderPhotos)
            .where(eq(orderPhotos.orderId, o.id));

          const [res] = await this.db
            .select()
            .from(orderResults)
            .where(eq(orderResults.orderId, o.id))
            .limit(1);
          if (res) {
            const imgs = await this.db
              .select()
              .from(orderResultImages)
              .where(eq(orderResultImages.orderResultId, res.id));
            for (const img of imgs) {
              if (img.r2Key && (await this.deleteKey(img.r2Key))) {
                deletedKeys += 1;
              }
              if (img.thumbR2Key && (await this.deleteKey(img.thumbR2Key))) {
                deletedKeys += 1;
              }
            }
            await this.db
              .update(orderResultImages)
              .set({
                r2Key: null,
                thumbR2Key: null,
                caption: '[REDACTED]',
              })
              .where(eq(orderResultImages.orderResultId, res.id));

            await this.db
              .update(orderResults)
              .set({
                summary: '[REDACTED]',
                perceptionAnalysis: '[REDACTED]',
                hairRecommendations: '[REDACTED]',
                beardRecommendations: '[REDACTED]',
                makeupRecommendations: '[REDACTED]',
                accessoriesRecommendations: '[REDACTED]',
                maintenancePlan: '[REDACTED]',
                salonBrief: '[REDACTED]',
                rawAnalysisJson: {},
              })
              .where(eq(orderResults.id, res.id));
          }

          await this.db
            .update(orderQuestionnaires)
            .set({ payload: {} })
            .where(eq(orderQuestionnaires.orderId, o.id));

          const digest = createHash('sha256')
            .update(o.customerEmailNormalized)
            .digest('hex')
            .slice(0, 12);
          const redactedEmail = `redacted+${digest}@invalid.local`;
          await this.db
            .update(orders)
            .set({
              customerName: 'REDACTED',
              customerEmail: redactedEmail,
              customerEmailNormalized: redactedEmail,
              accessRevokedAt: new Date(),
              tokenVersion: o.tokenVersion + 1,
              deletedAt: new Date(),
            })
            .where(eq(orders.id, o.id));
        }

        await this.db
          .update(dataDeletionRequests)
          .set({
            status: 'executed',
            executedAt: new Date(),
            resultMeta: { ordersTouched, deletedKeys },
          })
          .where(eq(dataDeletionRequests.id, requestId));
      } catch (err) {
        console.warn('lgpd DB cascade error', err);
      }
    }

    row.status = 'executed';
    row.executedAt = new Date();
    row.resultMeta = { ordersTouched, deletedObjects: deletedKeys };
    memoryDeletions.save(row);

    return { ok: true, ordersTouched, deletedObjects: deletedKeys };
  }

  async runRetentionSweep() {
    const e = env();
    const now = Date.now();
    let expiredOrders = 0;
    let deletedFiles = 0;

    for (const order of memoryOrders.listAll()) {
      if (!order.expiresAt) continue;
      if (order.expiresAt.getTime() > now) continue;
      if (
        ['draft', 'awaiting_payment', 'payment_pending'].includes(order.status)
      ) {
        order.status = 'expired';
        order.updatedAt = new Date();
        memoryOrders.save(order);
        expiredOrders += 1;
      }
    }

    if (this.db) {
      try {
        await this.db
          .update(orders)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(
            and(
              lt(orders.expiresAt, new Date()),
              or(
                eq(orders.status, 'draft'),
                eq(orders.status, 'awaiting_payment'),
                eq(orders.status, 'payment_pending'),
              ),
            ),
          );
      } catch (err) {
        console.warn('retention expire DB failed', err);
      }
    }

    const cutoff = now - e.retentionGeneratedDays * 24 * 60 * 60 * 1000;
    for (const order of memoryOrders.listAll()) {
      const ref = order.deletedAt ?? order.completedAt;
      if (!ref || ref.getTime() > cutoff) continue;
      const result = memoryResults.getByOrder(order.id);
      if (!result) continue;
      for (const img of result.images) {
        if (!img.r2Key) continue;
        if (await this.deleteKey(img.r2Key)) {
          deletedFiles += 1;
          img.r2Key = '';
          img.dataUrl = undefined;
        }
      }
      memoryResults.save(result);
    }

    return {
      ok: true,
      expiredOrders,
      deletedFiles,
      retentionGeneratedDays: e.retentionGeneratedDays,
      retentionOriginalsDays: e.retentionOriginalsDays,
    };
  }
}
