CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"platform" text DEFAULT 'unknown' NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"units" numeric(18, 6) NOT NULL,
	"unit_type" text NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"rate_card_id" uuid,
	"conversation_id" uuid,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "rate_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"unit_type" text NOT NULL,
	"price_per_unit" numeric(18, 10) NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "fixed_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" text NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"period" text NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "upfront_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"paid_on" date NOT NULL,
	"amortize_months" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"platform" text DEFAULT 'unknown' NOT NULL,
	"source" text NOT NULL,
	"amount_usd" numeric(10, 4) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"meta" jsonb
);
--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_events_created_at_idx" ON "usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "usage_events_user_created_idx" ON "usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_provider_created_idx" ON "usage_events" USING btree ("provider","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_platform_created_idx" ON "usage_events" USING btree ("platform","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_cards_unique_idx" ON "rate_cards" USING btree ("provider","operation","unit_type","effective_from");