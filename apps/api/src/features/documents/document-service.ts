import type {
  DocumentDetailResponse,
  DocumentListResponse,
  DocumentPageResponse,
  DocumentUploadResponse
} from "@bridge-os/contracts";

export interface DocumentUpload {
  readonly content: Uint8Array;
  readonly filename: string;
  readonly mimeType: string;
}

export interface DocumentService {
  getDocument(id: string): Promise<DocumentDetailResponse | null>;
  getPage(id: string, pageNumber: number): Promise<DocumentPageResponse | null>;
  ingest(upload: DocumentUpload): Promise<DocumentUploadResponse>;
  listDocuments(): Promise<DocumentListResponse>;
  reparse(documentId: string): Promise<DocumentUploadResponse>;
}
