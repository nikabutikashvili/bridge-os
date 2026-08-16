ALTER TABLE "documents" ADD COLUMN "photo_storage_key" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "photo_mime_type" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "photo_page_number" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "photo_byte_size" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_photo_storage_key_unique" ON "documents" USING btree ("photo_storage_key") WHERE "documents"."photo_storage_key" is not null;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_photo_complete" CHECK ((
        "documents"."photo_storage_key" is null
        and "documents"."photo_mime_type" is null
        and "documents"."photo_page_number" is null
        and "documents"."photo_byte_size" is null
      ) or (
        nullif(btrim("documents"."photo_storage_key"), '') is not null
        and "documents"."photo_mime_type" = 'image/jpeg'
        and "documents"."photo_page_number" > 0
        and "documents"."photo_byte_size" > 0
      ));
