import { describe, expect, it } from "vitest";

import {
  inferFindingsFromPages,
  inferInspectionsFromPages,
  inferRecommendationsFromPages,
  inferSection7Categories
} from "../src/features/extraction/infer-section7.js";

describe("inferSection7", () => {
  it("classifies typical section 7 pages", () => {
    expect(inferSection7Categories("[11] S=0, V=0, D=2 BSP-ID 241-09")).toEqual([
      "FINDINGS_DAMAGE"
    ]);
    expect(
      inferSection7Categories("Maßnahmenempfehlung {3}\nDringlichkeit      Mittelfristig")
    ).toEqual(["RECOMMENDATIONS"]);
    expect(
      inferSection7Categories("Hauptprüfung                                                        06.08.2019   72 Monate      1,8")
    ).toEqual(["INSPECTIONS"]);
  });

  it("reads RI-EBW-PRÜF finding rows", () => {
    const findings = inferFindingsFromPages(
      [
        {
          pageNumber: 22,
          textContent:
            "[9]      S=0, V=0, D=1 BSP-ID 006-01-01\n" +
            "Platte, Beton, Vereinzelt, Schrägrisse Rissbreite < 0,1 mm"
        }
      ],
      "inspection:document",
      "partial:primary"
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.values).toMatchObject({
      sourceIdentifier: "9",
      stabilityRating: 0,
      trafficSafetyRating: 0,
      durabilityRating: 1
    });
    expect(findings[0]?.values.description).toContain("Schrägrisse");
  });

  it("reads dated inspection rows and recommendation blocks", () => {
    const inspections = inferInspectionsFromPages(
      [
        {
          pageNumber: 21,
          textContent:
            "Hauptprüfung                                                        06.08.2019   72 Monate      1,8\n" +
            "1. Sonderprüfung                                                    23.02.2015                  2,3"
        }
      ],
      "partial:primary"
    );
    const recommendations = inferRecommendationsFromPages(
      [
        {
          pageNumber: 24,
          textContent:
            "Maßnahmenempfehlung {3}\n" +
            "Art der Leistung   Instandsetzung von Belagsfugen (lfd m -A-)\n" +
            "Menge              30                                          Geschätzte Kosten -- EURO\n" +
            "Dringlichkeit      Mittelfristig\n" +
            "Zugeordnete Schäden:\n[11]"
        }
      ],
      "partial:primary"
    );

    expect(inspections.map((inspection) => inspection.values.type)).toEqual([
      "MAIN",
      "SPECIAL"
    ]);
    expect(recommendations[0]?.values).toMatchObject({
      urgency: "MITTELFRISTIG",
      quantity: "30",
      unit: "m",
      sourceEstimatedCost: null
    });
    expect(recommendations[0]?.linkedFindingRefs).toEqual(["11"]);
  });

  it("parses German thousands costs, explicit zero, and assigned findings", () => {
    const recommendations = inferRecommendationsFromPages(
      [
        {
          pageNumber: 31,
          textContent:
            "Maßnahmenempfehlung {11}\n" +
            "Art der Leistung   Erneuerung der Abdichtung (m² -A-)\n" +
            "Menge              250                                         Geschätzte Kosten 20.000 EURO\n" +
            "Dringlichkeit      Kurzfristig\n" +
            "Zugeordnete Schäden:\n[28], [77]\n" +
            "Maßnahmenempfehlung {12}\n" +
            "Art der Leistung   Nacharbeiten\n" +
            "Menge              0                                           Geschätzte Kosten 0 EURO\n" +
            "Dringlichkeit      Langfristig\n" +
            "Zugeordnete Schäden:\n--"
        }
      ],
      "partial:primary"
    );

    expect(recommendations[0]?.values).toMatchObject({
      quantity: "250",
      unit: "m2",
      sourceEstimatedCost: "20000",
      sourceEstimatedCostCurrency: "EUR"
    });
    expect(recommendations[0]?.linkedFindingRefs).toEqual(["28", "77"]);
    expect(recommendations[1]?.values).toMatchObject({
      quantity: "0",
      unit: "Stk",
      sourceEstimatedCost: "0",
      sourceEstimatedCostCurrency: "EUR"
    });
    expect(recommendations[1]?.linkedFindingRefs).toEqual([]);
  });

  it("attaches Prüfer names from dated remarks", () => {
    const inspections = inferInspectionsFromPages(
      [
        {
          pageNumber: 18,
          textContent:
            "Hauptprüfung                                                        02.04.2013   72 Monate      2,1\n" +
            "Einfache Prüfung                                                    23.02.2015   72 Monate      2,3"
        },
        {
          pageNumber: 19,
          textContent:
            "Bemerkung       02.04.2013\n" +
            "Prüfer: H. Wittig, BS Gelsenkirchen\n" +
            "23.02.2015\n" +
            "Prüfer. Klaus Albrecht"
        }
      ],
      "partial:primary"
    );

    expect(
      inspections.map((inspection) => ({
        inspectedOn: inspection.values.inspectedOn,
        inspector: inspection.values.inspector
      }))
    ).toEqual([
      {
        inspectedOn: "2013-04-02",
        inspector: "H. Wittig, BS Gelsenkirchen"
      },
      {
        inspectedOn: "2015-02-23",
        inspector: "Klaus Albrecht"
      }
    ]);
  });
});
