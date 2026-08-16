import type {
  ExtractablePageCategory,
  ExtractionModelMetadata
} from "@bridge-os/contracts";

export interface ExtractionPageInput {
  readonly pageNumber: number;
  readonly textContent: string;
}

export interface ExtractionReferenceContext {
  readonly findings: readonly {
    readonly sourceIdentifier: string | null;
    readonly sourceKey: string;
  }[];
  readonly inspections: readonly {
    readonly inspectedOn: string | number | null;
    readonly partialStructureRef: string;
    readonly sourceKey: string;
    readonly type: string | null;
  }[];
  readonly partialStructures: readonly {
    readonly externalNumber: string | null;
    readonly name: string | null;
    readonly sourceKey: string;
  }[];
}

export interface ExtractionPolicy {
  readonly allowEngineeringConclusions: false;
  readonly preserveMissingValues: true;
  readonly requireSourceEvidence: true;
}

export interface PageClassificationRequest {
  readonly documentId: string;
  readonly page: ExtractionPageInput;
  readonly policy: ExtractionPolicy;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly temperature: number;
}

export interface SectionExtractionRequest {
  readonly category: ExtractablePageCategory;
  readonly documentId: string;
  readonly pages: readonly ExtractionPageInput[];
  readonly policy: ExtractionPolicy;
  readonly promptVersion: string;
  readonly referenceContext: ExtractionReferenceContext;
  readonly schemaVersion: string;
  readonly temperature: number;
}

export interface ExtractionProviderResult {
  readonly metadata: ExtractionModelMetadata;
  readonly output: unknown;
}

export interface ExtractionProvider {
  readonly model: string;
  readonly provider: string;
  readonly supportedCategories: ReadonlySet<ExtractablePageCategory>;
  classifyPage(request: PageClassificationRequest): Promise<ExtractionProviderResult>;
  extractSection(request: SectionExtractionRequest): Promise<ExtractionProviderResult>;
}
