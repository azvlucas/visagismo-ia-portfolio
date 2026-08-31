import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-process rate limiter (per IP).
 * For multi-instance production, put a gateway/nginx limit or Redis limiter later.
 */
export function rateLimitMiddleware(opts: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const key = `${opts.keyPrefix ?? 'rl'}:${ip}:${req.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Muitas tentativas. Aguarde um momento.',
        },
      });
      return;
    }
    next();
  };
}
