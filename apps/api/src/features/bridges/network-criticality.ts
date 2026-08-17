import type {
  BridgeConditionTrend,
  BridgeNetwork,
  NetworkCriticalityAssessment,
  NetworkCriticalityBand,
  NetworkMetricSource,
  NetworkRoadClass,
  NetworkTrafficAppliesTo
} from "@bridge-os/contracts";

export const NETWORK_CRITICALITY_POLICY_VERSION = "network-criticality-v1";

export function mapBridgeNetwork(input: {
  readonly additionalDistanceKm: string | null;
  readonly alternativeCrossingCount: number | null;
  readonly carriedRoad: string | null;
  readonly closureDetourKm: string | null;
  readonly dailyTraffic: number | null;
  readonly formulaVersion: string;
  readonly heavyVehicleDaily: number | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly normalTripKm: string | null;
  readonly observationYear: number;
  readonly onStrategicNetwork: boolean;
  readonly roadClass: NetworkRoadClass;
  readonly source: NetworkMetricSource;
  readonly sourceDescription: string | null;
  readonly trafficAppliesTo: NetworkTrafficAppliesTo;
  readonly truckSharePercent: string | null;
}): BridgeNetwork {
  const heavyVehicleDaily = resolveHeavyVehicleDaily(input);
  const assessment = deriveNetworkCriticality({
    additionalDistanceKm: input.additionalDistanceKm,
    alternativeCrossingCount: input.alternativeCrossingCount,
    dailyTraffic: input.dailyTraffic,
    heavyVehicleDaily,
    roadClass: input.roadClass,
    truckSharePercent: input.truckSharePercent
  });
  return {
    observationYear: input.observationYear,
    source: input.source,
    sourceDescription: input.sourceDescription,
    formulaVersion: input.formulaVersion,
    policyVersion: NETWORK_CRITICALITY_POLICY_VERSION,
    location: {
      latitude: input.latitude,
      longitude: input.longitude
    },
    carriedRoad: input.carriedRoad,
    roadClass: input.roadClass,
    trafficAppliesTo: input.trafficAppliesTo,
    onStrategicNetwork: input.onStrategicNetwork,
    distances: {
      normalTripKm: input.normalTripKm,
      closureDetourKm: input.closureDetourKm,
      additionalDistanceKm: input.additionalDistanceKm
    },
    alternativeCrossingCount: input.alternativeCrossingCount,
    traffic: {
      dailyTraffic: input.dailyTraffic,
      heavyVehicleDaily,
      truckSharePercent: input.truckSharePercent
    },
    assessment
  };
}

export interface NetworkCriticalityInput {
  readonly additionalDistanceKm: string | null;
  readonly alternativeCrossingCount: number | null;
  readonly dailyTraffic: number | null;
  readonly heavyVehicleDaily: number | null;
  readonly roadClass: NetworkRoadClass | null;
  readonly truckSharePercent: string | null;
}

export interface NetworkConsequenceInput {
  readonly conditionScore: string | null;
  readonly conditionTrend: BridgeConditionTrend;
  readonly highestRecommendationUrgencyRank: number;
  readonly maximumDurability: number | null;
  readonly maximumStability: number | null;
  readonly maximumTrafficSafety: number | null;
  readonly networkBand: NetworkCriticalityBand | null;
}

interface FactorReason {
  readonly code: string;
  readonly label: string;
  readonly detail: string;
}

export function resolveHeavyVehicleDaily(input: {
  readonly dailyTraffic: number | null;
  readonly heavyVehicleDaily: number | null;
  readonly truckSharePercent: string | null;
}): number | null {
  if (input.heavyVehicleDaily !== null) {
    return input.heavyVehicleDaily;
  }
  if (input.dailyTraffic === null || input.truckSharePercent === null) {
    return null;
  }
  return Math.round((input.dailyTraffic * Number(input.truckSharePercent)) / 100);
}

export function networkPriorityInput(
  metric: {
    readonly additionalDistanceKm: string | null;
    readonly alternativeCrossingCount: number | null;
    readonly roadClass: NetworkRoadClass;
  } | null,
  traffic: {
    readonly dailyTraffic: number | null;
    readonly heavyVehicleDaily: number | null;
    readonly truckSharePercent: string | null;
  } | null
): {
  readonly additionalDistanceKm: string | null;
  readonly alternativeCrossingCount: number | null;
  readonly dailyTraffic: number | null;
  readonly extraVehicleKmPerDay: number | null;
  readonly heavyVehicleDaily: number | null;
  readonly networkBand: NetworkCriticalityBand | null;
} {
  if (metric === null) {
    return {
      additionalDistanceKm: null,
      alternativeCrossingCount: null,
      dailyTraffic: traffic?.dailyTraffic ?? null,
      extraVehicleKmPerDay: null,
      heavyVehicleDaily: resolveHeavyVehicleDaily({
        dailyTraffic: traffic?.dailyTraffic ?? null,
        heavyVehicleDaily: traffic?.heavyVehicleDaily ?? null,
        truckSharePercent: traffic?.truckSharePercent ?? null
      }),
      networkBand: null
    };
  }
  const assessment = deriveNetworkCriticality({
    additionalDistanceKm: metric.additionalDistanceKm,
    alternativeCrossingCount: metric.alternativeCrossingCount,
    dailyTraffic: traffic?.dailyTraffic ?? null,
    heavyVehicleDaily: traffic?.heavyVehicleDaily ?? null,
    roadClass: metric.roadClass,
    truckSharePercent: traffic?.truckSharePercent ?? null
  });
  return {
    additionalDistanceKm: metric.additionalDistanceKm,
    alternativeCrossingCount: metric.alternativeCrossingCount,
    dailyTraffic: traffic?.dailyTraffic ?? null,
    extraVehicleKmPerDay: assessment.extraVehicleKmPerDay,
    heavyVehicleDaily: resolveHeavyVehicleDaily({
      dailyTraffic: traffic?.dailyTraffic ?? null,
      heavyVehicleDaily: traffic?.heavyVehicleDaily ?? null,
      truckSharePercent: traffic?.truckSharePercent ?? null
    }),
    networkBand: assessment.band
  };
}

export function extraVehicleKilometresPerDay(
  additionalDistanceKm: string | null,
  dailyCount: number | null
): number | null {
  if (additionalDistanceKm === null || dailyCount === null) {
    return null;
  }
  return Number(additionalDistanceKm) * dailyCount;
}

export function deriveNetworkCriticality(
  input: NetworkCriticalityInput
): NetworkCriticalityAssessment {
  const heavyVehicleDaily = resolveHeavyVehicleDaily(input);
  const extraVehicleKmPerDay = extraVehicleKilometresPerDay(
    input.additionalDistanceKm,
    input.dailyTraffic
  );
  const extraHeavyVehicleKmPerDay = extraVehicleKilometresPerDay(
    input.additionalDistanceKm,
    heavyVehicleDaily
  );
  const reasons: FactorReason[] = [];
  let points = 0;

  points += addVolumeReason(reasons, input.dailyTraffic);
  points += addHeavyVehicleReason(reasons, heavyVehicleDaily);
  points += addDetourReason(reasons, input.additionalDistanceKm);
  points += addRedundancyReason(reasons, input.alternativeCrossingCount);
  points += addRoadClassReason(reasons, input.roadClass);

  const band = bandFor(points);
  return {
    band,
    points,
    extraVehicleKmPerDay,
    extraHeavyVehicleKmPerDay,
    summary: summaryFor(band, extraVehicleKmPerDay, input.additionalDistanceKm),
    reasons
  };
}

/**
 * Network importance only becomes an attention reason when the structure
 * already has a condition, finding, or recommendation concern. Volume must
 * not invent CRITICAL or HIGH on an otherwise quiet bridge.
 */
export function hasHighNetworkConsequence(input: NetworkConsequenceInput): boolean {
  if (input.networkBand !== "HIGH") {
    return false;
  }
  const condition =
    input.conditionScore === null ? null : Number(input.conditionScore);
  return (
    (input.maximumDurability ?? 0) >= 2 ||
    (input.maximumStability ?? 0) >= 2 ||
    (input.maximumTrafficSafety ?? 0) >= 2 ||
    input.conditionTrend === "DETERIORATING" ||
    input.highestRecommendationUrgencyRank >= 2 ||
    (condition !== null && condition >= 2.5)
  );
}

export function describeTrafficManagementRequirements(input: {
  readonly additionalDistanceKm: string | null;
  readonly alternativeCrossingCount: number | null;
  readonly closureDetourKm: string | null;
  readonly heavyVehicleDaily: number | null;
  readonly normalTripKm: string | null;
}): string | null {
  if (input.additionalDistanceKm === null) {
    return null;
  }
  const extraKm = Number(input.additionalDistanceKm);
  const alternatives = input.alternativeCrossingCount;
  const diversion =
    extraKm >= 15 || alternatives === 0
      ? "Weiträumige Umleitung"
      : extraKm >= 5
        ? "Örtliche Umleitung"
        : "Local traffic management";
  const distances = [
    input.normalTripKm === null ? null : `normal trip ${input.normalTripKm} km`,
    input.closureDetourKm === null ? null : `closure detour ${input.closureDetourKm} km`,
    `additional ${input.additionalDistanceKm} km`
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
  const heavy =
    input.heavyVehicleDaily !== null && input.heavyVehicleDaily >= 3_000
      ? ` Diversion must be HGV-capable (${input.heavyVehicleDaily.toLocaleString("en-US")} heavy vehicles/day).`
      : "";
  const redundancy =
    alternatives === null
      ? ""
      : alternatives === 0
        ? " No comparable-class alternative crossing."
        : ` ${String(alternatives)} comparable-class alternative crossing${alternatives === 1 ? "" : "s"}.`;
  return `${diversion} required (${distances}).${redundancy}${heavy}`;
}

function addVolumeReason(reasons: FactorReason[], dailyTraffic: number | null): number {
  const points = thresholdPoints(dailyTraffic, [
    [50_000, 3],
    [30_000, 2],
    [10_000, 1]
  ]);
  if (points === 0 || dailyTraffic === null) {
    return 0;
  }
  reasons.push({
    code: "HIGH_VOLUME",
    label: `DTV ${dailyTraffic.toLocaleString("en-US")}`,
    detail: `${dailyTraffic.toLocaleString("en-US")} vehicles per day on the carried road.`
  });
  return points;
}

function addHeavyVehicleReason(
  reasons: FactorReason[],
  heavyVehicleDaily: number | null
): number {
  const points = thresholdPoints(heavyVehicleDaily, [
    [8_000, 3],
    [6_000, 2],
    [3_000, 1]
  ]);
  if (points === 0 || heavyVehicleDaily === null) {
    return 0;
  }
  reasons.push({
    code: "HIGH_HGV",
    label: `HGV ${heavyVehicleDaily.toLocaleString("en-US")}/day`,
    detail: `${heavyVehicleDaily.toLocaleString("en-US")} heavy vehicles per day.`
  });
  return points;
}

function addDetourReason(
  reasons: FactorReason[],
  additionalDistanceKm: string | null
): number {
  if (additionalDistanceKm === null) {
    return 0;
  }
  const extraKm = Number(additionalDistanceKm);
  const points = thresholdPoints(extraKm, [
    [30, 3],
    [15, 2],
    [5, 1]
  ]);
  if (points === 0) {
    return 0;
  }
  reasons.push({
    code: "LONG_DETOUR",
    label: `+${additionalDistanceKm} km detour`,
    detail: `Closure adds ${additionalDistanceKm} km versus the unimpeded trip.`
  });
  return points;
}

function addRedundancyReason(
  reasons: FactorReason[],
  alternativeCrossingCount: number | null
): number {
  if (alternativeCrossingCount === null || alternativeCrossingCount >= 2) {
    return 0;
  }
  const points = alternativeCrossingCount === 0 ? 2 : 1;
  reasons.push({
    code: alternativeCrossingCount === 0 ? "NO_ALTERNATIVE" : "SINGLE_ALTERNATIVE",
    label:
      alternativeCrossingCount === 0
        ? "No alternative crossing"
        : "One alternative crossing",
    detail:
      alternativeCrossingCount === 0
        ? "No comparable-class crossing reconnects the same origin–destination."
        : "Only one comparable-class alternative crossing is available."
  });
  return points;
}

function addRoadClassReason(
  reasons: FactorReason[],
  roadClass: NetworkRoadClass | null
): number {
  if (roadClass !== "AUTOBAHN") {
    return 0;
  }
  reasons.push({
    code: "AUTOBAHN",
    label: "Autobahn",
    detail: "The structure carries a federal motorway. Volume and detour already carry most of this signal."
  });
  return 1;
}

function thresholdPoints(
  value: number | null,
  table: readonly (readonly [number, number])[]
): number {
  if (value === null) {
    return 0;
  }
  for (const [threshold, points] of table) {
    if (value >= threshold) {
      return points;
    }
  }
  return 0;
}

function bandFor(points: number): NetworkCriticalityBand {
  if (points >= 8) {
    return "HIGH";
  }
  if (points >= 4) {
    return "MEDIUM";
  }
  return "LOW";
}

function summaryFor(
  band: NetworkCriticalityBand,
  extraVehicleKmPerDay: number | null,
  additionalDistanceKm: string | null
): string {
  const impact =
    extraVehicleKmPerDay === null
      ? additionalDistanceKm === null
        ? "Closure impact is not yet quantified."
        : `Closure adds ${additionalDistanceKm} km.`
      : `Closure adds ${Math.round(extraVehicleKmPerDay).toLocaleString("en-US")} vehicle-km per day.`;
  if (band === "HIGH") {
    return `High network consequence. ${impact}`;
  }
  if (band === "MEDIUM") {
    return `Moderate network consequence. ${impact}`;
  }
  return `Limited network consequence. ${impact}`;
}
