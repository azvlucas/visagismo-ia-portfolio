/**
 * Eventos de analytics do funil público.
 * Nunca envia fotos, respostas sensíveis ou dados pessoais indevidos.
 */

export type AnalyticsEvent =
  | 'view_packages'
  | 'click_package'
  | 'start_questionnaire'
  | 'complete_step'
  | 'abandon_step'
  | 'upload_start'
  | 'upload_error'
  | 'upload_complete'
  | 'checkout_start'
  | 'payment_approved'
  | 'payment_declined'
  | 'view_results'
  | 'download_result_image'
  | 'download_result_all'
  | 'click_support'
  | 'click_case_study'
  | 'open_faq'
  | 'click_cta';

type EventPayload = Record<string, string | number | boolean | undefined>;

function sanitize(payload?: EventPayload): EventPayload {
  if (!payload) return {};
  const out: EventPayload = {};
  for (const [k, v] of Object.entries(payload)) {
    // Bloquear chaves sensíveis por segurança
    if (/email|photo|file|token|password|name|cpf|phone/i.test(k)) continue;
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function trackEvent(event: AnalyticsEvent, payload?: EventPayload): void {
  if (typeof window === 'undefined') return;

  const data = { event, ...sanitize(payload), ts: Date.now() };

  try {
    // dataLayer (GTM / GA4)
    const w = window as Window & { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(data);

    // Hook opcional
    const custom = (window as Window & { __visagismoTrack?: (d: unknown) => void })
      .__visagismoTrack;
    if (typeof custom === 'function') custom(data);
  } catch {
    // analytics never breaks UX
  }
}
