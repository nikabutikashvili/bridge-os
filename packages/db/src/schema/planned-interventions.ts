import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  unique,
  uuid
} from "drizzle-orm/pg-core";

import { partialStructures } from "./bridges.js";
import { auditColumns } from "./common.js";
import { plannedInterventionStatusEnum } from "./enums.js";
import {
  interventionEstimateSourceEnum,
  interventionEstimateStatusEnum
} from "./enums.js";
import { recommendations } from "./recommendations.js";

export const plannedInterventions = pgTable(
  "planned_interventions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recommendationId: uuid("recommendation_id").notNull(),
    bridgeId: uuid("bridge_id").notNull(),
    partialStructureId: uuid("partial_structure_id").notNull(),
    workType: text("work_type").notNull(),
    plannedYear: smallint("planned_year").notNull(),
    quantity: numeric("quantity", { precision: 16, scale: 3 }),
    unit: text("unit"),
    estimatedCost: numeric("estimated_cost", { precision: 16, scale: 2 }),
    estimatedCostCurrency: char("estimated_cost_currency", { length: 3 }),
    estimatedCostSource: interventionEstimateSourceEnum(
      "estimated_cost_source"
    ),
    estimatedCostStatus: interventionEstimateStatusEnum(
      "estimated_cost_status"
    ),
    status: plannedInterventionStatusEnum("status").notNull().default("PLANNED"),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.recommendationId, table.bridgeId, table.partialStructureId],
      foreignColumns: [
        recommendations.id,
        recommendations.bridgeId,
        recommendations.partialStructureId
      ],
      name: "planned_interventions_recommendation_scope_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.partialStructureId, table.bridgeId],
      foreignColumns: [partialStructures.id, partialStructures.bridgeId],
      name: "planned_interventions_partial_structure_bridge_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("planned_interventions_recommendation_unique").on(
      table.recommendationId
    ),
    unique("planned_interventions_id_planned_year_unique").on(
      table.id,
      table.plannedYear
    ),
    unique("planned_interventions_work_package_scope_unique").on(
      table.id,
      table.recommendationId,
      table.bridgeId,
      table.partialStructureId
    ),
    index("planned_interventions_status_year_idx").on(
      table.status,
      table.plannedYear
    ),
    index("planned_interventions_bridge_idx").on(table.bridgeId),
    check(
      "planned_interventions_work_type_not_blank",
      sql`btrim(${table.workType}) <> ''`
    ),
    check(
      "planned_interventions_quantity_unit_pair",
      sql`(${table.quantity} is null and ${table.unit} is null)
        or (${table.quantity} >= 0 and nullif(btrim(${table.unit}), '') is not null)`
    ),
    check(
      "planned_interventions_estimated_cost_pair",
      sql`(${table.estimatedCost} is null
          and ${table.estimatedCostCurrency} is null
          and ${table.estimatedCostSource} is null
          and ${table.estimatedCostStatus} is null)
        or (${table.estimatedCost} >= 0
          and ${table.estimatedCostCurrency} ~ '^[A-Z]{3}$'
          and ${table.estimatedCostSource} is not null
          and ${table.estimatedCostStatus} is not null)`
    ),
    check(
      "planned_interventions_planned_year_range",
      sql`${table.plannedYear} between 1700 and 2200`
    )
  ]
);
