import { z } from "zod";

import {
  entityAuditSchema,
  nonNegativeDecimalSchema,
  uuidSchema,
  yearSchema
} from "./common.js";

export const networkMetricSourceSchema = z.enum([
  "OSM_ROUTED",
  "MANUAL_FIXTURE",
  "SIB_ASB",
  "BAST_NETWORK"
]);
export type NetworkMetricSource = z.infer<typeof networkMetricSourceSchema>;

export const networkRoadClassSchema = z.enum([
  "AUTOBAHN",
  "BUNDESSTRASSE",
  "LANDESSTRASSE",
  "OTHER"
]);
export type NetworkRoadClass = z.infer<typeof networkRoadClassSchema>;

export const networkTrafficAppliesToSchema = z.enum(["CARRIED", "CROSSED"]);
export type NetworkTrafficAppliesTo = z.infer<typeof networkTrafficAppliesToSchema>;

export const networkCriticalityBandSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type NetworkCriticalityBand = z.infer<typeof networkCriticalityBandSchema>;

const networkMetricFieldsSchema = z.object({
  bridgeId: uuidSchema,
  observationYear: yearSchema,
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
  carriedRoad: z.string().min(1).nullable(),
  roadClass: networkRoadClassSchema,
  trafficAppliesTo: networkTrafficAppliesToSchema,
  normalTripKm: nonNegativeDecimalSchema.nullable(),
  closureDetourKm: nonNegativeDecimalSchema.nullable(),
  additionalDistanceKm: nonNegativeDecimalSchema.nullable(),
  alternativeCrossingCount: z.number().int().nonnegative().nullable(),
  onStrategicNetwork: z.boolean(),
  source: networkMetricSourceSchema,
  sourceDescription: z.string().min(1).nullable(),
  formulaVersion: z.string().min(1)
});

export const networkMetricSchema = entityAuditSchema.merge(networkMetricFieldsSchema).strict();
export const createNetworkMetricSchema = networkMetricFieldsSchema.strict();

export type NetworkMetric = z.infer<typeof networkMetricSchema>;
export type CreateNetworkMetric = z.infer<typeof createNetworkMetricSchema>;

export const networkCriticalityReasonSchema = z
  .object({
    code: z.string().min(1),
    label: z.string().min(1),
    detail: z.string().min(1)
  })
  .strict();

export const networkCriticalityAssessmentSchema = z
  .object({
    band: networkCriticalityBandSchema,
    points: z.number().int().nonnegative(),
    extraVehicleKmPerDay: z.number().nonnegative().nullable(),
    extraHeavyVehicleKmPerDay: z.number().nonnegative().nullable(),
    summary: z.string().min(1),
    reasons: z.array(networkCriticalityReasonSchema)
  })
  .strict();

export const bridgeNetworkSchema = z
  .object({
    observationYear: yearSchema,
    source: networkMetricSourceSchema,
    sourceDescription: z.string().min(1).nullable(),
    formulaVersion: z.string().min(1),
    policyVersion: z.literal("network-criticality-v1"),
    location: z
      .object({
        latitude: z.string().nullable(),
        longitude: z.string().nullable()
      })
      .strict(),
    carriedRoad: z.string().min(1).nullable(),
    roadClass: networkRoadClassSchema,
    trafficAppliesTo: networkTrafficAppliesToSchema,
    onStrategicNetwork: z.boolean(),
    distances: z
      .object({
        normalTripKm: nonNegativeDecimalSchema.nullable(),
        closureDetourKm: nonNegativeDecimalSchema.nullable(),
        additionalDistanceKm: nonNegativeDecimalSchema.nullable()
      })
      .strict(),
    alternativeCrossingCount: z.number().int().nonnegative().nullable(),
    traffic: z
      .object({
        dailyTraffic: z.number().int().nonnegative().nullable(),
        heavyVehicleDaily: z.number().int().nonnegative().nullable(),
        truckSharePercent: nonNegativeDecimalSchema.nullable()
      })
      .strict(),
    assessment: networkCriticalityAssessmentSchema
  })
  .strict();

export const bridgePortfolioNetworkSchema = z
  .object({
    band: networkCriticalityBandSchema,
    additionalDistanceKm: nonNegativeDecimalSchema.nullable(),
    extraVehicleKmPerDay: z.number().nonnegative().nullable(),
    alternativeCrossingCount: z.number().int().nonnegative().nullable()
  })
  .strict();

export type NetworkCriticalityReason = z.infer<typeof networkCriticalityReasonSchema>;
export type NetworkCriticalityAssessment = z.infer<
  typeof networkCriticalityAssessmentSchema
>;
export type BridgeNetwork = z.infer<typeof bridgeNetworkSchema>;
export type BridgePortfolioNetwork = z.infer<typeof bridgePortfolioNetworkSchema>;
