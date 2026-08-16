export class ExtractionPipelineError extends Error {
  public readonly code: string;
  public readonly runId: string | null;
  public readonly stage: string;

  public constructor(options: {
    readonly cause?: unknown;
    readonly code: string;
    readonly message: string;
    readonly runId?: string;
    readonly stage: string;
  }) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ExtractionPipelineError";
    this.code = options.code;
    this.runId = options.runId ?? null;
    this.stage = options.stage;
  }
}
