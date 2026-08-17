import { z } from "zod";

import { isoDateSchema, uuidSchema, yearSchema } from "../domain/common.js";
import { networkCriticalityBandSchema } from "../domain/network.js";
import {
  interventionEstimateSourceSchema,
  interventionEstimateStatusSchema,
  plannedInterventionStatusSchema
} from "../domain/planned-intervention.js";
import { planningPrioritySchema } from "./planning.js";
import { inflationAdjustedEstimateSchema, moneySchema } from "./common.js";

export const budgetQuerySchema = z
  .object({ year: z.coerce.number().int().min(1700).max(2200) })
  .strict();

export const budgetYearParamsSchema = z
  .object({ year: z.coerce.number().int().min(1700).max(2200) })
  .strict();

export const budgetMembershipParamsSchema = budgetYearParamsSchema
  .extend({ interventionId: uuidSchema })
  .strict();

export const updateBudgetSchema = z
  .object({ approvedBudget: moneySchema.nullable() })
  .strict();

export const updateBudgetMembershipSchema = z
  .object({ included: z.boolean() })
  .strict();

export const budgetEstimateSourceSchema = z.enum([
  "SOURCE_DOCUMENT",
  ...interventionEstimateSourceSchema.options
]);

export const budgetEstimateSchema = moneySchema
  .extend({
    source: budgetEstimateSourceSchema,
    status: interventionEstimateStatusSchema.nullable()
  })
  .strict();

export const budgetItemSchema = z
  .object({
    bridge: z
      .object({
        id: uuidSchema,
        externalStructureNumber: z.string().min(1).nullable(),
        name: z.string().min(1).nullable(),
        road: z.string().min(1).nullable()
      })
      .strict(),
    intervention: z
      .object({
        id: uuidSchema,
        workType: z.string().min(1),
        plannedYear: yearSchema,
        status: plannedInterventionStatusSchema,
        estimatedCost: moneySchema.nullable(),
        estimatedCostSource: interventionEstimateSourceSchema.nullable(),
        estimatedCostStatus: interventionEstimateStatusSchema.nullable()
      })
      .strict(),
    sourceRecommendation: z
      .object({
        id: uuidSchema,
        urgency: z.string().min(1).nullable(),
        targetYear: yearSchema.nullable(),
        sourceEstimatedCost: moneySchema.nullable(),
        sourceDate: isoDateSchema.nullable(),
        inflationAdjustedEstimate: inflationAdjustedEstimateSchema.nullable()
      })
      .strict(),
    estimate: budgetEstimateSchema.nullable(),
    estimateRequired: z.boolean(),
    included: z.boolean(),
    priority: planningPrioritySchema,
    networkCriticality: z
      .object({
        band: networkCriticalityBandSchema,
        extraVehicleKmPerDay: z.number().nonnegative().nullable()
      })
      .strict()
      .nullable()
  })
  .strict();

export const budgetSummarySchema = z
  .object({
    selectedProgramValue: moneySchema,
    remainingBudget: moneySchema.nullable(),
    overBudget: moneySchema.nullable(),
    includedInterventions: z.number().int().nonnegative(),
    fundedInterventions: z.number().int().nonnegative(),
    missingEstimateCount: z.number().int().nonnegative(),
    budgetStatus: z.enum(["NOT_SET", "WITHIN_BUDGET", "OVER_BUDGET"])
  })
  .strict();

export const budgetResponseSchema = z
  .object({
    asOf: isoDateSchema,
    availableYears: z.array(yearSchema),
    program: z
      .object({
        id: uuidSchema.nullable(),
        planningYear: yearSchema,
        approvedBudget: moneySchema.nullable()
      })
      .strict(),
    data: z.array(budgetItemSchema),
    summary: budgetSummarySchema
  })
  .strict();

export type BudgetQuery = z.infer<typeof budgetQuerySchema>;
export type BudgetItem = z.infer<typeof budgetItemSchema>;
export type BudgetResponse = z.infer<typeof budgetResponseSchema>;
export type UpdateBudget = z.infer<typeof updateBudgetSchema>;
export type UpdateBudgetMembership = z.infer<
  typeof updateBudgetMembershipSchema
>;
