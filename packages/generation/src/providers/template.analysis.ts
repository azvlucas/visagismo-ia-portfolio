import { runTemplateAnalysis } from '../analysis-template.js';
import type { AnalysisOutput } from '../types.js';
import type { AnalysisProvider, AnalysisRequest } from './types.js';

export class TemplateAnalysisProvider implements AnalysisProvider {
  readonly key = 'template';
  readonly displayName = 'Template fallback';

  isConfigured(): boolean {
    return true;
  }

  async analyze(req: AnalysisRequest): Promise<AnalysisOutput> {
    return runTemplateAnalysis({
      customerName: req.customerName,
      questionnaire: req.questionnaire,
      imageCount: req.imageCount,
    });
  }
}
