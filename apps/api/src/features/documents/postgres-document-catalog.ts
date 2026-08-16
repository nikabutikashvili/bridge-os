import {
  documentDetailResponseSchema,
  documentListResponseSchema,
  documentPageResponseSchema,
  type DocumentDetailResponse,
  type DocumentListResponse,
  type DocumentPageResponse,
  type DocumentProcessingStatus
} from "@bridge-os/contracts";
import {
  type BridgeDatabase,
  documentPages,
  documentProcessingRuns,
  documents
} from "@bridge-os/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type {
  CreateDocumentUploadInput,
  CreateDocumentUploadResult,
  DocumentCatalog,
  DocumentPhotoRecord,
  IngestedDocumentFile,
  ProcessingFailure
} from "./document-catalog.js";
import { pageTextSource } from "./page-text.js";
import type { ParsedPdfPage } from "./pdf-parser.js";

type DocumentRow = typeof documents.$inferSelect;
type ProcessingRunRow = typeof documentProcessingRuns.$inferSelect;

export class PostgresDocumentCatalog implements DocumentCatalog {
  public constructor(private readonly database: BridgeDatabase) {}

  public async createUpload(
    input: CreateDocumentUploadInput
  ): Promise<CreateDocumentUploadResult> {
    const created = await this.database.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(documents)
        .values({
          id: input.documentId,
          type: "BAUWERKSBUCH",
          originalFilename: input.originalFilename,
          status: "UPLOADED",
          checksumSha256: input.checksumSha256,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          metadata: {
            extractionPerformed: false,
            sourceMode: "DOCUMENT_UPLOAD"
          }
        })
        .onConflictDoNothing()
        .returning({ id: documents.id });

      if (inserted.length === 0) {
        return false;
      }

      await transaction.insert(documentProcessingRuns).values({
        id: input.processingRunId,
        documentId: input.documentId,
        status: "UPLOADED"
      });
      return true;
    });

    if (created) {
      return {
        created: true,
        documentId: input.documentId,
        processingRunId: input.processingRunId
      };
    }

    const [duplicate] = await this.database
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.checksumSha256, input.checksumSha256))
      .limit(1);
    if (duplicate === undefined) {
      throw new Error("Document checksum conflict could not be resolved.");
    }
    return { created: false, documentId: duplicate.id };
  }

  public async getIngestedFile(
    documentId: string
  ): Promise<IngestedDocumentFile | null> {
    const [document] = await this.database
      .select({
        id: documents.id,
        status: documents.status,
        storageKey: documents.storageKey
      })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (document?.storageKey == null) {
      return null;
    }
    return {
      documentId: document.id,
      status: document.status,
      storageKey: document.storageKey
    };
  }

  public async createProcessingRun(
    documentId: string,
    processingRunId: string
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const updatedDocuments = await transaction
        .update(documents)
        .set({ status: "PROCESSING", updatedAt: new Date() })
        .where(
          and(
            eq(documents.id, documentId),
            inArray(documents.status, ["READY", "FAILED"])
          )
        )
        .returning({ id: documents.id });
      requireSingleUpdate(updatedDocuments, "document");
      await transaction.insert(documentProcessingRuns).values({
        id: processingRunId,
        documentId,
        status: "UPLOADED"
      });
    });
  }

  public async listDocuments(): Promise<DocumentListResponse> {
    const documentRows = await this.database
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt), desc(documents.id));
    const processingByDocument = await this.getLatestProcessingRuns(
      documentRows.map((document) => document.id)
    );

    return documentListResponseSchema.parse({
      data: documentRows.map((document) =>
        mapDocumentSummary(document, processingByDocument.get(document.id) ?? null)
      ),
      total: documentRows.length
    });
  }

  public async getDocument(id: string): Promise<DocumentDetailResponse | null> {
    const [document] = await this.database
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (document === undefined) {
      return null;
    }

    const [processingRows, pageRows] = await Promise.all([
      this.database
        .select()
        .from(documentProcessingRuns)
        .where(eq(documentProcessingRuns.documentId, id))
        .orderBy(desc(documentProcessingRuns.createdAt), desc(documentProcessingRuns.id))
        .limit(1),
      this.database
        .select({ pageNumber: documentPages.pageNumber })
        .from(documentPages)
        .where(eq(documentPages.documentId, id))
        .orderBy(asc(documentPages.pageNumber))
    ]);

    return documentDetailResponseSchema.parse({
      data: {
        ...mapDocumentSummary(document, processingRows[0] ?? null),
        pages: {
          count: pageRows.length,
          pageNumbers: pageRows.map((page) => page.pageNumber)
        }
      }
    });
  }

  public async getPage(
    id: string,
    pageNumber: number
  ): Promise<DocumentPageResponse | null> {
    const [page] = await this.database
      .select()
      .from(documentPages)
      .where(
        and(
          eq(documentPages.documentId, id),
          eq(documentPages.pageNumber, pageNumber)
        )
      )
      .limit(1);
    if (page === undefined) {
      return null;
    }

    return documentPageResponseSchema.parse({
      data: {
        documentId: page.documentId,
        pageNumber: page.pageNumber,
        textContent: page.textContent,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString()
      }
    });
  }

  public async markParsing(
    documentId: string,
    processingRunId: string,
    parser: string
  ): Promise<void> {
    const now = new Date();
    await this.database.transaction(async (transaction) => {
      const updatedDocuments = await transaction
        .update(documents)
        .set({ status: "PROCESSING", updatedAt: now })
        .where(eq(documents.id, documentId))
        .returning({ id: documents.id });
      requireSingleUpdate(updatedDocuments, "document");
      const updatedRuns = await transaction
        .update(documentProcessingRuns)
        .set({
          status: "PARSING",
          parser,
          parsingStartedAt: now,
          updatedAt: now
        })
        .where(
          and(
            eq(documentProcessingRuns.id, processingRunId),
            eq(documentProcessingRuns.documentId, documentId)
          )
        )
        .returning({ id: documentProcessingRuns.id });
      requireSingleUpdate(updatedRuns, "processing run");
    });
  }

  public async saveParsedPages(
    documentId: string,
    processingRunId: string,
    parser: string,
    pages: readonly ParsedPdfPage[],
    photo: DocumentPhotoRecord | null = null
  ): Promise<void> {
    const now = new Date();
    await this.database.transaction(async (transaction) => {
      await transaction
        .delete(documentPages)
        .where(eq(documentPages.documentId, documentId));
      if (pages.length > 0) {
        await transaction.insert(documentPages).values(
          pages.map((page) => ({
            documentId,
            pageNumber: page.pageNumber,
            textContent: page.textContent,
            textSource: pageTextSource(page.textSource),
            createdAt: now,
            updatedAt: now
          }))
        );
      }
      const updatedDocuments = await transaction
        .update(documents)
        .set({
          photoStorageKey: photo?.storageKey ?? null,
          photoMimeType: photo?.mimeType ?? null,
          photoPageNumber: photo?.pageNumber ?? null,
          photoByteSize: photo?.byteSize ?? null,
          updatedAt: now
        })
        .where(eq(documents.id, documentId))
        .returning({ id: documents.id });
      requireSingleUpdate(updatedDocuments, "document");
      const updatedRuns = await transaction
        .update(documentProcessingRuns)
        .set({
          status: "PARSED",
          parser,
          pageCount: pages.length,
          parsingCompletedAt: now,
          updatedAt: now
        })
        .where(
          and(
            eq(documentProcessingRuns.id, processingRunId),
            eq(documentProcessingRuns.documentId, documentId)
          )
        )
        .returning({ id: documentProcessingRuns.id });
      requireSingleUpdate(updatedRuns, "processing run");
    });
  }

  public async markExtractionPending(
    documentId: string,
    processingRunId: string
  ): Promise<void> {
    const now = new Date();
    await this.database.transaction(async (transaction) => {
      const updatedRuns = await transaction
        .update(documentProcessingRuns)
        .set({ status: "EXTRACTION_PENDING", updatedAt: now })
        .where(
          and(
            eq(documentProcessingRuns.id, processingRunId),
            eq(documentProcessingRuns.documentId, documentId)
          )
        )
        .returning({ id: documentProcessingRuns.id });
      requireSingleUpdate(updatedRuns, "processing run");
      const updatedDocuments = await transaction
        .update(documents)
        .set({ status: "READY", updatedAt: now })
        .where(eq(documents.id, documentId))
        .returning({ id: documents.id });
      requireSingleUpdate(updatedDocuments, "document");
    });
  }

  public async markFailed(
    documentId: string,
    processingRunId: string,
    failure: ProcessingFailure
  ): Promise<void> {
    const now = new Date();
    await this.database.transaction(async (transaction) => {
      const updatedRuns = await transaction
        .update(documentProcessingRuns)
        .set({
          status: "FAILED",
          parser: failure.parser,
          errorCode: failure.code,
          errorMessage: failure.message,
          updatedAt: now
        })
        .where(
          and(
            eq(documentProcessingRuns.id, processingRunId),
            eq(documentProcessingRuns.documentId, documentId)
          )
        )
        .returning({ id: documentProcessingRuns.id });
      requireSingleUpdate(updatedRuns, "processing run");
      const updatedDocuments = await transaction
        .update(documents)
        .set({ status: "FAILED", updatedAt: now })
        .where(eq(documents.id, documentId))
        .returning({ id: documents.id });
      requireSingleUpdate(updatedDocuments, "document");
    });
  }

  private async getLatestProcessingRuns(
    documentIds: readonly string[]
  ): Promise<Map<string, ProcessingRunRow>> {
    if (documentIds.length === 0) {
      return new Map();
    }
    const rows = await this.database
      .select()
      .from(documentProcessingRuns)
      .where(inArray(documentProcessingRuns.documentId, [...documentIds]))
      .orderBy(
        desc(documentProcessingRuns.createdAt),
        desc(documentProcessingRuns.id)
      );
    const latest = new Map<string, ProcessingRunRow>();
    for (const row of rows) {
      if (!latest.has(row.documentId)) {
        latest.set(row.documentId, row);
      }
    }
    return latest;
  }
}

function mapDocumentSummary(
  document: DocumentRow,
  processing: ProcessingRunRow | null
): object {
  return {
    id: document.id,
    bridgeId: document.bridgeId,
    type: document.type,
    originalFilename: document.originalFilename,
    status: document.status,
    checksumSha256: document.checksumSha256,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    isDemoFixture: document.metadata?.["fixture"] === true,
    processing: processing === null ? null : mapProcessing(processing),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString()
  };
}

function mapProcessing(processing: ProcessingRunRow): object {
  return {
    id: processing.id,
    status: processing.status satisfies DocumentProcessingStatus,
    parser: processing.parser,
    pageCount: processing.pageCount,
    error:
      processing.errorCode === null || processing.errorMessage === null
        ? null
        : { code: processing.errorCode, message: processing.errorMessage },
    parsingStartedAt: processing.parsingStartedAt?.toISOString() ?? null,
    parsingCompletedAt: processing.parsingCompletedAt?.toISOString() ?? null,
    createdAt: processing.createdAt.toISOString(),
    updatedAt: processing.updatedAt.toISOString()
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
