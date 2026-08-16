import {
  historicalWorksCostsExtractionSchema,
  type SectionExtractionOutput
} from "@bridge-os/contracts";
import { z } from "zod";

import { normalizeHistoricalWorksExtraction } from "../../normalize-extraction.js";
import {
  buildSectionUserPrompt,
  extractionGuardrailsPrompt,
  sectionExtractorInputBaseSchema
} from "./shared.js";

export const historicalWorksInputSchema = sectionExtractorInputBaseSchema.extend({
  category: z.literal("HISTORICAL_WORKS_COSTS")
});

export const historicalWorksPrompt = `${extractionGuardrailsPrompt}

Extract completed historical construction or maintenance works and their source-listed costs. Do not treat recommendations as completed work. Preserve contractor, client, dates, quantities, currency, contract amount, and final amount only when explicitly present. partialStructureRef may be null when the source does not identify one.`;

type HistoricalWorksOutput = Extract<
  SectionExtractionOutput,
  { category: "HISTORICAL_WORKS_COSTS" }
>;

export const historicalWorksExtractor = {
  category: "HISTORICAL_WORKS_COSTS",
  inputSchema: historicalWorksInputSchema,
  normalize: normalizeHistoricalWorksExtraction,
  outputName: "bridge_historical_works",
  outputSchema: historicalWorksCostsExtractionSchema,
  promptVersion: "historical-works-costs.de.v2",
  prompt: historicalWorksPrompt,
  userPrompt: buildSectionUserPrompt
} as const satisfies {
  readonly category: "HISTORICAL_WORKS_COSTS";
  readonly inputSchema: typeof historicalWorksInputSchema;
  readonly normalize: (output: HistoricalWorksOutput) => unknown;
  readonly outputName: string;
  readonly outputSchema: typeof historicalWorksCostsExtractionSchema;
  readonly promptVersion: string;
  readonly prompt: string;
  readonly userPrompt: typeof buildSectionUserPrompt;
};
