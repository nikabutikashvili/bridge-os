import type {
  BridgeHistoryResponse,
  BridgeInspectionsResponse,
  BridgeRecommendationsResponse
} from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

import {
  buildConditionSeries,
  currentRecommendations,
  parseBridgeDetailTab,
  relevantTimelineEvents
} from "./detail-model";

describe("bridge detail view model", () => {
  it("sorts condition observations and preserves missing values as gaps", () => {
    const inspections = [
      inspection("new", "2023-05-23", "1.8"),
      inspection("missing", null, null),
      inspection("old", "2017-05-18", "2.0")
    ];

    expect(buildConditionSeries(inspections)).toEqual([
      { date: "2017-05-18", id: "old", inspectionType: "MAIN", score: 2 },
      { date: "2023-05-23", id: "new", inspectionType: "MAIN", score: 1.8 }
    ]);
  });

  it("keeps only unresolved recommendation states", () => {
    const recommendations = [
      recommendation("OPEN"),
      recommendation("COMPLETED"),
      recommendation(null)
    ];

    expect(currentRecommendations(recommendations)).toHaveLength(1);
  });

  it("keeps inspections and works in the unified asset timeline", () => {
    const history = [
      { kind: "INSPECTION" },
      { kind: "TRAFFIC_OBSERVATION" },
      { kind: "HISTORICAL_WORK" }
    ] as BridgeHistoryResponse["data"];

    expect(relevantTimelineEvents(history).map((event) => event.kind)).toEqual([
      "INSPECTION",
      "HISTORICAL_WORK"
    ]);
  });

  it("falls back to overview for unknown or repeated tab values", () => {
    expect(parseBridgeDetailTab("findings")).toBe("findings");
    expect(parseBridgeDetailTab("unknown")).toBe("overview");
    expect(parseBridgeDetailTab(["technical", "findings"])).toBe("technical");
  });
});

function inspection(
  id: string,
  inspectedOn: string | null,
  conditionScore: string | null
): BridgeInspectionsResponse["data"][number] {
  return {
    conditionScore,
    cycleMonths: null,
    evidence: [],
    id,
    inspectedOn,
    inspector: null,
    nextDueOn: null,
    partialStructure: {
      externalNumber: null,
      id: "10000000-0000-4000-8000-000000000000",
      name: null
    },
    type: "MAIN"
  };
}

function recommendation(
  status: BridgeRecommendationsResponse["data"][number]["status"]
): BridgeRecommendationsResponse["data"][number] {
  return {
    description: null,
    evidence: [],
    id: "20000000-0000-4000-8000-000000000000",
    linkedFindings: [],
    partialStructure: {
      externalNumber: null,
      id: "10000000-0000-4000-8000-000000000000",
      name: null
    },
    plannedYear: null,
    quantity: null,
    sourceEstimatedCost: null,
    sourceDate: null,
    inflationAdjustedEstimate: null,
    status,
    targetYear: null,
    urgency: null,
    workType: null
  };
}
