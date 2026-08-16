import { describe, expect, it } from "vitest";

import {
  deriveBridgeDataHealth,
  isAttentionIndicator,
  isLoadRecalculationDocument,
  TRAFFIC_STALE_AFTER_YEARS,
  type DataHealthPolicyInput
} from "../src/features/documents/data-health.js";

describe("document data health policy", () => {
  it("reports stale traffic in years without calculating a universal score", () => {
    const indicators = deriveBridgeDataHealth(input());
    const traffic = requireIndicator(indicators, "TRAFFIC_CURRENCY");

    expect(TRAFFIC_STALE_AFTER_YEARS).toBe(5);
    expect(traffic).toMatchObject({
      status: "STALE",
      count: 11,
      detail: "Traffic data is 11 years old (2015)."
    });
    expect(indicators).toHaveLength(9);
    expect(indicators.every((indicator) => !("score" in indicator))).toBe(true);
  });

  it("defines complete core geometry using four recorded fields", () => {
    const complete = deriveBridgeDataHealth(input());
    expect(requireIndicator(complete, "GEOMETRY_COMPLETENESS").status).toBe(
      "COMPLETE"
    );

    const missing = deriveBridgeDataHealth({
      ...input(),
      partialStructures: [
        { areaSqM: null, lengthM: "7.230", spanCount: 1, widthM: "14.750" }
      ]
    });
    expect(requireIndicator(missing, "GEOMETRY_COMPLETENESS")).toMatchObject({
      status: "MISSING",
      count: 1
    });
  });

  it("keeps recommendation quantity and estimate gaps explicit", () => {
    const indicators = deriveBridgeDataHealth({
      ...input(),
      recommendationsWithoutQuantity: 2,
      recommendationsWithoutCostEstimate: 1
    });
    expect(requireIndicator(indicators, "RECOMMENDATION_QUANTITIES")).toMatchObject({
      status: "MISSING",
      count: 2
    });
    expect(
      requireIndicator(indicators, "RECOMMENDATION_COST_ESTIMATES")
    ).toMatchObject({ status: "MISSING", count: 1 });
  });

  it("separates review backlog from critical source-evidence gaps", () => {
    const indicators = deriveBridgeDataHealth({
      ...input(),
      extractedFindingsRequiringReview: 2,
      criticalExtractedFindingsWithoutEvidence: 1
    });
    expect(requireIndicator(indicators, "EXTRACTED_FINDING_REVIEW").status).toBe(
      "REVIEW_REQUIRED"
    );
    expect(requireIndicator(indicators, "CRITICAL_SOURCE_EVIDENCE").status).toBe(
      "ERROR"
    );
  });

  it("recognizes load recalculation records through deterministic terms", () => {
    expect(
      isLoadRecalculationDocument(
        "NACHRECHNUNG",
        "Nachrechnung_Bauwerk_4405884.pdf"
      )
    ).toBe(true);
    expect(
      isLoadRecalculationDocument("DEMO_BAUWERKSBUCH", "Bauwerksbuch.pdf")
    ).toBe(false);
  });

  it("counts only non-positive indicators as needing attention", () => {
    const indicators = deriveBridgeDataHealth(input());
    expect(indicators.filter(isAttentionIndicator).map((item) => item.code)).toEqual([
      "TRAFFIC_CURRENCY",
      "LOAD_RECALCULATION_DOCUMENT"
    ]);
  });
});

function input(): DataHealthPolicyInput {
  return {
    asOf: new Date("2026-08-15T12:00:00.000Z"),
    latestInspection: { inspectedOn: "2023-05-23", type: "MAIN" },
    latestTrafficObservationYear: 2015,
    partialStructures: [
      {
        areaSqM: "117.000",
        lengthM: "7.230",
        spanCount: 1,
        widthM: "14.750"
      }
    ],
    unresolvedExtractionErrors: 0,
    recommendationsWithoutQuantity: 0,
    recommendationsWithoutCostEstimate: 0,
    extractedFindingsRequiringReview: 0,
    criticalExtractedFindingsWithoutEvidence: 0,
    hasLoadRecalculationDocument: false
  };
}

function requireIndicator(
  indicators: ReturnType<typeof deriveBridgeDataHealth>,
  code: ReturnType<typeof deriveBridgeDataHealth>[number]["code"]
): ReturnType<typeof deriveBridgeDataHealth>[number] {
  const indicator = indicators.find((item) => item.code === code);
  if (indicator === undefined) throw new Error(`Missing indicator ${code}`);
  return indicator;
}
