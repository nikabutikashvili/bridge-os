import { describe, expect, it } from "vitest";

import type {
  DamageMechanismAssessment,
  DamageMechanismKind
} from "@bridge-os/contracts";

import { deriveDamageMechanisms } from "../src/features/bridges/damage-mechanisms.js";

const heideckhofwegClimate = {
  freezeThawDays: 53,
  wetDryCycles: 48,
  meanRelativeHumidityPercent: "78.1",
  precipitationHours: 1435,
  heavyRainDays20: 3,
  deicingDays: 30
};

const demoFindings = [
  finding({
    id: "crack",
    defectType: "Betonriss",
    description: "Feine Netz- und Einzelrisse an der Unterseite des Überbaus.",
    sourceIdentifier: "DEMO-S-2023-001",
    durabilityRating: 2,
    status: "OPEN"
  }),
  finding({
    id: "rebar",
    defectType: "Betonabplatzung / freiliegende Bewehrung",
    description: "Lokale Betonabplatzung mit freiliegender, angerosteter Bewehrung.",
    sourceIdentifier: "DEMO-S-2023-002",
    durabilityRating: 3,
    status: "OPEN"
  }),
  finding({
    id: "joint",
    defectType: "Offene Kappenfuge",
    description: "Kappenfuge offen; Feuchtigkeit kann in den Fugenbereich eindringen.",
    sourceIdentifier: "DEMO-S-2023-003",
    durabilityRating: 2,
    status: "OPEN"
  }),
  finding({
    id: "drainage",
    defectType: "Blasenbildung / Entwässerungsmangel",
    description: "Blasenbildung im Belag und Feuchtespuren im Bereich des östlichen Ablaufs.",
    sourceIdentifier: "DEMO-S-2023-005",
    durabilityRating: 2,
    status: "OPEN"
  }),
  finding({
    id: "coating",
    defectType: "Korrosion / Verwitterung",
    description: "Beschichtung verwittert; lokale Korrosionsansätze an Geländerpfosten.",
    sourceIdentifier: "DEMO-S-2023-006",
    durabilityRating: 2,
    status: "MONITORING"
  })
];

const demoComponents = [
  {
    type: "UEBERBAU",
    material: "Stahlbeton",
    constructionYear: 1983,
    installYear: 1983
  },
  {
    type: "SCHUTZEINRICHTUNG",
    material: "Stahl, beschichtet",
    constructionYear: null,
    installYear: 1983
  }
];

describe("deriveDamageMechanisms", () => {
  it("joins 2025 climate with Heideckhofweg-like findings into inspectable bands", () => {
    const mechanisms = byKind(
      deriveDamageMechanisms({
        asOfYear: 2026,
        climate: heideckhofwegClimate,
        constructionYear: 1983,
        crossedFeature: "Fiktivbach",
        dailyTraffic: 41_878,
        components: demoComponents,
        findings: demoFindings,
        hydrology: null
      })
    );

    expect(mechanisms.RC_CORROSION).toMatchObject({
      band: "HIGH",
      confidence: "HIGH"
    });
    expect(mechanisms.STEEL_CORROSION).toMatchObject({
      band: "HIGH",
      confidence: "HIGH"
    });
    expect(mechanisms.WATER_INGRESS).toMatchObject({
      band: "HIGH",
      confidence: "HIGH"
    });
    expect(mechanisms.SCOUR).toMatchObject({
      band: "LOW",
      confidence: "LOW"
    });
    expect(mechanisms.SCOUR.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["WATERCOURSE", "NO_SCOUR_FINDING", "NO_LOCAL_GAUGE"])
    );
    expect(mechanisms.RC_CORROSION.summary).toMatch(/corrosion progression/i);
    expect(mechanisms.WATER_INGRESS.summary).toMatch(/water-ingress watch/i);
  });

  it("does not treat a bare 'offen' note as an open joint", () => {
    const [water] = deriveDamageMechanisms({
      asOfYear: 2026,
      climate: { ...heideckhofwegClimate, heavyRainDays20: 0 },
      constructionYear: 1983,
      crossedFeature: null,
      dailyTraffic: null,
      components: [],
      findings: [
        finding({
          id: "open-note",
          defectType: "Offen gelassen",
          description: "Maßnahme bleibt offen.",
          sourceIdentifier: "X-1",
          durabilityRating: 1,
          status: "OPEN"
        })
      ],
      hydrology: null
    }).filter((mechanism) => mechanism.kind === "WATER_INGRESS");

    expect(water?.band).toBe("LOW");
    expect(water?.reasons.map((reason) => reason.code)).not.toContain("OPEN_JOINT");
  });

  it("keeps scour at most medium without a Kolk finding", () => {
    const [scour] = deriveDamageMechanisms({
      asOfYear: 2026,
      climate: { ...heideckhofwegClimate, heavyRainDays20: 12 },
      constructionYear: 1974,
      crossedFeature: "Schlingenbach",
      dailyTraffic: null,
      components: [
        {
          type: "GRUENDUNG",
          material: "Stahlbeton",
          constructionYear: 1974,
          installYear: 1974
        }
      ],
        findings: [],
        hydrology: null
      }).filter((mechanism) => mechanism.kind === "SCOUR");

    expect(scour).toMatchObject({ band: "MEDIUM", confidence: "LOW" });
  });

  it("raises scour to high only when a Kolk finding exists", () => {
    const [scour] = deriveDamageMechanisms({
      asOfYear: 2026,
      climate: heideckhofwegClimate,
      constructionYear: 1974,
      crossedFeature: "Molbach",
      dailyTraffic: null,
      components: [],
      findings: [
        finding({
          id: "kolk",
          defectType: "Kolk am Pfeiler",
          description: "Unterspülung am Strompfeiler.",
          sourceIdentifier: "S-7.4-01",
          durabilityRating: 2,
          status: "OPEN"
        })
      ],
      hydrology: null
    }).filter((mechanism) => mechanism.kind === "SCOUR");

    expect(scour).toMatchObject({ band: "HIGH", confidence: "MEDIUM" });
  });

  it("replaces the rainfall proxy with the seeded gauge story", () => {
    const [scour] = deriveDamageMechanisms({
      asOfYear: 2026,
      climate: heideckhofwegClimate,
      constructionYear: 1983,
      crossedFeature: "Fiktivbach",
      dailyTraffic: 41_878,
      components: demoComponents,
      findings: demoFindings,
      hydrology: {
        band: "HIGH",
        triggerExceeded: false,
        scourSensitive: true,
        hasOpenScourFinding: false,
        unmatchedPostFloodInspection: true,
        summary:
          "This structure should receive an extraordinary inspection following the 2021 high-water event.",
        reasons: [
          {
            code: "NEAREST_GAUGE",
            label: "WESEL (RHEIN)",
            detail: "66 cm versus an 804 cm inspection trigger."
          },
          {
            code: "UNMATCHED_FLOOD_EVENT",
            label: "2021 high without Sonderprüfung",
            detail: "Peak 869 cm at KÖLN on 2021-02-07 has no special inspection."
          },
          {
            code: "SCOUR_HISTORY",
            label: "Historically scour-sensitive foundation",
            detail: "DEMO-S-2011-001 is recorded against the foundation."
          }
        ],
        history: [],
        recommendedAction: {
          kind: "EXTRAORDINARY_INSPECTION",
          eventYear: 2021,
          peakedOn: "2021-02-07",
          summary:
            "This structure should receive an extraordinary inspection following the 2021 high-water event."
        }
      }
    }).filter((mechanism) => mechanism.kind === "SCOUR");

    expect(scour).toMatchObject({
      band: "HIGH",
      confidence: "MEDIUM"
    });
    expect(scour?.summary).toMatch(/2021 high-water event/i);
    expect(scour?.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["NEAREST_GAUGE", "UNMATCHED_FLOOD_EVENT", "SCOUR_HISTORY"])
    );
    expect(scour?.reasons.map((reason) => reason.code)).not.toContain("NO_LOCAL_GAUGE");
    expect(scour?.reasons.map((reason) => reason.code)).not.toContain("HEAVY_RAIN");
  });
});

function finding(input: {
  readonly id: string;
  readonly defectType: string;
  readonly description: string;
  readonly sourceIdentifier: string;
  readonly durabilityRating: number;
  readonly status: "OPEN" | "MONITORING";
}) {
  return {
    ...input,
    componentType: null,
    componentMaterial: null
  };
}

function byKind(
  mechanisms: ReturnType<typeof deriveDamageMechanisms>
): Record<DamageMechanismKind, DamageMechanismAssessment> {
  return Object.fromEntries(
    mechanisms.map((mechanism) => [mechanism.kind, mechanism])
  ) as Record<DamageMechanismKind, DamageMechanismAssessment>;
}
