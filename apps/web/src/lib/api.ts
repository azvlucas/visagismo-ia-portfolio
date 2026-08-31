import { apiUrl, fetchTimeoutSignal } from '@/lib/api-base';

export type PublicPackage = {
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

export function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/** Fallback de catálogo com copy orientada a benefício (não a tech). */
export const FALLBACK_PACKAGES: PublicPackage[] = [
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
    promoText: null,
    discountPercent: null,
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

export async function fetchPackages(): Promise<PublicPackage[]> {
  const endpoint = apiUrl('/v1/public/packages');
  try {
    const res = await fetch(endpoint, {
      cache: 'no-store',
      signal: fetchTimeoutSignal(4000),
    });
    if (!res.ok) throw new Error(`packages ${res.status}`);
    const data = (await res.json()) as PublicPackage[];
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('packages empty');
    }
    return data;
  } catch (err) {
    console.warn(
      `[packages] falha ao buscar ${endpoint}:`,
      err instanceof Error ? err.message : err,
      '— usando catálogo local temporário.',
    );
    return FALLBACK_PACKAGES;
  }
}

/** Busca pacote ao vivo por slug (wizard / checkout). */
export async function fetchPackageBySlug(
  slug: string,
): Promise<PublicPackage | null> {
  const endpoint = apiUrl(`/v1/public/packages/${encodeURIComponent(slug)}`);
  try {
    const res = await fetch(endpoint, {
      cache: 'no-store',
      signal: fetchTimeoutSignal(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicPackage;
  } catch {
    return FALLBACK_PACKAGES.find((p) => p.slug === slug) ?? null;
  }
}

export type PublicConfig = {
  freeGenerationEnabled: boolean;
  paymentsEnabled: boolean;
  generationEnabled: boolean;
  maintenanceMode: boolean;
};

const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  freeGenerationEnabled: false,
  paymentsEnabled: true,
  generationEnabled: true,
  maintenanceMode: false,
};

/** Flags públicas (gratuidade, manutenção, etc.). */
export async function fetchPublicConfig(): Promise<PublicConfig> {
  const endpoint = apiUrl('/v1/public/config');
  try {
    const res = await fetch(endpoint, {
      cache: 'no-store',
      signal: fetchTimeoutSignal(4000),
    });
    if (!res.ok) throw new Error(`config ${res.status}`);
    const data = (await res.json()) as Partial<PublicConfig>;
    return {
      freeGenerationEnabled: data.freeGenerationEnabled === true,
      paymentsEnabled: data.paymentsEnabled !== false,
      generationEnabled: data.generationEnabled !== false,
      maintenanceMode: data.maintenanceMode === true,
    };
  } catch {
    return DEFAULT_PUBLIC_CONFIG;
  }
}
