import type { ZodType } from "zod";

export interface ModelImageInput {
  readonly dataUrl: string;
  readonly pageNumber: number;
}

export interface StructuredModelRequest<TOutput> {
  readonly images: readonly ModelImageInput[];
  readonly outputName: string;
  readonly outputSchema: ZodType<TOutput>;
  readonly systemPrompt: string;
  readonly temperature: number;
  readonly userPrompt: string;
}

export interface StructuredModelResult<TOutput> {
  readonly output: TOutput;
  readonly providerRequestId: string | null;
  readonly usage: {
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
  } | null;
}

export interface StructuredModelClient {
  readonly model: string;
  readonly provider: string;
  generateStructured<TOutput>(
    request: StructuredModelRequest<TOutput>
  ): Promise<StructuredModelResult<TOutput>>;
}
