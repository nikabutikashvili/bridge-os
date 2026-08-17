import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { bridges } from "./bridges.js";
import { auditColumns } from "./common.js";
import {
  hydrologicalMetricSourceEnum,
  hydrologicalWaterStateEnum
} from "./enums.js";

export const hydrologicalMetrics = pgTable(
  "hydrological_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    stationUuid: uuid("station_uuid").notNull(),
    stationName: text("station_name").notNull(),
    stationNumber: text("station_number"),
    waterName: text("water_name").notNull(),
    riverKm: numeric("river_km", { precision: 8, scale: 3 }),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 10, scale: 6 }),
    distanceKm: numeric("distance_km", { precision: 6, scale: 1 }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    waterLevelCm: integer("water_level_cm").notNull(),
    unit: text("unit").notNull(),
    stateMnwMhw: hydrologicalWaterStateEnum("state_mnw_mhw"),
    stateNswHsw: hydrologicalWaterStateEnum("state_nsw_hsw"),
    mhwCm: integer("mhw_cm"),
    hswCm: integer("hsw_cm"),
    hhwCm: integer("hhw_cm"),
    mnwCm: integer("mnw_cm"),
    mwCm: integer("mw_cm"),
    markeICm: integer("marke_i_cm"),
    markeIICm: integer("marke_ii_cm"),
    inspectionTriggerCm: integer("inspection_trigger_cm").notNull(),
    source: hydrologicalMetricSourceEnum("source").notNull(),
    sourceDescription: text("source_description"),
    formulaVersion: text("formula_version").notNull(),
    ...auditColumns()
  },
  (table) => [
    uniqueIndex("hydrological_metrics_bridge_unique").on(table.bridgeId),
    index("hydrological_metrics_station_idx").on(table.stationUuid),
    check(
      "hydrological_metrics_station_name_not_blank",
      sql`btrim(${table.stationName}) <> ''`
    ),
    check(
      "hydrological_metrics_water_name_not_blank",
      sql`btrim(${table.waterName}) <> ''`
    ),
    check(
      "hydrological_metrics_unit_not_blank",
      sql`btrim(${table.unit}) <> ''`
    ),
    check(
      "hydrological_metrics_latitude_range",
      sql`${table.latitude} is null or ${table.latitude} between -90 and 90`
    ),
    check(
      "hydrological_metrics_longitude_range",
      sql`${table.longitude} is null or ${table.longitude} between -180 and 180`
    ),
    check(
      "hydrological_metrics_distance_non_negative",
      sql`${table.distanceKm} is null or ${table.distanceKm} >= 0`
    ),
    check(
      "hydrological_metrics_levels_non_negative",
      sql`${table.waterLevelCm} >= 0
        and (${table.mhwCm} is null or ${table.mhwCm} >= 0)
        and (${table.hswCm} is null or ${table.hswCm} >= 0)
        and (${table.hhwCm} is null or ${table.hhwCm} >= 0)
        and (${table.mnwCm} is null or ${table.mnwCm} >= 0)
        and (${table.mwCm} is null or ${table.mwCm} >= 0)
        and (${table.markeICm} is null or ${table.markeICm} >= 0)
        and (${table.markeIICm} is null or ${table.markeIICm} >= 0)
        and ${table.inspectionTriggerCm} >= 0`
    ),
    check(
      "hydrological_metrics_formula_version_not_blank",
      sql`btrim(${table.formulaVersion}) <> ''`
    ),
    check(
      "hydrological_metrics_source_description_not_blank",
      sql`${table.sourceDescription} is null or btrim(${table.sourceDescription}) <> ''`
    ),
    check(
      "hydrological_metrics_station_number_not_blank",
      sql`${table.stationNumber} is null or btrim(${table.stationNumber}) <> ''`
    )
  ]
);

export const hydrologicalFloodEvents = pgTable(
  "hydrological_flood_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    eventYear: smallint("event_year").notNull(),
    peakedOn: date("peaked_on").notNull(),
    peakWaterLevelCm: integer("peak_water_level_cm").notNull(),
    stationUuid: uuid("station_uuid").notNull(),
    stationName: text("station_name").notNull(),
    waterName: text("water_name").notNull(),
    mhwCm: integer("mhw_cm"),
    hswCm: integer("hsw_cm"),
    hhwCm: integer("hhw_cm"),
    markeICm: integer("marke_i_cm"),
    markeIICm: integer("marke_ii_cm"),
    source: hydrologicalMetricSourceEnum("source").notNull(),
    sourceDescription: text("source_description"),
    ...auditColumns()
  },
  (table) => [
    uniqueIndex("hydrological_flood_events_bridge_year_unique").on(
      table.bridgeId,
      table.eventYear
    ),
    index("hydrological_flood_events_bridge_idx").on(table.bridgeId),
    check(
      "hydrological_flood_events_year_range",
      sql`${table.eventYear} between 1900 and 2200`
    ),
    check(
      "hydrological_flood_events_date_matches_year",
      sql`extract(year from ${table.peakedOn}) = ${table.eventYear}`
    ),
    check(
      "hydrological_flood_events_peak_non_negative",
      sql`${table.peakWaterLevelCm} >= 0
        and (${table.mhwCm} is null or ${table.mhwCm} >= 0)
        and (${table.hswCm} is null or ${table.hswCm} >= 0)
        and (${table.hhwCm} is null or ${table.hhwCm} >= 0)
        and (${table.markeICm} is null or ${table.markeICm} >= 0)
        and (${table.markeIICm} is null or ${table.markeIICm} >= 0)`
    ),
    check(
      "hydrological_flood_events_station_name_not_blank",
      sql`btrim(${table.stationName}) <> ''`
    ),
    check(
      "hydrological_flood_events_water_name_not_blank",
      sql`btrim(${table.waterName}) <> ''`
    ),
    check(
      "hydrological_flood_events_source_description_not_blank",
      sql`${table.sourceDescription} is null or btrim(${table.sourceDescription}) <> ''`
    )
  ]
);
