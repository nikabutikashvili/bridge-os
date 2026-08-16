import type { BridgeDatabase } from "./connection.js";
import {
  heideckhofwegFixtureSummary,
  seedHeideckhofwegFixture
} from "./fixtures/heideckhofweg/index.js";

export async function seedDevelopmentFixtures(database: BridgeDatabase): Promise<void> {
  await seedHeideckhofwegFixture(database);
}

export const developmentFixtureSummary = {
  heideckhofweg: heideckhofwegFixtureSummary
} as const;
