import { z } from "zod";

import {
  boundingBoxSchema,
  evidenceReviewStateSchema,
  extractionMethodSchema,
  provenanceKindSchema
} from "../domain/provenance.js";
import { nonNegativeDecimalSchema, uuidSchema, yearSchema } from "../domain/common.js";

export const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        details: z.unknown().optional(),
        message: z.string().min(1),
        requestId: z.string().min(1)
      })
      .strict()
  })
  .strict();

export const evidenceCitationSchema = z
  .object({
    evidenceId: uuidSchema,
    documentId: uuidSchema,
    documentType: z.string().min(1),
    originalFilename: z.string().min(1),
    pageNumber: z.number().int().positive().nullable(),
    excerpt: z.string().min(1).nullable(),
    boundingBox: boundingBoxSchema.nullable(),
    extractionConfidence: nonNegativeDecimalSchema.nullable(),
    extractionMethod: extractionMethodSchema,
    reviewState: evidenceReviewStateSchema.nullable(),
    fieldName: z.string().min(1),
    kind: provenanceKindSchema,
    derivationMethod: z.string().min(1).nullable(),
    viewSourceUrl: z
      .string()
      .url()
      .refine((value) => {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      }, "Source URL must use HTTP or HTTPS")
      .nullable()
  })
  .strict();

export const quantitySchema = z
  .object({
    value: nonNegativeDecimalSchema,
    unit: z.string().min(1)
  })
  .strict();

export const moneySchema = z
  .object({
    amount: nonNegativeDecimalSchema,
    currency: z.string().regex(/^[A-Z]{3}$/)
  })
  .strict();

/**
 * A construction-price-index projection of a historical cost estimate onto a
 * later year. Always a supplementary, clearly-labelled approximation of the
 * original `moneySchema` figure it accompanies — never a replacement for it.
 */
export const inflationAdjustedEstimateSchema = z
  .object({
    amount: nonNegativeDecimalSchema,
    currency: z.string().regex(/^[A-Z]{3}$/),
    sourceYear: yearSchema,
    asOfYear: yearSchema,
    indexName: z.string().min(1),
    indexBaseYear: yearSchema,
    extrapolated: z.boolean()
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export type EvidenceCitation = z.infer<typeof evidenceCitationSchema>;
export type InflationAdjustedEstimate = z.infer<typeof inflationAdjustedEstimateSchema>;
