import { performance } from "node:perf_hooks";

import {
  componentsMaterialsExtractionSchema,
  extractionModelMetadataSchema,
  findingsDamageExtractionSchema,
  historicalWorksCostsExtractionSchema,
  identityOverviewExtractionSchema,
  inspectionsExtractionSchema,
  pageClassificationOutputSchema,
  recommendationsExtractionSchema,
  structureGeometryExtractionSchema,
  trafficNetworkExtractionSchema,
  extractablePageCategorySchema,
  type ExtractablePageCategory,
  type ExtractionModelMetadata,
  type ExtractionPageCategory,
  type PageClassificationOutput,
  type SectionExtractionOutput
} from "@bridge-os/contracts";
import { ZodError, type ZodType } from "zod";

import { hasInsufficientPageText } from "../documents/page-text.js";
import { ExtractionPipelineError } from "./extraction-error.js";
import type {
  ExtractionPageInput,
  ExtractionProvider,
  ExtractionProviderResult,
  ExtractionReferenceContext
} from "./extraction-provider.js";
import type {
  ExtractionDocumentContext,
  ExtractionFailureInput,
  ExtractionRunMetrics,
  ExtractionRunRecord,
  ExtractionStore
} from "./extraction-store.js";
import { inferSection7Categories } from "./infer-section7.js";
import { assessVisionFallback } from "./model/vision-fallback.js";
import { normalizeExtractionOutputs } from "./normalize-extraction.js";
import {
  extractionPipelineConfig,
  extractionPolicy
} from "./pipeline-config.js";
import {
  emptySectionOutput,
  repairSectionOutput
} from "./repair-section-output.js";

const extractableCategories = [
  "IDENTITY_OVERVIEW",
  "STRUCTURE_GEOMETRY",
  "COMPONENTS_MATERIALS",
  "INSPECTIONS",
  "FINDINGS_DAMAGE",
  "RECOMMENDATIONS",
  "HISTORICAL_WORKS_COSTS",
  "TRAFFIC_NETWORK"
] as const satisfies readonly ExtractablePageCategory[];

interface ExtractionLogger {
  error(context: Readonly<Record<string, unknown>>, message: string): void;
  info(context: Readonly<Record<string, unknown>>, message: string): void;
}

export interface ExtractionPipelineServiceOptions {
  readonly logger: ExtractionLogger;
  readonly provider: ExtractionProvider;
  readonly store: ExtractionStore;
}

export class ExtractionPipelineService {
  public constructor(private readonly options: ExtractionPipelineServiceOptions) {}

  public async extract(documentId: string): Promise<ExtractionRunRecord> {
    return this.execute(documentId, null, "INITIAL");
  }

  public async reextract(documentId: string): Promise<ExtractionRunRecord> {
    return this.execute(documentId, null, "REEXTRACT");
  }

  public async retry(runId: string): Promise<ExtractionRunRecord> {
    const previous = await this.options.store.getRun(runId);
    if (previous === null) {
      throw new ExtractionPipelineError({
        code: "EXTRACTION_RUN_NOT_FOUND",
        message: "Extraction run not found.",
        stage: "retry"
      });
    }
    if (previous.status !== "FAILED") {
      throw new ExtractionPipelineError({
        code: "EXTRACTION_RUN_NOT_RETRYABLE",
        message: "Only failed extraction runs can be retried.",
        runId,
        stage: "retry"
      });
    }
    return this.execute(previous.documentId, previous.id, "RETRY");
  }

  public async abandonAndRetry(runId: string): Promise<ExtractionRunRecord> {
    const previous = await this.options.store.getRun(runId);
    if (previous === null) {
      throw new ExtractionPipelineError({
        code: "EXTRACTION_RUN_NOT_FOUND",
        message: "Extraction run not found.",
        stage: "retry"
      });
    }
    if (previous.status === "SUCCEEDED") {
      throw new ExtractionPipelineError({
        code: "EXTRACTION_RUN_NOT_RETRYABLE",
        message: "Only failed or in-progress extraction runs can be abandoned.",
        runId,
        stage: "retry"
      });
    }
    if (previous.status !== "FAILED") {
      await this.options.store.failRun(
        runId,
        {
          code: "EXTRACTION_ABANDONED",
          message:
            "A previous in-progress extraction was abandoned so a new attempt can start.",
          stage: previous.status.toLowerCase()
        },
        {
          costCurrency: null,
          durationMs: 0,
          estimatedCost: null,
          inputTokens: null,
          outputTokens: null
        }
      );
    }
    return this.execute(previous.documentId, previous.id, "RETRY");
  }

  public getRun(runId: string): Promise<ExtractionRunRecord | null> {
    return this.options.store.getRun(runId);
  }

  public getLatestRunForDocument(
    documentId: string
  ): Promise<ExtractionRunRecord | null> {
    return this.options.store.getLatestRunForDocument(documentId);
  }

  private async execute(
    documentId: string,
    retryOfRunId: string | null,
    mode: "INITIAL" | "REEXTRACT" | "RETRY"
  ): Promise<ExtractionRunRecord> {
    const context = await this.options.store.getDocumentContext(documentId);
    if (context === null) {
      throw new ExtractionPipelineError({
        code: "DOCUMENT_NOT_READY_FOR_EXTRACTION",
        message: "Document must have parsed pages before extraction can start.",
        stage: "setup"
      });
    }
    if (mode === "INITIAL" && context.processingStatus !== "EXTRACTION_PENDING") {
      throw new ExtractionPipelineError({
        code: "DOCUMENT_ALREADY_EXTRACTED",
        message: "A completed document requires an explicit re-extraction.",
        stage: "setup"
      });
    }
    if (mode === "REEXTRACT" && context.processingStatus !== "EXTRACTED") {
      throw new ExtractionPipelineError({
        code: "DOCUMENT_NOT_EXTRACTED",
        message: "Only a successfully extracted document can be re-extracted.",
        stage: "setup"
      });
    }

    const run = await this.options.store.createRun({
      documentId,
      processingRunId: context.processingRunId,
      retryOfRunId,
      pipelineVersion: extractionPipelineConfig.pipelineVersion,
      promptVersions: promptVersions(),
      provider: this.options.provider.provider,
      model: this.options.provider.model,
      temperature: extractionPipelineConfig.temperature
    });
    const metrics = new MetricsAccumulator();
    let stage = "classification";

    try {
      await this.options.store.transitionRun(run.id, "PENDING", "CLASSIFYING");
      const classifications = await this.classifyPages(run, context, metrics);

      stage = "section_extraction";
      await this.options.store.transitionRun(
        run.id,
        "CLASSIFYING",
        "EXTRACTING"
      );
      const outputs = await this.extractSections(
        run,
        context,
        classifications,
        metrics
      );

      stage = "validation";
      await this.options.store.transitionRun(
        run.id,
        "EXTRACTING",
        "VALIDATING"
      );
      const bundle = normalizeExtractionOutputs(outputs, {
        documentId: context.documentId,
        pages: context.pages,
        ...(context.originalFilename === undefined
          ? {}
          : { originalFilename: context.originalFilename })
      });

      stage = "persistence";
      await this.options.store.transitionRun(
        run.id,
        "VALIDATING",
        "PERSISTING"
      );
      const persisted = await this.options.store.persistExtraction(
        run.id,
        context,
        bundle,
        metrics.snapshot()
      );

      this.options.logger.info(
        {
          bridgeId: persisted.bridgeId,
          documentId,
          durationMs: metrics.durationMs,
          runId: run.id
        },
        "Document extraction completed"
      );
      return requireRun(await this.options.store.getRun(run.id), run.id);
    } catch (error) {
      const failure = normalizeFailure(error, stage);
      try {
        await this.options.store.failRun(run.id, failure, metrics.snapshot());
      } catch (failurePersistenceError) {
        this.options.logger.error(
          {
            documentId,
            err: failurePersistenceError,
            originalError: error,
            runId: run.id,
            stage
          },
          "Extraction failure state could not be persisted"
        );
        throw new AggregateError(
          [error, failurePersistenceError],
          "Extraction and failure-state persistence both failed."
        );
      }
      this.options.logger.error(
        {
          code: failure.code,
          documentId,
          durationMs: metrics.durationMs,
          err: error,
          runId: run.id,
          stage
        },
        "Document extraction failed"
      );
      throw new ExtractionPipelineError({
        cause: error,
        code: failure.code,
        message: failure.message,
        runId: run.id,
        stage: failure.stage
      });
    }
  }

  private async classifyPages(
    run: ExtractionRunRecord,
    context: ExtractionDocumentContext,
    metrics: MetricsAccumulator
  ): Promise<Map<ExtractionPageCategory, ExtractionPageInput[]>> {
    const classifiedPages = new Map<ExtractionPageCategory, ExtractionPageInput[]>();
    for (const page of context.pages) {
      const pageInput = { pageNumber: page.pageNumber, textContent: page.textContent };
      if (assessVisionFallback(pageInput).mode === "OCR_REQUIRED") {
        continue;
      }
      const invocationId = await this.options.store.startInvocation({
        category: null,
        documentId: context.documentId,
        model: this.options.provider.model,
        pageNumbers: [page.pageNumber],
        promptVersion: extractionPipelineConfig.classificationPromptVersion,
        provider: this.options.provider.provider,
        runId: run.id,
        stage: "PAGE_CLASSIFICATION"
      });
      const classification = boostPageClassification(
        pageInput,
        await this.invokeProvider(
          invocationId,
          "classification",
          metrics,
          () =>
            this.options.provider.classifyPage({
              documentId: context.documentId,
              page: pageInput,
              policy: extractionPolicy,
              promptVersion: extractionPipelineConfig.classificationPromptVersion,
              schemaVersion: extractionPipelineConfig.schemaVersion,
              temperature: extractionPipelineConfig.temperature
            }),
          pageClassificationOutputSchema
        )
      );
      await this.options.store.savePageClassification(
        run.id,
        context.documentId,
        invocationId,
        page.pageNumber,
        classification
      );
      for (const item of classification.categories) {
        const pages = classifiedPages.get(item.category) ?? [];
        pages.push(pageInput);
        classifiedPages.set(item.category, pages);
      }
    }
    return classifiedPages;
  }

  private async extractSections(
    run: ExtractionRunRecord,
    context: ExtractionDocumentContext,
    classifiedPages: ReadonlyMap<ExtractionPageCategory, ExtractionPageInput[]>,
    metrics: MetricsAccumulator
  ): Promise<SectionExtractionOutput[]> {
    const outputs: SectionExtractionOutput[] = [];
    for (const category of extractableCategories) {
      if (!this.options.provider.supportedCategories.has(category)) {
        continue;
      }
      const pages = pagesForCategory(category, classifiedPages, context.pages);
      if (
        category === "IDENTITY_OVERVIEW" &&
        pages.every((page) => hasInsufficientPageText(page.textContent))
      ) {
        outputs.push({ category, bridge: null });
        continue;
      }
      const chunks = chunkPages(
        pages,
        extractionPipelineConfig.maximumPagesByCategory[category],
        category === "FINDINGS_DAMAGE" ||
          category === "RECOMMENDATIONS" ||
          category === "INSPECTIONS"
      );
      const selectedChunks =
        category === "IDENTITY_OVERVIEW" ? chunks.slice(0, 1) : chunks;
      for (const chunk of selectedChunks) {
        const promptVersion = extractionPipelineConfig.sectionPromptVersions[category];
        const invocationId = await this.options.store.startInvocation({
          category,
          documentId: context.documentId,
          model: this.options.provider.model,
          pageNumbers: chunk.map((page) => page.pageNumber),
          promptVersion,
          provider: this.options.provider.provider,
          runId: run.id,
          stage: "SECTION_EXTRACTION"
        });
        const output = await this.invokeProvider(
          invocationId,
          `section:${category}`,
          metrics,
          () =>
            this.options.provider.extractSection({
              category,
              documentId: context.documentId,
              pages: chunk,
              policy: extractionPolicy,
              promptVersion,
              referenceContext: buildReferenceContext(outputs),
              schemaVersion: extractionPipelineConfig.schemaVersion,
              temperature: extractionPipelineConfig.temperature
            }),
          sectionSchema(category)
        );
        outputs.push(output);
      }
    }
    return outputs;
  }

  private async invokeProvider<TOutput>(
    invocationId: string,
    stage: string,
    metrics: MetricsAccumulator,
    invoke: () => Promise<ExtractionProviderResult>,
    outputSchema: ZodType<TOutput>
  ): Promise<TOutput> {
    const startedAt = performance.now();
    let metadata: ExtractionModelMetadata | null = null;
    try {
      const result = await invoke();
      metadata = extractionModelMetadataSchema.parse(result.metadata);
      if (
        metadata.provider !== this.options.provider.provider ||
        metadata.model !== this.options.provider.model
      ) {
        throw new Error("Provider response metadata does not match its descriptor.");
      }
      metrics.add(metadata);
      const output = parseProviderOutput(stage, result.output, outputSchema);
      await this.options.store.completeInvocation(
        invocationId,
        elapsedMilliseconds(startedAt),
        metadata
      );
      return output;
    } catch (error) {
      const failure = normalizeFailure(error, stage);
      await this.options.store.failInvocation(
        invocationId,
        elapsedMilliseconds(startedAt),
        failure,
        metadata
      );
      const category = extractableCategoryFromStage(stage);
      if (category !== null && isMissingStructuredOutput(error)) {
        this.options.logger.info(
          {
            category,
            code: failure.code,
            stage
          },
          "Section extraction recovered after missing structured output"
        );
        return parseProviderOutput(
          stage,
          emptySectionOutput(category),
          outputSchema
        );
      }
      throw new ExtractionPipelineError({
        cause: error,
        code: failure.code,
        message: failure.message,
        stage
      });
    }
  }
}

function buildReferenceContext(
  outputs: readonly SectionExtractionOutput[]
): ExtractionReferenceContext {
  const findings: ExtractionReferenceContext["findings"][number][] = [];
  const inspections: ExtractionReferenceContext["inspections"][number][] = [];
  const partialStructures: ExtractionReferenceContext["partialStructures"][number][] =
    [];
  for (const output of outputs) {
    switch (output.category) {
      case "STRUCTURE_GEOMETRY":
        partialStructures.push(
          ...output.partialStructures.map((partial) => ({
            externalNumber: nullableRawString(
              partial.externalPartialStructureNumber.value
            ),
            name: nullableRawString(partial.name.value),
            sourceKey: partial.sourceKey
          }))
        );
        break;
      case "INSPECTIONS":
        inspections.push(
          ...output.inspections.map((inspection) => ({
            inspectedOn: inspection.inspectedOn.value,
            partialStructureRef: inspection.partialStructureRef,
            sourceKey: inspection.sourceKey,
            type: inspection.type.value
          }))
        );
        break;
      case "FINDINGS_DAMAGE":
        findings.push(
          ...output.findings.map((finding) => ({
            sourceIdentifier: nullableRawString(finding.sourceIdentifier.value),
            sourceKey: finding.sourceKey
          }))
        );
        break;
      default:
        break;
    }
  }
  return { findings, inspections, partialStructures };
}

function nullableRawString(value: string | null): string | null {
  return value === null ? null : value.trim();
}

function sectionSchema(
  category: ExtractablePageCategory
): ZodType<SectionExtractionOutput> {
  switch (category) {
    case "IDENTITY_OVERVIEW":
      return identityOverviewExtractionSchema;
    case "STRUCTURE_GEOMETRY":
      return structureGeometryExtractionSchema;
    case "COMPONENTS_MATERIALS":
      return componentsMaterialsExtractionSchema;
    case "INSPECTIONS":
      return inspectionsExtractionSchema;
    case "FINDINGS_DAMAGE":
      return findingsDamageExtractionSchema;
    case "RECOMMENDATIONS":
      return recommendationsExtractionSchema;
    case "HISTORICAL_WORKS_COSTS":
      return historicalWorksCostsExtractionSchema;
    case "TRAFFIC_NETWORK":
      return trafficNetworkExtractionSchema;
  }
}

function parseProviderOutput<TOutput>(
  stage: string,
  raw: unknown,
  outputSchema: ZodType<TOutput>
): TOutput {
  const category = extractableCategoryFromStage(stage);
  const repaired = category === null ? raw : repairSectionOutput(category, raw);
  const parsed = outputSchema.safeParse(repaired);
  if (parsed.success) {
    return parsed.data;
  }
  if (category !== null && category !== "IDENTITY_OVERVIEW") {
    return outputSchema.parse(emptySectionOutput(category));
  }
  throw parsed.error;
}

function extractableCategoryFromStage(
  stage: string
): ExtractablePageCategory | null {
  if (!stage.startsWith("section:")) {
    return null;
  }
  const parsed = extractablePageCategorySchema.safeParse(
    stage.slice("section:".length)
  );
  return parsed.success ? parsed.data : null;
}

function boostPageClassification(
  page: ExtractionPageInput,
  classification: PageClassificationOutput
): PageClassificationOutput {
  const extras = inferSection7Categories(page.textContent);
  if (extras.length === 0) {
    return classification;
  }
  const categories = [...classification.categories];
  for (const category of extras) {
    if (categories.some((item) => item.category === category)) {
      continue;
    }
    const otherIndex = categories.findIndex(
      (item) => item.category === "DRAWINGS_IMAGES_OTHER"
    );
    if (categories.length >= 4 && otherIndex >= 0) {
      categories.splice(otherIndex, 1);
    }
    if (categories.length < 4) {
      categories.push({ category, confidence: 0.95 });
    }
  }
  return { ...classification, categories };
}

function chunkPages(
  pages: readonly ExtractionPageInput[],
  maximumChunkSize: number,
  packGaps: boolean
): ExtractionPageInput[][] {
  if (!packGaps) {
    return chunkConsecutivePages(pages, maximumChunkSize);
  }
  const sorted = [...pages].sort((left, right) => left.pageNumber - right.pageNumber);
  const chunks: ExtractionPageInput[][] = [];
  for (let index = 0; index < sorted.length; index += maximumChunkSize) {
    chunks.push(sorted.slice(index, index + maximumChunkSize));
  }
  return chunks;
}

function chunkConsecutivePages(
  pages: readonly ExtractionPageInput[],
  maximumChunkSize: number
): ExtractionPageInput[][] {
  const chunks: ExtractionPageInput[][] = [];
  let current: ExtractionPageInput[] = [];
  for (const page of [...pages].sort((left, right) => left.pageNumber - right.pageNumber)) {
    const previous = current.at(-1);
    if (
      current.length === maximumChunkSize ||
      (previous !== undefined && page.pageNumber !== previous.pageNumber + 1)
    ) {
      chunks.push(current);
      current = [];
    }
    current.push(page);
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function pagesForCategory(
  category: ExtractablePageCategory,
  classifiedPages: ReadonlyMap<ExtractionPageCategory, ExtractionPageInput[]>,
  documentPages: readonly { readonly pageNumber: number; readonly textContent: string }[]
): ExtractionPageInput[] {
  const classified = classifiedPages.get(category) ?? [];
  const selected =
    classified.length > 0 || category !== "IDENTITY_OVERVIEW"
      ? classified
      : documentPages.slice(
          0,
          extractionPipelineConfig.maximumPagesPerSectionInvocation
        );
  return selected.map((page) => ({
    pageNumber: page.pageNumber,
    textContent: page.textContent
  }));
}

function isMissingStructuredOutput(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("did not contain a parsed structured output")
  );
}

function promptVersions(): Readonly<Record<string, string>> {
  return {
    PAGE_CLASSIFICATION: extractionPipelineConfig.classificationPromptVersion,
    ...extractionPipelineConfig.sectionPromptVersions
  };
}

function normalizeFailure(error: unknown, stage: string): ExtractionFailureInput {
  if (error instanceof ExtractionPipelineError) {
    return { code: error.code, message: error.message, stage: error.stage };
  }
  if (error instanceof ZodError) {
    return {
      code: "EXTRACTION_OUTPUT_INVALID",
      message: "Provider output failed schema validation.",
      stage
    };
  }
  return {
    code: "EXTRACTION_STAGE_FAILED",
    message: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown extraction error",
    stage
  };
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

function requireRun(
  run: ExtractionRunRecord | null,
  runId: string
): ExtractionRunRecord {
  if (run === null) {
    throw new Error(`Completed extraction run ${runId} could not be read.`);
  }
  return run;
}

class MetricsAccumulator {
  private readonly startedAt = performance.now();
  private inputTokensValue: number | null = null;
  private outputTokensValue: number | null = null;
  private estimatedCostMicros: bigint | null = null;
  private costCurrencyValue: string | null = null;

  public get durationMs(): number {
    return elapsedMilliseconds(this.startedAt);
  }

  public add(metadata: ExtractionModelMetadata): void {
    const usage = metadata.usage;
    if (usage === null) {
      return;
    }
    if (usage.inputTokens !== null) {
      this.inputTokensValue = (this.inputTokensValue ?? 0) + usage.inputTokens;
    }
    if (usage.outputTokens !== null) {
      this.outputTokensValue = (this.outputTokensValue ?? 0) + usage.outputTokens;
    }
    if (usage.estimatedCost !== null && usage.costCurrency !== null) {
      if (
        this.costCurrencyValue !== null &&
        this.costCurrencyValue !== usage.costCurrency
      ) {
        throw new Error("Extraction invocations reported multiple cost currencies.");
      }
      this.costCurrencyValue = usage.costCurrency;
      this.estimatedCostMicros =
        (this.estimatedCostMicros ?? 0n) + decimalToMicros(usage.estimatedCost);
    }
  }

  public snapshot(): ExtractionRunMetrics {
    return {
      durationMs: this.durationMs,
      inputTokens: this.inputTokensValue,
      outputTokens: this.outputTokensValue,
      estimatedCost:
        this.estimatedCostMicros === null
          ? null
          : microsToDecimal(this.estimatedCostMicros),
      costCurrency: this.costCurrencyValue
    };
  }
}

function decimalToMicros(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  if (whole === undefined) {
    throw new Error("Invalid provider cost metadata.");
  }
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

function microsToDecimal(value: bigint): string {
  const whole = value / 1_000_000n;
  const fraction = String(value % 1_000_000n).padStart(6, "0");
  return `${String(whole)}.${fraction}`;
}
