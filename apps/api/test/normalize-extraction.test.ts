import { describe, expect, it } from "vitest";

import { normalizeExtractionOutputs } from "../src/features/extraction/normalize-extraction.js";
import type { SectionExtractionOutput } from "@bridge-os/contracts";

const evidence = {
  boundingBox: null,
  confidence: 1,
  derivationMethod: null,
  kind: "SOURCE_FACT" as const,
  pageNumber: 1,
  sourceExcerpt: "Nummer 5009705"
};

function sourced<T extends string | number | null>(value: T) {
  return {
    evidence: value === null ? [] : [evidence],
    value
  };
}

function missing() {
  return { evidence: [] as typeof evidence[], value: null };
}

function emptyLocation() {
  return {
    countryCode: missing(),
    federalState: missing(),
    district: missing(),
    municipality: missing(),
    locality: missing(),
    postalCode: missing(),
    stationing: missing(),
    crossedFeature: missing(),
    latitude: missing(),
    longitude: missing()
  };
}

function identityOutput(
  number: string | null,
  name: string | null
): SectionExtractionOutput {
  return {
    category: "IDENTITY_OVERVIEW",
    bridge:
      number === null && name === null
        ? null
        : {
            evidence: [evidence],
            externalStructureNumber: sourced(number),
            name: sourced(name),
            road: missing(),
            location: emptyLocation(),
            owner: missing(),
            loadBearingResponsibility: missing(),
            responsibleAuthority: missing(),
            maintenanceOffice: missing()
          }
  };
}

describe("normalizeExtractionOutputs", () => {
  it("merges multiple identity chunks into one bridge", () => {
    const bundle = normalizeExtractionOutputs([
      identityOutput("5009705", null),
      identityOutput(null, "Schlingenbachtalbrücke")
    ]);

    expect(bundle.bridge.values.externalStructureNumber).toBe("5009705");
    expect(bundle.bridge.values.name).toBe("Schlingenbachtalbrücke");
    expect(bundle.partialStructures).toHaveLength(1);
    expect(bundle.partialStructures[0]?.sourceKey).toBe("partial:primary");
  });

  it("infers a fallback bridge from page text when identity is missing", () => {
    const bundle = normalizeExtractionOutputs([], {
      documentId: "00000000-0000-4000-8000-000000000099",
      pages: [
        {
          textContent:
            "Bauwerksname\nSchlingenbachtalbrücke\nNummer\nStraße IBwNr\n5009705 1\nA 4"
        }
      ]
    });

    expect(bundle.bridge.values.externalStructureNumber).toBe("5009705");
    expect(bundle.bridge.values.name).toBe("Schlingenbachtalbrücke");
    expect(bundle.bridge.values.road).toBe("A 4");
  });

  it("converts GIS-Koordinaten into WGS84 even when identity is already complete", () => {
    const bundle = normalizeExtractionOutputs(
      [
        {
          category: "IDENTITY_OVERVIEW",
          bridge: {
            evidence: [evidence],
            externalStructureNumber: sourced("5009705"),
            name: sourced("Schlingenbachtalbrücke"),
            road: sourced("A 4"),
            location: emptyLocation(),
            owner: missing(),
            loadBearingResponsibility: missing(),
            responsibleAuthority: missing(),
            maintenanceOffice: missing()
          }
        }
      ],
      {
        pages: [
          {
            pageNumber: 12,
            textContent: `5.1.1 GIS-Koordinaten
UTM-Koordinaten
Bezugssystem    ETRS_UTM_NW489
Rechtswert              5646659,710
Hochwert                 382394,030`
          }
        ]
      }
    );

    expect(bundle.bridge.values.location.latitude).toMatch(/^50\.\d{6}$/);
    expect(bundle.bridge.values.location.longitude).toMatch(/^7\.\d{6}$/);
    expect(bundle.bridge.fieldEvidence["location.latitude"]?.[0]).toMatchObject({
      derivationMethod: "UTM_ETRS89_TO_WGS84",
      kind: "DERIVED",
      pageNumber: 12
    });
  });

  it("uses the filename when a scanned document has no identity text", () => {
    const bundle = normalizeExtractionOutputs([], {
      documentId: "00000000-0000-4000-8000-000000000099",
      originalFilename: "Bauwerksbuch 3.pdf",
      pages: [{ textContent: "" }]
    });

    expect(bundle.bridge.values.externalStructureNumber).toBe("DOC-000000000000");
    expect(bundle.bridge.values.name).toBe("Bauwerksbuch 3");
  });

  it("keeps findings that point at an unknown inspection by attaching a placeholder", () => {
    const bundle = normalizeExtractionOutputs([
      identityOutput("5009705", "Testbruecke"),
      {
        category: "FINDINGS_DAMAGE",
        findings: [
          {
            sourceKey: "finding:1",
            partialStructureRef: "missing-partial",
            inspectionRef: "missing-inspection",
            componentRef: missing(),
            evidence: [evidence],
            sourceIdentifier: sourced("S-1"),
            defectType: missing(),
            description: sourced("Riss"),
            location: missing(),
            extent: missing(),
            dimensionLength: missing(),
            dimensionWidth: missing(),
            dimensionDepth: missing(),
            dimensionUnit: missing(),
            quantity: missing(),
            quantityUnit: missing(),
            stabilityRating: missing(),
            trafficSafetyRating: missing(),
            durabilityRating: missing(),
            status: sourced("OPEN")
          }
        ]
      }
    ]);

    expect(bundle.findings).toHaveLength(1);
    expect(bundle.findings[0]?.inspectionRef).toBe("inspection:document");
    expect(bundle.findings[0]?.partialStructureRef).toBe("partial:primary");
    expect(bundle.inspections).toEqual([
      expect.objectContaining({ sourceKey: "inspection:document" })
    ]);
  });

  it("defaults an unclassified finding status to OPEN instead of leaving it null", () => {
    const bundle = normalizeExtractionOutputs([
      identityOutput("5009705", "Testbruecke"),
      {
        category: "FINDINGS_DAMAGE",
        findings: [
          {
            sourceKey: "finding:1",
            partialStructureRef: "partial:primary",
            inspectionRef: "missing-inspection",
            componentRef: missing(),
            evidence: [evidence],
            sourceIdentifier: sourced("S-1"),
            defectType: missing(),
            description: sourced("Riss"),
            location: missing(),
            extent: missing(),
            dimensionLength: missing(),
            dimensionWidth: missing(),
            dimensionDepth: missing(),
            dimensionUnit: missing(),
            quantity: missing(),
            quantityUnit: missing(),
            stabilityRating: sourced(0),
            trafficSafetyRating: sourced(0),
            durabilityRating: sourced(1),
            status: missing()
          }
        ]
      }
    ]);

    expect(bundle.findings[0]?.values.status).toBe("OPEN");
  });

  it("defaults an unclassified recommendation status to OPEN instead of leaving it null", () => {
    const bundle = normalizeExtractionOutputs([
      identityOutput("5009705", "Testbruecke"),
      {
        category: "RECOMMENDATIONS",
        recommendations: [
          {
            sourceKey: "recommendation:1",
            partialStructureRef: "partial:primary",
            linkedFindingRefs: [],
            evidence: [evidence],
            workType: sourced("Fahrbahnbelag erneuern"),
            description: sourced("Fahrbahnbelag erneuern"),
            urgency: sourced("Mittelfristig"),
            quantity: missing(),
            unit: missing(),
            sourceEstimatedCost: missing(),
            sourceEstimatedCostCurrency: missing(),
            targetYear: missing(),
            plannedYear: missing(),
            status: missing()
          }
        ]
      }
    ]);

    expect(bundle.recommendations[0]?.values.status).toBe("OPEN");
  });

  it("maps Dringlichkeit and repairs incomplete quantity or cost pairs", () => {
    const bundle = normalizeExtractionOutputs([
      identityOutput("5009705", "Testbruecke"),
      {
        category: "RECOMMENDATIONS",
        recommendations: [
          {
            sourceKey: "recommendation:3",
            partialStructureRef: "partial:primary",
            linkedFindingRefs: ["[11]"],
            evidence: [evidence],
            workType: sourced(
              "Instandsetzung von Belagsfugen (lfd m -A-)"
            ),
            description: sourced("Belagsfugen"),
            urgency: sourced("Mittelfristig"),
            quantity: sourced(30),
            unit: missing(),
            sourceEstimatedCost: sourced(0),
            sourceEstimatedCostCurrency: sourced("EURO"),
            targetYear: missing(),
            plannedYear: missing(),
            status: sourced("OPEN")
          },
          {
            sourceKey: "recommendation:4",
            partialStructureRef: "partial:primary",
            linkedFindingRefs: [],
            evidence: [evidence],
            workType: sourced("Erneuerung ohne Einheit"),
            description: missing(),
            urgency: sourced("Kurzfristig"),
            quantity: sourced(10),
            unit: missing(),
            sourceEstimatedCost: missing(),
            sourceEstimatedCostCurrency: sourced("EURO"),
            targetYear: missing(),
            plannedYear: missing(),
            status: sourced("OPEN")
          }
        ]
      }
    ]);

    expect(bundle.recommendations[0]?.values).toMatchObject({
      urgency: "MITTELFRISTIG",
      quantity: "30",
      unit: "m",
      sourceEstimatedCost: "0",
      sourceEstimatedCostCurrency: "EUR"
    });
    expect(bundle.recommendations[1]?.values).toMatchObject({
      urgency: "KURZFRISTIG",
      quantity: null,
      unit: null,
      sourceEstimatedCost: null,
      sourceEstimatedCostCurrency: null
    });
  });

  it("infers section 7 findings, inspections, and recommendations from page text", () => {
    const bundle = normalizeExtractionOutputs([identityOutput("4405884", "Testbruecke")], {
      pages: [
        {
          pageNumber: 21,
          textContent:
            "Hauptprüfung                                                        06.08.2019   72 Monate      1,8\n" +
            "Einfache Prüfung                                                    22.06.2016   72 Monate      2,3"
        },
        {
          pageNumber: 22,
          textContent:
            "[11] S=0, V=0, D=2 BSP-ID 241-09\n" +
            "Fahrbahnbelag, Fuge zwischen Belag und Bord, Größtenteils, Offen"
        },
        {
          pageNumber: 24,
          textContent:
            "Maßnahmenempfehlung {3}\n" +
            "Art der Leistung   Instandsetzung von Belagsfugen (lfd m -A-)\n" +
            "Menge              30                                          Geschätzte Kosten -- EURO\n" +
            "Dringlichkeit      Mittelfristig\n" +
            "Zugeordnete Schäden:\n" +
            "[11]"
        }
      ]
    });

    expect(bundle.inspections.map((inspection) => inspection.values)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "MAIN",
          inspectedOn: "2019-08-06",
          cycleMonths: 72,
          conditionScore: "1.8"
        })
      ])
    );
    expect(bundle.findings[0]?.values).toMatchObject({
      sourceIdentifier: "11",
      stabilityRating: 0,
      trafficSafetyRating: 0,
      durabilityRating: 2
    });
    expect(bundle.recommendations[0]?.values).toMatchObject({
      urgency: "MITTELFRISTIG",
      quantity: "30",
      unit: "m",
      sourceEstimatedCost: null
    });
    expect(bundle.recommendations[0]?.linkedFindingRefs).toEqual([
      bundle.findings[0]?.sourceKey
    ]);
  });

  it("fills recommendation quantity, cost, and finding links from page text onto model records", () => {
    const bundle = normalizeExtractionOutputs(
      [
        identityOutput("4405884", "Testbruecke"),
        {
          category: "FINDINGS_DAMAGE",
          findings: [
            {
              sourceKey: "finding:28",
              partialStructureRef: "partial:primary",
              inspectionRef: "inspection:document",
              componentRef: missing(),
              evidence: [evidence],
              sourceIdentifier: sourced("28"),
              defectType: missing(),
              description: sourced("Abdichtung schadhaft Maßnahme {11}"),
              location: missing(),
              extent: missing(),
              dimensionLength: missing(),
              dimensionWidth: missing(),
              dimensionDepth: missing(),
              dimensionUnit: missing(),
              quantity: missing(),
              quantityUnit: missing(),
              stabilityRating: sourced(0),
              trafficSafetyRating: sourced(0),
              durabilityRating: sourced(2),
              status: sourced("OPEN")
            },
            {
              sourceKey: "finding:77",
              partialStructureRef: "partial:primary",
              inspectionRef: "inspection:document",
              componentRef: missing(),
              evidence: [evidence],
              sourceIdentifier: sourced("77"),
              defectType: missing(),
              description: sourced("Rissbildung"),
              location: missing(),
              extent: missing(),
              dimensionLength: missing(),
              dimensionWidth: missing(),
              dimensionDepth: missing(),
              dimensionUnit: missing(),
              quantity: missing(),
              quantityUnit: missing(),
              stabilityRating: sourced(0),
              trafficSafetyRating: sourced(0),
              durabilityRating: sourced(1),
              status: sourced("OPEN")
            }
          ]
        },
        {
          category: "RECOMMENDATIONS",
          recommendations: [
            {
              sourceKey: "rec-1",
              partialStructureRef: "partial:primary",
              linkedFindingRefs: [],
              evidence: [evidence],
              workType: sourced("Erneuerung der Abdichtung (m² -A-)"),
              description: sourced("Abdichtung"),
              urgency: sourced("Kurzfristig"),
              quantity: missing(),
              unit: missing(),
              sourceEstimatedCost: missing(),
              sourceEstimatedCostCurrency: missing(),
              targetYear: missing(),
              plannedYear: missing(),
              status: sourced("OPEN")
            }
          ]
        }
      ],
      {
        pages: [
          {
            pageNumber: 31,
            textContent:
              "Maßnahmenempfehlung {11}\n" +
              "Art der Leistung   Erneuerung der Abdichtung (m² -A-)\n" +
              "Menge              250                                         Geschätzte Kosten 20.000 EURO\n" +
              "Dringlichkeit      Kurzfristig\n" +
              "Zugeordnete Schäden:\n[28], [77]"
          }
        ]
      }
    );

    expect(bundle.recommendations).toHaveLength(1);
    expect(bundle.recommendations[0]?.values).toMatchObject({
      quantity: "250",
      unit: "m2",
      sourceEstimatedCost: "20000",
      sourceEstimatedCostCurrency: "EUR"
    });
    expect(bundle.recommendations[0]?.linkedFindingRefs).toEqual([
      "finding:28",
      "finding:77"
    ]);
  });

  it("attaches inspectors from dated Prüfer remarks onto model inspections", () => {
    const bundle = normalizeExtractionOutputs(
      [
        identityOutput("4405884", "Testbruecke"),
        {
          category: "INSPECTIONS",
          inspections: [
            {
              sourceKey: "inspection:model-2013",
              partialStructureRef: "partial:primary",
              evidence: [evidence],
              type: sourced("MAIN"),
              inspectedOn: sourced("02.04.2013"),
              inspector: missing(),
              conditionScore: sourced("2,1"),
              cycleMonths: sourced(72)
            }
          ]
        }
      ],
      {
        pages: [
          {
            pageNumber: 18,
            textContent:
              "Hauptprüfung                                                        02.04.2013   72 Monate      2,1"
          },
          {
            pageNumber: 19,
            textContent: "02.04.2013\nPrüfer: H. Wittig, BS Gelsenkirchen"
          }
        ]
      }
    );

    expect(bundle.inspections[0]?.values).toMatchObject({
      inspectedOn: "2013-04-02",
      inspector: "H. Wittig, BS Gelsenkirchen"
    });
  });
});
