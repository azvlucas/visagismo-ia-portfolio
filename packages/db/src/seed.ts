import { eq } from 'drizzle-orm';
import { createDb } from './client.js';
import { appSettings, packages } from './schema/tables.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://visagismo:visagismo@localhost:5432/visagismo';

/**
 * Seed só cria pacotes/settings ausentes.
 * Por padrão NÃO sobrescreve edições do admin (preço, nome, etc.).
 * Para forçar reset do catálogo: SEED_FORCE_PACKAGES=true
 */
const forcePackages =
  (process.env.SEED_FORCE_PACKAGES ?? '').trim().toLowerCase() === 'true';

const seedPackages = [
  {
    slug: 'essencial',
    name: 'Essencial',
    description:
      'Indicado para quem deseja descobrir uma primeira direção visual. Análise inicial, simulações e orientações resumidas.',
    priceCents: 9700,
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
    slug: 'completo',
    name: 'Transformação',
    description:
      'Indicado para quem deseja comparar alternativas antes de mudar o visual. Análise mais completa e relatório detalhado.',
    priceCents: 19700,
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
    slug: 'premium',
    name: 'Premium',
    description:
      'Indicado para quem deseja explorar várias possibilidades e receber o material mais completo para o profissional.',
    priceCents: 34700,
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

const defaultSettings: Record<string, unknown> = {
  feature_flags: {
    payments_enabled: true,
    generation_enabled: true,
    maintenance_mode: false,
    /** Admin pode ligar no painel: checkout sem cobrança + geração imediata. */
    free_generation_enabled: false,
  },
  margin_target_pct: 70,
  ai_global_daily_budget_usd: 50,
  usd_brl_rate: 5.5,
  retention_originals_days: 30,
  retention_generated_days: 90,
  analytics_provider: 'none',
};

async function main() {
  const db = createDb(connectionString);

  for (const pkg of seedPackages) {
    const existing = await db
      .select()
      .from(packages)
      .where(eq(packages.slug, pkg.slug))
      .limit(1);

    if (existing[0]) {
      if (forcePackages) {
        await db
          .update(packages)
          .set({ ...pkg, updatedAt: new Date() })
          .where(eq(packages.slug, pkg.slug));
        console.log(`Force-updated package: ${pkg.slug}`);
      } else {
        console.log(
          `Package exists (skip overwrite): ${pkg.slug} — set SEED_FORCE_PACKAGES=true to reset`,
        );
      }
    } else {
      await db.insert(packages).values(pkg);
      console.log(`Inserted package: ${pkg.slug}`);
    }
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    if (existing[0]) {
      console.log(`Setting exists: ${key}`);
    } else {
      await db.insert(appSettings).values({ key, value });
      console.log(`Inserted setting: ${key}`);
    }
  }

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
