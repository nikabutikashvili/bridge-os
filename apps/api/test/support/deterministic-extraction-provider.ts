import type { ExtractionModelMetadata } from "@bridge-os/contracts";
import { extractablePageCategorySchema } from "@bridge-os/contracts";

import type {
  ExtractionProvider,
  ExtractionProviderResult,
  PageClassificationRequest,
  SectionExtractionRequest
} from "../../src/features/extraction/extraction-provider.js";

export interface DeterministicExtractionProviderOptions {
  readonly classify: (request: PageClassificationRequest) => unknown;
  readonly extract: (request: SectionExtractionRequest) => unknown;
  readonly metadata?: ExtractionModelMetadata;
}

export class DeterministicExtractionProvider implements ExtractionProvider {
  public readonly classificationRequests: PageClassificationRequest[] = [];
  public readonly extractionRequests: SectionExtractionRequest[] = [];
  public readonly model: string;
  public readonly provider: string;
  public readonly supportedCategories = new Set(
    extractablePageCategorySchema.options
  );
  private readonly metadata: ExtractionModelMetadata;

  public constructor(private readonly options: DeterministicExtractionProviderOptions) {
    this.metadata = options.metadata ?? {
      model: "deterministic-fixture-v1",
      provider: "deterministic-test",
      providerRequestId: null,
      usage: {
        costCurrency: "EUR",
        estimatedCost: "0.000100",
        inputTokens: 10,
        outputTokens: 5
      }
    };
    this.model = this.metadata.model;
    this.provider = this.metadata.provider;
  }

  public classifyPage(
    request: PageClassificationRequest
  ): Promise<ExtractionProviderResult> {
    this.classificationRequests.push(request);
    return Promise.resolve({
      metadata: this.metadata,
      output: this.options.classify(request)
    });
  }

  public extractSection(
    request: SectionExtractionRequest
  ): Promise<ExtractionProviderResult> {
    this.extractionRequests.push(request);
    return Promise.resolve({
      metadata: this.metadata,
      output: this.options.extract(request)
    });
  }
}
