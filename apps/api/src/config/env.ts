/**
 * Production-oriented env helpers.
 * In production, require core secrets and optionally hard-require Postgres.
 */

export type AppEnv = {
  nodeEnv: string;
  isProd: boolean;
  requireDb: boolean;
  databaseUrl: string | null;
  redisUrl: string | null;
  appUrl: string;
  apiPublicUrl: string;
  orderTokenSecret: string;
  orderSessionSecret: string;
  adminJwtSecret: string;
  paymentsEnabled: boolean;
  sentryDsn: string | null;
  retentionOriginalsDays: number;
  retentionGeneratedDays: number;
  draftTtlHours: number;
  paymentTtlHours: number;
};

function reqSecret(name: string, minLen = 16): string {
  const v = process.env[name]?.trim();
  if (v && v.length >= minLen) return v;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing or weak required secret: ${name}`);
  }
  console.warn(`${name} missing/short — using insecure dev fallback`);
  return `dev-only-${name}-change-me-now!!`;
}

export function loadEnv(): AppEnv {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';
  const requireDb =
    (process.env.REQUIRE_DB ?? (isProd ? 'true' : 'false')).toLowerCase() ===
    'true';

  const databaseUrl = process.env.DATABASE_URL?.trim() || null;
  if (requireDb && !databaseUrl) {
    throw new Error('REQUIRE_DB=true but DATABASE_URL is not set');
  }

  return {
    nodeEnv,
    isProd,
    requireDb,
    databaseUrl,
    redisUrl: process.env.REDIS_URL?.trim() || null,
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    apiPublicUrl:
      process.env.API_PUBLIC_URL ??
      process.env.API_URL ??
      `http://localhost:${process.env.PORT ?? 3001}`,
    orderTokenSecret: reqSecret('ORDER_TOKEN_SECRET'),
    orderSessionSecret: reqSecret('ORDER_SESSION_SECRET'),
    adminJwtSecret: reqSecret('ADMIN_JWT_SECRET'),
    paymentsEnabled: (() => {
      const f = (process.env.PAYMENTS_ENABLED ?? 'true').toLowerCase();
      return !['false', '0', 'no', 'off'].includes(f);
    })(),
    sentryDsn: process.env.SENTRY_DSN?.trim() || null,
    retentionOriginalsDays: Number(
      process.env.RETENTION_ORIGINALS_DAYS ?? 30,
    ),
    retentionGeneratedDays: Number(
      process.env.RETENTION_GENERATED_DAYS ?? 90,
    ),
    draftTtlHours: Number(process.env.DRAFT_TTL_HOURS ?? 24),
    paymentTtlHours: Number(process.env.PAYMENT_TTL_HOURS ?? 48),
  };
}

let cached: AppEnv | null = null;

export function env(): AppEnv {
  if (!cached) cached = loadEnv();
  return cached;
}
