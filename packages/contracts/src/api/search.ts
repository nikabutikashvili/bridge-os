import { z } from "zod";

import { uuidSchema } from "../domain/common.js";
import { findingStatusSchema } from "../domain/finding.js";
import { recommendationStatusSchema } from "../domain/recommendation.js";

export const globalSearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(100),
    limit: z.coerce.number().int().min(1).max(10).default(5)
  })
  .strict();

export const globalSearchBridgeContextSchema = z
  .object({
    id: uuidSchema,
    externalStructureNumber: z.string().min(1).nullable(),
    name: z.string().min(1).nullable(),
    road: z.string().min(1).nullable()
  })
  .strict();

export const globalSearchBridgeResultSchema = globalSearchBridgeContextSchema
  .extend({
    location: z
      .object({
        district: z.string().min(1).nullable(),
        locality: z.string().min(1).nullable(),
        municipality: z.string().min(1).nullable()
      })
      .strict()
  })
  .strict();

export const globalSearchFindingResultSchema = z
  .object({
    id: uuidSchema,
    sourceIdentifier: z.string().min(1).nullable(),
    defectType: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
    location: z.string().min(1).nullable(),
    status: findingStatusSchema.nullable(),
    bridge: globalSearchBridgeContextSchema
  })
  .strict();

export const globalSearchRecommendationResultSchema = z
  .object({
    id: uuidSchema,
    workType: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
    urgency: z.string().min(1).nullable(),
    status: recommendationStatusSchema.nullable(),
    bridge: globalSearchBridgeContextSchema
  })
  .strict();

const searchResultGroup = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z
    .object({
      items: z.array(itemSchema),
      totalItems: z.number().int().nonnegative()
    })
    .strict();

export const globalSearchResponseSchema = z
  .object({
    query: z.string().min(2),
    groups: z
      .object({
        bridges: searchResultGroup(globalSearchBridgeResultSchema),
        findings: searchResultGroup(globalSearchFindingResultSchema),
        recommendations: searchResultGroup(
          globalSearchRecommendationResultSchema
        )
      })
      .strict()
  })
  .strict();

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
export type GlobalSearchBridgeContext = z.infer<
  typeof globalSearchBridgeContextSchema
>;
export type GlobalSearchBridgeResult = z.infer<
  typeof globalSearchBridgeResultSchema
>;
export type GlobalSearchFindingResult = z.infer<
  typeof globalSearchFindingResultSchema
>;
export type GlobalSearchRecommendationResult = z.infer<
  typeof globalSearchRecommendationResultSchema
>;
export type GlobalSearchResponse = z.infer<typeof globalSearchResponseSchema>;
