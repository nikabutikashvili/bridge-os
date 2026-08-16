import { citation, missing, sourced } from "./shared.js";

export const recommendationsModelFixture = {
  category: "RECOMMENDATIONS",
  recommendations: [
    {
      sourceKey: "recommendation:M-012",
      partialStructureRef: "partial:4405884-0",
      linkedFindingRefs: ["finding:S-004"],
      evidence: [citation(5, "M-012 Mittelfristig Fahrbahnübergang instand setzen")],
      workType: sourced(
        "Fahrbahnübergang instand setzen",
        5,
        "Fahrbahnübergang instand setzen"
      ),
      description: sourced(
        "Fahrbahnübergang auf 30 m instand setzen",
        5,
        "Fahrbahnübergang auf 30 m instand setzen"
      ),
      urgency: sourced("mittelfristig", 5, "Mittelfristig"),
      quantity: sourced("30", 5, "30 m"),
      unit: sourced("m", 5, "30 m"),
      sourceEstimatedCost: missing(),
      sourceEstimatedCostCurrency: missing(),
      targetYear: missing(),
      plannedYear: missing(),
      status: missing()
    }
  ]
} as const;

export const recommendationsPage = {
  pageNumber: 5,
  textContent:
    "M-012 Mittelfristig Fahrbahnübergang instand setzen. Fahrbahnübergang auf 30 m instand setzen. Bezug Schaden S-004."
} as const;
