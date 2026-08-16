import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { bridges, partialStructures } from "./bridges.js";
import { auditColumns } from "./common.js";
import { components } from "./components.js";
import { findingStatusEnum } from "./enums.js";
import { inspections } from "./inspections.js";

export const findings = pgTable(
  "findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    partialStructureId: uuid("partial_structure_id").notNull(),
    inspectionId: uuid("inspection_id").notNull(),
    componentId: uuid("component_id"),
    sourceIdentifier: text("source_identifier"),
    defectType: text("defect_type"),
    description: text("description"),
    location: text("location"),
    extent: text("extent"),
    dimensionLength: numeric("dimension_length", { precision: 14, scale: 3 }),
    dimensionWidth: numeric("dimension_width", { precision: 14, scale: 3 }),
    dimensionDepth: numeric("dimension_depth", { precision: 14, scale: 3 }),
    dimensionUnit: text("dimension_unit"),
    quantity: numeric("quantity", { precision: 16, scale: 3 }),
    quantityUnit: text("quantity_unit"),
    stabilityRating: smallint("stability_rating"),
    trafficSafetyRating: smallint("traffic_safety_rating"),
    durabilityRating: smallint("durability_rating"),
    status: findingStatusEnum("status"),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.partialStructureId, table.bridgeId],
      foreignColumns: [partialStructures.id, partialStructures.bridgeId],
      name: "findings_partial_structure_bridge_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.inspectionId, table.bridgeId, table.partialStructureId],
      foreignColumns: [inspections.id, inspections.bridgeId, inspections.partialStructureId],
      name: "findings_inspection_scope_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.componentId, table.bridgeId, table.partialStructureId],
      foreignColumns: [components.id, components.bridgeId, components.partialStructureId],
      name: "findings_component_scope_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("findings_id_bridge_partial_unique").on(
      table.id,
      table.bridgeId,
      table.partialStructureId
    ),
    uniqueIndex("findings_inspection_source_identifier_unique").on(
      table.inspectionId,
      table.sourceIdentifier
    ),
    index("findings_bridge_status_idx").on(table.bridgeId, table.status),
    index("findings_partial_structure_idx").on(table.partialStructureId),
    index("findings_inspection_id_idx").on(table.inspectionId),
    index("findings_component_id_idx").on(table.componentId),
    index("findings_global_search_trgm_idx").using(
      "gin",
      sql`(
        coalesce(${table.sourceIdentifier}, '') || ' ' ||
        coalesce(${table.defectType}, '') || ' ' ||
        coalesce(${table.description}, '') || ' ' ||
        coalesce(${table.location}, '') || ' ' ||
        coalesce(${table.extent}, '')
      ) gin_trgm_ops`
    ),
    check(
      "findings_description_not_blank",
      sql`${table.description} is null or btrim(${table.description}) <> ''`
    ),
    check(
      "findings_non_negative_measurements",
      sql`(${table.dimensionLength} is null or ${table.dimensionLength} >= 0)
        and (${table.dimensionWidth} is null or ${table.dimensionWidth} >= 0)
        and (${table.dimensionDepth} is null or ${table.dimensionDepth} >= 0)
        and (${table.quantity} is null or ${table.quantity} >= 0)`
    ),
    check(
      "findings_dimension_unit_pair",
      sql`(
        (${table.dimensionLength} is null and ${table.dimensionWidth} is null and ${table.dimensionDepth} is null and ${table.dimensionUnit} is null)
        or
        ((${table.dimensionLength} is not null or ${table.dimensionWidth} is not null or ${table.dimensionDepth} is not null)
          and nullif(btrim(${table.dimensionUnit}), '') is not null)
      )`
    ),
    check(
      "findings_quantity_unit_pair",
      sql`(${table.quantity} is null and ${table.quantityUnit} is null)
        or (${table.quantity} is not null and nullif(btrim(${table.quantityUnit}), '') is not null)`
    ),
    check(
      "findings_svd_ranges",
      sql`(${table.stabilityRating} is null or ${table.stabilityRating} between 0 and 4)
        and (${table.trafficSafetyRating} is null or ${table.trafficSafetyRating} between 0 and 4)
        and (${table.durabilityRating} is null or ${table.durabilityRating} between 0 and 4)`
    )
  ]
);
