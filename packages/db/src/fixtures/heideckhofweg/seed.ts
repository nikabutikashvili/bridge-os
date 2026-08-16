import type { BridgeDatabase } from "../../connection.js";
import {
  bridgeEvidence,
  bridges,
  budgetProgramInterventions,
  budgetPrograms,
  componentEvidence,
  components,
  documents,
  findingEvidence,
  findings,
  historicalWorkEvidence,
  historicalWorks,
  inspectionEvidence,
  inspections,
  partialStructureEvidence,
  partialStructures,
  plannedInterventions,
  recommendationEvidence,
  recommendationFindings,
  recommendations,
  sourceEvidence,
  trafficObservationEvidence,
  trafficObservations
} from "../../schema/index.js";
import { heideckhofwegFixture } from "./data.js";
import { heideckhofwegEvidenceFixture } from "./evidence.js";

export const heideckhofwegFixtureSummary = {
  bridges: 1,
  partialStructures: 1,
  components: heideckhofwegFixture.components.length,
  inspections: heideckhofwegFixture.inspections.length,
  findings: heideckhofwegFixture.findings.length,
  recommendations: heideckhofwegFixture.recommendations.length,
  plannedInterventions: heideckhofwegFixture.plannedInterventions.length,
  budgetPrograms: 1,
  budgetProgramInterventions:
    heideckhofwegFixture.budgetProgramInterventions.length,
  historicalWorks: heideckhofwegFixture.historicalWorks.length,
  trafficObservations: heideckhofwegFixture.trafficObservations.length,
  documents: heideckhofwegFixture.documents.length,
  sourceEvidence: heideckhofwegEvidenceFixture.sourceEvidence.length
} as const;

export async function seedHeideckhofwegFixture(database: BridgeDatabase): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction
      .insert(bridges)
      .values(heideckhofwegFixture.bridge)
      .onConflictDoUpdate({ target: bridges.id, set: heideckhofwegFixture.bridge });

    await transaction
      .insert(partialStructures)
      .values(heideckhofwegFixture.partialStructure)
      .onConflictDoUpdate({
        target: partialStructures.id,
        set: heideckhofwegFixture.partialStructure
      });

    for (const component of heideckhofwegFixture.components) {
      await transaction
        .insert(components)
        .values(component)
        .onConflictDoUpdate({ target: components.id, set: component });
    }

    for (const inspection of heideckhofwegFixture.inspections) {
      await transaction
        .insert(inspections)
        .values(inspection)
        .onConflictDoUpdate({ target: inspections.id, set: inspection });
    }

    for (const finding of heideckhofwegFixture.findings) {
      await transaction
        .insert(findings)
        .values(finding)
        .onConflictDoUpdate({ target: findings.id, set: finding });
    }

    for (const recommendation of heideckhofwegFixture.recommendations) {
      await transaction
        .insert(recommendations)
        .values(recommendation)
        .onConflictDoUpdate({ target: recommendations.id, set: recommendation });
    }

    for (const intervention of heideckhofwegFixture.plannedInterventions) {
      await transaction
        .insert(plannedInterventions)
        .values(intervention)
        .onConflictDoUpdate({
          target: plannedInterventions.id,
          set: intervention
        });
    }

    await transaction
      .insert(budgetPrograms)
      .values(heideckhofwegFixture.budgetProgram)
      .onConflictDoUpdate({
        target: budgetPrograms.planningYear,
        set: heideckhofwegFixture.budgetProgram
      });

    for (const membership of heideckhofwegFixture.budgetProgramInterventions) {
      await transaction
        .insert(budgetProgramInterventions)
        .values(membership)
        .onConflictDoUpdate({
          target: budgetProgramInterventions.interventionId,
          set: membership
        });
    }

    for (const link of heideckhofwegFixture.recommendationFindings) {
      await transaction
        .insert(recommendationFindings)
        .values(link)
        .onConflictDoUpdate({
          target: [recommendationFindings.recommendationId, recommendationFindings.findingId],
          set: link
        });
    }

    for (const historicalWork of heideckhofwegFixture.historicalWorks) {
      await transaction
        .insert(historicalWorks)
        .values(historicalWork)
        .onConflictDoUpdate({ target: historicalWorks.id, set: historicalWork });
    }

    for (const observation of heideckhofwegFixture.trafficObservations) {
      await transaction
        .insert(trafficObservations)
        .values(observation)
        .onConflictDoUpdate({ target: trafficObservations.id, set: observation });
    }

    for (const document of heideckhofwegFixture.documents) {
      await transaction
        .insert(documents)
        .values(document)
        .onConflictDoUpdate({ target: documents.id, set: document });
    }

    for (const evidence of heideckhofwegEvidenceFixture.sourceEvidence) {
      await transaction
        .insert(sourceEvidence)
        .values(evidence)
        .onConflictDoUpdate({ target: sourceEvidence.id, set: evidence });
    }

    for (const link of heideckhofwegEvidenceFixture.bridgeEvidence) {
      await transaction.insert(bridgeEvidence).values(link).onConflictDoNothing();
    }

    for (const link of heideckhofwegEvidenceFixture.partialStructureEvidence) {
      await transaction.insert(partialStructureEvidence).values(link).onConflictDoNothing();
    }

    for (const link of heideckhofwegEvidenceFixture.componentEvidence) {
      await transaction.insert(componentEvidence).values(link).onConflictDoNothing();
    }

    for (const link of heideckhofwegEvidenceFixture.inspectionEvidence) {
      await transaction.insert(inspectionEvidence).values(link).onConflictDoNothing();
    }

    for (const link of heideckhofwegEvidenceFixture.findingEvidence) {
      await transaction.insert(findingEvidence).values(link).onConflictDoNothing();
    }

    for (const link of heideckhofwegEvidenceFixture.recommendationEvidence) {
      await transaction.insert(recommendationEvidence).values(link).onConflictDoNothing();
    }

    for (const link of heideckhofwegEvidenceFixture.historicalWorkEvidence) {
      await transaction.insert(historicalWorkEvidence).values(link).onConflictDoNothing();
    }

    for (const link of heideckhofwegEvidenceFixture.trafficObservationEvidence) {
      await transaction.insert(trafficObservationEvidence).values(link).onConflictDoNothing();
    }
  });
}
