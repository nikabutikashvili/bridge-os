import { describe, expect, it } from "vitest";

import { deriveWorkPackageReadiness } from "../src/features/work-packages/readiness.js";

describe("work package readiness", () => {
  it("marks only facts that are actually present as available", () => {
    const readiness = deriveWorkPackageReadiness({
      hasCostEstimate: true,
      hasDrawings: false,
      hasQuantity: true,
      hasSourceEvidence: true,
      inspectionDueStatus: "CURRENT",
      trafficManagementRequirementsKnown: false
    });

    expect(states(readiness)).toMatchObject({
      SOURCE_EVIDENCE_AVAILABLE: "AVAILABLE",
      QUANTITIES_KNOWN: "AVAILABLE",
      CURRENT_INSPECTION_AVAILABLE: "AVAILABLE",
      COST_ESTIMATE_AVAILABLE: "AVAILABLE",
      DRAWINGS_AVAILABLE: "MISSING",
      TRAFFIC_MANAGEMENT_REQUIREMENTS_KNOWN: "MISSING",
      SITE_VERIFICATION_REQUIRED: "REQUIRED"
    });
  });

  it("does not call an overdue or unconfirmable inspection current", () => {
    for (const inspectionDueStatus of ["OVERDUE", "UNKNOWN", null] as const) {
      const readiness = deriveWorkPackageReadiness({
        hasCostEstimate: false,
        hasDrawings: false,
        hasQuantity: false,
        hasSourceEvidence: false,
        inspectionDueStatus,
        trafficManagementRequirementsKnown: false
      });
      expect(states(readiness)["CURRENT_INSPECTION_AVAILABLE"]).toBe("MISSING");
    }
  });

  it("accepts an inspection that is still current but due soon", () => {
    const readiness = deriveWorkPackageReadiness({
      hasCostEstimate: false,
      hasDrawings: false,
      hasQuantity: false,
      hasSourceEvidence: false,
      inspectionDueStatus: "DUE_SOON",
      trafficManagementRequirementsKnown: false
    });
    expect(states(readiness)["CURRENT_INSPECTION_AVAILABLE"]).toBe("AVAILABLE");
  });
});

function states(
  readiness: ReturnType<typeof deriveWorkPackageReadiness>
): Record<string, string> {
  return Object.fromEntries(readiness.map((item) => [item.code, item.state]));
}
