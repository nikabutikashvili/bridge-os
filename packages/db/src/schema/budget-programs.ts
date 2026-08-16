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
  unique,
  uuid
} from "drizzle-orm/pg-core";

import { auditColumns } from "./common.js";
import { plannedInterventions } from "./planned-interventions.js";

export const budgetPrograms = pgTable(
  "budget_programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planningYear: smallint("planning_year").notNull(),
    approvedBudgetAmount: numeric("approved_budget_amount", {
      precision: 16,
      scale: 2
    }),
    currency: char("currency", { length: 3 }),
    ...auditColumns()
  },
  (table) => [
    unique("budget_programs_planning_year_unique").on(table.planningYear),
    unique("budget_programs_id_planning_year_unique").on(
      table.id,
      table.planningYear
    ),
    check(
      "budget_programs_year_range",
      sql`${table.planningYear} between 1700 and 2200`
    ),
    check(
      "budget_programs_amount_currency_pair",
      sql`(${table.approvedBudgetAmount} is null and ${table.currency} is null)
        or (${table.approvedBudgetAmount} >= 0 and ${table.currency} ~ '^[A-Z]{3}$')`
    )
  ]
);

export const budgetProgramInterventions = pgTable(
  "budget_program_interventions",
  {
    budgetProgramId: uuid("budget_program_id").notNull(),
    interventionId: uuid("intervention_id").notNull(),
    planningYear: smallint("planning_year").notNull(),
    ...auditColumns()
  },
  (table) => [
    primaryKey({
      columns: [table.budgetProgramId, table.interventionId],
      name: "budget_program_interventions_pk"
    }),
    foreignKey({
      columns: [table.budgetProgramId, table.planningYear],
      foreignColumns: [budgetPrograms.id, budgetPrograms.planningYear],
      name: "budget_program_interventions_program_year_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.interventionId, table.planningYear],
      foreignColumns: [plannedInterventions.id, plannedInterventions.plannedYear],
      name: "budget_program_interventions_intervention_year_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    unique("budget_program_interventions_intervention_unique").on(
      table.interventionId
    ),
    index("budget_program_interventions_year_idx").on(table.planningYear)
  ]
);
