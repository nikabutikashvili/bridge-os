import {
  createDatabaseConnection,
  type DatabaseConnection
} from "@bridge-os/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresGlobalSearchReader } from "../src/features/search/postgres-search-reader.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;
const bridgeId = "44058840-0000-4000-8000-000000000001";

describeDatabase("PostgresGlobalSearchReader", () => {
  let connection: DatabaseConnection;
  let reader: PostgresGlobalSearchReader;

  beforeAll(() => {
    connection = createDatabaseConnection({ DATABASE_URL: databaseUrl });
    reader = new PostgresGlobalSearchReader(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  it("finds bridges by identifier, name, road, and location", async () => {
    for (const query of ["9999999", "Musterbrücke Fiktivtal", "A57", "Millingen"]) {
      const result = await reader.search({ limit: 5, q: query });
      expect(result.groups.bridges.items[0]?.id, query).toBe(bridgeId);
      expect(result.groups.bridges.totalItems, query).toBeGreaterThanOrEqual(1);
    }
  });

  it("finds findings and recommendations through their workflow text", async () => {
    const findingResult = await reader.search({
      limit: 5,
      q: "freiliegende Bewehrung"
    });
    const recommendationResult = await reader.search({
      limit: 5,
      q: "FAHRBAHNFUGENINSTANDSETZUNG"
    });

    expect(findingResult.groups.findings.items[0]).toMatchObject({
      bridge: { id: bridgeId },
      defectType: "Betonabplatzung / freiliegende Bewehrung"
    });
    expect(recommendationResult.groups.recommendations.items[0]).toMatchObject({
      bridge: { id: bridgeId },
      workType: "FAHRBAHNFUGENINSTANDSETZUNG"
    });
  });

  it("limits each group while preserving its full match count", async () => {
    const result = await reader.search({ limit: 1, q: "instand" });

    expect(result.groups.recommendations.items).toHaveLength(1);
    expect(result.groups.recommendations.totalItems).toBeGreaterThan(1);
  });
});
