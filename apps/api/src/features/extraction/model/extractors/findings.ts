import {
  findingsDamageExtractionSchema,
  type SectionExtractionOutput
} from "@bridge-os/contracts";
import { z } from "zod";

import { normalizeFindingsExtraction } from "../../normalize-extraction.js";
import {
  buildSectionUserPrompt,
  extractionGuardrailsPrompt,
  sectionExtractorInputBaseSchema
} from "./shared.js";

export const findingsInputSchema = sectionExtractorInputBaseSchema.extend({
  category: z.literal("FINDINGS_DAMAGE")
});

export const findingsPrompt = `${extractionGuardrailsPrompt}

Extract every numbered Schaden row such as [9] S=0, V=0, D=1 BSP-ID 006-01-01 without merging distinct source identifiers. sourceIdentifier is the bracket number. Copy S, V, and D as integers 0-4 when present. Preserve the German defect description. Reuse inspectionRef and partialStructureRef from the registry when possible; if the registry is empty, use inspection:document and keep the finding. Set componentRef null unless an exact registry key is supplied.`;

type FindingsOutput = Extract<
  SectionExtractionOutput,
  { category: "FINDINGS_DAMAGE" }
>;

export const findingsExtractor = {
  category: "FINDINGS_DAMAGE",
  inputSchema: findingsInputSchema,
  normalize: normalizeFindingsExtraction,
  outputName: "bridge_findings",
  outputSchema: findingsDamageExtractionSchema,
  promptVersion: "findings-damage.de.v3",
  prompt: findingsPrompt,
  userPrompt: buildSectionUserPrompt
} as const satisfies {
  readonly category: "FINDINGS_DAMAGE";
  readonly inputSchema: typeof findingsInputSchema;
  readonly normalize: (output: FindingsOutput) => unknown;
  readonly outputName: string;
  readonly outputSchema: typeof findingsDamageExtractionSchema;
  readonly promptVersion: string;
  readonly prompt: string;
  readonly userPrompt: typeof buildSectionUserPrompt;
};
