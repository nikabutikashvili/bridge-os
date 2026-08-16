import { z } from "zod";

import {
  isoDateSchema,
  nonNegativeDecimalSchema,
  scalarPropertiesSchema,
  svdRatingSchema,
  timestampSchema,
  uuidSchema,
  yearSchema
} from "../domain/common.js";
import { findingStatusSchema } from "../domain/finding.js";
import { inspectionTypeSchema } from "../domain/inspection.js";
import {
  interventionEstimateSourceSchema,
  interventionEstimateStatusSchema,
  plannedInterventionStatusSchema
} from "../domain/planned-intervention.js";
import {
  workPackageReadinessCodeSchema,
  workPackageReadinessStateSchema,
  workPackageStatusSchema
} from "../domain/work-package.js";
import { evidenceCitationSchema, moneySchema, quantitySchema } from "./common.js";
import { inspectionDueStatusSchema } from "./bridges.js";

export const workPackageDisclaimerSchema = z.literal(
  "Planning draft — requires technical and procurement review."
);

export const workPackageReadinessItemSchema = z
  .object({
    code: workPackageReadinessCodeSchema,
    label: z.string().min(1),
    state: workPackageReadinessStateSchema,
    detail: z.string().min(1)
  })
  .strict();

const workPackageBridgeSchema = z
  .object({
    id: uuidSchema,
    externalStructureNumber: z.string().min(1).nullable(),
    name: z.string().min(1).nullable(),
    road: z.string().min(1).nullable(),
    location: z
      .object({
        federalState: z.string().min(1).nullable(),
        district: z.string().min(1).nullable(),
        municipality: z.string().min(1).nullable(),
        locality: z.string().min(1).nullable(),
        crossedFeature: z.string().min(1).nullable()
      })
      .strict(),
    responsibleAuthority: z.string().min(1).nullable(),
    maintenanceOffice: z.string().min(1).nullable()
  })
  .strict();

const workPackagePartialStructureSchema = z
  .object({
    id: uuidSchema,
    externalNumber: z.string().min(1).nullable(),
    name: z.string().min(1).nullable()
  })
  .strict();

const workPackageComponentSchema = z
  .object({
    id: uuidSchema,
    type: z.string().min(1).nullable(),
    name: z.string().min(1).nullable(),
    location: z.string().min(1).nullable(),
    material: z.string().min(1).nullable(),
    constructionYear: yearSchema.nullable(),
    installYear: yearSchema.nullable(),
    additionalProperties: scalarPropertiesSchema.nullable()
  })
  .strict();

const workPackageInspectionSchema = z
  .object({
    id: uuidSchema,
    type: inspectionTypeSchema.nullable(),
    inspectedOn: isoDateSchema.nullable(),
    inspector: z.string().min(1).nullable(),
    conditionScore: nonNegativeDecimalSchema.nullable()
  })
  .strict();

const workPackageFindingSchema = z
  .object({
    id: uuidSchema,
    sourceIdentifier: z.string().min(1).nullable(),
    defectType: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
    location: z.string().min(1).nullable(),
    extent: z.string().min(1).nullable(),
    quantity: quantitySchema.nullable(),
    ratings: z
      .object({
        stability: svdRatingSchema.nullable(),
        trafficSafety: svdRatingSchema.nullable(),
        durability: svdRatingSchema.nullable()
      })
      .strict(),
    status: findingStatusSchema.nullable(),
    componentId: uuidSchema.nullable(),
    inspectionId: uuidSchema
  })
  .strict();

const workPackageDocumentSchema = z
  .object({
    id: uuidSchema,
    type: z.string().min(1),
    originalFilename: z.string().min(1),
    status: z.enum(["UPLOADED", "PROCESSING", "READY", "FAILED"]),
    evidencePages: z.array(z.number().int().positive()),
    isDrawing: z.boolean(),
    isPhoto: z.boolean(),
    viewSourceUrl: z.string().url().nullable()
  })
  .strict();

const workPackageEvidenceSchema = z
  .object({
    entityType: z.enum([
      "BRIDGE",
      "PARTIAL_STRUCTURE",
      "COMPONENT",
      "INSPECTION",
      "FINDING",
      "RECOMMENDATION",
      "TRAFFIC_OBSERVATION"
    ]),
    entityId: uuidSchema,
    citation: evidenceCitationSchema
  })
  .strict();

export const workPackageSnapshotSchema = z
  .object({
    version: z.literal(1),
    generatedAt: timestampSchema,
    disclaimer: workPackageDisclaimerSchema,
    asset: z
      .object({
        bridge: workPackageBridgeSchema,
        partialStructure: workPackagePartialStructureSchema
      })
      .strict(),
    scope: z
      .object({
        interventionId: uuidSchema,
        recommendationId: uuidSchema,
        workType: z.string().min(1),
        description: z.string().min(1).nullable(),
        urgency: z.string().min(1).nullable(),
        plannedYear: yearSchema,
        quantity: quantitySchema.nullable(),
        quantitySource: z
          .enum(["PLANNED_INTERVENTION", "SOURCE_RECOMMENDATION"])
          .nullable(),
        components: z.array(workPackageComponentSchema),
        findings: z.array(workPackageFindingSchema)
      })
      .strict(),
    technicalContext: z
      .object({
        constructionYear: yearSchema.nullable(),
        structureType: z.string().min(1).nullable(),
        structuralSystem: z.string().min(1).nullable(),
        dimensions: z
          .object({
            lengthM: nonNegativeDecimalSchema.nullable(),
            widthM: nonNegativeDecimalSchema.nullable(),
            areaSqM: nonNegativeDecimalSchema.nullable(),
            clearHeightM: nonNegativeDecimalSchema.nullable(),
            spanCount: z.number().int().positive().nullable()
          })
          .strict()
      })
      .strict(),
    operationalContext: z
      .object({
        traffic: z
          .object({
            observationYear: yearSchema,
            observedOn: isoDateSchema.nullable(),
            dailyTraffic: z.number().int().nonnegative().nullable(),
            truckSharePercent: nonNegativeDecimalSchema.nullable()
          })
          .strict()
          .nullable(),
        inspectionAccessEquipment: z.string().min(1).nullable(),
        knownConstraints: z.array(z.string().min(1)),
        trafficManagementRequirements: z.string().min(1).nullable()
      })
      .strict(),
    evidence: z
      .object({
        sourceInspections: z.array(workPackageInspectionSchema),
        latestInspection: workPackageInspectionSchema
          .extend({ dueStatus: inspectionDueStatusSchema })
          .strict()
          .nullable(),
        citations: z.array(workPackageEvidenceSchema),
        documents: z.array(workPackageDocumentSchema)
      })
      .strict(),
    commercialPlanning: z
      .object({
        plannedYear: yearSchema,
        planningEstimate: moneySchema.nullable(),
        estimateSource: interventionEstimateSourceSchema.nullable(),
        estimateStatus: interventionEstimateStatusSchema.nullable(),
        sourceRecommendationEstimate: moneySchema.nullable()
      })
      .strict(),
    readiness: z.array(workPackageReadinessItemSchema)
  })
  .strict();

export const workPackageParamsSchema = z
  .object({ id: uuidSchema })
  .strict();

export const createWorkPackageSchema = z
  .object({ plannedInterventionId: uuidSchema })
  .strict();

export const workPackageReadinessSummarySchema = z
  .object({
    available: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    required: z.number().int().nonnegative(),
    total: z.number().int().positive()
  })
  .strict();

export const workPackageSummarySchema = z
  .object({
    id: uuidSchema,
    title: z.string().min(1),
    status: workPackageStatusSchema,
    snapshotVersion: z.literal(1),
    generatedAt: timestampSchema,
    bridge: workPackageBridgeSchema.pick({
      id: true,
      externalStructureNumber: true,
      name: true,
      road: true
    }),
    workType: z.string().min(1),
    plannedYear: yearSchema,
    readiness: workPackageReadinessSummarySchema
  })
  .strict();

export const workPackageEligibleInterventionSchema = z
  .object({
    id: uuidSchema,
    workType: z.string().min(1),
    plannedYear: yearSchema,
    status: plannedInterventionStatusSchema,
    quantity: quantitySchema.nullable(),
    planningEstimate: moneySchema.nullable(),
    estimateSource: interventionEstimateSourceSchema.nullable(),
    bridge: workPackageBridgeSchema.pick({
      id: true,
      externalStructureNumber: true,
      name: true,
      road: true
    })
  })
  .strict();

export const workPackageListResponseSchema = z
  .object({
    data: z.array(workPackageSummarySchema),
    eligibleInterventions: z.array(workPackageEligibleInterventionSchema)
  })
  .strict();

export const workPackageDetailResponseSchema = z
  .object({
    data: z
      .object({
        id: uuidSchema,
        title: z.string().min(1),
        status: workPackageStatusSchema,
        snapshotVersion: z.literal(1),
        generatedAt: timestampSchema,
        snapshot: workPackageSnapshotSchema
      })
      .strict()
  })
  .strict();

export const createWorkPackageResponseSchema = workPackageDetailResponseSchema;

export type WorkPackageSnapshot = z.infer<typeof workPackageSnapshotSchema>;
export type WorkPackageReadinessItem = z.infer<
  typeof workPackageReadinessItemSchema
>;
export type WorkPackageListResponse = z.infer<
  typeof workPackageListResponseSchema
>;
export type WorkPackageDetailResponse = z.infer<
  typeof workPackageDetailResponseSchema
>;
export type CreateWorkPackage = z.infer<typeof createWorkPackageSchema>;
