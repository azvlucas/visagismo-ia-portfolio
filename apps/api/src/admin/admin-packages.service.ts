import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { packages, type Db } from '@visagismo/db';
import { PackagesService } from '../packages/packages.service.js';
import { ApiHttpException } from '../common/http-error.js';
import { DB } from '../db/db.module.js';

export type AdminPackage = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  imageCount: number;
  styleVariationCount: number;
  estimatedSlaHours: number;
  features: string[];
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
  promoText: string | null;
  discountPercent: number | null;
  compareModels: boolean;
};

/** In-memory store only when DATABASE_URL is unavailable. */
const memoryStore = new Map<string, AdminPackage>();
const memoryDeleted = new Set<string>();

@Injectable()
export class AdminPackagesService {
  constructor(
    @Inject(PackagesService) private readonly packages: PackagesService,
    @Inject(DB) private readonly db: Db | null,
  ) {}

  async listAll(): Promise<AdminPackage[]> {
    if (this.db) {
      try {
        const rows = await this.db
          .select()
          .from(packages)
          .where(isNull(packages.deletedAt))
          .orderBy(asc(packages.sortOrder));
        if (rows.length > 0) {
          return rows.map(this.fromRow);
        }
      } catch (err) {
        console.warn('admin packages list DB error — catalog fallback', err);
      }
    }

    // Memory / offline: base catalog + overrides
    const base = await this.packages.listAllCatalog();
    const map = new Map<string, AdminPackage>();
    for (const p of base) {
      if (memoryDeleted.has(p.id)) continue;
      map.set(p.id, { ...p });
    }
    for (const [id, p] of memoryStore) {
      if (!memoryDeleted.has(id)) map.set(id, p);
    }
    return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async get(id: string): Promise<AdminPackage> {
    if (this.db) {
      try {
        const [row] = await this.db
          .select()
          .from(packages)
          .where(and(eq(packages.id, id), isNull(packages.deletedAt)))
          .limit(1);
        if (row) return this.fromRow(row);
      } catch (err) {
        console.warn('admin packages get DB error', err);
      }
    }

    const all = await this.listAll();
    const found = all.find((p) => p.id === id);
    if (!found) {
      throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return found;
  }

  async create(
    input: Partial<AdminPackage> & {
      name: string;
      slug: string;
      priceCents: number;
    },
  ) {
    const pkg: AdminPackage = {
      id: randomUUID(),
      slug: input.slug,
      name: input.name,
      description: input.description ?? '',
      priceCents: input.priceCents,
      currency: input.currency ?? 'BRL',
      imageCount: input.imageCount ?? 3,
      styleVariationCount: input.styleVariationCount ?? 2,
      estimatedSlaHours: input.estimatedSlaHours ?? 24,
      features: input.features ?? [],
      sortOrder: input.sortOrder ?? 99,
      isFeatured: input.isFeatured ?? false,
      isActive: input.isActive ?? true,
      promoText: input.promoText ?? null,
      discountPercent: input.discountPercent ?? null,
      compareModels: input.compareModels ?? false,
    };

    if (this.db) {
      try {
        const [row] = await this.db
          .insert(packages)
          .values({
            id: pkg.id,
            slug: pkg.slug,
            name: pkg.name,
            description: pkg.description,
            priceCents: pkg.priceCents,
            currency: pkg.currency,
            imageCount: pkg.imageCount,
            styleVariationCount: pkg.styleVariationCount,
            estimatedSlaHours: pkg.estimatedSlaHours,
            features: pkg.features,
            sortOrder: pkg.sortOrder,
            isFeatured: pkg.isFeatured,
            isActive: pkg.isActive,
            promoText: pkg.promoText,
            discountPercent: pkg.discountPercent,
            compareModels: pkg.compareModels,
          })
          .returning();
        if (row) return this.fromRow(row);
      } catch (err) {
        console.error('admin packages create DB error', err);
        throw new ApiHttpException(
          'CONFLICT',
          HttpStatus.CONFLICT,
          'Não foi possível criar o pacote (slug duplicado ou erro de banco).',
        );
      }
    }

    memoryStore.set(pkg.id, pkg);
    return pkg;
  }

  async update(id: string, patch: Partial<AdminPackage>) {
    if (this.db) {
      try {
        const current = await this.get(id);
        const next = {
          ...current,
          ...patch,
          id: current.id,
          slug: patch.slug ?? current.slug,
        };

        const [row] = await this.db
          .update(packages)
          .set({
            slug: next.slug,
            name: next.name,
            description: next.description,
            priceCents: next.priceCents,
            currency: next.currency,
            imageCount: next.imageCount,
            styleVariationCount: next.styleVariationCount,
            estimatedSlaHours: next.estimatedSlaHours,
            features: next.features,
            sortOrder: next.sortOrder,
            isFeatured: next.isFeatured,
            isActive: next.isActive,
            promoText: next.promoText,
            discountPercent: next.discountPercent,
            compareModels: next.compareModels,
            updatedAt: new Date(),
          })
          .where(and(eq(packages.id, id), isNull(packages.deletedAt)))
          .returning();

        if (!row) {
          throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
        }
        return this.fromRow(row);
      } catch (err) {
        if (err instanceof ApiHttpException) throw err;
        console.error('admin packages update DB error', err);
        throw new ApiHttpException(
          'INTERNAL_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
          'Falha ao atualizar o pacote no banco.',
        );
      }
    }

    const current = await this.get(id);
    const next = { ...current, ...patch, id: current.id };
    memoryStore.set(id, next);
    return next;
  }

  async softDelete(id: string) {
    if (this.db) {
      try {
        const [row] = await this.db
          .update(packages)
          .set({
            deletedAt: new Date(),
            isActive: false,
            updatedAt: new Date(),
          })
          .where(and(eq(packages.id, id), isNull(packages.deletedAt)))
          .returning();
        if (!row) {
          throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
        }
        return { ok: true };
      } catch (err) {
        if (err instanceof ApiHttpException) throw err;
        console.error('admin packages delete DB error', err);
        throw new ApiHttpException(
          'INTERNAL_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    await this.get(id);
    memoryDeleted.add(id);
    memoryStore.delete(id);
    return { ok: true };
  }

  async duplicate(id: string) {
    const src = await this.get(id);
    return this.create({
      ...src,
      name: `${src.name} (cópia)`,
      slug: `${src.slug}-copia-${Date.now().toString(36)}`,
      isFeatured: false,
    });
  }

  private fromRow = (row: typeof packages.$inferSelect): AdminPackage => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    imageCount: row.imageCount,
    styleVariationCount: row.styleVariationCount,
    estimatedSlaHours: row.estimatedSlaHours,
    features: row.features ?? [],
    sortOrder: row.sortOrder,
    isFeatured: row.isFeatured,
    isActive: row.isActive,
    promoText: row.promoText,
    discountPercent: row.discountPercent,
    compareModels: row.compareModels,
  });
}
