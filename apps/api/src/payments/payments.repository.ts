import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  outboxEvents,
  paymentWebhookEvents,
  payments,
  type Db,
} from '@visagismo/db';
import { DB } from '../db/db.module.js';
import type {
  OutboxRecord,
  PaymentRecord,
  PaymentRowStatus,
  WebhookEventRecord,
} from './payments.memory.js';
import {
  memoryOutbox,
  memoryPayments,
  memoryWebhooks,
} from './payments.memory.js';

function requireDbInProd() {
  return (
    process.env.REQUIRE_DB === 'true' || process.env.NODE_ENV === 'production'
  );
}

function mapPayment(row: typeof payments.$inferSelect): PaymentRecord {
  const raw = (row.rawPayload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider,
    externalPreferenceId: row.externalPreferenceId,
    externalPaymentId: row.externalPaymentId,
    status: row.status as PaymentRowStatus,
    amountCents: row.amountCents,
    idempotencyKey: row.idempotencyKey,
    isActiveCheckout: row.isActiveCheckout,
    rawPayload: row.rawPayload,
    initPoint: typeof raw.initPoint === 'string' ? raw.initPoint : null,
    sandboxInitPoint:
      typeof raw.sandboxInitPoint === 'string' ? raw.sandboxInitPoint : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Fonte da verdade: Postgres. Memória só como cache opcional.
 */
@Injectable()
export class PaymentsRepository {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  async save(p: PaymentRecord): Promise<void> {
    memoryPayments.save(p);
    if (!this.db) {
      if (requireDbInProd()) {
        throw new Error('PaymentsRepository.save: DATABASE_URL ausente');
      }
      return;
    }

    const rawPayload = {
      ...(typeof p.rawPayload === 'object' && p.rawPayload
        ? (p.rawPayload as object)
        : {}),
      initPoint: p.initPoint,
      sandboxInitPoint: p.sandboxInitPoint,
    };

    try {
      await this.db
        .insert(payments)
        .values({
          id: p.id,
          orderId: p.orderId,
          provider: p.provider,
          externalPreferenceId: p.externalPreferenceId,
          externalPaymentId: p.externalPaymentId,
          status: p.status,
          amountCents: p.amountCents,
          idempotencyKey: p.idempotencyKey,
          isActiveCheckout: p.isActiveCheckout,
          rawPayload,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })
        .onConflictDoUpdate({
          target: payments.id,
          set: {
            externalPreferenceId: p.externalPreferenceId,
            externalPaymentId: p.externalPaymentId,
            status: p.status,
            amountCents: p.amountCents,
            isActiveCheckout: p.isActiveCheckout,
            rawPayload,
            updatedAt: p.updatedAt,
          },
        });
    } catch (err) {
      console.error('payments.save DB failed', err);
      if (requireDbInProd()) throw err;
    }
  }

  async listByOrder(orderId: string): Promise<PaymentRecord[]> {
    if (this.db) {
      try {
        const rows = await this.db
          .select()
          .from(payments)
          .where(eq(payments.orderId, orderId));
        const list = rows.map(mapPayment);
        for (const p of list) memoryPayments.save(p);
        return list;
      } catch (err) {
        console.warn('payments.listByOrder DB failed', err);
      }
    }
    return memoryPayments.listByOrder(orderId);
  }

  async countCheckouts(orderId: string): Promise<number> {
    if (this.db) {
      try {
        const [row] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(payments)
          .where(eq(payments.orderId, orderId));
        return row?.count ?? 0;
      } catch {
        // fall through
      }
    }
    return memoryPayments.countCheckouts(orderId);
  }

  async supersedeActive(orderId: string): Promise<void> {
    if (this.db) {
      try {
        await this.db
          .update(payments)
          .set({ isActiveCheckout: false, updatedAt: new Date() })
          .where(
            and(
              eq(payments.orderId, orderId),
              eq(payments.isActiveCheckout, true),
            ),
          );
      } catch (err) {
        console.warn('payments.supersedeActive DB failed', err);
      }
    }
    memoryPayments.supersedeActive(orderId);
  }

  async getByExternal(
    provider: string,
    externalPaymentId: string,
  ): Promise<PaymentRecord | null> {
    if (this.db) {
      try {
        const [row] = await this.db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.provider, provider),
              eq(payments.externalPaymentId, externalPaymentId),
            ),
          )
          .limit(1);
        if (row) {
          const p = mapPayment(row);
          memoryPayments.save(p);
          return p;
        }
      } catch (err) {
        console.warn('payments.getByExternal DB failed', err);
      }
    }
    return memoryPayments.getByExternal(provider, externalPaymentId);
  }

  async getActiveCheckout(orderId: string): Promise<PaymentRecord | null> {
    const list = await this.listByOrder(orderId);
    return list.find((p) => p.isActiveCheckout) ?? null;
  }

  async listAll(): Promise<PaymentRecord[]> {
    if (this.db) {
      try {
        const rows = await this.db.select().from(payments);
        return rows.map(mapPayment);
      } catch (err) {
        console.warn('payments.listAll DB failed', err);
      }
    }
    return [];
  }

  // ─── Webhooks ──────────────────────────────────────────

  async tryInsertWebhook(ev: WebhookEventRecord): Promise<boolean> {
    if (this.db) {
      try {
        await this.db.insert(paymentWebhookEvents).values({
          id: ev.id,
          provider: ev.provider,
          notificationId: ev.notificationId,
          externalPaymentId: ev.externalPaymentId,
          topic: ev.topic,
          payload: ev.payload as object,
          processedAt: ev.processedAt,
          processResult: ev.processResult,
          createdAt: ev.createdAt,
        });
        memoryWebhooks.tryInsert(ev);
        return true;
      } catch (err) {
        // unique violation = duplicate
        const msg = err instanceof Error ? err.message : String(err);
        if (/unique|duplicate/i.test(msg)) {
          return false;
        }
        console.error('webhook tryInsert DB failed', err);
        if (requireDbInProd()) throw err;
      }
    }
    return memoryWebhooks.tryInsert(ev);
  }

  async markWebhookProcessed(
    provider: string,
    notificationId: string,
    result: string,
  ): Promise<void> {
    if (this.db) {
      try {
        await this.db
          .update(paymentWebhookEvents)
          .set({
            processedAt: new Date(),
            processResult: result,
          })
          .where(
            and(
              eq(paymentWebhookEvents.provider, provider),
              eq(paymentWebhookEvents.notificationId, notificationId),
            ),
          );
      } catch (err) {
        console.warn('webhook markProcessed DB failed', err);
      }
    }
    memoryWebhooks.markProcessed(provider, notificationId, result);
  }

  // ─── Outbox ────────────────────────────────────────────

  async insertOutbox(row: OutboxRecord): Promise<void> {
    memoryOutbox.insert(row);
    if (!this.db) {
      if (requireDbInProd()) {
        throw new Error('Outbox insert sem DATABASE_URL');
      }
      return;
    }
    try {
      await this.db.insert(outboxEvents).values({
        id: row.id,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        eventType: row.eventType,
        payload: row.payload,
        createdAt: row.createdAt,
        processedAt: row.processedAt,
      });
    } catch (err) {
      console.error('outbox insert DB failed', err);
      if (requireDbInProd()) throw err;
    }
  }

  async listUnprocessedOutbox(): Promise<OutboxRecord[]> {
    if (this.db) {
      try {
        const rows = await this.db
          .select()
          .from(outboxEvents)
          .where(isNull(outboxEvents.processedAt))
          .limit(50);
        return rows.map((r) => ({
          id: r.id,
          aggregateType: r.aggregateType,
          aggregateId: r.aggregateId,
          eventType: r.eventType,
          payload: (r.payload ?? {}) as Record<string, unknown>,
          createdAt: r.createdAt,
          processedAt: r.processedAt,
        }));
      } catch (err) {
        console.warn('outbox list DB failed', err);
      }
    }
    return memoryOutbox.listUnprocessed();
  }

  async markOutboxProcessed(id: string): Promise<void> {
    memoryOutbox.markProcessed(id);
    if (this.db) {
      try {
        await this.db
          .update(outboxEvents)
          .set({ processedAt: new Date() })
          .where(eq(outboxEvents.id, id));
      } catch (err) {
        console.warn('outbox markProcessed DB failed', err);
      }
    }
  }

  /** Helper: create payment id */
  newId() {
    return randomUUID();
  }
}
