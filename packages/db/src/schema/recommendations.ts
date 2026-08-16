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
  unique,
  uuid
} from "drizzle-orm/pg-core";

import { bridges, partialStructures } from "./bridges.js";
import { auditColumns } from "./common.js";
import { recommendationStatusEnum } from "./enums.js";
import { findings } from "./findings.js";

export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    partialStructureId: uuid("partial_structure_id").notNull(),
    workType: text("work_type"),
    description: text("description"),
    urgency: text("urgency"),
    quantity: numeric("quantity", { precision: 16, scale: 3 }),
    unit: text("unit"),
    sourceEstimatedCost: numeric("source_estimated_cost", { precision: 16, scale: 2 }),
    sourceEstimatedCostCurrency: char("source_estimated_cost_currency", { length: 3 }),
    targetYear: smallint("target_year"),
    plannedYear: smallint("planned_year"),
    status: recommendationStatusEnum("status"),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.partialStructureId, table.bridgeId],
      foreignColumns: [partialStructures.id, partialStructures.bridgeId],
      name: "recommendations_partial_structure_bridge_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("recommendations_id_bridge_partial_unique").on(
      table.id,
      table.bridgeId,
      table.partialStructureId
    ),
    index("recommendations_bridge_status_idx").on(table.bridgeId, table.status),
    index("recommendations_partial_structure_idx").on(table.partialStructureId),
    index("recommendations_planned_year_idx").on(table.plannedYear),
    index("recommendations_global_search_trgm_idx").using(
      "gin",
      sql`(
        coalesce(${table.workType}, '') || ' ' ||
        coalesce(${table.description}, '') || ' ' ||
        coalesce(${table.urgency}, '')
      ) gin_trgm_ops`
    ),
    check(
      "recommendations_description_not_blank",
      sql`${table.description} is null or btrim(${table.description}) <> ''`
    ),
    check(
      "recommendations_quantity_unit_pair",
      sql`(${table.quantity} is null and ${table.unit} is null)
        or (${table.quantity} >= 0 and nullif(btrim(${table.unit}), '') is not null)`
    ),
    check(
      "recommendations_estimated_cost_pair",
      sql`(${table.sourceEstimatedCost} is null and ${table.sourceEstimatedCostCurrency} is null)
        or (${table.sourceEstimatedCost} >= 0 and ${table.sourceEstimatedCostCurrency} ~ '^[A-Z]{3}$')`
    ),
    check(
      "recommendations_year_ranges",
      sql`(${table.targetYear} is null or ${table.targetYear} between 1700 and 2200)
        and (${table.plannedYear} is null or ${table.plannedYear} between 1700 and 2200)`
    )
  ]
);

export const recommendationFindings = pgTable(
  "recommendation_findings",
  {
    bridgeId: uuid("bridge_id").notNull(),
    partialStructureId: uuid("partial_structure_id").notNull(),
    recommendationId: uuid("recommendation_id").notNull(),
    findingId: uuid("finding_id").notNull(),
    ...auditColumns()
  },
  (table) => [
    primaryKey({
      columns: [table.recommendationId, table.findingId],
      name: "recommendation_findings_pk"
    }),
    foreignKey({
      columns: [table.recommendationId, table.bridgeId, table.partialStructureId],
      foreignColumns: [
        recommendations.id,
        recommendations.bridgeId,
        recommendations.partialStructureId
      ],
      name: "recommendation_findings_recommendation_scope_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.findingId, table.bridgeId, table.partialStructureId],
      foreignColumns: [findings.id, findings.bridgeId, findings.partialStructureId],
      name: "recommendation_findings_finding_scope_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("recommendation_findings_finding_id_idx").on(table.findingId)
  ]
);
