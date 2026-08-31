import { generateMockImage } from '../mock-image.js';
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from './types.js';

export class MockImageProvider implements ImageProvider {
  readonly key = 'mock';
  readonly displayName = 'Mock (local)';

  isConfigured(): boolean {
    return true;
  }

  defaultModelId(): string {
    return process.env.MOCK_IMAGE_MODEL_ID ?? 'mock-image-v1';
  }

  estimatedCostUsdMicros(): number {
    return 0;
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const started = Date.now();
    const ref = req.referenceImages[0];
    const img = await generateMockImage({
      title: req.title ?? 'Proposta',
      caption: req.prompt.slice(0, 120),
      styleKey: req.styleKey ?? 'style',
      index: req.index ?? 0,
      width: req.width || 1024,
      referenceBytes: ref?.bytes,
    });

    return {
      provider: this.key,
      modelId: this.defaultModelId(),
      imageBuffer: img.buffer,
      mime: img.mime,
      latencyMs: Date.now() - started,
      costUsdMicros: 0,
      rawMeta: {
        mock: true,
        identityBase: Boolean(ref?.bytes?.length),
      },
    };
  }
}
