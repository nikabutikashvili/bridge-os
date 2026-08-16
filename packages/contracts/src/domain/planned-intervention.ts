import { z } from "zod";

import {
  currencyCodeSchema,
  entityAuditSchema,
  nonNegativeDecimalSchema,
  uuidSchema,
  yearSchema
} from "./common.js";

export const plannedInterventionStatusSchema = z.enum([
  "PLANNED",
  "BUDGETED",
  "TENDER_PREPARATION",
  "TENDERED_READY",
  "IN_PROGRESS",
  "COMPLETED"
]);

export const interventionEstimateSourceSchema = z.enum([
  "USER_PLANNING",
  "EXTERNAL_ENRICHED"
]);

export const interventionEstimateStatusSchema = z.enum([
  "DRAFT",
  "REVIEWED"
]);

const plannedInterventionFieldsSchema = z.object({
  recommendationId: uuidSchema,
  bridgeId: uuidSchema,
  partialStructureId: uuidSchema,
  workType: z.string().trim().min(1).max(200),
  plannedYear: yearSchema,
  quantity: nonNegativeDecimalSchema.nullable(),
  unit: z.string().trim().min(1).max(50).nullable(),
  estimatedCost: nonNegativeDecimalSchema.nullable(),
  estimatedCostCurrency: currencyCodeSchema.nullable(),
  estimatedCostSource: interventionEstimateSourceSchema.nullable(),
  estimatedCostStatus: interventionEstimateStatusSchema.nullable(),
  status: plannedInterventionStatusSchema
});

type PlannedInterventionFields = z.infer<
  typeof plannedInterventionFieldsSchema
>;

function validatePairs(
  intervention: PlannedInterventionFields,
  context: z.RefinementCtx
): void {
  if ((intervention.quantity === null) !== (intervention.unit === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Quantity and unit must be provided together",
      path: ["unit"]
    });
  }
  const estimateFields = [
    intervention.estimatedCost,
    intervention.estimatedCostCurrency,
    intervention.estimatedCostSource,
    intervention.estimatedCostStatus
  ];
  const estimateIsAbsent = estimateFields.every((value) => value === null);
  const estimateIsComplete = estimateFields.every((value) => value !== null);
  if (!estimateIsAbsent && !estimateIsComplete) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Estimated cost, currency, source, and status must be provided together",
      path: ["estimatedCost"]
    });
  }
}

export const plannedInterventionSchema = entityAuditSchema
  .merge(plannedInterventionFieldsSchema)
  .strict()
  .superRefine(validatePairs);

export type PlannedIntervention = z.infer<typeof plannedInterventionSchema>;
export type PlannedInterventionStatus = z.infer<
  typeof plannedInterventionStatusSchema
>;
export type InterventionEstimateSource = z.infer<
  typeof interventionEstimateSourceSchema
>;
export type InterventionEstimateStatus = z.infer<
  typeof interventionEstimateStatusSchema
>;
