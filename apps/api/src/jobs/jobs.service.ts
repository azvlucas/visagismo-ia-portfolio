import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LgpdService } from '../lgpd/lgpd.service.js';
import { env } from '../config/env.js';

/**
 * In-process cron for expiration/retention when no external scheduler.
 * Runs every hour by default.
 */
@Injectable()
export class JobsService implements OnModuleInit {
  constructor(@Inject(LgpdService) private readonly lgpd: LgpdService) {}

  onModuleInit() {
    const enabled =
      (process.env.CRON_ENABLED ?? 'true').toLowerCase() !== 'false';
    if (!enabled) {
      console.log('CRON_ENABLED=false — skipping in-process crons');
      return;
    }

    const intervalMs = Number(process.env.CRON_INTERVAL_MS ?? 60 * 60 * 1000);

    // First run after 30s boot
    setTimeout(() => {
      void this.tick();
    }, 30_000);

    setInterval(() => {
      void this.tick();
    }, intervalMs);

    console.log(
      JSON.stringify({
        cron: 'enabled',
        intervalMs,
        retentionOriginalsDays: env().retentionOriginalsDays,
        retentionGeneratedDays: env().retentionGeneratedDays,
      }),
    );
  }

  private async tick() {
    try {
      const result = await this.lgpd.runRetentionSweep();
      console.log(JSON.stringify({ cron: 'retention', ...result }));
    } catch (err) {
      console.error('cron retention failed', err);
    }
  }
}
