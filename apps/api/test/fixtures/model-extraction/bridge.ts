import { citation, missing, sourced } from "./shared.js";

export const bridgeIdentityModelFixture = {
  category: "IDENTITY_OVERVIEW",
  bridge: {
    evidence: [citation(1, "Bauwerksnummer 4405884")],
    externalStructureNumber: sourced("4405884", 1, "Bauwerksnummer 4405884"),
    name: sourced("Heideckhofweg", 1, "Bauwerksname Heideckhofweg"),
    road: sourced("A 57", 1, "Straße A 57"),
    location: {
      countryCode: sourced("DE", 1, "Land Deutschland"),
      federalState: sourced("Nordrhein-Westfalen", 1, "Nordrhein-Westfalen"),
      district: missing(),
      municipality: missing(),
      locality: missing(),
      postalCode: missing(),
      stationing: missing(),
      crossedFeature: sourced("Heideckhofweg", 1, "über Heideckhofweg"),
      latitude: missing(),
      longitude: missing()
    },
    owner: missing(),
    loadBearingResponsibility: missing(),
    responsibleAuthority: missing(),
    maintenanceOffice: missing()
  }
} as const;

export const bridgeGeometryModelFixture = {
  category: "STRUCTURE_GEOMETRY",
  partialStructures: [
    {
      sourceKey: "partial:4405884-0",
      evidence: [citation(2, "Teilbauwerk 4405884 0")],
      externalPartialStructureNumber: sourced("0", 2, "Teilbauwerk 4405884 0"),
      name: missing(),
      constructionYear: sourced("1983", 2, "Baujahr 1983"),
      structureType: sourced("Straßenbrücke", 2, "Bauwerksart Straßenbrücke"),
      structuralSystem: sourced("Rahmen", 2, "Tragwerkssystem Rahmen"),
      length: sourced("7,23", 2, "Länge 7,23 m"),
      width: sourced("14,75", 2, "Breite 14,75 m"),
      area: sourced("117", 2, "Brückenfläche 117 m²"),
      clearHeight: missing(),
      spanCount: sourced("1", 2, "Anzahl Felder 1")
    }
  ]
} as const;

export const bridgePages = [
  {
    pageNumber: 1,
    textContent:
      "Bauwerksnummer 4405884 Bauwerksname Heideckhofweg Straße A 57 Land Deutschland Nordrhein-Westfalen über Heideckhofweg"
  },
  {
    pageNumber: 2,
    textContent:
      "Teilbauwerk 4405884 0 Baujahr 1983 Bauwerksart Straßenbrücke Tragwerkssystem Rahmen Länge 7,23 m Breite 14,75 m Brückenfläche 117 m² Anzahl Felder 1"
  }
] as const;
