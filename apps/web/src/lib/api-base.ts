/**
 * Base URL da API.
 *
 * - Browser: relative `/api/v1` (rewrite Next → API na rede Docker)
 * - Server (SSR/RSC): URL interna `API_URL=http://api:3001`
 *
 * Nunca chamar a URL pública da API de dentro do container web
 * (hairpin NAT / Traefik → hang → Gateway Timeout no Coolify).
 */

function stripSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function withHttp(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `http://${v}`;
}

/** Destino absoluto usado no servidor (Node). */
export function getServerApiOrigin(): string {
  const internal = withHttp(
    process.env.API_INTERNAL_URL || process.env.API_URL || '',
  );
  if (internal) return stripSlash(internal);

  // Produção Docker: hostname do serviço no compose
  if (process.env.NODE_ENV === 'production') {
    return 'http://api:3001';
  }

  const pub = withHttp(
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  );
  return stripSlash(pub || 'http://localhost:3001');
}

/**
 * Monta URL completa para fetch.
 * Browser → `/api/v1/...` (rewrite same-origin)
 * Server → `http://api:3001/v1/...`
 */
export function apiUrl(path: string): string {
  let p = path.startsWith('/') ? path : `/${path}`;
  // normaliza para sempre ter /v1
  if (!p.startsWith('/v1') && !p.startsWith('/api/')) {
    p = `/v1${p}`;
  }

  if (typeof window !== 'undefined') {
    if (p.startsWith('/api/')) return p;
    if (p.startsWith('/v1/')) return `/api${p}`;
    return `/api/v1${p}`;
  }

  const origin = getServerApiOrigin();
  if (p.startsWith('/v1/')) return `${origin}${p}`;
  if (p.startsWith('/api/v1/')) return `${origin}${p.replace(/^\/api/, '')}`;
  return `${origin}/v1${p}`;
}

/** Timeout curto para não derrubar o Coolify com Gateway Timeout no SSR. */
export function fetchTimeoutSignal(ms = 4000): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}
