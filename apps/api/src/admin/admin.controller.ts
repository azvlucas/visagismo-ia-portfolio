import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminAuthGuard, Roles, type AuthedRequest } from './admin.guard.js';
import { AdminPackagesService } from './admin-packages.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminMetricsService } from './admin-metrics.service.js';
import { getProvidersHealth } from '@visagismo/generation';
import { memoryCostLogs } from '../generation/cost-logs.memory.js';
import { AdminSettingsService } from './admin-settings.service.js';

const loginSchema = z.object({
  // Accept local-dev addresses like admin@localhost (zod .email() rejects them).
  email: z
    .string()
    .min(3)
    .max(255)
    .refine((v) => /^[^\s@]+@[^\s@]+$/.test(v), 'E-mail inválido'),
  password: z.string().min(1),
});

const packageCreateSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).max(80),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  imageCount: z.number().int().positive().optional(),
  styleVariationCount: z.number().int().positive().optional(),
  estimatedSlaHours: z.number().int().positive().optional(),
  features: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  promoText: z.string().nullable().optional(),
  discountPercent: z.number().nullable().optional(),
  compareModels: z.boolean().optional(),
});

const packagePatchSchema = packageCreateSchema.partial();

const REFRESH_COOKIE = 'admin_refresh';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AdminSettingsService)
    private readonly settings: AdminSettingsService,
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(AdminPackagesService) private readonly packages: AdminPackagesService,
    @Inject(AdminOrdersService) private readonly orders: AdminOrdersService,
    @Inject(AdminMetricsService) private readonly metrics: AdminMetricsService,
  ) {}

  // ─── Auth ─────────────────────────────────────────────

  @Post('auth/login')
  async login(
    @Body(new ZodValidationPipe(loginSchema))
    body: z.infer<typeof loginSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(body.email, body.password);
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      user: tokens.user,
    };
  }

  @Post('auth/refresh')
  async refresh(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const tokens = await this.auth.refresh(raw);
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      user: tokens.user,
    };
  }

  @Post('auth/logout')
  async logout(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.auth.logout(raw);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/admin/auth' });
    res.clearCookie(REFRESH_COOKIE, { path: '/v1/admin/auth' });
    return { ok: true };
  }

  @Get('auth/me')
  @UseGuards(AdminAuthGuard)
  me(@Req() req: AuthedRequest) {
    return { user: req.admin };
  }

  // ─── Metrics ──────────────────────────────────────────

  @Get('metrics/overview')
  @UseGuards(AdminAuthGuard)
  metricsOverview() {
    return this.metrics.overview();
  }

  // ─── AI providers ─────────────────────────────────────

  @Get('ai/providers')
  @UseGuards(AdminAuthGuard)
  aiProviders() {
    return {
      providers: getProvidersHealth(),
      chain:
        process.env.IMAGE_PROVIDER_CHAIN ??
        '(auto: configured reals + mock)',
      allowMock: (process.env.IMAGE_ALLOW_MOCK ?? 'true') !== 'false',
      envHints: {
        OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
        GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
        XAI_API_KEY: Boolean(process.env.XAI_API_KEY),
        OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2',
        GEMINI_IMAGE_MODEL:
          process.env.GEMINI_IMAGE_MODEL ??
          'gemini-2.0-flash-preview-image-generation',
        XAI_IMAGE_MODEL: process.env.XAI_IMAGE_MODEL ?? 'grok-2-image',
        OPENAI_ANALYSIS_MODEL:
          process.env.OPENAI_ANALYSIS_MODEL ?? 'gpt-4o-mini',
      },
    };
  }

  @Get('ai/costs')
  @UseGuards(AdminAuthGuard)
  aiCosts() {
    return {
      ...memoryCostLogs.totals(),
      recent: memoryCostLogs.list(50),
    };
  }

  @Get('ai/image-system-prompt')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  getImageSystemPrompt() {
    return this.settings.getImageSystemPrompt();
  }

  @Patch('ai/image-system-prompt')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  patchImageSystemPrompt(
    @Body(
      new ZodValidationPipe(
        z.object({
          prompt: z.string().max(20_000),
        }),
      ),
    )
    body: { prompt: string },
  ) {
    return this.settings.setImageSystemPrompt(body.prompt);
  }

  @Post('ai/image-system-prompt/reset')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  resetImageSystemPrompt() {
    return this.settings.resetImageSystemPrompt();
  }

  // ─── Feature flags / configurações ────────────────────

  @Get('settings/feature-flags')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  getFeatureFlags() {
    return this.settings.getFeatureFlags();
  }

  @Patch('settings/feature-flags')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  patchFeatureFlags(
    @Body(
      new ZodValidationPipe(
        z.object({
          payments_enabled: z.boolean().optional(),
          generation_enabled: z.boolean().optional(),
          maintenance_mode: z.boolean().optional(),
          free_generation_enabled: z.boolean().optional(),
        }),
      ),
    )
    body: {
      payments_enabled?: boolean;
      generation_enabled?: boolean;
      maintenance_mode?: boolean;
      free_generation_enabled?: boolean;
    },
  ) {
    return this.settings.setFeatureFlags(body);
  }

  // ─── Packages ─────────────────────────────────────────

  @Get('packages')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  listPackages() {
    return this.packages.listAll();
  }

  @Post('packages')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  createPackage(
    @Body(new ZodValidationPipe(packageCreateSchema))
    body: z.infer<typeof packageCreateSchema>,
  ) {
    return this.packages.create(body);
  }

  @Get('packages/:id')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  getPackage(@Param('id') id: string) {
    return this.packages.get(id);
  }

  @Patch('packages/:id')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  patchPackage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(packagePatchSchema))
    body: z.infer<typeof packagePatchSchema>,
  ) {
    return this.packages.update(id, body);
  }

  @Delete('packages/:id')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  deletePackage(@Param('id') id: string) {
    return this.packages.softDelete(id);
  }

  @Post('packages/:id/duplicate')
  @UseGuards(AdminAuthGuard)
  @Roles('admin')
  duplicatePackage(@Param('id') id: string) {
    return this.packages.duplicate(id);
  }

  // ─── Orders ───────────────────────────────────────────

  @Get('orders')
  @UseGuards(AdminAuthGuard)
  listOrders(
    @Query('status') status?: string,
    @Query('email') email?: string,
    @Query('q') q?: string,
  ) {
    return this.orders.list({ status, email, q });
  }

  @Get('orders/:id')
  @UseGuards(AdminAuthGuard)
  getOrder(@Param('id') id: string) {
    return this.orders.get(id);
  }

  @Post('orders/:id/reprocess')
  @UseGuards(AdminAuthGuard)
  reprocess(@Param('id') id: string) {
    return this.orders.reprocess(id);
  }

  /**
   * Aprovação manual de pagamento (awaiting_payment | payment_pending).
   * Body opcional: { note?, externalPaymentId? }
   */
  @Post('orders/:id/approve-payment')
  @UseGuards(AdminAuthGuard)
  approvePayment(
    @Param('id') id: string,
    @Body()
    body?: { note?: string; externalPaymentId?: string },
  ) {
    return this.orders.approvePayment(id, {
      note: typeof body?.note === 'string' ? body.note : undefined,
      externalPaymentId:
        typeof body?.externalPaymentId === 'string'
          ? body.externalPaymentId
          : undefined,
    });
  }

  @Post('orders/:id/cancel')
  @UseGuards(AdminAuthGuard)
  cancel(@Param('id') id: string) {
    return this.orders.cancel(id);
  }

  private setRefreshCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
