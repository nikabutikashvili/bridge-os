import type { DocumentUploadResponse } from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

import {
  FixtureIngestionService,
  type ExtractionRunner,
  type FixturePdf
} from "../src/features/demo-ingestion/fixture-ingestion-service.js";
import { parseFixtureCommand } from "../src/features/demo-ingestion/fixture-command.js";
import { ExtractionPipelineError } from "../src/features/extraction/extraction-error.js";
import type { ExtractionRunRecord } from "../src/features/extraction/extraction-store.js";

const firstDocumentId = "00000000-0000-4000-8000-000000000101";
const secondDocumentId = "00000000-0000-4000-8000-000000000102";

describe("FixtureIngestionService", () => {
  it("rejects an incomplete or checksum-duplicated fixture set before ingestion", async () => {
    let ingestionCalls = 0;
    const service = new FixtureIngestionService({
      documents: {
        ingest: () => {
          ingestionCalls += 1;
          return Promise.resolve(uploadResponse(firstDocumentId, false));
        },
        reparse: unusedReparse
      },
      extraction: new MemoryExtractionRunner()
    });

    const report = await service.ingest(
      [pdf("a.pdf", "same"), pdf("b.pdf", "same")],
      { expectedDocumentCount: 6, reextract: false, reparse: false }
    );

    expect(ingestionCalls).toBe(0);
    expect(report.validationFailures).toBe(2);
    expect(report.failures.map((failure) => failure.code)).toEqual([
      "FIXTURE_COUNT_MISMATCH",
      "DUPLICATE_FIXTURE_CHECKSUM"
    ]);
  });

  it("skips an already successful checksum and extracts a new document", async () => {
    const extraction = new MemoryExtractionRunner();
    extraction.latest.set(firstDocumentId, run(firstDocumentId, "SUCCEEDED", "UNCHANGED"));
    const responses = [
      uploadResponse(firstDocumentId, true),
      uploadResponse(secondDocumentId, false)
    ];
    const service = new FixtureIngestionService({
      documents: {
        ingest: () => Promise.resolve(requireResponse(responses.shift())),
        reparse: unusedReparse
      },
      extraction
    });

    const report = await service.ingest(
      [pdf("a.pdf", "first"), pdf("b.pdf", "second")],
      { expectedDocumentCount: 2, reextract: false, reparse: false }
    );

    expect(extraction.calls).toEqual([`extract:${secondDocumentId}`]);
    expect(report).toMatchObject({
      bridgesCreated: 1,
      documentsIngested: 1,
      documentsSkippedByChecksum: 1,
      findingsExtracted: 3,
      inspectionsExtracted: 2,
      recommendationsExtracted: 1,
      validationFailures: 0
    });
  });

  it("retries failed extraction and keeps a clear failure entry for another file", async () => {
    const extraction = new MemoryExtractionRunner();
    extraction.latest.set(firstDocumentId, run(firstDocumentId, "FAILED", null));
    extraction.failDocumentId = secondDocumentId;
    const responses = [
      uploadResponse(firstDocumentId, true),
      uploadResponse(secondDocumentId, false)
    ];
    const service = new FixtureIngestionService({
      documents: {
        ingest: () => Promise.resolve(requireResponse(responses.shift())),
        reparse: unusedReparse
      },
      extraction
    });

    const report = await service.ingest(
      [pdf("a.pdf", "first"), pdf("b.pdf", "second")],
      { expectedDocumentCount: 2, reextract: false, reparse: false }
    );

    expect(extraction.calls).toEqual([
      `retry:run-${firstDocumentId}`,
      `extract:${secondDocumentId}`
    ]);
    expect(report.bridgesUpdated).toBe(1);
    expect(report.failures).toEqual([
      expect.objectContaining({
        code: "EXTRACTION_OUTPUT_INVALID",
        documentId: secondDocumentId,
        filename: "b.pdf",
        stage: "validation"
      })
    ]);
    expect(report.validationFailures).toBe(1);
  });

  it("re-extracts a successful checksum only when explicitly requested", async () => {
    const extraction = new MemoryExtractionRunner();
    extraction.latest.set(firstDocumentId, run(firstDocumentId, "SUCCEEDED", "CREATED"));
    const service = new FixtureIngestionService({
      documents: {
        ingest: () => Promise.resolve(uploadResponse(firstDocumentId, true)),
        reparse: unusedReparse
      },
      extraction
    });

    const report = await service.ingest([pdf("a.pdf", "first")], {
      expectedDocumentCount: 1,
      reextract: true,
      reparse: false
    });

    expect(extraction.calls).toEqual([`reextract:${firstDocumentId}`]);
    expect(report.bridgesUnchanged).toBe(1);
  });

  it("abandons a stuck in-progress run and retries it", async () => {
    const extraction = new MemoryExtractionRunner();
    extraction.latest.set(firstDocumentId, run(firstDocumentId, "EXTRACTING", null));
    const service = new FixtureIngestionService({
      documents: {
        ingest: () => Promise.resolve(uploadResponse(firstDocumentId, true)),
        reparse: unusedReparse
      },
      extraction
    });

    const report = await service.ingest([pdf("a.pdf", "first")], {
      expectedDocumentCount: 1,
      reextract: true,
      reparse: false
    });

    expect(extraction.calls).toEqual([`abandonAndRetry:run-${firstDocumentId}`]);
    expect(report.bridgesUpdated).toBe(1);
  });

  it("re-parses a checksum-skipped document and extracts from the new page text", async () => {
    const extraction = new MemoryExtractionRunner();
    extraction.latest.set(firstDocumentId, run(firstDocumentId, "SUCCEEDED", "CREATED"));
    const reparses: string[] = [];
    const service = new FixtureIngestionService({
      documents: {
        ingest: () => Promise.resolve(uploadResponse(firstDocumentId, true)),
        reparse: (documentId) => {
          reparses.push(documentId);
          return Promise.resolve(uploadResponse(documentId, true));
        }
      },
      extraction
    });

    const report = await service.ingest([pdf("a.pdf", "first")], {
      expectedDocumentCount: 1,
      reextract: false,
      reparse: true
    });

    expect(reparses).toEqual([firstDocumentId]);
    expect(extraction.calls).toEqual([`extract:${firstDocumentId}`]);
    expect(report.bridgesCreated).toBe(1);
    expect(report.documentsSkippedByChecksum).toBe(1);
  });
});

describe("parseFixtureCommand", () => {
  it("uses the five-document fixture defaults", () => {
    expect(parseFixtureCommand([])).toEqual({
      directory: "fixtures/bauwerksbuch",
      expectedDocumentCount: 5,
      json: false,
      kind: "INGEST",
      reextract: false,
      reparse: false
    });
  });

  it("parses explicit directory, count, output, and re-extraction options", () => {
    expect(
      parseFixtureCommand([
        "--dir",
        "/tmp/pdfs",
        "--expect-count",
        "3",
        "--json",
        "--reextract",
        "--reparse"
      ])
    ).toEqual({
      directory: "/tmp/pdfs",
      expectedDocumentCount: 3,
      json: true,
      kind: "INGEST",
      reextract: true,
      reparse: true
    });
  });
});

class MemoryExtractionRunner implements ExtractionRunner {
  public readonly calls: string[] = [];
  public failDocumentId: string | null = null;
  public readonly latest = new Map<string, ExtractionRunRecord>();

  public extract(documentId: string): Promise<ExtractionRunRecord> {
    this.calls.push(`extract:${documentId}`);
    if (documentId === this.failDocumentId) {
      throw new ExtractionPipelineError({
        code: "EXTRACTION_OUTPUT_INVALID",
        message: "Model output did not match the findings contract.",
        stage: "validation"
      });
    }
    return Promise.resolve(run(documentId, "SUCCEEDED", "CREATED"));
  }

  public getLatestRunForDocument(
    documentId: string
  ): Promise<ExtractionRunRecord | null> {
    return Promise.resolve(this.latest.get(documentId) ?? null);
  }

  public reextract(documentId: string): Promise<ExtractionRunRecord> {
    this.calls.push(`reextract:${documentId}`);
    return Promise.resolve(run(documentId, "SUCCEEDED", "UNCHANGED"));
  }

  public retry(runId: string): Promise<ExtractionRunRecord> {
    this.calls.push(`retry:${runId}`);
    const documentId = runId.replace("run-", "");
    return Promise.resolve(run(documentId, "SUCCEEDED", "UPDATED"));
  }

  public abandonAndRetry(runId: string): Promise<ExtractionRunRecord> {
    this.calls.push(`abandonAndRetry:${runId}`);
    const documentId = runId.replace("run-", "");
    return Promise.resolve(run(documentId, "SUCCEEDED", "UPDATED"));
  }
}

function pdf(filename: string, content: string): FixturePdf {
  return { content: new TextEncoder().encode(content), filename };
}

function uploadResponse(
  documentId: string,
  duplicate: boolean
): DocumentUploadResponse {
  const timestamp = "2026-08-15T10:00:00.000Z";
  return {
    data: {
      bridgeId: null,
      checksumSha256: "a".repeat(64),
      createdAt: timestamp,
      id: documentId,
      isDemoFixture: false,
      mimeType: "application/pdf",
      originalFilename: "fixture.pdf",
      pages: { count: 1, pageNumbers: [1] },
      processing: {
        createdAt: timestamp,
        error: null,
        id: "00000000-0000-4000-8000-000000000201",
        pageCount: 1,
        parser: "test-parser/1",
        parsingCompletedAt: timestamp,
        parsingStartedAt: timestamp,
        status: "EXTRACTION_PENDING",
        updatedAt: timestamp
      },
      sizeBytes: 100,
      status: "READY",
      type: "BAUWERKSBUCH",
      updatedAt: timestamp
    },
    duplicate
  };
}

function run(
  documentId: string,
  status: ExtractionRunRecord["status"],
  bridgeAction: "CREATED" | "UNCHANGED" | "UPDATED" | null
): ExtractionRunRecord {
  return {
    attempt: 1,
    documentId,
    error:
      status === "FAILED"
        ? { code: "TEST_FAILURE", message: "Failed", stage: "validation" }
        : null,
    id: `run-${documentId}`,
    processingRunId: "00000000-0000-4000-8000-000000000201",
    resultSummary:
      bridgeAction === null
        ? null
        : {
            bridgeAction,
            componentsExtracted: 1,
            findingsExtracted: 3,
            historicalWorksExtracted: 1,
            inspectionsExtracted: 2,
            partialStructuresExtracted: 1,
            recommendationsExtracted: 1,
            trafficObservationsExtracted: 1
          },
    retryOfRunId: null,
    status
  };
}

function requireResponse(
  response: DocumentUploadResponse | undefined
): DocumentUploadResponse {
  if (response === undefined) {
    throw new Error("Missing test upload response.");
  }
  return response;
}

function unusedReparse(): Promise<DocumentUploadResponse> {
  throw new Error("reparse should not be called");
}
