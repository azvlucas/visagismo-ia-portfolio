import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runGenerationJob } from './orchestrator.js';
import { MockImageProvider } from './providers/mock.image.js';
import { TemplateAnalysisProvider } from './providers/template.analysis.js';

describe('runGenerationJob with providers', () => {
  it('completes with mock image chain', async () => {
    const costs: string[] = [];
    const result = await runGenerationJob(
      {
        orderId: '00000000-0000-4000-8000-000000000099',
        orderNumber: 'VIS-TEST',
        customerName: 'Ana',
        customerEmail: 'ana@example.com',
        packageName: 'Essencial',
        imageCount: 3,
        questionnaire: {
          objectives: ['confidence'],
          contexts: ['professional'],
          maintenanceTime: 'medium',
          changeIntensity: 'moderate',
        },
        cycle: 1,
      },
      {
        imageProviders: [new MockImageProvider()],
        analysisProvider: new TemplateAnalysisProvider(),
        onCost: (c) => costs.push(`${c.phase}:${c.provider}`),
      },
    );

    assert.equal(result.status, 'completed');
    assert.equal(result.images.length, 3);
    assert.equal(result.analysis.source, 'template_fallback');
    assert.ok(result.images.every((i) => i.provider === 'mock'));
    assert.ok(costs.some((c) => c.startsWith('analysis:')));
    assert.ok(costs.filter((c) => c.startsWith('image:')).length >= 3);
  });

  it('falls back across providers when first fails', async () => {
    const failing: import('./providers/types.js').ImageProvider = {
      key: 'fail',
      displayName: 'Fail',
      isConfigured: () => true,
      defaultModelId: () => 'fail',
      estimatedCostUsdMicros: () => 0,
      generate: async () => {
        throw new Error('boom');
      },
    };

    const result = await runGenerationJob(
      {
        orderId: '00000000-0000-4000-8000-000000000098',
        orderNumber: 'VIS-FB',
        customerName: 'Bo',
        customerEmail: 'bo@example.com',
        packageName: 'Essencial',
        imageCount: 1,
        questionnaire: {
          objectives: ['modern'],
          contexts: ['social_media'],
          maintenanceTime: 'low',
          changeIntensity: 'subtle',
        },
        cycle: 1,
      },
      {
        imageProviders: [failing, new MockImageProvider()],
        analysisProvider: new TemplateAnalysisProvider(),
      },
    );

    assert.equal(result.status, 'completed');
    assert.equal(result.images[0]?.provider, 'mock');
  });
});
