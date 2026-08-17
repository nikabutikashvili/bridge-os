import { sql } from "drizzle-orm";

import type { BridgeDatabase } from "../../connection.js";
import {
  weatherFixture,
  weatherFixtureTimestamp,
  weatherFormulaVersion
} from "./data.js";

/**
 * Attaches Open-Meteo climate metrics to whichever demo bridges are already
 * present, matched by external structure number. Also fills missing coordinates
 * so later environment reads have a location. Bridges that have not been
 * extracted yet are skipped.
 */
export async function seedWeatherFixture(database: BridgeDatabase): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const entry of weatherFixture) {
      await transaction.execute(sql`
        update bridges
        set latitude = ${entry.latitude}, longitude = ${entry.longitude}
        where external_structure_number = ${entry.externalStructureNumber}
          and latitude is null
          and longitude is null
      `);

      await transaction.execute(sql`
        insert into environmental_metrics (
          id, bridge_id, observation_year, latitude, longitude,
          grid_latitude, grid_longitude, elevation_m,
          freeze_thaw_days, frost_days, ice_days, wet_dry_cycles,
          mean_relative_humidity_percent, precipitation_hours,
          heavy_rain_days_20, heavy_rain_days_30, annual_precip_mm, deicing_days,
          monthly_precip_mm, monthly_freeze_thaw_days,
          source, source_description, formula_version, created_at, updated_at
        )
        select
          ${entry.id}::uuid,
          b.id,
          ${entry.observationYear},
          ${entry.latitude},
          ${entry.longitude},
          ${entry.gridLatitude},
          ${entry.gridLongitude},
          ${entry.elevationM},
          ${entry.freezeThawDays},
          ${entry.frostDays},
          ${entry.iceDays},
          ${entry.wetDryCycles},
          ${entry.meanRelativeHumidityPercent},
          ${entry.precipitationHours},
          ${entry.heavyRainDays20},
          ${entry.heavyRainDays30},
          ${entry.annualPrecipMm},
          ${entry.deicingDays},
          ${JSON.stringify(entry.monthlyPrecipMm)}::jsonb,
          ${JSON.stringify(entry.monthlyFreezeThawDays)}::jsonb,
          'OPEN_METEO'::environmental_metric_source,
          ${entry.sourceDescription},
          ${weatherFormulaVersion},
          ${weatherFixtureTimestamp},
          ${weatherFixtureTimestamp}
        from bridges b
        where b.external_structure_number = ${entry.externalStructureNumber}
        on conflict (id) do update set
          bridge_id = excluded.bridge_id,
          observation_year = excluded.observation_year,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          grid_latitude = excluded.grid_latitude,
          grid_longitude = excluded.grid_longitude,
          elevation_m = excluded.elevation_m,
          freeze_thaw_days = excluded.freeze_thaw_days,
          frost_days = excluded.frost_days,
          ice_days = excluded.ice_days,
          wet_dry_cycles = excluded.wet_dry_cycles,
          mean_relative_humidity_percent = excluded.mean_relative_humidity_percent,
          precipitation_hours = excluded.precipitation_hours,
          heavy_rain_days_20 = excluded.heavy_rain_days_20,
          heavy_rain_days_30 = excluded.heavy_rain_days_30,
          annual_precip_mm = excluded.annual_precip_mm,
          deicing_days = excluded.deicing_days,
          monthly_precip_mm = excluded.monthly_precip_mm,
          monthly_freeze_thaw_days = excluded.monthly_freeze_thaw_days,
          source = excluded.source,
          source_description = excluded.source_description,
          formula_version = excluded.formula_version,
          updated_at = excluded.updated_at
      `);
    }
  });
}
