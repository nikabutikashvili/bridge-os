import { z } from "zod";

import { entityAuditSchema, scalarPropertiesSchema, uuidSchema } from "./common.js";

export const documentStatusSchema = z.enum(["UPLOADED", "PROCESSING", "READY", "FAILED"]);
export const documentProcessingStatusSchema = z.enum([
  "UPLOADED",
  "PARSING",
  "PARSED",
  "EXTRACTION_PENDING",
  "EXTRACTED",
  "FAILED"
]);

const documentFieldsSchema = z.object({
  bridgeId: uuidSchema.nullable(),
  partialStructureId: uuidSchema.nullable(),
  type: z.string().min(1),
  originalFilename: z.string().min(1),
  status: documentStatusSchema,
  metadata: scalarPropertiesSchema.nullable()
});

type DocumentFields = z.infer<typeof documentFieldsSchema>;

function validateDocumentScope(document: DocumentFields, context: z.RefinementCtx): void {
  if (document.partialStructureId !== null && document.bridgeId === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A partial-structure document must also identify its bridge",
      path: ["bridgeId"]
    });
  }
}

export const documentSchema = entityAuditSchema
  .merge(documentFieldsSchema)
  .strict()
  .superRefine(validateDocumentScope);
export const createDocumentSchema = documentFieldsSchema.strict().superRefine(validateDocumentScope);

export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type DocumentProcessingStatus = z.infer<typeof documentProcessingStatusSchema>;
export type Document = z.infer<typeof documentSchema>;
export type CreateDocument = z.infer<typeof createDocumentSchema>;
