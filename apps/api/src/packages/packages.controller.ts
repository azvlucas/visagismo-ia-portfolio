import { Controller, Get, Inject, Param } from '@nestjs/common';
import { PackagesService } from './packages.service.js';

@Controller('public/packages')
export class PackagesController {
  // Explicit @Inject: tsx/esbuild does not emit design:paramtypes metadata.
  constructor(@Inject(PackagesService) private readonly packages: PackagesService) {}

  @Get()
  list() {
    return this.packages.listActive();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.packages.getBySlug(slug);
  }
}
