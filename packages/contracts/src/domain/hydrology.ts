import { z } from "zod";

import {
  entityAuditSchema,
  isoDateSchema,
  nonNegativeDecimalSchema,
  timestampSchema,
  uuidSchema,
  yearSchema
} from "./common.js";

export const hydrologicalMetricSourceSchema = z.enum(["PEGELONLINE", "WSV_PUBLISHED"]);
export type HydrologicalMetricSource = z.infer<typeof hydrologicalMetricSourceSchema>;

export const hydrologicalWaterStateSchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "UNKNOWN",
  "COMMENTED",
  "OUTDATED"
]);
export type HydrologicalWaterState = z.infer<typeof hydrologicalWaterStateSchema>;

export const floodExposureBandSchema = z.enum([
  "BELOW_TRIGGER",
  "MODERATE",
  "HIGH",
  "EXTREME"
]);
export type FloodExposureBand = z.infer<typeof floodExposureBandSchema>;

const characteristicThresholdFields = {
  mhwCm: z.number().int().nonnegative().nullable(),
  hswCm: z.number().int().nonnegative().nullable(),
  hhwCm: z.number().int().nonnegative().nullable(),
  markeICm: z.number().int().nonnegative().nullable(),
  markeIICm: z.number().int().nonnegative().nullable()
};

const hydrologicalMetricFieldsSchema = z.object({
  bridgeId: uuidSchema,
  stationUuid: uuidSchema,
  stationName: z.string().min(1),
  stationNumber: z.string().min(1).nullable(),
  waterName: z.string().min(1),
  riverKm: nonNegativeDecimalSchema.nullable(),
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
  distanceKm: nonNegativeDecimalSchema.nullable(),
  observedAt: timestampSchema,
  waterLevelCm: z.number().int().nonnegative(),
  unit: z.string().min(1),
  stateMnwMhw: hydrologicalWaterStateSchema.nullable(),
  stateNswHsw: hydrologicalWaterStateSchema.nullable(),
  ...characteristicThresholdFields,
  mnwCm: z.number().int().nonnegative().nullable(),
  mwCm: z.number().int().nonnegative().nullable(),
  inspectionTriggerCm: z.number().int().nonnegative(),
  source: hydrologicalMetricSourceSchema,
  sourceDescription: z.string().min(1).nullable(),
  formulaVersion: z.string().min(1)
});

export const hydrologicalMetricSchema = entityAuditSchema
  .merge(hydrologicalMetricFieldsSchema)
  .strict();
export const createHydrologicalMetricSchema = hydrologicalMetricFieldsSchema.strict();

export type HydrologicalMetric = z.infer<typeof hydrologicalMetricSchema>;
export type CreateHydrologicalMetric = z.infer<typeof createHydrologicalMetricSchema>;

const hydrologicalFloodEventFieldsSchema = z.object({
  bridgeId: uuidSchema,
  eventYear: yearSchema,
  peakedOn: isoDateSchema,
  peakWaterLevelCm: z.number().int().nonnegative(),
  stationUuid: uuidSchema,
  stationName: z.string().min(1),
  waterName: z.string().min(1),
  ...characteristicThresholdFields,
  source: hydrologicalMetricSourceSchema,
  sourceDescription: z.string().min(1).nullable()
});

export const hydrologicalFloodEventSchema = entityAuditSchema
  .merge(hydrologicalFloodEventFieldsSchema)
  .strict()
  .superRefine((event, context) => {
    if (Number(event.peakedOn.slice(0, 4)) !== event.eventYear) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "peakedOn must fall in eventYear",
        path: ["peakedOn"]
      });
    }
  });
export const createHydrologicalFloodEventSchema = hydrologicalFloodEventFieldsSchema
  .strict()
  .superRefine((event, context) => {
    if (Number(event.peakedOn.slice(0, 4)) !== event.eventYear) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "peakedOn must fall in eventYear",
        path: ["peakedOn"]
      });
    }
  });

export type HydrologicalFloodEvent = z.infer<typeof hydrologicalFloodEventSchema>;
export type CreateHydrologicalFloodEvent = z.infer<
  typeof createHydrologicalFloodEventSchema
>;

export const floodExposureReasonSchema = z
  .object({
    code: z.string().min(1),
    label: z.string().min(1),
    detail: z.string().min(1)
  })
  .strict();

export const floodHistoryLinkedInspectionSchema = z
  .object({
    id: uuidSchema,
    inspectedOn: isoDateSchema
  })
  .strict();

export const floodHistoryLinkedFindingSchema = z
  .object({
    id: uuidSchema,
    defectType: z.string().min(1).nullable(),
    sourceIdentifier: z.string().min(1).nullable(),
    status: z.string().min(1).nullable()
  })
  .strict();

export const floodHistoryLinkedWorkSchema = z
  .object({
    id: uuidSchema,
    title: z.string().min(1).nullable(),
    endedOn: isoDateSchema.nullable()
  })
  .strict();

export const floodHistoryEventSchema = z
  .object({
    eventYear: yearSchema,
    peakedOn: isoDateSchema,
    peakWaterLevelCm: z.number().int().nonnegative(),
    band: floodExposureBandSchema,
    stationName: z.string().min(1),
    waterName: z.string().min(1),
    specialInspection: floodHistoryLinkedInspectionSchema.nullable(),
    scourFinding: floodHistoryLinkedFindingSchema.nullable(),
    repair: floodHistoryLinkedWorkSchema.nullable()
  })
  .strict();

export const floodRecommendedActionSchema = z
  .object({
    kind: z.literal("EXTRAORDINARY_INSPECTION"),
    eventYear: yearSchema,
    peakedOn: isoDateSchema,
    summary: z.string().min(1)
  })
  .strict();

export const floodExposureAssessmentSchema = z
  .object({
    band: floodExposureBandSchema,
    triggerExceeded: z.boolean(),
    scourSensitive: z.boolean(),
    hasOpenScourFinding: z.boolean(),
    unmatchedPostFloodInspection: z.boolean(),
    summary: z.string().min(1),
    reasons: z.array(floodExposureReasonSchema),
    history: z.array(floodHistoryEventSchema),
    recommendedAction: floodRecommendedActionSchema.nullable()
  })
  .strict();

export const bridgeHydrologySchema = z
  .object({
    stationUuid: uuidSchema,
    stationName: z.string().min(1),
    stationNumber: z.string().min(1).nullable(),
    waterName: z.string().min(1),
    riverKm: nonNegativeDecimalSchema.nullable(),
    distanceKm: nonNegativeDecimalSchema.nullable(),
    observedAt: timestampSchema,
    waterLevelCm: z.number().int().nonnegative(),
    unit: z.string().min(1),
    stateMnwMhw: hydrologicalWaterStateSchema.nullable(),
    stateNswHsw: hydrologicalWaterStateSchema.nullable(),
    mhwCm: z.number().int().nonnegative().nullable(),
    hswCm: z.number().int().nonnegative().nullable(),
    hhwCm: z.number().int().nonnegative().nullable(),
    mnwCm: z.number().int().nonnegative().nullable(),
    mwCm: z.number().int().nonnegative().nullable(),
    markeICm: z.number().int().nonnegative().nullable(),
    markeIICm: z.number().int().nonnegative().nullable(),
    inspectionTriggerCm: z.number().int().nonnegative(),
    source: hydrologicalMetricSourceSchema,
    sourceDescription: z.string().min(1).nullable(),
    formulaVersion: z.string().min(1),
    policyVersion: z.literal("flood-exposure-v1"),
    location: z
      .object({
        latitude: z.string().nullable(),
        longitude: z.string().nullable()
      })
      .strict(),
    assessment: floodExposureAssessmentSchema
  })
  .strict();

export type FloodExposureReason = z.infer<typeof floodExposureReasonSchema>;
export type FloodHistoryEvent = z.infer<typeof floodHistoryEventSchema>;
export type FloodRecommendedAction = z.infer<typeof floodRecommendedActionSchema>;
export type FloodExposureAssessment = z.infer<typeof floodExposureAssessmentSchema>;
export type BridgeHydrology = z.infer<typeof bridgeHydrologySchema>;
