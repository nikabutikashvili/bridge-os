import { sql } from "drizzle-orm";

import type { BridgeDatabase } from "../../connection.js";
import { bastTrafficFixture, bastTrafficFixtureTimestamp } from "./data.js";

/**
 * Enriches whichever demo bridges are already present (matched by their stable
 * external structure number, not their database id, since that id is only
 * assigned once a bridge has actually been extracted from its PDF) with a
 * BASt-sourced traffic observation and, where the bridge has no coordinates
 * yet, a geocoded lat/lon. Bridges that have not been extracted yet are
 * silently skipped so this stays safe to run on any environment.
 */
export async function seedBastTrafficFixture(database: BridgeDatabase): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const entry of bastTrafficFixture) {
      if (entry.latitude !== null && entry.longitude !== null) {
        await transaction.execute(sql`
          update bridges
          set latitude = ${entry.latitude}, longitude = ${entry.longitude}
          where external_structure_number = ${entry.externalStructureNumber}
            and latitude is null
            and longitude is null
        `);
      }

      await transaction.execute(sql`
        insert into traffic_observations (
          id, bridge_id, observation_year, observed_on, daily_traffic,
          heavy_vehicle_daily, truck_share_percent, source, source_description,
          created_at, updated_at
        )
        select
          ${entry.id}::uuid,
          b.id,
          ${entry.observationYear},
          null,
          ${entry.dailyTraffic},
          ${entry.heavyVehicleDaily},
          ${entry.truckSharePercent},
          'EXTERNAL_ENRICHED'::traffic_observation_source,
          ${entry.sourceDescription},
          ${bastTrafficFixtureTimestamp},
          ${bastTrafficFixtureTimestamp}
        from bridges b
        where b.external_structure_number = ${entry.externalStructureNumber}
        on conflict (id) do update set
          bridge_id = excluded.bridge_id,
          observation_year = excluded.observation_year,
          daily_traffic = excluded.daily_traffic,
          heavy_vehicle_daily = excluded.heavy_vehicle_daily,
          truck_share_percent = excluded.truck_share_percent,
          source = excluded.source,
          source_description = excluded.source_description,
          updated_at = excluded.updated_at
      `);
    }
  });
}
