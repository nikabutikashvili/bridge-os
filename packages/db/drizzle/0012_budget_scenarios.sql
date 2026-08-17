CREATE TYPE "public"."budget_scenario_assignment_source" AS ENUM('SEEDED', 'AUTO_FILL', 'USER_OVERRIDE');--> statement-breakpoint
CREATE TYPE "public"."budget_scenario_status" AS ENUM('DRAFT', 'ADOPTED');--> statement-breakpoint
CREATE TABLE "budget_scenario_assignments" (
	"scenario_id" uuid NOT NULL,
	"intervention_id" uuid NOT NULL,
	"assigned_year" smallint,
	"assignment_source" "budget_scenario_assignment_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_scenario_assignments_pk" PRIMARY KEY("scenario_id","intervention_id"),
	CONSTRAINT "budget_scenario_assignments_year_range" CHECK ("budget_scenario_assignments"."assigned_year" is null
        or "budget_scenario_assignments"."assigned_year" between 1700 and 2200)
);
--> statement-breakpoint
CREATE TABLE "budget_scenario_envelopes" (
	"scenario_id" uuid NOT NULL,
	"planning_year" smallint NOT NULL,
	"approved_budget_amount" numeric(16, 2),
	"currency" char(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_scenario_envelopes_pk" PRIMARY KEY("scenario_id","planning_year"),
	CONSTRAINT "budget_scenario_envelopes_year_range" CHECK ("budget_scenario_envelopes"."planning_year" between 1700 and 2200),
	CONSTRAINT "budget_scenario_envelopes_amount_currency_pair" CHECK (("budget_scenario_envelopes"."approved_budget_amount" is null and "budget_scenario_envelopes"."currency" is null)
        or ("budget_scenario_envelopes"."approved_budget_amount" >= 0 and "budget_scenario_envelopes"."currency" ~ '^[A-Z]{3}$'))
);
--> statement-breakpoint
CREATE TABLE "budget_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "budget_scenario_status" DEFAULT 'DRAFT' NOT NULL,
	"horizon_start_year" smallint NOT NULL,
	"horizon_years" smallint DEFAULT 5 NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"adopted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_scenarios_name_not_blank" CHECK (btrim("budget_scenarios"."name") <> ''),
	CONSTRAINT "budget_scenarios_horizon_start_year_range" CHECK ("budget_scenarios"."horizon_start_year" between 1700 and 2200),
	CONSTRAINT "budget_scenarios_horizon_years_range" CHECK ("budget_scenarios"."horizon_years" between 1 and 15),
	CONSTRAINT "budget_scenarios_currency_format" CHECK ("budget_scenarios"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "budget_scenarios_adopted_at_matches_status" CHECK (("budget_scenarios"."status" = 'DRAFT' and "budget_scenarios"."adopted_at" is null)
        or ("budget_scenarios"."status" = 'ADOPTED' and "budget_scenarios"."adopted_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "budget_scenario_assignments" ADD CONSTRAINT "budget_scenario_assignments_scenario_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."budget_scenarios"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "budget_scenario_assignments" ADD CONSTRAINT "budget_scenario_assignments_intervention_fk" FOREIGN KEY ("intervention_id") REFERENCES "public"."planned_interventions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "budget_scenario_envelopes" ADD CONSTRAINT "budget_scenario_envelopes_scenario_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."budget_scenarios"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "budget_scenario_assignments_year_idx" ON "budget_scenario_assignments" USING btree ("scenario_id","assigned_year");--> statement-breakpoint
CREATE INDEX "budget_scenarios_status_updated_idx" ON "budget_scenarios" USING btree ("status","updated_at");
