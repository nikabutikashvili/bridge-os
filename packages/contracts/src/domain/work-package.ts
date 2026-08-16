import { z } from "zod";

export const workPackageStatusSchema = z.enum([
  "DRAFT",
  "READY_FOR_REVIEW",
  "ARCHIVED"
]);

export const workPackageReadinessCodeSchema = z.enum([
  "SOURCE_EVIDENCE_AVAILABLE",
  "QUANTITIES_KNOWN",
  "CURRENT_INSPECTION_AVAILABLE",
  "COST_ESTIMATE_AVAILABLE",
  "DRAWINGS_AVAILABLE",
  "TRAFFIC_MANAGEMENT_REQUIREMENTS_KNOWN",
  "SITE_VERIFICATION_REQUIRED"
]);

export const workPackageReadinessStateSchema = z.enum([
  "AVAILABLE",
  "MISSING",
  "REQUIRED"
]);

export type WorkPackageStatus = z.infer<typeof workPackageStatusSchema>;
export type WorkPackageReadinessCode = z.infer<
  typeof workPackageReadinessCodeSchema
>;
export type WorkPackageReadinessState = z.infer<
  typeof workPackageReadinessStateSchema
>;
