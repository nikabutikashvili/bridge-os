import { z } from "zod";

import {
  entityAuditSchema,
  locationSchema,
  positiveDecimalSchema,
  uuidSchema,
  yearSchema
} from "./common.js";

export const bridgeDataOriginSchema = z.enum([
  "EXTRACTED",
  "USER_ENTERED",
  "DEMO_FIXTURE"
]);

const bridgeFieldsSchema = z.object({
  externalStructureNumber: z.string().min(1).nullable(),
  name: z.string().min(1).nullable(),
  road: z.string().min(1).nullable(),
  location: locationSchema,
  owner: z.string().min(1).nullable(),
  loadBearingResponsibility: z.string().min(1).nullable(),
  responsibleAuthority: z.string().min(1).nullable(),
  maintenanceOffice: z.string().min(1).nullable(),
  dataOrigin: bridgeDataOriginSchema.nullable()
});

export const bridgeSchema = entityAuditSchema.merge(bridgeFieldsSchema).strict();
export const createBridgeSchema = bridgeFieldsSchema.strict();

const partialStructureFieldsSchema = z.object({
  bridgeId: uuidSchema,
  externalPartialStructureNumber: z.string().min(1).nullable(),
  name: z.string().min(1).nullable(),
  constructionYear: yearSchema.nullable(),
  structureType: z.string().min(1).nullable(),
  structuralSystem: z.string().min(1).nullable(),
  lengthM: positiveDecimalSchema.nullable(),
  widthM: positiveDecimalSchema.nullable(),
  areaSqM: positiveDecimalSchema.nullable(),
  clearHeightM: positiveDecimalSchema.nullable(),
  spanCount: z.number().int().positive().nullable()
});

export const partialStructureSchema = entityAuditSchema
  .merge(partialStructureFieldsSchema)
  .strict();
export const createPartialStructureSchema = partialStructureFieldsSchema.strict();

export type Bridge = z.infer<typeof bridgeSchema>;
export type BridgeDataOrigin = z.infer<typeof bridgeDataOriginSchema>;
export type CreateBridge = z.infer<typeof createBridgeSchema>;
export type PartialStructure = z.infer<typeof partialStructureSchema>;
export type CreatePartialStructure = z.infer<typeof createPartialStructureSchema>;
