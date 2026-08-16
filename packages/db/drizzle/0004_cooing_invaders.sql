CREATE TYPE "public"."evidence_review_state" AS ENUM('AUTOMATICALLY_EXTRACTED', 'HUMAN_CONFIRMED', 'HUMAN_REJECTED');--> statement-breakpoint
ALTER TABLE "source_evidence" ADD COLUMN "review_state" "evidence_review_state";--> statement-breakpoint
UPDATE "source_evidence"
SET "review_state" = 'AUTOMATICALLY_EXTRACTED'
WHERE "extraction_run_id" IS NOT NULL
  AND "extraction_method" = 'MODEL_EXTRACTION';--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_review_state" CHECK (("source_evidence"."review_state" is null or "source_evidence"."extraction_method" = 'MODEL_EXTRACTION')
        and ("source_evidence"."extraction_run_id" is null or "source_evidence"."review_state" is not null));
