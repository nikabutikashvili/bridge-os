import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  unique,
  uuid
} from "drizzle-orm/pg-core";

import { auditColumns, type ScalarProperties } from "./common.js";
import { bridges, partialStructures } from "./bridges.js";

export const components = pgTable(
  "components",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    partialStructureId: uuid("partial_structure_id").notNull(),
    type: text("type"),
    name: text("name"),
    location: text("location"),
    material: text("material"),
    constructionYear: smallint("construction_year"),
    installYear: smallint("install_year"),
    additionalProperties: jsonb("additional_properties").$type<ScalarProperties>(),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.partialStructureId, table.bridgeId],
      foreignColumns: [partialStructures.id, partialStructures.bridgeId],
      name: "components_partial_structure_bridge_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("components_id_bridge_partial_unique").on(
      table.id,
      table.bridgeId,
      table.partialStructureId
    ),
    index("components_bridge_id_idx").on(table.bridgeId),
    index("components_partial_structure_id_idx").on(table.partialStructureId),
    index("components_type_idx").on(table.type),
    check(
      "components_type_not_blank",
      sql`${table.type} is null or btrim(${table.type}) <> ''`
    ),
    check(
      "components_year_ranges",
      sql`(${table.constructionYear} is null or ${table.constructionYear} between 1700 and 2200)
        and (${table.installYear} is null or ${table.installYear} between 1700 and 2200)`
    ),
    check(
      "components_additional_properties_object",
      sql`${table.additionalProperties} is null or jsonb_typeof(${table.additionalProperties}) = 'object'`
    )
  ]
);
