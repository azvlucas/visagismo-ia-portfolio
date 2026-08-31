import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PackagesController } from './packages/packages.controller.js';
import { PackagesService } from './packages/packages.service.js';
import { DbModule } from './db/db.module.js';
import { OrdersController } from './orders/orders.controller.js';
import { OrdersService } from './orders/orders.service.js';
import { PhotosService } from './orders/photos.service.js';
import { StorageModule } from './storage/storage.module.js';
import { PaymentsController } from './payments/payments.controller.js';
import { PaymentsService } from './payments/payments.service.js';
import { PaymentsRepository } from './payments/payments.repository.js';
import { GenerationService } from './generation/generation.service.js';
import { GenerationController } from './generation/generation.controller.js';
import { EmailService } from './generation/email.service.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminAuthService } from './admin/admin-auth.service.js';
import { AdminAuthGuard } from './admin/admin.guard.js';
import { AdminPackagesService } from './admin/admin-packages.service.js';
import { AdminOrdersService } from './admin/admin-orders.service.js';
import { AdminMetricsService } from './admin/admin-metrics.service.js';
import { AdminSettingsService } from './admin/admin-settings.service.js';
import { LgpdService } from './lgpd/lgpd.service.js';
import { LgpdController } from './lgpd/lgpd.controller.js';
import { InternalController } from './internal/internal.controller.js';
import { JobsService } from './jobs/jobs.service.js';
import { PublicConfigController } from './public/public-config.controller.js';

@Module({
  imports: [DbModule, StorageModule],
  controllers: [
    HealthController,
    PackagesController,
    OrdersController,
    PaymentsController,
    GenerationController,
    AdminController,
    LgpdController,
    InternalController,
    PublicConfigController,
  ],
  providers: [
    PackagesService,
    OrdersService,
    PhotosService,
    EmailService,
    GenerationService,
    PaymentsRepository,
    PaymentsService,
    AdminAuthService,
    AdminAuthGuard,
    AdminPackagesService,
    AdminOrdersService,
    AdminMetricsService,
    AdminSettingsService,
    LgpdService,
    JobsService,
  ],
})
export class AppModule {}
