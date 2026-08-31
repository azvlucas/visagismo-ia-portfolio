import { Controller, Get, Inject } from '@nestjs/common';
import { AdminSettingsService } from '../admin/admin-settings.service.js';

/**
 * Configuração pública (sem auth) para landing, wizard e CTAs.
 */
@Controller('public/config')
export class PublicConfigController {
  constructor(
    @Inject(AdminSettingsService)
    private readonly settings: AdminSettingsService,
  ) {}

  @Get()
  get() {
    return this.settings.getPublicConfig();
  }
}
