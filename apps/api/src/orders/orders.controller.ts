import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  confirmPhotoSchema,
  createOrderSchema,
  MAX_PHOTO_BYTES,
  orderAccessSchema,
  patchOrderSchema,
  PHOTO_TYPES,
  presignPhotoSchema,
  sessionExchangeSchema,
  type ConfirmPhotoInput,
  type CreateOrderInput,
  type OrderAccessInput,
  type PatchOrderInput,
  type PhotoType,
  type PresignPhotoInput,
  type SessionExchangeInput,
} from '@visagismo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApiHttpException } from '../common/http-error.js';
import { HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { PhotosService } from './photos.service.js';

const COOKIE_NAME = 'order_session';

@Controller('public/orders')
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(PhotosService) private readonly photos: PhotosService,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.orders.create(body);
    this.setSessionCookie(res, result.sessionToken);
    return result.order;
  }

  /** Must be registered before :id routes. */
  @Post('session')
  async session(
    @Body(new ZodValidationPipe(sessionExchangeSchema)) body: SessionExchangeInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.orders.exchangeSession(body);
    this.setSessionCookie(res, result.sessionToken);
    return { ok: true, order: result.order };
  }

  /** Acesso por e-mail + código de 6 dígitos → sessão do pedido. */
  @Post('access')
  async access(
    @Body(new ZodValidationPipe(orderAccessSchema)) body: OrderAccessInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.orders.accessByEmailAndCode(body);
    this.setSessionCookie(res, result.sessionToken);
    return {
      ok: true,
      order: result.order,
      resultPath: `/pedido/${result.order.id}/resultado`,
    };
  }

  @Get(':id/photos')
  async listPhotos(@Param('id') id: string, @Req() req: Request) {
    return this.photos.list(id, this.readSession(req));
  }

  @Post(':id/photos/presign')
  async presignPhoto(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(presignPhotoSchema)) body: PresignPhotoInput,
    @Req() req: Request,
  ) {
    return this.photos.presign(id, body, this.readSession(req));
  }

  /**
   * Upload same-origin (FormData). Preferido no frontend — evita CORS/R2 no browser.
   */
  @Post(':id/photos/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PHOTO_BYTES },
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @Query('type') typeRaw: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          originalname: string;
          size: number;
        }
      | undefined,
    @Req() req: Request,
  ) {
    if (!file?.buffer?.length) {
      throw new ApiHttpException(
        'PHOTO_VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        'Nenhum arquivo recebido. Tente novamente.',
      );
    }
    const type = typeRaw as PhotoType;
    if (!(PHOTO_TYPES as readonly string[]).includes(type)) {
      throw new ApiHttpException(
        'VALIDATION_ERROR',
        HttpStatus.BAD_REQUEST,
        'Tipo de foto inválido (frontal | lateral | extra).',
      );
    }
    return this.photos.directUpload(
      id,
      {
        type,
        buffer: file.buffer,
        mime: file.mimetype,
        filename: file.originalname,
      },
      this.readSession(req),
    );
  }

  @Post(':id/photos/confirm')
  async confirmPhoto(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(confirmPhotoSchema)) body: ConfirmPhotoInput,
    @Req() req: Request,
  ) {
    return this.photos.confirm(id, body, this.readSession(req));
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.orders.getById(id, this.readSession(req));
  }

  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(patchOrderSchema)) body: PatchOrderInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.orders.patch(id, body, this.readSession(req));
    if (result.sessionToken) {
      this.setSessionCookie(res, result.sessionToken);
    }
    return result.order;
  }

  private readSession(req: Request): string | undefined {
    const raw = req.cookies?.[COOKIE_NAME];
    return typeof raw === 'string' ? raw : undefined;
  }

  private setSessionCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    // Cookie no domínio do site (via rewrite /api) — path amplo para /api/v1/*
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
