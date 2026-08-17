import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { auditColumns } from "./common.js";
import {
  budgetScenarioAssignmentSourceEnum,
  budgetScenarioStatusEnum
} from "./enums.js";
import { plannedInterventions } from "./planned-interventions.js";

export const budgetScenarios = pgTable(
  "budget_scenarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    status: budgetScenarioStatusEnum("status").notNull().default("DRAFT"),
    horizonStartYear: smallint("horizon_start_year").notNull(),
    horizonYears: smallint("horizon_years").notNull().default(5),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    adoptedAt: timestamp("adopted_at", { withTimezone: true }),
    ...auditColumns()
  },
  (table) => [
    index("budget_scenarios_status_updated_idx").on(
      table.status,
      table.updatedAt
    ),
    check(
      "budget_scenarios_name_not_blank",
      sql`btrim(${table.name}) <> ''`
    ),
    check(
      "budget_scenarios_horizon_start_year_range",
      sql`${table.horizonStartYear} between 1700 and 2200`
    ),
    check(
      "budget_scenarios_horizon_years_range",
      sql`${table.horizonYears} between 1 and 15`
    ),
    check(
      "budget_scenarios_currency_format",
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    check(
      "budget_scenarios_adopted_at_matches_status",
      sql`(${table.status} = 'DRAFT' and ${table.adoptedAt} is null)
        or (${table.status} = 'ADOPTED' and ${table.adoptedAt} is not null)`
    )
  ]
);

export const budgetScenarioEnvelopes = pgTable(
  "budget_scenario_envelopes",
  {
    scenarioId: uuid("scenario_id").notNull(),
    planningYear: smallint("planning_year").notNull(),
    approvedBudgetAmount: numeric("approved_budget_amount", {
      precision: 16,
      scale: 2
    }),
    currency: char("currency", { length: 3 }),
    ...auditColumns()
  },
  (table) => [
    primaryKey({
      columns: [table.scenarioId, table.planningYear],
      name: "budget_scenario_envelopes_pk"
    }),
    foreignKey({
      columns: [table.scenarioId],
      foreignColumns: [budgetScenarios.id],
      name: "budget_scenario_envelopes_scenario_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    check(
      "budget_scenario_envelopes_year_range",
      sql`${table.planningYear} between 1700 and 2200`
    ),
    check(
      "budget_scenario_envelopes_amount_currency_pair",
      sql`(${table.approvedBudgetAmount} is null and ${table.currency} is null)
        or (${table.approvedBudgetAmount} >= 0 and ${table.currency} ~ '^[A-Z]{3}$')`
    )
  ]
);

export const budgetScenarioAssignments = pgTable(
  "budget_scenario_assignments",
  {
    scenarioId: uuid("scenario_id").notNull(),
    interventionId: uuid("intervention_id").notNull(),
    assignedYear: smallint("assigned_year"),
    assignmentSource: budgetScenarioAssignmentSourceEnum(
      "assignment_source"
    ).notNull(),
    ...auditColumns()
  },
  (table) => [
    primaryKey({
      columns: [table.scenarioId, table.interventionId],
      name: "budget_scenario_assignments_pk"
    }),
    foreignKey({
      columns: [table.scenarioId],
      foreignColumns: [budgetScenarios.id],
      name: "budget_scenario_assignments_scenario_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.interventionId],
      foreignColumns: [plannedInterventions.id],
      name: "budget_scenario_assignments_intervention_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("budget_scenario_assignments_year_idx").on(
      table.scenarioId,
      table.assignedYear
    ),
    check(
      "budget_scenario_assignments_year_range",
      sql`${table.assignedYear} is null
        or ${table.assignedYear} between 1700 and 2200`
    )
  ]
);
