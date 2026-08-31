import { buildIdentityEditPrompt } from '../identity-prompt.js';
import { fetchWithTimeout, isRetryableStatus } from './http.js';
import {
  ProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageProvider,
} from './types.js';

/**
 * xAI Grok image generation (OpenAI-compatible style endpoint).
 * Env: XAI_API_KEY, XAI_IMAGE_MODEL
 */
export class XaiImageProvider implements ImageProvider {
  readonly key = 'xai';
  readonly displayName = 'Grok Image (xAI)';

  isConfigured(): boolean {
    return Boolean(process.env.XAI_API_KEY?.trim());
  }

  defaultModelId(): string {
    return process.env.XAI_IMAGE_MODEL?.trim() || 'grok-2-image';
  }

  estimatedCostUsdMicros(): number {
    return Number(process.env.XAI_IMAGE_COST_MICROS ?? 50_000);
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      throw new ProviderError('XAI_API_KEY not set', this.key, false);
    }

    const started = Date.now();
    const modelId = req.modelId || this.defaultModelId();
    const base =
      process.env.XAI_API_BASE?.replace(/\/$/, '') || 'https://api.x.ai/v1';

    const res = await fetchWithTimeout(`${base}/images/generations`, {
      method: 'POST',
      provider: this.key,
      timeoutMs: req.timeoutMs,
      signal: req.abortSignal,
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        // xAI images API atual é text-to-image; reforçamos identidade no texto.
        // Preferir OpenAI edits / Gemini com foto quando disponíveis.
        prompt: buildIdentityEditPrompt({
          stylePrompt: req.prompt,
          title: req.title,
          hasReference: req.referenceImages.length > 0,
          systemTemplate: req.imageSystemPrompt,
        }),
        n: 1,
        response_format: 'b64_json',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(
        `xAI images ${res.status}: ${text.slice(0, 400)}`,
        this.key,
        isRetryableStatus(res.status),
      );
    }

    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = json.data?.[0];
    if (!item) {
      throw new ProviderError('xAI empty image data', this.key, false);
    }

    let imageBuffer: Buffer;
    if (item.b64_json) {
      imageBuffer = Buffer.from(item.b64_json, 'base64');
    } else if (item.url) {
      const imgRes = await fetchWithTimeout(item.url, {
        method: 'GET',
        provider: this.key,
        timeoutMs: 60_000,
      });
      if (!imgRes.ok) {
        throw new ProviderError(
          `xAI image download failed (${imgRes.status})`,
          this.key,
          true,
        );
      }
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new ProviderError('xAI image missing b64/url', this.key, false);
    }

    return {
      provider: this.key,
      modelId,
      imageBuffer,
      mime: sniffMime(imageBuffer),
      latencyMs: Date.now() - started,
      costUsdMicros: this.estimatedCostUsdMicros(),
      rawMeta: {},
    };
  }
}

function sniffMime(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF') return 'image/webp';
  return 'image/png';
}
