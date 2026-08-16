export interface HttpErrorOptions {
  readonly code: string;
  readonly details?: unknown;
  readonly message: string;
  readonly statusCode: number;
}

export class HttpError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly statusCode: number;

  public constructor(options: HttpErrorOptions) {
    super(options.message);
    this.name = "HttpError";
    this.code = options.code;
    this.details = options.details;
    this.statusCode = options.statusCode;
  }
}

