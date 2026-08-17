import { sql } from "drizzle-orm";

import type { BridgeDatabase } from "../../connection.js";
import {
  hydrologyFixtureTimestamp,
  hydrologyFloodEventFixture,
  hydrologyFormulaVersion,
  hydrologyMetricFixture
} from "./data.js";

/**
 * Attaches a seeded PEGELONLINE snapshot and published Rhine flood years to
 * whichever demo bridges are already present, matched by external structure
 * number. Bridges that have not been extracted yet are skipped.
 */
export async function seedHydrologyFixture(database: BridgeDatabase): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const entry of hydrologyMetricFixture) {
      await transaction.execute(sql`
        insert into hydrological_metrics (
          id, bridge_id, station_uuid, station_name, station_number, water_name,
          river_km, latitude, longitude, distance_km, observed_at, water_level_cm,
          unit, state_mnw_mhw, state_nsw_hsw, mhw_cm, hsw_cm, hhw_cm, mnw_cm, mw_cm,
          marke_i_cm, marke_ii_cm, inspection_trigger_cm, source, source_description,
          formula_version, created_at, updated_at
        )
        select
          ${entry.id}::uuid,
          b.id,
          ${entry.stationUuid}::uuid,
          ${entry.stationName},
          ${entry.stationNumber},
          ${entry.waterName},
          ${entry.riverKm},
          ${entry.latitude},
          ${entry.longitude},
          ${entry.distanceKm},
          ${entry.observedAt}::timestamptz,
          ${entry.waterLevelCm},
          ${entry.unit},
          ${entry.stateMnwMhw}::hydrological_water_state,
          ${entry.stateNswHsw}::hydrological_water_state,
          ${entry.mhwCm},
          ${entry.hswCm},
          ${entry.hhwCm},
          ${entry.mnwCm},
          ${entry.mwCm},
          ${entry.markeICm},
          ${entry.markeIICm},
          ${entry.inspectionTriggerCm},
          'PEGELONLINE'::hydrological_metric_source,
          ${entry.sourceDescription},
          ${hydrologyFormulaVersion},
          ${hydrologyFixtureTimestamp},
          ${hydrologyFixtureTimestamp}
        from bridges b
        where b.external_structure_number = ${entry.externalStructureNumber}
        on conflict (id) do update set
          bridge_id = excluded.bridge_id,
          station_uuid = excluded.station_uuid,
          station_name = excluded.station_name,
          station_number = excluded.station_number,
          water_name = excluded.water_name,
          river_km = excluded.river_km,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          distance_km = excluded.distance_km,
          observed_at = excluded.observed_at,
          water_level_cm = excluded.water_level_cm,
          unit = excluded.unit,
          state_mnw_mhw = excluded.state_mnw_mhw,
          state_nsw_hsw = excluded.state_nsw_hsw,
          mhw_cm = excluded.mhw_cm,
          hsw_cm = excluded.hsw_cm,
          hhw_cm = excluded.hhw_cm,
          mnw_cm = excluded.mnw_cm,
          mw_cm = excluded.mw_cm,
          marke_i_cm = excluded.marke_i_cm,
          marke_ii_cm = excluded.marke_ii_cm,
          inspection_trigger_cm = excluded.inspection_trigger_cm,
          source = excluded.source,
          source_description = excluded.source_description,
          formula_version = excluded.formula_version,
          updated_at = excluded.updated_at
      `);
    }

    for (const entry of hydrologyFloodEventFixture) {
      await transaction.execute(sql`
        insert into hydrological_flood_events (
          id, bridge_id, event_year, peaked_on, peak_water_level_cm,
          station_uuid, station_name, water_name, mhw_cm, hsw_cm, hhw_cm,
          marke_i_cm, marke_ii_cm, source, source_description, created_at, updated_at
        )
        select
          ${entry.id}::uuid,
          b.id,
          ${entry.eventYear},
          ${entry.peakedOn}::date,
          ${entry.peakWaterLevelCm},
          ${entry.stationUuid}::uuid,
          ${entry.stationName},
          ${entry.waterName},
          ${entry.mhwCm},
          ${entry.hswCm},
          ${entry.hhwCm},
          ${entry.markeICm},
          ${entry.markeIICm},
          ${entry.source}::hydrological_metric_source,
          ${entry.sourceDescription},
          ${hydrologyFixtureTimestamp},
          ${hydrologyFixtureTimestamp}
        from bridges b
        where b.external_structure_number = ${entry.externalStructureNumber}
        on conflict (id) do update set
          bridge_id = excluded.bridge_id,
          event_year = excluded.event_year,
          peaked_on = excluded.peaked_on,
          peak_water_level_cm = excluded.peak_water_level_cm,
          station_uuid = excluded.station_uuid,
          station_name = excluded.station_name,
          water_name = excluded.water_name,
          mhw_cm = excluded.mhw_cm,
          hsw_cm = excluded.hsw_cm,
          hhw_cm = excluded.hhw_cm,
          marke_i_cm = excluded.marke_i_cm,
          marke_ii_cm = excluded.marke_ii_cm,
          source = excluded.source,
          source_description = excluded.source_description,
          updated_at = excluded.updated_at
      `);
    }
  });
}
