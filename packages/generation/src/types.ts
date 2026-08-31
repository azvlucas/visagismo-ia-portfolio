import type { QuestionnairePayload } from '@visagismo/shared';

export interface AnalysisResultStructured {
  summary: string;
  perceptionAnalysis: string;
  hairRecommendations: string;
  beardRecommendations: string;
  makeupRecommendations: string;
  accessoriesRecommendations: string;
  maintenancePlan: string;
  salonBrief: string;
  styleDirections: Array<{
    key: string;
    title: string;
    brief: string;
    imagePrompt: string;
    maintenance: 'low' | 'medium' | 'high';
  }>;
  disclaimerVersion: string;
}

export interface AnalysisOutput {
  data: AnalysisResultStructured;
  source: 'llm' | 'template_fallback';
  costUsdMicros: number;
  latencyMs: number;
  modelId?: string;
}

export interface GeneratedImage {
  buffer: Buffer;
  mime: string;
  styleVariationKey: string;
  caption: string;
  provider: string;
  modelId: string;
  costUsdMicros: number;
  latencyMs: number;
}

export interface GenerationJobInput {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  packageName: string;
  imageCount: number;
  questionnaire: Partial<QuestionnairePayload> & Record<string, unknown>;
  cycle: number;
}

export interface GenerationJobResult {
  orderId: string;
  status: 'completed' | 'partially_completed' | 'failed';
  analysis: AnalysisOutput;
  images: GeneratedImage[];
  failureMessagePublic?: string;
}
