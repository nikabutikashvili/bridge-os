import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type {
  StructuredModelClient,
  StructuredModelRequest,
  StructuredModelResult
} from "./structured-model-client.js";

export interface OpenAiStructuredModelClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly maxOutputTokens: number;
  readonly model: string;
}

export class OpenAiStructuredModelClient implements StructuredModelClient {
  public readonly provider = "openai";
  public readonly model: string;
  private readonly client: OpenAI;
  private readonly maxOutputTokens: number;

  public constructor(options: OpenAiStructuredModelClientOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      ...(options.baseUrl === undefined ? {} : { baseURL: options.baseUrl })
    });
    this.maxOutputTokens = options.maxOutputTokens;
    this.model = options.model;
  }

  public async generateStructured<TOutput>(
    request: StructuredModelRequest<TOutput>
  ): Promise<StructuredModelResult<TOutput>> {
    const input =
      request.images.length === 0
        ? request.userPrompt
        : [
            {
              role: "user" as const,
              content: [
                { type: "input_text" as const, text: request.userPrompt },
                ...request.images.map((image) => ({
                  type: "input_image" as const,
                  detail: "high" as const,
                  image_url: image.dataUrl
                }))
              ]
            }
          ];
    const response = await this.client.responses.parse({
      input,
      instructions: request.systemPrompt,
      max_output_tokens: this.maxOutputTokens,
      model: this.model,
      store: false,
      temperature: request.temperature,
      text: {
        format: zodTextFormat(request.outputSchema, request.outputName)
      }
    });
    if (response.output_parsed === null) {
      const reason = response.incomplete_details?.reason;
      throw new Error(
        reason === undefined || reason.length === 0
          ? "The model response did not contain a parsed structured output."
          : `The model response did not contain a parsed structured output (${reason}).`
      );
    }
    return {
      output: response.output_parsed,
      providerRequestId: response.id,
      usage:
        response.usage === undefined
          ? null
          : {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens
            }
    };
  }
}
