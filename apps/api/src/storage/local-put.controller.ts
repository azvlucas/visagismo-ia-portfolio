import {
  Controller,
  Headers,
  Inject,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiHttpException } from '../common/http-error.js';
import { HttpStatus } from '@nestjs/common';
import { STORAGE } from './storage.tokens.js';
import type { StorageProvider } from './storage.types.js';
import { LocalStorageProvider } from './local.storage.js';
import { MAX_PHOTO_BYTES } from '@visagismo/shared';

@Controller('public/storage')
export class LocalPutController {
  constructor(@Inject(STORAGE) private readonly storage: StorageProvider) {}


  @Put('local-put')
  async put(
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('content-type') contentType?: string,
  ) {
    if (this.storage.name !== 'local') {
      throw new ApiHttpException(
        'NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Upload local indisponível (R2 ativo).',
      );
    }

    const local = this.storage as LocalStorageProvider;
    if (!token) {
      throw new ApiHttpException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST);
    }

    const verified = local.verifyLocalPutToken(token);
    if (!verified) {
      throw new ApiHttpException(
        'INVALID_TOKEN',
        HttpStatus.UNAUTHORIZED,
        'Token de upload inválido ou expirado.',
      );
    }

    const chunks: Buffer[] = [];
    let total = 0;

    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_PHOTO_BYTES) {
          reject(
            new ApiHttpException(
              'PHOTO_VALIDATION_FAILED',
              HttpStatus.BAD_REQUEST,
              'Arquivo excede 10 MB.',
            ),
          );
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve());
      req.on('error', reject);
    });

    const body = Buffer.concat(chunks);
    await local.putObject({
      key: verified.key,
      body,
      mime: contentType || verified.mime,
    });

    res.status(200).json({ ok: true, key: verified.key, bytes: body.length });
  }
}
