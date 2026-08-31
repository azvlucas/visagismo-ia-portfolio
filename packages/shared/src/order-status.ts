/** Order status values stored in DB (English). */
export const ORDER_STATUSES = [
  'draft',
  'awaiting_payment',
  'payment_pending',
  'payment_approved',
  'queued',
  'processing',
  'partially_completed',
  'completed',
  'failed',
  'reprocessing',
  'cancelled',
  'expired',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS_PT: Record<OrderStatus, string> = {
  draft: 'Iniciado',
  awaiting_payment: 'Aguardando pagamento',
  payment_pending: 'Pagamento pendente',
  payment_approved: 'Pagamento aprovado',
  queued: 'Na fila',
  processing: 'Processando',
  partially_completed: 'Parcialmente concluído',
  completed: 'Concluído',
  failed: 'Falhou',
  reprocessing: 'Reprocessando',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  refunded: 'Reembolsado',
};

export const CANCEL_REASONS = [
  'user',
  'admin',
  'payment_rejected',
  'expired',
  'replaced_checkout',
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

export const REFUND_REASONS = [
  'mp_refund',
  'chargeback',
  'admin_manual',
  'goodwill',
] as const;

export type RefundReason = (typeof REFUND_REASONS)[number];

/** Statuses that allow checkout (first time or re-entry). */
export const CHECKOUTABLE_STATUSES: readonly OrderStatus[] = [
  'draft',
  'awaiting_payment',
  'payment_pending',
] as const;

/** Statuses already paid / in pipeline — new checkout forbidden. */
export const ALREADY_PAID_STATUSES: readonly OrderStatus[] = [
  'payment_approved',
  'queued',
  'processing',
  'partially_completed',
  'completed',
  'reprocessing',
  'failed',
] as const;

export function isCheckoutable(status: OrderStatus): boolean {
  return (CHECKOUTABLE_STATUSES as readonly string[]).includes(status);
}

export function isAlreadyPaid(status: OrderStatus): boolean {
  return (ALREADY_PAID_STATUSES as readonly string[]).includes(status);
}
