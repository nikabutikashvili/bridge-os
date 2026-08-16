import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  unique,
  uuid
} from "drizzle-orm/pg-core";

import { bridges, partialStructures } from "./bridges.js";
import { auditColumns } from "./common.js";
import { inspectionTypeEnum } from "./enums.js";

export const inspections = pgTable(
  "inspections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    partialStructureId: uuid("partial_structure_id").notNull(),
    type: inspectionTypeEnum("type"),
    inspectedOn: date("inspected_on"),
    inspector: text("inspector"),
    conditionScore: numeric("condition_score", { precision: 2, scale: 1 }),
    cycleMonths: integer("cycle_months"),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.partialStructureId, table.bridgeId],
      foreignColumns: [partialStructures.id, partialStructures.bridgeId],
      name: "inspections_partial_structure_bridge_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("inspections_id_bridge_partial_unique").on(
      table.id,
      table.bridgeId,
      table.partialStructureId
    ),
    index("inspections_bridge_date_idx").on(table.bridgeId, table.inspectedOn),
    index("inspections_partial_structure_date_idx").on(
      table.partialStructureId,
      table.inspectedOn
    ),
    check(
      "inspections_condition_score_range",
      sql`${table.conditionScore} is null or ${table.conditionScore} between 1.0 and 4.0`
    ),
    check(
      "inspections_positive_cycle_months",
      sql`${table.cycleMonths} is null or ${table.cycleMonths} > 0`
    )
  ]
);
