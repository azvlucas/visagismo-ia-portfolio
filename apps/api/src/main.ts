import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { loadEnv as validateEnv, env } from './config/env.js';
import { rateLimitMiddleware } from './common/rate-limit.middleware.js';

// Load monorepo root .env when running from apps/api
loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

async function bootstrap() {
  // Fail fast on missing production secrets / REQUIRE_DB
  validateEnv();
  const e = env();

  if (e.sentryDsn) {
    try {
      // Optional: dynamic import so Sentry is not a hard dependency unless installed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Sentry = (await import('@sentry/node' as string).catch(() => null)) as any;
      if (Sentry?.init) {
        Sentry.init({ dsn: e.sentryDsn, environment: e.nodeEnv });
        console.log('Sentry initialized');
      } else {
        console.warn(
          'SENTRY_DSN set but @sentry/node not installed — skip (pnpm add @sentry/node)',
        );
      }
    } catch {
      console.warn('Sentry init skipped');
    }
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: true,
  });

  app.setGlobalPrefix('v1');
  app.use(cookieParser());
  app.use(
    rateLimitMiddleware({
      windowMs: 60_000,
      max: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),
      keyPrefix: 'global',
    }),
  );
  app.use(
    '/v1/public/orders',
    rateLimitMiddleware({
      windowMs: 60_000,
      max: Number(process.env.RATE_LIMIT_ORDERS_PER_MINUTE ?? 30),
      keyPrefix: 'orders',
    }),
  );
  // E-mail + código: limite mais rígido (brute force)
  app.use(
    '/v1/public/orders/access',
    rateLimitMiddleware({
      windowMs: 15 * 60_000,
      max: Number(process.env.RATE_LIMIT_ORDER_ACCESS ?? 15),
      keyPrefix: 'order_access',
    }),
  );
  app.use(
    '/v1/admin/auth/login',
    rateLimitMiddleware({
      windowMs: 15 * 60_000,
      max: 20,
      keyPrefix: 'admin_login',
    }),
  );

  // APP_URL + variantes www / sem www + SERVICE_URL_WEB (Coolify)
  const corsOrigins = [
    e.appUrl,
    process.env.SERVICE_URL_WEB,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]
    .filter(Boolean)
    .flatMap((u) => {
      try {
        const url = new URL(u!);
        const hosts = [url.origin];
        if (url.hostname.startsWith('www.')) {
          hosts.push(`${url.protocol}//${url.hostname.slice(4)}`);
        } else {
          hosts.push(`${url.protocol}//www.${url.hostname}`);
        }
        return hosts;
      } catch {
        return [u!];
      }
    });

  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (error: Error | null, allow?: boolean) => void,
    ) => {
      // same-origin / server-to-server / mobile WebView sem Origin
      if (!origin) return cb(null, true);
      if (corsOrigins.some((o) => o.replace(/\/$/, '') === origin)) {
        return cb(null, true);
      }
      // Dev: localhost
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      console.warn('CORS blocked origin', origin, 'allowed', corsOrigins);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'x-internal-secret',
    ],
  });

  const port = Number(process.env.PORT ?? 3001);
  // Bind all interfaces so Coolify/Traefik can reach the container
  await app.listen(port, '0.0.0.0');
  console.log(
    JSON.stringify({
      service: 'visagismo-api',
      port,
      host: '0.0.0.0',
      env: e.nodeEnv,
      requireDb: e.requireDb,
      redis: Boolean(e.redisUrl),
      paymentsEnabled: e.paymentsEnabled,
    }),
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
