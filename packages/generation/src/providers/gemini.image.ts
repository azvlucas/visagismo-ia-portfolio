import { buildIdentityEditPrompt } from '../identity-prompt.js';
import { fetchWithTimeout, isRetryableStatus } from './http.js';
import {
  ProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageProvider,
} from './types.js';

/**
 * Gemini image: envia a **foto do cliente primeiro**, depois a instrução de edição.
 * Env: GEMINI_API_KEY, GEMINI_IMAGE_MODEL
 */
export class GeminiImageProvider implements ImageProvider {
  readonly key = 'gemini';
  readonly displayName = 'Gemini Image';

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }

  defaultModelId(): string {
    return (
      process.env.GEMINI_IMAGE_MODEL?.trim() ||
      'gemini-2.0-flash-preview-image-generation'
    );
  }

  estimatedCostUsdMicros(): number {
    return Number(process.env.GEMINI_IMAGE_COST_MICROS ?? 30_000);
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      throw new ProviderError('GEMINI_API_KEY not set', this.key, false);
    }

    const started = Date.now();
    const modelId = req.modelId || this.defaultModelId();
    const key = process.env.GEMINI_API_KEY!;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(key)}`;

    const parts: Array<Record<string, unknown>> = [];

    // Foto do cliente ANTES do texto — âncora de identidade
    for (const ref of req.referenceImages.slice(0, 2)) {
      parts.push({
        inline_data: {
          mime_type: ref.mime || 'image/jpeg',
          data: ref.bytes.toString('base64'),
        },
      });
    }

    parts.push({
      text: buildIdentityEditPrompt({
        stylePrompt: req.prompt,
        title: req.title,
        hasReference: req.referenceImages.length > 0,
        systemTemplate: req.imageSystemPrompt,
      }),
    });

    if (req.referenceImages.length === 0) {
      parts.unshift({
        text: 'No client photo provided — generate a photorealistic portrait (fallback only).',
      });
    }

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        ...(process.env.GEMINI_IMAGE_ASPECT
          ? {
              imageConfig: {
                aspectRatio: process.env.GEMINI_IMAGE_ASPECT,
              },
            }
          : {}),
      },
    };

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      provider: this.key,
      timeoutMs: req.timeoutMs,
      signal: req.abortSignal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 404 && !modelId.includes('imagen')) {
        return this.tryImagen(req, started);
      }
      throw new ProviderError(
        `Gemini image ${res.status}: ${text.slice(0, 400)}`,
        this.key,
        isRetryableStatus(res.status),
      );
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType?: string; data?: string };
            inline_data?: { mime_type?: string; data?: string };
          }>;
        };
      }>;
    };

    const outParts = json.candidates?.[0]?.content?.parts ?? [];
    for (const part of outParts) {
      const inline = part.inlineData ?? part.inline_data;
      const data = inline?.data;
      if (data) {
        const mime =
          (inline as { mimeType?: string }).mimeType ??
          (inline as { mime_type?: string }).mime_type ??
          'image/png';
        return {
          provider: this.key,
          modelId,
          imageBuffer: Buffer.from(data, 'base64'),
          mime,
          latencyMs: Date.now() - started,
          costUsdMicros: this.estimatedCostUsdMicros(),
          rawMeta: {
            path: 'generateContent',
            refs: req.referenceImages.length,
          },
        };
      }
    }

    throw new ProviderError(
      'Gemini response had no image parts',
      this.key,
      false,
      json,
    );
  }

  private async tryImagen(
    req: ImageGenerationRequest,
    started: number,
  ): Promise<ImageGenerationResult> {
    // Imagen predict clássico é text-only — reforça que é fallback fraco
    const modelId =
      process.env.GEMINI_IMAGEN_MODEL?.trim() || 'imagen-3.0-generate-002';
    const key = process.env.GEMINI_API_KEY!;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:predict?key=${encodeURIComponent(key)}`;

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      provider: this.key,
      timeoutMs: req.timeoutMs,
      signal: req.abortSignal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: buildIdentityEditPrompt({
              stylePrompt: req.prompt,
              title: req.title,
              hasReference: false,
            }),
          },
        ],
        parameters: { sampleCount: 1 },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(
        `Gemini Imagen ${res.status}: ${text.slice(0, 400)}`,
        this.key,
        isRetryableStatus(res.status),
      );
    }

    const json = (await res.json()) as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
    };
    const pred = json.predictions?.[0];
    if (!pred?.bytesBase64Encoded) {
      throw new ProviderError('Imagen empty prediction', this.key, false);
    }

    return {
      provider: this.key,
      modelId,
      imageBuffer: Buffer.from(pred.bytesBase64Encoded, 'base64'),
      mime: pred.mimeType ?? 'image/png',
      latencyMs: Date.now() - started,
      costUsdMicros: this.estimatedCostUsdMicros(),
      rawMeta: { path: 'imagen-predict', identity: 'weak_text_only' },
    };
  }
}
