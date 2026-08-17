import type { BudgetItem, NetworkRoadClass } from "@bridge-os/contracts";

import { hasHighEnvironmentalExposure } from "../bridges/climate-exposure.js";
import { networkPriorityInput } from "../bridges/network-criticality.js";
import { deriveInspectionDueStatus } from "../planning/inspection-due.js";
import { deriveMaintenancePriority } from "../planning/prioritization.js";
import { adjustForConstructionPriceInflation } from "./inflation-adjustment.js";

export interface BudgetItemSourceRow {
  readonly bridgeId: string;
  readonly bridgeExternalStructureNumber: string | null;
  readonly bridgeName: string | null;
  readonly bridgeRoad: string | null;
  readonly partialStructureId: string;
  readonly recommendationId: string;
  readonly recommendationUrgency: string | null;
  readonly recommendationTargetYear: number | null;
  readonly sourceEstimatedCost: string | null;
  readonly sourceEstimatedCostCurrency: string | null;
  readonly interventionId: string;
  readonly interventionWorkType: string;
  readonly interventionPlannedYear: number;
  readonly interventionStatus: BudgetItem["intervention"]["status"];
  readonly interventionEstimatedCost: string | null;
  readonly interventionEstimatedCostCurrency: string | null;
  readonly interventionEstimatedCostSource: BudgetItem["intervention"]["estimatedCostSource"];
  readonly interventionEstimatedCostStatus: BudgetItem["intervention"]["estimatedCostStatus"];
  readonly membershipInterventionId: string | null;
}

export interface BudgetItemFindingRow {
  readonly recommendationId: string;
  readonly status: string | null;
  readonly stabilityRating: number | null;
  readonly trafficSafetyRating: number | null;
  readonly durabilityRating: number | null;
  readonly inspectedOn: string | null;
}

export interface BudgetItemInspectionRow {
  readonly id: string;
  readonly partialStructureId: string;
  readonly inspectedOn: string | null;
  readonly conditionScore: string | null;
  readonly cycleMonths: number | null;
}

export interface BudgetItemEnvironmentRow {
  readonly freezeThawDays: number | null;
  readonly heavyRainDays20: number | null;
  readonly deicingDays: number | null;
}

export interface BudgetItemNetworkRow {
  readonly additionalDistanceKm: string | null;
  readonly alternativeCrossingCount: number | null;
  readonly roadClass: NetworkRoadClass;
}

export interface BudgetItemTrafficRow {
  readonly dailyTraffic: number | null;
  readonly heavyVehicleDaily: number | null;
  readonly truckSharePercent: string | null;
}

export function mapBudgetItem(
  row: BudgetItemSourceRow,
  findingRows: readonly BudgetItemFindingRow[],
  inspectionRows: readonly BudgetItemInspectionRow[],
  traffic: BudgetItemTrafficRow | null,
  environment: BudgetItemEnvironmentRow | null,
  network: BudgetItemNetworkRow | null,
  asOf: string
): BudgetItem {
  const activeFindings = findingRows.filter(
    (finding) => finding.status === "OPEN" || finding.status === "MONITORING"
  );
  const datedInspections = inspectionRows.filter(
    (inspection): inspection is BudgetItemInspectionRow & { inspectedOn: string } =>
      inspection.inspectedOn !== null
  );
  const scored = datedInspections.filter(
    (inspection): inspection is typeof inspection & { conditionScore: string } =>
      inspection.conditionScore !== null
  );
  const conditionDelta =
    scored[0] === undefined || scored[1] === undefined
      ? null
      : (Number(scored[0].conditionScore) - Number(scored[1].conditionScore)).toFixed(1);
  const sourceDate =
    findingRows
      .map((finding) => finding.inspectedOn)
      .filter((date): date is string => date !== null)
      .sort()[0] ?? null;
  const interventionEstimate = moneyPair(
    row.interventionEstimatedCost,
    row.interventionEstimatedCostCurrency
  );
  const sourceEstimate = moneyPair(
    row.sourceEstimatedCost,
    row.sourceEstimatedCostCurrency
  );
  const inflationAdjustedEstimate =
    sourceEstimate === null || sourceDate === null
      ? null
      : adjustForConstructionPriceInflation({
          amount: sourceEstimate.amount,
          currency: sourceEstimate.currency,
          sourceYear: yearOf(sourceDate),
          asOfYear: yearOf(asOf)
        });
  const estimate =
    interventionEstimate === null ||
    row.interventionEstimatedCostSource === null ||
    row.interventionEstimatedCostStatus === null
      ? sourceEstimate === null
        ? null
        : { ...sourceEstimate, source: "SOURCE_DOCUMENT" as const, status: null }
      : {
          ...interventionEstimate,
          source: row.interventionEstimatedCostSource,
          status: row.interventionEstimatedCostStatus
        };
  const networkPriority = networkPriorityInput(network, traffic);

  return {
    bridge: {
      id: row.bridgeId,
      externalStructureNumber: row.bridgeExternalStructureNumber,
      name: row.bridgeName,
      road: row.bridgeRoad
    },
    intervention: {
      id: row.interventionId,
      workType: row.interventionWorkType,
      plannedYear: row.interventionPlannedYear,
      status: row.interventionStatus,
      estimatedCost: interventionEstimate,
      estimatedCostSource: row.interventionEstimatedCostSource,
      estimatedCostStatus: row.interventionEstimatedCostStatus
    },
    sourceRecommendation: {
      id: row.recommendationId,
      urgency: row.recommendationUrgency,
      targetYear: row.recommendationTargetYear,
      sourceEstimatedCost: sourceEstimate,
      sourceDate,
      inflationAdjustedEstimate
    },
    estimate,
    estimateRequired: estimate === null,
    included: row.membershipInterventionId !== null,
    networkCriticality:
      networkPriority.networkBand === null
        ? null
        : {
            band: networkPriority.networkBand,
            extraVehicleKmPerDay: networkPriority.extraVehicleKmPerDay
          },
    priority: deriveMaintenancePriority({
      asOf,
      conditionDelta,
      ...networkPriority,
      hasEnvironmentalExposure: hasHighEnvironmentalExposure({
        freezeThawDays: environment?.freezeThawDays ?? null,
        heavyRainDays20: environment?.heavyRainDays20 ?? null,
        deicingDays: environment?.deicingDays ?? null,
        maximumDurability: maximum(activeFindings, "durabilityRating")
      }),
      inspectionStatus: deriveInspectionDueStatus(datedInspections[0], asOf),
      maximumDurability: maximum(activeFindings, "durabilityRating"),
      maximumStability: maximum(activeFindings, "stabilityRating"),
      maximumTrafficSafety: maximum(activeFindings, "trafficSafetyRating"),
      recommendationSourceDate: sourceDate,
      urgency: row.recommendationUrgency
    })
  };
}

export function groupBy<Row>(
  rows: readonly Row[],
  key: (row: Row) => string
): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const value = key(row);
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  }
  return grouped;
}

export function latestTrafficByBridge<Row extends { readonly bridgeId: string }>(
  rows: readonly Row[]
): Map<string, Row> {
  const latest = new Map<string, Row>();
  for (const row of rows) {
    if (!latest.has(row.bridgeId)) latest.set(row.bridgeId, row);
  }
  return latest;
}

function maximum(
  rows: readonly BudgetItemFindingRow[],
  key: "durabilityRating" | "stabilityRating" | "trafficSafetyRating"
): number | null {
  const values = rows
    .map((row) => row[key])
    .filter((value): value is number => value !== null);
  return values.length === 0 ? null : Math.max(...values);
}

export function moneyPair(
  amount: string | null,
  currency: string | null
): { amount: string; currency: string } | null {
  return amount === null || currency === null ? null : { amount, currency };
}

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}
