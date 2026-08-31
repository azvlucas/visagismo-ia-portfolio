import type { QuestionnairePayload } from '@visagismo/shared';
import {
  CONTEXT_LABELS_PT,
  OBJECTIVE_LABELS_PT,
} from '@visagismo/shared';
import { styleImagePromptFromDirection } from './identity-prompt.js';
import type { AnalysisOutput, AnalysisResultStructured } from './types.js';

const DISCLAIMER_VERSION = '2026-07-v1';

/**
 * Deterministic template analysis — always succeeds when questionnaire is present.
 * Used as primary MVP path and as LLM fallback.
 */
export function runTemplateAnalysis(input: {
  customerName: string;
  questionnaire: Partial<QuestionnairePayload> & Record<string, unknown>;
  imageCount: number;
}): AnalysisOutput {
  const started = Date.now();
  const q = input.questionnaire;
  const objectives = (q.objectives as string[] | undefined) ?? [];
  const contexts = (q.contexts as string[] | undefined) ?? [];
  const intensity = (q.changeIntensity as string | undefined) ?? 'moderate';
  const maintenance = (q.maintenanceTime as string | undefined) ?? 'medium';

  const objLabels = objectives
    .map((o) => OBJECTIVE_LABELS_PT[o as keyof typeof OBJECTIVE_LABELS_PT] ?? o)
    .filter(Boolean);
  const ctxLabels = contexts
    .map((c) => CONTEXT_LABELS_PT[c as keyof typeof CONTEXT_LABELS_PT] ?? c)
    .filter(Boolean);

  const intensityPt =
    intensity === 'subtle'
      ? 'discreta'
      : intensity === 'bold'
        ? 'marcante'
        : 'moderada';

  const maintPt =
    maintenance === 'low'
      ? 'baixa'
      : maintenance === 'high'
        ? 'alta'
        : 'média';

  const primaryObj = objLabels[0] ?? 'uma imagem mais alinhada aos seus objetivos';
  const primaryCtx = ctxLabels[0] ?? 'o dia a dia';

  const directions = buildDirections(input.imageCount, {
    primaryObj,
    primaryCtx,
    intensityPt,
    maintPt,
  });

  const data: AnalysisResultStructured = {
    summary: `${input.customerName}, sua análise aponta para uma direção de imagem ${intensityPt}, com foco em ${primaryObj.toLowerCase()} no contexto de ${primaryCtx.toLowerCase()}.`,
    perceptionAnalysis: [
      `Com base no questionário, a percepção desejada gira em torno de: ${objLabels.join(', ') || 'equilíbrio e autenticidade'}.`,
      `Os contextos de uso mais relevantes são: ${ctxLabels.join(', ') || 'uso cotidiano'}.`,
      `Recomendamos uma mudança ${intensityPt}, coerente com o tempo de manutenção ${maintPt} que você indicou.`,
      'Estas orientações são sugestões estéticas e não garantias sobre percepção social.',
    ].join(' '),
    hairRecommendations: [
      `Priorize um corte que valorize o formato do rosto e a mensagem de ${primaryObj.toLowerCase()}.`,
      intensity === 'subtle'
        ? 'Ajustes sutis de volume e contorno costumam bastar; evite mudanças drásticas de comprimento na primeira transição.'
        : intensity === 'bold'
          ? 'Há espaço para uma silhueta mais definida e texturas com presença — combine com um profissional de confiança.'
          : 'Busque um meio-termo: estrutura clara, acabamento cuidado e flexibilidade para o dia a dia.',
      'Leve as imagens de referência e este resumo ao cabeleireiro ou barbeiro.',
    ].join(' '),
    beardRecommendations:
      q.useBeard === false
        ? 'Se não usa barba, mantenha contornos limpos e pele cuidada para reforçar a leitura da imagem.'
        : 'Se usar barba, alinhe comprimento e geometria ao corte de cabelo: linhas limpas transmitem mais intenção e cuidado.',
    // Campo legado no schema; serviço foca em cabelo e barba.
    makeupRecommendations: '',
    accessoriesRecommendations:
      q.useGlasses === true || q.useAccessories === true
        ? 'Óculos e acessórios devem seguir a mesma linguagem do visual (mais clássico ou mais contemporâneo), sem competir com o rosto.'
        : 'Acessórios mínimos e bem escolhidos (relógio, colar fino, óculos) ajudam a fechar a narrativa da imagem.',
    maintenancePlan: `Plano de manutenção ${maintPt}: combine rotina diária simples (higiene, finalização rápida) com revisões periódicas no salão conforme o crescimento do cabelo/barba.`,
    salonBrief: [
      `Cliente: ${input.customerName}.`,
      `Objetivo principal: ${primaryObj}.`,
      `Contexto: ${primaryCtx}.`,
      `Intensidade da mudança: ${intensityPt}.`,
      `Manutenção aceitável: ${maintPt}.`,
      'Usar imagens geradas apenas como referência estética; adaptar à densidade, textura e saúde capilar reais.',
    ].join(' '),
    styleDirections: directions,
    disclaimerVersion: DISCLAIMER_VERSION,
  };

  return {
    data,
    source: 'template_fallback',
    costUsdMicros: 0,
    latencyMs: Date.now() - started,
    modelId: 'template-v1',
  };
}

function buildDirections(
  imageCount: number,
  ctx: {
    primaryObj: string;
    primaryCtx: string;
    intensityPt: string;
    maintPt: string;
  },
) {
  const catalog = [
    {
      key: 'classic_clean',
      title: 'Clássico limpo',
      brief: `Leitura profissional e ordenada, alinhada a ${ctx.primaryObj.toLowerCase()}.`,
      imagePrompt: styleImagePromptFromDirection({
        title: 'Clássico limpo',
        brief:
          'Clean classic hairstyle, neat beard edges if present, professional grooming, keep same face and pose from the client photo.',
      }),
      maintenance: 'low' as const,
    },
    {
      key: 'modern_textured',
      title: 'Moderno texturizado',
      brief: 'Visual contemporâneo com textura controlada e presença atual.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Moderno texturizado',
        brief:
          'Modern textured hair with controlled volume, contemporary finish, optional tidy beard; same person as reference photo.',
      }),
      maintenance: 'medium' as const,
    },
    {
      key: 'soft_approachable',
      title: 'Suave e acessível',
      brief: 'Aparência acolhedora, menos rígida, boa para redes e encontros.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Suave e acessível',
        brief:
          'Softer, approachable hairstyle, less rigid lines, friendly but neutral expression kept from the original photo.',
      }),
      maintenance: 'low' as const,
    },
    {
      key: 'authority_structure',
      title: 'Estrutura e autoridade',
      brief: 'Linhas definidas e acabamento firme para transmitir segurança.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Estrutura e autoridade',
        brief:
          'Structured authoritative haircut with sharp silhouette, defined beard geometry if any; preserve exact facial identity.',
      }),
      maintenance: 'medium' as const,
    },
    {
      key: 'creative_edge',
      title: 'Toque criativo',
      brief: 'Detalhe de personalidade sem perder usabilidade no dia a dia.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Toque criativo',
        brief:
          'Creative but wearable hairstyle with subtle edge; only hair/beard change on the same face.',
      }),
      maintenance: 'high' as const,
    },
    {
      key: 'balanced_daily',
      title: 'Equilíbrio cotidiano',
      brief: `Versão versátil para ${ctx.primaryCtx.toLowerCase()} com manutenção ${ctx.maintPt}.`,
      imagePrompt: styleImagePromptFromDirection({
        title: 'Equilíbrio cotidiano',
        brief:
          'Balanced everyday hairstyle, versatile styling, low-friction maintenance; same client identity and background feel.',
      }),
      maintenance: 'medium' as const,
    },
    {
      key: 'volume_lift',
      title: 'Volume e leveza',
      brief: 'Mais corpo no topo, contorno limpo nas laterais, leitura jovem e ativa.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Volume e leveza',
        brief:
          'Lifted crown volume, clean sides, light movement; keep the exact same face from the client photo.',
      }),
      maintenance: 'medium' as const,
    },
    {
      key: 'sharp_contour',
      title: 'Contorno definido',
      brief: 'Linhas de corte bem marcadas e barba geometrizada quando houver.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Contorno definido',
        brief:
          'Sharp hair contour lines, precise fade or edge if suitable, defined beard if present; same facial identity.',
      }),
      maintenance: 'medium' as const,
    },
    {
      key: 'natural_texture',
      title: 'Textura natural',
      brief: 'Respeita o movimento natural do cabelo com acabamento cuidado.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Textura natural',
        brief:
          'Natural hair texture emphasized, soft finish, minimal product look; preserve client face and pose.',
      }),
      maintenance: 'low' as const,
    },
    {
      key: 'executive_polish',
      title: 'Polido executivo',
      brief: 'Acabamento premium para reuniões e ambientes formais.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Polido executivo',
        brief:
          'Executive polished hairstyle, refined side part or clean sweep, optional neat short beard; same person as reference.',
      }),
      maintenance: 'medium' as const,
    },
    {
      key: 'weekend_relaxed',
      title: 'Relaxado de fim de semana',
      brief: 'Menos formal, ainda alinhado ao objetivo principal do cliente.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Relaxado de fim de semana',
        brief:
          'Relaxed weekend hairstyle, casual but intentional, light beard stubble ok; keep identity from client photo.',
      }),
      maintenance: 'low' as const,
    },
    {
      key: 'statement_length',
      title: 'Comprimento com presença',
      brief: 'Variação de comprimento que reforça personalidade sem perder usabilidade.',
      imagePrompt: styleImagePromptFromDirection({
        title: 'Comprimento com presença',
        brief:
          'Statement hair length variation, still wearable daily, coherent beard pairing if any; same face as reference.',
      }),
      maintenance: 'high' as const,
    },
  ];

  // Premium pede até 12; repete com leve variação de key se ultrapassar o catálogo
  const n = Math.max(1, Math.min(imageCount, 12));
  const out: typeof catalog = [];
  for (let i = 0; i < n; i++) {
    const base = catalog[i % catalog.length]!;
    if (i < catalog.length) {
      out.push(base);
    } else {
      out.push({
        ...base,
        key: `${base.key}_v${Math.floor(i / catalog.length) + 1}`,
        title: `${base.title} (variação)`,
      });
    }
  }
  return out;
}
