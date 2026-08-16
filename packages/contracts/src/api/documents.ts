import { z } from "zod";

import { timestampSchema, uuidSchema } from "../domain/common.js";
import {
  documentProcessingStatusSchema,
  documentStatusSchema
} from "../domain/document.js";

export const documentIdParamsSchema = z.object({ id: uuidSchema }).strict();

export const documentPageParamsSchema = z
  .object({
    id: uuidSchema,
    pageNumber: z.coerce.number().int().positive()
  })
  .strict();

export const documentProcessingSummarySchema = z
  .object({
    id: uuidSchema,
    status: documentProcessingStatusSchema,
    parser: z.string().min(1).nullable(),
    pageCount: z.number().int().nonnegative().nullable(),
    error: z
      .object({ code: z.string().min(1), message: z.string().min(1) })
      .strict()
      .nullable(),
    parsingStartedAt: timestampSchema.nullable(),
    parsingCompletedAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
  .strict();

export const documentSummarySchema = z
  .object({
    id: uuidSchema,
    bridgeId: uuidSchema.nullable(),
    type: z.string().min(1),
    originalFilename: z.string().min(1),
    status: documentStatusSchema,
    checksumSha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    mimeType: z.string().min(1).nullable(),
    sizeBytes: z.number().int().positive().nullable(),
    isDemoFixture: z.boolean(),
    processing: documentProcessingSummarySchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
  .strict();

export const documentListResponseSchema = z
  .object({
    data: z.array(documentSummarySchema),
    total: z.number().int().nonnegative()
  })
  .strict();

export const documentDetailResponseSchema = z
  .object({
    data: documentSummarySchema.extend({
      pages: z
        .object({
          count: z.number().int().nonnegative(),
          pageNumbers: z.array(z.number().int().positive())
        })
        .strict()
    })
  })
  .strict();

export const documentUploadResponseSchema = documentDetailResponseSchema
  .extend({ duplicate: z.boolean() })
  .strict();

export const documentPageResponseSchema = z
  .object({
    data: z
      .object({
        documentId: uuidSchema,
        pageNumber: z.number().int().positive(),
        textContent: z.string(),
        createdAt: timestampSchema,
        updatedAt: timestampSchema
      })
      .strict()
  })
  .strict();

export type DocumentSummary = z.infer<typeof documentSummarySchema>;
export type DocumentDetailResponse = z.infer<typeof documentDetailResponseSchema>;
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
export type DocumentUploadResponse = z.infer<typeof documentUploadResponseSchema>;
export type DocumentPageResponse = z.infer<typeof documentPageResponseSchema>;
