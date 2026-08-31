import type { OrderStatus } from '@visagismo/shared';
import { assertTransition, canTransition } from './order-state-machine.js';

/** Normalized Mercado Pago payment status. */
export type MpPaymentStatus =
  | 'pending'
  | 'in_process'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

export type PaymentApprovalPlan =
  | { kind: 'noop'; reason: string }
  | { kind: 'set_payment_pending' }
  | {
      kind: 'path_a_approve';
      /** Ordered hops executed in the same transaction. */
      hops: ['payment_approved', 'queued'];
    }
  | {
      kind: 'cancel';
      cancelReason: 'payment_rejected';
    }
  | {
      kind: 'refund';
      refundReason: 'mp_refund' | 'chargeback';
    };

/**
 * Pure planner for payment status effects.
 * Path A: never awaiting|pending → queued in one hop.
 */
export function planPaymentEffect(
  orderStatus: OrderStatus,
  mpStatus: MpPaymentStatus,
): PaymentApprovalPlan {
  switch (mpStatus) {
    case 'pending':
    case 'in_process': {
      if (orderStatus === 'awaiting_payment' && canTransition(orderStatus, 'payment_pending')) {
        return { kind: 'set_payment_pending' };
      }
      return { kind: 'noop', reason: 'already_pending_or_later' };
    }
    case 'approved': {
      if (
        orderStatus === 'awaiting_payment' ||
        orderStatus === 'payment_pending'
      ) {
        assertTransition(orderStatus, 'payment_approved');
        assertTransition('payment_approved', 'queued');
        return { kind: 'path_a_approve', hops: ['payment_approved', 'queued'] };
      }
      if (orderStatus === 'payment_approved') {
        // Safety net: hop2 only
        assertTransition('payment_approved', 'queued');
        return { kind: 'path_a_approve', hops: ['payment_approved', 'queued'] };
      }
      return { kind: 'noop', reason: 'not_awaiting_payment' };
    }
    case 'rejected':
    case 'cancelled': {
      if (
        orderStatus === 'awaiting_payment' ||
        orderStatus === 'payment_pending'
      ) {
        return { kind: 'cancel', cancelReason: 'payment_rejected' };
      }
      return { kind: 'noop', reason: 'cancel_not_applicable' };
    }
    case 'refunded': {
      if (canTransition(orderStatus, 'refunded')) {
        return { kind: 'refund', refundReason: 'mp_refund' };
      }
      return { kind: 'noop', reason: 'refund_not_applicable' };
    }
    case 'charged_back': {
      if (canTransition(orderStatus, 'refunded')) {
        return { kind: 'refund', refundReason: 'chargeback' };
      }
      return { kind: 'noop', reason: 'chargeback_not_applicable' };
    }
    default:
      return { kind: 'noop', reason: 'unknown_mp_status' };
  }
}

/**
 * Apply Path A hops in memory (for unit tests / memory store).
 * Returns final status after hops (queued if both applied).
 */
export function applyPathAHops(from: OrderStatus): {
  intermediate: OrderStatus[];
  final: OrderStatus;
} {
  const plan = planPaymentEffect(from, 'approved');
  if (plan.kind !== 'path_a_approve') {
    return { intermediate: [], final: from };
  }
  // From payment_approved already: only hop2
  if (from === 'payment_approved') {
    return { intermediate: ['queued'], final: 'queued' };
  }
  return {
    intermediate: ['payment_approved', 'queued'],
    final: 'queued',
  };
}
