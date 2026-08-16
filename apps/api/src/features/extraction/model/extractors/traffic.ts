import {
  trafficNetworkExtractionSchema,
  type SectionExtractionOutput
} from "@bridge-os/contracts";
import { z } from "zod";

import { normalizeTrafficExtraction } from "../../normalize-extraction.js";
import {
  buildSectionUserPrompt,
  extractionGuardrailsPrompt,
  sectionExtractorInputBaseSchema
} from "./shared.js";

export const trafficInputSchema = sectionExtractorInputBaseSchema.extend({
  category: z.literal("TRAFFIC_NETWORK")
});

export const trafficPrompt = `${extractionGuardrailsPrompt}

Extract dated traffic observations such as DTV and Schwerverkehrsanteil. Do not convert or estimate values in the model response; preserve the source number representation for deterministic normalization. A traffic observation requires a source-backed observation year.`;

type TrafficOutput = Extract<
  SectionExtractionOutput,
  { category: "TRAFFIC_NETWORK" }
>;

export const trafficExtractor = {
  category: "TRAFFIC_NETWORK",
  inputSchema: trafficInputSchema,
  normalize: normalizeTrafficExtraction,
  outputName: "bridge_traffic_observations",
  outputSchema: trafficNetworkExtractionSchema,
  promptVersion: "traffic-network.de.v2",
  prompt: trafficPrompt,
  userPrompt: buildSectionUserPrompt
} as const satisfies {
  readonly category: "TRAFFIC_NETWORK";
  readonly inputSchema: typeof trafficInputSchema;
  readonly normalize: (output: TrafficOutput) => unknown;
  readonly outputName: string;
  readonly outputSchema: typeof trafficNetworkExtractionSchema;
  readonly promptVersion: string;
  readonly prompt: string;
  readonly userPrompt: typeof buildSectionUserPrompt;
};
