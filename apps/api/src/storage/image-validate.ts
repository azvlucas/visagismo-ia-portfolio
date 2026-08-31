import {
  ALLOWED_PHOTO_MIMES,
  MAX_PHOTO_BYTES,
  MIN_PHOTO_EDGE_PX,
  type AllowedPhotoMime,
} from '@visagismo/shared';

export interface ImageValidationResult {
  ok: boolean;
  hardErrors: string[];
  warnings: string[];
  mime: AllowedPhotoMime | null;
  width: number | null;
  height: number | null;
  bytes: number;
  checksumSha256: string | null;
}

function detectMimeFromMagic(buf: Buffer): AllowedPhotoMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  // RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Soft validation: hard-fail on format/size/magic; warnings for small/blurry.
 * Never hard-fails solely on missing face (MVP decision).
 */
export async function validateImageBuffer(
  buf: Buffer,
  expectedMime?: string,
): Promise<ImageValidationResult> {
  const { createHash } = await import('node:crypto');
  const hardErrors: string[] = [];
  const warnings: string[] = [];
  const bytes = buf.length;

  if (bytes <= 0) {
    hardErrors.push('Arquivo vazio.');
  }
  if (bytes > MAX_PHOTO_BYTES) {
    hardErrors.push('Arquivo excede 10 MB.');
  }

  const magicMime = detectMimeFromMagic(buf);
  if (!magicMime) {
    hardErrors.push('Formato inválido. Use JPEG, PNG ou WebP.');
  } else if (
    expectedMime &&
    expectedMime !== magicMime &&
    // jpeg aliases
    !(expectedMime === 'image/jpeg' && magicMime === 'image/jpeg')
  ) {
    hardErrors.push(
      `Tipo do arquivo (${magicMime}) difere do informado (${expectedMime}).`,
    );
  }

  if (!ALLOWED_PHOTO_MIMES.includes(magicMime as AllowedPhotoMime) && magicMime) {
    hardErrors.push('MIME não permitido.');
  }

  let width: number | null = null;
  let height: number | null = null;

  if (hardErrors.length === 0 && magicMime) {
    try {
      const sharpMod = await import('sharp');
      const sharp = sharpMod.default ?? sharpMod;
      const meta = await sharp(buf, { failOn: 'none', unlimited: true }).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;

      if (width && height) {
        const minEdge = Math.min(width, height);
        if (minEdge < MIN_PHOTO_EDGE_PX) {
          warnings.push(
            `Resolução baixa (${width}×${height}). Prefira ao menos ${MIN_PHOTO_EDGE_PX}px no lado menor para melhor resultado.`,
          );
        }
        if (width < 400 || height < 400) {
          warnings.push(
            'A imagem parece pequena. Use boa iluminação e enquadre o rosto com nitidez.',
          );
        }
      } else {
        warnings.push('Não foi possível ler as dimensões da imagem.');
      }

      // crude blur proxy via stats — optional soft signal
      try {
        const stats = await sharp(buf, { failOn: 'none' }).greyscale().stats();
        const channels = stats.channels[0];
        if (channels && channels.stdev < 12) {
          warnings.push(
            'A foto parece pouco nítida ou com pouca textura. Tente melhor iluminação e foque no rosto.',
          );
        }
      } catch {
        // ignore soft stats failures
      }
    } catch (err) {
      // Soft: magic bytes already OK — do not hard-fail on sharp issues (native/version).
      console.warn('image-validate sharp warning', err);
      warnings.push(
        'Não foi possível analisar qualidade avançada da imagem; o arquivo foi aceito pelo formato.',
      );
    }
  }

  // Soft guidance — never a hard error in MVP
  warnings.push(
    'Dica: rosto visível, sem filtros e expressão neutra melhoram a análise.',
  );

  const checksumSha256 =
    hardErrors.length === 0
      ? createHash('sha256').update(buf).digest('hex')
      : null;

  return {
    ok: hardErrors.length === 0,
    hardErrors,
    warnings: [...new Set(warnings)],
    mime: magicMime,
    width,
    height,
    bytes,
    checksumSha256,
  };
}
