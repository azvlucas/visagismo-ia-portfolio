import { Inject, Injectable } from '@nestjs/common';
import { STORAGE } from './storage.tokens.js';
import type { StorageProvider } from './storage.types.js';
import { LocalStorageProvider, randomObjectSuffix } from './local.storage.js';

const PREVIEW_MAX_EDGE = Number(process.env.PREVIEW_MAX_EDGE ?? 720);
const PREVIEW_TIMEOUT_MS = Number(process.env.PREVIEW_TIMEOUT_MS ?? 8_000);

@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE) private readonly provider: StorageProvider) {}

  get name() {
    return this.provider.name;
  }

  getProvider(): StorageProvider {
    return this.provider;
  }

  buildOriginalKey(orderId: string, type: string, ext: string): string {
    return `originals/${orderId}/${type}-${randomObjectSuffix()}.${ext}`;
  }

  mimeToExt(mime: string): string {
    switch (mime) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return 'bin';
    }
  }

  presignPut(input: {
    key: string;
    mime: string;
    bytes: number;
  }) {
    return this.provider.presignPut(input);
  }

  getObject(key: string) {
    return this.provider.getObject(key);
  }

  /**
   * Preview leve para <img src> (JPEG ~720px).
   * Evita Gateway Timeout: não embute originais full-res em base64 no JSON.
   */
  async resolvePreviewUrl(
    keyOrDataUrl: string | null | undefined,
    _mimeHint = 'image/jpeg',
  ): Promise<string | null> {
    if (!keyOrDataUrl) return null;

    try {
      return await withTimeout(
        this.buildPreview(keyOrDataUrl),
        PREVIEW_TIMEOUT_MS,
      );
    } catch (err) {
      console.warn(
        'resolvePreviewUrl failed/timeout',
        keyOrDataUrl.slice(0, 80),
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  private async buildPreview(keyOrDataUrl: string): Promise<string | null> {
    let input: Buffer;

    if (keyOrDataUrl.startsWith('data:')) {
      // data URL já embutida (ex.: mock) — se for enorme, recompacta
      const comma = keyOrDataUrl.indexOf(',');
      if (comma < 0) return null;
      const meta = keyOrDataUrl.slice(0, comma);
      const b64 = keyOrDataUrl.slice(comma + 1);
      if (keyOrDataUrl.length < 400_000 && meta.includes('image/')) {
        return keyOrDataUrl;
      }
      input = Buffer.from(b64, 'base64');
    } else {
      const buf = await this.provider.getObject(keyOrDataUrl);
      if (!buf?.length) return null;
      input = buf;
    }

    try {
      const sharp = (await import('sharp')).default;
      const out = await sharp(input)
        .rotate()
        .resize(PREVIEW_MAX_EDGE, PREVIEW_MAX_EDGE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 72, mozjpeg: true })
        .toBuffer();
      return `data:image/jpeg;base64,${out.toString('base64')}`;
    } catch {
      // fallback sem sharp: só se for pequeno
      if (input.length > 800_000) return null;
      let mime = 'image/jpeg';
      if (input[0] === 0x89 && input[1] === 0x50) mime = 'image/png';
      else if (input[0] === 0x52 && input[1] === 0x49) mime = 'image/webp';
      return `data:${mime};base64,${input.toString('base64')}`;
    }
  }

  headObject(key: string) {
    return this.provider.headObject(key);
  }

  putObject(input: { key: string; body: Buffer; mime: string }) {
    return this.provider.putObject(input);
  }

  asLocal(): LocalStorageProvider | null {
    return this.provider.name === 'local'
      ? (this.provider as LocalStorageProvider)
      : null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
