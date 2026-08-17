import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { bridges } from "./bridges.js";
import { auditColumns } from "./common.js";
import { environmentalMetricSourceEnum } from "./enums.js";

export const environmentalMetrics = pgTable(
  "environmental_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    observationYear: smallint("observation_year").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 10, scale: 6 }),
    gridLatitude: numeric("grid_latitude", { precision: 9, scale: 6 }),
    gridLongitude: numeric("grid_longitude", { precision: 10, scale: 6 }),
    elevationM: numeric("elevation_m", { precision: 8, scale: 1 }),
    freezeThawDays: integer("freeze_thaw_days"),
    frostDays: integer("frost_days"),
    iceDays: integer("ice_days"),
    wetDryCycles: integer("wet_dry_cycles"),
    meanRelativeHumidityPercent: numeric("mean_relative_humidity_percent", {
      precision: 5,
      scale: 1
    }),
    precipitationHours: integer("precipitation_hours"),
    heavyRainDays20: integer("heavy_rain_days_20"),
    heavyRainDays30: integer("heavy_rain_days_30"),
    annualPrecipMm: numeric("annual_precip_mm", { precision: 8, scale: 1 }),
    deicingDays: integer("deicing_days"),
    monthlyPrecipMm: jsonb("monthly_precip_mm").$type<number[]>(),
    monthlyFreezeThawDays: jsonb("monthly_freeze_thaw_days").$type<number[]>(),
    source: environmentalMetricSourceEnum("source").notNull(),
    sourceDescription: text("source_description"),
    formulaVersion: text("formula_version").notNull(),
    ...auditColumns()
  },
  (table) => [
    uniqueIndex("environmental_metrics_bridge_year_unique").on(
      table.bridgeId,
      table.observationYear
    ),
    index("environmental_metrics_year_idx").on(table.observationYear),
    check(
      "environmental_metrics_year_range",
      sql`${table.observationYear} between 1900 and 2200`
    ),
    check(
      "environmental_metrics_latitude_range",
      sql`${table.latitude} is null or ${table.latitude} between -90 and 90`
    ),
    check(
      "environmental_metrics_longitude_range",
      sql`${table.longitude} is null or ${table.longitude} between -180 and 180`
    ),
    check(
      "environmental_metrics_non_negative_counts",
      sql`(${table.freezeThawDays} is null or ${table.freezeThawDays} >= 0)
        and (${table.frostDays} is null or ${table.frostDays} >= 0)
        and (${table.iceDays} is null or ${table.iceDays} >= 0)
        and (${table.wetDryCycles} is null or ${table.wetDryCycles} >= 0)
        and (${table.precipitationHours} is null or ${table.precipitationHours} >= 0)
        and (${table.heavyRainDays20} is null or ${table.heavyRainDays20} >= 0)
        and (${table.heavyRainDays30} is null or ${table.heavyRainDays30} >= 0)
        and (${table.deicingDays} is null or ${table.deicingDays} >= 0)`
    ),
    check(
      "environmental_metrics_humidity_range",
      sql`${table.meanRelativeHumidityPercent} is null
        or ${table.meanRelativeHumidityPercent} between 0 and 100`
    ),
    check(
      "environmental_metrics_precip_non_negative",
      sql`${table.annualPrecipMm} is null or ${table.annualPrecipMm} >= 0`
    ),
    check(
      "environmental_metrics_monthly_precip_shape",
      sql`${table.monthlyPrecipMm} is null
        or (jsonb_typeof(${table.monthlyPrecipMm}) = 'array'
          and jsonb_array_length(${table.monthlyPrecipMm}) = 12)`
    ),
    check(
      "environmental_metrics_monthly_freeze_thaw_shape",
      sql`${table.monthlyFreezeThawDays} is null
        or (jsonb_typeof(${table.monthlyFreezeThawDays}) = 'array'
          and jsonb_array_length(${table.monthlyFreezeThawDays}) = 12)`
    ),
    check(
      "environmental_metrics_formula_version_not_blank",
      sql`btrim(${table.formulaVersion}) <> ''`
    ),
    check(
      "environmental_metrics_source_description_not_blank",
      sql`${table.sourceDescription} is null or btrim(${table.sourceDescription}) <> ''`
    )
  ]
);
