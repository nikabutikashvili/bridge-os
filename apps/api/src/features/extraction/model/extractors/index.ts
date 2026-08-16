import type { ExtractablePageCategory } from "@bridge-os/contracts";

import {
  bridgeGeometryExtractor,
  bridgeIdentityExtractor
} from "./bridge.js";
import { findingsExtractor } from "./findings.js";
import { historicalWorksExtractor } from "./historical-works.js";
import { inspectionsExtractor } from "./inspections.js";
import { recommendationsExtractor } from "./recommendations.js";
import { trafficExtractor } from "./traffic.js";

export const modelBackedCategories = new Set<ExtractablePageCategory>([
  "IDENTITY_OVERVIEW",
  "STRUCTURE_GEOMETRY",
  "INSPECTIONS",
  "FINDINGS_DAMAGE",
  "RECOMMENDATIONS",
  "HISTORICAL_WORKS_COSTS",
  "TRAFFIC_NETWORK"
]);

export function getSectionExtractor(category: ExtractablePageCategory) {
  switch (category) {
    case "IDENTITY_OVERVIEW":
      return bridgeIdentityExtractor;
    case "STRUCTURE_GEOMETRY":
      return bridgeGeometryExtractor;
    case "INSPECTIONS":
      return inspectionsExtractor;
    case "FINDINGS_DAMAGE":
      return findingsExtractor;
    case "RECOMMENDATIONS":
      return recommendationsExtractor;
    case "HISTORICAL_WORKS_COSTS":
      return historicalWorksExtractor;
    case "TRAFFIC_NETWORK":
      return trafficExtractor;
    case "COMPONENTS_MATERIALS":
      throw new Error("Component extraction is not enabled in this provider version.");
  }
}
