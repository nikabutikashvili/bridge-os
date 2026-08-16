import { z } from "zod";

import {
  currencyCodeSchema,
  entityAuditSchema,
  isoDateSchema,
  nonNegativeDecimalSchema,
  uuidSchema
} from "./common.js";

const historicalWorkFieldsSchema = z.object({
  bridgeId: uuidSchema,
  partialStructureId: uuidSchema.nullable(),
  type: z.string().min(1).nullable(),
  title: z.string().min(1).nullable(),
  reason: z.string().min(1).nullable(),
  contractor: z.string().min(1).nullable(),
  client: z.string().min(1).nullable(),
  startedOn: isoDateSchema.nullable(),
  endedOn: isoDateSchema.nullable(),
  quantity: nonNegativeDecimalSchema.nullable(),
  unit: z.string().min(1).nullable(),
  contractAmount: nonNegativeDecimalSchema.nullable(),
  finalAmount: nonNegativeDecimalSchema.nullable(),
  currency: currencyCodeSchema.nullable()
});

type HistoricalWorkFields = z.infer<typeof historicalWorkFieldsSchema>;

function validateHistoricalWork(
  work: HistoricalWorkFields,
  context: z.RefinementCtx
): void {
    if (work.startedOn !== null && work.endedOn !== null && work.endedOn < work.startedOn) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date cannot precede start date",
        path: ["endedOn"]
      });
    }

    if ((work.quantity !== null) !== (work.unit !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quantity and unit must be provided together",
        path: ["unit"]
      });
    }

    const hasAmount = work.contractAmount !== null || work.finalAmount !== null;
    if (hasAmount !== (work.currency !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Currency is required exactly when an amount is present",
        path: ["currency"]
      });
    }
}

export const historicalWorkSchema = entityAuditSchema
  .merge(historicalWorkFieldsSchema)
  .strict()
  .superRefine(validateHistoricalWork);
export const createHistoricalWorkSchema = historicalWorkFieldsSchema
  .strict()
  .superRefine(validateHistoricalWork);

export type HistoricalWork = z.infer<typeof historicalWorkSchema>;
export type CreateHistoricalWork = z.infer<typeof createHistoricalWorkSchema>;
