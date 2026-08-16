import { describe, expect, it } from "vitest";

import type { NormalizedExtractionBundle } from "../src/features/extraction/normalized-extraction.js";
import { buildExtractionIdentityPlan } from "../src/features/extraction/source-identities.js";

describe("extraction source identities", () => {
  it("uses domain identities instead of provider array position", () => {
    const plan = buildExtractionIdentityPlan(bundle(["2", "1"]));

    expect(plan.bridge.identityKey).toBe("bridge:4405884");
    expect(plan.partialStructures.get("provider-row-a")?.identityKey).toBe(
      "bridge:4405884:partial:2"
    );
    expect(plan.partialStructures.get("provider-row-b")?.identityKey).toBe(
      "bridge:4405884:partial:1"
    );
  });

  it("keeps colliding partials by uniquing the second identity key", () => {
    const plan = buildExtractionIdentityPlan(bundle(["1", "1"]));

    expect(plan.partialStructures.get("provider-row-a")?.identityKey).toBe(
      "bridge:4405884:partial:1"
    );
    expect(plan.partialStructures.get("provider-row-b")?.identityKey).toBe(
      "bridge:4405884:partial:1:provider-row-b"
    );
  });
});

function bundle(externalPartialNumbers: readonly string[]): NormalizedExtractionBundle {
  return {
    bridge: {
      evidence: [],
      fieldEvidence: {},
      values: {
        dataOrigin: "EXTRACTED",
        externalStructureNumber: "4405884",
        loadBearingResponsibility: null,
        location: {
          countryCode: null,
          crossedFeature: null,
          district: null,
          federalState: null,
          latitude: null,
          locality: null,
          longitude: null,
          municipality: null,
          postalCode: null,
          stationing: null
        },
        maintenanceOffice: null,
        name: null,
        owner: null,
        responsibleAuthority: null,
        road: null
      }
    },
    components: [],
    findings: [],
    historicalWorks: [],
    inspections: [],
    partialStructures: externalPartialNumbers.map((externalNumber, index) => ({
      evidence: [],
      fieldEvidence: {},
      sourceKey: index === 0 ? "provider-row-a" : "provider-row-b",
      values: {
        areaSqM: null,
        clearHeightM: null,
        constructionYear: null,
        externalPartialStructureNumber: externalNumber,
        lengthM: null,
        name: null,
        spanCount: null,
        structuralSystem: null,
        structureType: null,
        widthM: null
      }
    })),
    recommendations: [],
    trafficObservations: []
  };
}
