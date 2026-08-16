CREATE TYPE "public"."intervention_estimate_source" AS ENUM('USER_PLANNING', 'EXTERNAL_ENRICHED');--> statement-breakpoint
CREATE TYPE "public"."intervention_estimate_status" AS ENUM('DRAFT', 'REVIEWED');--> statement-breakpoint
CREATE TABLE "budget_program_interventions" (
	"budget_program_id" uuid NOT NULL,
	"intervention_id" uuid NOT NULL,
	"planning_year" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_program_interventions_pk" PRIMARY KEY("budget_program_id","intervention_id"),
	CONSTRAINT "budget_program_interventions_intervention_unique" UNIQUE("intervention_id")
);
--> statement-breakpoint
CREATE TABLE "budget_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_year" smallint NOT NULL,
	"approved_budget_amount" numeric(16, 2),
	"currency" char(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_programs_planning_year_unique" UNIQUE("planning_year"),
	CONSTRAINT "budget_programs_id_planning_year_unique" UNIQUE("id","planning_year"),
	CONSTRAINT "budget_programs_year_range" CHECK ("budget_programs"."planning_year" between 1700 and 2200),
	CONSTRAINT "budget_programs_amount_currency_pair" CHECK (("budget_programs"."approved_budget_amount" is null and "budget_programs"."currency" is null)
        or ("budget_programs"."approved_budget_amount" >= 0 and "budget_programs"."currency" ~ '^[A-Z]{3}$'))
);
--> statement-breakpoint
ALTER TABLE "planned_interventions" DROP CONSTRAINT "planned_interventions_estimated_cost_pair";--> statement-breakpoint
ALTER TABLE "planned_interventions" ADD COLUMN "estimated_cost_source" "intervention_estimate_source";--> statement-breakpoint
ALTER TABLE "planned_interventions" ADD COLUMN "estimated_cost_status" "intervention_estimate_status";--> statement-breakpoint
UPDATE "planned_interventions"
SET
	"estimated_cost_source" = 'USER_PLANNING',
	"estimated_cost_status" = 'DRAFT'
WHERE "estimated_cost" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "planned_interventions" ADD CONSTRAINT "planned_interventions_id_planned_year_unique" UNIQUE("id","planned_year");--> statement-breakpoint
ALTER TABLE "budget_program_interventions" ADD CONSTRAINT "budget_program_interventions_program_year_fk" FOREIGN KEY ("budget_program_id","planning_year") REFERENCES "public"."budget_programs"("id","planning_year") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "budget_program_interventions" ADD CONSTRAINT "budget_program_interventions_intervention_year_fk" FOREIGN KEY ("intervention_id","planning_year") REFERENCES "public"."planned_interventions"("id","planned_year") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "budget_program_interventions_year_idx" ON "budget_program_interventions" USING btree ("planning_year");--> statement-breakpoint
ALTER TABLE "planned_interventions" ADD CONSTRAINT "planned_interventions_estimated_cost_pair" CHECK (("planned_interventions"."estimated_cost" is null
          and "planned_interventions"."estimated_cost_currency" is null
          and "planned_interventions"."estimated_cost_source" is null
          and "planned_interventions"."estimated_cost_status" is null)
        or ("planned_interventions"."estimated_cost" >= 0
          and "planned_interventions"."estimated_cost_currency" ~ '^[A-Z]{3}$'
          and "planned_interventions"."estimated_cost_source" is not null
          and "planned_interventions"."estimated_cost_status" is not null));
