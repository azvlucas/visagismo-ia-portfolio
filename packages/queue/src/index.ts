import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { Redis } from 'ioredis';

export const GENERATION_QUEUE = 'generation';
export const EMAIL_QUEUE = 'email';
export const RETENTION_QUEUE = 'retention';
export const EXPIRATION_QUEUE = 'expiration';
export const LGPD_QUEUE = 'lgpd';

export type GenerationJobPayload = {
  orderId: string;
  cycle: number;
  enqueuedAt: string;
};

export type RetentionJobPayload = {
  kind: 'retention_sweep';
  requestedAt: string;
};

export type ExpirationJobPayload = {
  kind: 'expiration_sweep';
  requestedAt: string;
};

export type LgpdJobPayload = {
  requestId: string;
  email: string;
  orderId?: string | null;
};

let connection: Redis | null = null;

export function getRedisConnection(redisUrl?: string | null): Redis | null {
  const url = redisUrl ?? process.env.REDIS_URL;
  if (!url) return null;
  if (!connection) {
    connection = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 2000,
      lazyConnect: true,
    });
  }
  return connection;
}

export function isQueueEnabled(redisUrl?: string | null): boolean {
  return Boolean(redisUrl ?? process.env.REDIS_URL);
}

export function createGenerationQueue(redisUrl?: string | null) {
  const conn = getRedisConnection(redisUrl);
  if (!conn) return null;
  return new Queue<GenerationJobPayload>(GENERATION_QUEUE, {
    connection: conn as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  });
}

export async function enqueueGeneration(
  orderId: string,
  cycle = 1,
  redisUrl?: string | null,
): Promise<{ mode: 'bullmq' | 'inline'; jobId?: string }> {
  const queue = createGenerationQueue(redisUrl);
  if (!queue) {
    return { mode: 'inline' };
  }
  const jobId = `generation:${orderId}:${cycle}`;
  try {
    await queue.add(
      'generate',
      {
        orderId,
        cycle,
        enqueuedAt: new Date().toISOString(),
      },
      { jobId },
    );
  } catch (err) {
    // Job id may already exist — treat as success for idempotency
    const msg = err instanceof Error ? err.message : String(err);
    if (!/exists|duplicate/i.test(msg)) {
      console.warn('enqueueGeneration failed, falling back to inline', msg);
      return { mode: 'inline' };
    }
  }
  return { mode: 'bullmq', jobId };
}

export function createGenerationWorker(
  processor: (job: Job<GenerationJobPayload>) => Promise<void>,
  redisUrl?: string | null,
) {
  const conn = getRedisConnection(redisUrl);
  if (!conn) return null;
  return new Worker<GenerationJobPayload>(GENERATION_QUEUE, processor, {
    connection: conn as unknown as ConnectionOptions,
    concurrency: Number(process.env.GENERATION_CONCURRENCY ?? 1),
  });
}

export function createRetentionQueue(redisUrl?: string | null) {
  const conn = getRedisConnection(redisUrl);
  if (!conn) return null;
  return new Queue<RetentionJobPayload>(RETENTION_QUEUE, {
    connection: conn as unknown as ConnectionOptions,
  });
}

export function createExpirationQueue(redisUrl?: string | null) {
  const conn = getRedisConnection(redisUrl);
  if (!conn) return null;
  return new Queue<ExpirationJobPayload>(EXPIRATION_QUEUE, {
    connection: conn as unknown as ConnectionOptions,
  });
}

export function createLgpdQueue(redisUrl?: string | null) {
  const conn = getRedisConnection(redisUrl);
  if (!conn) return null;
  return new Queue<LgpdJobPayload>(LGPD_QUEUE, {
    connection: conn as unknown as ConnectionOptions,
  });
}

export async function pingRedis(redisUrl?: string | null): Promise<boolean> {
  try {
    const conn = getRedisConnection(redisUrl);
    if (!conn) return false;
    if (conn.status !== 'ready') {
      await Promise.race([
        conn.connect().catch(() => undefined),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('redis connect timeout')), 2000),
        ),
      ]);
    }
    const pong = await Promise.race([
      conn.ping(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('redis ping timeout')), 2000),
      ),
    ]);
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export type { Job, Queue, Worker };
