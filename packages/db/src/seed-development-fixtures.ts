import type { BridgeDatabase } from "./connection.js";
import { bastTrafficFixture, seedBastTrafficFixture } from "./fixtures/bast-traffic/index.js";
import {
  heideckhofwegFixtureSummary,
  seedHeideckhofwegFixture
} from "./fixtures/heideckhofweg/index.js";

export async function seedDevelopmentFixtures(database: BridgeDatabase): Promise<void> {
  await seedHeideckhofwegFixture(database);
  await seedBastTrafficFixture(database);
}

export const developmentFixtureSummary = {
  heideckhofweg: heideckhofwegFixtureSummary,
  bastTraffic: { trafficObservations: bastTrafficFixture.length }
} as const;
