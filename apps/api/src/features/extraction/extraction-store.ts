import type {
  ExtractionInvocationStage,
  ExtractionModelMetadata,
  ExtractionPageCategory,
  ExtractionRunStatus,
  PageClassificationOutput
} from "@bridge-os/contracts";
import type { ExtractionResultSummaryValue } from "@bridge-os/db";

import type { NormalizedExtractionBundle } from "./normalized-extraction.js";

export interface ExtractionDocumentPage {
  readonly pageNumber: number;
  readonly textContent: string;
  readonly textSource?: "PDF_TEXT" | "OCR";
}

export interface ExtractionDocumentContext {
  readonly documentId: string;
  readonly originalFilename?: string;
  readonly pages: readonly ExtractionDocumentPage[];
  readonly processingRunId: string;
  readonly processingStatus: "EXTRACTED" | "EXTRACTION_PENDING";
}

export interface ExtractionRunRecord {
  readonly attempt: number;
  readonly documentId: string;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly stage: string;
  } | null;
  readonly id: string;
  readonly processingRunId: string;
  readonly retryOfRunId: string | null;
  readonly resultSummary: ExtractionResultSummaryValue | null;
  readonly status: ExtractionRunStatus;
}

export interface ExtractionPersistenceResult {
  readonly bridgeId: string;
  readonly summary: ExtractionResultSummaryValue;
}

export interface CreateExtractionRunInput {
  readonly documentId: string;
  readonly model: string;
  readonly pipelineVersion: string;
  readonly processingRunId: string;
  readonly promptVersions: Readonly<Record<string, string>>;
  readonly provider: string;
  readonly retryOfRunId: string | null;
  readonly temperature: number;
}

export interface StartExtractionInvocationInput {
  readonly category: ExtractionPageCategory | null;
  readonly documentId: string;
  readonly model: string;
  readonly pageNumbers: readonly number[];
  readonly promptVersion: string;
  readonly provider: string;
  readonly runId: string;
  readonly stage: ExtractionInvocationStage;
}

export interface ExtractionFailureInput {
  readonly code: string;
  readonly message: string;
  readonly stage: string;
}

export interface ExtractionRunMetrics {
  readonly durationMs: number;
  readonly estimatedCost: string | null;
  readonly costCurrency: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface ExtractionStore {
  completeInvocation(
    invocationId: string,
    durationMs: number,
    metadata: ExtractionModelMetadata
  ): Promise<void>;
  createRun(input: CreateExtractionRunInput): Promise<ExtractionRunRecord>;
  failInvocation(
    invocationId: string,
    durationMs: number,
    failure: ExtractionFailureInput,
    metadata: ExtractionModelMetadata | null
  ): Promise<void>;
  failRun(
    runId: string,
    failure: ExtractionFailureInput,
    metrics: ExtractionRunMetrics
  ): Promise<void>;
  getDocumentContext(documentId: string): Promise<ExtractionDocumentContext | null>;
  getLatestRunForDocument(
    documentId: string
  ): Promise<ExtractionRunRecord | null>;
  getRun(runId: string): Promise<ExtractionRunRecord | null>;
  persistExtraction(
    runId: string,
    context: ExtractionDocumentContext,
    bundle: NormalizedExtractionBundle,
    metrics: ExtractionRunMetrics
  ): Promise<ExtractionPersistenceResult>;
  savePageClassification(
    runId: string,
    documentId: string,
    invocationId: string,
    pageNumber: number,
    classification: PageClassificationOutput
  ): Promise<void>;
  startInvocation(input: StartExtractionInvocationInput): Promise<string>;
  transitionRun(
    runId: string,
    expectedStatus: ExtractionRunStatus,
    nextStatus: ExtractionRunStatus
  ): Promise<void>;
}
