import type { GeneratedImage, GenerationJobInput, GenerationJobResult } from './types.js';
import {
  resolveAnalysisProvider,
  resolveImageProviderChain,
} from './providers/registry.js';
import type { AnalysisProvider, ImageProvider } from './providers/types.js';
import { ProviderError } from './providers/types.js';
import { TemplateAnalysisProvider } from './providers/template.analysis.js';

export interface GenerationOrchestratorOptions {
  imageProviders?: ImageProvider[];
  analysisProvider?: AnalysisProvider;
  /** Reference photos (frontal etc.) for providers that support them */
  referenceImages?: Array<{ bytes: Buffer; mime: string }>;
  /** Max retries per image across providers (each provider once per attempt) */
  maxProviderAttempts?: number;
  imageTimeoutMs?: number;
  /** System prompt de imagem (template admin com {{title}} / {{stylePrompt}}) */
  imageSystemPrompt?: string | null;
  onCost?: (entry: {
    phase: 'analysis' | 'image';
    provider: string;
    modelId: string;
    costUsdMicros: number;
    latencyMs: number;
    orderId: string;
  }) => void;
}

/**
 * Dual-phase pipeline: analysis (LLM or template) → image chain with fallback.
 * Domain rules: completed if ready >= imageCount; partial if 1+; failed if 0.
 */
export async function runGenerationJob(
  input: GenerationJobInput,
  opts: GenerationOrchestratorOptions = {},
): Promise<GenerationJobResult> {
  const imageCount = Math.max(1, Math.min(input.imageCount || 3, 12));
  const imageProviders =
    opts.imageProviders ?? resolveImageProviderChain();
  const analysisProvider =
    opts.analysisProvider ?? resolveAnalysisProvider();
  const template = new TemplateAnalysisProvider();
  const timeoutMs = opts.imageTimeoutMs ?? Number(process.env.IMAGE_TIMEOUT_MS ?? 120_000);
  const refs = opts.referenceImages ?? [];

  // ── Phase 1: Analysis ─────────────────────────────────
  let analysis;
  try {
    analysis = await analysisProvider.analyze({
      orderId: input.orderId,
      customerName: input.customerName,
      questionnaire: input.questionnaire,
      imageCount,
      packageName: input.packageName,
    });
    opts.onCost?.({
      phase: 'analysis',
      provider: analysisProvider.key,
      modelId: analysis.modelId ?? analysisProvider.key,
      costUsdMicros: analysis.costUsdMicros,
      latencyMs: analysis.latencyMs,
      orderId: input.orderId,
    });
  } catch (err) {
    console.warn(
      'Analysis LLM failed — template fallback',
      err instanceof Error ? err.message : err,
    );
    analysis = await template.analyze({
      orderId: input.orderId,
      customerName: input.customerName,
      questionnaire: input.questionnaire,
      imageCount,
      packageName: input.packageName,
    });
    opts.onCost?.({
      phase: 'analysis',
      provider: 'template',
      modelId: 'template-v1',
      costUsdMicros: 0,
      latencyMs: analysis.latencyMs,
      orderId: input.orderId,
    });
  }

  if (!imageProviders.length) {
    return {
      orderId: input.orderId,
      status: 'failed',
      analysis,
      images: [],
      failureMessagePublic:
        'Nenhum provedor de imagem configurado. Defina OPENAI_API_KEY, GEMINI_API_KEY, XAI_API_KEY ou habilite mock.',
    };
  }

  // ── Phase 2: Images (sempre com foto do cliente quando existir) ──
  if (!refs.length) {
    console.warn(
      JSON.stringify({
        generation: 'no_reference_photos',
        orderId: input.orderId,
        warning:
          'Nenhuma foto de referência — simulações ficam genéricas. Upload frontal é obrigatório no fluxo normal.',
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        generation: 'identity_mode',
        orderId: input.orderId,
        referenceCount: refs.length,
        note: 'Providers must edit client photo (hair/beard), not invent a new face',
      }),
    );
  }

  const directions = analysis.data.styleDirections.slice(0, imageCount);
  // Ensure we have enough directions
  while (directions.length < imageCount && analysis.data.styleDirections.length) {
    directions.push(
      analysis.data.styleDirections[
        directions.length % analysis.data.styleDirections.length
      ]!,
    );
  }

  const images: GeneratedImage[] = [];
  const attemptLog: Array<{ style: string; provider: string; ok: boolean; error?: string }> =
    [];

  for (let i = 0; i < directions.length; i++) {
    const d = directions[i]!;
    const prompt =
      d.imagePrompt ||
      `Edit the client photo for "${d.title}": ${d.brief}. Keep the same face; only change haircut and beard.`;

    let produced: GeneratedImage | null = null;

    for (const provider of imageProviders) {
      try {
        const result = await provider.generate({
          orderId: input.orderId,
          jobId: `${input.orderId}:${input.cycle}:${i}`,
          prompt,
          title: d.title,
          styleKey: d.key,
          index: i,
          referenceImages: refs,
          modelId: provider.defaultModelId(),
          width: 1024,
          height: 1024,
          timeoutMs,
          imageSystemPrompt: opts.imageSystemPrompt,
        });

        // Normalize to webp-ish buffer as-is (storage layer can keep original mime)
        produced = {
          buffer: result.imageBuffer,
          mime: result.mime,
          styleVariationKey: d.key,
          caption: d.brief,
          provider: result.provider,
          modelId: result.modelId,
          costUsdMicros: result.costUsdMicros,
          latencyMs: result.latencyMs,
        };

        opts.onCost?.({
          phase: 'image',
          provider: result.provider,
          modelId: result.modelId,
          costUsdMicros: result.costUsdMicros,
          latencyMs: result.latencyMs,
          orderId: input.orderId,
        });

        attemptLog.push({ style: d.key, provider: provider.key, ok: true });
        break;
      } catch (err) {
        const msg =
          err instanceof ProviderError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        console.warn(`Image provider ${provider.key} failed for ${d.key}:`, msg);
        attemptLog.push({
          style: d.key,
          provider: provider.key,
          ok: false,
          error: msg.slice(0, 200),
        });
        // try next provider
      }
    }

    if (produced) images.push(produced);
  }

  const ready = images.length;
  let status: GenerationJobResult['status'];
  let failureMessagePublic: string | undefined;

  if (ready >= imageCount) {
    status = 'completed';
  } else if (ready >= 1) {
    status = 'partially_completed';
    failureMessagePublic =
      'Parte das simulações foi gerada. Você ainda pode usar as recomendações e as imagens disponíveis.';
  } else {
    status = 'failed';
    failureMessagePublic =
      'Não foi possível gerar as simulações nesta tentativa. Nossa equipe pode reprocessar o pedido.';
  }

  if (ready === 0) {
    status = 'failed';
  }

  console.log(
    JSON.stringify({
      generation: 'attempts',
      orderId: input.orderId,
      chain: imageProviders.map((p) => p.key),
      analysis: analysis.source,
      ready,
      attemptLog,
    }),
  );

  return {
    orderId: input.orderId,
    status,
    analysis,
    images,
    failureMessagePublic,
  };
}
