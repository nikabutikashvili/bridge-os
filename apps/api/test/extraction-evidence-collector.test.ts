import { describe, expect, it } from "vitest";

import { EvidenceCollector } from "../src/features/extraction/extraction-evidence-collector.js";

describe("EvidenceCollector", () => {
  it("stores run-created evidence as model extraction with automatic review state", () => {
    const collector = new EvidenceCollector(
      "00000000-0000-4000-8000-000000000101",
      "00000000-0000-4000-8000-000000000201"
    );

    collector.links(
      [
        {
          boundingBox: null,
          confidence: 0.9,
          derivationMethod: null,
          kind: "SOURCE_FACT",
          pageNumber: 3,
          sourceExcerpt: "Bauwerksnummer 4405884"
        }
      ],
      {}
    );

    expect(collector.evidenceRows).toEqual([
      expect.objectContaining({
        extractionMethod: "MODEL_EXTRACTION",
        extractionRunId: "00000000-0000-4000-8000-000000000201",
        reviewState: "AUTOMATICALLY_EXTRACTED"
      })
    ]);
  });
});
