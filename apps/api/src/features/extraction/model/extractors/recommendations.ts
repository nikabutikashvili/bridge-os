import {
  recommendationsExtractionSchema,
  type SectionExtractionOutput
} from "@bridge-os/contracts";
import { z } from "zod";

import { normalizeRecommendationsExtraction } from "../../normalize-extraction.js";
import {
  buildSectionUserPrompt,
  extractionGuardrailsPrompt,
  sectionExtractorInputBaseSchema
} from "./shared.js";

export const recommendationsInputSchema = sectionExtractorInputBaseSchema.extend({
  category: z.literal("RECOMMENDATIONS")
});

export const recommendationsPrompt = `${extractionGuardrailsPrompt}

Extract every Maßnahmenempfehlung block, including quantity and estimated cost. Menge and Geschätzte Kosten use -- for unknown (null) and 0 for an explicit zero; German thousands such as 20.000 mean 20000, and EURO means EUR. Quantity units may appear only inside Art der Leistung, for example m², lfd m, or Stück. Copy Zugeordnete Schäden identifiers such as [22] or [28], [77] into linkedFindingRefs using the registry finding sourceKey when the sourceIdentifier matches, otherwise the bracket number. Never omit a recommendation because a finding cross-reference is missing from the registry. Keep the recommendation when quantity or cost is incomplete. Map Dringlichkeit values Sofort, Kurzfristig, Mittelfristig, and Langfristig to urgency; do not invent a priority when Dringlichkeit is absent. Keep source wording for Art der Leistung.`;

type RecommendationsOutput = Extract<
  SectionExtractionOutput,
  { category: "RECOMMENDATIONS" }
>;

export const recommendationsExtractor = {
  category: "RECOMMENDATIONS",
  inputSchema: recommendationsInputSchema,
  normalize: normalizeRecommendationsExtraction,
  outputName: "bridge_recommendations",
  outputSchema: recommendationsExtractionSchema,
  promptVersion: "recommendations.de.v4",
  prompt: recommendationsPrompt,
  userPrompt: buildSectionUserPrompt
} as const satisfies {
  readonly category: "RECOMMENDATIONS";
  readonly inputSchema: typeof recommendationsInputSchema;
  readonly normalize: (output: RecommendationsOutput) => unknown;
  readonly outputName: string;
  readonly outputSchema: typeof recommendationsExtractionSchema;
  readonly promptVersion: string;
  readonly prompt: string;
  readonly userPrompt: typeof buildSectionUserPrompt;
};
