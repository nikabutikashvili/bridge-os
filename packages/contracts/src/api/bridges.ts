import { z } from "zod";

import { bridgeDataOriginSchema } from "../domain/bridge.js";
import {
  conditionScoreSchema,
  isoDateSchema,
  nonNegativeDecimalSchema,
  svdRatingSchema,
  uuidSchema,
  yearSchema
} from "../domain/common.js";
import { documentStatusSchema } from "../domain/document.js";
import { findingStatusSchema } from "../domain/finding.js";
import { inspectionTypeSchema } from "../domain/inspection.js";
import { recommendationStatusSchema } from "../domain/recommendation.js";
import {
  evidenceCitationSchema,
  inflationAdjustedEstimateSchema,
  moneySchema,
  quantitySchema
} from "./common.js";

export const inspectionDueStatusSchema = z.enum([
  "OVERDUE",
  "DUE_SOON",
  "CURRENT",
  "UNKNOWN"
]);

export const bridgePortfolioSortSchema = z.enum([
  "attention",
  "condition",
  "latestInspection",
  "constructionYear",
  "name"
]);

export const sortDirectionSchema = z.enum(["asc", "desc"]);

const optionalConditionQuerySchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().min(1).max(4).optional()
);

const optionalYearQuerySchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().int().min(1700).max(2200).optional()
);

const optionalBooleanQuerySchema = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value === "" ? undefined : value;
}, z.boolean().optional());

export const bridgePortfolioQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    road: z.string().trim().min(1).max(100).optional(),
    conditionMin: optionalConditionQuerySchema,
    conditionMax: optionalConditionQuerySchema,
    constructionYearFrom: optionalYearQuerySchema,
    constructionYearTo: optionalYearQuerySchema,
    inspectionStatus: inspectionDueStatusSchema.optional(),
    hasOpenFinding: optionalBooleanQuerySchema,
    recommendationUrgency: z.string().trim().min(1).max(100).optional(),
    findingStatus: findingStatusSchema.optional(),
    sort: bridgePortfolioSortSchema.default("attention"),
    direction: sortDirectionSchema.default("desc")
  })
  .strict()
  .superRefine((query, context) => {
    if (
      query.conditionMin !== undefined &&
      query.conditionMax !== undefined &&
      query.conditionMin > query.conditionMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "conditionMin cannot exceed conditionMax",
        path: ["conditionMin"]
      });
    }
    if (
      query.constructionYearFrom !== undefined &&
      query.constructionYearTo !== undefined &&
      query.constructionYearFrom > query.constructionYearTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "constructionYearFrom cannot exceed constructionYearTo",
        path: ["constructionYearFrom"]
      });
    }
  });

export const bridgeIdParamsSchema = z.object({ id: uuidSchema }).strict();
export const bridgeFindingParamsSchema = z
  .object({ id: uuidSchema, findingId: uuidSchema })
  .strict();

export const bridgeConditionSummarySchema = z
  .object({
    score: conditionScoreSchema.nullable(),
    previousScore: conditionScoreSchema.nullable(),
    delta: z.string().regex(/^-?\d+(\.\d+)?$/).nullable(),
    trend: z.enum(["IMPROVING", "STABLE", "DETERIORATING", "UNKNOWN"]),
    assessedOn: isoDateSchema.nullable(),
    inspectionType: inspectionTypeSchema.nullable()
  })
  .strict();

export const bridgeAttentionLevelSchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "ROUTINE"
]);

export const bridgeAttentionReasonSchema = z.enum([
  "OVERDUE_INSPECTION",
  "INSPECTION_DUE_SOON",
  "TRAFFIC_SAFETY_FINDING",
  "STABILITY_FINDING",
  "DURABILITY_FINDING",
  "DETERIORATING_CONDITION",
  "MEDIUM_OR_HIGHER_RECOMMENDATION",
  "OPEN_RECOMMENDATION",
  "OPEN_FINDING",
  "MISSING_CRITICAL_DATA"
]);

export const bridgeInspectionSummarySchema = z
  .object({
    latestInspectionOn: isoDateSchema.nullable(),
    nextDueOn: isoDateSchema.nullable(),
    status: inspectionDueStatusSchema
  })
  .strict();

export const bridgePortfolioTrafficSchema = z
  .object({
    observationYear: yearSchema,
    observedOn: isoDateSchema.nullable(),
    dailyTraffic: z.number().int().nonnegative().nullable(),
    truckSharePercent: nonNegativeDecimalSchema.nullable()
  })
  .strict();

export const bridgeAttentionSchema = z
  .object({
    level: bridgeAttentionLevelSchema,
    reasons: z.array(bridgeAttentionReasonSchema),
    openFindings: z.number().int().nonnegative(),
    openRecommendations: z.number().int().nonnegative(),
    highestRecommendationUrgency: z.string().min(1).nullable(),
    nextRecommendation: z
      .object({
        id: uuidSchema,
        description: z.string().min(1).nullable(),
        urgency: z.string().min(1).nullable(),
        targetYear: yearSchema.nullable(),
        plannedYear: yearSchema.nullable()
      })
      .strict()
      .nullable(),
    maximumRatings: z
      .object({
        stability: svdRatingSchema.nullable(),
        trafficSafety: svdRatingSchema.nullable(),
        durability: svdRatingSchema.nullable()
      })
      .strict()
  })
  .strict();

export const bridgePortfolioItemSchema = z
  .object({
    id: uuidSchema,
    externalStructureNumber: z.string().min(1).nullable(),
    name: z.string().min(1).nullable(),
    road: z.string().min(1).nullable(),
    location: z
      .object({
        municipality: z.string().min(1).nullable(),
        locality: z.string().min(1).nullable()
      })
      .strict(),
    dataOrigin: bridgeDataOriginSchema.nullable(),
    structure: z
      .object({
        constructionYear: yearSchema.nullable(),
        structureType: z.string().min(1).nullable(),
        partialStructureCount: z.number().int().nonnegative()
      })
      .strict(),
    condition: bridgeConditionSummarySchema,
    inspection: bridgeInspectionSummarySchema,
    traffic: bridgePortfolioTrafficSchema.nullable(),
    attention: bridgeAttentionSchema,
    photoUrl: z.string().min(1).nullable()
  })
  .strict();

export const bridgePortfolioResponseSchema = z
  .object({
    data: z.array(bridgePortfolioItemSchema),
    summary: z
      .object({
        structures: z.number().int().nonnegative(),
        inspectionsDueOrOverdue: z.number().int().nonnegative(),
        withOpenRecommendations: z.number().int().nonnegative(),
        withNotableFindings: z.number().int().nonnegative()
      })
      .strict(),
    pagination: z
      .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        totalItems: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative()
      })
      .strict(),
    sort: z
      .object({
        field: bridgePortfolioSortSchema,
        direction: sortDirectionSchema
      })
      .strict(),
    asOf: isoDateSchema
  })
  .strict();

export const compactPartialStructureSchema = z
  .object({
    id: uuidSchema,
    externalNumber: z.string().min(1).nullable(),
    name: z.string().min(1).nullable()
  })
  .strict();

export const bridgeDetailResponseSchema = z
  .object({
    data: z
      .object({
        id: uuidSchema,
        externalStructureNumber: z.string().min(1).nullable(),
        name: z.string().min(1).nullable(),
        road: z.string().min(1).nullable(),
        dataOrigin: bridgeDataOriginSchema.nullable(),
        location: z
          .object({
            countryCode: z.string().length(2).nullable(),
            federalState: z.string().min(1).nullable(),
            district: z.string().min(1).nullable(),
            municipality: z.string().min(1).nullable(),
            locality: z.string().min(1).nullable(),
            crossedFeature: z.string().min(1).nullable(),
            latitude: z.string().nullable(),
            longitude: z.string().nullable()
          })
          .strict(),
        responsibility: z
          .object({
            owner: z.string().min(1).nullable(),
            loadBearingResponsibility: z.string().min(1).nullable(),
            responsibleAuthority: z.string().min(1).nullable(),
            maintenanceOffice: z.string().min(1).nullable()
          })
          .strict(),
        partialStructures: z.array(
          compactPartialStructureSchema.extend({
            constructionYear: yearSchema.nullable(),
            evidence: z.array(evidenceCitationSchema),
            structureType: z.string().min(1).nullable(),
            structuralSystem: z.string().min(1).nullable(),
            geometry: z
              .object({
                lengthM: nonNegativeDecimalSchema.nullable(),
                widthM: nonNegativeDecimalSchema.nullable(),
                areaSqM: nonNegativeDecimalSchema.nullable(),
                clearHeightM: nonNegativeDecimalSchema.nullable(),
                spanCount: z.number().int().positive().nullable()
              })
              .strict()
          })
        ),
        condition: bridgeConditionSummarySchema,
        inspection: bridgeInspectionSummarySchema,
        attention: bridgeAttentionSchema,
        photoUrl: z.string().min(1).nullable(),
        technicalData: z
          .object({
            components: z.array(
              z
                .object({
                  id: uuidSchema,
                  partialStructure: compactPartialStructureSchema,
                  type: z.string().min(1).nullable(),
                  name: z.string().min(1).nullable(),
                  location: z.string().min(1).nullable(),
                  material: z.string().min(1).nullable(),
                  constructionYear: yearSchema.nullable(),
                  installYear: yearSchema.nullable()
                })
                .strict()
            )
          })
          .strict(),
        evidence: z.array(evidenceCitationSchema),
        latestTraffic: z
          .object({
            observationYear: z.number().int(),
            observedOn: isoDateSchema.nullable(),
            dailyTraffic: z.number().int().nonnegative().nullable(),
            truckSharePercent: nonNegativeDecimalSchema.nullable(),
            evidence: z.array(evidenceCitationSchema)
          })
          .strict()
          .nullable()
      })
      .strict(),
    asOf: isoDateSchema
  })
  .strict();

export const bridgeInspectionsResponseSchema = z
  .object({
    data: z.array(
      z
        .object({
          id: uuidSchema,
          partialStructure: compactPartialStructureSchema,
          type: inspectionTypeSchema.nullable(),
          inspectedOn: isoDateSchema.nullable(),
          inspector: z.string().min(1).nullable(),
          conditionScore: conditionScoreSchema.nullable(),
          cycleMonths: z.number().int().positive().nullable(),
          nextDueOn: isoDateSchema.nullable(),
          evidence: z.array(evidenceCitationSchema)
        })
        .strict()
    )
  })
  .strict();

export const linkedFindingRecommendationSchema = z
  .object({
    id: uuidSchema,
    workType: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
    urgency: z.string().min(1).nullable(),
    status: recommendationStatusSchema.nullable(),
    targetYear: yearSchema.nullable(),
    plannedYear: yearSchema.nullable()
  })
  .strict();

export const bridgeFindingSchema = z
  .object({
    id: uuidSchema,
    partialStructure: compactPartialStructureSchema,
    inspection: z
      .object({
        id: uuidSchema,
        type: inspectionTypeSchema.nullable(),
        inspectedOn: isoDateSchema.nullable()
      })
      .strict(),
    component: z
      .object({
        id: uuidSchema,
        type: z.string().min(1).nullable(),
        name: z.string().min(1).nullable()
      })
      .strict()
      .nullable(),
    sourceIdentifier: z.string().min(1).nullable(),
    defectType: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
    location: z.string().min(1).nullable(),
    extent: z.string().min(1).nullable(),
    dimensions: z
      .object({
        length: nonNegativeDecimalSchema.nullable(),
        width: nonNegativeDecimalSchema.nullable(),
        depth: nonNegativeDecimalSchema.nullable(),
        unit: z.string().min(1)
      })
      .strict()
      .nullable(),
    quantity: quantitySchema.nullable(),
    ratings: z
      .object({
        stability: svdRatingSchema.nullable(),
        trafficSafety: svdRatingSchema.nullable(),
        durability: svdRatingSchema.nullable()
      })
      .strict(),
    status: findingStatusSchema.nullable(),
    linkedRecommendations: z.array(linkedFindingRecommendationSchema),
    evidence: z.array(evidenceCitationSchema)
  })
  .strict();

export const bridgeFindingsResponseSchema = z
  .object({ data: z.array(bridgeFindingSchema) })
  .strict();

export const bridgeFindingDetailResponseSchema = z
  .object({ data: bridgeFindingSchema })
  .strict();

export const linkedRecommendationFindingSchema = z
  .object({
    id: uuidSchema,
    sourceIdentifier: z.string().min(1).nullable(),
    defectType: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
    status: findingStatusSchema.nullable()
  })
  .strict();

export const bridgeRecommendationsResponseSchema = z
  .object({
    data: z.array(
      z
        .object({
          id: uuidSchema,
          partialStructure: compactPartialStructureSchema,
          workType: z.string().min(1).nullable(),
          description: z.string().min(1).nullable(),
          urgency: z.string().min(1).nullable(),
          quantity: quantitySchema.nullable(),
          sourceEstimatedCost: moneySchema.nullable(),
          sourceDate: isoDateSchema.nullable(),
          inflationAdjustedEstimate: inflationAdjustedEstimateSchema.nullable(),
          targetYear: yearSchema.nullable(),
          plannedYear: yearSchema.nullable(),
          status: recommendationStatusSchema.nullable(),
          linkedFindings: z.array(linkedRecommendationFindingSchema),
          evidence: z.array(evidenceCitationSchema)
        })
        .strict()
    )
  })
  .strict();

const historyBaseSchema = z.object({
  id: uuidSchema,
  date: isoDateSchema.nullable(),
  title: z.string().min(1),
  evidence: z.array(evidenceCitationSchema)
});

export const bridgeHistoryEventSchema = z.discriminatedUnion("kind", [
  historyBaseSchema
    .extend({
      kind: z.literal("INSPECTION"),
      partialStructure: compactPartialStructureSchema,
      inspectionType: inspectionTypeSchema.nullable(),
      conditionScore: conditionScoreSchema.nullable()
    })
    .strict(),
  historyBaseSchema
    .extend({
      kind: z.literal("HISTORICAL_WORK"),
      endDate: isoDateSchema.nullable(),
      workType: z.string().min(1).nullable(),
      reason: z.string().min(1).nullable(),
      quantity: quantitySchema.nullable(),
      contractAmount: moneySchema.nullable(),
      finalAmount: moneySchema.nullable()
    })
    .strict(),
  historyBaseSchema
    .extend({
      kind: z.literal("TRAFFIC_OBSERVATION"),
      observationYear: z.number().int(),
      dailyTraffic: z.number().int().nonnegative().nullable(),
      truckSharePercent: nonNegativeDecimalSchema.nullable()
    })
    .strict()
]);

export const bridgeHistoryResponseSchema = z
  .object({ data: z.array(bridgeHistoryEventSchema) })
  .strict();

export const bridgeDocumentsResponseSchema = z
  .object({
    data: z.array(
      z
        .object({
          id: uuidSchema,
          partialStructure: compactPartialStructureSchema.nullable(),
          type: z.string().min(1),
          originalFilename: z.string().min(1),
          status: documentStatusSchema,
          isDemoFixture: z.boolean(),
          evidenceCount: z.number().int().nonnegative(),
          evidencePages: z.array(z.number().int().positive())
        })
        .strict()
    )
  })
  .strict();

export type BridgePortfolioQuery = z.infer<typeof bridgePortfolioQuerySchema>;
export type BridgePortfolioResponse = z.infer<typeof bridgePortfolioResponseSchema>;
export type BridgePortfolioItem = z.infer<typeof bridgePortfolioItemSchema>;
export type BridgeDetailResponse = z.infer<typeof bridgeDetailResponseSchema>;
export type BridgeInspectionsResponse = z.infer<typeof bridgeInspectionsResponseSchema>;
export type BridgeFindingsResponse = z.infer<typeof bridgeFindingsResponseSchema>;
export type BridgeFindingDetailResponse = z.infer<
  typeof bridgeFindingDetailResponseSchema
>;
export type BridgeFinding = z.infer<typeof bridgeFindingSchema>;
export type BridgeRecommendationsResponse = z.infer<typeof bridgeRecommendationsResponseSchema>;
export type LinkedRecommendationFinding = z.infer<typeof linkedRecommendationFindingSchema>;
export type BridgeHistoryResponse = z.infer<typeof bridgeHistoryResponseSchema>;
export type BridgeDocumentsResponse = z.infer<typeof bridgeDocumentsResponseSchema>;
export type InspectionDueStatus = z.infer<typeof inspectionDueStatusSchema>;
export type BridgeAttentionLevel = z.infer<typeof bridgeAttentionLevelSchema>;
export type BridgeAttentionReason = z.infer<typeof bridgeAttentionReasonSchema>;
export type BridgeConditionTrend = z.infer<typeof bridgeConditionSummarySchema>["trend"];
