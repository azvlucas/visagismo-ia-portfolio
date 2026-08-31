import { apiUrl } from '@/lib/api-base';

/** Browser: /api/v1 (rewrite). Server: API interna Docker. */
function url(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return apiUrl(`/v1${p}`);
}

const TOKEN_KEY = 'admin_access_token';
const USER_KEY = 'admin_user';

/**
 * localStorage (não sessionStorage): novas abas “Abrir resultado” precisam do token.
 * sessionStorage não é compartilhado entre abas.
 */
export function getAdminAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY) ||
    null
  );
}

function setAdminSession(accessToken: string, user: AdminUser) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // limpa legado sessionStorage
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function clearAdminSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function authHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = getAdminAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data
        ? (data as { error: { message: string } }).error.message
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export type AdminUser = {
  id: string;
  email: string;
  role: string;
};

export async function adminLogin(email: string, password: string) {
  const res = await fetch(url('/admin/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await parse<{
    accessToken: string;
    expiresIn: number;
    user: AdminUser;
  }>(res);
  if (typeof window !== 'undefined') {
    setAdminSession(data.accessToken, data.user);
  }
  return data;
}

export function adminLogoutLocal() {
  if (typeof window !== 'undefined') {
    clearAdminSession();
  }
}

export function getStoredAdminUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw =
    localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export async function adminMe() {
  const res = await fetch(url('/admin/auth/me'), {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  return parse<{ user: AdminUser }>(res);
}

export async function adminMetrics() {
  const res = await fetch(url('/admin/metrics/overview'), {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  return parse<{
    totals: Record<string, number>;
    byStatus: Record<string, number>;
    generatedAt: string;
  }>(res);
}

export async function adminListOrders(params?: {
  status?: string;
  email?: string;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.email) qs.set('email', params.email);
  if (params?.q) qs.set('q', params.q);
  const q = qs.toString();
  const res = await fetch(url(`/admin/orders${q ? `?${q}` : ''}`), {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  return parse<
    Array<{
      id: string;
      orderNumber: string;
      status: string;
      statusLabel: string;
      customerName: string;
      customerEmail: string;
      packageName: string;
      package: { name: string; priceCents: number };
      paidAt: string | null;
      createdAt: string;
    }>
  >(res);
}

export async function adminGetOrder(id: string) {
  const res = await fetch(url(`/admin/orders/${id}`), {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  return parse<Record<string, unknown>>(res);
}

export async function adminReprocessOrder(id: string) {
  const res = await fetch(url(`/admin/orders/${id}/reprocess`), {
    method: 'POST',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: '{}',
  });
  return parse<{ ok: boolean }>(res);
}

export async function adminCancelOrder(id: string) {
  const res = await fetch(url(`/admin/orders/${id}/cancel`), {
    method: 'POST',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: '{}',
  });
  return parse<{ ok: boolean }>(res);
}

/** Aprova pagamento manualmente (aguardando / pendente) e enfileira geração. */
export async function adminApprovePayment(
  id: string,
  input?: { note?: string; externalPaymentId?: string },
) {
  const res = await fetch(url(`/admin/orders/${id}/approve-payment`), {
    method: 'POST',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  });
  return parse<{
    applied: string;
    order: { id: string; status: string; statusLabel: string };
    payment?: { id: string; status: string; externalPaymentId: string | null };
    queue?: string;
  }>(res);
}

export async function adminListPackages() {
  const res = await fetch(url('/admin/packages'), {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  return parse<
    Array<{
      id: string;
      slug: string;
      name: string;
      priceCents: number;
      imageCount: number;
      isActive: boolean;
      isFeatured: boolean;
      sortOrder: number;
      promoText: string | null;
    }>
  >(res);
}

export async function adminUpdatePackage(
  id: string,
  patch: Record<string, unknown>,
) {
  const res = await fetch(url(`/admin/packages/${id}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parse(res);
}

export function formatBrl(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export async function adminAiProviders() {
  const res = await fetch(url('/admin/ai/providers'), {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  return parse<{
    providers: Array<{
      key: string;
      displayName: string;
      kind: 'image' | 'text';
      configured: boolean;
      enabled: boolean;
      defaultModelId: string;
      estimatedCostUsdMicros: number;
    }>;
    chain: string;
    allowMock: boolean;
    envHints: Record<string, string | boolean>;
  }>(res);
}

export async function adminAiCosts() {
  const res = await fetch(url('/admin/ai/costs'), {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  return parse<{
    totalCostUsdMicros: number;
    totalCalls: number;
    byProvider: Record<
      string,
      { count: number; costUsdMicros: number; avgLatencyMs: number }
    >;
    recent: Array<{
      id: string;
      orderId: string;
      phase: string;
      provider: string;
      modelId: string;
      costUsdMicros: number;
      latencyMs: number;
      createdAt: string;
    }>;
  }>(res);
}

export type ImageSystemPromptSettings = {
  prompt: string;
  isDefault: boolean;
  defaultPrompt: string;
  placeholders: Array<{ key: string; description: string }>;
  updatedAt: string | null;
};

export async function adminGetImageSystemPrompt() {
  const res = await fetch(url('/admin/ai/image-system-prompt'), {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  return parse<ImageSystemPromptSettings>(res);
}

export async function adminSaveImageSystemPrompt(prompt: string) {
  const res = await fetch(url('/admin/ai/image-system-prompt'), {
    method: 'PATCH',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return parse<{
    prompt: string;
    isDefault: boolean;
    updatedAt: string;
  }>(res);
}

export async function adminResetImageSystemPrompt() {
  const res = await fetch(url('/admin/ai/image-system-prompt/reset'), {
    method: 'POST',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: '{}',
  });
  return parse<{
    prompt: string;
    isDefault: boolean;
    updatedAt: string;
  }>(res);
}

export type FeatureFlags = {
  payments_enabled: boolean;
  generation_enabled: boolean;
  maintenance_mode: boolean;
  free_generation_enabled: boolean;
};

export async function adminGetFeatureFlags() {
  const res = await fetch(url('/admin/settings/feature-flags'), {
    credentials: 'include',
    headers: { ...authHeaders() },
  });
  return parse<{ flags: FeatureFlags; updatedAt: string | null }>(res);
}

export async function adminPatchFeatureFlags(patch: Partial<FeatureFlags>) {
  const res = await fetch(url('/admin/settings/feature-flags'), {
    method: 'PATCH',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parse<{ flags: FeatureFlags; updatedAt: string }>(res);
}
