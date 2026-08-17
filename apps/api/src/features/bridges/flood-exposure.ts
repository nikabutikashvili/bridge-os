import type {
  BridgeHydrology,
  FloodExposureAssessment,
  FloodExposureBand,
  FloodHistoryEvent,
  HydrologicalWaterState
} from "@bridge-os/contracts";

export const FLOOD_EXPOSURE_POLICY_VERSION = "flood-exposure-v1";
export const SPECIAL_INSPECTION_WINDOW_MONTHS = 12;
export const REPAIR_WINDOW_MONTHS = 24;

export interface CharacteristicThresholds {
  readonly mhwCm: number | null;
  readonly hswCm: number | null;
  readonly hhwCm: number | null;
  readonly markeICm: number | null;
  readonly markeIICm: number | null;
}

export interface FloodEventInput extends CharacteristicThresholds {
  readonly eventYear: number;
  readonly peakedOn: string;
  readonly peakWaterLevelCm: number;
  readonly stationName: string;
  readonly waterName: string;
}

export interface FloodInspectionInput {
  readonly id: string;
  readonly type: "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null;
  readonly inspectedOn: string | null;
}

export interface FloodFindingInput {
  readonly id: string;
  readonly defectType: string | null;
  readonly description: string | null;
  readonly sourceIdentifier: string | null;
  readonly status: "OPEN" | "MONITORING" | "RESOLVED" | "DISMISSED" | null;
  readonly inspectedOn: string | null;
}

export interface FloodWorkInput {
  readonly id: string;
  readonly title: string | null;
  readonly reason: string | null;
  readonly startedOn: string | null;
  readonly endedOn: string | null;
}

export interface FloodComponentInput {
  readonly type: string | null;
}

export interface FloodExposureInput {
  readonly crossedFeature: string | null;
  readonly current: {
    readonly waterLevelCm: number;
    readonly inspectionTriggerCm: number;
    readonly stationName: string;
    readonly waterName: string;
    readonly thresholds: CharacteristicThresholds;
  };
  readonly events: readonly FloodEventInput[];
  readonly inspections: readonly FloodInspectionInput[];
  readonly findings: readonly FloodFindingInput[];
  readonly historicalWorks: readonly FloodWorkInput[];
  readonly components: readonly FloodComponentInput[];
}

interface FactorReason {
  readonly code: string;
  readonly label: string;
  readonly detail: string;
}

export function deriveFloodBand(
  levelCm: number,
  thresholds: CharacteristicThresholds
): FloodExposureBand {
  if (thresholds.hhwCm !== null && levelCm >= thresholds.hhwCm) {
    return "EXTREME";
  }
  const highMark = thresholds.hswCm ?? thresholds.markeIICm;
  if (highMark !== null && levelCm >= highMark) {
    return "HIGH";
  }
  const moderateMark = thresholds.mhwCm ?? thresholds.markeICm;
  if (moderateMark !== null && levelCm >= moderateMark) {
    return "MODERATE";
  }
  return "BELOW_TRIGGER";
}

export function isWatercourseCrossing(crossedFeature: string | null): boolean {
  return detectWatercourse(crossedFeature) !== null;
}

export function isScourFinding(finding: {
  readonly defectType: string | null;
  readonly description: string | null;
}): boolean {
  return matchesAnyText(
    [finding.defectType, finding.description],
    ["kolk", "scour", "unterspul", "unterspül"]
  );
}

export function isFoundationComponent(type: string | null): boolean {
  return matchesText(type, ["grundung", "gründung", "pfahl", "widerlager"]);
}

export function deriveFloodExposure(input: FloodExposureInput): FloodExposureAssessment {
  const watercourse = detectWatercourse(input.crossedFeature);
  const scourFindings = input.findings.filter((finding) => isScourFinding(finding));
  const hasOpenScourFinding = scourFindings.some(
    (finding) => finding.status === "OPEN" || finding.status === "MONITORING"
  );
  const hasFoundation = input.components.some((component) =>
    isFoundationComponent(component.type)
  );
  const scourSensitive =
    watercourse !== null && (scourFindings.length > 0 || hasFoundation);
  const currentBand = deriveFloodBand(
    input.current.waterLevelCm,
    input.current.thresholds
  );
  const triggerExceeded = input.current.waterLevelCm >= input.current.inspectionTriggerCm;
  const history = [...input.events]
    .sort((left, right) => right.peakedOn.localeCompare(left.peakedOn))
    .map((event) => correlateEvent(event, input));
  const latestActionable = history.find((event) => event.band !== "BELOW_TRIGGER");
  const unmatchedPostFloodInspection = latestActionable?.specialInspection === null;
  const recommendedAction =
    scourSensitive && unmatchedPostFloodInspection && latestActionable !== undefined
      ? {
          kind: "EXTRAORDINARY_INSPECTION" as const,
          eventYear: latestActionable.eventYear,
          peakedOn: latestActionable.peakedOn,
          summary: extraordinaryInspectionSummary(
            latestActionable,
            input.current.stationName,
            triggerExceeded
          )
        }
      : null;

  const reasons: FactorReason[] = [];
  reasons.push({
    code: "NEAREST_GAUGE",
    label: `${input.current.stationName} (${input.current.waterName})`,
    detail: `${String(input.current.waterLevelCm)} cm at the seeded nearest federal gauge versus a ${String(input.current.inspectionTriggerCm)} cm inspection trigger (MHW).`
  });
  if (watercourse) {
    reasons.push({
      code: "WATERCOURSE",
      label: `Crosses ${watercourse}`,
      detail: `Bauwerksbuch crossed feature: “${input.crossedFeature ?? ""}”.`
    });
  }
  if (scourFindings.length > 0) {
    reasons.push({
      code: "SCOUR_HISTORY",
      label: "Historically scour-sensitive foundation",
      detail: describeScourFindings(scourFindings)
    });
  } else if (hasFoundation && watercourse) {
    reasons.push({
      code: "FOUNDATION_TYPE",
      label: "Foundation / abutment recorded",
      detail: "A foundation or abutment component is known; no Kolk finding is attached yet."
    });
  }
  if (triggerExceeded) {
    reasons.push({
      code: "TRIGGER_EXCEEDED",
      label: "Inspection trigger exceeded",
      detail: `Current water level ${String(input.current.waterLevelCm)} cm is at or above the ${String(input.current.inspectionTriggerCm)} cm trigger.`
    });
  }
  if (unmatchedPostFloodInspection && latestActionable !== undefined) {
    reasons.push({
      code: "UNMATCHED_FLOOD_EVENT",
      label: `${String(latestActionable.eventYear)} ${floodBandLabel(latestActionable.band)} without Sonderprüfung`,
      detail: `Peak ${String(latestActionable.peakWaterLevelCm)} cm at ${latestActionable.stationName} on ${latestActionable.peakedOn} has no special inspection in the following 12 months.`
    });
  }

  const watchActive = scourSensitive && (triggerExceeded || unmatchedPostFloodInspection);
  return {
    band: watchActive
      ? triggerExceeded
        ? currentBand === "BELOW_TRIGGER"
          ? "MODERATE"
          : currentBand
        : (latestActionable?.band ?? "MODERATE")
      : currentBand === "BELOW_TRIGGER"
        ? "BELOW_TRIGGER"
        : currentBand,
    triggerExceeded,
    scourSensitive,
    hasOpenScourFinding,
    unmatchedPostFloodInspection,
    summary: floodSummary({
      triggerExceeded,
      recommendedAction: recommendedAction?.summary ?? null,
      stationName: input.current.stationName,
      waterLevelCm: input.current.waterLevelCm,
      watercourse
    }),
    reasons,
    history,
    recommendedAction
  };
}

export function hasHighFloodExposure(assessment: FloodExposureAssessment | null): boolean {
  if (assessment === null) {
    return false;
  }
  return (
    assessment.scourSensitive &&
    (assessment.triggerExceeded || assessment.unmatchedPostFloodInspection)
  );
}

export function mapBridgeHydrology(input: {
  readonly stationUuid: string;
  readonly stationName: string;
  readonly stationNumber: string | null;
  readonly waterName: string;
  readonly riverKm: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly distanceKm: string | null;
  readonly observedAt: string;
  readonly waterLevelCm: number;
  readonly unit: string;
  readonly stateMnwMhw: HydrologicalWaterState | null;
  readonly stateNswHsw: HydrologicalWaterState | null;
  readonly mhwCm: number | null;
  readonly hswCm: number | null;
  readonly hhwCm: number | null;
  readonly mnwCm: number | null;
  readonly mwCm: number | null;
  readonly markeICm: number | null;
  readonly markeIICm: number | null;
  readonly inspectionTriggerCm: number;
  readonly source: BridgeHydrology["source"];
  readonly sourceDescription: string | null;
  readonly formulaVersion: string;
  readonly assessment: FloodExposureAssessment;
}): BridgeHydrology {
  return {
    stationUuid: input.stationUuid,
    stationName: input.stationName,
    stationNumber: input.stationNumber,
    waterName: input.waterName,
    riverKm: input.riverKm,
    distanceKm: input.distanceKm,
    observedAt: input.observedAt,
    waterLevelCm: input.waterLevelCm,
    unit: input.unit,
    stateMnwMhw: input.stateMnwMhw,
    stateNswHsw: input.stateNswHsw,
    mhwCm: input.mhwCm,
    hswCm: input.hswCm,
    hhwCm: input.hhwCm,
    mnwCm: input.mnwCm,
    mwCm: input.mwCm,
    markeICm: input.markeICm,
    markeIICm: input.markeIICm,
    inspectionTriggerCm: input.inspectionTriggerCm,
    source: input.source,
    sourceDescription: input.sourceDescription,
    formulaVersion: input.formulaVersion,
    policyVersion: FLOOD_EXPOSURE_POLICY_VERSION,
    location: {
      latitude: input.latitude,
      longitude: input.longitude
    },
    assessment: input.assessment
  };
}

function correlateEvent(
  event: FloodEventInput,
  input: FloodExposureInput
): FloodHistoryEvent {
  const band = deriveFloodBand(event.peakWaterLevelCm, event);
  const windowEnd = addUtcMonths(event.peakedOn, SPECIAL_INSPECTION_WINDOW_MONTHS);
  const repairEnd = addUtcMonths(event.peakedOn, REPAIR_WINDOW_MONTHS);
  const specialInspection =
    input.inspections.find(
      (inspection) =>
        inspection.type === "SPECIAL" &&
        inspection.inspectedOn !== null &&
        inspection.inspectedOn >= event.peakedOn &&
        inspection.inspectedOn < windowEnd
    ) ?? null;
  const scourFinding =
    input.findings.find(
      (finding) =>
        isScourFinding(finding) &&
        finding.inspectedOn !== null &&
        finding.inspectedOn >= event.peakedOn &&
        finding.inspectedOn < windowEnd
    ) ?? null;
  const repair =
    input.historicalWorks.find((work) => {
      const workDate = work.startedOn ?? work.endedOn;
      return (
        workDate !== null &&
        workDate >= event.peakedOn &&
        workDate < repairEnd &&
        matchesAnyText(
          [work.title, work.reason],
          ["kolk", "scour", "unterspul", "unterspül", "grundung", "gründung", "widerlager"]
        )
      );
    }) ?? null;

  return {
    eventYear: event.eventYear,
    peakedOn: event.peakedOn,
    peakWaterLevelCm: event.peakWaterLevelCm,
    band,
    stationName: event.stationName,
    waterName: event.waterName,
    specialInspection: linkedSpecialInspection(specialInspection),
    scourFinding:
      scourFinding === null
        ? null
        : {
            id: scourFinding.id,
            defectType: scourFinding.defectType,
            sourceIdentifier: scourFinding.sourceIdentifier,
            status: scourFinding.status
          },
    repair:
      repair === null
        ? null
        : { id: repair.id, title: repair.title, endedOn: repair.endedOn }
  };
}

function linkedSpecialInspection(
  inspection: FloodInspectionInput | null
): FloodHistoryEvent["specialInspection"] {
  if (inspection?.inspectedOn == null) {
    return null;
  }
  return { id: inspection.id, inspectedOn: inspection.inspectedOn };
}

function extraordinaryInspectionSummary(
  event: FloodHistoryEvent,
  nearestStationName: string,
  currentTriggerExceeded: boolean
): string {
  const when = currentTriggerExceeded
    ? "the current high-water event"
    : `the ${String(event.eventYear)} high-water event`;
  return (
    `This structure should receive an extraordinary inspection following ${when} ` +
    `because its foundation is historically scour-sensitive and water at ${event.stationName} ` +
    `exceeded the inspection trigger. Nearest seeded gauge: ${nearestStationName}.`
  );
}

function floodSummary(input: {
  readonly triggerExceeded: boolean;
  readonly recommendedAction: string | null;
  readonly stationName: string;
  readonly waterLevelCm: number;
  readonly watercourse: string | null;
}): string {
  if (input.recommendedAction !== null) {
    return input.recommendedAction;
  }
  if (input.triggerExceeded) {
    return `Water at ${input.stationName} is ${String(input.waterLevelCm)} cm, at or above the inspection trigger.`;
  }
  if (input.watercourse) {
    return `Scour watch for ${input.watercourse}: nearest federal gauge ${input.stationName} is below the inspection trigger.`;
  }
  return `No waterway flood watch. Seeded level at ${input.stationName} is ${String(input.waterLevelCm)} cm.`;
}

function floodBandLabel(band: FloodExposureBand): string {
  if (band === "BELOW_TRIGGER") {
    return "below trigger";
  }
  return band.toLowerCase();
}

function describeScourFindings(
  findings: readonly FloodFindingInput[]
): string {
  const labels = findings
    .map((finding) => finding.sourceIdentifier ?? finding.defectType)
    .filter((label): label is string => label !== null)
    .slice(0, 3);
  const prefix = labels.length === 0 ? "A scour finding" : labels.join(", ");
  return `${prefix} is recorded against the foundation or abutment.`;
}

export function detectWatercourse(crossedFeature: string | null): string | null {
  if (crossedFeature === null || crossedFeature.trim().length === 0) {
    return null;
  }
  if (!matchesText(crossedFeature, ["bach", "tal", "fluss", "gewasser", "gewässer", "river"])) {
    return null;
  }
  return crossedFeature.trim();
}

function matchesAnyText(
  values: readonly (string | null)[],
  needles: readonly string[]
): boolean {
  return values.some((value) => matchesText(value, needles));
}

function matchesText(value: string | null, needles: readonly string[]): boolean {
  if (value === null) {
    return false;
  }
  const normalized = normalize(value);
  return needles.some((needle) => normalized.includes(normalize(needle)));
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("de-DE");
}

function addUtcMonths(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}
