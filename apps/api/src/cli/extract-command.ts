import { z } from "zod";

const idSchema = z.string().uuid();

export type ExtractCommand =
  | { readonly kind: "EXTRACT"; readonly documentId: string }
  | { readonly kind: "HELP" }
  | { readonly kind: "RETRY"; readonly runId: string };

export function parseExtractCommand(args: readonly string[]): ExtractCommand {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    return { kind: "HELP" };
  }
  if (args.length === 2 && args[0] === "--retry") {
    return { kind: "RETRY", runId: idSchema.parse(args[1]) };
  }
  if (args.length === 1) {
    return { documentId: idSchema.parse(args[0]), kind: "EXTRACT" };
  }
  throw new Error(
    "Usage: pnpm extract <document-id> | pnpm extract --retry <failed-run-id>"
  );
}

export const extractCommandHelp = `Usage:
  pnpm extract <document-id>
  pnpm extract --retry <failed-run-id>

The document must already be parsed and have status extraction_pending.`;
