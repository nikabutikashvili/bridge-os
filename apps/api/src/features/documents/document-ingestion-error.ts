export type DocumentIngestionErrorCode =
  | "DOCUMENT_EMPTY"
  | "DOCUMENT_INVALID_MIME_TYPE"
  | "DOCUMENT_INVALID_PDF"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_NOT_REPARSABLE"
  | "DOCUMENT_PARSING_FAILED"
  | "DOCUMENT_PROCESSING_FAILED"
  | "DOCUMENT_STORAGE_FAILED"
  | "DOCUMENT_TOO_LARGE";

export interface DocumentIngestionErrorOptions {
  readonly cause?: unknown;
  readonly code: DocumentIngestionErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly message: string;
  readonly statusCode: number;
}

export class DocumentIngestionError extends Error {
  public readonly code: DocumentIngestionErrorCode;
  public readonly details: Readonly<Record<string, unknown>> | undefined;
  public readonly statusCode: number;

  public constructor(options: DocumentIngestionErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DocumentIngestionError";
    this.code = options.code;
    this.details = options.details;
    this.statusCode = options.statusCode;
  }
}
