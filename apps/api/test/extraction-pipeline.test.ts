import type {
  ExtractedEvidence,
  ExtractionRunStatus
} from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

import { ExtractionPipelineError } from "../src/features/extraction/extraction-error.js";
import { ExtractionPipelineService } from "../src/features/extraction/extraction-pipeline-service.js";
import type {
  CreateExtractionRunInput,
  ExtractionDocumentContext,
  ExtractionFailureInput,
  ExtractionPersistenceResult,
  ExtractionRunMetrics,
  ExtractionRunRecord,
  ExtractionStore
} from "../src/features/extraction/extraction-store.js";
import type { NormalizedExtractionBundle } from "../src/features/extraction/normalized-extraction.js";
import { DeterministicExtractionProvider } from "./support/deterministic-extraction-provider.js";

const documentId = "00000000-0000-4000-8000-000000000101";
const context: ExtractionDocumentContext = {
  documentId,
  processingRunId: "00000000-0000-4000-8000-000000000102",
  processingStatus: "EXTRACTION_PENDING",
  pages: [
    {
      pageNumber: 1,
      textContent: "Bauwerksnummer 9911223 Name Testbruecke Strasse A57"
    },
    {
      pageNumber: 2,
      textContent:
        "Teilbauwerk 1 Baujahr 1983 Laenge 7,23 m Breite 14,75 m Flaeche 117 m2 ein Feld"
    },
    {
      pageNumber: 3,
      textContent: "Verkehrszaehlung 2015 DTV 41.878 Schwerverkehr 9 %"
    }
  ]
};

describe("ExtractionPipelineService", () => {
  it("classifies individual pages, runs section extractors, normalizes, and persists", async () => {
    const store = new MemoryExtractionStore(context);
    const provider = fixtureProvider();
    const service = createService(store, provider);

    const run = await service.extract(documentId);

    expect(run).toMatchObject({ attempt: 1, retryOfRunId: null, status: "SUCCEEDED" });
    expect(provider.classificationRequests).toHaveLength(3);
    expect(provider.classificationRequests.every((request) => request.temperature === 0)).toBe(
      true
    );
    expect(provider.classificationRequests[0]?.policy).toMatchObject({
      allowEngineeringConclusions: false,
      preserveMissingValues: true,
      requireSourceEvidence: true
    });
    expect(provider.extractionRequests.map((request) => request.category)).toEqual([
      "IDENTITY_OVERVIEW",
      "STRUCTURE_GEOMETRY",
      "TRAFFIC_NETWORK"
    ]);
    expect(provider.extractionRequests.every((request) => request.pages.length === 1)).toBe(
      true
    );
    expect(provider.extractionRequests.at(-1)?.referenceContext.partialStructures).toEqual([
      { externalNumber: "1", name: null, sourceKey: "tbw-1" }
    ]);
    expect(store.persistedBundle).toMatchObject({
      bridge: {
        values: {
          dataOrigin: "EXTRACTED",
          externalStructureNumber: "9911223",
          name: "Testbruecke",
          road: "A57"
        }
      },
      partialStructures: [
        {
          sourceKey: "tbw-1",
          values: {
            areaSqM: "117",
            constructionYear: 1983,
            lengthM: "7.23",
            spanCount: 1,
            widthM: "14.75"
          }
        }
      ],
      trafficObservations: [
        {
          values: {
            dailyTraffic: 41_878,
            observationYear: 2015,
            truckSharePercent: "9"
          }
        }
      ]
    });
    expect(store.completedMetrics).toMatchObject({
      costCurrency: "EUR",
      estimatedCost: "0.000600",
      inputTokens: 60,
      outputTokens: 30
    });
  });

  it("converts GIS-Koordinaten from later pages that identity extraction never sees", async () => {
    const gisContext: ExtractionDocumentContext = {
      ...context,
      pages: [
        ...context.pages,
        {
          pageNumber: 10,
          textContent: `5.1.1 GIS-Koordinaten
UTM-Koordinaten
Bezugssystem    ETRS_UTM_NW489
Rechtswert              5646659,710
Hochwert                 382394,030`
        }
      ]
    };
    const store = new MemoryExtractionStore(gisContext);
    const service = createService(store, fixtureProvider());

    await service.extract(documentId);

    expect(store.persistedBundle?.bridge.values.location.latitude).toMatch(/^50\.\d{6}$/);
    expect(store.persistedBundle?.bridge.values.location.longitude).toMatch(/^7\.\d{6}$/);
    expect(store.persistedBundle?.bridge.fieldEvidence["location.latitude"]?.[0]).toMatchObject({
      derivationMethod: "UTM_ETRS89_TO_WGS84",
      kind: "DERIVED",
      pageNumber: 10
    });
  });

  it("persists invalid-output failures and retries as a linked new attempt", async () => {
    const store = new MemoryExtractionStore(context);
    let invalid = true;
    const provider = fixtureProvider(() => invalid);
    const service = createService(store, provider);

    const firstError = await service.extract(documentId).catch((error: unknown) => error);
    expect(firstError).toBeInstanceOf(ExtractionPipelineError);
    const failedRunId = (firstError as ExtractionPipelineError).runId;
    expect(failedRunId).not.toBeNull();
    expect(await service.getRun(failedRunId ?? "")).toMatchObject({
      attempt: 1,
      error: { code: "EXTRACTION_OUTPUT_INVALID" },
      status: "FAILED"
    });
    expect(store.failedInvocations).toBe(1);
    expect(store.persistedBundle).toBeNull();

    invalid = false;
    const retry = await service.retry(failedRunId ?? "");

    expect(retry).toMatchObject({
      attempt: 2,
      retryOfRunId: failedRunId,
      status: "SUCCEEDED"
    });
  });

  it("abandons an in-progress run and retries as a new attempt", async () => {
    const store = new MemoryExtractionStore(context);
    const service = createService(store, fixtureProvider());
    const stuck = await store.createRun({
      documentId,
      model: "deterministic-fixture-v1",
      pipelineVersion: "test",
      processingRunId: context.processingRunId,
      promptVersions: {},
      provider: "deterministic-test",
      retryOfRunId: null,
      temperature: 0
    });
    await store.transitionRun(stuck.id, "PENDING", "CLASSIFYING");
    await store.transitionRun(stuck.id, "CLASSIFYING", "EXTRACTING");

    const recovered = await service.abandonAndRetry(stuck.id);

    expect(recovered).toMatchObject({
      attempt: 2,
      retryOfRunId: stuck.id,
      status: "SUCCEEDED"
    });
    expect(await service.getRun(stuck.id)).toMatchObject({
      error: { code: "EXTRACTION_ABANDONED" },
      status: "FAILED"
    });
  });

  it("still persists when a model excerpt is not verbatim page text", async () => {
    const store = new MemoryExtractionStore(context);
    const provider = fixtureProvider(undefined, true);
    const service = createService(store, provider);

    const run = await service.extract(documentId);

    expect(run.status).toBe("SUCCEEDED");
    expect(store.persistedBundle?.bridge.values.externalStructureNumber).toBe(
      "9911223"
    );
  });

  it("skips model classification for textless scanned pages", async () => {
    const scannedContext: ExtractionDocumentContext = {
      ...context,
      originalFilename: "scan.pdf",
      pages: [
        { pageNumber: 1, textContent: "" },
        { pageNumber: 2, textContent: "   " }
      ]
    };
    const store = new MemoryExtractionStore(scannedContext);
    const provider = fixtureProvider();
    const service = createService(store, provider);

    const run = await service.extract(documentId);

    expect(run.status).toBe("SUCCEEDED");
    expect(provider.classificationRequests).toHaveLength(0);
    expect(store.persistedBundle).not.toBeNull();
  });

  it("extracts identity from the first classified chunk only", async () => {
    const multiPageContext: ExtractionDocumentContext = {
      ...context,
      pages: [
        ...context.pages,
        {
          pageNumber: 4,
          textContent: "Bauwerksnummer 9911223 Wiederholung auf Seite 4"
        },
        {
          pageNumber: 5,
          textContent: "Bauwerksnummer 9911223 Wiederholung auf Seite 5"
        }
      ]
    };
    const store = new MemoryExtractionStore(multiPageContext);
    const provider = new DeterministicExtractionProvider({
      classify: (request) => ({
        categories: [
          {
            category:
              request.page.pageNumber <= 2
                ? "IDENTITY_OVERVIEW"
                : request.page.pageNumber === 3
                  ? "TRAFFIC_NETWORK"
                  : "IDENTITY_OVERVIEW",
            confidence: 1
          }
        ],
        sectionTitle: null
      }),
      extract: (request) => {
        switch (request.category) {
          case "IDENTITY_OVERVIEW":
            return identityOutput(false);
          case "TRAFFIC_NETWORK":
            return trafficOutput();
          default:
            return { category: request.category, inspections: [] };
        }
      }
    });
    const service = createService(store, provider);

    await service.extract(documentId);

    expect(
      provider.extractionRequests.filter(
        (request) => request.category === "IDENTITY_OVERVIEW"
      )
    ).toHaveLength(1);
    expect(store.persistedBundle?.bridge.values.externalStructureNumber).toBe(
      "9911223"
    );
  });

  it("packs non-consecutive findings pages into one section window", async () => {
    const findingsContext: ExtractionDocumentContext = {
      ...context,
      pages: [
        {
          pageNumber: 1,
          textContent: "Bauwerksnummer 9911223 Name Testbruecke Strasse A57"
        },
        {
          pageNumber: 5,
          textContent: "[9] S=0, V=0, D=1 BSP-ID 006-01-01 Platte, Beton"
        },
        {
          pageNumber: 7,
          textContent: "[11] S=0, V=0, D=2 BSP-ID 241-09 Fahrbahnbelag"
        }
      ]
    };
    const store = new MemoryExtractionStore(findingsContext);
    const provider = new DeterministicExtractionProvider({
      classify: (request) => ({
        categories: [
          {
            category:
              request.page.pageNumber === 1
                ? "IDENTITY_OVERVIEW"
                : "FINDINGS_DAMAGE",
            confidence: 1
          }
        ],
        sectionTitle: null
      }),
      extract: (request) => {
        if (request.category === "IDENTITY_OVERVIEW") {
          return identityOutput(false);
        }
        if (request.category === "FINDINGS_DAMAGE") {
          return { category: "FINDINGS_DAMAGE", findings: [] };
        }
        return emptySection(request.category);
      }
    });
    const service = createService(store, provider);

    await service.extract(documentId);

    const findingsRequests = provider.extractionRequests.filter(
      (request) => request.category === "FINDINGS_DAMAGE"
    );
    expect(findingsRequests).toHaveLength(1);
    expect(findingsRequests[0]?.pages.map((page) => page.pageNumber)).toEqual([
      5, 7
    ]);
    expect(store.persistedBundle?.findings.length).toBeGreaterThan(0);
  });

  it("does not fail a scanned document whose pages have no classifiable text", async () => {
    const scannedContext: ExtractionDocumentContext = {
      ...context,
      originalFilename: "Bauwerksbuch 3.pdf",
      pages: [
        { pageNumber: 1, textContent: "", textSource: "PDF_TEXT" },
        { pageNumber: 2, textContent: "   ", textSource: "PDF_TEXT" }
      ]
    };
    const store = new MemoryExtractionStore(scannedContext);
    const provider = fixtureProvider();
    const service = createService(store, provider);

    const run = await service.extract(documentId);

    expect(run.status).toBe("SUCCEEDED");
    expect(provider.classificationRequests).toHaveLength(0);
    expect(provider.extractionRequests).toHaveLength(0);
    expect(store.persistedBundle?.bridge.values.name).toBe("Bauwerksbuch 3");
  });

  it("keeps a findings run alive when structured output is missing", async () => {
    const findingsContext: ExtractionDocumentContext = {
      ...context,
      pages: [
        {
          pageNumber: 1,
          textContent: "Bauwerksnummer 9911223 Name Testbruecke Strasse A57"
        },
        {
          pageNumber: 5,
          textContent: "[9] S=0, V=0, D=1 BSP-ID 006-01-01 Platte, Beton"
        }
      ]
    };
    const store = new MemoryExtractionStore(findingsContext);
    const provider = new DeterministicExtractionProvider({
      classify: (request) => ({
        categories: [
          {
            category:
              request.page.pageNumber === 1
                ? "IDENTITY_OVERVIEW"
                : "FINDINGS_DAMAGE",
            confidence: 1
          }
        ],
        sectionTitle: null
      }),
      extract: (request) => {
        if (request.category === "IDENTITY_OVERVIEW") {
          return identityOutput(false);
        }
        if (request.category === "FINDINGS_DAMAGE") {
          throw new Error(
            "The model response did not contain a parsed structured output."
          );
        }
        return emptySection(request.category);
      }
    });
    const service = createService(store, provider);

    const run = await service.extract(documentId);

    expect(run.status).toBe("SUCCEEDED");
    expect(store.failedInvocations).toBe(1);
    expect(store.persistedBundle?.findings.length).toBeGreaterThan(0);
  });

  it("keeps a findings run alive when one model record is invalid", async () => {
    const store = new MemoryExtractionStore(context);
    const provider = new DeterministicExtractionProvider({
      classify: (request) => ({
        categories: [
          {
            category:
              request.page.pageNumber === 1
                ? "IDENTITY_OVERVIEW"
                : request.page.pageNumber === 2
                  ? "STRUCTURE_GEOMETRY"
                  : "TRAFFIC_NETWORK",
            confidence: 1
          },
          ...(request.page.pageNumber === 3
            ? [{ category: "FINDINGS_DAMAGE" as const, confidence: 1 }]
            : [])
        ],
        sectionTitle: null
      }),
      extract: (request) => {
        if (request.category === "FINDINGS_DAMAGE") {
          return {
            category: "FINDINGS_DAMAGE",
            findings: [{ sourceKey: "broken" }]
          };
        }
        switch (request.category) {
          case "IDENTITY_OVERVIEW":
            return identityOutput(false);
          case "STRUCTURE_GEOMETRY":
            return structureOutput();
          case "TRAFFIC_NETWORK":
            return trafficOutput();
          default:
            return emptySection(request.category);
        }
      }
    });
    const service = createService(store, provider);

    const run = await service.extract(documentId);

    expect(run.status).toBe("SUCCEEDED");
    expect(store.persistedBundle?.bridge.values.externalStructureNumber).toBe(
      "9911223"
    );
  });
});

function emptySection(category: string): unknown {
  switch (category) {
    case "COMPONENTS_MATERIALS":
      return { category, components: [] };
    case "INSPECTIONS":
      return { category, inspections: [] };
    case "FINDINGS_DAMAGE":
      return { category, findings: [] };
    case "RECOMMENDATIONS":
      return { category, recommendations: [] };
    case "HISTORICAL_WORKS_COSTS":
      return { category, historicalWorks: [] };
    default:
      return { category, trafficObservations: [] };
  }
}

function createService(
  store: MemoryExtractionStore,
  provider: DeterministicExtractionProvider
): ExtractionPipelineService {
  return new ExtractionPipelineService({
    logger: { error: () => undefined, info: () => undefined },
    provider,
    store
  });
}

function fixtureProvider(
  shouldReturnInvalid?: () => boolean,
  hallucinateEvidence = false
): DeterministicExtractionProvider {
  return new DeterministicExtractionProvider({
    classify: (request) => ({
      categories: [
        {
          category:
            request.page.pageNumber === 1
              ? "IDENTITY_OVERVIEW"
              : request.page.pageNumber === 2
                ? "STRUCTURE_GEOMETRY"
                : "TRAFFIC_NETWORK",
          confidence: 1
        }
      ],
      sectionTitle: null
    }),
    extract: (request) => {
      if (shouldReturnInvalid?.() === true && request.category === "IDENTITY_OVERVIEW") {
        return { bridge: {}, category: "IDENTITY_OVERVIEW" };
      }
      switch (request.category) {
        case "IDENTITY_OVERVIEW":
          return identityOutput(hallucinateEvidence);
        case "STRUCTURE_GEOMETRY":
          return structureOutput();
        case "TRAFFIC_NETWORK":
          return trafficOutput();
        case "COMPONENTS_MATERIALS":
          return { category: request.category, components: [] };
        case "INSPECTIONS":
          return { category: request.category, inspections: [] };
        case "FINDINGS_DAMAGE":
          return { category: request.category, findings: [] };
        case "RECOMMENDATIONS":
          return { category: request.category, recommendations: [] };
        case "HISTORICAL_WORKS_COSTS":
          return { category: request.category, historicalWorks: [] };
      }
    }
  });
}

function identityOutput(hallucinateEvidence: boolean): unknown {
  const recordExcerpt = hallucinateEvidence
    ? "Nicht auf der Seite vorhanden"
    : "Bauwerksnummer 9911223";
  return {
    category: "IDENTITY_OVERVIEW",
    bridge: {
      evidence: [citation(1, recordExcerpt)],
      externalStructureNumber: field("9911223", 1, "Bauwerksnummer 9911223"),
      name: field("Testbruecke", 1, "Name Testbruecke"),
      road: field("A57", 1, "Strasse A57"),
      location: {
        countryCode: emptyField(),
        federalState: emptyField(),
        district: emptyField(),
        municipality: emptyField(),
        locality: emptyField(),
        postalCode: emptyField(),
        stationing: emptyField(),
        crossedFeature: emptyField(),
        latitude: emptyField(),
        longitude: emptyField()
      },
      owner: emptyField(),
      loadBearingResponsibility: emptyField(),
      responsibleAuthority: emptyField(),
      maintenanceOffice: emptyField()
    }
  };
}

function structureOutput(): unknown {
  return {
    category: "STRUCTURE_GEOMETRY",
    partialStructures: [
      {
        sourceKey: "tbw-1",
        evidence: [citation(2, "Baujahr 1983")],
        externalPartialStructureNumber: field("1", 2, "Teilbauwerk 1"),
        name: emptyField(),
        constructionYear: field("1983", 2, "Baujahr 1983"),
        structureType: emptyField(),
        structuralSystem: emptyField(),
        length: field("7,23", 2, "Laenge 7,23 m"),
        width: field("14,75", 2, "Breite 14,75 m"),
        area: field("117", 2, "Flaeche 117 m2"),
        clearHeight: emptyField(),
        spanCount: field(1, 2, "ein Feld")
      }
    ]
  };
}

function trafficOutput(): unknown {
  return {
    category: "TRAFFIC_NETWORK",
    trafficObservations: [
      {
        sourceKey: "traffic-2015",
        evidence: [citation(3, "Verkehrszaehlung 2015")],
        observationYear: field("2015", 3, "Verkehrszaehlung 2015"),
        observedOn: emptyField(),
        dailyTraffic: field("41.878", 3, "DTV 41.878"),
        truckSharePercent: field("9", 3, "Schwerverkehr 9 %"),
        sourceDescription: emptyField()
      }
    ]
  };
}

function citation(pageNumber: number, sourceExcerpt: string): ExtractedEvidence {
  return {
    boundingBox: null,
    confidence: 1,
    derivationMethod: null,
    kind: "SOURCE_FACT",
    pageNumber,
    sourceExcerpt
  };
}

function field(value: unknown, pageNumber: number, excerpt: string) {
  return { evidence: [citation(pageNumber, excerpt)], value };
}

function emptyField() {
  return { evidence: [], value: null };
}

interface MemoryRun {
  attempt: number;
  documentId: string;
  error: ExtractionFailureInput | null;
  id: string;
  metrics: ExtractionRunMetrics | null;
  processingRunId: string;
  retryOfRunId: string | null;
  resultSummary: ExtractionRunRecord["resultSummary"];
  status: ExtractionRunStatus;
}

class MemoryExtractionStore implements ExtractionStore {
  public completedMetrics: ExtractionRunMetrics | null = null;
  public failedInvocations = 0;
  public persistedBundle: NormalizedExtractionBundle | null = null;
  private readonly runs = new Map<string, MemoryRun>();
  private invocationCount = 0;

  public constructor(private readonly context: ExtractionDocumentContext) {}

  public completeInvocation(): Promise<void> {
    return Promise.resolve();
  }

  public createRun(input: CreateExtractionRunInput): Promise<ExtractionRunRecord> {
    const attempt = this.runs.size + 1;
    const run: MemoryRun = {
      attempt,
      documentId: input.documentId,
      error: null,
      id: `run-${String(attempt)}`,
      metrics: null,
      processingRunId: input.processingRunId,
      retryOfRunId: input.retryOfRunId,
      resultSummary: null,
      status: "PENDING"
    };
    this.runs.set(run.id, run);
    return Promise.resolve(run);
  }

  public failInvocation(): Promise<void> {
    this.failedInvocations += 1;
    return Promise.resolve();
  }

  public failRun(
    runId: string,
    failure: ExtractionFailureInput,
    metrics: ExtractionRunMetrics
  ): Promise<void> {
    const run = this.requireRun(runId);
    run.error = failure;
    run.metrics = metrics;
    run.status = "FAILED";
    return Promise.resolve();
  }

  public getDocumentContext(documentIdValue: string): Promise<ExtractionDocumentContext | null> {
    return Promise.resolve(documentIdValue === this.context.documentId ? this.context : null);
  }

  public getRun(runId: string): Promise<ExtractionRunRecord | null> {
    return Promise.resolve(this.runs.get(runId) ?? null);
  }

  public getLatestRunForDocument(
    documentIdValue: string
  ): Promise<ExtractionRunRecord | null> {
    const matches = [...this.runs.values()].filter(
      (run) => run.documentId === documentIdValue
    );
    return Promise.resolve(matches.at(-1) ?? null);
  }

  public persistExtraction(
    runId: string,
    _context: ExtractionDocumentContext,
    bundle: NormalizedExtractionBundle,
    metrics: ExtractionRunMetrics
  ): Promise<ExtractionPersistenceResult> {
    this.persistedBundle = bundle;
    this.completedMetrics = metrics;
    const run = this.requireRun(runId);
    run.metrics = metrics;
    run.resultSummary = {
      bridgeAction: "CREATED",
      componentsExtracted: bundle.components.length,
      findingsExtracted: bundle.findings.length,
      historicalWorksExtracted: bundle.historicalWorks.length,
      inspectionsExtracted: bundle.inspections.length,
      partialStructuresExtracted: bundle.partialStructures.length,
      recommendationsExtracted: bundle.recommendations.length,
      trafficObservationsExtracted: bundle.trafficObservations.length
    };
    run.status = "SUCCEEDED";
    return Promise.resolve({
      bridgeId: "00000000-0000-4000-8000-000000000201",
      summary: run.resultSummary
    });
  }

  public savePageClassification(): Promise<void> {
    return Promise.resolve();
  }

  public startInvocation(): Promise<string> {
    this.invocationCount += 1;
    return Promise.resolve(`invocation-${String(this.invocationCount)}`);
  }

  public transitionRun(
    runId: string,
    expectedStatus: ExtractionRunStatus,
    nextStatus: ExtractionRunStatus
  ): Promise<void> {
    const run = this.requireRun(runId);
    if (run.status !== expectedStatus) {
      return Promise.reject(new Error("Unexpected in-memory run status."));
    }
    run.status = nextStatus;
    return Promise.resolve();
  }

  private requireRun(runId: string): MemoryRun {
    const run = this.runs.get(runId);
    if (run === undefined) {
      throw new Error("In-memory extraction run not found.");
    }
    return run;
  }
}
