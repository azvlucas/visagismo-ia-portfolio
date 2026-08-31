import type { QuestionnairePayload } from '@visagismo/shared';
import type { AnalysisOutput, AnalysisResultStructured } from '../types.js';

export interface ImageGenerationRequest {
  orderId: string;
  jobId: string;
  prompt: string;
  /** Optional title for mock/UI labels */
  title?: string;
  styleKey?: string;
  index?: number;
  referenceImages: Array<{ bytes: Buffer; mime: string }>;
  modelId: string;
  width: number;
  height: number;
  timeoutMs: number;
  abortSignal?: AbortSignal;
  /**
   * Template do system prompt de imagem (admin).
   * Placeholders: {{title}}, {{stylePrompt}}
   */
  imageSystemPrompt?: string | null;
}

export interface ImageGenerationResult {
  provider: string;
  modelId: string;
  imageBuffer: Buffer;
  mime: string;
  latencyMs: number;
  costUsdMicros: number;
  rawMeta: Record<string, unknown>;
}

export interface ImageProvider {
  readonly key: string;
  readonly displayName: string;
  isConfigured(): boolean;
  defaultModelId(): string;
  /** Estimated cost per image in micro-USD */
  estimatedCostUsdMicros(modelId?: string): number;
  generate(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface AnalysisRequest {
  orderId: string;
  customerName: string;
  questionnaire: Partial<QuestionnairePayload> & Record<string, unknown>;
  imageCount: number;
  packageName?: string;
}

export interface AnalysisProvider {
  readonly key: string;
  readonly displayName: string;
  isConfigured(): boolean;
  analyze(req: AnalysisRequest): Promise<AnalysisOutput>;
}

export type ProviderHealth = {
  key: string;
  displayName: string;
  kind: 'image' | 'text';
  configured: boolean;
  enabled: boolean;
  defaultModelId: string;
  estimatedCostUsdMicros: number;
};

export class ProviderError extends Error {
  readonly provider: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    provider: string,
    retryable: boolean,
    cause?: unknown,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'ProviderError';
    this.provider = provider;
    this.retryable = retryable;
  }
}

export type { AnalysisOutput, AnalysisResultStructured };
