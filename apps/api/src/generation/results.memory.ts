import type { AnalysisResultStructured } from '@visagismo/generation';

export interface ResultImageRecord {
  id: string;
  orderId: string;
  r2Key: string;
  thumbR2Key: string | null;
  styleVariationKey: string;
  caption: string;
  provider: string;
  modelId: string;
  sortOrder: number;
  status: 'ready' | 'failed';
  /** data URL for local mock delivery without CDN */
  dataUrl?: string;
}

export interface OrderResultRecord {
  id: string;
  orderId: string;
  schemaVersion: number;
  summary: string;
  perceptionAnalysis: string;
  hairRecommendations: string;
  beardRecommendations: string;
  makeupRecommendations: string;
  accessoriesRecommendations: string;
  maintenancePlan: string;
  salonBrief: string;
  styleDirections: AnalysisResultStructured['styleDirections'];
  disclaimerVersion: string;
  analysisSource: 'llm' | 'template_fallback';
  rawAnalysisJson: unknown;
  images: ResultImageRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailLogRecord {
  id: string;
  orderId: string;
  to: string;
  subject: string;
  kind: 'success' | 'partial' | 'failure';
  bodyText: string;
  resultUrl: string;
  createdAt: Date;
}

const resultsByOrder = new Map<string, OrderResultRecord>();
const emails: EmailLogRecord[] = [];

export const memoryResults = {
  save(result: OrderResultRecord) {
    resultsByOrder.set(result.orderId, result);
  },
  getByOrder(orderId: string) {
    return resultsByOrder.get(orderId) ?? null;
  },
};

export const memoryEmails = {
  save(row: EmailLogRecord) {
    emails.push(row);
  },
  listByOrder(orderId: string) {
    return emails.filter((e) => e.orderId === orderId);
  },
  latest(orderId: string) {
    const list = this.listByOrder(orderId);
    return list[list.length - 1] ?? null;
  },
};
