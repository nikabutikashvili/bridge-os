import type {
  DocumentDetailResponse,
  DocumentListResponse,
  DocumentPageResponse,
  DocumentStatus
} from "@bridge-os/contracts";

import type { ParsedPdfPage } from "./pdf-parser.js";

export function documentPhotoStorageKey(documentId: string): string {
  return `${documentId}/bridge-photo.jpg`;
}

export interface CreateDocumentUploadInput {
  readonly checksumSha256: string;
  readonly documentId: string;
  readonly mimeType: "application/pdf";
  readonly originalFilename: string;
  readonly processingRunId: string;
  readonly sizeBytes: number;
  readonly storageKey: string;
}

export type CreateDocumentUploadResult =
  | { readonly created: true; readonly documentId: string; readonly processingRunId: string }
  | { readonly created: false; readonly documentId: string };

export interface ProcessingFailure {
  readonly code: string;
  readonly message: string;
  readonly parser: string | null;
}

export interface DocumentPhotoRecord {
  readonly byteSize: number;
  readonly mimeType: "image/jpeg";
  readonly pageNumber: number;
  readonly storageKey: string;
}

export interface IngestedDocumentFile {
  readonly documentId: string;
  readonly status: DocumentStatus;
  readonly storageKey: string;
}

export interface DocumentCatalog {
  createProcessingRun(documentId: string, processingRunId: string): Promise<void>;
  createUpload(input: CreateDocumentUploadInput): Promise<CreateDocumentUploadResult>;
  getDocument(id: string): Promise<DocumentDetailResponse | null>;
  getIngestedFile(documentId: string): Promise<IngestedDocumentFile | null>;
  getPage(id: string, pageNumber: number): Promise<DocumentPageResponse | null>;
  listDocuments(): Promise<DocumentListResponse>;
  markExtractionPending(documentId: string, processingRunId: string): Promise<void>;
  markFailed(
    documentId: string,
    processingRunId: string,
    failure: ProcessingFailure
  ): Promise<void>;
  markParsing(
    documentId: string,
    processingRunId: string,
    parser: string
  ): Promise<void>;
  saveParsedPages(
    documentId: string,
    processingRunId: string,
    parser: string,
    pages: readonly ParsedPdfPage[],
    photo?: DocumentPhotoRecord | null
  ): Promise<void>;
}
