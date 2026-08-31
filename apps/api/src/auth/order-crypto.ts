import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { OrderStatus } from '@visagismo/shared';

export interface OrderSessionClaims extends JWTPayload {
  aud: 'order_session';
  sub: string;
  tokenVersion: number;
}

function requireSecret(name: string): Uint8Array {
  const value = process.env[name];
  if (!value || value.length < 16) {
    // Dev-safe default so local bootstrap works; production must set env.
    const fallback = `dev-only-${name}-change-me-now!!`;
    console.warn(`${name} missing or short — using insecure dev fallback`);
    return new TextEncoder().encode(fallback);
  }
  return new TextEncoder().encode(value);
}

export function generateCapabilityToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashCapabilityToken(token: string): string {
  const secret = requireSecret('ORDER_TOKEN_SECRET');
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function verifyCapabilityToken(
  token: string,
  expectedHash: string,
): boolean {
  const actual = hashCapabilityToken(token);
  try {
    const a = Buffer.from(actual, 'utf8');
    const b = Buffer.from(expectedHash, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function sessionTtlSeconds(status: OrderStatus, paidAt: Date | null): number {
  if (paidAt || !['draft', 'awaiting_payment', 'payment_pending'].includes(status)) {
    return 7 * 24 * 60 * 60;
  }
  return 24 * 60 * 60;
}

export async function signOrderSession(input: {
  orderId: string;
  tokenVersion: number;
  status: OrderStatus;
  paidAt: Date | null;
}): Promise<{ token: string; exp: number }> {
  const secret = requireSecret('ORDER_SESSION_SECRET');
  const ttl = sessionTtlSeconds(input.status, input.paidAt);
  const exp = Math.floor(Date.now() / 1000) + ttl;

  const token = await new SignJWT({
    tokenVersion: input.tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('order_session')
    .setSubject(input.orderId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);

  return { token, exp };
}

export async function verifyOrderSession(
  token: string,
): Promise<OrderSessionClaims | null> {
  try {
    const secret = requireSecret('ORDER_SESSION_SECRET');
    const { payload } = await jwtVerify(token, secret, {
      audience: 'order_session',
      algorithms: ['HS256'],
    });

    if (typeof payload.sub !== 'string') return null;
    if (typeof payload.tokenVersion !== 'number') return null;

    return payload as OrderSessionClaims;
  } catch {
    return null;
  }
}

export function generateOrderNumber(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `VIS-${y}${m}${day}-${rand}`;
}

/** Código estável de 6 dígitos para acesso e-mail + código. */
export function generateAccessCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, '0');
}

export function normalizeAccessCode(code: string): string {
  return code.replace(/\D/g, '').slice(0, 6);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
