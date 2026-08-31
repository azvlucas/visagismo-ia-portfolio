import { apiUrl } from '@/lib/api-base';

/** Browser: /api/v1 (rewrite). Server: API_URL interna Docker (http://api:3001). */
function url(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return apiUrl(`/v1${p}`);
}

export type PublicOrder = {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  customerName: string;
  customerEmail: string;
  /** Código de 6 dígitos (quando a sessão do pedido está ativa). */
  accessCode?: string;
  package: {
    id: string;
    slug: string;
    name: string;
    priceCents: number;
    estimatedSlaHours?: number;
    imageCount?: number;
  };
  questionnaire: Record<string, unknown>;
  questionnaireCompletedAt: string | null;
  consentPrivacyAt: string | null;
  consentImageProcessingAt: string | null;
  marketingOptInAt: string | null;
  ageAttestedAt: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  failureMessagePublic?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

async function parseResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? (data as ApiError).error.message
        : `Erro HTTP ${res.status}`;
    const code =
      data && typeof data === 'object' && 'error' in data
        ? (data as ApiError).error.code
        : 'INTERNAL_ERROR';
    throw new Error(`${code}: ${message}`);
  }
  return data as T;
}

export async function createOrder(input: {
  name: string;
  email: string;
  emailConfirm: string;
  packageId?: string;
  packageSlug?: string;
}): Promise<PublicOrder> {
  const res = await fetch(url('/public/orders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  return parseResponse<PublicOrder>(res);
}

export async function accessOrderByEmailAndCode(input: {
  email: string;
  accessCode: string;
}): Promise<{ ok: boolean; order: PublicOrder; resultPath: string }> {
  const res = await fetch(url('/public/orders/access'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  return parseResponse(res);
}

export async function patchOrder(
  orderId: string,
  body: Record<string, unknown>,
): Promise<PublicOrder> {
  const res = await fetch(url(`/public/orders/${orderId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parseResponse<PublicOrder>(res);
}

export async function getOrder(orderId: string): Promise<PublicOrder> {
  const res = await fetch(url(`/public/orders/${orderId}`), {
    method: 'GET',
    credentials: 'include',
  });
  return parseResponse<PublicOrder>(res);
}

export type PublicPhoto = {
  id: string;
  type: 'frontal' | 'lateral' | 'extra';
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  confirmed: boolean;
  confirmedAt: string | null;
  createdAt: string;
};

export type PresignResponse = {
  photoId: string;
  type: string;
  provider: 'r2' | 'local';
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  method: 'PUT';
  storage: string;
};

export async function listPhotos(orderId: string): Promise<PublicPhoto[]> {
  const res = await fetch(url(`/public/orders/${orderId}/photos`), {
    method: 'GET',
    credentials: 'include',
  });
  return parseResponse<PublicPhoto[]>(res);
}

function resolveClientMime(file: File): string {
  const t = (file.type || '').toLowerCase();
  if (t === 'image/jpg' || t === 'image/jpeg') return 'image/jpeg';
  if (t === 'image/png' || t === 'image/webp') return t;
  const n = file.name.toLowerCase();
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.heic') || n.endsWith('.heif') || t.includes('heic') || t.includes('heif')) {
    return 'image/heic';
  }
  return t;
}

export async function uploadPhoto(input: {
  orderId: string;
  type: 'frontal' | 'lateral' | 'extra';
  file: File;
}): Promise<{ photo: PublicPhoto; warnings: string[] }> {
  const mime = resolveClientMime(input.file);
  if (mime === 'image/heic' || mime.includes('heic') || mime.includes('heif')) {
    throw new Error(
      'PHOTO_VALIDATION_FAILED: No iPhone, envie em JPEG (Ajustes → Câmera → Formatos → Mais compatível) ou converta a foto antes.',
    );
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new Error(
      'PHOTO_VALIDATION_FAILED: Use JPEG, PNG ou WebP. Formato atual não suportado.',
    );
  }
  if (input.file.size > 10 * 1024 * 1024) {
    throw new Error('PHOTO_VALIDATION_FAILED: Arquivo excede 10 MB.');
  }
  if (input.file.size < 1024) {
    throw new Error('PHOTO_VALIDATION_FAILED: Arquivo muito pequeno ou inválido.');
  }

  // Upload same-origin via rewrite Next → API (sem PUT no R2 no browser).
  // Corrige "Load failed" por CORS no mobile/Safari.
  const form = new FormData();
  form.append(
    'file',
    input.file,
    input.file.name || `${input.type}.jpg`,
  );

  try {
    const res = await fetch(
      url(
        `/public/orders/${input.orderId}/photos/upload?type=${encodeURIComponent(input.type)}`,
      ),
      {
        method: 'POST',
        body: form,
        credentials: 'include',
      },
    );
    return await parseResponse<{ photo: PublicPhoto; warnings: string[] }>(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/load failed|failed to fetch|networkerror/i.test(msg)) {
      throw new Error(
        'PHOTO_VALIDATION_FAILED: Falha de rede no envio. Verifique a conexão e tente de novo. Se persistir, use Wi‑Fi e JPEG.',
      );
    }
    throw err;
  }
}

export type CheckoutResponse = {
  order: PublicOrder;
  payment: {
    id: string;
    status: string;
    amountCents: number;
    preferenceId: string | null;
    initPoint: string | null;
    sandboxInitPoint: string | null;
    mock: boolean;
    /** true quando admin habilitou free_generation_enabled */
    free?: boolean;
  };
};

export async function checkoutOrder(orderId: string): Promise<CheckoutResponse> {
  const res = await fetch(url(`/public/orders/${orderId}/checkout`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: '{}',
  });
  return parseResponse<CheckoutResponse>(res);
}

export async function mockApprovePayment(orderId: string): Promise<{
  applied: string;
  order: PublicOrder | null;
}> {
  const res = await fetch(url(`/public/orders/${orderId}/mock-approve`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: '{}',
  });
  return parseResponse(res);
}

export async function syncPayment(
  orderId: string,
  paymentId?: string,
): Promise<{ applied: string; order: PublicOrder | null }> {
  const res = await fetch(url(`/public/orders/${orderId}/sync-payment`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(paymentId ? { paymentId } : {}),
  });
  return parseResponse(res);
}

export type OrderResultResponse = {
  order: PublicOrder;
  result: {
    summary: string;
    perceptionAnalysis: string;
    hairRecommendations: string;
    beardRecommendations: string;
    makeupRecommendations: string;
    accessoriesRecommendations: string;
    maintenancePlan: string;
    salonBrief: string;
    styleDirections: Array<{
      key: string;
      title: string;
      brief: string;
      imagePrompt: string;
      maintenance: string;
    }>;
    disclaimerVersion: string;
    analysisSource: string;
    images: Array<{
      id: string;
      styleVariationKey: string;
      caption: string;
      provider: string;
      modelId: string;
      sortOrder: number;
      status: string;
      url: string | null;
    }>;
  } | null;
  /** Fotos enviadas pelo cliente (frontal/lateral) com preview */
  originalPhotos?: Array<{
    id: string;
    type: string;
    mime: string;
    bytes: number;
    width: number | null;
    height: number | null;
    url: string | null;
  }>;
  viewer?: 'admin' | 'customer';
  email: {
    subject: string;
    kind: string;
    resultUrl: string;
    sentAt: string;
  } | null;
};

export async function getOrderResult(
  orderId: string,
): Promise<OrderResultResponse> {
  const headers: HeadersInit = {};
  // Admin logado: Bearer (localStorage) — funciona em nova aba sem order_session do cliente
  if (typeof window !== 'undefined') {
    const adminToken =
      localStorage.getItem('admin_access_token') ||
      sessionStorage.getItem('admin_access_token');
    if (adminToken) {
      headers.Authorization = `Bearer ${adminToken}`;
    }
  }
  const res = await fetch(url(`/public/orders/${orderId}/result`), {
    method: 'GET',
    credentials: 'include',
    headers,
  });
  return parseResponse<OrderResultResponse>(res);
}


