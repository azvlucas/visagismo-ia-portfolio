/**
 * Configuração pública do site.
 * Dados empresariais só aparecem na UI quando preenchidos.
 * Não inventar e-mail, CNPJ ou participação humana inexistente.
 */

export type AnalysisMode =
  | 'automated'
  | 'automated_with_review'
  | 'specialist';

function env(key: string): string {
  if (typeof process === 'undefined') return '';
  return (process.env[key] ?? '').trim();
}

/** Garante URL absoluta válida (evita crash do Next em metadataBase). */
function resolveSiteUrl(): string {
  const candidates = [
    env('NEXT_PUBLIC_SITE_URL'),
    env('APP_URL'),
    env('SERVICE_URL_WEB'),
    'http://localhost:3000',
  ].filter(Boolean);

  for (const raw of candidates) {
    try {
      const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const u = new URL(withProtocol);
      if (u.hostname) return u.origin;
    } catch {
      // try next candidate
    }
  }
  return 'http://localhost:3000';
}

export const siteConfig = {
  brandName: env('NEXT_PUBLIC_BRAND_NAME') || 'Visagismo Online',
  brandTagline:
    env('NEXT_PUBLIC_BRAND_TAGLINE') ||
    'Análise de imagem pessoal com simulações e orientações práticas',

  /** E-mail de suporte. Vazio = não exibir na interface. */
  supportEmail:
    env('NEXT_PUBLIC_SUPPORT_EMAIL') || env('SUPPORT_EMAIL') || '',

  companyName: env('NEXT_PUBLIC_COMPANY_NAME') || '',
  companyDocument: env('NEXT_PUBLIC_COMPANY_CNPJ') || '',
  companyAddress: env('NEXT_PUBLIC_COMPANY_ADDRESS') || '',

  /**
   * Como a análise é realizada.
   * automated = totalmente automatizada (padrão atual do produto)
   */
  analysisMode: (env('NEXT_PUBLIC_ANALYSIS_MODE') ||
    'automated') as AnalysisMode,

  retentionOriginalsDays: Number(
    env('NEXT_PUBLIC_RETENTION_ORIGINALS_DAYS') ||
      env('RETENTION_ORIGINALS_DAYS') ||
      '30',
  ),
  retentionGeneratedDays: Number(
    env('NEXT_PUBLIC_RETENTION_GENERATED_DAYS') ||
      env('RETENTION_GENERATED_DAYS') ||
      '90',
  ),

  /** Dias para solicitar revisão por erro técnico após entrega */
  reviewWindowDays: Number(env('NEXT_PUBLIC_REVIEW_WINDOW_DAYS') || '7'),

  /** Reprocessamentos gratuitos por falha técnica (configurável) */
  freeReprocessLimit: Number(env('NEXT_PUBLIC_FREE_REPROCESS_LIMIT') || '1'),

  siteUrl: resolveSiteUrl(),

  seo: {
    title:
      env('NEXT_PUBLIC_SEO_TITLE') ||
      'Visagismo Online | Veja o visual no seu rosto antes de cortar',
    description:
      env('NEXT_PUBLIC_SEO_DESCRIPTION') ||
      'Cansado de errar o corte? Simulações no seu rosto, direção de imagem e orientações para o salão. Pagamento único, sem assinatura, acesso por e-mail + código.',
  },
} as const;

export function analysisModeLabel(mode: AnalysisMode = siteConfig.analysisMode): string {
  switch (mode) {
    case 'automated_with_review':
      return 'Análise automatizada com revisão humana em casos selecionados';
    case 'specialist':
      return 'Análise com participação de especialista';
    case 'automated':
    default:
      return 'Análise totalmente automatizada';
  }
}

export function analysisModeDescription(
  mode: AnalysisMode = siteConfig.analysisMode,
): string {
  switch (mode) {
    case 'automated_with_review':
      return 'O sistema gera a análise e as simulações de forma automatizada. Em situações específicas, a equipe pode revisar o pedido antes da entrega.';
    case 'specialist':
      return 'A análise combina tecnologia e a participação de um especialista para aprofundar as recomendações.';
    case 'automated':
    default:
      return 'A análise e as simulações são geradas de forma automatizada a partir do seu questionário e das suas fotos, com base em critérios de visagismo estruturados no sistema.';
  }
}

export function supportMailto(): string | null {
  return siteConfig.supportEmail
    ? `mailto:${siteConfig.supportEmail}`
    : null;
}
