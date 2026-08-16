import { citation, missing, sourced } from "./shared.js";

export const findingsModelFixture = {
  category: "FINDINGS_DAMAGE",
  findings: [
    {
      sourceKey: "finding:S-004",
      partialStructureRef: "partial:4405884-0",
      inspectionRef: "inspection:2021-06-14:main:partial:4405884-0",
      componentRef: missing(),
      evidence: [citation(4, "S-004 Betonabplatzung mit freiliegender Bewehrung")],
      sourceIdentifier: sourced("S-004", 4, "S-004"),
      defectType: sourced("Betonabplatzung", 4, "Betonabplatzung"),
      description: sourced(
        "Betonabplatzung mit freiliegender Bewehrung",
        4,
        "Betonabplatzung mit freiliegender Bewehrung"
      ),
      location: sourced("Widerlager Ost", 4, "Widerlager Ost"),
      extent: missing(),
      dimensionLength: missing(),
      dimensionWidth: missing(),
      dimensionDepth: missing(),
      dimensionUnit: missing(),
      quantity: missing(),
      quantityUnit: missing(),
      stabilityRating: sourced(1, 4, "S=1"),
      trafficSafetyRating: sourced(0, 4, "V=0"),
      durabilityRating: sourced(2, 4, "D=2"),
      status: missing()
    }
  ]
} as const;

export const findingsPage = {
  pageNumber: 4,
  textContent:
    "S-004 Betonabplatzung mit freiliegender Bewehrung Widerlager Ost S=1 V=0 D=2"
} as const;
