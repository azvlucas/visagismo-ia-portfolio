import {
  type ErrorCode,
  type OrderStatus,
  isAlreadyPaid,
  isCheckoutable,
} from '@visagismo/shared';

export interface CheckoutOrderSnapshot {
  status: OrderStatus;
  questionnaireCompletedAt: Date | null;
  hasFrontalPhotoConfirmed: boolean;
  consentPrivacyAt: Date | null;
  consentImageProcessingAt: Date | null;
  ageAttestedAt: Date | null;
  packageActive: boolean;
  /** True when package_snapshot already frozen (re-entry). */
  hasPackageSnapshot: boolean;
  paymentsEnabled: boolean;
}

export type CheckoutGuardResult =
  | { ok: true }
  | { ok: false; code: ErrorCode };

/**
 * Server-side checkout allow-list and completeness guards.
 * Re-entry does not re-check package active if snapshot already frozen.
 */
export function validateCheckout(
  order: CheckoutOrderSnapshot,
): CheckoutGuardResult {
  if (!order.paymentsEnabled) {
    return { ok: false, code: 'PAYMENTS_DISABLED' };
  }

  if (isAlreadyPaid(order.status)) {
    return { ok: false, code: 'ALREADY_PAID' };
  }

  if (!isCheckoutable(order.status)) {
    return { ok: false, code: 'ORDER_NOT_CHECKOUTABLE' };
  }

  if (!order.hasPackageSnapshot && !order.packageActive) {
    return { ok: false, code: 'PACKAGE_INACTIVE' };
  }

  if (!order.questionnaireCompletedAt) {
    return { ok: false, code: 'QUESTIONNAIRE_INCOMPLETE' };
  }

  if (!order.hasFrontalPhotoConfirmed) {
    return { ok: false, code: 'PHOTOS_REQUIRED' };
  }

  if (!order.consentPrivacyAt || !order.consentImageProcessingAt) {
    return { ok: false, code: 'CONSENT_REQUIRED' };
  }

  if (!order.ageAttestedAt) {
    return { ok: false, code: 'AGE_ATTESTATION_REQUIRED' };
  }

  return { ok: true };
}
