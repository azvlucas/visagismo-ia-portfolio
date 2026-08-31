import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { type Db } from '@visagismo/db';
import { isQueueEnabled, pingRedis } from '@visagismo/queue';
import { DB } from './db/db.module.js';
import { env } from './config/env.js';
import { getR2ConfigStatus } from './storage/r2.storage.js';
import { StorageService } from './storage/storage.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Optional() @Inject(DB) private readonly db: Db | null,
    @Optional() @Inject(StorageService)
    private readonly storage: StorageService | null,
  ) {}

  @Get()
  async check() {
    const e = env();
    let database: 'ok' | 'error' | 'disabled' = 'disabled';
    let dbError: string | undefined;

    if (this.db) {
      try {
        await this.db.execute(sql`select 1`);
        database = 'ok';
      } catch (err) {
        database = 'error';
        dbError = err instanceof Error ? err.message : String(err);
      }
    }

    const redisConfigured = isQueueEnabled(e.redisUrl);
    const redis = redisConfigured
      ? (await pingRedis(e.redisUrl))
        ? 'ok'
        : 'error'
      : 'disabled';

    const r2 = getR2ConfigStatus();
    const storageName = this.storage?.name ?? (r2.configured ? 'r2' : 'local');

    // Postgres required only when REQUIRE_DB=true.
    // Redis is optional: if down, generation falls back to in-process.
    const healthy = e.requireDb ? database === 'ok' : true;
    const degraded =
      database === 'error' ||
      redis === 'error' ||
      (e.nodeEnv === 'production' && storageName === 'local');

    return {
      ok: healthy,
      degraded,
      service: 'visagismo-api',
      env: e.nodeEnv,
      requireDb: e.requireDb,
      checks: {
        database,
        redis,
        queueMode: redis === 'ok' ? 'bullmq' : 'inline',
        storage: storageName,
        r2: {
          configured: r2.configured,
          bucket: r2.bucket,
          missing: r2.missing,
          endpoint: r2.endpoint,
        },
      },
      ...(dbError ? { dbError } : {}),
      ts: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    const status = await this.check();
    if (!status.ok) {
      return { ...status, ready: false };
    }
    return { ...status, ready: true };
  }
}
