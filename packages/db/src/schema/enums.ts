import { pgEnum } from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('order_status', [
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
]);

export const cancelReasonEnum = pgEnum('cancel_reason', [
  'user',
  'admin',
  'payment_rejected',
  'expired',
  'replaced_checkout',
]);

export const refundReasonEnum = pgEnum('refund_reason', [
  'mp_refund',
  'chargeback',
  'admin_manual',
  'goodwill',
]);

export const photoTypeEnum = pgEnum('photo_type', [
  'frontal',
  'lateral',
  'extra',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'refunded',
  'charged_back',
]);

export const generationJobStatusEnum = pgEnum('generation_job_status', [
  'pending',
  'active',
  'completed',
  'failed',
  'cancelled',
]);

export const generationPhaseEnum = pgEnum('generation_phase', [
  'analysis',
  'image',
  'thumb',
]);

export const analysisSourceEnum = pgEnum('analysis_source', [
  'llm',
  'template_fallback',
]);

export const resultImageStatusEnum = pgEnum('result_image_status', [
  'ready',
  'failed',
]);

export const aiModelKindEnum = pgEnum('ai_model_kind', ['image', 'text']);

export const packageAiRoleEnum = pgEnum('package_ai_role', [
  'primary',
  'fallback',
  'compare',
]);

export const adminRoleEnum = pgEnum('admin_role', ['admin', 'operator']);

export const deletionRequestStatusEnum = pgEnum('deletion_request_status', [
  'pending_verify',
  'pending',
  'executed',
  'rejected',
]);
