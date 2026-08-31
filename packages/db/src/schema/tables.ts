import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  adminRoleEnum,
  analysisSourceEnum,
  aiModelKindEnum,
  cancelReasonEnum,
  deletionRequestStatusEnum,
  generationJobStatusEnum,
  generationPhaseEnum,
  orderStatusEnum,
  packageAiRoleEnum,
  paymentStatusEnum,
  photoTypeEnum,
  refundReasonEnum,
  resultImageStatusEnum,
} from './enums.js';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const packages = pgTable(
  'packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 80 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description').notNull().default(''),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('BRL'),
    imageCount: integer('image_count').notNull().default(3),
    styleVariationCount: integer('style_variation_count').notNull().default(2),
    estimatedSlaHours: integer('estimated_sla_hours').notNull().default(24),
    features: jsonb('features').$type<string[]>().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    promoText: text('promo_text'),
    discountPercent: integer('discount_percent'),
    compareModels: boolean('compare_models').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('packages_slug_uidx').on(t.slug),
    index('packages_active_sort_idx').on(t.isActive, t.sortOrder),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: varchar('order_number', { length: 32 }).notNull(),
    customerName: varchar('customer_name', { length: 120 }).notNull(),
    customerEmail: varchar('customer_email', { length: 255 }).notNull(),
    customerEmailNormalized: varchar('customer_email_normalized', {
      length: 255,
    }).notNull(),
    status: orderStatusEnum('status').notNull().default('draft'),
    cancelReason: cancelReasonEnum('cancel_reason'),
    refundReason: refundReasonEnum('refund_reason'),
    packageId: uuid('package_id')
      .notNull()
      .references(() => packages.id),
    packageSnapshot: jsonb('package_snapshot'),
    packagePriceCents: integer('package_price_cents'),
    accessTokenHash: varchar('access_token_hash', { length: 128 }).notNull(),
    /** Código de 6 dígitos para acesso e-mail + código (além do link). */
    accessCode: varchar('access_code', { length: 8 }).notNull().default('000000'),
    tokenVersion: integer('token_version').notNull().default(0),
    accessRevokedAt: timestamp('access_revoked_at', { withTimezone: true }),
    consentPrivacyAt: timestamp('consent_privacy_at', { withTimezone: true }),
    consentImageProcessingAt: timestamp('consent_image_processing_at', {
      withTimezone: true,
    }),
    marketingOptInAt: timestamp('marketing_opt_in_at', { withTimezone: true }),
    ageAttestedAt: timestamp('age_attested_at', { withTimezone: true }),
    questionnaireCompletedAt: timestamp('questionnaire_completed_at', {
      withTimezone: true,
    }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    failureCode: varchar('failure_code', { length: 64 }),
    failureMessagePublic: text('failure_message_public'),
    autoRetryCount: integer('auto_retry_count').notNull().default(0),
    abortRequestedAt: timestamp('abort_requested_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('orders_order_number_uidx').on(t.orderNumber),
    uniqueIndex('orders_access_token_hash_uidx').on(t.accessTokenHash),
    index('orders_email_idx').on(t.customerEmailNormalized),
    index('orders_email_access_code_idx').on(
      t.customerEmailNormalized,
      t.accessCode,
    ),
    index('orders_status_created_idx').on(t.status, t.createdAt),
    index('orders_status_expires_idx').on(t.status, t.expiresAt),
  ],
);

export const orderQuestionnaires = pgTable('order_questionnaires', {
  orderId: uuid('order_id')
    .primaryKey()
    .references(() => orders.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull().default({}),
  schemaVersion: integer('schema_version').notNull().default(1),
  ...timestamps,
});

export const orderPhotos = pgTable(
  'order_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: photoTypeEnum('type').notNull(),
    r2Key: text('r2_key').notNull(),
    mime: varchar('mime', { length: 64 }).notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    checksumSha256: varchar('checksum_sha256', { length: 64 }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('order_photos_order_idx').on(t.orderId),
    uniqueIndex('order_photos_order_type_uidx').on(t.orderId, t.type),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    provider: varchar('provider', { length: 32 }).notNull().default('mercadopago'),
    externalPreferenceId: varchar('external_preference_id', { length: 128 }),
    externalPaymentId: varchar('external_payment_id', { length: 128 }),
    status: paymentStatusEnum('status').notNull().default('pending'),
    amountCents: integer('amount_cents').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    isActiveCheckout: boolean('is_active_checkout').notNull().default(true),
    rawPayload: jsonb('raw_payload'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('payments_idempotency_uidx').on(t.idempotencyKey),
    uniqueIndex('payments_provider_ext_payment_uidx').on(
      t.provider,
      t.externalPaymentId,
    ),
    index('payments_order_active_idx').on(t.orderId, t.isActiveCheckout),
  ],
);

export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 32 }).notNull().default('mercadopago'),
    notificationId: varchar('notification_id', { length: 256 }).notNull(),
    externalPaymentId: varchar('external_payment_id', { length: 128 }),
    topic: varchar('topic', { length: 64 }),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processResult: varchar('process_result', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payment_webhook_events_provider_notif_uidx').on(
      t.provider,
      t.notificationId,
    ),
    index('payment_webhook_events_ext_payment_idx').on(t.externalPaymentId),
  ],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aggregateType: varchar('aggregate_type', { length: 64 }).notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [index('outbox_events_unprocessed_idx').on(t.processedAt)],
);

export const generationJobs = pgTable(
  'generation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    cycle: integer('cycle').notNull().default(1),
    status: generationJobStatusEnum('status').notNull().default('pending'),
    bullJobId: varchar('bull_job_id', { length: 128 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('generation_jobs_order_cycle_uidx').on(t.orderId, t.cycle),
    index('generation_jobs_status_idx').on(t.status),
  ],
);

export const generationJobAttempts = pgTable('generation_job_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => generationJobs.id, { onDelete: 'cascade' }),
  phase: generationPhaseEnum('phase').notNull(),
  provider: varchar('provider', { length: 32 }),
  modelId: varchar('model_id', { length: 128 }),
  imageIndex: integer('image_index'),
  success: boolean('success').notNull().default(false),
  errorCode: varchar('error_code', { length: 64 }),
  latencyMs: integer('latency_ms'),
  rawMeta: jsonb('raw_meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderResults = pgTable('order_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id)
    .unique(),
  schemaVersion: integer('schema_version').notNull().default(1),
  summary: text('summary'),
  perceptionAnalysis: text('perception_analysis'),
  hairRecommendations: text('hair_recommendations'),
  beardRecommendations: text('beard_recommendations'),
  makeupRecommendations: text('makeup_recommendations'),
  accessoriesRecommendations: text('accessories_recommendations'),
  maintenancePlan: text('maintenance_plan'),
  salonBrief: text('salon_brief'),
  styleDirections: jsonb('style_directions'),
  disclaimerVersion: varchar('disclaimer_version', { length: 32 }),
  analysisSource: analysisSourceEnum('analysis_source'),
  rawAnalysisJson: jsonb('raw_analysis_json'),
  ...timestamps,
});

export const orderResultImages = pgTable(
  'order_result_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderResultId: uuid('order_result_id')
      .notNull()
      .references(() => orderResults.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    r2Key: text('r2_key'),
    thumbR2Key: text('thumb_r2_key'),
    styleVariationKey: varchar('style_variation_key', { length: 64 }),
    caption: text('caption'),
    provider: varchar('provider', { length: 32 }),
    modelId: varchar('model_id', { length: 128 }),
    sortOrder: integer('sort_order').notNull().default(0),
    status: resultImageStatusEnum('status').notNull().default('ready'),
    ...timestamps,
  },
  (t) => [index('order_result_images_order_idx').on(t.orderId)],
);

export const aiProviders = pgTable(
  'ai_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 32 }).notNull(),
    displayName: varchar('display_name', { length: 80 }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    encryptedSecret: text('encrypted_secret'),
    config: jsonb('config').default({}),
    ...timestamps,
  },
  (t) => [uniqueIndex('ai_providers_key_uidx').on(t.key)],
);

export const aiModels = pgTable(
  'ai_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => aiProviders.id, { onDelete: 'cascade' }),
    externalModelId: varchar('external_model_id', { length: 128 }).notNull(),
    kind: aiModelKindEnum('kind').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    estimatedCostUsdMicros: integer('estimated_cost_usd_micros').notNull().default(0),
    qualityRank: integer('quality_rank').notNull().default(50),
    speedRank: integer('speed_rank').notNull().default(50),
    timeoutMs: integer('timeout_ms').notNull().default(120_000),
    ...timestamps,
  },
  (t) => [index('ai_models_provider_idx').on(t.providerId)],
);

export const packageAiModels = pgTable(
  'package_ai_models',
  {
    packageId: uuid('package_id')
      .notNull()
      .references(() => packages.id, { onDelete: 'cascade' }),
    aiModelId: uuid('ai_model_id')
      .notNull()
      .references(() => aiModels.id, { onDelete: 'cascade' }),
    priority: integer('priority').notNull().default(0),
    role: packageAiRoleEnum('role').notNull().default('primary'),
  },
  (t) => [
    uniqueIndex('package_ai_models_uidx').on(t.packageId, t.aiModelId, t.role),
  ],
);

export const aiCostLogs = pgTable(
  'ai_cost_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').references(() => orders.id),
    jobId: uuid('job_id').references(() => generationJobs.id),
    phase: generationPhaseEnum('phase').notNull(),
    provider: varchar('provider', { length: 32 }),
    modelId: varchar('model_id', { length: 128 }),
    costUsdMicros: integer('cost_usd_micros').notNull().default(0),
    latencyMs: integer('latency_ms'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_cost_logs_order_idx').on(t.orderId)],
);

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatusEnum('from_status'),
    toStatus: orderStatusEnum('to_status'),
    actor: varchar('actor', { length: 64 }).notNull().default('system'),
    payload: jsonb('payload').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId)],
);

export const orderRatings = pgTable('order_ratings', {
  orderId: uuid('order_id')
    .primaryKey()
    .references(() => orders.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: adminRoleEnum('role').notNull().default('admin'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('admin_users_email_uidx').on(t.email)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id').references(() => adminUsers.id),
    action: varchar('action', { length: 80 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }),
    entityId: varchar('entity_id', { length: 64 }),
    ip: varchar('ip', { length: 64 }),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt)],
);

export const contentBlocks = pgTable(
  'content_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 32 }).notNull(),
    key: varchar('key', { length: 80 }).notNull(),
    locale: varchar('locale', { length: 10 }).notNull().default('pt-BR'),
    body: jsonb('body').notNull(),
    needsLegalReview: boolean('needs_legal_review').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('content_blocks_type_key_locale_uidx').on(t.type, t.key, t.locale),
  ],
);

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 80 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dataDeletionRequests = pgTable(
  'data_deletion_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    orderId: uuid('order_id').references(() => orders.id),
    status: deletionRequestStatusEnum('status').notNull().default('pending_verify'),
    verifyTokenHash: varchar('verify_token_hash', { length: 128 }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    executeAfter: timestamp('execute_after', { withTimezone: true }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    resultMeta: jsonb('result_meta'),
  },
  (t) => [index('data_deletion_requests_status_idx').on(t.status)],
);
