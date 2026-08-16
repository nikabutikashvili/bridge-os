CREATE TYPE "public"."work_package_status" AS ENUM('DRAFT', 'READY_FOR_REVIEW', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "work_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planned_intervention_id" uuid NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"bridge_id" uuid NOT NULL,
	"partial_structure_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "work_package_status" DEFAULT 'DRAFT' NOT NULL,
	"snapshot_version" smallint DEFAULT 1 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_packages_planned_intervention_unique" UNIQUE("planned_intervention_id"),
	CONSTRAINT "work_packages_title_not_blank" CHECK (btrim("work_packages"."title") <> ''),
	CONSTRAINT "work_packages_snapshot_version_v1" CHECK ("work_packages"."snapshot_version" = 1),
	CONSTRAINT "work_packages_snapshot_object" CHECK (jsonb_typeof("work_packages"."snapshot") = 'object')
);
--> statement-breakpoint
ALTER TABLE "planned_interventions" ADD CONSTRAINT "planned_interventions_work_package_scope_unique" UNIQUE("id","recommendation_id","bridge_id","partial_structure_id");--> statement-breakpoint
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_planned_intervention_scope_fk" FOREIGN KEY ("planned_intervention_id","recommendation_id","bridge_id","partial_structure_id") REFERENCES "public"."planned_interventions"("id","recommendation_id","bridge_id","partial_structure_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "work_packages_bridge_generated_idx" ON "work_packages" USING btree ("bridge_id","generated_at");--> statement-breakpoint
CREATE INDEX "work_packages_status_idx" ON "work_packages" USING btree ("status");
