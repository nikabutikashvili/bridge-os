import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { bridges } from "./bridges.js";
import { auditColumns } from "./common.js";
import {
  networkMetricSourceEnum,
  networkRoadClassEnum,
  networkTrafficAppliesToEnum
} from "./enums.js";

export const networkMetrics = pgTable(
  "network_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    observationYear: smallint("observation_year").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 10, scale: 6 }),
    carriedRoad: text("carried_road"),
    roadClass: networkRoadClassEnum("road_class").notNull(),
    trafficAppliesTo: networkTrafficAppliesToEnum("traffic_applies_to").notNull(),
    normalTripKm: numeric("normal_trip_km", { precision: 8, scale: 1 }),
    closureDetourKm: numeric("closure_detour_km", { precision: 8, scale: 1 }),
    additionalDistanceKm: numeric("additional_distance_km", { precision: 8, scale: 1 }),
    alternativeCrossingCount: integer("alternative_crossing_count"),
    onStrategicNetwork: boolean("on_strategic_network").notNull().default(false),
    source: networkMetricSourceEnum("source").notNull(),
    sourceDescription: text("source_description"),
    formulaVersion: text("formula_version").notNull(),
    ...auditColumns()
  },
  (table) => [
    uniqueIndex("network_metrics_bridge_unique").on(table.bridgeId),
    index("network_metrics_year_idx").on(table.observationYear),
    check(
      "network_metrics_year_range",
      sql`${table.observationYear} between 1900 and 2200`
    ),
    check(
      "network_metrics_latitude_range",
      sql`${table.latitude} is null or ${table.latitude} between -90 and 90`
    ),
    check(
      "network_metrics_longitude_range",
      sql`${table.longitude} is null or ${table.longitude} between -180 and 180`
    ),
    check(
      "network_metrics_distances_non_negative",
      sql`(${table.normalTripKm} is null or ${table.normalTripKm} >= 0)
        and (${table.closureDetourKm} is null or ${table.closureDetourKm} >= 0)
        and (${table.additionalDistanceKm} is null or ${table.additionalDistanceKm} >= 0)`
    ),
    check(
      "network_metrics_alternative_count_non_negative",
      sql`${table.alternativeCrossingCount} is null or ${table.alternativeCrossingCount} >= 0`
    ),
    check(
      "network_metrics_carried_road_not_blank",
      sql`${table.carriedRoad} is null or btrim(${table.carriedRoad}) <> ''`
    ),
    check(
      "network_metrics_formula_version_not_blank",
      sql`btrim(${table.formulaVersion}) <> ''`
    ),
    check(
      "network_metrics_source_description_not_blank",
      sql`${table.sourceDescription} is null or btrim(${table.sourceDescription}) <> ''`
    )
  ]
);
