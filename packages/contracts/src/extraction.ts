import { z } from "zod";

import { scalarPropertiesSchema } from "./domain/common.js";
import {
  boundingBoxSchema,
  provenanceKindSchema
} from "./domain/provenance.js";
import { findingStatusSchema } from "./domain/finding.js";
import { inspectionTypeSchema } from "./domain/inspection.js";
import { recommendationStatusSchema } from "./domain/recommendation.js";

export const extractionPageCategorySchema = z.enum([
  "IDENTITY_OVERVIEW",
  "STRUCTURE_GEOMETRY",
  "COMPONENTS_MATERIALS",
  "INSPECTIONS",
  "FINDINGS_DAMAGE",
  "RECOMMENDATIONS",
  "HISTORICAL_WORKS_COSTS",
  "TRAFFIC_NETWORK",
  "DRAWINGS_IMAGES_OTHER"
]);

export const extractablePageCategorySchema = extractionPageCategorySchema.exclude([
  "DRAWINGS_IMAGES_OTHER"
]);

export const extractionRunStatusSchema = z.enum([
  "PENDING",
  "CLASSIFYING",
  "EXTRACTING",
  "VALIDATING",
  "PERSISTING",
  "SUCCEEDED",
  "FAILED"
]);

export const extractionInvocationStatusSchema = z.enum([
  "RUNNING",
  "SUCCEEDED",
  "FAILED"
]);

export const extractionInvocationStageSchema = z.enum([
  "PAGE_CLASSIFICATION",
  "SECTION_EXTRACTION"
]);

export const extractionUsageSchema = z
  .object({
    inputTokens: z.number().int().min(0).max(2_147_483_647).nullable(),
    outputTokens: z.number().int().min(0).max(2_147_483_647).nullable(),
    estimatedCost: z.string().regex(/^\d{1,8}(\.\d{1,6})?$/).nullable(),
    costCurrency: z.string().regex(/^[A-Z]{3}$/).nullable()
  })
  .strict()
  .superRefine((usage, context) => {
    if ((usage.estimatedCost === null) !== (usage.costCurrency === null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estimated cost and currency must be supplied together",
        path: ["costCurrency"]
      });
    }
  });

export const extractionModelMetadataSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    providerRequestId: z.string().min(1).nullable(),
    usage: extractionUsageSchema.nullable()
  })
  .strict();

export const extractedEvidenceSchema = z
  .object({
    pageNumber: z.number().int().positive(),
    sourceExcerpt: z.string().trim().min(1).max(4_000),
    boundingBox: boundingBoxSchema.nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    kind: provenanceKindSchema,
    derivationMethod: z.string().trim().min(1).nullable()
  })
  .strict()
  .superRefine((evidence, context) => {
    const shouldHaveMethod = evidence.kind === "DERIVED";
    if (shouldHaveMethod !== (evidence.derivationMethod !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Derived evidence requires a method; source evidence must not have one",
        path: ["derivationMethod"]
      });
    }
  });

function sourcedValueSchema<TSchema extends z.ZodTypeAny>(valueSchema: TSchema) {
  return z
    .object({
      value: valueSchema.nullable(),
      evidence: z.array(extractedEvidenceSchema)
    })
    .strict()
    .transform((field) => {
      // Keep a sourced value even when the model could not quote a contiguous
      // excerpt (common in fragmented Bauwerksbuch tables). Still drop evidence
      // attached to a null value so downstream consumers never see a citation
      // that does not support a stored fact.
      if (field.value === null && field.evidence.length > 0) {
        return { evidence: [], value: field.value };
      }
      return field;
    });
}

const sourceKeySchema = z.string().trim().min(1).max(120);
const rawStringSchema = z.string().max(10_000);
const rawNumberSchema = z.union([z.string().max(120), z.number().finite()]);
const rawStringValueSchema = sourcedValueSchema(rawStringSchema);
const rawNumberValueSchema = sourcedValueSchema(rawNumberSchema);
const rawIntegerValueSchema = sourcedValueSchema(rawNumberSchema);
const recordEvidenceSchema = z.array(extractedEvidenceSchema).min(1);

export const pageClassificationOutputSchema = z
  .object({
    categories: z
      .array(
        z
          .object({
            category: extractionPageCategorySchema,
            confidence: z.number().min(0).max(1)
          })
          .strict()
      )
      .min(1)
      .max(4),
    sectionTitle: z.string().trim().min(1).max(500).nullable()
  })
  .strict()
  .superRefine((classification, context) => {
    const categories = classification.categories.map((item) => item.category);
    if (new Set(categories).size !== categories.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Page categories must be unique",
        path: ["categories"]
      });
    }
  });

const bridgeExtractionSchema = z
  .object({
    evidence: recordEvidenceSchema,
    externalStructureNumber: rawStringValueSchema,
    name: rawStringValueSchema,
    road: rawStringValueSchema,
    location: z
      .object({
        countryCode: rawStringValueSchema,
        federalState: rawStringValueSchema,
        district: rawStringValueSchema,
        municipality: rawStringValueSchema,
        locality: rawStringValueSchema,
        postalCode: rawStringValueSchema,
        stationing: rawStringValueSchema,
        crossedFeature: rawStringValueSchema,
        latitude: rawNumberValueSchema,
        longitude: rawNumberValueSchema
      })
      .strict(),
    owner: rawStringValueSchema,
    loadBearingResponsibility: rawStringValueSchema,
    responsibleAuthority: rawStringValueSchema,
    maintenanceOffice: rawStringValueSchema
  })
  .strict();

export const identityOverviewExtractionSchema = z
  .object({
    category: z.literal("IDENTITY_OVERVIEW"),
    bridge: bridgeExtractionSchema.nullable()
  })
  .strict();

const partialStructureExtractionSchema = z
  .object({
    sourceKey: sourceKeySchema,
    evidence: recordEvidenceSchema,
    externalPartialStructureNumber: rawStringValueSchema,
    name: rawStringValueSchema,
    constructionYear: rawIntegerValueSchema,
    structureType: rawStringValueSchema,
    structuralSystem: rawStringValueSchema,
    length: rawNumberValueSchema,
    width: rawNumberValueSchema,
    area: rawNumberValueSchema,
    clearHeight: rawNumberValueSchema,
    spanCount: rawIntegerValueSchema
  })
  .strict();

export const structureGeometryExtractionSchema = z
  .object({
    category: z.literal("STRUCTURE_GEOMETRY"),
    partialStructures: z.array(partialStructureExtractionSchema)
  })
  .strict();

const componentExtractionSchema = z
  .object({
    sourceKey: sourceKeySchema,
    partialStructureRef: sourceKeySchema,
    evidence: recordEvidenceSchema,
    type: rawStringValueSchema,
    name: rawStringValueSchema,
    location: rawStringValueSchema,
    material: rawStringValueSchema,
    constructionYear: rawIntegerValueSchema,
    installYear: rawIntegerValueSchema,
    additionalProperties: sourcedValueSchema(scalarPropertiesSchema)
  })
  .strict();

export const componentsMaterialsExtractionSchema = z
  .object({
    category: z.literal("COMPONENTS_MATERIALS"),
    components: z.array(componentExtractionSchema)
  })
  .strict();

const inspectionExtractionSchema = z
  .object({
    sourceKey: sourceKeySchema,
    partialStructureRef: sourceKeySchema,
    evidence: recordEvidenceSchema,
    type: sourcedValueSchema(inspectionTypeSchema),
    inspectedOn: rawStringValueSchema,
    inspector: rawStringValueSchema,
    conditionScore: rawNumberValueSchema,
    cycleMonths: rawIntegerValueSchema
  })
  .strict();

export const inspectionsExtractionSchema = z
  .object({
    category: z.literal("INSPECTIONS"),
    inspections: z.array(inspectionExtractionSchema)
  })
  .strict();

const findingExtractionSchema = z
  .object({
    sourceKey: sourceKeySchema,
    partialStructureRef: sourceKeySchema,
    inspectionRef: sourceKeySchema,
    componentRef: sourcedValueSchema(sourceKeySchema),
    evidence: recordEvidenceSchema,
    sourceIdentifier: rawStringValueSchema,
    defectType: rawStringValueSchema,
    description: rawStringValueSchema,
    location: rawStringValueSchema,
    extent: rawStringValueSchema,
    dimensionLength: rawNumberValueSchema,
    dimensionWidth: rawNumberValueSchema,
    dimensionDepth: rawNumberValueSchema,
    dimensionUnit: rawStringValueSchema,
    quantity: rawNumberValueSchema,
    quantityUnit: rawStringValueSchema,
    stabilityRating: sourcedValueSchema(z.number().int().min(0).max(4)),
    trafficSafetyRating: sourcedValueSchema(z.number().int().min(0).max(4)),
    durabilityRating: sourcedValueSchema(z.number().int().min(0).max(4)),
    status: sourcedValueSchema(findingStatusSchema)
  })
  .strict();

export const findingsDamageExtractionSchema = z
  .object({
    category: z.literal("FINDINGS_DAMAGE"),
    findings: z.array(findingExtractionSchema)
  })
  .strict();

const recommendationExtractionSchema = z
  .object({
    sourceKey: sourceKeySchema,
    partialStructureRef: sourceKeySchema,
    linkedFindingRefs: z.array(sourceKeySchema),
    evidence: recordEvidenceSchema,
    workType: rawStringValueSchema,
    description: rawStringValueSchema,
    urgency: rawStringValueSchema,
    quantity: rawNumberValueSchema,
    unit: rawStringValueSchema,
    sourceEstimatedCost: rawNumberValueSchema,
    sourceEstimatedCostCurrency: rawStringValueSchema,
    targetYear: rawIntegerValueSchema,
    plannedYear: rawIntegerValueSchema,
    status: sourcedValueSchema(recommendationStatusSchema)
  })
  .strict();

export const recommendationsExtractionSchema = z
  .object({
    category: z.literal("RECOMMENDATIONS"),
    recommendations: z.array(recommendationExtractionSchema)
  })
  .strict();

const historicalWorkExtractionSchema = z
  .object({
    sourceKey: sourceKeySchema,
    partialStructureRef: sourceKeySchema.nullable(),
    evidence: recordEvidenceSchema,
    type: rawStringValueSchema,
    title: rawStringValueSchema,
    reason: rawStringValueSchema,
    contractor: rawStringValueSchema,
    client: rawStringValueSchema,
    startedOn: rawStringValueSchema,
    endedOn: rawStringValueSchema,
    quantity: rawNumberValueSchema,
    unit: rawStringValueSchema,
    contractAmount: rawNumberValueSchema,
    finalAmount: rawNumberValueSchema,
    currency: rawStringValueSchema
  })
  .strict();

export const historicalWorksCostsExtractionSchema = z
  .object({
    category: z.literal("HISTORICAL_WORKS_COSTS"),
    historicalWorks: z.array(historicalWorkExtractionSchema)
  })
  .strict();

const trafficObservationExtractionSchema = z
  .object({
    sourceKey: sourceKeySchema,
    evidence: recordEvidenceSchema,
    observationYear: rawIntegerValueSchema,
    observedOn: rawStringValueSchema,
    dailyTraffic: rawIntegerValueSchema,
    truckSharePercent: rawNumberValueSchema,
    sourceDescription: rawStringValueSchema
  })
  .strict();

export const trafficNetworkExtractionSchema = z
  .object({
    category: z.literal("TRAFFIC_NETWORK"),
    trafficObservations: z.array(trafficObservationExtractionSchema)
  })
  .strict();

export const sectionExtractionOutputSchema = z.discriminatedUnion("category", [
  identityOverviewExtractionSchema,
  structureGeometryExtractionSchema,
  componentsMaterialsExtractionSchema,
  inspectionsExtractionSchema,
  findingsDamageExtractionSchema,
  recommendationsExtractionSchema,
  historicalWorksCostsExtractionSchema,
  trafficNetworkExtractionSchema
]);

export type ExtractionPageCategory = z.infer<typeof extractionPageCategorySchema>;
export type ExtractablePageCategory = z.infer<typeof extractablePageCategorySchema>;
export type ExtractionRunStatus = z.infer<typeof extractionRunStatusSchema>;
export type ExtractionInvocationStatus = z.infer<
  typeof extractionInvocationStatusSchema
>;
export type ExtractionInvocationStage = z.infer<
  typeof extractionInvocationStageSchema
>;
export type ExtractionUsage = z.infer<typeof extractionUsageSchema>;
export type ExtractionModelMetadata = z.infer<
  typeof extractionModelMetadataSchema
>;
export type ExtractedEvidence = z.infer<typeof extractedEvidenceSchema>;
export type PageClassificationOutput = z.infer<
  typeof pageClassificationOutputSchema
>;
export type SectionExtractionOutput = z.infer<
  typeof sectionExtractionOutputSchema
>;
