import {
  createDatabaseConnection,
  type DatabaseConnection
} from "@bridge-os/db";
import type {
  BridgeDataHealth,
  BridgeDataHealthIndicator
} from "@bridge-os/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresDocumentOverviewReader } from "../src/features/documents/postgres-document-overview-reader.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;
const bridgeId = "44058840-0000-4000-8000-000000000001";

describeDatabase("PostgresDocumentOverviewReader", () => {
  let connection: DatabaseConnection;
  let reader: PostgresDocumentOverviewReader;

  beforeAll(() => {
    connection = createDatabaseConnection({ DATABASE_URL: databaseUrl });
    reader = new PostgresDocumentOverviewReader(
      connection.db,
      () => new Date("2026-08-15T12:00:00.000Z")
    );
  });

  afterAll(async () => {
    await connection.close();
  });

  it("joins the demo document inventory to its bridge without inventing extraction", async () => {
    const overview = await reader.listOverview();
    const demoDocuments = overview.documents.filter((document) => document.isDemoFixture);

    expect(demoDocuments).toHaveLength(2);
    const structureBook = demoDocuments.find(
      (document) =>
        document.originalFilename === "DEMO_Bauwerksbuch_9999999.pdf"
    );
    const inspectionReport = demoDocuments.find(
      (document) =>
        document.originalFilename === "DEMO_Hauptpruefung_9999999_2023.pdf"
    );
    expect(structureBook?.bridge).toMatchObject({ id: bridgeId, road: "A57" });
    expect(structureBook?.processing).toBeNull();
    expect(structureBook?.extraction.status).toBe("NOT_STARTED");
    expect(inspectionReport?.extraction.status).toBe("NOT_STARTED");
  });

  it("returns explicit deterministic quality flags for Musterbrücke Fiktivtal", async () => {
    const overview = await reader.listOverview();
    const health = overview.bridgeDataHealth.find(
      (item) => item.bridge.id === bridgeId
    );
    expect(health).toBeDefined();
    if (health === undefined) return;

    expect(indicator(health, "LATEST_INSPECTION")).toMatchObject({
      status: "AVAILABLE",
      detail: "Latest MAIN inspection is dated 2023-05-23."
    });
    expect(indicator(health, "TRAFFIC_CURRENCY")).toMatchObject({
      status: "STALE",
      count: 11
    });
    expect(indicator(health, "GEOMETRY_COMPLETENESS").status).toBe("COMPLETE");
    expect(indicator(health, "RECOMMENDATION_QUANTITIES").count).toBe(0);
    expect(indicator(health, "RECOMMENDATION_COST_ESTIMATES")).toMatchObject({
      status: "MISSING",
      count: 1
    });
    expect(indicator(health, "LOAD_RECALCULATION_DOCUMENT").status).toBe(
      "MISSING"
    );
    expect(health.attentionCount).toBe(3);
  });
});

function indicator(
  health: BridgeDataHealth,
  code: BridgeDataHealthIndicator["code"]
): BridgeDataHealthIndicator {
  const result = health.indicators.find((item) => item.code === code);
  if (result === undefined) throw new Error(`Missing indicator ${code}`);
  return result;
}
