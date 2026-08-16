import { z } from "zod";

import { extractionRunStatusSchema } from "../extraction.js";
import { timestampSchema, uuidSchema } from "../domain/common.js";
import {
  documentProcessingStatusSchema,
  documentStatusSchema
} from "../domain/document.js";

export const documentOverviewExtractionStatusSchema = z.union([
  z.literal("NOT_STARTED"),
  extractionRunStatusSchema
]);

export const documentOverviewErrorSchema = z
  .object({
    stage: z.string().min(1),
    code: z.string().min(1),
    message: z.string().min(1)
  })
  .strict();

export const documentOverviewItemSchema = z
  .object({
    id: uuidSchema,
    originalFilename: z.string().min(1),
    type: z.string().min(1),
    status: documentStatusSchema,
    uploadedAt: timestampSchema,
    isDemoFixture: z.boolean(),
    bridge: z
      .object({
        id: uuidSchema,
        externalStructureNumber: z.string().min(1).nullable(),
        name: z.string().min(1).nullable(),
        road: z.string().min(1).nullable()
      })
      .strict()
      .nullable(),
    processing: z
      .object({
        status: documentProcessingStatusSchema,
        parser: z.string().min(1).nullable(),
        pageCount: z.number().int().nonnegative().nullable(),
        error: documentOverviewErrorSchema.nullable()
      })
      .strict()
      .nullable(),
    extraction: z
      .object({
        status: documentOverviewExtractionStatusSchema,
        attempt: z.number().int().positive().nullable(),
        pipelineVersion: z.string().min(1).nullable(),
        provider: z.string().min(1).nullable(),
        model: z.string().min(1).nullable(),
        startedAt: timestampSchema.nullable(),
        completedAt: timestampSchema.nullable(),
        error: documentOverviewErrorSchema.nullable()
      })
      .strict()
  })
  .strict();

export const bridgeDataHealthCodeSchema = z.enum([
  "LATEST_INSPECTION",
  "TRAFFIC_CURRENCY",
  "GEOMETRY_COMPLETENESS",
  "EXTRACTION_ERRORS",
  "RECOMMENDATION_QUANTITIES",
  "RECOMMENDATION_COST_ESTIMATES",
  "EXTRACTED_FINDING_REVIEW",
  "CRITICAL_SOURCE_EVIDENCE",
  "LOAD_RECALCULATION_DOCUMENT"
]);

export const bridgeDataHealthStatusSchema = z.enum([
  "AVAILABLE",
  "CURRENT",
  "COMPLETE",
  "STALE",
  "MISSING",
  "REVIEW_REQUIRED",
  "ERROR"
]);

export const bridgeDataHealthIndicatorSchema = z
  .object({
    code: bridgeDataHealthCodeSchema,
    status: bridgeDataHealthStatusSchema,
    label: z.string().min(1),
    detail: z.string().min(1),
    count: z.number().int().nonnegative().nullable()
  })
  .strict();

export const bridgeDataHealthSchema = z
  .object({
    bridge: z
      .object({
        id: uuidSchema,
        externalStructureNumber: z.string().min(1).nullable(),
        name: z.string().min(1).nullable(),
        road: z.string().min(1).nullable()
      })
      .strict(),
    attentionCount: z.number().int().nonnegative(),
    indicators: z.array(bridgeDataHealthIndicatorSchema).length(9)
  })
  .strict();

export const documentOverviewResponseSchema = z
  .object({
    asOf: timestampSchema,
    summary: z
      .object({
        totalDocuments: z.number().int().nonnegative(),
        linkedDocuments: z.number().int().nonnegative(),
        extractionSucceeded: z.number().int().nonnegative(),
        extractionPending: z.number().int().nonnegative(),
        extractionFailed: z.number().int().nonnegative(),
        processingFailed: z.number().int().nonnegative(),
        bridgesWithAttention: z.number().int().nonnegative(),
        extractedFindingsRequiringReview: z.number().int().nonnegative()
      })
      .strict(),
    documents: z.array(documentOverviewItemSchema),
    bridgeDataHealth: z.array(bridgeDataHealthSchema)
  })
  .strict();

export type DocumentOverviewItem = z.infer<typeof documentOverviewItemSchema>;
export type DocumentOverviewResponse = z.infer<
  typeof documentOverviewResponseSchema
>;
export type BridgeDataHealth = z.infer<typeof bridgeDataHealthSchema>;
export type BridgeDataHealthIndicator = z.infer<
  typeof bridgeDataHealthIndicatorSchema
>;
