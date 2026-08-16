import { z } from "zod";

export interface FixtureCommand {
  readonly directory: string;
  readonly expectedDocumentCount: number;
  readonly json: boolean;
  readonly kind: "INGEST";
  readonly reextract: boolean;
  readonly reparse: boolean;
}

export type ParsedFixtureCommand = FixtureCommand | { readonly kind: "HELP" };

const positiveIntegerSchema = z.coerce.number().int().positive();

export function parseFixtureCommand(args: readonly string[]): ParsedFixtureCommand {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "HELP" };
  }

  let directory = "fixtures/bauwerksbuch";
  let expectedDocumentCount = 5;
  let json = false;
  let reextract = false;
  let reparse = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") {
      json = true;
    } else if (argument === "--reextract") {
      reextract = true;
    } else if (argument === "--reparse") {
      reparse = true;
    } else if (argument === "--dir") {
      directory = requireValue(args, index, argument);
      index += 1;
    } else if (argument === "--expect-count") {
      expectedDocumentCount = positiveIntegerSchema.parse(
        requireValue(args, index, argument)
      );
      index += 1;
    } else {
      throw new Error(`Unknown fixture ingestion option: ${argument ?? ""}`);
    }
  }
  return {
    directory,
    expectedDocumentCount,
    json,
    kind: "INGEST",
    reextract,
    reparse
  };
}

function requireValue(
  args: readonly string[],
  index: number,
  option: string
): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

export const fixtureCommandHelp = `Usage:
  pnpm fixtures:ingest [--dir fixtures/bauwerksbuch] [--expect-count 5]
  pnpm fixtures:ingest --reextract
  pnpm fixtures:ingest --reparse
  pnpm fixtures:ingest --json

The command is development-only, processes PDFs in filename order, and skips
already ingested checksums. --reparse re-runs PDF text extraction (including OCR
for scanned pages) for those checksums, then extracts from the new page text.
--reextract explicitly reruns successful extraction and replaces unused
automatically extracted records. Reviewed or manually changed records remain
protected.`;
