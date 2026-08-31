import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED,
  assertTransition,
  canTransition,
  InvalidTransitionError,
  paymentApprovalPathA,
} from './order-state-machine.js';
import type { OrderStatus } from '@visagismo/shared';

describe('OrderStateMachine', () => {
  it('allows Path A hops: awaiting_payment → payment_approved → queued', () => {
    assert.equal(canTransition('awaiting_payment', 'payment_approved'), true);
    assert.equal(canTransition('payment_approved', 'queued'), true);
    assert.deepEqual(paymentApprovalPathA('awaiting_payment'), [
      'payment_approved',
      'queued',
    ]);
  });

  it('allows Path A from payment_pending', () => {
    assert.deepEqual(paymentApprovalPathA('payment_pending'), [
      'payment_approved',
      'queued',
    ]);
  });

  it('rejects single-hop awaiting_payment → queued', () => {
    assert.equal(canTransition('awaiting_payment', 'queued'), false);
    assert.throws(
      () => assertTransition('awaiting_payment', 'queued'),
      InvalidTransitionError,
    );
  });

  it('rejects single-hop payment_pending → queued', () => {
    assert.equal(canTransition('payment_pending', 'queued'), false);
  });

  it('allows checkout re-entry payment_pending → awaiting_payment', () => {
    assert.equal(canTransition('payment_pending', 'awaiting_payment'), true);
  });

  it('allows refunds from post-payment states', () => {
    const refundable: OrderStatus[] = [
      'payment_approved',
      'queued',
      'processing',
      'partially_completed',
      'completed',
      'failed',
      'reprocessing',
    ];
    for (const from of refundable) {
      assert.equal(
        canTransition(from, 'refunded'),
        true,
        `expected ${from} → refunded`,
      );
    }
  });

  it('terminal states have no outgoing transitions', () => {
    for (const status of ['cancelled', 'expired', 'refunded'] as const) {
      assert.equal(ALLOWED[status].length, 0);
    }
  });

  it('allows completed → reprocessing (admin)', () => {
    assert.equal(canTransition('completed', 'reprocessing'), true);
  });

  it('allows failed|partially_completed → reprocessing (auto/admin)', () => {
    assert.equal(canTransition('failed', 'reprocessing'), true);
    assert.equal(canTransition('partially_completed', 'reprocessing'), true);
  });
});
