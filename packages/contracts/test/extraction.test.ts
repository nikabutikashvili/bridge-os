import {
  extractedEvidenceSchema,
  identityOverviewExtractionSchema,
  pageClassificationOutputSchema
} from "../src/index.js";
import { describe, expect, it } from "vitest";

const evidence = {
  boundingBox: null,
  confidence: 0.98,
  derivationMethod: null,
  kind: "SOURCE_FACT",
  pageNumber: 1,
  sourceExcerpt: "Bauwerksnummer 4405884"
} as const;

describe("extraction contracts", () => {
  it("keeps non-null field values when a verbatim excerpt is missing", () => {
    const valid = identityOverviewExtractionSchema.safeParse({
      category: "IDENTITY_OVERVIEW",
      bridge: {
        evidence: [evidence],
        externalStructureNumber: { value: "4405884", evidence: [evidence] },
        name: { value: null, evidence: [] },
        road: { value: null, evidence: [] },
        location: {
          countryCode: { value: null, evidence: [] },
          federalState: { value: null, evidence: [] },
          district: { value: null, evidence: [] },
          municipality: { value: null, evidence: [] },
          locality: { value: null, evidence: [] },
          postalCode: { value: null, evidence: [] },
          stationing: { value: null, evidence: [] },
          crossedFeature: { value: null, evidence: [] },
          latitude: { value: null, evidence: [] },
          longitude: { value: null, evidence: [] }
        },
        owner: { value: null, evidence: [] },
        loadBearingResponsibility: { value: null, evidence: [] },
        responsibleAuthority: { value: null, evidence: [] },
        maintenanceOffice: { value: null, evidence: [] }
      }
    });
    expect(valid.success).toBe(true);

    const missingEvidence = identityOverviewExtractionSchema.safeParse({
      ...(valid.success ? valid.data : {}),
      bridge: valid.success
        ? {
            ...valid.data.bridge,
            externalStructureNumber: { value: "4405884", evidence: [] }
          }
        : null
    });
    expect(missingEvidence.success).toBe(true);
    expect(missingEvidence.data?.bridge?.externalStructureNumber.value).toBe(
      "4405884"
    );
  });

  it("rejects duplicate page categories", () => {
    const result = pageClassificationOutputSchema.safeParse({
      categories: [
        { category: "FINDINGS_DAMAGE", confidence: 0.9 },
        { category: "FINDINGS_DAMAGE", confidence: 0.8 }
      ],
      sectionTitle: null
    });

    expect(result.success).toBe(false);
  });

  it("requires a derivation method exactly for derived evidence", () => {
    expect(
      extractedEvidenceSchema.safeParse({
        ...evidence,
        kind: "DERIVED",
        derivationMethod: null
      }).success
    ).toBe(false);
    expect(
      extractedEvidenceSchema.safeParse({
        ...evidence,
        kind: "DERIVED",
        derivationMethod: "Unit conversion only"
      }).success
    ).toBe(true);
  });
});
