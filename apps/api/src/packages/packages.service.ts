import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, and, isNull } from 'drizzle-orm';
import { packages, type Db } from '@visagismo/db';
import { DB } from '../db/db.module.js';

@Injectable()
export class PackagesService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  async listActive() {
    if (!this.db) {
      return this.fallbackPackages().filter((p) => p.isActive);
    }

    try {
      const rows = await this.db
        .select()
        .from(packages)
        .where(and(eq(packages.isActive, true), isNull(packages.deletedAt)))
        .orderBy(asc(packages.sortOrder));

      if (rows.length === 0) {
        return this.fallbackPackages().filter((p) => p.isActive);
      }

      return rows.map(this.toPublic);
    } catch (err) {
      console.warn('packages.listActive DB error — using fallback', err);
      return this.fallbackPackages().filter((p) => p.isActive);
    }
  }

  async getBySlug(slug: string) {
    if (!this.db) {
      const found = this.fallbackPackages().find((p) => p.slug === slug);
      if (!found) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Pacote não encontrado.',
        });
      }
      return found;
    }

    try {
      const [row] = await this.db
        .select()
        .from(packages)
        .where(and(eq(packages.slug, slug), isNull(packages.deletedAt)))
        .limit(1);

      if (!row || !row.isActive) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Pacote não encontrado.',
        });
      }

      return this.toPublic(row);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.warn('packages.getBySlug DB error — using fallback', err);
      const found = this.fallbackPackages().find((p) => p.slug === slug);
      if (!found) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Pacote não encontrado.',
        });
      }
      return found;
    }
  }

  /** Admin: all packages (active + inactive), with DB fallback. */
  async listAllCatalog() {
    if (!this.db) {
      return this.fallbackPackages();
    }
    try {
      const rows = await this.db
        .select()
        .from(packages)
        .where(isNull(packages.deletedAt))
        .orderBy(asc(packages.sortOrder));
      if (rows.length === 0) return this.fallbackPackages();
      return rows.map(this.toPublic);
    } catch (err) {
      console.warn('packages.listAllCatalog DB error — using fallback', err);
      return this.fallbackPackages();
    }
  }

  private toPublic = (row: typeof packages.$inferSelect) => ({
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

  /** Offline fallback for local UI without Postgres. */
  private fallbackPackages() {
    return [
      {
        id: '00000000-0000-4000-8000-000000000001',
        slug: 'essencial',
        name: 'Essencial',
        description:
          'Indicado para quem deseja descobrir uma primeira direção visual. Análise inicial, simulações e orientações resumidas.',
        priceCents: 9700,
        currency: 'BRL',
        imageCount: 3,
        styleVariationCount: 2,
        estimatedSlaHours: 24,
        features: [
          'Análise inicial de objetivo e imagem',
          'Simulações personalizadas',
          'Direção principal recomendada',
          'Orientações resumidas',
          'Resultado por e-mail',
        ],
        sortOrder: 1,
        isFeatured: false,
        isActive: true,
        promoText: null as string | null,
        discountPercent: null as number | null,
        compareModels: false,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        slug: 'completo',
        name: 'Transformação',
        description:
          'Indicado para quem deseja comparar alternativas antes de mudar o visual. Análise mais completa e relatório detalhado.',
        priceCents: 19700,
        currency: 'BRL',
        imageCount: 6,
        styleVariationCount: 4,
        estimatedSlaHours: 18,
        features: [
          'Análise mais completa',
          'Maior variedade de simulações',
          'Comparação entre diferentes direções',
          'Recomendações práticas de corte e barba (quando aplicável)',
          'Relatório detalhado',
          'Resultado por e-mail',
        ],
        sortOrder: 2,
        isFeatured: true,
        isActive: true,
        promoText: 'Mais escolhido',
        discountPercent: null,
        compareModels: false,
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        slug: 'premium',
        name: 'Premium',
        description:
          'Indicado para quem deseja explorar várias possibilidades e receber o material mais completo para o profissional.',
        priceCents: 34700,
        currency: 'BRL',
        imageCount: 12,
        styleVariationCount: 6,
        estimatedSlaHours: 12,
        features: [
          'Maior número de alternativas',
          'Diferentes direções de imagem',
          'Relatório completo',
          'Recomendações de manutenção',
          'Material para apresentar ao cabeleireiro, barbeiro ou profissional',
          'Resultado por e-mail',
        ],
        sortOrder: 3,
        isFeatured: false,
        isActive: true,
        promoText: null,
        discountPercent: null,
        compareModels: true,
      },
    ];
  }
}
