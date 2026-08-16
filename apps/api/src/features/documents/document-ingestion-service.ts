import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { performance } from "node:perf_hooks";

import {
  documentUploadResponseSchema,
  type DocumentDetailResponse,
  type DocumentListResponse,
  type DocumentPageResponse,
  type DocumentUploadResponse
} from "@bridge-os/contracts";

import {
  documentPhotoStorageKey,
  type DocumentCatalog,
  type DocumentPhotoRecord
} from "./document-catalog.js";
import { DocumentIngestionError } from "./document-ingestion-error.js";
import type { DocumentService, DocumentUpload } from "./document-service.js";
import type { DocumentStorage } from "./document-storage.js";
import type { ParsedPdf, PdfParser } from "./pdf-parser.js";

interface IngestionLogger {
  error(context: Readonly<Record<string, unknown>>, message: string): void;
  info(context: Readonly<Record<string, unknown>>, message: string): void;
}

export interface DocumentIngestionServiceOptions {
  readonly catalog: DocumentCatalog;
  readonly logger: IngestionLogger;
  readonly maxUploadBytes: number;
  readonly parser: PdfParser;
  readonly storage: DocumentStorage;
}

export class DocumentIngestionService implements DocumentService {
  public constructor(private readonly options: DocumentIngestionServiceOptions) {}

  public listDocuments(): Promise<DocumentListResponse> {
    return this.options.catalog.listDocuments();
  }

  public getDocument(id: string): Promise<DocumentDetailResponse | null> {
    return this.options.catalog.getDocument(id);
  }

  public getPage(
    id: string,
    pageNumber: number
  ): Promise<DocumentPageResponse | null> {
    return this.options.catalog.getPage(id, pageNumber);
  }

  public async ingest(upload: DocumentUpload): Promise<DocumentUploadResponse> {
    validateUpload(upload, this.options.maxUploadBytes);

    const startedAt = performance.now();
    const checksumSha256 = createHash("sha256").update(upload.content).digest("hex");
    const originalFilename = sanitizePdfFilename(upload.filename);
    const documentId = randomUUID();
    const processingRunId = randomUUID();
    const storageKey = `${documentId}/${originalFilename}`;
    const created = await this.options.catalog.createUpload({
      checksumSha256,
      documentId,
      mimeType: "application/pdf",
      originalFilename,
      processingRunId,
      sizeBytes: upload.content.byteLength,
      storageKey
    });

    if (!created.created) {
      this.options.logger.info(
        {
          checksumSha256,
          documentId: created.documentId,
          durationMs: elapsedMilliseconds(startedAt)
        },
        "Duplicate document upload resolved"
      );
      return documentUploadResponseSchema.parse({
        ...(await requireDocument(this.options.catalog, created.documentId)),
        duplicate: true
      });
    }

    try {
      await this.options.storage.put(storageKey, upload.content);
    } catch (error) {
      await this.recordFailure(documentId, processingRunId, {
        cause: error,
        code: "DOCUMENT_STORAGE_FAILED",
        message: errorMessage(error),
        parser: null
      });
      this.options.logger.error(
        {
          code: "DOCUMENT_STORAGE_FAILED",
          documentId,
          durationMs: elapsedMilliseconds(startedAt),
          err: error,
          phase: "storage"
        },
        "Document storage failed"
      );
      throw new DocumentIngestionError({
        cause: error,
        code: "DOCUMENT_STORAGE_FAILED",
        details: { documentId },
        message: "The document could not be stored.",
        statusCode: 500
      });
    }

    await this.parseAndPersist(
      documentId,
      processingRunId,
      upload.content,
      startedAt
    );
    return documentUploadResponseSchema.parse({
      ...(await requireDocument(this.options.catalog, documentId)),
      duplicate: false
    });
  }

  public async reparse(documentId: string): Promise<DocumentUploadResponse> {
    const startedAt = performance.now();
    const ingested = await this.options.catalog.getIngestedFile(documentId);
    if (ingested === null) {
      throw new DocumentIngestionError({
        code: "DOCUMENT_NOT_FOUND",
        details: { documentId },
        message: "Document not found.",
        statusCode: 404
      });
    }
    if (ingested.status === "PROCESSING" || ingested.status === "UPLOADED") {
      throw new DocumentIngestionError({
        code: "DOCUMENT_NOT_REPARSABLE",
        details: { documentId, status: ingested.status },
        message: "The document cannot be re-parsed while an ingest run is in progress.",
        statusCode: 409
      });
    }

    const processingRunId = randomUUID();
    try {
      await this.options.catalog.createProcessingRun(documentId, processingRunId);
    } catch (error) {
      throw new DocumentIngestionError({
        cause: error,
        code: "DOCUMENT_PROCESSING_FAILED",
        details: { documentId },
        message: "Document processing state could not be persisted.",
        statusCode: 500
      });
    }

    let content: Uint8Array;
    try {
      content = await this.options.storage.get(ingested.storageKey);
    } catch (error) {
      await this.recordFailure(documentId, processingRunId, {
        cause: error,
        code: "DOCUMENT_STORAGE_FAILED",
        message: errorMessage(error),
        parser: null
      });
      throw new DocumentIngestionError({
        cause: error,
        code: "DOCUMENT_STORAGE_FAILED",
        details: { documentId },
        message: "The stored PDF could not be read for re-parsing.",
        statusCode: 500
      });
    }

    await this.parseAndPersist(documentId, processingRunId, content, startedAt);
    return documentUploadResponseSchema.parse({
      ...(await requireDocument(this.options.catalog, documentId)),
      duplicate: true
    });
  }

  private async parseAndPersist(
    documentId: string,
    processingRunId: string,
    content: Uint8Array,
    startedAt: number
  ): Promise<void> {
    let phase: "parsing" | "persisting" | "starting" = "starting";
    try {
      await this.options.catalog.markParsing(
        documentId,
        processingRunId,
        this.options.parser.name
      );
      phase = "parsing";
      const parsed = await this.options.parser.parse(content);
      validateParsedPages(parsed.pages);
      phase = "persisting";
      const photo = await this.persistBridgePhoto(documentId, parsed.photo);
      await this.options.catalog.saveParsedPages(
        documentId,
        processingRunId,
        parsed.parser,
        parsed.pages,
        photo
      );
      await this.options.catalog.markExtractionPending(documentId, processingRunId);

      this.options.logger.info(
        {
          documentId,
          durationMs: elapsedMilliseconds(startedAt),
          ocrPageCount: parsed.pages.filter((page) => page.textSource === "OCR")
            .length,
          pageCount: parsed.pages.length,
          parser: parsed.parser,
          photoPageNumber: parsed.photo?.pageNumber ?? null
        },
        "Document parsed"
      );
    } catch (error) {
      const code =
        phase === "parsing"
          ? "DOCUMENT_PARSING_FAILED"
          : "DOCUMENT_PROCESSING_FAILED";
      await this.recordFailure(documentId, processingRunId, {
        cause: error,
        code,
        message: errorMessage(error),
        parser: this.options.parser.name
      });
      this.options.logger.error(
        {
          code,
          documentId,
          durationMs: elapsedMilliseconds(startedAt),
          err: error,
          phase
        },
        "Document processing failed"
      );
      throw new DocumentIngestionError({
        cause: error,
        code,
        details: { documentId },
        message:
          phase === "parsing"
            ? "The uploaded PDF could not be parsed."
            : "Document processing state could not be persisted.",
        statusCode: phase === "parsing" ? 422 : 500
      });
    }
  }

  private async persistBridgePhoto(
    documentId: string,
    photo: ParsedPdf["photo"]
  ): Promise<DocumentPhotoRecord | null> {
    const storageKey = documentPhotoStorageKey(documentId);
    if (photo === null) {
      await this.options.storage.delete(storageKey);
      return null;
    }

    await this.options.storage.put(storageKey, photo.bytes);
    return {
      byteSize: photo.bytes.byteLength,
      mimeType: photo.mimeType,
      pageNumber: photo.pageNumber,
      storageKey
    };
  }

  private async recordFailure(
    documentId: string,
    processingRunId: string,
    failure: {
      readonly cause: unknown;
      readonly code:
        | "DOCUMENT_PARSING_FAILED"
        | "DOCUMENT_PROCESSING_FAILED"
        | "DOCUMENT_STORAGE_FAILED";
      readonly message: string;
      readonly parser: string | null;
    }
  ): Promise<void> {
    try {
      await this.options.catalog.markFailed(documentId, processingRunId, failure);
    } catch (persistenceError) {
      this.options.logger.error(
        {
          documentId,
          err: persistenceError,
          originalError: failure.cause,
          processingRunId
        },
        "Document failure state could not be persisted"
      );
      throw new AggregateError(
        [failure.cause, persistenceError],
        "Document processing and failure-state persistence both failed."
      );
    }
  }
}

export function sanitizePdfFilename(filename: string): string {
  const leaf = basename(filename.replaceAll("\\", "/"));
  const normalizedStem = leaf
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\.pdf$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 176);
  const stem = normalizedStem || "bauwerksbuch";
  return `${stem}.pdf`;
}

function validateUpload(upload: DocumentUpload, maxUploadBytes: number): void {
  if (upload.mimeType.toLowerCase() !== "application/pdf") {
    throw new DocumentIngestionError({
      code: "DOCUMENT_INVALID_MIME_TYPE",
      message: "Only application/pdf uploads are accepted.",
      statusCode: 415
    });
  }
  if (upload.content.byteLength === 0) {
    throw new DocumentIngestionError({
      code: "DOCUMENT_EMPTY",
      message: "The uploaded PDF is empty.",
      statusCode: 400
    });
  }
  if (upload.content.byteLength > maxUploadBytes) {
    throw new DocumentIngestionError({
      code: "DOCUMENT_TOO_LARGE",
      details: { maxUploadBytes },
      message: "The uploaded PDF exceeds the configured size limit.",
      statusCode: 413
    });
  }
  const header = new TextDecoder("ascii").decode(upload.content.slice(0, 1024));
  if (!header.includes("%PDF-")) {
    throw new DocumentIngestionError({
      code: "DOCUMENT_INVALID_PDF",
      message: "The uploaded file does not have a valid PDF signature.",
      statusCode: 400
    });
  }
}

function validateParsedPages(
  pages: readonly { readonly pageNumber: number; readonly textContent: string }[]
): void {
  if (pages.length === 0) {
    throw new Error("The PDF parser returned no pages.");
  }
  for (const [index, page] of pages.entries()) {
    if (page.pageNumber !== index + 1) {
      throw new Error("The PDF parser returned non-sequential page numbers.");
    }
  }
}

async function requireDocument(
  catalog: DocumentCatalog,
  documentId: string
): Promise<DocumentDetailResponse> {
  const document = await catalog.getDocument(documentId);
  if (document === null) {
    throw new Error("Persisted document could not be read.");
  }
  return document;
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown processing error";
  return message.slice(0, 2_000);
}
