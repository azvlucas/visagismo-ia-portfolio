import { buildIdentityEditPrompt } from '../identity-prompt.js';
import { fetchWithTimeout, isRetryableStatus } from './http.js';
import {
  ProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageProvider,
} from './types.js';

/**
 * OpenAI Images — prioriza /v1/images/edits com a foto do cliente.
 * Env: OPENAI_API_KEY, OPENAI_IMAGE_MODEL (default gpt-image-2)
 * OPENAI_IMAGE_FORCE_GENERATIONS=true desliga edits (so text-to-image).
 */
export class OpenAIImageProvider implements ImageProvider {
  readonly key = 'openai';
  readonly displayName = 'OpenAI Image';

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  defaultModelId(): string {
    return process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2';
  }

  estimatedCostUsdMicros(): number {
    return Number(process.env.OPENAI_IMAGE_COST_MICROS ?? 40_000);
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      throw new ProviderError('OPENAI_API_KEY not set', this.key, false);
    }

    const started = Date.now();
    const modelId = req.modelId || this.defaultModelId();
    const size = pickSize(req.width, req.height);
    const hasRef = req.referenceImages.length > 0;
    const forceGen =
      (process.env.OPENAI_IMAGE_FORCE_GENERATIONS ?? '').toLowerCase() ===
      'true';

    let res: Response;
    let mode: 'edits' | 'generations' = 'generations';

    if (hasRef && !forceGen) {
      try {
        res = await this.edits(req, modelId, size);
        mode = 'edits';
        // se edits falhar com 4xx de modelo, tenta generate com prompt de identidade
        if (!res.ok && res.status !== 429 && res.status < 500) {
          const errText = await res.text();
          console.warn(
            'OpenAI images/edits failed, falling back to generations',
            res.status,
            errText.slice(0, 200),
          );
          res = await this.generations(req, modelId, size);
          mode = 'generations';
        }
      } catch (err) {
        console.warn('OpenAI edits threw, trying generations', err);
        res = await this.generations(req, modelId, size);
        mode = 'generations';
      }
    } else {
      res = await this.generations(req, modelId, size);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(
        `OpenAI images ${res.status}: ${text.slice(0, 400)}`,
        this.key,
        isRetryableStatus(res.status),
      );
    }

    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = json.data?.[0];
    if (!item) {
      throw new ProviderError('OpenAI returned empty image data', this.key, false);
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
          `Failed to download OpenAI image URL (${imgRes.status})`,
          this.key,
          true,
        );
      }
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new ProviderError('OpenAI image missing b64/url', this.key, false);
    }

    return {
      provider: this.key,
      modelId,
      imageBuffer,
      mime: sniffMime(imageBuffer),
      latencyMs: Date.now() - started,
      costUsdMicros: this.estimatedCostUsdMicros(),
      rawMeta: { size, hasRef, mode },
    };
  }

  private generations(
    req: ImageGenerationRequest,
    modelId: string,
    size: string,
  ): Promise<Response> {
    return fetchWithTimeout('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      provider: this.key,
      timeoutMs: req.timeoutMs,
      signal: req.abortSignal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        prompt: buildPrompt(req),
        size,
        n: 1,
        ...(modelId.includes('dall-e')
          ? { response_format: 'b64_json' }
          : {}),
      }),
    });
  }

  private async edits(
    req: ImageGenerationRequest,
    modelId: string,
    size: string,
  ): Promise<Response> {
    const ref = req.referenceImages[0]!;
    // API de edits costuma preferir PNG
    const { bytes, mime, filename } = await toPngIfNeeded(ref.bytes, ref.mime);

    const form = new FormData();
    form.set('model', modelId);
    form.set('prompt', buildPrompt(req));
    form.set('size', size);
    form.set('n', '1');
    // gpt-image-* edits often returns b64 by default
    const blob = new Blob([new Uint8Array(bytes)], { type: mime });
    form.set('image', blob, filename);

    return fetchWithTimeout('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      provider: this.key,
      timeoutMs: req.timeoutMs,
      signal: req.abortSignal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    });
  }
}

function buildPrompt(req: ImageGenerationRequest): string {
  return buildIdentityEditPrompt({
    stylePrompt: req.prompt,
    title: req.title,
    hasReference: req.referenceImages.length > 0,
    systemTemplate: req.imageSystemPrompt,
  });
}

function pickSize(w: number, h: number): string {
  if (w >= 1400 || h >= 1400) return '1536x1024';
  return '1024x1024';
}

function sniffMime(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF') return 'image/webp';
  return 'image/png';
}

async function toPngIfNeeded(
  bytes: Buffer,
  mime: string,
): Promise<{ bytes: Buffer; mime: string; filename: string }> {
  const m = (mime || '').toLowerCase();
  if (m.includes('png')) {
    return { bytes, mime: 'image/png', filename: 'reference.png' };
  }
  try {
    const sharp = (await import('sharp')).default;
    const png = await sharp(bytes).rotate().png().toBuffer();
    return { bytes: png, mime: 'image/png', filename: 'reference.png' };
  } catch {
    return {
      bytes,
      mime: m || 'image/jpeg',
      filename: m.includes('webp') ? 'reference.webp' : 'reference.jpg',
    };
  }
}
