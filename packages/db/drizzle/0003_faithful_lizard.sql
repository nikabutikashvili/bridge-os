CREATE TYPE "public"."extraction_invocation_status" AS ENUM('RUNNING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."extraction_run_status" AS ENUM('PENDING', 'CLASSIFYING', 'EXTRACTING', 'VALIDATING', 'PERSISTING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TABLE "document_extraction_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"category" text,
	"page_numbers" integer[] NOT NULL,
	"prompt_version" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" "extraction_invocation_status" NOT NULL,
	"provider_request_id" text,
	"duration_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost" numeric(14, 6),
	"cost_currency" char(3),
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_extraction_invocations_id_run_document_unique" UNIQUE("id","run_id","document_id"),
	CONSTRAINT "document_extraction_invocations_stage_shape" CHECK (("document_extraction_invocations"."stage" = 'PAGE_CLASSIFICATION' and "document_extraction_invocations"."category" is null)
        or ("document_extraction_invocations"."stage" = 'SECTION_EXTRACTION'
          and nullif(btrim("document_extraction_invocations"."category"), '') is not null)),
	CONSTRAINT "document_extraction_invocations_pages_present" CHECK (cardinality("document_extraction_invocations"."page_numbers") > 0),
	CONSTRAINT "document_extraction_invocations_identity_not_blank" CHECK (nullif(btrim("document_extraction_invocations"."prompt_version"), '') is not null
        and nullif(btrim("document_extraction_invocations"."provider"), '') is not null
        and nullif(btrim("document_extraction_invocations"."model"), '') is not null),
	CONSTRAINT "document_extraction_invocations_usage_non_negative" CHECK (("document_extraction_invocations"."duration_ms" is null or "document_extraction_invocations"."duration_ms" >= 0)
        and ("document_extraction_invocations"."input_tokens" is null or "document_extraction_invocations"."input_tokens" >= 0)
        and ("document_extraction_invocations"."output_tokens" is null or "document_extraction_invocations"."output_tokens" >= 0)
        and ("document_extraction_invocations"."estimated_cost" is null or "document_extraction_invocations"."estimated_cost" >= 0)),
	CONSTRAINT "document_extraction_invocations_cost_pair" CHECK (("document_extraction_invocations"."estimated_cost" is null and "document_extraction_invocations"."cost_currency" is null)
        or ("document_extraction_invocations"."estimated_cost" is not null and "document_extraction_invocations"."cost_currency" ~ '^[A-Z]{3}$')),
	CONSTRAINT "document_extraction_invocations_error_shape" CHECK (("document_extraction_invocations"."status" = 'FAILED'
        and nullif(btrim("document_extraction_invocations"."error_code"), '') is not null
        and nullif(btrim("document_extraction_invocations"."error_message"), '') is not null)
        or ("document_extraction_invocations"."status" <> 'FAILED'
          and "document_extraction_invocations"."error_code" is null and "document_extraction_invocations"."error_message" is null)),
	CONSTRAINT "document_extraction_invocations_timing_shape" CHECK (("document_extraction_invocations"."status" = 'RUNNING' and "document_extraction_invocations"."completed_at" is null)
        or ("document_extraction_invocations"."status" in ('SUCCEEDED', 'FAILED') and "document_extraction_invocations"."completed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "document_extraction_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"processing_run_id" uuid NOT NULL,
	"retry_of_run_id" uuid,
	"attempt" integer NOT NULL,
	"status" "extraction_run_status" NOT NULL,
	"pipeline_version" text NOT NULL,
	"prompt_versions" jsonb NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"temperature" numeric(3, 2) NOT NULL,
	"output_bridge_id" uuid,
	"duration_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost" numeric(14, 6),
	"cost_currency" char(3),
	"error_stage" text,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_extraction_runs_id_document_unique" UNIQUE("id","document_id"),
	CONSTRAINT "document_extraction_runs_attempt_positive" CHECK ("document_extraction_runs"."attempt" > 0),
	CONSTRAINT "document_extraction_runs_identity_not_blank" CHECK (nullif(btrim("document_extraction_runs"."pipeline_version"), '') is not null
        and nullif(btrim("document_extraction_runs"."provider"), '') is not null
        and nullif(btrim("document_extraction_runs"."model"), '') is not null),
	CONSTRAINT "document_extraction_runs_prompt_versions_object" CHECK (jsonb_typeof("document_extraction_runs"."prompt_versions") = 'object'),
	CONSTRAINT "document_extraction_runs_temperature_range" CHECK ("document_extraction_runs"."temperature" between 0 and 0.20),
	CONSTRAINT "document_extraction_runs_usage_non_negative" CHECK (("document_extraction_runs"."duration_ms" is null or "document_extraction_runs"."duration_ms" >= 0)
        and ("document_extraction_runs"."input_tokens" is null or "document_extraction_runs"."input_tokens" >= 0)
        and ("document_extraction_runs"."output_tokens" is null or "document_extraction_runs"."output_tokens" >= 0)
        and ("document_extraction_runs"."estimated_cost" is null or "document_extraction_runs"."estimated_cost" >= 0)),
	CONSTRAINT "document_extraction_runs_cost_pair" CHECK (("document_extraction_runs"."estimated_cost" is null and "document_extraction_runs"."cost_currency" is null)
        or ("document_extraction_runs"."estimated_cost" is not null and "document_extraction_runs"."cost_currency" ~ '^[A-Z]{3}$')),
	CONSTRAINT "document_extraction_runs_error_shape" CHECK (("document_extraction_runs"."status" = 'FAILED'
        and nullif(btrim("document_extraction_runs"."error_stage"), '') is not null
        and nullif(btrim("document_extraction_runs"."error_code"), '') is not null
        and nullif(btrim("document_extraction_runs"."error_message"), '') is not null)
        or ("document_extraction_runs"."status" <> 'FAILED'
          and "document_extraction_runs"."error_stage" is null
          and "document_extraction_runs"."error_code" is null
          and "document_extraction_runs"."error_message" is null)),
	CONSTRAINT "document_extraction_runs_timing_shape" CHECK (("document_extraction_runs"."status" = 'PENDING'
          and "document_extraction_runs"."started_at" is null and "document_extraction_runs"."completed_at" is null)
        or ("document_extraction_runs"."status" in ('CLASSIFYING', 'EXTRACTING', 'VALIDATING', 'PERSISTING')
          and "document_extraction_runs"."started_at" is not null and "document_extraction_runs"."completed_at" is null)
        or ("document_extraction_runs"."status" in ('SUCCEEDED', 'FAILED')
          and "document_extraction_runs"."started_at" is not null and "document_extraction_runs"."completed_at" is not null)),
	CONSTRAINT "document_extraction_runs_success_output" CHECK ("document_extraction_runs"."status" <> 'SUCCEEDED' or "document_extraction_runs"."output_bridge_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "document_page_classifications" (
	"run_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"invocation_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"category" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"section_title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_page_classifications_run_id_page_number_category_pk" PRIMARY KEY("run_id","page_number","category"),
	CONSTRAINT "document_page_classifications_confidence_range" CHECK ("document_page_classifications"."confidence" between 0 and 1),
	CONSTRAINT "document_page_classifications_category_not_blank" CHECK (nullif(btrim("document_page_classifications"."category"), '') is not null)
);
--> statement-breakpoint
ALTER TABLE "source_evidence" ADD COLUMN "extraction_run_id" uuid;--> statement-breakpoint
ALTER TABLE "document_extraction_invocations" ADD CONSTRAINT "document_extraction_invocations_run_document_fk" FOREIGN KEY ("run_id","document_id") REFERENCES "public"."document_extraction_runs"("id","document_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_extraction_runs" ADD CONSTRAINT "document_extraction_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_extraction_runs" ADD CONSTRAINT "document_extraction_runs_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_extraction_runs" ADD CONSTRAINT "document_extraction_runs_output_bridge_id_bridges_id_fk" FOREIGN KEY ("output_bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_extraction_runs" ADD CONSTRAINT "document_extraction_runs_retry_of_fk" FOREIGN KEY ("retry_of_run_id") REFERENCES "public"."document_extraction_runs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_page_classifications" ADD CONSTRAINT "document_page_classifications_run_document_fk" FOREIGN KEY ("run_id","document_id") REFERENCES "public"."document_extraction_runs"("id","document_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_page_classifications" ADD CONSTRAINT "document_page_classifications_invocation_scope_fk" FOREIGN KEY ("invocation_id","run_id","document_id") REFERENCES "public"."document_extraction_invocations"("id","run_id","document_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_page_classifications" ADD CONSTRAINT "document_page_classifications_document_page_fk" FOREIGN KEY ("document_id","page_number") REFERENCES "public"."document_pages"("document_id","page_number") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "document_extraction_invocations_run_idx" ON "document_extraction_invocations" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "document_extraction_runs_document_attempt_unique" ON "document_extraction_runs" USING btree ("document_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "document_extraction_runs_one_active_per_document" ON "document_extraction_runs" USING btree ("document_id") WHERE "document_extraction_runs"."status" in ('PENDING', 'CLASSIFYING', 'EXTRACTING', 'VALIDATING', 'PERSISTING');--> statement-breakpoint
CREATE INDEX "document_extraction_runs_document_created_idx" ON "document_extraction_runs" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "document_extraction_runs_status_idx" ON "document_extraction_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_page_classifications_category_idx" ON "document_page_classifications" USING btree ("run_id","category");--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_extraction_run_id_document_extraction_runs_id_fk" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."document_extraction_runs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "source_evidence_extraction_run_idx" ON "source_evidence" USING btree ("extraction_run_id");--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_run_method" CHECK ("source_evidence"."extraction_run_id" is null or "source_evidence"."extraction_method" = 'MODEL_EXTRACTION');