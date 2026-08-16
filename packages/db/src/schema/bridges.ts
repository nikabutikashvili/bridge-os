import { sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { auditColumns } from "./common.js";
import { bridgeDataOriginEnum } from "./enums.js";

export const bridges = pgTable(
  "bridges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalStructureNumber: text("external_structure_number"),
    name: text("name"),
    road: text("road"),
    countryCode: char("country_code", { length: 2 }),
    federalState: text("federal_state"),
    district: text("district"),
    municipality: text("municipality"),
    locality: text("locality"),
    postalCode: text("postal_code"),
    stationing: text("stationing"),
    crossedFeature: text("crossed_feature"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 10, scale: 6 }),
    owner: text("owner"),
    loadBearingResponsibility: text("load_bearing_responsibility"),
    responsibleAuthority: text("responsible_authority"),
    maintenanceOffice: text("maintenance_office"),
    dataOrigin: bridgeDataOriginEnum("data_origin"),
    ...auditColumns()
  },
  (table) => [
    uniqueIndex("bridges_external_structure_number_unique").on(table.externalStructureNumber),
    index("bridges_road_idx").on(table.road),
    index("bridges_federal_state_idx").on(table.federalState),
    index("bridges_responsible_authority_idx").on(table.responsibleAuthority),
    index("bridges_maintenance_office_idx").on(table.maintenanceOffice),
    index("bridges_data_origin_idx").on(table.dataOrigin),
    index("bridges_global_search_trgm_idx").using(
      "gin",
      sql`(
        coalesce(${table.externalStructureNumber}, '') || ' ' ||
        coalesce(${table.name}, '') || ' ' ||
        coalesce(${table.road}, '') || ' ' ||
        coalesce(${table.federalState}, '') || ' ' ||
        coalesce(${table.district}, '') || ' ' ||
        coalesce(${table.municipality}, '') || ' ' ||
        coalesce(${table.locality}, '') || ' ' ||
        coalesce(${table.stationing}, '') || ' ' ||
        coalesce(${table.crossedFeature}, '')
      ) gin_trgm_ops`
    ),
    check(
      "bridges_external_structure_number_not_blank",
      sql`${table.externalStructureNumber} is null or btrim(${table.externalStructureNumber}) <> ''`
    ),
    check(
      "bridges_country_code_format",
      sql`${table.countryCode} is null or ${table.countryCode} ~ '^[A-Z]{2}$'`
    ),
    check(
      "bridges_latitude_range",
      sql`${table.latitude} is null or ${table.latitude} between -90 and 90`
    ),
    check(
      "bridges_longitude_range",
      sql`${table.longitude} is null or ${table.longitude} between -180 and 180`
    )
  ]
);

export const partialStructures = pgTable(
  "partial_structures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    externalPartialStructureNumber: text("external_partial_structure_number"),
    name: text("name"),
    constructionYear: smallint("construction_year"),
    structureType: text("structure_type"),
    structuralSystem: text("structural_system"),
    lengthM: numeric("length_m", { precision: 12, scale: 3 }),
    widthM: numeric("width_m", { precision: 12, scale: 3 }),
    areaSqM: numeric("area_sq_m", { precision: 14, scale: 3 }),
    clearHeightM: numeric("clear_height_m", { precision: 12, scale: 3 }),
    spanCount: integer("span_count"),
    ...auditColumns()
  },
  (table) => [
    unique("partial_structures_id_bridge_unique").on(table.id, table.bridgeId),
    uniqueIndex("partial_structures_bridge_external_number_unique").on(
      table.bridgeId,
      table.externalPartialStructureNumber
    ),
    index("partial_structures_bridge_id_idx").on(table.bridgeId),
    check(
      "partial_structures_external_number_not_blank",
      sql`${table.externalPartialStructureNumber} is null or btrim(${table.externalPartialStructureNumber}) <> ''`
    ),
    check(
      "partial_structures_construction_year_range",
      sql`${table.constructionYear} is null or ${table.constructionYear} between 1700 and 2200`
    ),
    check(
      "partial_structures_positive_geometry",
      sql`(${table.lengthM} is null or ${table.lengthM} > 0)
        and (${table.widthM} is null or ${table.widthM} > 0)
        and (${table.areaSqM} is null or ${table.areaSqM} > 0)
        and (${table.clearHeightM} is null or ${table.clearHeightM} > 0)`
    ),
    check(
      "partial_structures_positive_span_count",
      sql`${table.spanCount} is null or ${table.spanCount} > 0`
    )
  ]
);
