import { z } from "zod";

import {
  conditionScoreSchema,
  entityAuditSchema,
  isoDateSchema,
  uuidSchema
} from "./common.js";

export const inspectionTypeSchema = z.enum(["MAIN", "SIMPLE", "SPECIAL", "OTHER"]);

const inspectionFieldsSchema = z.object({
  bridgeId: uuidSchema,
  partialStructureId: uuidSchema,
  type: inspectionTypeSchema.nullable(),
  inspectedOn: isoDateSchema.nullable(),
  inspector: z.string().min(1).nullable(),
  conditionScore: conditionScoreSchema.nullable(),
  cycleMonths: z.number().int().positive().nullable()
});

export const inspectionSchema = entityAuditSchema.merge(inspectionFieldsSchema).strict();
export const createInspectionSchema = inspectionFieldsSchema.strict();

export type InspectionType = z.infer<typeof inspectionTypeSchema>;
export type Inspection = z.infer<typeof inspectionSchema>;
export type CreateInspection = z.infer<typeof createInspectionSchema>;
