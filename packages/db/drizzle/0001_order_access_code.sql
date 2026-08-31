ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "access_code" varchar(8);
--> statement-breakpoint
UPDATE "orders" SET "access_code" = LPAD((FLOOR(RANDOM() * 1000000))::int::text, 6, '0') WHERE "access_code" IS NULL;
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "access_code" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_email_access_code_idx" ON "orders" ("customer_email_normalized","access_code");
