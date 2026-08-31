import sharp from 'sharp';
import type { GeneratedImage } from './types.js';

const LABELS = [
  'Clássico limpo',
  'Moderno texturizado',
  'Suave e acessível',
  'Estrutura e autoridade',
  'Toque criativo',
  'Equilíbrio cotidiano',
];

/**
 * Mock: usa a **foto do cliente** como base (quando disponível) e sobrepõe
 * um selo de “simulação”, para o fluxo visual ser realista sem provedor de IA.
 */
export async function generateMockImage(input: {
  title: string;
  caption: string;
  styleKey: string;
  index: number;
  width?: number;
  /** Foto frontal/lateral do cliente */
  referenceBytes?: Buffer;
}): Promise<GeneratedImage> {
  const started = Date.now();
  const width = input.width ?? 1024;
  const height = width;
  const label = LABELS[input.index % LABELS.length] ?? input.title;

  let base: sharp.Sharp;

  if (input.referenceBytes?.length) {
    base = sharp(input.referenceBytes)
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'attention' });
  } else {
    const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#3d342e"/>
  <text x="50%" y="50%" text-anchor="middle" fill="#f7f5f2" font-size="28" font-family="system-ui">Sem foto de referência</text>
</svg>`;
    base = sharp(Buffer.from(svg));
  }

  const overlayH = Math.round(height * 0.18);
  const overlay = Buffer.from(`
<svg width="${width}" height="${overlayH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#211c18" opacity="0.72"/>
  <text x="50%" y="38%" text-anchor="middle" font-family="Georgia, serif" font-size="${Math.round(width * 0.032)}" fill="#d4a853">${escapeXml(input.title || label)}</text>
  <text x="50%" y="68%" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.round(width * 0.022)}" fill="#ebe6df">Simulação sobre a sua foto · mock</text>
</svg>`);

  const buffer = await base
    .composite([{ input: overlay, gravity: 'south' }])
    .webp({ quality: 82 })
    .toBuffer();

  return {
    buffer,
    mime: 'image/webp',
    styleVariationKey: input.styleKey,
    caption: input.caption,
    provider: 'mock',
    modelId: 'mock-image-v1',
    costUsdMicros: 0,
    latencyMs: Date.now() - started,
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
