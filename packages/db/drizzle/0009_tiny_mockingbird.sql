CREATE TYPE "public"."extraction_entity_kind" AS ENUM('BRIDGE', 'PARTIAL_STRUCTURE', 'COMPONENT', 'INSPECTION', 'FINDING', 'RECOMMENDATION', 'HISTORICAL_WORK', 'TRAFFIC_OBSERVATION');--> statement-breakpoint
CREATE TABLE "extraction_entity_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"entity_kind" "extraction_entity_kind" NOT NULL,
	"source_identity_key" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"latest_run_id" uuid NOT NULL,
	"last_applied_fingerprint" char(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extraction_entity_bindings_document_kind_source_unique" UNIQUE("document_id","entity_kind","source_identity_key"),
	CONSTRAINT "extraction_entity_bindings_document_kind_entity_unique" UNIQUE("document_id","entity_kind","entity_id"),
	CONSTRAINT "extraction_entity_bindings_source_key_not_blank" CHECK (btrim("extraction_entity_bindings"."source_identity_key") <> ''),
	CONSTRAINT "extraction_entity_bindings_fingerprint_valid" CHECK ("extraction_entity_bindings"."last_applied_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "document_extraction_runs" ADD COLUMN "result_summary" jsonb;--> statement-breakpoint
ALTER TABLE "extraction_entity_bindings" ADD CONSTRAINT "extraction_entity_bindings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "extraction_entity_bindings" ADD CONSTRAINT "extraction_entity_bindings_run_document_fk" FOREIGN KEY ("latest_run_id","document_id") REFERENCES "public"."document_extraction_runs"("id","document_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "extraction_entity_bindings_entity_idx" ON "extraction_entity_bindings" USING btree ("entity_kind","entity_id");--> statement-breakpoint
CREATE INDEX "extraction_entity_bindings_latest_run_idx" ON "extraction_entity_bindings" USING btree ("latest_run_id");--> statement-breakpoint
ALTER TABLE "document_extraction_runs" ADD CONSTRAINT "document_extraction_runs_result_summary_object" CHECK ("document_extraction_runs"."result_summary" is null or jsonb_typeof("document_extraction_runs"."result_summary") = 'object');