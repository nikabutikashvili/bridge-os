import { z } from "zod";

const logLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent"
]);

export const apiEnvSchema = z.object({
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.string().url(),
  DOCUMENT_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(100 * 1_024 * 1_024)
    .default(25 * 1_024 * 1_024),
  DOCUMENT_STORAGE_ROOT: z.string().min(1).default(".data/documents"),
  LOG_LEVEL: logLevelSchema.default("info"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development")
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const extractionModelEnvSchema = z
  .object({
    EXTRACTION_MODEL_PROVIDER: z.literal("openai").default("openai"),
    EXTRACTION_MODEL: z.string().trim().min(1),
    EXTRACTION_MODEL_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .min(512)
      .max(100_000)
      .default(12_000),
    OPENAI_API_KEY: z.string().trim().min(1),
    OPENAI_BASE_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional()
    )
  })
  .strict();

export type ExtractionModelEnv = z.infer<typeof extractionModelEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = apiEnvSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Invalid API environment: ${formatZodIssues(parsed.error)}`
    );
  }

  return parsed.data;
}

export function loadExtractionModelEnv(
  source: NodeJS.ProcessEnv = process.env
): ExtractionModelEnv {
  const selected = {
    EXTRACTION_MODEL_PROVIDER: source["EXTRACTION_MODEL_PROVIDER"],
    EXTRACTION_MODEL: source["EXTRACTION_MODEL"],
    EXTRACTION_MODEL_MAX_OUTPUT_TOKENS:
      source["EXTRACTION_MODEL_MAX_OUTPUT_TOKENS"],
    OPENAI_API_KEY: source["OPENAI_API_KEY"],
    OPENAI_BASE_URL: source["OPENAI_BASE_URL"]
  };
  const parsed = extractionModelEnvSchema.safeParse(selected);
  if (!parsed.success) {
    throw new Error(
      `Invalid extraction model environment: ${formatZodIssues(parsed.error)}`
    );
  }
  return parsed.data;
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
}
