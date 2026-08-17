import type { FloodExposureAssessment } from "@bridge-os/contracts";
import {
  bridges,
  components,
  findings,
  historicalWorks,
  hydrologicalFloodEvents,
  hydrologicalMetrics,
  inspections,
  type BridgeDatabase
} from "@bridge-os/db";
import { desc, eq, inArray } from "drizzle-orm";

import { deriveFloodExposure } from "./flood-exposure.js";

export interface LoadedFlood {
  readonly metric: typeof hydrologicalMetrics.$inferSelect;
  readonly assessment: FloodExposureAssessment;
}

export async function loadFloodAssessments(
  database: BridgeDatabase,
  bridgeIds: string[]
): Promise<Map<string, LoadedFlood>> {
  const assessments = new Map<string, LoadedFlood>();
  if (bridgeIds.length === 0) {
    return assessments;
  }

  const [
    metricRows,
    eventRows,
    inspectionRows,
    findingRows,
    workRows,
    bridgeRows,
    componentRows
  ] = await Promise.all([
    database
      .select()
      .from(hydrologicalMetrics)
      .where(inArray(hydrologicalMetrics.bridgeId, bridgeIds)),
    database
      .select()
      .from(hydrologicalFloodEvents)
      .where(inArray(hydrologicalFloodEvents.bridgeId, bridgeIds))
      .orderBy(desc(hydrologicalFloodEvents.peakedOn)),
    database
      .select({
        id: inspections.id,
        bridgeId: inspections.bridgeId,
        type: inspections.type,
        inspectedOn: inspections.inspectedOn
      })
      .from(inspections)
      .where(inArray(inspections.bridgeId, bridgeIds)),
    database
      .select({
        id: findings.id,
        bridgeId: findings.bridgeId,
        defectType: findings.defectType,
        description: findings.description,
        sourceIdentifier: findings.sourceIdentifier,
        status: findings.status,
        inspectedOn: inspections.inspectedOn
      })
      .from(findings)
      .innerJoin(inspections, eq(inspections.id, findings.inspectionId))
      .where(inArray(findings.bridgeId, bridgeIds)),
    database
      .select({
        id: historicalWorks.id,
        bridgeId: historicalWorks.bridgeId,
        title: historicalWorks.title,
        reason: historicalWorks.reason,
        startedOn: historicalWorks.startedOn,
        endedOn: historicalWorks.endedOn
      })
      .from(historicalWorks)
      .where(inArray(historicalWorks.bridgeId, bridgeIds)),
    database
      .select({
        id: bridges.id,
        crossedFeature: bridges.crossedFeature
      })
      .from(bridges)
      .where(inArray(bridges.id, bridgeIds)),
    database
      .select({
        bridgeId: components.bridgeId,
        type: components.type
      })
      .from(components)
      .where(inArray(components.bridgeId, bridgeIds))
  ]);

  const eventsByBridge = groupBy(eventRows, (row) => row.bridgeId);
  const inspectionsByBridge = groupBy(inspectionRows, (row) => row.bridgeId);
  const findingsByBridge = groupBy(findingRows, (row) => row.bridgeId);
  const worksByBridge = groupBy(workRows, (row) => row.bridgeId);
  const componentsByBridge = groupBy(componentRows, (row) => row.bridgeId);
  const crossedFeatureByBridge = new Map(
    bridgeRows.map((row) => [row.id, row.crossedFeature] as const)
  );

  for (const metric of metricRows) {
    assessments.set(metric.bridgeId, {
      metric,
      assessment: deriveFloodExposure({
        crossedFeature: crossedFeatureByBridge.get(metric.bridgeId) ?? null,
        current: {
          waterLevelCm: metric.waterLevelCm,
          inspectionTriggerCm: metric.inspectionTriggerCm,
          stationName: metric.stationName,
          waterName: metric.waterName,
          thresholds: {
            mhwCm: metric.mhwCm,
            hswCm: metric.hswCm,
            hhwCm: metric.hhwCm,
            markeICm: metric.markeICm,
            markeIICm: metric.markeIICm
          }
        },
        events: (eventsByBridge.get(metric.bridgeId) ?? []).map((event) => ({
          eventYear: event.eventYear,
          peakedOn: toIsoDate(event.peakedOn),
          peakWaterLevelCm: event.peakWaterLevelCm,
          stationName: event.stationName,
          waterName: event.waterName,
          mhwCm: event.mhwCm,
          hswCm: event.hswCm,
          hhwCm: event.hhwCm,
          markeICm: event.markeICm,
          markeIICm: event.markeIICm
        })),
        inspections: (inspectionsByBridge.get(metric.bridgeId) ?? []).map((inspection) => ({
          ...inspection,
          inspectedOn: inspection.inspectedOn === null ? null : toIsoDate(inspection.inspectedOn)
        })),
        findings: (findingsByBridge.get(metric.bridgeId) ?? []).map((finding) => ({
          ...finding,
          inspectedOn: finding.inspectedOn === null ? null : toIsoDate(finding.inspectedOn)
        })),
        historicalWorks: (worksByBridge.get(metric.bridgeId) ?? []).map((work) => ({
          ...work,
          startedOn: work.startedOn === null ? null : toIsoDate(work.startedOn),
          endedOn: work.endedOn === null ? null : toIsoDate(work.endedOn)
        })),
        components: componentsByBridge.get(metric.bridgeId) ?? []
      })
    });
  }

  return assessments;
}

function toIsoDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function groupBy<T>(
  rows: readonly T[],
  key: (row: T) => string
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const group = grouped.get(key(row)) ?? [];
    group.push(row);
    grouped.set(key(row), group);
  }
  return grouped;
}
