export type PaymentRowStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: string;
  externalPreferenceId: string | null;
  externalPaymentId: string | null;
  status: PaymentRowStatus;
  amountCents: number;
  idempotencyKey: string;
  isActiveCheckout: boolean;
  rawPayload: unknown;
  initPoint: string | null;
  sandboxInitPoint: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEventRecord {
  id: string;
  provider: string;
  notificationId: string;
  externalPaymentId: string | null;
  topic: string | null;
  payload: unknown;
  processedAt: Date | null;
  processResult: string | null;
  createdAt: Date;
}

export interface OutboxRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  processedAt: Date | null;
}

const payments = new Map<string, PaymentRecord>();
const paymentsByIdempotency = new Map<string, string>();
const paymentsByExternal = new Map<string, string>();
const webhooks = new Map<string, WebhookEventRecord>(); // key provider:notificationId
const outbox: OutboxRecord[] = [];

export const memoryPayments = {
  save(p: PaymentRecord) {
    payments.set(p.id, p);
    paymentsByIdempotency.set(p.idempotencyKey, p.id);
    if (p.externalPaymentId) {
      paymentsByExternal.set(`${p.provider}:${p.externalPaymentId}`, p.id);
    }
  },

  getById(id: string) {
    return payments.get(id) ?? null;
  },

  getByIdempotency(key: string) {
    const id = paymentsByIdempotency.get(key);
    return id ? payments.get(id) ?? null : null;
  },

  getByExternal(provider: string, externalPaymentId: string) {
    const id = paymentsByExternal.get(`${provider}:${externalPaymentId}`);
    return id ? payments.get(id) ?? null : null;
  },

  listByOrder(orderId: string) {
    return [...payments.values()].filter((p) => p.orderId === orderId);
  },

  countCheckouts(orderId: string) {
    return this.listByOrder(orderId).length;
  },

  supersedeActive(orderId: string) {
    for (const p of this.listByOrder(orderId)) {
      if (p.isActiveCheckout && p.status !== 'approved') {
        p.isActiveCheckout = false;
        p.updatedAt = new Date();
        payments.set(p.id, p);
      }
    }
  },
};

export const memoryWebhooks = {
  tryInsert(ev: WebhookEventRecord): boolean {
    const key = `${ev.provider}:${ev.notificationId}`;
    if (webhooks.has(key)) return false;
    webhooks.set(key, ev);
    return true;
  },

  markProcessed(provider: string, notificationId: string, result: string) {
    const key = `${provider}:${notificationId}`;
    const ev = webhooks.get(key);
    if (ev) {
      ev.processedAt = new Date();
      ev.processResult = result;
      webhooks.set(key, ev);
    }
  },
};

export const memoryOutbox = {
  insert(row: OutboxRecord) {
    outbox.push(row);
  },
  listUnprocessed() {
    return outbox.filter((o) => !o.processedAt);
  },
  markProcessed(id: string) {
    const row = outbox.find((o) => o.id === id);
    if (row) row.processedAt = new Date();
  },
};
