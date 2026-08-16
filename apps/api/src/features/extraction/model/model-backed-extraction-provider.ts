import type { ExtractionModelMetadata } from "@bridge-os/contracts";
import type { ZodType } from "zod";

import type {
  ExtractionProvider,
  ExtractionProviderResult,
  PageClassificationRequest,
  SectionExtractionRequest
} from "../extraction-provider.js";
import {
  buildPageClassifierUserPrompt,
  pageClassifierDefinition
} from "./extractors/page-classifier.js";
import {
  bridgeGeometryExtractor,
  bridgeIdentityExtractor
} from "./extractors/bridge.js";
import { findingsExtractor } from "./extractors/findings.js";
import { historicalWorksExtractor } from "./extractors/historical-works.js";
import { modelBackedCategories } from "./extractors/index.js";
import { inspectionsExtractor } from "./extractors/inspections.js";
import { recommendationsExtractor } from "./extractors/recommendations.js";
import type { SectionExtractorInput } from "./extractors/shared.js";
import { trafficExtractor } from "./extractors/traffic.js";
import type { StructuredModelClient } from "./structured-model-client.js";
import {
  loadEligibleVisionImages,
  type VisionPageSource
} from "./vision-fallback.js";

export interface ModelBackedExtractionProviderOptions {
  readonly client: StructuredModelClient;
  readonly visionPageSource?: VisionPageSource;
}

export class ModelBackedExtractionProvider implements ExtractionProvider {
  public readonly model: string;
  public readonly provider: string;
  public readonly supportedCategories = modelBackedCategories;
  private readonly client: StructuredModelClient;
  private readonly visionPageSource: VisionPageSource | null;

  public constructor(options: ModelBackedExtractionProviderOptions) {
    this.client = options.client;
    this.model = options.client.model;
    this.provider = options.client.provider;
    this.visionPageSource = options.visionPageSource ?? null;
  }

  public async classifyPage(
    request: PageClassificationRequest
  ): Promise<ExtractionProviderResult> {
    requirePromptVersion(
      request.promptVersion,
      pageClassifierDefinition.promptVersion
    );
    const input = pageClassifierDefinition.inputSchema.parse({
      documentId: request.documentId,
      page: request.page
    });
    const result = await this.client.generateStructured({
      images: await loadEligibleVisionImages(
        request.documentId,
        [request.page],
        this.visionPageSource
      ),
      outputName: pageClassifierDefinition.outputName,
      outputSchema: pageClassifierDefinition.outputSchema,
      systemPrompt: pageClassifierDefinition.prompt,
      temperature: request.temperature,
      userPrompt: buildPageClassifierUserPrompt(input)
    });
    return { metadata: metadata(this.client, result), output: result.output };
  }

  public async extractSection(
    request: SectionExtractionRequest
  ): Promise<ExtractionProviderResult> {
    switch (request.category) {
      case "IDENTITY_OVERVIEW":
        return this.extractWith(request, bridgeIdentityExtractor);
      case "STRUCTURE_GEOMETRY":
        return this.extractWith(request, bridgeGeometryExtractor);
      case "INSPECTIONS":
        return this.extractWith(request, inspectionsExtractor);
      case "FINDINGS_DAMAGE":
        return this.extractWith(request, findingsExtractor);
      case "RECOMMENDATIONS":
        return this.extractWith(request, recommendationsExtractor);
      case "HISTORICAL_WORKS_COSTS":
        return this.extractWith(request, historicalWorksExtractor);
      case "TRAFFIC_NETWORK":
        return this.extractWith(request, trafficExtractor);
      case "COMPONENTS_MATERIALS":
        throw new Error("Component extraction is not enabled in this provider version.");
    }
  }

  private async extractWith<TInput extends SectionExtractorInput, TOutput>(
    request: SectionExtractionRequest,
    extractor: {
      readonly inputSchema: { parse(value: unknown): TInput };
      readonly outputName: string;
      readonly outputSchema: ZodType<TOutput>;
      readonly prompt: string;
      readonly promptVersion: string;
      readonly userPrompt: (input: TInput) => string;
    }
  ): Promise<ExtractionProviderResult> {
    requirePromptVersion(request.promptVersion, extractor.promptVersion);
    const input = extractor.inputSchema.parse({
      category: request.category,
      documentId: request.documentId,
      pages: request.pages,
      referenceContext: request.referenceContext
    });
    const result = await this.client.generateStructured({
      images: await loadEligibleVisionImages(
        request.documentId,
        request.pages,
        this.visionPageSource
      ),
      outputName: extractor.outputName,
      outputSchema: extractor.outputSchema,
      systemPrompt: extractor.prompt,
      temperature: request.temperature,
      userPrompt: extractor.userPrompt(input)
    });
    return { metadata: metadata(this.client, result), output: result.output };
  }
}

function requirePromptVersion(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Prompt version mismatch: expected ${expected}, received ${actual}.`);
  }
}

function metadata(
  client: StructuredModelClient,
  result: {
    readonly providerRequestId: string | null;
    readonly usage: {
      readonly inputTokens: number | null;
      readonly outputTokens: number | null;
    } | null;
  }
): ExtractionModelMetadata {
  return {
    model: client.model,
    provider: client.provider,
    providerRequestId: result.providerRequestId,
    usage:
      result.usage === null
        ? null
        : {
            costCurrency: null,
            estimatedCost: null,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens
          }
  };
}
