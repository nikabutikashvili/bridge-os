import { citation, missing, sourced } from "./shared.js";

export const inspectionsModelFixture = {
  category: "INSPECTIONS",
  inspections: [
    {
      sourceKey: "inspection:2021-06-14:main:partial:4405884-0",
      partialStructureRef: "partial:4405884-0",
      evidence: [citation(3, "Hauptprüfung am 14.06.2021 Zustandsnote 1,8")],
      type: sourced("MAIN", 3, "Hauptprüfung"),
      inspectedOn: sourced("14.06.2021", 3, "Hauptprüfung am 14.06.2021"),
      inspector: missing(),
      conditionScore: sourced("1,8", 3, "Zustandsnote 1,8"),
      cycleMonths: missing()
    }
  ]
} as const;

export const inspectionsPage = {
  pageNumber: 3,
  textContent: "Hauptprüfung am 14.06.2021 Zustandsnote 1,8"
} as const;
