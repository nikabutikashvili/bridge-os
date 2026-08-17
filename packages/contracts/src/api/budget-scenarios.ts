import { z } from "zod";

import { timestampSchema, uuidSchema, yearSchema } from "../domain/common.js";
import { budgetItemSchema, budgetSummarySchema } from "./budget.js";
import { moneySchema } from "./common.js";

export const BUDGET_SCENARIO_HORIZON_YEARS = 5 as const;

export const budgetScenarioStatusSchema = z.enum(["DRAFT", "ADOPTED"]);

export const budgetScenarioAssignmentSourceSchema = z.enum([
  "SEEDED",
  "AUTO_FILL",
  "USER_OVERRIDE"
]);

export const budgetScenarioParamsSchema = z
  .object({ scenarioId: uuidSchema })
  .strict();

export const budgetScenarioAssignmentParamsSchema = budgetScenarioParamsSchema
  .extend({ interventionId: uuidSchema })
  .strict();

export const budgetScenarioCompareQuerySchema = z
  .object({
    left: uuidSchema,
    right: uuidSchema
  })
  .strict()
  .refine((query) => query.left !== query.right, {
    message: "Compare requires two different scenarios."
  });

export const createBudgetScenarioSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    horizonStartYear: yearSchema,
    annualEnvelope: moneySchema.nullable().default(null)
  })
  .strict();

export const updateBudgetScenarioSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    envelopes: z
      .array(
        z
          .object({
            year: yearSchema,
            approvedBudget: moneySchema.nullable()
          })
          .strict()
      )
      .min(1)
      .optional()
  })
  .strict()
  .refine(
    (input) => input.name !== undefined || input.envelopes !== undefined,
    { message: "Update at least a name or envelopes." }
  );

export const autoFillBudgetScenarioSchema = z
  .object({
    preserveOverrides: z.boolean().default(true)
  })
  .strict();

export const updateBudgetScenarioAssignmentSchema = z
  .object({
    assignedYear: yearSchema.nullable()
  })
  .strict();

export const budgetScenarioItemSchema = budgetItemSchema
  .omit({ included: true })
  .extend({
    assignedYear: yearSchema.nullable(),
    assignmentSource: budgetScenarioAssignmentSourceSchema.nullable(),
    liveIncluded: z.boolean()
  })
  .strict();

export const budgetScenarioYearSummarySchema = z
  .object({
    year: yearSchema,
    envelope: moneySchema.nullable(),
    summary: budgetSummarySchema
  })
  .strict();

export const budgetScenarioUnassignedSummarySchema = z
  .object({
    count: z.number().int().nonnegative(),
    knownCost: moneySchema,
    missingEstimateCount: z.number().int().nonnegative()
  })
  .strict();

const budgetScenarioRecordSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1),
    status: budgetScenarioStatusSchema,
    horizonStartYear: yearSchema,
    horizonYears: z.number().int().min(1).max(15),
    years: z.array(yearSchema).min(1),
    currency: z.string().regex(/^[A-Z]{3}$/),
    adoptedAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
  .strict();

export const budgetScenarioListItemSchema = budgetScenarioRecordSchema
  .extend({
    assignedCount: z.number().int().nonnegative(),
    unassignedCount: z.number().int().nonnegative(),
    missingEstimateCount: z.number().int().nonnegative(),
    programValue: moneySchema,
    envelopeTotal: moneySchema.nullable()
  })
  .strict();

export const budgetScenarioListResponseSchema = z
  .object({
    asOf: z.string().date(),
    data: z.array(budgetScenarioListItemSchema)
  })
  .strict();

export const budgetScenarioResponseSchema = z
  .object({
    asOf: z.string().date(),
    scenario: budgetScenarioRecordSchema,
    envelopes: z.array(
      z
        .object({
          year: yearSchema,
          approvedBudget: moneySchema.nullable()
        })
        .strict()
    ),
    yearSummaries: z.array(budgetScenarioYearSummarySchema),
    unassigned: budgetScenarioUnassignedSummarySchema,
    data: z.array(budgetScenarioItemSchema)
  })
  .strict();

export const budgetScenarioCompareResponseSchema = z
  .object({
    asOf: z.string().date(),
    left: budgetScenarioResponseSchema,
    right: budgetScenarioResponseSchema
  })
  .strict();

export type BudgetScenarioStatus = z.infer<typeof budgetScenarioStatusSchema>;
export type BudgetScenarioAssignmentSource = z.infer<
  typeof budgetScenarioAssignmentSourceSchema
>;
export type CreateBudgetScenario = z.infer<typeof createBudgetScenarioSchema>;
export type UpdateBudgetScenario = z.infer<typeof updateBudgetScenarioSchema>;
export type AutoFillBudgetScenario = z.infer<typeof autoFillBudgetScenarioSchema>;
export type UpdateBudgetScenarioAssignment = z.infer<
  typeof updateBudgetScenarioAssignmentSchema
>;
export type BudgetScenarioItem = z.infer<typeof budgetScenarioItemSchema>;
export type BudgetScenarioResponse = z.infer<typeof budgetScenarioResponseSchema>;
export type BudgetScenarioListResponse = z.infer<
  typeof budgetScenarioListResponseSchema
>;
export type BudgetScenarioCompareQuery = z.infer<
  typeof budgetScenarioCompareQuerySchema
>;
export type BudgetScenarioCompareResponse = z.infer<
  typeof budgetScenarioCompareResponseSchema
>;
