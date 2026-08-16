import { describe, expect, it } from "vitest";

import {
  bridgePortfolioQuerySchema,
  bridgePortfolioResponseSchema
} from "../src/index.js";

const bridgeId = "44058840-0000-4000-8000-000000000001";

describe("bridge portfolio API contracts", () => {
  it("coerces query strings and applies bounded pagination defaults", () => {
    expect(
      bridgePortfolioQuerySchema.parse({
        conditionMax: "2.5",
        conditionMin: "1.5",
        page: "2",
        pageSize: "10"
      })
    ).toEqual({
      conditionMax: 2.5,
      conditionMin: 1.5,
      direction: "desc",
      page: 2,
      pageSize: 10,
      sort: "attention"
    });

    expect(
      bridgePortfolioQuerySchema.safeParse({ pageSize: "101" }).success
    ).toBe(false);
  });

  it("rejects an inverted condition range and unknown filters", () => {
    expect(
      bridgePortfolioQuerySchema.safeParse({
        conditionMax: "1.8",
        conditionMin: "2.3"
      }).success
    ).toBe(false);
    expect(
      bridgePortfolioQuerySchema.safeParse({ owner: "Bund" }).success
    ).toBe(false);
    expect(
      bridgePortfolioQuerySchema.safeParse({
        constructionYearFrom: "2000",
        constructionYearTo: "1980"
      }).success
    ).toBe(false);
  });

  it("coerces monitoring filters from URL query strings", () => {
    expect(
      bridgePortfolioQuerySchema.parse({
        constructionYearFrom: "1980",
        hasOpenFinding: "true"
      })
    ).toMatchObject({ constructionYearFrom: 1980, hasOpenFinding: true });
  });

  it("keeps portfolio summaries strict and intentionally scoped", () => {
    const response = {
      asOf: "2026-08-14",
      data: [
        {
          attention: {
            highestRecommendationUrgency: "MITTELFRISTIG",
            level: "HIGH",
            maximumRatings: {
              durability: 3,
              stability: 1,
              trafficSafety: 2
            },
            nextRecommendation: {
              description:
                "Schadhafte Fahrbahnanschlüsse an beiden Brückenenden aufnehmen und erneuern.",
              id: "44058840-0000-4000-8000-000000000403",
              plannedYear: 2026,
              targetYear: 2026,
              urgency: "MITTELFRISTIG"
            },
            openFindings: 6,
            openRecommendations: 5,
            reasons: [
              "TRAFFIC_SAFETY_FINDING",
              "DURABILITY_FINDING",
              "DETERIORATING_CONDITION",
              "MEDIUM_OR_HIGHER_RECOMMENDATION"
            ]
          },
          condition: {
            assessedOn: "2023-05-23",
            delta: "0.1",
            inspectionType: "MAIN",
            previousScore: "1.7",
            trend: "DETERIORATING",
            score: "1.8"
          },
          dataOrigin: "DEMO_FIXTURE",
          externalStructureNumber: "4405884",
          id: bridgeId,
          inspection: {
            latestInspectionOn: "2023-05-23",
            nextDueOn: "2029-05-23",
            status: "CURRENT"
          },
          location: { locality: "Millingen", municipality: "Rheinberg" },
          name: "Heideckhofweg",
          photoUrl: `/api/v1/bridges/${bridgeId}/photo`,
          road: "A57",
          structure: {
            constructionYear: 1983,
            partialStructureCount: 1,
            structureType: "Straßenbrücke"
          },
          traffic: null
        }
      ],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      sort: { direction: "desc", field: "attention" },
      summary: {
        inspectionsDueOrOverdue: 0,
        structures: 1,
        withNotableFindings: 1,
        withOpenRecommendations: 1
      }
    };

    expect(bridgePortfolioResponseSchema.safeParse(response).success).toBe(true);
    expect(
      bridgePortfolioResponseSchema.safeParse({
        ...response,
        data: [{ ...response.data[0], internalMetadata: "not public" }]
      }).success
    ).toBe(false);
  });
});
