import {
  identityOverviewExtractionSchema,
  structureGeometryExtractionSchema,
  type SectionExtractionOutput
} from "@bridge-os/contracts";
import { z } from "zod";

import {
  normalizeGeometryExtraction,
  normalizeIdentityExtraction
} from "../../normalize-extraction.js";
import {
  buildSectionUserPrompt,
  extractionGuardrailsPrompt,
  sectionExtractorInputBaseSchema
} from "./shared.js";

export const bridgeIdentityInputSchema = sectionExtractorInputBaseSchema.extend({
  category: z.literal("IDENTITY_OVERVIEW")
});
export const bridgeGeometryInputSchema = sectionExtractorInputBaseSchema.extend({
  category: z.literal("STRUCTURE_GEOMETRY")
});

const identityPrompt = `${extractionGuardrailsPrompt}

Extract one bridge-level identity, road, location, and responsibility record. Preserve the official Bauwerksnummer exactly. Header fields such as Nummer, Bauwerksname, Straße, and IBwNr are valid source-backed identity even when they repeat on later pages. Return a bridge whenever any of those fields is present; return bridge null only when the supplied pages contain no identity fields at all.
latitude and longitude are WGS84 decimal degrees only (roughly -90..90 and -180..180). German Bauwerksbuch documents commonly list projected national-grid coordinates instead, such as Gauß-Krüger ("Rechtswert"/"Hochwert") or UTM easting/northing, which are in meters and far outside that range. Never place Gauß-Krüger, UTM, or any other projected/national-grid coordinate values into latitude or longitude; leave both null when the source only supplies projected coordinates.
countryCode is subject to the same evidence rule as every other field: leave it null unless the source pages contain an explicit, quotable country label or ISO code. The issuing authority being a German federal agency is not itself quotable evidence — do not infer countryCode from agency names, language, or general context.`;

const geometryPrompt = `${extractionGuardrailsPrompt}

Extract Teilbauwerk identity, construction year, structure type, structural system, dimensions in their source representation, and span count. Keep one record per source-distinguishable Teilbauwerk. Create a stable sourceKey from a preserved Teilbauwerk identifier; use partial:primary only when the source clearly describes one unnamed Teilbauwerk.`;

type IdentityOutput = Extract<
  SectionExtractionOutput,
  { category: "IDENTITY_OVERVIEW" }
>;
type GeometryOutput = Extract<
  SectionExtractionOutput,
  { category: "STRUCTURE_GEOMETRY" }
>;

export const bridgeIdentityExtractor = {
  category: "IDENTITY_OVERVIEW",
  inputSchema: bridgeIdentityInputSchema,
  normalize: normalizeIdentityExtraction,
  outputName: "bridge_identity",
  outputSchema: identityOverviewExtractionSchema,
  promptVersion: "identity-overview.de.v3",
  prompt: identityPrompt,
  userPrompt: buildSectionUserPrompt
} as const satisfies {
  readonly category: "IDENTITY_OVERVIEW";
  readonly inputSchema: typeof bridgeIdentityInputSchema;
  readonly normalize: (output: IdentityOutput) => unknown;
  readonly outputName: string;
  readonly outputSchema: typeof identityOverviewExtractionSchema;
  readonly promptVersion: string;
  readonly prompt: string;
  readonly userPrompt: typeof buildSectionUserPrompt;
};

export const bridgeGeometryExtractor = {
  category: "STRUCTURE_GEOMETRY",
  inputSchema: bridgeGeometryInputSchema,
  normalize: normalizeGeometryExtraction,
  outputName: "bridge_geometry",
  outputSchema: structureGeometryExtractionSchema,
  promptVersion: "structure-geometry.de.v2",
  prompt: geometryPrompt,
  userPrompt: buildSectionUserPrompt
} as const satisfies {
  readonly category: "STRUCTURE_GEOMETRY";
  readonly inputSchema: typeof bridgeGeometryInputSchema;
  readonly normalize: (output: GeometryOutput) => unknown;
  readonly outputName: string;
  readonly outputSchema: typeof structureGeometryExtractionSchema;
  readonly promptVersion: string;
  readonly prompt: string;
  readonly userPrompt: typeof buildSectionUserPrompt;
};
