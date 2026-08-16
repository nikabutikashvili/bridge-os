import {
  documentExtractionInvocations,
  documentExtractionRuns,
  documentPageClassifications,
  documentPages,
  documentProcessingRuns,
  documents,
  type BridgeDatabase
} from "@bridge-os/db";
import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";

import type {
  CreateExtractionRunInput,
  ExtractionDocumentContext,
  ExtractionFailureInput,
  ExtractionPersistenceResult,
  ExtractionRunMetrics,
  ExtractionRunRecord,
  ExtractionStore,
  StartExtractionInvocationInput
} from "./extraction-store.js";
import type {
  ExtractionModelMetadata,
  ExtractionRunStatus,
  PageClassificationOutput
} from "@bridge-os/contracts";
import type { NormalizedExtractionBundle } from "./normalized-extraction.js";
import { persistNormalizedExtraction } from "./postgres-extraction-persistence.js";

type ExtractionRunRow = typeof documentExtractionRuns.$inferSelect;

export class PostgresExtractionStore implements ExtractionStore {
  public constructor(private readonly database: BridgeDatabase) {}

  public async getDocumentContext(
    documentId: string
  ): Promise<ExtractionDocumentContext | null> {
    const [document] = await this.database
      .select({ id: documents.id, originalFilename: documents.originalFilename })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (document === undefined) {
      return null;
    }
    const [processingRun] = await this.database
      .select({
        id: documentProcessingRuns.id,
        pageCount: documentProcessingRuns.pageCount,
        status: documentProcessingRuns.status
      })
      .from(documentProcessingRuns)
      .where(
        and(
          eq(documentProcessingRuns.documentId, documentId),
          inArray(documentProcessingRuns.status, [
            "EXTRACTION_PENDING",
            "EXTRACTED"
          ])
        )
      )
      .orderBy(desc(documentProcessingRuns.createdAt), desc(documentProcessingRuns.id))
      .limit(1);
    if (
      processingRun?.pageCount == null ||
      (processingRun.status !== "EXTRACTION_PENDING" &&
        processingRun.status !== "EXTRACTED")
    ) {
      return null;
    }
    const pages = await this.database
      .select({
        pageNumber: documentPages.pageNumber,
        textContent: documentPages.textContent,
        textSource: documentPages.textSource
      })
      .from(documentPages)
      .where(eq(documentPages.documentId, documentId))
      .orderBy(asc(documentPages.pageNumber));
    if (pages.length === 0 || pages.length !== processingRun.pageCount) {
      return null;
    }
    return {
      documentId,
      originalFilename: document.originalFilename,
      processingRunId: processingRun.id,
      processingStatus: processingRun.status,
      pages
    };
  }

  public async createRun(
    input: CreateExtractionRunInput
  ): Promise<ExtractionRunRecord> {
    return this.database.transaction(async (transaction) => {
      const lockedDocument = await transaction.execute<{ id: string }>(sql`
        select ${documents.id} as id
        from ${documents}
        where ${documents.id} = ${input.documentId}
        for update
      `);
      if (lockedDocument.rows.length !== 1) {
        throw new Error("Extraction document no longer exists.");
      }
      const [processingRun] = await transaction
        .select({ id: documentProcessingRuns.id })
        .from(documentProcessingRuns)
        .where(
          and(
            eq(documentProcessingRuns.id, input.processingRunId),
            eq(documentProcessingRuns.documentId, input.documentId),
            inArray(documentProcessingRuns.status, [
              "EXTRACTION_PENDING",
              "EXTRACTED"
            ])
          )
        )
        .limit(1);
      if (processingRun === undefined) {
        throw new Error("Document parsing run is not ready for extraction.");
      }

      if (input.retryOfRunId !== null) {
        const [retryRun] = await transaction
          .select({ id: documentExtractionRuns.id })
          .from(documentExtractionRuns)
          .where(
            and(
              eq(documentExtractionRuns.id, input.retryOfRunId),
              eq(documentExtractionRuns.documentId, input.documentId),
              eq(documentExtractionRuns.status, "FAILED")
            )
          )
          .limit(1);
        if (retryRun === undefined) {
          throw new Error("Retry source must be a failed run for this document.");
        }
      }

      const [attemptResult] = await transaction
        .select({ maximum: max(documentExtractionRuns.attempt) })
        .from(documentExtractionRuns)
        .where(eq(documentExtractionRuns.documentId, input.documentId));
      const attempt = (attemptResult?.maximum ?? 0) + 1;
      const [created] = await transaction
        .insert(documentExtractionRuns)
        .values({
          attempt,
          documentId: input.documentId,
          model: input.model,
          pipelineVersion: input.pipelineVersion,
          processingRunId: input.processingRunId,
          promptVersions: { ...input.promptVersions },
          provider: input.provider,
          retryOfRunId: input.retryOfRunId,
          status: "PENDING",
          temperature: input.temperature.toFixed(2)
        })
        .returning();
      if (created === undefined) {
        throw new Error("Extraction run was not created.");
      }
      return mapRun(created);
    });
  }

  public async getRun(runId: string): Promise<ExtractionRunRecord | null> {
    const [run] = await this.database
      .select()
      .from(documentExtractionRuns)
      .where(eq(documentExtractionRuns.id, runId))
      .limit(1);
    return run === undefined ? null : mapRun(run);
  }

  public async getLatestRunForDocument(
    documentId: string
  ): Promise<ExtractionRunRecord | null> {
    const [run] = await this.database
      .select()
      .from(documentExtractionRuns)
      .where(eq(documentExtractionRuns.documentId, documentId))
      .orderBy(desc(documentExtractionRuns.attempt), desc(documentExtractionRuns.id))
      .limit(1);
    return run === undefined ? null : mapRun(run);
  }

  public async transitionRun(
    runId: string,
    expectedStatus: ExtractionRunStatus,
    nextStatus: ExtractionRunStatus
  ): Promise<void> {
    const now = new Date();
    const updated = await this.database
      .update(documentExtractionRuns)
      .set({
        status: nextStatus,
        updatedAt: now,
        ...(expectedStatus === "PENDING" ? { startedAt: now } : {})
      })
      .where(
        and(
          eq(documentExtractionRuns.id, runId),
          eq(documentExtractionRuns.status, expectedStatus)
        )
      )
      .returning({ id: documentExtractionRuns.id });
    requireSingleUpdate(updated, "extraction run");
  }

  public async startInvocation(
    input: StartExtractionInvocationInput
  ): Promise<string> {
    const [invocation] = await this.database
      .insert(documentExtractionInvocations)
      .values({
        category: input.category,
        documentId: input.documentId,
        model: input.model,
        pageNumbers: [...input.pageNumbers],
        promptVersion: input.promptVersion,
        provider: input.provider,
        runId: input.runId,
        stage: input.stage,
        startedAt: new Date(),
        status: "RUNNING"
      })
      .returning({ id: documentExtractionInvocations.id });
    if (invocation === undefined) {
      throw new Error("Extraction invocation was not created.");
    }
    return invocation.id;
  }

  public async completeInvocation(
    invocationId: string,
    durationMs: number,
    metadata: ExtractionModelMetadata
  ): Promise<void> {
    const updated = await this.database
      .update(documentExtractionInvocations)
      .set({
        completedAt: new Date(),
        costCurrency: metadata.usage?.costCurrency ?? null,
        durationMs,
        estimatedCost: metadata.usage?.estimatedCost ?? null,
        inputTokens: metadata.usage?.inputTokens ?? null,
        outputTokens: metadata.usage?.outputTokens ?? null,
        providerRequestId: metadata.providerRequestId,
        status: "SUCCEEDED",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(documentExtractionInvocations.id, invocationId),
          eq(documentExtractionInvocations.status, "RUNNING")
        )
      )
      .returning({ id: documentExtractionInvocations.id });
    requireSingleUpdate(updated, "extraction invocation");
  }

  public async failInvocation(
    invocationId: string,
    durationMs: number,
    failure: ExtractionFailureInput,
    metadata: ExtractionModelMetadata | null
  ): Promise<void> {
    const updated = await this.database
      .update(documentExtractionInvocations)
      .set({
        completedAt: new Date(),
        costCurrency: metadata?.usage?.costCurrency ?? null,
        durationMs,
        errorCode: failure.code,
        errorMessage: failure.message,
        estimatedCost: metadata?.usage?.estimatedCost ?? null,
        inputTokens: metadata?.usage?.inputTokens ?? null,
        outputTokens: metadata?.usage?.outputTokens ?? null,
        providerRequestId: metadata?.providerRequestId ?? null,
        status: "FAILED",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(documentExtractionInvocations.id, invocationId),
          eq(documentExtractionInvocations.status, "RUNNING")
        )
      )
      .returning({ id: documentExtractionInvocations.id });
    requireSingleUpdate(updated, "extraction invocation");
  }

  public async savePageClassification(
    runId: string,
    documentId: string,
    invocationId: string,
    pageNumber: number,
    classification: PageClassificationOutput
  ): Promise<void> {
    await this.database.insert(documentPageClassifications).values(
      classification.categories.map((item) => ({
        category: item.category,
        confidence: item.confidence.toFixed(3),
        documentId,
        invocationId,
        pageNumber,
        runId,
        sectionTitle: classification.sectionTitle
      }))
    );
  }

  public async persistExtraction(
    runId: string,
    context: ExtractionDocumentContext,
    bundle: NormalizedExtractionBundle,
    metrics: ExtractionRunMetrics
  ): Promise<ExtractionPersistenceResult> {
    return this.database.transaction(async (transaction) => {
      const persisted = await persistNormalizedExtraction(
        transaction,
        runId,
        context,
        bundle
      );
      const now = new Date();
      const updatedRuns = await transaction
        .update(documentExtractionRuns)
        .set({
          completedAt: now,
          costCurrency: metrics.costCurrency,
          durationMs: metrics.durationMs,
          estimatedCost: metrics.estimatedCost,
          inputTokens: metrics.inputTokens,
          outputBridgeId: persisted.bridgeId,
          resultSummary: persisted.summary,
          outputTokens: metrics.outputTokens,
          status: "SUCCEEDED",
          updatedAt: now
        })
        .where(
          and(
            eq(documentExtractionRuns.id, runId),
            eq(documentExtractionRuns.documentId, context.documentId),
            eq(documentExtractionRuns.status, "PERSISTING")
          )
        )
        .returning({ id: documentExtractionRuns.id });
      requireSingleUpdate(updatedRuns, "extraction run");
      if (context.processingStatus === "EXTRACTION_PENDING") {
        const updatedProcessingRuns = await transaction
          .update(documentProcessingRuns)
          .set({ status: "EXTRACTED", updatedAt: now })
          .where(
            and(
              eq(documentProcessingRuns.id, context.processingRunId),
              eq(documentProcessingRuns.documentId, context.documentId),
              eq(documentProcessingRuns.status, "EXTRACTION_PENDING")
            )
          )
          .returning({ id: documentProcessingRuns.id });
        requireSingleUpdate(updatedProcessingRuns, "document processing run");
      }
      return persisted;
    });
  }

  public async failRun(
    runId: string,
    failure: ExtractionFailureInput,
    metrics: ExtractionRunMetrics
  ): Promise<void> {
    const now = new Date();
    const updated = await this.database
      .update(documentExtractionRuns)
      .set({
        completedAt: now,
        costCurrency: metrics.costCurrency,
        durationMs: metrics.durationMs,
        errorCode: failure.code,
        errorMessage: failure.message,
        errorStage: failure.stage,
        estimatedCost: metrics.estimatedCost,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        startedAt: sql`coalesce(${documentExtractionRuns.startedAt}, ${now})`,
        status: "FAILED",
        updatedAt: now
      })
      .where(
        and(
          eq(documentExtractionRuns.id, runId),
          inArray(documentExtractionRuns.status, [
            "PENDING",
            "CLASSIFYING",
            "EXTRACTING",
            "VALIDATING",
            "PERSISTING"
          ])
        )
      )
      .returning({ id: documentExtractionRuns.id });
    requireSingleUpdate(updated, "extraction run");
  }
}

function mapRun(run: ExtractionRunRow): ExtractionRunRecord {
  return {
    attempt: run.attempt,
    documentId: run.documentId,
    error:
      run.errorCode === null ||
      run.errorMessage === null ||
      run.errorStage === null
        ? null
        : {
            code: run.errorCode,
            message: run.errorMessage,
            stage: run.errorStage
          },
    id: run.id,
    processingRunId: run.processingRunId,
    retryOfRunId: run.retryOfRunId,
    resultSummary: run.resultSummary,
    status: run.status
  };
}

function requireSingleUpdate(
  rows: readonly { readonly id: string }[],
  subject: string
): void {
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one ${subject} state transition.`);
  }
}
