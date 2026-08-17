import { z } from "zod";

import { entityAuditSchema, isoDateSchema, nonNegativeDecimalSchema, uuidSchema } from "./common.js";

export const trafficObservationSourceSchema = z.enum(["DOCUMENT", "EXTERNAL_ENRICHED"]);
export type TrafficObservationSource = z.infer<typeof trafficObservationSourceSchema>;

const trafficObservationFieldsSchema = z.object({
  bridgeId: uuidSchema,
  observationYear: z.number().int().min(1900).max(2200),
  observedOn: isoDateSchema.nullable(),
  dailyTraffic: z.number().int().nonnegative().nullable(),
  truckSharePercent: nonNegativeDecimalSchema
    .refine((value) => Number(value) <= 100, "Truck share cannot exceed 100 percent")
    .nullable(),
  source: trafficObservationSourceSchema,
  sourceDescription: z.string().min(1).nullable()
});

type TrafficObservationFields = z.infer<typeof trafficObservationFieldsSchema>;

function validateObservationDate(
  observation: TrafficObservationFields,
  context: z.RefinementCtx
): void {
    if (
      observation.observedOn !== null &&
      Number(observation.observedOn.slice(0, 4)) !== observation.observationYear
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Observation date must fall within the observation year",
        path: ["observedOn"]
      });
    }
}

export const trafficObservationSchema = entityAuditSchema
  .merge(trafficObservationFieldsSchema)
  .strict()
  .superRefine(validateObservationDate);
export const createTrafficObservationSchema = trafficObservationFieldsSchema
  .strict()
  .superRefine(validateObservationDate);

export type TrafficObservation = z.infer<typeof trafficObservationSchema>;
export type CreateTrafficObservation = z.infer<typeof createTrafficObservationSchema>;
