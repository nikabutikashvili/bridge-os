import { createHash } from "node:crypto";

import type { DocumentUploadResponse } from "@bridge-os/contracts";

import { DocumentIngestionError } from "../documents/document-ingestion-error.js";
import type { DocumentService } from "../documents/document-service.js";
import { ExtractionPipelineError } from "../extraction/extraction-error.js";
import type { ExtractionRunRecord } from "../extraction/extraction-store.js";

export interface FixturePdf {
  readonly content: Uint8Array;
  readonly filename: string;
}

export interface FixtureFailure {
  readonly code: string;
  readonly documentId: string | null;
  readonly filename: string;
  readonly message: string;
  readonly stage: string;
}

export interface FixtureIngestionReport {
  readonly bridgesCreated: number;
  readonly bridgesUnchanged: number;
  readonly bridgesUpdated: number;
  readonly documentsIngested: number;
  readonly documentsSkippedByChecksum: number;
  readonly failures: readonly FixtureFailure[];
  readonly filesDiscovered: number;
  readonly findingsExtracted: number;
  readonly inspectionsExtracted: number;
  readonly recommendationsExtracted: number;
  readonly validationFailures: number;
}

export interface FixtureIngestionOptions {
  readonly expectedDocumentCount: number;
  readonly reextract: boolean;
  readonly reparse: boolean;
}

interface ExtractionRunner {
  abandonAndRetry(runId: string): Promise<ExtractionRunRecord>;
  extract(documentId: string): Promise<ExtractionRunRecord>;
  getLatestRunForDocument(documentId: string): Promise<ExtractionRunRecord | null>;
  reextract(documentId: string): Promise<ExtractionRunRecord>;
  retry(runId: string): Promise<ExtractionRunRecord>;
}

interface FixtureIngestionDependencies {
  readonly documents: Pick<DocumentService, "ingest" | "reparse">;
  readonly extraction: ExtractionRunner;
}

export class FixtureIngestionService {
  public constructor(private readonly dependencies: FixtureIngestionDependencies) {}

  public async ingest(
    files: readonly FixturePdf[],
    options: FixtureIngestionOptions
  ): Promise<FixtureIngestionReport> {
    const report = mutableReport(files.length);
    const validationFailures = validateFixtureSet(
      files,
      options.expectedDocumentCount
    );
    if (validationFailures.length > 0) {
      report.failures.push(...validationFailures);
      report.validationFailures += validationFailures.length;
      return report;
    }

    for (const file of [...files].sort((left, right) =>
      left.filename.localeCompare(right.filename, "de-DE")
    )) {
      let documentId: string | null = null;
      try {
        const upload = await this.dependencies.documents.ingest({
          content: file.content,
          filename: file.filename,
          mimeType: "application/pdf"
        });
        documentId = upload.data.id;
        let pagesReplaced = false;
        if (upload.duplicate) {
          report.documentsSkippedByChecksum += 1;
          if (options.reparse) {
            await this.dependencies.documents.reparse(upload.data.id);
            pagesReplaced = true;
          }
        } else {
          report.documentsIngested += 1;
        }
        await this.processExtraction(
          upload,
          options.reextract,
          pagesReplaced,
          report
        );
      } catch (error) {
        const failure = normalizeFailure(file.filename, documentId, error);
        report.failures.push(failure);
        if (failure.stage === "validation") {
          report.validationFailures += 1;
        }
      }
    }

    return report;
  }

  private async processExtraction(
    upload: DocumentUploadResponse,
    reextract: boolean,
    pagesReplaced: boolean,
    report: MutableFixtureIngestionReport
  ): Promise<void> {
    const processing = upload.data.processing;
    if (processing?.status === "FAILED" && !pagesReplaced) {
      throw new DocumentIngestionError({
        code: "DOCUMENT_PARSING_FAILED",
        details: { documentId: upload.data.id },
        message: processing.error?.message ?? "The existing document parsing run failed.",
        statusCode: 422
      });
    }
    const latest = await this.dependencies.extraction.getLatestRunForDocument(
      upload.data.id
    );
    let completed: ExtractionRunRecord | null = null;
    if (latest?.status === "FAILED") {
      completed = await this.dependencies.extraction.retry(latest.id);
    } else if (latest !== null && latest.status !== "SUCCEEDED") {
      completed = await this.dependencies.extraction.abandonAndRetry(latest.id);
    } else if (latest?.status === "SUCCEEDED") {
      if (pagesReplaced) {
        completed = await this.dependencies.extraction.extract(upload.data.id);
      } else if (reextract) {
        completed = await this.dependencies.extraction.reextract(upload.data.id);
      } else {
        completed = null;
      }
    } else if (latest === null) {
      completed = await this.dependencies.extraction.extract(upload.data.id);
    } else {
      throw new ExtractionPipelineError({
        code: "EXTRACTION_ALREADY_RUNNING",
        message: `Latest extraction run is ${latest.status.toLowerCase()}; rerun after it finishes.`,
        runId: latest.id,
        stage: "setup"
      });
    }

    if (completed?.status !== "SUCCEEDED" || completed.resultSummary === null) {
      return;
    }
    const summary = completed.resultSummary;
    if (summary.bridgeAction === "CREATED") {
      report.bridgesCreated += 1;
    } else if (summary.bridgeAction === "UPDATED") {
      report.bridgesUpdated += 1;
    } else {
      report.bridgesUnchanged += 1;
    }
    report.inspectionsExtracted += summary.inspectionsExtracted;
    report.findingsExtracted += summary.findingsExtracted;
    report.recommendationsExtracted += summary.recommendationsExtracted;
  }
}

interface MutableFixtureIngestionReport {
  bridgesCreated: number;
  bridgesUnchanged: number;
  bridgesUpdated: number;
  documentsIngested: number;
  documentsSkippedByChecksum: number;
  failures: FixtureFailure[];
  filesDiscovered: number;
  findingsExtracted: number;
  inspectionsExtracted: number;
  recommendationsExtracted: number;
  validationFailures: number;
}

function mutableReport(filesDiscovered: number): MutableFixtureIngestionReport {
  return {
    bridgesCreated: 0,
    bridgesUnchanged: 0,
    bridgesUpdated: 0,
    documentsIngested: 0,
    documentsSkippedByChecksum: 0,
    failures: [],
    filesDiscovered,
    findingsExtracted: 0,
    inspectionsExtracted: 0,
    recommendationsExtracted: 0,
    validationFailures: 0
  };
}

function validateFixtureSet(
  files: readonly FixturePdf[],
  expectedDocumentCount: number
): FixtureFailure[] {
  const failures: FixtureFailure[] = [];
  if (files.length !== expectedDocumentCount) {
    failures.push({
      code: "FIXTURE_COUNT_MISMATCH",
      documentId: null,
      filename: "<fixture-directory>",
      message: `Expected ${String(expectedDocumentCount)} PDFs but found ${String(files.length)}.`,
      stage: "validation"
    });
  }
  const filesByChecksum = new Map<string, string[]>();
  for (const file of files) {
    const checksum = createHash("sha256").update(file.content).digest("hex");
    const names = filesByChecksum.get(checksum) ?? [];
    names.push(file.filename);
    filesByChecksum.set(checksum, names);
  }
  for (const names of filesByChecksum.values()) {
    if (names.length > 1) {
      failures.push({
        code: "DUPLICATE_FIXTURE_CHECKSUM",
        documentId: null,
        filename: names.sort().join(", "),
        message: "Multiple fixture files have identical content.",
        stage: "validation"
      });
    }
  }
  return failures;
}

function normalizeFailure(
  filename: string,
  documentId: string | null,
  error: unknown
): FixtureFailure {
  if (error instanceof ExtractionPipelineError) {
    return {
      code: error.code,
      documentId,
      filename,
      message: error.message,
      stage: error.stage
    };
  }
  if (error instanceof DocumentIngestionError) {
    const failedDocumentId = error.details?.["documentId"];
    return {
      code: error.code,
      documentId:
        documentId ??
        (typeof failedDocumentId === "string" ? failedDocumentId : null),
      filename,
      message: error.message,
      stage: error.code.includes("PARSING") ? "parsing" : "ingestion"
    };
  }
  return {
    code: "FIXTURE_INGESTION_FAILED",
    documentId,
    filename,
    message: error instanceof Error ? error.message : "Unknown fixture ingestion error.",
    stage: "ingestion"
  };
}

export type { ExtractionRunner, FixtureIngestionDependencies };
