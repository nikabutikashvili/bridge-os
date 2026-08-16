import { z } from "zod";

import {
  entityAuditSchema,
  scalarPropertiesSchema,
  uuidSchema,
  yearSchema
} from "./common.js";

const componentFieldsSchema = z.object({
  bridgeId: uuidSchema,
  partialStructureId: uuidSchema,
  type: z.string().min(1).nullable(),
  name: z.string().min(1).nullable(),
  location: z.string().min(1).nullable(),
  material: z.string().min(1).nullable(),
  constructionYear: yearSchema.nullable(),
  installYear: yearSchema.nullable(),
  additionalProperties: scalarPropertiesSchema.nullable()
});

export const componentSchema = entityAuditSchema.merge(componentFieldsSchema).strict();
export const createComponentSchema = componentFieldsSchema.strict();

export type Component = z.infer<typeof componentSchema>;
export type CreateComponent = z.infer<typeof createComponentSchema>;
