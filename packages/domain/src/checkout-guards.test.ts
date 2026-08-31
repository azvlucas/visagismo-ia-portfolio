import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  type CheckoutOrderSnapshot,
  validateCheckout,
} from './checkout-guards.js';

const base: CheckoutOrderSnapshot = {
  status: 'draft',
  questionnaireCompletedAt: new Date(),
  hasFrontalPhotoConfirmed: true,
  consentPrivacyAt: new Date(),
  consentImageProcessingAt: new Date(),
  ageAttestedAt: new Date(),
  packageActive: true,
  hasPackageSnapshot: false,
  paymentsEnabled: true,
};

describe('validateCheckout', () => {
  it('allows complete draft', () => {
    assert.deepEqual(validateCheckout(base), { ok: true });
  });

  it('allows re-entry awaiting_payment', () => {
    assert.deepEqual(
      validateCheckout({
        ...base,
        status: 'awaiting_payment',
        hasPackageSnapshot: true,
        packageActive: false,
      }),
      { ok: true },
    );
  });

  it('rejects already paid', () => {
    const r = validateCheckout({ ...base, status: 'queued' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'ALREADY_PAID');
  });

  it('rejects missing frontal photo', () => {
    const r = validateCheckout({ ...base, hasFrontalPhotoConfirmed: false });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'PHOTOS_REQUIRED');
  });

  it('rejects missing age attestation', () => {
    const r = validateCheckout({ ...base, ageAttestedAt: null });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'AGE_ATTESTATION_REQUIRED');
  });

  it('rejects inactive package on first freeze', () => {
    const r = validateCheckout({
      ...base,
      packageActive: false,
      hasPackageSnapshot: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'PACKAGE_INACTIVE');
  });

  it('rejects when payments disabled', () => {
    const r = validateCheckout({ ...base, paymentsEnabled: false });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'PAYMENTS_DISABLED');
  });
});
