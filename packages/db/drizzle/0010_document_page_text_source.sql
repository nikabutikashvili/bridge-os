CREATE TYPE "public"."document_page_text_source" AS ENUM('PDF_TEXT', 'OCR');--> statement-breakpoint
ALTER TABLE "document_pages" ADD COLUMN "text_source" "document_page_text_source" DEFAULT 'PDF_TEXT' NOT NULL;
