import { runTemplateAnalysis } from '../analysis-template.js';
import type { AnalysisOutput } from '../types.js';
import { fetchWithTimeout, isRetryableStatus } from './http.js';
import {
  ProviderError,
  type AnalysisProvider,
  type AnalysisRequest,
} from './types.js';

/**
 * LLM analysis via OpenAI Chat Completions → JSON.
 * Falls back to template on any failure when used through LlmAnalysisProvider wrapper.
 */
export class OpenAIAnalysisProvider implements AnalysisProvider {
  readonly key = 'openai-text';
  readonly displayName = 'OpenAI Text (analysis)';

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  async analyze(req: AnalysisRequest): Promise<AnalysisOutput> {
    if (!this.isConfigured()) {
      throw new ProviderError('OPENAI_API_KEY not set', this.key, false);
    }

    const started = Date.now();
    const model =
      process.env.OPENAI_ANALYSIS_MODEL?.trim() || 'gpt-4o-mini';

    const system = `Você é consultor(a) de visagismo no Brasil, focado em CABELO e BARBA (pelo facial). Responda APENAS JSON válido no schema:
{
  "summary": string,
  "perceptionAnalysis": string,
  "hairRecommendations": string,
  "beardRecommendations": string,
  "makeupRecommendations": string,
  "accessoriesRecommendations": string,
  "maintenancePlan": string,
  "salonBrief": string,
  "styleDirections": [{"key": string, "title": string, "brief": string, "imagePrompt": string, "maintenance": "low"|"medium"|"high"}]
}
Escopo: apenas cabelo (corte, comprimento, volume, textura, finalização) e barba/pelo facial quando aplicável.
NÃO recomende maquiagem. O campo makeupRecommendations deve ser sempre "".
Tom profissional, empático, acionável. Não invente condições médicas.
Gere exatamente ${req.imageCount} styleDirections.
Cada imagePrompt (em inglês) deve ser para EDIÇÃO da foto real do cliente:
- manter o mesmo rosto, identidade, pose e fundo
- alterar apenas corte de cabelo, barba/pelo facial e finalização
- NÃO alterar maquiagem
- NUNCA pedir um retrato genérico gerado do zero
Exemplo: Edit the client photo: keep the same face, apply a short textured crop and a neat short beard.`;

    const user = JSON.stringify({
      customerName: req.customerName,
      packageName: req.packageName,
      questionnaire: req.questionnaire,
    });

    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        provider: this.key,
        timeoutMs: Number(process.env.ANALYSIS_TIMEOUT_MS ?? 60_000),
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(
        `OpenAI analysis ${res.status}: ${text.slice(0, 300)}`,
        this.key,
        isRetryableStatus(res.status),
      );
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new ProviderError('Empty analysis content', this.key, false);
    }

    const parsed = JSON.parse(content) as AnalysisOutput['data'];
    if (!parsed.summary || !Array.isArray(parsed.styleDirections)) {
      throw new ProviderError('Invalid analysis JSON shape', this.key, false);
    }

    // Ensure disclaimer
    parsed.disclaimerVersion = parsed.disclaimerVersion || '2026-07-v1';
    // Escopo do produto: cabelo + barba (campo legado permanece vazio)
    parsed.makeupRecommendations = '';

    // Pad/truncate directions
    const template = runTemplateAnalysis({
      customerName: req.customerName,
      questionnaire: req.questionnaire,
      imageCount: req.imageCount,
    });
    while (parsed.styleDirections.length < req.imageCount) {
      const fill =
        template.data.styleDirections[parsed.styleDirections.length];
      if (!fill) break;
      parsed.styleDirections.push(fill);
    }
    parsed.styleDirections = parsed.styleDirections.slice(0, req.imageCount);

    return {
      data: parsed,
      source: 'llm',
      costUsdMicros: Number(process.env.OPENAI_ANALYSIS_COST_MICROS ?? 2_000),
      latencyMs: Date.now() - started,
      modelId: model,
    };
  }
}
