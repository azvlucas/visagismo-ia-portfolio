import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import {
  createGenerationWorker,
  isQueueEnabled,
  pingRedis,
  type GenerationJobPayload,
} from '@visagismo/queue';
import { runGenerationJob } from '@visagismo/generation';

loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

/**
 * Production worker:
 * - When REDIS_URL is set: consumes BullMQ `generation` jobs.
 * - Jobs carry orderId; worker notifies API or runs shared generation.
 *
 * For shared state across processes, orders must be in Postgres.
 * This worker calls the API internal process endpoint when API_INTERNAL_URL
 * is set; otherwise runs generation package only for selftest.
 */
async function processViaApi(orderId: string, cycle: number) {
  const base =
    process.env.API_INTERNAL_URL ??
    process.env.API_URL ??
    'http://127.0.0.1:3001';
  const secret = process.env.INTERNAL_JOB_SECRET ?? '';
  const res = await fetch(`${base.replace(/\/$/, '')}/v1/internal/generation/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-internal-secret': secret } : {}),
    },
    body: JSON.stringify({ orderId, cycle }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API generation run failed ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  const redisUrl = process.env.REDIS_URL;
  const redisOk = redisUrl ? await pingRedis(redisUrl) : false;

  console.log(
    JSON.stringify({
      service: 'visagismo-worker',
      redis: redisOk ? 'ok' : redisUrl ? 'error' : 'disabled',
      queueMode: redisOk ? 'bullmq' : 'idle',
      ts: new Date().toISOString(),
    }),
  );

  if (process.env.WORKER_SELFTEST === '1') {
    const result = await runGenerationJob({
      orderId: '00000000-0000-4000-8000-000000000001',
      orderNumber: 'VIS-SELFTEST',
      customerName: 'Worker',
      customerEmail: 'worker@localhost',
      packageName: 'Essencial',
      imageCount: 1,
      questionnaire: {
        objectives: ['confidence'],
        contexts: ['professional'],
        maintenanceTime: 'low',
        changeIntensity: 'subtle',
      },
      cycle: 1,
    });
    console.log(
      JSON.stringify({
        selftest: result.status,
        images: result.images.length,
      }),
    );
  }

  if (!isQueueEnabled(redisUrl) || !redisOk) {
    console.log(
      JSON.stringify({
        worker: 'no_redis',
        message:
          'Worker idle. API runs generation in-process. Set REDIS_URL for BullMQ.',
      }),
    );
    setInterval(() => {}, 60_000);
    return;
  }

  const worker = createGenerationWorker(async (job) => {
    const data = job.data as GenerationJobPayload;
    console.log(
      JSON.stringify({
        worker: 'job_start',
        jobId: job.id,
        orderId: data.orderId,
        cycle: data.cycle,
      }),
    );
    await processViaApi(data.orderId, data.cycle);
    console.log(
      JSON.stringify({
        worker: 'job_done',
        jobId: job.id,
        orderId: data.orderId,
      }),
    );
  }, redisUrl);

  if (!worker) {
    throw new Error('Failed to create generation worker');
  }

  worker.on('failed', (job, err) => {
    console.error('generation job failed', job?.id, err);
  });

  // Retention / expiration cron ticks via repeating jobs would go here;
  // also expose admin manual triggers on API.
  console.log(
    JSON.stringify({
      worker: 'listening',
      queue: 'generation',
      concurrency: process.env.GENERATION_CONCURRENCY ?? 1,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
