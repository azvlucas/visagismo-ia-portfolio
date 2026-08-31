import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { MpPaymentStatus } from '@visagismo/domain';

export interface CreatePreferenceInput {
  orderId: string;
  orderNumber: string;
  title: string;
  amountCents: number;
  payerEmail: string;
  payerName: string;
  idempotencyKey: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
}

export interface PreferenceResult {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string | null;
  mock: boolean;
}

export interface MpPaymentDetails {
  id: string;
  status: string;
  externalReference: string | null;
  transactionAmount: number | null;
  raw: unknown;
}

export interface MercadoPagoClient {
  createPreference(input: CreatePreferenceInput): Promise<PreferenceResult>;
  getPayment(paymentId: string): Promise<MpPaymentDetails | null>;
  verifyWebhookSignature(input: {
    xSignature: string | undefined;
    xRequestId: string | undefined;
    dataId: string | undefined;
  }): boolean;
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN?.trim());
}

export class MockMercadoPagoClient implements MercadoPagoClient {
  private payments = new Map<string, MpPaymentDetails>();

  async createPreference(input: CreatePreferenceInput): Promise<PreferenceResult> {
    const preferenceId = `mock-pref-${randomUUID()}`;
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const initPoint = `${appUrl}/pedido/${input.orderId}/mock-pay?preferenceId=${preferenceId}`;
    return {
      preferenceId,
      initPoint,
      sandboxInitPoint: initPoint,
      mock: true,
    };
  }

  /** Used by mock-pay UI to register a payment for later fetch. */
  registerMockPayment(input: {
    paymentId: string;
    status: string;
    orderId: string;
    amountCents: number;
  }) {
    this.payments.set(input.paymentId, {
      id: input.paymentId,
      status: input.status,
      externalReference: input.orderId,
      transactionAmount: input.amountCents / 100,
      raw: input,
    });
  }

  async getPayment(paymentId: string): Promise<MpPaymentDetails | null> {
    return this.payments.get(paymentId) ?? null;
  }

  verifyWebhookSignature(): boolean {
    // Mock accepts all signatures in non-production.
    return true;
  }
}

export class RealMercadoPagoClient implements MercadoPagoClient {
  private readonly token: string;
  private readonly base = 'https://api.mercadopago.com';

  constructor(token?: string) {
    this.token = token ?? process.env.MP_ACCESS_TOKEN ?? '';
  }

  async createPreference(input: CreatePreferenceInput): Promise<PreferenceResult> {
    const success = assertAbsolutePublicUrl(input.successUrl, 'back_urls.success');
    const failure = assertAbsolutePublicUrl(input.failureUrl, 'back_urls.failure');
    const pending = assertAbsolutePublicUrl(input.pendingUrl, 'back_urls.pending');
    const notification = assertAbsolutePublicUrl(
      input.notificationUrl,
      'notification_url',
    );

    // Mercado Pago exige back_urls.success absoluto quando auto_return está ativo.
    const body: Record<string, unknown> = {
      external_reference: input.orderId,
      items: [
        {
          id: input.orderId,
          title: input.title,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number((input.amountCents / 100).toFixed(2)),
        },
      ],
      payer: {
        email: input.payerEmail,
        name: input.payerName,
      },
      back_urls: {
        success,
        failure,
        pending,
      },
      auto_return: 'approved',
      notification_url: notification,
      metadata: {
        order_number: input.orderNumber,
      },
    };

    const res = await fetch(`${this.base}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MP preference failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      id: string;
      init_point: string;
      sandbox_init_point?: string;
    };

    return {
      preferenceId: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point ?? null,
      mock: false,
    };
  }

  async getPayment(paymentId: string): Promise<MpPaymentDetails | null> {
    const res = await fetch(`${this.base}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MP get payment failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      id: number | string;
      status: string;
      external_reference?: string;
      transaction_amount?: number;
    };
    return {
      id: String(data.id),
      status: data.status,
      externalReference: data.external_reference ?? null,
      transactionAmount: data.transaction_amount ?? null,
      raw: data,
    };
  }

  verifyWebhookSignature(input: {
    xSignature: string | undefined;
    xRequestId: string | undefined;
    dataId: string | undefined;
  }): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET?.trim();
    if (!secret) {
      // If secret not configured, reject in production, allow in dev.
      return process.env.NODE_ENV !== 'production';
    }
    if (!input.xSignature || !input.dataId) return false;

    // x-signature: ts=...,v1=...
    const parts = Object.fromEntries(
      input.xSignature.split(',').map((p) => {
        const [k, v] = p.split('=');
        return [k?.trim(), v?.trim()];
      }),
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    // Mercado Pago manifest (docs): id:{data.id};request-id:{x-request-id};ts:{ts};
    const manifest = `id:${input.dataId};request-id:${input.xRequestId ?? ''};ts:${ts};`;
    const hmac = createHmac('sha256', secret).update(manifest).digest('hex');
    return v1 === hmac;
  }
}

/** Singleton mock so mock-pay and webhook share state. */
let mockSingleton: MockMercadoPagoClient | null = null;

export function getMercadoPagoClient(): MercadoPagoClient {
  if (isMercadoPagoConfigured()) {
    return new RealMercadoPagoClient();
  }
  if (!mockSingleton) mockSingleton = new MockMercadoPagoClient();
  return mockSingleton;
}

export function getMockMercadoPagoClient(): MockMercadoPagoClient | null {
  const client = getMercadoPagoClient();
  return client instanceof MockMercadoPagoClient ? client : mockSingleton;
}

export function normalizeMpStatus(status: string): MpPaymentStatus {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'in_process':
    case 'in_mediation':
      return 'in_process';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'charged_back':
      return 'charged_back';
    default:
      return 'pending';
  }
}

/** Garante URL absoluta http(s) — MP rejeita vazio/relativo em auto_return. */
function assertAbsolutePublicUrl(raw: string, field: string): string {
  const v = (raw ?? '').trim();
  if (!v) {
    throw new Error(
      `MP ${field} vazio. Configure APP_URL (site) e API_PUBLIC_URL (api) com HTTPS público no Coolify.`,
    );
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    throw new Error(`MP ${field} inválida: ${v}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`MP ${field} precisa ser http(s): ${v}`);
  }
  // localhost em produção com token real costuma ser rejeitado pelo MP
  if (
    process.env.NODE_ENV === 'production' &&
    /localhost|127\.0\.0\.1/.test(url.hostname)
  ) {
    throw new Error(
      `MP ${field} aponta para localhost (${url.href}). Defina APP_URL=https://seu-dominio.com no serviço API.`,
    );
  }
  return url.href;
}

/**
 * URL pública do site (web) para back_urls do Checkout Pro.
 * Não use API_URL interna (http://api:3001).
 */
export function resolvePublicAppUrl(): string {
  const candidates = [
    process.env.APP_URL,
    process.env.SERVICE_URL_WEB,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];
  for (const c of candidates) {
    const v = (c ?? '').trim().replace(/\/$/, '');
    if (!v) continue;
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u.origin;
      }
    } catch {
      // try next
    }
  }
  return 'http://localhost:3000';
}

/** URL pública da API (webhooks). Preferir domínio api.* — nunca http://api:3001. */
export function resolvePublicApiUrl(): string {
  const candidates = [
    process.env.API_PUBLIC_URL,
    process.env.SERVICE_URL_API,
    process.env.NEXT_PUBLIC_API_URL,
  ];
  for (const c of candidates) {
    const v = (c ?? '').trim().replace(/\/$/, '');
    if (!v) continue;
    // Rejeita hostname interno Docker
    if (/^https?:\/\/api(:\d+)?(\/|$)/i.test(v) || v.includes('://api:')) {
      continue;
    }
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u.origin;
      }
    } catch {
      // try next
    }
  }
  // Fallback: mesmo host do site + path não funciona; use localhost só em dev
  return process.env.NODE_ENV === 'production'
    ? ''
    : `http://localhost:${process.env.PORT ?? 3001}`;
}
