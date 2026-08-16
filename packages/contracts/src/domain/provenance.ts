import { z } from "zod";

import { entityAuditSchema, nonNegativeDecimalSchema, uuidSchema } from "./common.js";

export const extractionMethodSchema = z.enum([
  "MANUAL",
  "TEXT_EXTRACTION",
  "OCR",
  "MODEL_EXTRACTION",
  "IMPORT",
  "OTHER"
]);

export const evidenceReviewStateSchema = z.enum([
  "AUTOMATICALLY_EXTRACTED",
  "HUMAN_CONFIRMED",
  "HUMAN_REJECTED"
]);

export const provenanceKindSchema = z.enum(["SOURCE_FACT", "DERIVED"]);

export const bridgeProvenanceFieldNameSchema = z.enum([
  "$",
  "externalStructureNumber",
  "name",
  "road",
  "location.countryCode",
  "location.federalState",
  "location.district",
  "location.municipality",
  "location.locality",
  "location.postalCode",
  "location.stationing",
  "location.crossedFeature",
  "location.latitude",
  "location.longitude",
  "owner",
  "loadBearingResponsibility",
  "responsibleAuthority",
  "maintenanceOffice"
]);

export const partialStructureProvenanceFieldNameSchema = z.enum([
  "$",
  "externalPartialStructureNumber",
  "name",
  "constructionYear",
  "structureType",
  "structuralSystem",
  "lengthM",
  "widthM",
  "areaSqM",
  "clearHeightM",
  "spanCount"
]);

export const componentProvenanceFieldNameSchema = z.enum([
  "$",
  "type",
  "name",
  "location",
  "material",
  "constructionYear",
  "installYear",
  "additionalProperties"
]);

export const inspectionProvenanceFieldNameSchema = z.enum([
  "$",
  "type",
  "inspectedOn",
  "inspector",
  "conditionScore",
  "cycleMonths"
]);

export const findingProvenanceFieldNameSchema = z.enum([
  "$",
  "sourceIdentifier",
  "defectType",
  "description",
  "location",
  "extent",
  "dimensionLength",
  "dimensionWidth",
  "dimensionDepth",
  "dimensionUnit",
  "quantity",
  "quantityUnit",
  "stabilityRating",
  "trafficSafetyRating",
  "durabilityRating",
  "status",
  "componentId"
]);

export const recommendationProvenanceFieldNameSchema = z.enum([
  "$",
  "workType",
  "description",
  "urgency",
  "quantity",
  "unit",
  "sourceEstimatedCost",
  "sourceEstimatedCostCurrency",
  "targetYear",
  "plannedYear",
  "status"
]);

export const historicalWorkProvenanceFieldNameSchema = z.enum([
  "$",
  "partialStructureId",
  "type",
  "title",
  "reason",
  "contractor",
  "client",
  "startedOn",
  "endedOn",
  "quantity",
  "unit",
  "contractAmount",
  "finalAmount",
  "currency"
]);

export const trafficObservationProvenanceFieldNameSchema = z.enum([
  "$",
  "observationYear",
  "observedOn",
  "dailyTraffic",
  "truckSharePercent",
  "sourceDescription"
]);

const normalizedCoordinateSchema = nonNegativeDecimalSchema.refine(
  (value) => Number(value) <= 1,
  "Normalized coordinate must be between 0 and 1"
);

const normalizedSizeSchema = normalizedCoordinateSchema.refine(
  (value) => Number(value) > 0,
  "Normalized size must be greater than 0"
);

export const boundingBoxSchema = z
  .object({
    x: normalizedCoordinateSchema,
    y: normalizedCoordinateSchema,
    width: normalizedSizeSchema,
    height: normalizedSizeSchema
  })
  .strict()
  .superRefine((box, context) => {
    if (Number(box.x) + Number(box.width) > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bounding box exceeds page width",
        path: ["width"]
      });
    }
    if (Number(box.y) + Number(box.height) > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bounding box exceeds page height",
        path: ["height"]
      });
    }
  });

const sourceEvidenceFieldsSchema = z.object({
  documentId: uuidSchema,
  extractionRunId: uuidSchema.nullable(),
  pageNumber: z.number().int().positive().nullable(),
  sourceExcerpt: z.string().min(1).nullable(),
  boundingBox: boundingBoxSchema.nullable(),
  extractionConfidence: nonNegativeDecimalSchema
    .refine((value) => Number(value) <= 1, "Confidence must be between 0 and 1")
    .nullable(),
  extractionMethod: extractionMethodSchema,
  reviewState: evidenceReviewStateSchema.nullable()
});

type SourceEvidenceFields = z.infer<typeof sourceEvidenceFieldsSchema>;

function validateEvidencePage(evidence: SourceEvidenceFields, context: z.RefinementCtx): void {
  if (evidence.boundingBox !== null && evidence.pageNumber === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A bounding box requires a page number",
      path: ["pageNumber"]
    });
  }
  if (
    evidence.extractionRunId !== null &&
    evidence.extractionMethod !== "MODEL_EXTRACTION"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only model-extracted evidence can reference an extraction run",
      path: ["extractionRunId"]
    });
  }
  if (
    evidence.reviewState !== null &&
    evidence.extractionMethod !== "MODEL_EXTRACTION"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only model-extracted evidence can have an extraction review state",
      path: ["reviewState"]
    });
  }
  if (evidence.extractionRunId !== null && evidence.reviewState === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Evidence created by an extraction run requires a review state",
      path: ["reviewState"]
    });
  }
}

export const sourceEvidenceSchema = entityAuditSchema
  .merge(sourceEvidenceFieldsSchema)
  .strict()
  .superRefine(validateEvidencePage);
export const createSourceEvidenceSchema = sourceEvidenceFieldsSchema
  .strict()
  .superRefine(validateEvidencePage);

export const provenanceLinkSchema = z
  .object({
    entityId: uuidSchema,
    evidenceId: uuidSchema,
    fieldName: z.string().min(1),
    kind: provenanceKindSchema,
    derivationMethod: z.string().min(1).nullable()
  })
  .strict()
  .superRefine((link, context) => {
    const shouldHaveMethod = link.kind === "DERIVED";
    if (shouldHaveMethod !== (link.derivationMethod !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Derived values require a derivation method; source facts must not have one",
        path: ["derivationMethod"]
      });
    }
  });

export const bridgeProvenanceLinkSchema = provenanceLinkSchema.and(
  z.object({ fieldName: bridgeProvenanceFieldNameSchema })
);
export const partialStructureProvenanceLinkSchema = provenanceLinkSchema.and(
  z.object({ fieldName: partialStructureProvenanceFieldNameSchema })
);
export const componentProvenanceLinkSchema = provenanceLinkSchema.and(
  z.object({ fieldName: componentProvenanceFieldNameSchema })
);
export const inspectionProvenanceLinkSchema = provenanceLinkSchema.and(
  z.object({ fieldName: inspectionProvenanceFieldNameSchema })
);
export const findingProvenanceLinkSchema = provenanceLinkSchema.and(
  z.object({ fieldName: findingProvenanceFieldNameSchema })
);
export const recommendationProvenanceLinkSchema = provenanceLinkSchema.and(
  z.object({ fieldName: recommendationProvenanceFieldNameSchema })
);
export const historicalWorkProvenanceLinkSchema = provenanceLinkSchema.and(
  z.object({ fieldName: historicalWorkProvenanceFieldNameSchema })
);
export const trafficObservationProvenanceLinkSchema = provenanceLinkSchema.and(
  z.object({ fieldName: trafficObservationProvenanceFieldNameSchema })
);

export type ExtractionMethod = z.infer<typeof extractionMethodSchema>;
export type EvidenceReviewState = z.infer<typeof evidenceReviewStateSchema>;
export type ProvenanceKind = z.infer<typeof provenanceKindSchema>;
export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;
export type CreateSourceEvidence = z.infer<typeof createSourceEvidenceSchema>;
export type ProvenanceLink = z.infer<typeof provenanceLinkSchema>;
