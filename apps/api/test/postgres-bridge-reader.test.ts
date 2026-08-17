import { bridgePortfolioQuerySchema } from "@bridge-os/contracts";
import {
  createDatabaseConnection,
  type DatabaseConnection
} from "@bridge-os/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresBridgePortfolioReader } from "../src/features/bridges/postgres-bridge-reader.js";

const bridgeId = "44058840-0000-4000-8000-000000000001";
const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;

describeDatabase("PostgresBridgePortfolioReader", () => {
  let connection: DatabaseConnection;
  let reader: PostgresBridgePortfolioReader;

  beforeAll(() => {
    connection = createDatabaseConnection({ DATABASE_URL: databaseUrl });
    reader = new PostgresBridgePortfolioReader(
      connection.db,
      () => new Date("2026-08-14T12:00:00.000Z")
    );
  });

  afterAll(async () => {
    await connection.close();
  });

  it("combines portfolio filters without duplicating bridge summaries", async () => {
    const response = await reader.listBridges(
      bridgePortfolioQuerySchema.parse({
        conditionMax: 1.8,
        conditionMin: 1.8,
        constructionYearFrom: 1980,
        constructionYearTo: 1990,
        findingStatus: "OPEN",
        hasOpenFinding: true,
        inspectionStatus: "CURRENT",
        recommendationUrgency: "mittelfristig",
        road: "57",
        sort: "condition"
      })
    );

    expect(response.pagination).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1
    });
    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      attention: { openFindings: 6, openRecommendations: 5 },
      condition: {
        assessedOn: "2023-05-23",
        delta: "0.1",
        inspectionType: "MAIN",
        previousScore: "1.7",
        trend: "DETERIORATING",
        score: "1.8"
      },
      externalStructureNumber: "9999999",
      id: bridgeId,
      inspection: {
        latestInspectionOn: "2023-05-23",
        nextDueOn: "2029-05-23",
        status: "CURRENT"
      },
      name: "Musterbrücke Fiktivtal",
      road: "A57"
    });
    expect(response.summary).toEqual({
      inspectionsDueOrOverdue: 0,
      structures: 1,
      withNotableFindings: 1,
      withOpenRecommendations: 1
    });
    expect(response.data[0]?.attention).toMatchObject({
      highestRecommendationUrgency: "MITTELFRISTIG",
      level: "HIGH",
      nextRecommendation: {
        id: "44058840-0000-4000-8000-000000000403",
        plannedYear: null
      },
      reasons: [
        "TRAFFIC_SAFETY_FINDING",
        "DURABILITY_FINDING",
        "ENVIRONMENTAL_EXPOSURE",
        "DETERIORATING_CONDITION",
        "MEDIUM_OR_HIGHER_RECOMMENDATION"
      ]
    });
  });

  it("returns no rows when an existential workflow filter does not match", async () => {
    const response = await reader.listBridges(
      bridgePortfolioQuerySchema.parse({
        recommendationUrgency: "SOFORT",
        road: "A57"
      })
    );

    expect(response.data).toEqual([]);
    expect(response.pagination.totalItems).toBe(0);
  });

  it("projects overview, chronology, documents, and field evidence", async () => {
    const [detail, inspections, findings, recommendations, history, documents] =
      await Promise.all([
        reader.getBridge(bridgeId),
        reader.getInspections(bridgeId),
        reader.getFindings(bridgeId),
        reader.getRecommendations(bridgeId),
        reader.getHistory(bridgeId),
        reader.getDocuments(bridgeId)
      ]);

    expect(detail?.data.partialStructures[0]).toMatchObject({
      constructionYear: 1983,
      geometry: {
        areaSqM: "117.000",
        lengthM: "7.230",
        spanCount: 1,
        widthM: "14.750"
      }
    });
    expect(detail?.data.latestTraffic).toMatchObject({
      dailyTraffic: 41_878,
      observationYear: 2015,
      truckSharePercent: "9.00"
    });
    expect(detail?.data.environment).toMatchObject({
      observationYear: 2025,
      source: "OPEN_METEO",
      policyVersion: "damage-mechanism-v1"
    });
    expect(detail?.data.environment?.mechanisms.map((mechanism) => mechanism.kind)).toEqual([
      "RC_CORROSION",
      "STEEL_CORROSION",
      "WATER_INGRESS",
      "SCOUR"
    ]);
    expect(
      Object.fromEntries(
        (detail?.data.environment?.mechanisms ?? []).map((mechanism) => [
          mechanism.kind,
          mechanism.band
        ])
      )
    ).toEqual({
      RC_CORROSION: "HIGH",
      STEEL_CORROSION: "HIGH",
      WATER_INGRESS: "HIGH",
      SCOUR: "LOW"
    });
    expect(detail?.data.attention).toMatchObject({
      level: "HIGH",
      maximumRatings: {
        durability: 3,
        stability: 1,
        trafficSafety: 2
      }
    });
    expect(detail?.data.technicalData.components).toHaveLength(7);
    expect(detail?.data.technicalData.components).toContainEqual(
      expect.objectContaining({
        material: "Stahlbeton",
        name: "Überbau",
        type: "UEBERBAU"
      })
    );
    expect(detail?.data.evidence.length).toBeGreaterThan(0);
    expect(detail?.data.partialStructures[0]?.evidence.length).toBeGreaterThan(0);
    expect(inspections?.data.every((inspection) => inspection.evidence.length > 0)).toBe(
      true
    );
    expect(findings?.data).toHaveLength(6);
    expect(findings?.data.some((finding) => finding.evidence.length > 0)).toBe(
      true
    );
    const pavementFinding = findings?.data.find(
      (finding) => finding.sourceIdentifier === "DEMO-S-2023-004"
    );
    expect(pavementFinding?.linkedRecommendations).toEqual([
      expect.objectContaining({
        id: "44058840-0000-4000-8000-000000000403",
        plannedYear: null,
        status: "APPROVED"
      })
    ]);
    expect(pavementFinding?.evidence).toHaveLength(7);
    expect(
      pavementFinding?.evidence.every(
        (citation) =>
          citation.documentId === "44058840-0000-4000-8000-000000000902" &&
          citation.pageNumber === 9 &&
          citation.kind === "SOURCE_FACT" &&
          citation.viewSourceUrl === null
      )
    ).toBe(true);
    expect(new Set(pavementFinding?.evidence.map((citation) => citation.fieldName))).toEqual(
      new Set([
        "description",
        "durabilityRating",
        "quantity",
        "quantityUnit",
        "sourceIdentifier",
        "stabilityRating",
        "trafficSafetyRating"
      ])
    );
    const findingDetail = await reader.getFinding(
      bridgeId,
      "44058840-0000-4000-8000-000000000304"
    );
    expect(findingDetail?.data).toEqual(pavementFinding);
    expect(recommendations?.data).toHaveLength(5);
    expect(
      recommendations?.data.some(
        (recommendation) =>
          recommendation.quantity?.value === "30.000" &&
          recommendation.quantity.unit === "m"
      )
    ).toBe(true);
    expect(history?.data.some((event) => event.kind === "HISTORICAL_WORK")).toBe(
      true
    );
    expect(history?.data.every((event) => event.evidence.length > 0)).toBe(true);
    expect(documents?.data.every((document) => document.isDemoFixture)).toBe(
      true
    );
  });
});
