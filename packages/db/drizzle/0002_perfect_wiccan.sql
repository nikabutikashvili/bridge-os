CREATE TYPE "public"."document_processing_status" AS ENUM('UPLOADED', 'PARSING', 'PARSED', 'EXTRACTION_PENDING', 'EXTRACTED', 'FAILED');--> statement-breakpoint
CREATE TABLE "document_pages" (
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"text_content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_pages_document_id_page_number_pk" PRIMARY KEY("document_id","page_number"),
	CONSTRAINT "document_pages_positive_page_number" CHECK ("document_pages"."page_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "document_processing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "document_processing_status" NOT NULL,
	"parser" text,
	"page_count" integer,
	"error_code" text,
	"error_message" text,
	"parsing_started_at" timestamp with time zone,
	"parsing_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_processing_runs_page_count_valid" CHECK ("document_processing_runs"."page_count" is null or "document_processing_runs"."page_count" >= 0),
	CONSTRAINT "document_processing_runs_error_shape" CHECK ((
        "document_processing_runs"."status" = 'FAILED'
        and nullif(btrim("document_processing_runs"."error_code"), '') is not null
        and nullif(btrim("document_processing_runs"."error_message"), '') is not null
      ) or (
        "document_processing_runs"."status" <> 'FAILED'
        and "document_processing_runs"."error_code" is null
        and "document_processing_runs"."error_message" is null
      )),
	CONSTRAINT "document_processing_runs_timing_shape" CHECK ((
        "document_processing_runs"."status" = 'UPLOADED'
        and "document_processing_runs"."parsing_started_at" is null
        and "document_processing_runs"."parsing_completed_at" is null
        and "document_processing_runs"."page_count" is null
      ) or (
        "document_processing_runs"."status" = 'PARSING'
        and "document_processing_runs"."parsing_started_at" is not null
        and "document_processing_runs"."parsing_completed_at" is null
        and "document_processing_runs"."page_count" is null
      ) or (
        "document_processing_runs"."status" in ('PARSED', 'EXTRACTION_PENDING', 'EXTRACTED')
        and "document_processing_runs"."parsing_started_at" is not null
        and "document_processing_runs"."parsing_completed_at" is not null
        and "document_processing_runs"."page_count" is not null
      ) or "document_processing_runs"."status" = 'FAILED')
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "checksum_sha256" char(64);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "size_bytes" bigint;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_processing_runs" ADD CONSTRAINT "document_processing_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "document_processing_runs_document_created_idx" ON "document_processing_runs" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "document_processing_runs_status_idx" ON "document_processing_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_checksum_sha256_unique" ON "documents" USING btree ("checksum_sha256") WHERE "documents"."checksum_sha256" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_storage_key_unique" ON "documents" USING btree ("storage_key") WHERE "documents"."storage_key" is not null;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_checksum_sha256_valid" CHECK ("documents"."checksum_sha256" is null or "documents"."checksum_sha256" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_ingestion_metadata_complete" CHECK ((
        "documents"."checksum_sha256" is null and "documents"."mime_type" is null
        and "documents"."size_bytes" is null and "documents"."storage_key" is null
      ) or (
        "documents"."checksum_sha256" is not null and "documents"."mime_type" is not null
        and "documents"."size_bytes" is not null and "documents"."storage_key" is not null
      ));--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_ingested_pdf_valid" CHECK ("documents"."mime_type" is null or (
        "documents"."mime_type" = 'application/pdf'
        and "documents"."size_bytes" > 0
        and nullif(btrim("documents"."storage_key"), '') is not null
      ));