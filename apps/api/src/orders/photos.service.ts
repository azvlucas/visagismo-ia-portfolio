import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { orderPhotos, type Db } from '@visagismo/db';
import {
  type ConfirmPhotoInput,
  type PhotoType,
  type PresignPhotoInput,
} from '@visagismo/shared';
import { DB } from '../db/db.module.js';
import { ApiHttpException } from '../common/http-error.js';
import { StorageService } from '../storage/storage.service.js';
import { validateImageBuffer } from '../storage/image-validate.js';
import { OrdersService } from './orders.service.js';
import { memoryPhotos, type PhotoRecord } from './photos.memory.js';

export interface PublicPhotoView {
  id: string;
  type: PhotoType;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  confirmed: boolean;
  confirmedAt: string | null;
  createdAt: string;
}

@Injectable()
export class PhotosService {
  constructor(
    @Inject(DB) private readonly db: Db | null,
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async list(orderId: string, sessionJwt: string | undefined) {
    await this.orders.requireSession(orderId, sessionJwt);
    const rows = await this.listRecords(orderId);
    return rows.map(toPublicPhoto);
  }

  async presign(
    orderId: string,
    input: PresignPhotoInput,
    sessionJwt: string | undefined,
  ) {
    const order = await this.orders.requireSession(orderId, sessionJwt);
    if (order.status !== 'draft') {
      throw new ApiHttpException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        'Só é possível enviar fotos em pedidos em rascunho.',
      );
    }

    const ext = this.storage.mimeToExt(input.mime);
    const key = this.storage.buildOriginalKey(orderId, input.type, ext);
    const photoId = randomUUID();
    const now = new Date();

    const photo: PhotoRecord = {
      id: photoId,
      orderId,
      type: input.type,
      r2Key: key,
      mime: input.mime,
      bytes: 0,
      width: null,
      height: null,
      checksumSha256: null,
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
      expectedBytes: input.bytes,
    };

    await this.persistPhoto(photo, true);

    const presign = await this.storage.presignPut({
      key,
      mime: input.mime,
      bytes: input.bytes,
    });

    return {
      photoId,
      type: input.type,
      ...presign,
      storage: this.storage.name,
    };
  }

  /**
   * Upload direto same-origin (via rewrite Next → API).
   * Evita CORS no browser (R2/API pública) — principal causa de "Load failed" no mobile.
   */
  async directUpload(
    orderId: string,
    input: {
      type: PhotoType;
      buffer: Buffer;
      mime: string;
      filename?: string;
    },
    sessionJwt: string | undefined,
  ) {
    const order = await this.orders.requireSession(orderId, sessionJwt);
    if (order.status !== 'draft') {
      throw new ApiHttpException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        'Só é possível enviar fotos em pedidos em rascunho.',
      );
    }

    const mime = normalizeMime(input.mime, input.filename);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
      throw new ApiHttpException(
        'PHOTO_VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        'Formato não suportado. Use JPEG, PNG ou WebP (no iPhone: “Mais compatível” / desative HEIC).',
      );
    }

    if (input.buffer.length > 10 * 1024 * 1024) {
      throw new ApiHttpException(
        'PHOTO_VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        'Arquivo excede 10 MB.',
      );
    }

    if (!input.buffer?.length) {
      throw new ApiHttpException(
        'PHOTO_VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        'Arquivo vazio recebido pela API. Tente outro JPEG/PNG.',
      );
    }

    const ext = this.storage.mimeToExt(mime);
    const key = this.storage.buildOriginalKey(orderId, input.type, ext);
    const photoId = randomUUID();
    const now = new Date();
    const storageName = this.storage.name;

    console.log(
      JSON.stringify({
        event: 'photo_upload_start',
        orderId,
        type: input.type,
        bytes: input.buffer.length,
        mime,
        key,
        storage: storageName,
      }),
    );

    try {
      await this.storage.putObject({
        key,
        body: input.buffer,
        mime,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          event: 'photo_upload_storage_error',
          orderId,
          key,
          storage: storageName,
          error: message,
        }),
      );
      throw new ApiHttpException(
        'INTERNAL_ERROR',
        HttpStatus.BAD_GATEWAY,
        storageName === 'r2'
          ? `Falha ao gravar no Cloudflare R2: ${message}`
          : `Falha ao gravar a foto (storage=${storageName}): ${message}`,
      );
    }

    const photo: PhotoRecord = {
      id: photoId,
      orderId,
      type: input.type,
      r2Key: key,
      mime,
      bytes: input.buffer.length,
      width: null,
      height: null,
      checksumSha256: null,
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
      expectedBytes: input.buffer.length,
    };
    await this.persistPhoto(photo, true);

    const confirmed = await this.confirm(orderId, { photoId }, sessionJwt);
    return {
      ...confirmed,
      storage: storageName,
      key,
    };
  }

  async confirm(
    orderId: string,
    input: ConfirmPhotoInput,
    sessionJwt: string | undefined,
  ) {
    await this.orders.requireSession(orderId, sessionJwt);

    const photo = await this.getRecord(input.photoId);
    if (!photo || photo.orderId !== orderId) {
      throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const head = await this.storage.headObject(photo.r2Key);
    if (!head.exists) {
      throw new ApiHttpException(
        'PHOTO_VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        'Arquivo ainda não foi enviado. Faça o upload e tente novamente.',
      );
    }

    const buf = await this.storage.getObject(photo.r2Key);
    if (!buf) {
      throw new ApiHttpException(
        'PHOTO_VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        'Não foi possível ler o arquivo enviado.',
      );
    }

    const validation = await validateImageBuffer(buf, photo.mime);
    if (!validation.ok) {
      throw new ApiHttpException(
        'PHOTO_VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        validation.hardErrors.join(' '),
        { hardErrors: validation.hardErrors, warnings: validation.warnings },
      );
    }

    const now = new Date();
    const updated: PhotoRecord = {
      ...photo,
      bytes: validation.bytes,
      width: validation.width,
      height: validation.height,
      checksumSha256: validation.checksumSha256,
      mime: validation.mime ?? photo.mime,
      confirmedAt: now,
      updatedAt: now,
    };

    // Replace previous photo of same type
    await this.replaceType(orderId, photo.type, photo.id);
    await this.persistPhoto(updated, false);

    return {
      photo: toPublicPhoto(updated),
      warnings: validation.warnings,
      softValidation: true as const,
    };
  }

  async hasConfirmedFrontal(orderId: string): Promise<boolean> {
    const rows = await this.listRecords(orderId);
    return rows.some((p) => p.type === 'frontal' && p.confirmedAt);
  }

  /** Público para geração / admin */
  async listRecordsForOrder(orderId: string): Promise<PhotoRecord[]> {
    return this.listRecords(orderId);
  }

  /** Metadados + preview leve (JPEG ~720px) para painel admin */
  async listWithPreviews(orderId: string) {
    const rows = await this.listRecords(orderId);
    const out = [];
    for (const p of rows) {
      out.push({
        id: p.id,
        type: p.type,
        mime: p.mime,
        bytes: p.bytes,
        width: p.width,
        height: p.height,
        confirmed: Boolean(p.confirmedAt),
        confirmedAt: p.confirmedAt?.toISOString() ?? null,
        url: p.confirmedAt
          ? await this.storage.resolvePreviewUrl(p.r2Key, p.mime)
          : null,
      });
    }
    return out;
  }

  private async listRecords(orderId: string): Promise<PhotoRecord[]> {
    if (this.db) {
      try {
        const rows = await this.db
          .select()
          .from(orderPhotos)
          .where(eq(orderPhotos.orderId, orderId));
        const mapped = rows.map((r) => ({
          id: r.id,
          orderId: r.orderId,
          type: r.type as PhotoRecord['type'],
          r2Key: r.r2Key,
          mime: r.mime,
          bytes: r.bytes,
          width: r.width,
          height: r.height,
          checksumSha256: r.checksumSha256,
          confirmedAt: r.confirmedAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          expectedBytes: r.bytes,
        }));
        for (const p of mapped) memoryPhotos.save(p);
        return mapped;
      } catch (err) {
        console.warn('photos.listRecords DB failed', err);
        if (
          process.env.REQUIRE_DB === 'true' ||
          process.env.NODE_ENV === 'production'
        ) {
          throw err;
        }
      }
    }
    return memoryPhotos.listByOrder(orderId);
  }

  private async getRecord(id: string): Promise<PhotoRecord | null> {
    if (this.db) {
      try {
        const [row] = await this.db
          .select()
          .from(orderPhotos)
          .where(eq(orderPhotos.id, id))
          .limit(1);
        if (row) {
          return {
            id: row.id,
            orderId: row.orderId,
            type: row.type,
            r2Key: row.r2Key,
            mime: row.mime,
            bytes: row.bytes,
            width: row.width,
            height: row.height,
            checksumSha256: row.checksumSha256,
            confirmedAt: row.confirmedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            expectedBytes: row.bytes,
          };
        }
      } catch {
        // fall through
      }
    }
    return memoryPhotos.getById(id);
  }

  private async persistPhoto(photo: PhotoRecord, isNew: boolean) {
    if (this.db) {
      try {
        if (isNew) {
          await this.db.insert(orderPhotos).values({
            id: photo.id,
            orderId: photo.orderId,
            type: photo.type,
            r2Key: photo.r2Key,
            mime: photo.mime,
            bytes: photo.bytes || photo.expectedBytes,
            width: photo.width,
            height: photo.height,
            checksumSha256: photo.checksumSha256,
            confirmedAt: photo.confirmedAt,
            createdAt: photo.createdAt,
            updatedAt: photo.updatedAt,
          });
        } else {
          await this.db
            .update(orderPhotos)
            .set({
              bytes: photo.bytes,
              width: photo.width,
              height: photo.height,
              checksumSha256: photo.checksumSha256,
              mime: photo.mime,
              confirmedAt: photo.confirmedAt,
              updatedAt: photo.updatedAt,
            })
            .where(eq(orderPhotos.id, photo.id));
        }
        memoryPhotos.save(photo);
        return;
      } catch (err) {
        console.error('photos.persist DB failed', err);
        if (
          process.env.REQUIRE_DB === 'true' ||
          process.env.NODE_ENV === 'production'
        ) {
          throw err;
        }
      }
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('photos.persist: DATABASE_URL ausente em produção');
    }
    memoryPhotos.save(photo);
  }

  private async replaceType(
    orderId: string,
    type: PhotoType,
    keepId: string,
  ) {
    memoryPhotos.removeType(orderId, type, keepId);
    if (this.db) {
      try {
        const rows = await this.db
          .select()
          .from(orderPhotos)
          .where(
            and(eq(orderPhotos.orderId, orderId), eq(orderPhotos.type, type)),
          );
        for (const row of rows) {
          if (row.id !== keepId) {
            await this.db
              .delete(orderPhotos)
              .where(eq(orderPhotos.id, row.id));
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

function toPublicPhoto(p: PhotoRecord): PublicPhotoView {
  return {
    id: p.id,
    type: p.type,
    mime: p.mime,
    bytes: p.bytes,
    width: p.width,
    height: p.height,
    confirmed: Boolean(p.confirmedAt),
    confirmedAt: p.confirmedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function normalizeMime(mime: string | undefined, filename?: string): string {
  const m = (mime ?? '').toLowerCase().trim();
  if (m === 'image/jpg') return 'image/jpeg';
  if (m === 'image/jpeg' || m === 'image/png' || m === 'image/webp') return m;
  const name = (filename ?? '').toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return m || 'application/octet-stream';
}
