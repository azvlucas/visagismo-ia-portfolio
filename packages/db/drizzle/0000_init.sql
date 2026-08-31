CREATE TYPE "public"."order_status" AS ENUM('draft', 'awaiting_payment', 'payment_pending', 'payment_approved', 'queued', 'processing', 'partially_completed', 'completed', 'failed', 'reprocessing', 'cancelled', 'expired', 'refunded');
--> statement-breakpoint
CREATE TYPE "public"."cancel_reason" AS ENUM('user', 'admin', 'payment_rejected', 'expired', 'replaced_checkout');
--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('mp_refund', 'chargeback', 'admin_manual', 'goodwill');
--> statement-breakpoint
CREATE TYPE "public"."photo_type" AS ENUM('frontal', 'lateral', 'extra');
--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back');
--> statement-breakpoint
CREATE TYPE "public"."generation_job_status" AS ENUM('pending', 'active', 'completed', 'failed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."generation_phase" AS ENUM('analysis', 'image', 'thumb');
--> statement-breakpoint
CREATE TYPE "public"."analysis_source" AS ENUM('llm', 'template_fallback');
--> statement-breakpoint
CREATE TYPE "public"."result_image_status" AS ENUM('ready', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."ai_model_kind" AS ENUM('image', 'text');
--> statement-breakpoint
CREATE TYPE "public"."package_ai_role" AS ENUM('primary', 'fallback', 'compare');
--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('admin', 'operator');
--> statement-breakpoint
CREATE TYPE "public"."deletion_request_status" AS ENUM('pending_verify', 'pending', 'executed', 'rejected');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"image_count" integer DEFAULT 3 NOT NULL,
	"style_variation_count" integer DEFAULT 2 NOT NULL,
	"estimated_sla_hours" integer DEFAULT 24 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"promo_text" text,
	"discount_percent" integer,
	"compare_models" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(32) NOT NULL,
	"customer_name" varchar(120) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_email_normalized" varchar(255) NOT NULL,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"cancel_reason" "cancel_reason",
	"refund_reason" "refund_reason",
	"package_id" uuid NOT NULL,
	"package_snapshot" jsonb,
	"package_price_cents" integer,
	"access_token_hash" varchar(128) NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"access_revoked_at" timestamp with time zone,
	"consent_privacy_at" timestamp with time zone,
	"consent_image_processing_at" timestamp with time zone,
	"marketing_opt_in_at" timestamp with time zone,
	"age_attested_at" timestamp with time zone,
	"questionnaire_completed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"failure_code" varchar(64),
	"failure_message_public" text,
	"auto_retry_count" integer DEFAULT 0 NOT NULL,
	"abort_requested_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_questionnaires" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "photo_type" NOT NULL,
	"r2_key" text NOT NULL,
	"mime" varchar(64) NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"checksum_sha256" varchar(64),
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" varchar(32) DEFAULT 'mercadopago' NOT NULL,
	"external_preference_id" varchar(128),
	"external_payment_id" varchar(128),
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"is_active_checkout" boolean DEFAULT true NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(32) DEFAULT 'mercadopago' NOT NULL,
	"notification_id" varchar(256) NOT NULL,
	"external_payment_id" varchar(128),
	"topic" varchar(64),
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"process_result" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(64) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"cycle" integer DEFAULT 1 NOT NULL,
	"status" "generation_job_status" DEFAULT 'pending' NOT NULL,
	"bull_job_id" varchar(128),
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_job_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"phase" "generation_phase" NOT NULL,
	"provider" varchar(32),
	"model_id" varchar(128),
	"image_index" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" varchar(64),
	"latency_ms" integer,
	"raw_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"summary" text,
	"perception_analysis" text,
	"hair_recommendations" text,
	"beard_recommendations" text,
	"makeup_recommendations" text,
	"accessories_recommendations" text,
	"maintenance_plan" text,
	"salon_brief" text,
	"style_directions" jsonb,
	"disclaimer_version" varchar(32),
	"analysis_source" "analysis_source",
	"raw_analysis_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_results_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_result_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_result_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"r2_key" text,
	"thumb_r2_key" text,
	"style_variation_key" varchar(64),
	"caption" text,
	"provider" varchar(32),
	"model_id" varchar(128),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "result_image_status" DEFAULT 'ready' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(32) NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"encrypted_secret" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"external_model_id" varchar(128) NOT NULL,
	"kind" "ai_model_kind" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"estimated_cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"quality_rank" integer DEFAULT 50 NOT NULL,
	"speed_rank" integer DEFAULT 50 NOT NULL,
	"timeout_ms" integer DEFAULT 120000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "package_ai_models" (
	"package_id" uuid NOT NULL,
	"ai_model_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"role" "package_ai_role" DEFAULT 'primary' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_cost_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"job_id" uuid,
	"phase" "generation_phase" NOT NULL,
	"provider" varchar(32),
	"model_id" varchar(128),
	"cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status",
	"actor" varchar(64) DEFAULT 'system' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_ratings" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"score" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(64),
	"entity_id" varchar(64),
	"ip" varchar(64),
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(32) NOT NULL,
	"key" varchar(80) NOT NULL,
	"locale" varchar(10) DEFAULT 'pt-BR' NOT NULL,
	"body" jsonb NOT NULL,
	"needs_legal_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"order_id" uuid,
	"status" "deletion_request_status" DEFAULT 'pending_verify' NOT NULL,
	"verify_token_hash" varchar(128),
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"execute_after" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"result_meta" jsonb
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_questionnaires" ADD CONSTRAINT "order_questionnaires_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "generation_job_attempts" ADD CONSTRAINT "generation_job_attempts_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_results" ADD CONSTRAINT "order_results_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_result_images" ADD CONSTRAINT "order_result_images_order_result_id_order_results_id_fk" FOREIGN KEY ("order_result_id") REFERENCES "public"."order_results"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_result_images" ADD CONSTRAINT "order_result_images_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "package_ai_models" ADD CONSTRAINT "package_ai_models_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "package_ai_models" ADD CONSTRAINT "package_ai_models_ai_model_id_ai_models_id_fk" FOREIGN KEY ("ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_cost_logs" ADD CONSTRAINT "ai_cost_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_cost_logs" ADD CONSTRAINT "ai_cost_logs_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_ratings" ADD CONSTRAINT "order_ratings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "packages_slug_uidx" ON "packages" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "packages_active_sort_idx" ON "packages" USING btree ("is_active","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_uidx" ON "orders" USING btree ("order_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_access_token_hash_uidx" ON "orders" USING btree ("access_token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_email_idx" ON "orders" USING btree ("customer_email_normalized");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_created_idx" ON "orders" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_expires_idx" ON "orders" USING btree ("status","expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_photos_order_idx" ON "order_photos" USING btree ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_photos_order_type_uidx" ON "order_photos" USING btree ("order_id","type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_uidx" ON "payments" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_ext_payment_uidx" ON "payments" USING btree ("provider","external_payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_order_active_idx" ON "payments" USING btree ("order_id","is_active_checkout");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_provider_notif_uidx" ON "payment_webhook_events" USING btree ("provider","notification_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_webhook_events_ext_payment_idx" ON "payment_webhook_events" USING btree ("external_payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_unprocessed_idx" ON "outbox_events" USING btree ("processed_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "generation_jobs_order_cycle_uidx" ON "generation_jobs" USING btree ("order_id","cycle");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_jobs_status_idx" ON "generation_jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_result_images_order_idx" ON "order_result_images" USING btree ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_providers_key_uidx" ON "ai_providers" USING btree ("key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_models_provider_idx" ON "ai_models" USING btree ("provider_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "package_ai_models_uidx" ON "package_ai_models" USING btree ("package_id","ai_model_id","role");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_cost_logs_order_idx" ON "ai_cost_logs" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_events_order_idx" ON "order_events" USING btree ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_uidx" ON "admin_users" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_blocks_type_key_locale_uidx" ON "content_blocks" USING btree ("type","key","locale");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_deletion_requests_status_idx" ON "data_deletion_requests" USING btree ("status");
