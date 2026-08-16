import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().date();
export const timestampSchema = z.string().datetime({ offset: true });

export const yearSchema = z.number().int().min(1700).max(2200);

const unsignedDecimalPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export const nonNegativeDecimalSchema = z
  .string()
  .regex(unsignedDecimalPattern, "Expected a non-negative decimal string");

export const positiveDecimalSchema = nonNegativeDecimalSchema.refine(
  (value) => Number(value) > 0,
  "Expected a positive decimal string"
);

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Expected a three-letter uppercase currency code");

export const conditionScoreSchema = nonNegativeDecimalSchema.refine(
  (value) => Number(value) >= 1 && Number(value) <= 4,
  "Condition score must be between 1.0 and 4.0"
);

export const svdRatingSchema = z.number().int().min(0).max(4);

export const scalarPropertiesSchema = z.record(
  z.union([z.string(), z.number().finite(), z.boolean(), z.null()])
);

export const entityAuditSchema = z.object({
  id: uuidSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const locationSchema = z
  .object({
    countryCode: z.string().length(2).nullable(),
    federalState: z.string().min(1).nullable(),
    district: z.string().min(1).nullable(),
    municipality: z.string().min(1).nullable(),
    locality: z.string().min(1).nullable(),
    postalCode: z.string().min(1).nullable(),
    stationing: z.string().min(1).nullable(),
    crossedFeature: z.string().min(1).nullable(),
    latitude: nonNegativeDecimalSchema.or(z.string().regex(/^-[0-9]+(?:\.[0-9]+)?$/)).nullable(),
    longitude: nonNegativeDecimalSchema.or(z.string().regex(/^-[0-9]+(?:\.[0-9]+)?$/)).nullable()
  })
  .strict()
  .superRefine((location, context) => {
    if (location.latitude !== null && Math.abs(Number(location.latitude)) > 90) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Latitude must be between -90 and 90",
        path: ["latitude"]
      });
    }

    if (location.longitude !== null && Math.abs(Number(location.longitude)) > 180) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Longitude must be between -180 and 180",
        path: ["longitude"]
      });
    }
  });

export type ScalarProperties = z.infer<typeof scalarPropertiesSchema>;
