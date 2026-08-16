import type { EvidenceCitation } from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

import { getFieldProvenance, groupEvidenceSources } from "./evidence-model";

const baseCitation: EvidenceCitation = {
  boundingBox: null,
  derivationMethod: null,
  documentId: "44058840-0000-4000-8000-000000000902",
  documentType: "PRUEFBERICHT",
  evidenceId: "44058840-0000-4000-8000-000000001010",
  excerpt: "S-004: Fahrbahnanschlüsse beidseitig schadhaft.",
  extractionConfidence: "0.920",
  extractionMethod: "MODEL_EXTRACTION",
  reviewState: "AUTOMATICALLY_EXTRACTED",
  fieldName: "description",
  kind: "SOURCE_FACT",
  originalFilename: "Hauptpruefung.pdf",
  pageNumber: 9,
  viewSourceUrl: "https://example.test/Hauptpruefung.pdf#page=9"
};

describe("evidence presentation model", () => {
  it("groups one source linked to several normalized fields", () => {
    const groups = groupEvidenceSources([
      baseCitation,
      { ...baseCitation, fieldName: "trafficSafetyRating" },
      { ...baseCitation, fieldName: "quantity" }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.associations.map((item) => item.fieldName)).toEqual([
      "description",
      "trafficSafetyRating",
      "quantity"
    ]);
  });

  it("keeps source facts and derived values explicit at field level", () => {
    const citations = [
      baseCitation,
      {
        ...baseCitation,
        derivationMethod: "Mapped from source defect code",
        fieldName: "defectType",
        kind: "DERIVED" as const
      }
    ];

    expect(getFieldProvenance(citations, ["description"])).toEqual({
      derivationMethods: [],
      kind: "SOURCE_FACT"
    });
    expect(getFieldProvenance(citations, ["defectType"])).toEqual({
      derivationMethods: ["Mapped from source defect code"],
      kind: "DERIVED"
    });
    expect(getFieldProvenance(citations, ["location"])).toEqual({
      derivationMethods: [],
      kind: "UNLINKED"
    });
  });

  it("rejects inconsistent metadata for the same evidence record", () => {
    expect(() =>
      groupEvidenceSources([
        baseCitation,
        { ...baseCitation, fieldName: "quantity", pageNumber: 10 }
      ])
    ).toThrow("Conflicting source metadata");
  });
});
