import { z } from "zod";

import {
  entityAuditSchema,
  nonNegativeDecimalSchema,
  svdRatingSchema,
  uuidSchema
} from "./common.js";

export const findingStatusSchema = z.enum([
  "OPEN",
  "MONITORING",
  "RESOLVED",
  "DISMISSED"
]);

const findingFieldsSchema = z.object({
  bridgeId: uuidSchema,
  partialStructureId: uuidSchema,
  inspectionId: uuidSchema,
  componentId: uuidSchema.nullable(),
  sourceIdentifier: z.string().min(1).nullable(),
  defectType: z.string().min(1).nullable(),
  description: z.string().min(1).nullable(),
  location: z.string().min(1).nullable(),
  extent: z.string().min(1).nullable(),
  dimensionLength: nonNegativeDecimalSchema.nullable(),
  dimensionWidth: nonNegativeDecimalSchema.nullable(),
  dimensionDepth: nonNegativeDecimalSchema.nullable(),
  dimensionUnit: z.string().min(1).nullable(),
  quantity: nonNegativeDecimalSchema.nullable(),
  quantityUnit: z.string().min(1).nullable(),
  stabilityRating: svdRatingSchema.nullable(),
  trafficSafetyRating: svdRatingSchema.nullable(),
  durabilityRating: svdRatingSchema.nullable(),
  status: findingStatusSchema.nullable()
});

type FindingFields = z.infer<typeof findingFieldsSchema>;

function validateFindingPairs(finding: FindingFields, context: z.RefinementCtx): void {
    const hasDimension =
      finding.dimensionLength !== null ||
      finding.dimensionWidth !== null ||
      finding.dimensionDepth !== null;

    if (hasDimension !== (finding.dimensionUnit !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dimension unit is required exactly when a dimension is present",
        path: ["dimensionUnit"]
      });
    }

    if ((finding.quantity !== null) !== (finding.quantityUnit !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quantity and quantity unit must be provided together",
        path: ["quantityUnit"]
      });
    }
}

export const findingSchema = entityAuditSchema
  .merge(findingFieldsSchema)
  .strict()
  .superRefine(validateFindingPairs);
export const createFindingSchema = findingFieldsSchema.strict().superRefine(validateFindingPairs);

export type FindingStatus = z.infer<typeof findingStatusSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type CreateFinding = z.infer<typeof createFindingSchema>;
