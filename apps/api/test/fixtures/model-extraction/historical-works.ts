import { citation, missing, sourced } from "./shared.js";

export const historicalWorksModelFixture = {
  category: "HISTORICAL_WORKS_COSTS",
  historicalWorks: [
    {
      sourceKey: "historical-work:2005-instandsetzung",
      partialStructureRef: "partial:4405884-0",
      evidence: [citation(7, "Instandsetzung 2005 Auftragssumme 125.000,00 EUR")],
      type: sourced("Instandsetzung", 7, "Instandsetzung 2005"),
      title: sourced("Instandsetzung 2005", 7, "Instandsetzung 2005"),
      reason: missing(),
      contractor: missing(),
      client: missing(),
      startedOn: missing(),
      endedOn: missing(),
      quantity: missing(),
      unit: missing(),
      contractAmount: sourced("125.000,00", 7, "Auftragssumme 125.000,00 EUR"),
      finalAmount: missing(),
      currency: sourced("EUR", 7, "125.000,00 EUR")
    }
  ]
} as const;

export const historicalWorksPage = {
  pageNumber: 7,
  textContent: "Instandsetzung 2005 Auftragssumme 125.000,00 EUR"
} as const;
