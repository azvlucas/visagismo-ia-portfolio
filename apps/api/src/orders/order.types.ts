import { ORDER_STATUS_LABELS_PT, type OrderStatus } from '@visagismo/shared';

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerEmailNormalized: string;
  status: OrderStatus;
  packageId: string;
  packageSlug: string;
  packageName: string;
  packagePriceCents: number;
  packageSnapshot: unknown | null;
  accessTokenHash: string;
  /** Código de 6 dígitos (acesso e-mail + código). Estável no reprocessamento. */
  accessCode: string;
  tokenVersion: number;
  accessRevokedAt: Date | null;
  consentPrivacyAt: Date | null;
  consentImageProcessingAt: Date | null;
  marketingOptInAt: Date | null;
  ageAttestedAt: Date | null;
  questionnaireCompletedAt: Date | null;
  paidAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  questionnaire: Record<string, unknown>;
  questionnaireSchemaVersion: number;
  failureMessagePublic?: string | null;
  failureCode?: string | null;
  abortRequestedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface PublicOrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  customerName: string;
  customerEmail: string;
  /** Presente na sessão do pedido (cliente autenticado). */
  accessCode?: string;
  package: {
    id: string;
    slug: string;
    name: string;
    priceCents: number;
    estimatedSlaHours?: number;
    imageCount?: number;
  };
  questionnaire: Record<string, unknown>;
  questionnaireCompletedAt: string | null;
  consentPrivacyAt: string | null;
  consentImageProcessingAt: string | null;
  marketingOptInAt: string | null;
  ageAttestedAt: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  failureMessagePublic: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPublicOrder(
  order: OrderRecord,
  opts?: { includeAccessCode?: boolean },
): PublicOrderView {
  const snap =
    order.packageSnapshot && typeof order.packageSnapshot === 'object'
      ? (order.packageSnapshot as {
          estimatedSlaHours?: number;
          imageCount?: number;
        })
      : {};

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS_PT[order.status],
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    ...(opts?.includeAccessCode !== false && order.accessCode
      ? { accessCode: order.accessCode }
      : {}),
    package: {
      id: order.packageId,
      slug: order.packageSlug,
      name: order.packageName,
      priceCents: order.packagePriceCents,
      estimatedSlaHours: snap.estimatedSlaHours,
      imageCount: snap.imageCount,
    },
    questionnaire: order.questionnaire,
    questionnaireCompletedAt: order.questionnaireCompletedAt?.toISOString() ?? null,
    consentPrivacyAt: order.consentPrivacyAt?.toISOString() ?? null,
    consentImageProcessingAt: order.consentImageProcessingAt?.toISOString() ?? null,
    marketingOptInAt: order.marketingOptInAt?.toISOString() ?? null,
    ageAttestedAt: order.ageAttestedAt?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    expiresAt: order.expiresAt?.toISOString() ?? null,
    failureMessagePublic: order.failureMessagePublic ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
