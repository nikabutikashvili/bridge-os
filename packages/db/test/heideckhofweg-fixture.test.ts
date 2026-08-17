import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  heideckhofwegEvidenceFixture,
  heideckhofwegEvidenceIds,
  heideckhofwegFixture,
  heideckhofwegFixtureSummary,
  heideckhofwegIds
} from "../src/fixtures/heideckhofweg/index.js";

describe("Heideckhofweg development fixture", () => {
  it("uses stable, globally unique fixture UUIDs", () => {
    const ids = [
      heideckhofwegIds.bridge,
      heideckhofwegIds.partialStructure,
      ...Object.values(heideckhofwegIds.components),
      ...Object.values(heideckhofwegIds.inspections),
      ...Object.values(heideckhofwegIds.findings),
      ...Object.values(heideckhofwegIds.recommendations),
      ...Object.values(heideckhofwegIds.plannedInterventions),
      ...Object.values(heideckhofwegIds.historicalWorks),
      heideckhofwegIds.traffic2015,
      ...Object.values(heideckhofwegIds.documents),
      ...Object.values(heideckhofwegEvidenceIds)
    ];

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => z.string().uuid().safeParse(id).success)).toBe(true);
  });

  it("contains the portfolio and condition timeline scenario", () => {
    expect(heideckhofwegFixture.bridge).toMatchObject({
      dataOrigin: "DEMO_FIXTURE",
      externalStructureNumber: "9999999",
      name: "Musterbrücke Fiktivtal",
      road: "A57"
    });
    expect(heideckhofwegFixture.partialStructure).toMatchObject({
      areaSqM: "117.000",
      constructionYear: 1983,
      lengthM: "7.230",
      spanCount: 1,
      widthM: "14.750"
    });

    const inspections = [...heideckhofwegFixture.inspections].sort((left, right) =>
      left.inspectedOn.localeCompare(right.inspectedOn)
    );
    expect(inspections.at(-1)?.conditionScore).toBe("1.8");
    expect(
      new Set(
        inspections
          .map((inspection) => inspection.conditionScore)
          .filter((score): score is string => score !== null)
      )
    ).toEqual(new Set(["1.1", "1.7", "1.8", "2.0", "2.3"]));
  });

  it("provides linked findings and planning-ready recommendations", () => {
    expect(heideckhofwegFixture.findings).toHaveLength(7);
    expect(heideckhofwegFixture.recommendations).toHaveLength(5);
    expect(heideckhofwegFixture.plannedInterventions).toHaveLength(3);

    const linkedRecommendationIds = new Set(
      heideckhofwegFixture.recommendationFindings.map((link) => link.recommendationId)
    );
    expect(linkedRecommendationIds).toEqual(
      new Set(heideckhofwegFixture.recommendations.map((recommendation) => recommendation.id))
    );

    expect(
      heideckhofwegFixture.recommendations.find(
        (recommendation) =>
          recommendation.id === heideckhofwegIds.recommendations.pavementJointRepair
      )
    ).toMatchObject({
      quantity: "30.000",
      status: "APPROVED",
      unit: "m",
      urgency: "MITTELFRISTIG"
    });

    expect(
      heideckhofwegFixture.plannedInterventions.find(
        (intervention) =>
          intervention.recommendationId ===
          heideckhofwegIds.recommendations.pavementJointRepair
      )
    ).toMatchObject({
      estimatedCost: "28000.00",
      plannedYear: 2026,
      quantity: "30.000",
      status: "BUDGETED",
      unit: "m"
    });
  });

  it("marks documents and excerpts as demo-only provenance", () => {
    expect(
      heideckhofwegFixture.documents.every(
        (document) =>
          document.metadata.fixture &&
          !document.metadata.extractionPerformed &&
          document.metadata.sourceMode === "DEMO_ONLY"
      )
    ).toBe(true);
    expect(
      heideckhofwegEvidenceFixture.sourceEvidence.every(
        (evidence) =>
          evidence.extractionMethod === "IMPORT" &&
          evidence.sourceExcerpt.startsWith("[DEMO-FIXTUR]")
      )
    ).toBe(true);
  });

  it("exposes fixture counts for seed verification", () => {
    expect(heideckhofwegFixtureSummary).toEqual({
      bridges: 1,
      partialStructures: 1,
      components: 7,
      inspections: 8,
      findings: 7,
      recommendations: 5,
      plannedInterventions: 3,
      budgetPrograms: 1,
      budgetProgramInterventions: 2,
      historicalWorks: 4,
      trafficObservations: 1,
      documents: 2,
      sourceEvidence: 18
    });
  });
});
