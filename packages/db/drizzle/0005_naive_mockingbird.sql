CREATE TYPE "public"."planned_intervention_status" AS ENUM('PLANNED', 'BUDGETED', 'TENDER_PREPARATION', 'TENDERED_READY', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "planned_interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"bridge_id" uuid NOT NULL,
	"partial_structure_id" uuid NOT NULL,
	"work_type" text NOT NULL,
	"planned_year" smallint NOT NULL,
	"quantity" numeric(16, 3),
	"unit" text,
	"estimated_cost" numeric(16, 2),
	"estimated_cost_currency" char(3),
	"status" "planned_intervention_status" DEFAULT 'PLANNED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planned_interventions_recommendation_unique" UNIQUE("recommendation_id"),
	CONSTRAINT "planned_interventions_work_type_not_blank" CHECK (btrim("planned_interventions"."work_type") <> ''),
	CONSTRAINT "planned_interventions_quantity_unit_pair" CHECK (("planned_interventions"."quantity" is null and "planned_interventions"."unit" is null)
        or ("planned_interventions"."quantity" >= 0 and nullif(btrim("planned_interventions"."unit"), '') is not null)),
	CONSTRAINT "planned_interventions_estimated_cost_pair" CHECK (("planned_interventions"."estimated_cost" is null and "planned_interventions"."estimated_cost_currency" is null)
        or ("planned_interventions"."estimated_cost" >= 0 and "planned_interventions"."estimated_cost_currency" ~ '^[A-Z]{3}$')),
	CONSTRAINT "planned_interventions_planned_year_range" CHECK ("planned_interventions"."planned_year" between 1700 and 2200)
);
--> statement-breakpoint
ALTER TABLE "planned_interventions" ADD CONSTRAINT "planned_interventions_recommendation_scope_fk" FOREIGN KEY ("recommendation_id","bridge_id","partial_structure_id") REFERENCES "public"."recommendations"("id","bridge_id","partial_structure_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planned_interventions" ADD CONSTRAINT "planned_interventions_partial_structure_bridge_fk" FOREIGN KEY ("partial_structure_id","bridge_id") REFERENCES "public"."partial_structures"("id","bridge_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "planned_interventions_status_year_idx" ON "planned_interventions" USING btree ("status","planned_year");--> statement-breakpoint
CREATE INDEX "planned_interventions_bridge_idx" ON "planned_interventions" USING btree ("bridge_id");