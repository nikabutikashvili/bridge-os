import { describe, expect, it } from "vitest";

import {
  deriveMaintenancePriority,
  type MaintenancePriorityInput
} from "../src/features/planning/prioritization.js";

const baseline: MaintenancePriorityInput = {
  asOf: "2026-08-15",
  conditionDelta: null,
  dailyTraffic: null,
  inspectionStatus: "CURRENT",
  maximumDurability: null,
  maximumStability: null,
  maximumTrafficSafety: null,
  recommendationSourceDate: null,
  urgency: null
};

describe("deriveMaintenancePriority", () => {
  it("returns low priority without inventing reasons for missing inputs", () => {
    expect(deriveMaintenancePriority(baseline)).toEqual({
      level: "LOW",
      policyVersion: "maintenance-priority-v1",
      reasons: []
    });
  });

  it.each([
    ["maximumStability", 2, "HIGH", "STABILITY_RATING"],
    ["maximumStability", 3, "CRITICAL", "STABILITY_RATING"],
    ["maximumTrafficSafety", 2, "HIGH", "TRAFFIC_SAFETY_RATING"],
    ["maximumTrafficSafety", 4, "CRITICAL", "TRAFFIC_SAFETY_RATING"],
    ["maximumDurability", 2, "MEDIUM", "DURABILITY_RATING"],
    ["maximumDurability", 3, "HIGH", "DURABILITY_RATING"]
  ] as const)(
    "maps %s rating %s to %s",
    (field, rating, expectedLevel, expectedCode) => {
      const result = deriveMaintenancePriority({
        ...baseline,
        [field]: rating
      });

      expect(result.level).toBe(expectedLevel);
      expect(result.reasons[0]?.code).toBe(expectedCode);
    }
  );

  it.each([
    ["SOFORT", "CRITICAL", "IMMEDIATE_URGENCY"],
    ["unverzüglich", "CRITICAL", "IMMEDIATE_URGENCY"],
    ["KURZFRISTIG", "HIGH", "SHORT_TERM_URGENCY"],
    ["MITTELFRISTIG", "MEDIUM", "MEDIUM_TERM_URGENCY"]
  ] as const)("understands source urgency %s", (urgency, level, code) => {
    const result = deriveMaintenancePriority({ ...baseline, urgency });

    expect(result.level).toBe(level);
    expect(result.reasons[0]?.code).toBe(code);
    expect(result.reasons[0]?.detail).toContain(urgency);
  });

  it("uses the linked inspection date for unresolved age", () => {
    const recent = deriveMaintenancePriority({
      ...baseline,
      recommendationSourceDate: "2024-08-16"
    });
    const medium = deriveMaintenancePriority({
      ...baseline,
      recommendationSourceDate: "2024-08-15"
    });
    const high = deriveMaintenancePriority({
      ...baseline,
      recommendationSourceDate: "2021-08-15"
    });

    expect(recent.reasons).toEqual([]);
    expect(medium.reasons[0]).toMatchObject({
      code: "LONG_UNRESOLVED",
      severity: "MEDIUM"
    });
    expect(high.reasons[0]).toMatchObject({
      code: "LONG_UNRESOLVED",
      severity: "HIGH"
    });
  });

  it.each([
    ["OVERDUE", "CRITICAL", "INSPECTION_OVERDUE"],
    ["DUE_SOON", "MEDIUM", "INSPECTION_DUE_SOON"],
    ["CURRENT", "LOW", undefined],
    ["UNKNOWN", "LOW", undefined]
  ] as const)("handles %s inspection status", (status, level, code) => {
    const result = deriveMaintenancePriority({
      ...baseline,
      inspectionStatus: status
    });

    expect(result.level).toBe(level);
    expect(result.reasons[0]?.code).toBe(code);
  });

  it("flags a meaningful worsening because lower condition scores are better", () => {
    expect(
      deriveMaintenancePriority({ ...baseline, conditionDelta: "0.1" }).reasons[0]
    ).toMatchObject({
      code: "CONDITION_DETERIORATING",
      severity: "HIGH"
    });
    expect(
      deriveMaintenancePriority({ ...baseline, conditionDelta: "-0.4" }).reasons
    ).toEqual([]);
  });

  it("uses a documented traffic threshold", () => {
    expect(
      deriveMaintenancePriority({ ...baseline, dailyTraffic: 39_999 }).reasons
    ).toEqual([]);
    expect(
      deriveMaintenancePriority({ ...baseline, dailyTraffic: 41_878 }).reasons[0]
    ).toMatchObject({ code: "HIGH_TRAFFIC", severity: "MEDIUM" });
  });

  it("orders all reasons by severity and deterministic policy order", () => {
    const result = deriveMaintenancePriority({
      ...baseline,
      conditionDelta: "0.2",
      dailyTraffic: 50_000,
      inspectionStatus: "OVERDUE",
      maximumDurability: 3,
      maximumStability: 3,
      maximumTrafficSafety: 3,
      recommendationSourceDate: "2018-01-01",
      urgency: "SOFORT"
    });

    expect(result.level).toBe("CRITICAL");
    expect(result.reasons.map((reason) => reason.code)).toEqual([
      "STABILITY_RATING",
      "TRAFFIC_SAFETY_RATING",
      "INSPECTION_OVERDUE",
      "IMMEDIATE_URGENCY",
      "DURABILITY_RATING",
      "CONDITION_DETERIORATING",
      "LONG_UNRESOLVED",
      "HIGH_TRAFFIC"
    ]);
  });
});
