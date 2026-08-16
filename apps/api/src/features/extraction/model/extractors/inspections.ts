import {
  inspectionsExtractionSchema,
  type SectionExtractionOutput
} from "@bridge-os/contracts";
import { z } from "zod";

import { normalizeInspectionsExtraction } from "../../normalize-extraction.js";
import {
  buildSectionUserPrompt,
  extractionGuardrailsPrompt,
  sectionExtractorInputBaseSchema
} from "./shared.js";

export const inspectionsInputSchema = sectionExtractorInputBaseSchema.extend({
  category: z.literal("INSPECTIONS")
});

export const inspectionsPrompt = `${extractionGuardrailsPrompt}

Extract each dated row from section 7.3 / Durchgeführte Prüfungen. Map Hauptprüfung to MAIN, Einfache Prüfung to SIMPLE, Sonderprüfung to SPECIAL, and use OTHER only for an explicitly different inspection type. Preserve dates, cycle months, and Zustandsnote values as shown. Extract Prüfer / Prüfingenieur when a name is paired with that inspection date, including Bemerkung lines such as 02.04.2013 followed by Prüfer: H. Wittig. Reuse the exact partialStructureRef from the registry when present.`;

type InspectionsOutput = Extract<
  SectionExtractionOutput,
  { category: "INSPECTIONS" }
>;

export const inspectionsExtractor = {
  category: "INSPECTIONS",
  inputSchema: inspectionsInputSchema,
  normalize: normalizeInspectionsExtraction,
  outputName: "bridge_inspections",
  outputSchema: inspectionsExtractionSchema,
  promptVersion: "inspections.de.v4",
  prompt: inspectionsPrompt,
  userPrompt: buildSectionUserPrompt
} as const satisfies {
  readonly category: "INSPECTIONS";
  readonly inputSchema: typeof inspectionsInputSchema;
  readonly normalize: (output: InspectionsOutput) => unknown;
  readonly outputName: string;
  readonly outputSchema: typeof inspectionsExtractionSchema;
  readonly promptVersion: string;
  readonly prompt: string;
  readonly userPrompt: typeof buildSectionUserPrompt;
};
