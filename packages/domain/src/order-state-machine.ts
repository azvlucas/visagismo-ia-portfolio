import type { OrderStatus } from '@visagismo/shared';

/**
 * Canonical allowed transitions (Path A for payments).
 * Never allow awaiting_payment|payment_pending → queued in a single hop.
 */
export const ALLOWED: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  draft: ['awaiting_payment', 'cancelled', 'expired'],
  awaiting_payment: [
    'payment_pending',
    'payment_approved',
    'cancelled',
    'expired',
  ],
  payment_pending: [
    'payment_approved',
    'cancelled',
    'expired',
    'awaiting_payment',
  ],
  payment_approved: ['queued', 'cancelled', 'refunded'],
  queued: ['processing', 'cancelled', 'refunded'],
  processing: [
    'partially_completed',
    'completed',
    'failed',
    'cancelled',
    'refunded',
  ],
  partially_completed: [
    'reprocessing',
    'completed',
    'failed',
    'refunded',
  ],
  completed: ['reprocessing', 'refunded'],
  failed: ['reprocessing', 'cancelled', 'refunded'],
  reprocessing: ['processing', 'failed', 'cancelled', 'refunded'],
  cancelled: [],
  expired: [],
  refunded: [],
};

export class InvalidTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION' as const;

  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Invalid order transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/**
 * Path A payment approval: hop1 then hop2.
 * Callers must execute both hops in the same DB transaction.
 */
export function paymentApprovalPathA(
  from: OrderStatus,
): ['payment_approved', 'queued'] {
  assertTransition(from, 'payment_approved');
  assertTransition('payment_approved', 'queued');
  return ['payment_approved', 'queued'];
}

export function isTerminal(status: OrderStatus): boolean {
  return ALLOWED[status].length === 0;
}
