/**
 * Baixa uma imagem (data URL, blob URL ou URL remota com CORS) para o disco do usuário.
 */
export async function downloadImage(opts: {
  url: string;
  filename: string;
}): Promise<void> {
  const { url, filename } = opts;
  const safeName = sanitizeFilename(filename);

  // data: e blob: — convertidos localmente
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    const res = await fetch(url);
    const blob = await res.blob();
    triggerBlobDownload(blob, safeName);
    return;
  }

  // URL remota (signed R2 etc.): tenta blob para forçar download
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    triggerBlobDownload(blob, safeName);
    return;
  } catch {
    // Fallback: âncora download (pode abrir em nova aba se o host bloquear)
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoga após o browser iniciar o download
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return cleaned || 'simulacao-visagismo.jpg';
}

export function extensionFromUrlOrMime(url: string, mimeHint?: string): string {
  if (mimeHint?.includes('png')) return 'png';
  if (mimeHint?.includes('webp')) return 'webp';
  if (mimeHint?.includes('jpeg') || mimeHint?.includes('jpg')) return 'jpg';
  if (url.startsWith('data:image/png')) return 'png';
  if (url.startsWith('data:image/webp')) return 'webp';
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg'))
    return 'jpg';
  const path = url.split('?')[0] ?? url;
  const m = path.match(/\.(png|jpe?g|webp|gif)$/i);
  if (m) return m[1]!.toLowerCase().replace('jpeg', 'jpg');
  return 'jpg';
}
