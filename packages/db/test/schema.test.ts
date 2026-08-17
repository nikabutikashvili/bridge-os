import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  bridgeEvidence,
  bridges,
  budgetProgramInterventions,
  budgetPrograms,
  budgetScenarioAssignments,
  budgetScenarioEnvelopes,
  budgetScenarios,
  components,
  documentExtractionInvocations,
  documentExtractionRuns,
  documentPageClassifications,
  documentPages,
  documentProcessingRuns,
  documents,
  environmentalMetrics,
  findingEvidence,
  findings,
  historicalWorks,
  inspections,
  partialStructures,
  plannedInterventions,
  recommendationFindings,
  recommendations,
  sourceEvidence,
  trafficObservations,
  workPackages
} from "../src/schema/index.js";

describe("database schema", () => {
  it("defines the core domain tables", () => {
    const tableNames = [
      bridges,
      partialStructures,
      budgetPrograms,
      budgetProgramInterventions,
      budgetScenarios,
      budgetScenarioEnvelopes,
      budgetScenarioAssignments,
      components,
      documentExtractionRuns,
      documentExtractionInvocations,
      documentPageClassifications,
      inspections,
      findings,
      recommendations,
      plannedInterventions,
      recommendationFindings,
      historicalWorks,
      trafficObservations,
      environmentalMetrics,
      workPackages,
      documents,
      documentProcessingRuns,
      documentPages,
      sourceEvidence,
      bridgeEvidence,
      findingEvidence
    ].map((table) => getTableConfig(table).name);

    expect(tableNames).toEqual([
      "bridges",
      "partial_structures",
      "budget_programs",
      "budget_program_interventions",
      "budget_scenarios",
      "budget_scenario_envelopes",
      "budget_scenario_assignments",
      "components",
      "document_extraction_runs",
      "document_extraction_invocations",
      "document_page_classifications",
      "inspections",
      "findings",
      "recommendations",
      "planned_interventions",
      "recommendation_findings",
      "historical_works",
      "traffic_observations",
      "environmental_metrics",
      "work_packages",
      "documents",
      "document_processing_runs",
      "document_pages",
      "source_evidence",
      "bridge_evidence",
      "finding_evidence"
    ]);
  });

  it("stores one versioned work-package snapshot per intervention", () => {
    const config = getTableConfig(workPackages);
    expect(config.uniqueConstraints.map((constraint) => constraint.name)).toContain(
      "work_packages_planned_intervention_unique"
    );
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "work_packages_snapshot_version_v1",
        "work_packages_snapshot_object"
      ])
    );
    expect(config.foreignKeys).toHaveLength(1);
  });

  it("keeps managerial interventions scoped to one source recommendation", () => {
    const config = getTableConfig(plannedInterventions);

    expect(config.uniqueConstraints.map((constraint) => constraint.name)).toContain(
      "planned_interventions_recommendation_unique"
    );
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "planned_interventions_quantity_unit_pair",
        "planned_interventions_estimated_cost_pair",
        "planned_interventions_planned_year_range"
      ])
    );
  });

  it("keeps budget membership in the intervention planning year", () => {
    const programConfig = getTableConfig(budgetPrograms);
    const membershipConfig = getTableConfig(budgetProgramInterventions);

    expect(programConfig.uniqueConstraints.map((constraint) => constraint.name)).toContain(
      "budget_programs_planning_year_unique"
    );
    expect(membershipConfig.primaryKeys).toHaveLength(1);
    expect(membershipConfig.foreignKeys).toHaveLength(2);
  });

  it("stores budget scenarios independently of the live programme", () => {
    const scenarioConfig = getTableConfig(budgetScenarios);
    const envelopeConfig = getTableConfig(budgetScenarioEnvelopes);
    const assignmentConfig = getTableConfig(budgetScenarioAssignments);

    expect(scenarioConfig.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "budget_scenarios_name_not_blank",
        "budget_scenarios_horizon_years_range",
        "budget_scenarios_adopted_at_matches_status"
      ])
    );
    expect(envelopeConfig.primaryKeys).toHaveLength(1);
    expect(envelopeConfig.foreignKeys).toHaveLength(1);
    expect(assignmentConfig.primaryKeys).toHaveLength(1);
    expect(assignmentConfig.foreignKeys).toHaveLength(2);
  });

  it("stores deterministic document parsing separately from asset facts", () => {
    const documentConfig = getTableConfig(documents);
    const processingConfig = getTableConfig(documentProcessingRuns);
    const pageConfig = getTableConfig(documentPages);

    expect(documentConfig.indexes.map((index) => index.config.name)).toContain(
      "documents_checksum_sha256_unique"
    );
    expect(processingConfig.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "document_processing_runs_error_shape",
        "document_processing_runs_timing_shape"
      ])
    );
    expect(pageConfig.primaryKeys).toHaveLength(1);
    expect(pageConfig.checks.map((constraint) => constraint.name)).toContain(
      "document_pages_positive_page_number"
    );
    expect(documentPages.textSource.notNull).toBe(true);
    expect(documentPages.textSource.hasDefault).toBe(true);
  });

  it("tracks staged extraction attempts and provider invocations", () => {
    const runConfig = getTableConfig(documentExtractionRuns);
    const invocationConfig = getTableConfig(documentExtractionInvocations);
    const classificationConfig = getTableConfig(documentPageClassifications);

    expect(runConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "document_extraction_runs_document_attempt_unique",
        "document_extraction_runs_one_active_per_document"
      ])
    );
    expect(invocationConfig.checks.map((constraint) => constraint.name)).toContain(
      "document_extraction_invocations_stage_shape"
    );
    expect(classificationConfig.foreignKeys).toHaveLength(3);
  });

  it("marks bridge aggregate origin without backfilling existing records", () => {
    expect(bridges.dataOrigin.notNull).toBe(false);
    expect(bridges.dataOrigin.hasDefault).toBe(false);
  });

  it("uses composite foreign keys to keep findings within inspection and component scope", () => {
    const references = getTableConfig(findings).foreignKeys.map((foreignKey) => {
      const reference = foreignKey.reference();
      return {
        columns: reference.columns.map((column) => column.name),
        foreignColumns: reference.foreignColumns.map((column) => column.name)
      };
    });

    expect(references).toContainEqual({
      columns: ["inspection_id", "bridge_id", "partial_structure_id"],
      foreignColumns: ["id", "bridge_id", "partial_structure_id"]
    });
    expect(references).toContainEqual({
      columns: ["component_id", "bridge_id", "partial_structure_id"],
      foreignColumns: ["id", "bridge_id", "partial_structure_id"]
    });
  });

  it("keeps provenance as typed entity links", () => {
    const sourceEvidenceConfig = getTableConfig(sourceEvidence);
    const bridgeEvidenceConfig = getTableConfig(bridgeEvidence);
    const findingEvidenceConfig = getTableConfig(findingEvidence);

    expect(bridgeEvidenceConfig.primaryKeys).toHaveLength(1);
    expect(findingEvidenceConfig.primaryKeys).toHaveLength(1);
    expect(bridgeEvidenceConfig.checks.map((constraint) => constraint.name)).toContain(
      "bridge_evidence_field_name_valid"
    );
    expect(findingEvidenceConfig.checks.map((constraint) => constraint.name)).toContain(
      "finding_evidence_derivation_valid"
    );
    expect(sourceEvidenceConfig.checks.map((constraint) => constraint.name)).toContain(
      "source_evidence_run_method"
    );
    expect(sourceEvidenceConfig.checks.map((constraint) => constraint.name)).toContain(
      "source_evidence_review_state"
    );
  });

  it("stores one climate snapshot per bridge and observation year", () => {
    const config = getTableConfig(environmentalMetrics);

    expect(config.indexes.map((index) => index.config.name)).toContain(
      "environmental_metrics_bridge_year_unique"
    );
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "environmental_metrics_year_range",
        "environmental_metrics_monthly_precip_shape",
        "environmental_metrics_monthly_freeze_thaw_shape"
      ])
    );
  });
});
