import { z } from "zod";

import {
  currencyCodeSchema,
  entityAuditSchema,
  nonNegativeDecimalSchema,
  uuidSchema,
  yearSchema
} from "./common.js";

export const recommendationStatusSchema = z.enum([
  "OPEN",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
]);

const recommendationFieldsSchema = z.object({
  bridgeId: uuidSchema,
  partialStructureId: uuidSchema,
  workType: z.string().min(1).nullable(),
  description: z.string().min(1).nullable(),
  urgency: z.string().min(1).nullable(),
  quantity: nonNegativeDecimalSchema.nullable(),
  unit: z.string().min(1).nullable(),
  sourceEstimatedCost: nonNegativeDecimalSchema.nullable(),
  sourceEstimatedCostCurrency: currencyCodeSchema.nullable(),
  targetYear: yearSchema.nullable(),
  plannedYear: yearSchema.nullable(),
  status: recommendationStatusSchema.nullable()
});

type RecommendationFields = z.infer<typeof recommendationFieldsSchema>;

function addPairIssue(
  context: z.RefinementCtx,
  present: boolean,
  pairedPresent: boolean,
  path: string,
  message: string
): void {
  if (present !== pairedPresent) {
    context.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
  }
}

function validateRecommendationPairs(
  recommendation: RecommendationFields,
  context: z.RefinementCtx
): void {
    addPairIssue(
      context,
      recommendation.quantity !== null,
      recommendation.unit !== null,
      "unit",
      "Quantity and unit must be provided together"
    );
    addPairIssue(
      context,
      recommendation.sourceEstimatedCost !== null,
      recommendation.sourceEstimatedCostCurrency !== null,
      "sourceEstimatedCostCurrency",
      "Estimated cost and currency must be provided together"
    );
}

export const recommendationSchema = entityAuditSchema
  .merge(recommendationFieldsSchema)
  .strict()
  .superRefine(validateRecommendationPairs);
export const createRecommendationSchema = recommendationFieldsSchema
  .strict()
  .superRefine(validateRecommendationPairs);

export const recommendationFindingSchema = z
  .object({
    bridgeId: uuidSchema,
    partialStructureId: uuidSchema,
    recommendationId: uuidSchema,
    findingId: uuidSchema
  })
  .strict();

export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type CreateRecommendation = z.infer<typeof createRecommendationSchema>;
