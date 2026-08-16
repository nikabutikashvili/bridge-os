import {
  sectionExtractionOutputSchema,
  type ExtractablePageCategory,
  type SectionExtractionOutput
} from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

import type {
  ExtractionPolicy,
  ExtractionReferenceContext,
  SectionExtractionRequest
} from "../src/features/extraction/extraction-provider.js";
import { ModelBackedExtractionProvider } from "../src/features/extraction/model/model-backed-extraction-provider.js";
import type {
  ModelImageInput,
  StructuredModelClient,
  StructuredModelRequest,
  StructuredModelResult
} from "../src/features/extraction/model/structured-model-client.js";
import {
  assessVisionFallback,
  type VisionPageSource
} from "../src/features/extraction/model/vision-fallback.js";
import { normalizeExtractionOutputs } from "../src/features/extraction/normalize-extraction.js";
import { bridgeGeometryModelFixture, bridgeIdentityModelFixture, bridgePages } from "./fixtures/model-extraction/bridge.js";
import { findingsModelFixture, findingsPage } from "./fixtures/model-extraction/findings.js";
import { historicalWorksModelFixture, historicalWorksPage } from "./fixtures/model-extraction/historical-works.js";
import { inspectionsModelFixture, inspectionsPage } from "./fixtures/model-extraction/inspections.js";
import { recommendationsModelFixture, recommendationsPage } from "./fixtures/model-extraction/recommendations.js";
import { trafficModelFixture, trafficPage } from "./fixtures/model-extraction/traffic.js";

const documentId = "00000000-0000-4000-8000-000000000201";
const policy: ExtractionPolicy = {
  allowEngineeringConclusions: false,
  preserveMissingValues: true,
  requireSourceEvidence: true
};
const noReferences: ExtractionReferenceContext = {
  findings: [],
  inspections: [],
  partialStructures: []
};

describe("ModelBackedExtractionProvider", () => {
  it("uses separate schema-backed prompts and normalizers for requested domains", async () => {
    const client = new FixtureStructuredModelClient({
      bridge_findings: findingsModelFixture,
      bridge_geometry: bridgeGeometryModelFixture,
      bridge_historical_works: historicalWorksModelFixture,
      bridge_identity: bridgeIdentityModelFixture,
      bridge_inspections: inspectionsModelFixture,
      bridge_recommendations: recommendationsModelFixture,
      bridge_traffic_observations: trafficModelFixture
    });
    const provider = new ModelBackedExtractionProvider({ client });
    const partialReferences: ExtractionReferenceContext = {
      ...noReferences,
      partialStructures: [
        {
          externalNumber: "0",
          name: null,
          sourceKey: "partial:4405884-0"
        }
      ]
    };
    const inspectionReferences: ExtractionReferenceContext = {
      ...partialReferences,
      inspections: [
        {
          inspectedOn: "14.06.2021",
          partialStructureRef: "partial:4405884-0",
          sourceKey: "inspection:2021-06-14:main:partial:4405884-0",
          type: "MAIN"
        }
      ]
    };
    const findingReferences: ExtractionReferenceContext = {
      ...inspectionReferences,
      findings: [{ sourceIdentifier: "S-004", sourceKey: "finding:S-004" }]
    };

    const calls = [
      sectionRequest("IDENTITY_OVERVIEW", [bridgePages[0]], noReferences),
      sectionRequest("STRUCTURE_GEOMETRY", [bridgePages[1]], noReferences),
      sectionRequest("INSPECTIONS", [inspectionsPage], partialReferences),
      sectionRequest("FINDINGS_DAMAGE", [findingsPage], inspectionReferences),
      sectionRequest("RECOMMENDATIONS", [recommendationsPage], findingReferences),
      sectionRequest("TRAFFIC_NETWORK", [trafficPage], partialReferences),
      sectionRequest(
        "HISTORICAL_WORKS_COSTS",
        [historicalWorksPage],
        partialReferences
      )
    ];
    const outputs: SectionExtractionOutput[] = [];
    for (const call of calls) {
      const result = await provider.extractSection(call);
      outputs.push(sectionExtractionOutputSchema.parse(result.output));
    }

    const normalized = normalizeExtractionOutputs(outputs);
    expect(normalized).toMatchObject({
      bridge: {
        values: {
          externalStructureNumber: "4405884",
          name: "Heideckhofweg",
          road: "A 57"
        }
      },
      partialStructures: [
        {
          sourceKey: "partial:4405884-0",
          values: { areaSqM: "117", lengthM: "7.23", widthM: "14.75" }
        }
      ],
      inspections: [{ values: { conditionScore: "1.8", inspectedOn: "2021-06-14" } }],
      findings: [{ sourceKey: "finding:S-004", values: { durabilityRating: 2 } }],
      recommendations: [
        { linkedFindingRefs: ["finding:S-004"], values: { quantity: "30", unit: "m" } }
      ],
      trafficObservations: [{ values: { dailyTraffic: 41_878, truckSharePercent: "9" } }],
      historicalWorks: [{ values: { contractAmount: "125000.00", currency: "EUR" } }]
    });
    expect(client.calls).toHaveLength(7);
    for (const call of client.calls) {
      expect(call.systemPrompt).toContain("Use only the supplied document content");
      expect(call.systemPrompt).toContain("Output null for unknown");
      expect(call.systemPrompt).toContain("Do not infer unsupported engineering facts");
      expect(call.systemPrompt).toContain("Preserve source identifiers exactly");
      expect(call.systemPrompt).toContain("Every important extracted entity");
      expect(call.systemPrompt).toContain("original German wording");
      expect(call.systemPrompt).toContain("not model-generated prioritization");
      expect(call.temperature).toBe(0);
    }
    expect(
      client.calls.find((call) => call.outputName === "bridge_recommendations")
        ?.userPrompt
    ).toContain("finding:S-004");
  });

  it("uses vision only for eligible layout-heavy pages when a source is configured", async () => {
    const layoutPage = {
      pageNumber: 8,
      textContent: Array.from(
        { length: 12 },
        (_, index) => `Zeile ${String(index + 1)} Wert ${String(index * 10)}`
      ).join("\n")
    };
    const images = new FixtureVisionPageSource();
    const client = new FixtureStructuredModelClient({
      bauwerksbuch_page_classification: {
        categories: [{ category: "DRAWINGS_IMAGES_OTHER", confidence: 0.8 }],
        sectionTitle: null
      }
    });
    const provider = new ModelBackedExtractionProvider({ client, visionPageSource: images });

    await provider.classifyPage({
      documentId,
      page: bridgePages[0],
      policy,
      promptVersion: "page-classification.de.v4",
      schemaVersion: "bauwerksbuch-section-contracts.v1",
      temperature: 0
    });
    await provider.classifyPage({
      documentId,
      page: layoutPage,
      policy,
      promptVersion: "page-classification.de.v4",
      schemaVersion: "bauwerksbuch-section-contracts.v1",
      temperature: 0
    });

    expect(assessVisionFallback(bridgePages[0]).mode).toBe("TEXT_ONLY");
    expect(assessVisionFallback(layoutPage).mode).toBe("VISION_ELIGIBLE");
    expect(images.requestedPages).toEqual([8]);
    expect(client.calls[0]?.images).toEqual([]);
    expect(client.calls[1]?.images).toHaveLength(1);
  });

  it("flags textless scans for OCR instead of sending unverifiable vision evidence", () => {
    expect(assessVisionFallback({ pageNumber: 9, textContent: "   " })).toEqual({
      mode: "OCR_REQUIRED",
      reason: "INSUFFICIENT_TEXT"
    });
  });
});

function sectionRequest(
  category: ExtractablePageCategory,
  pages: SectionExtractionRequest["pages"],
  referenceContext: ExtractionReferenceContext
): SectionExtractionRequest {
  const promptVersions: Record<ExtractablePageCategory, string> = {
    COMPONENTS_MATERIALS: "components-materials.de.v1",
    FINDINGS_DAMAGE: "findings-damage.de.v3",
    HISTORICAL_WORKS_COSTS: "historical-works-costs.de.v2",
    IDENTITY_OVERVIEW: "identity-overview.de.v3",
    INSPECTIONS: "inspections.de.v4",
    RECOMMENDATIONS: "recommendations.de.v4",
    STRUCTURE_GEOMETRY: "structure-geometry.de.v2",
    TRAFFIC_NETWORK: "traffic-network.de.v2"
  };
  return {
    category,
    documentId,
    pages,
    policy,
    promptVersion: promptVersions[category],
    referenceContext,
    schemaVersion: "bauwerksbuch-section-contracts.v1",
    temperature: 0
  };
}

interface RecordedModelCall {
  readonly images: readonly ModelImageInput[];
  readonly outputName: string;
  readonly systemPrompt: string;
  readonly temperature: number;
  readonly userPrompt: string;
}

class FixtureStructuredModelClient implements StructuredModelClient {
  public readonly calls: RecordedModelCall[] = [];
  public readonly model = "fixture-model";
  public readonly provider = "fixture-provider";

  public constructor(private readonly fixtures: Readonly<Record<string, unknown>>) {}

  public generateStructured<TOutput>(
    request: StructuredModelRequest<TOutput>
  ): Promise<StructuredModelResult<TOutput>> {
    this.calls.push({
      images: request.images,
      outputName: request.outputName,
      systemPrompt: request.systemPrompt,
      temperature: request.temperature,
      userPrompt: request.userPrompt
    });
    const fixture = this.fixtures[request.outputName];
    if (fixture === undefined) {
      throw new Error(`Missing fixture for ${request.outputName}`);
    }
    return Promise.resolve({
      output: request.outputSchema.parse(fixture),
      providerRequestId: `fixture-${String(this.calls.length)}`,
      usage: { inputTokens: 100, outputTokens: 50 }
    });
  }
}

class FixtureVisionPageSource implements VisionPageSource {
  public readonly requestedPages: number[] = [];

  public getPageImage(
    _documentId: string,
    pageNumber: number
  ): Promise<ModelImageInput> {
    this.requestedPages.push(pageNumber);
    return Promise.resolve({
      dataUrl: "data:image/png;base64,aW1hZ2U=",
      pageNumber
    });
  }
}
