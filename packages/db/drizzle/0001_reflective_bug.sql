CREATE TYPE "public"."bridge_data_origin" AS ENUM('EXTRACTED', 'USER_ENTERED', 'DEMO_FIXTURE');--> statement-breakpoint
ALTER TABLE "bridges" ADD COLUMN "data_origin" "bridge_data_origin";--> statement-breakpoint
CREATE INDEX "bridges_data_origin_idx" ON "bridges" USING btree ("data_origin");