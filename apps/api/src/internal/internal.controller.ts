import { Body, Controller, Headers, HttpStatus, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApiHttpException } from '../common/http-error.js';
import { GenerationService } from '../generation/generation.service.js';
import { LgpdService } from '../lgpd/lgpd.service.js';

const runSchema = z.object({
  orderId: z.string().uuid(),
  cycle: z.number().int().positive().optional(),
});

@Controller('internal')
export class InternalController {
  constructor(
    @Inject(GenerationService) private readonly generation: GenerationService,
    @Inject(LgpdService) private readonly lgpd: LgpdService,
  ) {}

  private assertInternal(secret: string | undefined) {
    const expected = process.env.INTERNAL_JOB_SECRET?.trim();
    // In production require secret; in dev allow empty for local worker
    if (process.env.NODE_ENV === 'production') {
      if (!expected || secret !== expected) {
        throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
      }
      return;
    }
    if (expected && secret !== expected) {
      throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
  }

  /** Called by worker after BullMQ dequeue */
  @Post('generation/run')
  async runGeneration(
    @Body(new ZodValidationPipe(runSchema)) body: z.infer<typeof runSchema>,
    @Headers('x-internal-secret') secret?: string,
  ) {
    this.assertInternal(secret);
    await this.generation.processOrderExternal(body.orderId, body.cycle ?? 1);
    return { ok: true, orderId: body.orderId };
  }

  @Post('retention/run')
  async runRetention(@Headers('x-internal-secret') secret?: string) {
    this.assertInternal(secret);
    return this.lgpd.runRetentionSweep();
  }
}
