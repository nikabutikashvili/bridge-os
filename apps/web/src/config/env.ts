import { z } from "zod";

export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000")
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function getWebEnv(
  source: Record<string, string | undefined> = process.env
): WebEnv {
  const parsed = webEnvSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Invalid web environment: ${formatZodIssues(parsed.error)}`
    );
  }

  return parsed.data;
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
}
