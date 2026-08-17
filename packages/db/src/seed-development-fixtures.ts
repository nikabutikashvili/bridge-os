import type { BridgeDatabase } from "./connection.js";
import { bastTrafficFixture, seedBastTrafficFixture } from "./fixtures/bast-traffic/index.js";
import {
  heideckhofwegFixtureSummary,
  seedHeideckhofwegFixture
} from "./fixtures/heideckhofweg/index.js";
import { networkFixture, seedNetworkFixture } from "./fixtures/network/index.js";
import { seedWeatherFixture, weatherFixture } from "./fixtures/weather/index.js";

export async function seedDevelopmentFixtures(database: BridgeDatabase): Promise<void> {
  await seedHeideckhofwegFixture(database);
  await seedBastTrafficFixture(database);
  await seedWeatherFixture(database);
  await seedNetworkFixture(database);
}

export const developmentFixtureSummary = {
  heideckhofweg: heideckhofwegFixtureSummary,
  bastTraffic: { trafficObservations: bastTrafficFixture.length },
  weather: { environmentalMetrics: weatherFixture.length },
  network: { networkMetrics: networkFixture.length }
} as const;
