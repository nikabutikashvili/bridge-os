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
  uuid
} from "drizzle-orm/pg-core";

import { bridges } from "./bridges.js";
import { auditColumns } from "./common.js";
import { trafficObservationSourceEnum } from "./enums.js";

export const trafficObservations = pgTable(
  "traffic_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    observationYear: smallint("observation_year").notNull(),
    observedOn: date("observed_on"),
    dailyTraffic: integer("daily_traffic"),
    heavyVehicleDaily: integer("heavy_vehicle_daily"),
    truckSharePercent: numeric("truck_share_percent", { precision: 5, scale: 2 }),
    source: trafficObservationSourceEnum("source").notNull().default("DOCUMENT"),
    sourceDescription: text("source_description"),
    ...auditColumns()
  },
  (table) => [
    index("traffic_observations_bridge_year_idx").on(table.bridgeId, table.observationYear),
    check(
      "traffic_observations_year_range",
      sql`${table.observationYear} between 1900 and 2200`
    ),
    check(
      "traffic_observations_date_matches_year",
      sql`${table.observedOn} is null or extract(year from ${table.observedOn}) = ${table.observationYear}`
    ),
    check(
      "traffic_observations_non_negative_daily_traffic",
      sql`${table.dailyTraffic} is null or ${table.dailyTraffic} >= 0`
    ),
    check(
      "traffic_observations_non_negative_heavy_vehicle_daily",
      sql`${table.heavyVehicleDaily} is null or ${table.heavyVehicleDaily} >= 0`
    ),
    check(
      "traffic_observations_truck_share_range",
      sql`${table.truckSharePercent} is null or ${table.truckSharePercent} between 0 and 100`
    )
  ]
);
