import { GeminiImageProvider } from './gemini.image.js';
import { MockImageProvider } from './mock.image.js';
import { OpenAIAnalysisProvider } from './openai.analysis.js';
import { OpenAIImageProvider } from './openai.image.js';
import { TemplateAnalysisProvider } from './template.analysis.js';
import type {
  AnalysisProvider,
  ImageProvider,
  ProviderHealth,
} from './types.js';
import { XaiImageProvider } from './xai.image.js';

export function createImageProviders(): ImageProvider[] {
  return [
    new OpenAIImageProvider(),
    new GeminiImageProvider(),
    new XaiImageProvider(),
    new MockImageProvider(),
  ];
}

export function createAnalysisProviders(): AnalysisProvider[] {
  return [new OpenAIAnalysisProvider(), new TemplateAnalysisProvider()];
}

/**
 * Resolve ordered image provider chain.
 * IMAGE_PROVIDER_CHAIN=openai,gemini,xai,mock
 * Default: all configured real providers, then mock.
 * IMAGE_ALLOW_MOCK=false disables mock (production).
 */
export function resolveImageProviderChain(
  providers = createImageProviders(),
): ImageProvider[] {
  const allowMock =
    (process.env.IMAGE_ALLOW_MOCK ?? 'true').toLowerCase() !== 'false';
  const chainEnv = process.env.IMAGE_PROVIDER_CHAIN?.trim();

  let ordered: ImageProvider[];
  if (chainEnv) {
    const keys = chainEnv.split(',').map((s) => s.trim().toLowerCase());
    ordered = keys
      .map((k) => providers.find((p) => p.key === k))
      .filter((p): p is ImageProvider => Boolean(p));
  } else {
    const reals = providers.filter((p) => p.key !== 'mock' && p.isConfigured());
    const mock = providers.find((p) => p.key === 'mock');
    ordered = [...reals];
    if (allowMock && mock) ordered.push(mock);
    if (ordered.length === 0 && mock) ordered = [mock];
  }

  // Keep only configured (mock always configured)
  ordered = ordered.filter((p) => p.isConfigured());
  if (!allowMock) {
    ordered = ordered.filter((p) => p.key !== 'mock');
  }

  return ordered;
}

export function resolveAnalysisProvider(
  providers = createAnalysisProviders(),
): AnalysisProvider {
  // Prefer first configured non-template, else template
  const llm = providers.find((p) => p.key !== 'template' && p.isConfigured());
  if (llm) return llm;
  return providers.find((p) => p.key === 'template') ?? new TemplateAnalysisProvider();
}

export function getProvidersHealth(): ProviderHealth[] {
  const images = createImageProviders();
  const analysis = createAnalysisProviders();
  const chain = new Set(resolveImageProviderChain(images).map((p) => p.key));

  return [
    ...images.map((p) => ({
      key: p.key,
      displayName: p.displayName,
      kind: 'image' as const,
      configured: p.isConfigured(),
      enabled: chain.has(p.key),
      defaultModelId: p.defaultModelId(),
      estimatedCostUsdMicros: p.estimatedCostUsdMicros(),
    })),
    ...analysis.map((p) => ({
      key: p.key,
      displayName: p.displayName,
      kind: 'text' as const,
      configured: p.isConfigured(),
      enabled:
        p.key === 'template' ||
        (p.key !== 'template' && p.isConfigured()),
      defaultModelId:
        p.key === 'openai-text'
          ? process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini'
          : 'template-v1',
      estimatedCostUsdMicros:
        p.key === 'openai-text'
          ? Number(process.env.OPENAI_ANALYSIS_COST_MICROS ?? 2_000)
          : 0,
    })),
  ];
}
