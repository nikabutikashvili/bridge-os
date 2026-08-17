import { sql } from "drizzle-orm";

import type { BridgeDatabase } from "../../connection.js";
import {
  networkFixture,
  networkFixtureTimestamp,
  networkFormulaVersion
} from "./data.js";

/**
 * Attaches a seeded closure-impact snapshot to whichever demo bridges are
 * already present, matched by external structure number. Also fills missing
 * coordinates. Bridges that have not been extracted yet are skipped.
 */
export async function seedNetworkFixture(database: BridgeDatabase): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const entry of networkFixture) {
      await transaction.execute(sql`
        update bridges
        set latitude = ${entry.latitude}, longitude = ${entry.longitude}
        where external_structure_number = ${entry.externalStructureNumber}
          and latitude is null
          and longitude is null
      `);

      await transaction.execute(sql`
        insert into network_metrics (
          id, bridge_id, observation_year, latitude, longitude,
          carried_road, road_class, traffic_applies_to,
          normal_trip_km, closure_detour_km, additional_distance_km,
          alternative_crossing_count, on_strategic_network,
          source, source_description, formula_version, created_at, updated_at
        )
        select
          ${entry.id}::uuid,
          b.id,
          ${entry.observationYear},
          ${entry.latitude},
          ${entry.longitude},
          ${entry.carriedRoad},
          ${entry.roadClass}::network_road_class,
          ${entry.trafficAppliesTo}::network_traffic_applies_to,
          ${entry.normalTripKm},
          ${entry.closureDetourKm},
          ${entry.additionalDistanceKm},
          ${entry.alternativeCrossingCount},
          ${entry.onStrategicNetwork},
          'OSM_ROUTED'::network_metric_source,
          ${entry.sourceDescription},
          ${networkFormulaVersion},
          ${networkFixtureTimestamp},
          ${networkFixtureTimestamp}
        from bridges b
        where b.external_structure_number = ${entry.externalStructureNumber}
        on conflict (id) do update set
          bridge_id = excluded.bridge_id,
          observation_year = excluded.observation_year,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          carried_road = excluded.carried_road,
          road_class = excluded.road_class,
          traffic_applies_to = excluded.traffic_applies_to,
          normal_trip_km = excluded.normal_trip_km,
          closure_detour_km = excluded.closure_detour_km,
          additional_distance_km = excluded.additional_distance_km,
          alternative_crossing_count = excluded.alternative_crossing_count,
          on_strategic_network = excluded.on_strategic_network,
          source = excluded.source,
          source_description = excluded.source_description,
          formula_version = excluded.formula_version,
          updated_at = excluded.updated_at
      `);
    }
  });
}
