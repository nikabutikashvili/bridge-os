import { z } from "zod";

import {
  entityAuditSchema,
  nonNegativeDecimalSchema,
  uuidSchema,
  yearSchema
} from "./common.js";

export const environmentalMetricSourceSchema = z.enum(["OPEN_METEO"]);
export type EnvironmentalMetricSource = z.infer<typeof environmentalMetricSourceSchema>;

const twelveNumberArraySchema = z.array(z.number().finite()).length(12);

const environmentalMetricFieldsSchema = z.object({
  bridgeId: uuidSchema,
  observationYear: yearSchema,
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
  gridLatitude: z.string().nullable(),
  gridLongitude: z.string().nullable(),
  elevationM: nonNegativeDecimalSchema.nullable(),
  freezeThawDays: z.number().int().nonnegative().nullable(),
  frostDays: z.number().int().nonnegative().nullable(),
  iceDays: z.number().int().nonnegative().nullable(),
  wetDryCycles: z.number().int().nonnegative().nullable(),
  meanRelativeHumidityPercent: nonNegativeDecimalSchema
    .refine((value) => Number(value) <= 100, "Humidity cannot exceed 100 percent")
    .nullable(),
  precipitationHours: z.number().int().nonnegative().nullable(),
  heavyRainDays20: z.number().int().nonnegative().nullable(),
  heavyRainDays30: z.number().int().nonnegative().nullable(),
  annualPrecipMm: nonNegativeDecimalSchema.nullable(),
  deicingDays: z.number().int().nonnegative().nullable(),
  monthlyPrecipMm: twelveNumberArraySchema.nullable(),
  monthlyFreezeThawDays: twelveNumberArraySchema.nullable(),
  source: environmentalMetricSourceSchema,
  sourceDescription: z.string().min(1).nullable(),
  formulaVersion: z.string().min(1)
});

export const environmentalMetricSchema = entityAuditSchema
  .merge(environmentalMetricFieldsSchema)
  .strict();
export const createEnvironmentalMetricSchema = environmentalMetricFieldsSchema.strict();

export type EnvironmentalMetric = z.infer<typeof environmentalMetricSchema>;
export type CreateEnvironmentalMetric = z.infer<typeof createEnvironmentalMetricSchema>;

export const damageMechanismKindSchema = z.enum([
  "RC_CORROSION",
  "STEEL_CORROSION",
  "WATER_INGRESS",
  "SCOUR"
]);

export const damageMechanismBandSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const damageMechanismConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const damageMechanismReasonSchema = z
  .object({
    code: z.string().min(1),
    label: z.string().min(1),
    detail: z.string().min(1)
  })
  .strict();

export const damageMechanismLinkedFindingSchema = z
  .object({
    id: uuidSchema,
    defectType: z.string().min(1).nullable(),
    sourceIdentifier: z.string().min(1).nullable()
  })
  .strict();

export const damageMechanismAssessmentSchema = z
  .object({
    kind: damageMechanismKindSchema,
    band: damageMechanismBandSchema,
    confidence: damageMechanismConfidenceSchema,
    summary: z.string().min(1),
    reasons: z.array(damageMechanismReasonSchema),
    linkedFindings: z.array(damageMechanismLinkedFindingSchema)
  })
  .strict();

export const bridgeEnvironmentMonthSchema = z
  .object({
    month: z.number().int().min(1).max(12),
    precipMm: nonNegativeDecimalSchema,
    freezeThawDays: z.number().int().nonnegative()
  })
  .strict();

export const bridgeEnvironmentMetricsSchema = z
  .object({
    freezeThawDays: z.number().int().nonnegative().nullable(),
    frostDays: z.number().int().nonnegative().nullable(),
    iceDays: z.number().int().nonnegative().nullable(),
    wetDryCycles: z.number().int().nonnegative().nullable(),
    meanRelativeHumidityPercent: nonNegativeDecimalSchema.nullable(),
    precipitationHours: z.number().int().nonnegative().nullable(),
    heavyRainDays20: z.number().int().nonnegative().nullable(),
    heavyRainDays30: z.number().int().nonnegative().nullable(),
    annualPrecipMm: nonNegativeDecimalSchema.nullable(),
    deicingDays: z.number().int().nonnegative().nullable()
  })
  .strict();

export const bridgeEnvironmentSchema = z
  .object({
    observationYear: yearSchema,
    source: environmentalMetricSourceSchema,
    sourceDescription: z.string().min(1).nullable(),
    formulaVersion: z.string().min(1),
    policyVersion: z.literal("damage-mechanism-v1"),
    location: z
      .object({
        latitude: z.string().nullable(),
        longitude: z.string().nullable(),
        gridLatitude: z.string().nullable(),
        gridLongitude: z.string().nullable(),
        elevationM: nonNegativeDecimalSchema.nullable()
      })
      .strict(),
    metrics: bridgeEnvironmentMetricsSchema,
    monthly: z.array(bridgeEnvironmentMonthSchema),
    previousYear: z
      .object({
        observationYear: yearSchema,
        freezeThawDays: z.number().int().nonnegative().nullable(),
        heavyRainDays20: z.number().int().nonnegative().nullable(),
        annualPrecipMm: nonNegativeDecimalSchema.nullable()
      })
      .strict()
      .nullable(),
    mechanisms: z.array(damageMechanismAssessmentSchema)
  })
  .strict();

export type DamageMechanismKind = z.infer<typeof damageMechanismKindSchema>;
export type DamageMechanismBand = z.infer<typeof damageMechanismBandSchema>;
export type DamageMechanismConfidence = z.infer<typeof damageMechanismConfidenceSchema>;
export type DamageMechanismAssessment = z.infer<typeof damageMechanismAssessmentSchema>;
export type BridgeEnvironment = z.infer<typeof bridgeEnvironmentSchema>;
