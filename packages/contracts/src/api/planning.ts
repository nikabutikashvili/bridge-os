import { z } from "zod";

import {
  isoDateSchema,
  svdRatingSchema,
  uuidSchema,
  yearSchema
} from "../domain/common.js";
import { findingStatusSchema } from "../domain/finding.js";
import {
  interventionEstimateSourceSchema,
  interventionEstimateStatusSchema,
  plannedInterventionStatusSchema
} from "../domain/planned-intervention.js";
import { recommendationStatusSchema } from "../domain/recommendation.js";
import { inflationAdjustedEstimateSchema, moneySchema, quantitySchema } from "./common.js";

export const planningViewSchema = z.enum([
  "recommended-unplanned",
  "planned",
  "budgeted",
  "tender-preparation",
  "tendered-ready",
  "in-progress",
  "completed"
]);

export const planningQuerySchema = z
  .object({
    view: planningViewSchema.default("recommended-unplanned"),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict();

export const planningPriorityLevelSchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW"
]);

export const planningPriorityReasonCodeSchema = z.enum([
  "STABILITY_RATING",
  "TRAFFIC_SAFETY_RATING",
  "DURABILITY_RATING",
  "IMMEDIATE_URGENCY",
  "SHORT_TERM_URGENCY",
  "MEDIUM_TERM_URGENCY",
  "LONG_UNRESOLVED",
  "INSPECTION_OVERDUE",
  "INSPECTION_DUE_SOON",
  "CONDITION_DETERIORATING",
  "HIGH_TRAFFIC"
]);

export const planningPriorityReasonSchema = z
  .object({
    code: planningPriorityReasonCodeSchema,
    severity: planningPriorityLevelSchema,
    label: z.string().min(1),
    detail: z.string().min(1)
  })
  .strict();

export const planningPrioritySchema = z
  .object({
    level: planningPriorityLevelSchema,
    policyVersion: z.literal("maintenance-priority-v1"),
    reasons: z.array(planningPriorityReasonSchema)
  })
  .strict();

const planningFindingSchema = z
  .object({
    id: uuidSchema,
    sourceIdentifier: z.string().min(1).nullable(),
    defectType: z.string().min(1).nullable(),
    status: findingStatusSchema.nullable(),
    ratings: z
      .object({
        stability: svdRatingSchema.nullable(),
        trafficSafety: svdRatingSchema.nullable(),
        durability: svdRatingSchema.nullable()
      })
      .strict()
  })
  .strict();

const planningRecommendationSchema = z
  .object({
    id: uuidSchema,
    workType: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
    urgency: z.string().min(1).nullable(),
    targetYear: yearSchema.nullable(),
    quantity: quantitySchema.nullable(),
    sourceEstimatedCost: moneySchema.nullable(),
    status: recommendationStatusSchema.nullable(),
    sourceDate: isoDateSchema.nullable(),
    inflationAdjustedEstimate: inflationAdjustedEstimateSchema.nullable()
  })
  .strict();

export const plannedInterventionSummarySchema = z
  .object({
    id: uuidSchema,
    workType: z.string().min(1),
    plannedYear: yearSchema,
    quantity: quantitySchema.nullable(),
    estimatedCost: moneySchema.nullable(),
    estimatedCostSource: interventionEstimateSourceSchema.nullable(),
    estimatedCostStatus: interventionEstimateStatusSchema.nullable(),
    status: plannedInterventionStatusSchema,
    createdAt: z.string().datetime({ offset: true })
  })
  .strict();

export const planningItemSchema = z
  .object({
    recommendationId: uuidSchema,
    bridge: z
      .object({
        id: uuidSchema,
        externalStructureNumber: z.string().min(1).nullable(),
        name: z.string().min(1).nullable(),
        road: z.string().min(1).nullable()
      })
      .strict(),
    sourceRecommendation: planningRecommendationSchema,
    plannedIntervention: plannedInterventionSummarySchema.nullable(),
    linkedFindings: z.array(planningFindingSchema),
    priority: planningPrioritySchema
  })
  .strict();

export const planningResponseSchema = z
  .object({
    data: z.array(planningItemSchema),
    summary: z
      .object({
        recommendedUnplanned: z.number().int().nonnegative(),
        planned: z.number().int().nonnegative(),
        budgeted: z.number().int().nonnegative(),
        tenderPreparation: z.number().int().nonnegative(),
        tenderedReady: z.number().int().nonnegative(),
        inProgress: z.number().int().nonnegative(),
        completed: z.number().int().nonnegative()
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
    view: planningViewSchema,
    asOf: isoDateSchema
  })
  .strict();

export const createPlannedInterventionSchema = z
  .object({
    recommendationId: uuidSchema,
    workType: z.string().trim().min(1).max(200),
    plannedYear: yearSchema,
    quantity: quantitySchema.nullable().optional(),
    estimatedCost: moneySchema.nullable().optional()
  })
  .strict();

export const createPlannedInterventionResponseSchema = z
  .object({ data: plannedInterventionSummarySchema })
  .strict();

export type PlanningView = z.infer<typeof planningViewSchema>;
export type PlanningQuery = z.infer<typeof planningQuerySchema>;
export type PlanningPriority = z.infer<typeof planningPrioritySchema>;
export type PlanningPriorityLevel = z.infer<
  typeof planningPriorityLevelSchema
>;
export type PlanningPriorityReasonCode = z.infer<
  typeof planningPriorityReasonCodeSchema
>;
export type PlanningItem = z.infer<typeof planningItemSchema>;
export type PlanningResponse = z.infer<typeof planningResponseSchema>;
export type CreatePlannedIntervention = z.infer<
  typeof createPlannedInterventionSchema
>;
export type CreatePlannedInterventionResponse = z.infer<
  typeof createPlannedInterventionResponseSchema
>;
