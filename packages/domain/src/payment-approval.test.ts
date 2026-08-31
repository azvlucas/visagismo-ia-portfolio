import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPathAHops,
  planPaymentEffect,
} from './payment-approval.js';
import { canTransition } from './order-state-machine.js';

describe('PaymentApproval Path A', () => {
  it('plans hop1+hop2 from awaiting_payment', () => {
    const plan = planPaymentEffect('awaiting_payment', 'approved');
    assert.equal(plan.kind, 'path_a_approve');
    if (plan.kind === 'path_a_approve') {
      assert.deepEqual(plan.hops, ['payment_approved', 'queued']);
    }
  });

  it('plans hop1+hop2 from payment_pending', () => {
    const plan = planPaymentEffect('payment_pending', 'approved');
    assert.equal(plan.kind, 'path_a_approve');
  });

  it('plans hop2-only when already payment_approved', () => {
    const plan = planPaymentEffect('payment_approved', 'approved');
    assert.equal(plan.kind, 'path_a_approve');
    const applied = applyPathAHops('payment_approved');
    assert.deepEqual(applied.intermediate, ['queued']);
    assert.equal(applied.final, 'queued');
  });

  it('does not allow single-hop awaiting → queued', () => {
    assert.equal(canTransition('awaiting_payment', 'queued'), false);
    const applied = applyPathAHops('awaiting_payment');
    assert.deepEqual(applied.intermediate, [
      'payment_approved',
      'queued',
    ]);
  });

  it('noop when already queued', () => {
    const plan = planPaymentEffect('queued', 'approved');
    assert.equal(plan.kind, 'noop');
  });

  it('sets payment_pending from awaiting', () => {
    const plan = planPaymentEffect('awaiting_payment', 'pending');
    assert.equal(plan.kind, 'set_payment_pending');
  });

  it('cancels on rejected pre-pay', () => {
    const plan = planPaymentEffect('awaiting_payment', 'rejected');
    assert.equal(plan.kind, 'cancel');
  });

  it('refunds completed order', () => {
    const plan = planPaymentEffect('completed', 'refunded');
    assert.equal(plan.kind, 'refund');
  });
});
