import { describe, expect, it } from "vitest";

import { deriveBridgeAttention } from "../src/features/bridges/attention.js";

const currentBridge = {
  conditionScore: "1.8",
  conditionTrend: "STABLE" as const,
  highestRecommendationUrgencyRank: 0,
  inspectionStatus: "CURRENT" as const,
  maximumDurability: 0,
  maximumStability: 0,
  maximumTrafficSafety: 0,
  openFindings: 0,
  openRecommendations: 0,
  hasEnvironmentalExposure: false,
  hasHighNetworkConsequence: false,
  hasFloodExposure: false,
  hasOpenScourFinding: false
};

describe("deriveBridgeAttention", () => {
  it("treats overdue inspections and severe safety findings as critical", () => {
    expect(
      deriveBridgeAttention({
        ...currentBridge,
        inspectionStatus: "OVERDUE",
        maximumTrafficSafety: 3
      })
    ).toEqual({
      level: "CRITICAL",
      reasons: ["OVERDUE_INSPECTION", "TRAFFIC_SAFETY_FINDING"]
    });
  });

  it("makes a notable traffic-safety finding high attention", () => {
    expect(
      deriveBridgeAttention({ ...currentBridge, maximumTrafficSafety: 2 })
    ).toEqual({
      level: "HIGH",
      reasons: ["TRAFFIC_SAFETY_FINDING"]
    });
  });

  it("explains medium attention from deterioration and planned work", () => {
    expect(
      deriveBridgeAttention({
        ...currentBridge,
        conditionTrend: "DETERIORATING",
        highestRecommendationUrgencyRank: 2,
        maximumDurability: 2,
        openRecommendations: 1
      })
    ).toEqual({
      level: "MEDIUM",
      reasons: [
        "DURABILITY_FINDING",
        "DETERIORATING_CONDITION",
        "MEDIUM_OR_HIGHER_RECOMMENDATION"
      ]
    });
  });

  it("calls out missing inspection data without inventing a condition", () => {
    expect(
      deriveBridgeAttention({
        ...currentBridge,
        conditionScore: null,
        inspectionStatus: "UNKNOWN"
      })
    ).toEqual({ level: "MEDIUM", reasons: ["MISSING_CRITICAL_DATA"] });
  });

  it("adds climate exposure beside durability when both are present", () => {
    expect(
      deriveBridgeAttention({
        ...currentBridge,
        hasEnvironmentalExposure: true,
        maximumDurability: 2
      })
    ).toEqual({
      level: "MEDIUM",
      reasons: ["DURABILITY_FINDING", "ENVIRONMENTAL_EXPOSURE"]
    });
  });

  it("raises a damaged high-consequence structure to high without inventing critical", () => {
    expect(
      deriveBridgeAttention({
        ...currentBridge,
        conditionScore: "3.0",
        hasHighNetworkConsequence: true
      })
    ).toEqual({
      level: "HIGH",
      reasons: ["NETWORK_CRITICALITY"]
    });
    expect(
      deriveBridgeAttention({
        ...currentBridge,
        hasHighNetworkConsequence: true,
        maximumStability: 3
      }).level
    ).toBe("CRITICAL");
  });

  it("adds a post-flood inspection watch without inventing critical", () => {
    expect(
      deriveBridgeAttention({
        ...currentBridge,
        hasFloodExposure: true
      })
    ).toEqual({
      level: "MEDIUM",
      reasons: ["FLOOD_EXPOSURE"]
    });
    expect(
      deriveBridgeAttention({
        ...currentBridge,
        hasFloodExposure: true,
        hasOpenScourFinding: true
      }).level
    ).toBe("HIGH");
  });

  it("keeps a healthy high-volume structure routine", () => {
    expect(deriveBridgeAttention(currentBridge)).toEqual({
      level: "ROUTINE",
      reasons: []
    });
  });
});
