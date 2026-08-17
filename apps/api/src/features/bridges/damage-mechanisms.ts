import type {
  DamageMechanismAssessment,
  DamageMechanismBand,
  DamageMechanismConfidence,
  DamageMechanismKind,
  FloodExposureAssessment
} from "@bridge-os/contracts";

import { DAMAGE_MECHANISM_POLICY_VERSION } from "./climate-exposure.js";
import {
  detectWatercourse,
  isFoundationComponent,
  isScourFinding
} from "./flood-exposure.js";

export { DAMAGE_MECHANISM_POLICY_VERSION };

export interface MechanismFindingInput {
  readonly id: string;
  readonly defectType: string | null;
  readonly description: string | null;
  readonly sourceIdentifier: string | null;
  readonly durabilityRating: number | null;
  readonly status: "OPEN" | "MONITORING" | "RESOLVED" | "DISMISSED" | null;
  readonly componentType: string | null;
  readonly componentMaterial: string | null;
}

export interface MechanismComponentInput {
  readonly type: string | null;
  readonly material: string | null;
  readonly constructionYear: number | null;
  readonly installYear: number | null;
}

export interface MechanismClimateInput {
  readonly freezeThawDays: number | null;
  readonly wetDryCycles: number | null;
  readonly meanRelativeHumidityPercent: string | null;
  readonly precipitationHours: number | null;
  readonly heavyRainDays20: number | null;
  readonly deicingDays: number | null;
}

export interface DamageMechanismInput {
  readonly asOfYear: number;
  readonly climate: MechanismClimateInput;
  readonly constructionYear: number | null;
  readonly crossedFeature: string | null;
  readonly dailyTraffic: number | null;
  readonly components: readonly MechanismComponentInput[];
  readonly findings: readonly MechanismFindingInput[];
  readonly hydrology: FloodExposureAssessment | null;
}

interface MechanismReason {
  readonly code: string;
  readonly label: string;
  readonly detail: string;
}

const activeStatuses = new Set(["OPEN", "MONITORING"]);

export function deriveDamageMechanisms(
  input: DamageMechanismInput
): DamageMechanismAssessment[] {
  const findings = input.findings.filter(
    (finding) => finding.status !== null && activeStatuses.has(finding.status)
  );
  return [
    assessRcCorrosion(input, findings),
    assessSteelCorrosion(input, findings),
    assessWaterIngress(input, findings),
    assessScour(input, findings)
  ];
}

function assessRcCorrosion(
  input: DamageMechanismInput,
  findings: readonly MechanismFindingInput[]
): DamageMechanismAssessment {
  const reasons: MechanismReason[] = [];
  let points = 0;
  const age = yearsSince(input.constructionYear, input.asOfYear);
  if (age !== null && age >= 40) {
    const extra = age >= 50 ? 2 : 1;
    points += extra;
    reasons.push({
      code: "AGE",
      label: `Structure age ${String(age)} years`,
      detail: `Construction year ${String(input.constructionYear)} — chloride and carbonation risk increases with age.`
    });
  }
  const freezeThaw = input.climate.freezeThawDays ?? 0;
  if (freezeThaw >= 40) {
    const extra = freezeThaw >= 60 ? 2 : 1;
    points += extra;
    reasons.push({
      code: "FREEZE_THAW",
      label: `${String(freezeThaw)} freeze/thaw days`,
      detail: "Days with Tmin ≤ 0 °C and Tmax > 0 °C in the observation year."
    });
  }
  const wetDry = input.climate.wetDryCycles ?? 0;
  if (wetDry >= 80) {
    points += 1;
    reasons.push({
      code: "WET_DRY",
      label: `${String(wetDry)} wet/dry cycles`,
      detail: "Precipitation ≥ 1 mm followed by a dry day — wetting and drying drives chloride transport."
    });
  }
  const deicing = input.climate.deicingDays ?? 0;
  if (deicing >= 20 && (input.dailyTraffic ?? 0) >= 30_000) {
    points += 1;
    reasons.push({
      code: "DEICING_SALT_PROXY",
      label: `${String(deicing)} de-icing days at high traffic`,
      detail: `Winter days with precipitation near 0 °C, combined with ${(input.dailyTraffic ?? 0).toLocaleString("en-US")} vehicles/day. This is a salt-exposure proxy, not a measured chloride profile.`
    });
  }
  const cracks = findings.filter((finding) => matchesAny(finding, ["riss"]));
  if (cracks.length > 0) {
    const extra = maxDurability(cracks) >= 2 ? 2 : 1;
    points += extra;
    reasons.push({
      code: "OPEN_CRACK",
      label: "Open cracking on concrete",
      detail: describeFindings(cracks, "Crack findings give chlorides and moisture a path to the reinforcement.")
    });
  }
  const exposed = findings.filter((finding) =>
    matchesAny(finding, ["freilieg", "abplatz", "bewehrung", "exposed"])
  );
  if (exposed.length > 0) {
    points += 2;
    reasons.push({
      code: "EXPOSED_REBAR",
      label: "Exposed or spalled reinforcement",
      detail: describeFindings(exposed, "Cover is already lost at these locations.")
    });
  }
  const cover = findings.filter((finding) =>
    matchesAny(finding, ["deckung", "c <", "c<"])
  );
  if (cover.length > 0) {
    points += 1;
    reasons.push({
      code: "INSUFFICIENT_COVER",
      label: "Insufficient concrete cover noted",
      detail: describeFindings(cover, "Inspection notes record cover below 10 mm.")
    });
  }

  return buildAssessment({
    kind: "RC_CORROSION",
    points,
    confidence: findings.length > 0 ? "HIGH" : "MEDIUM",
    summary: rcSummary(points, age, freezeThaw),
    reasons,
    findings: [...cracks, ...exposed, ...cover]
  });
}

function assessSteelCorrosion(
  input: DamageMechanismInput,
  findings: readonly MechanismFindingInput[]
): DamageMechanismAssessment {
  const reasons: MechanismReason[] = [];
  let points = 0;
  const humidity = Number(input.climate.meanRelativeHumidityPercent);
  if (Number.isFinite(humidity) && humidity >= 78) {
    points += 1;
    reasons.push({
      code: "RELATIVE_HUMIDITY",
      label: `Mean RH ${humidity.toFixed(1)}%`,
      detail: "Annual mean relative humidity at or above 78% — ISO 9223-style wetness conditions."
    });
  }
  const precipHours = input.climate.precipitationHours ?? 0;
  if (precipHours >= 1_400) {
    points += 1;
    reasons.push({
      code: "TIME_OF_WETNESS",
      label: `${String(precipHours)} precipitation hours`,
      detail: "Hours with recorded precipitation in the observation year, used as a time-of-wetness proxy."
    });
  }
  const coating = findings.filter((finding) =>
    matchesAny(finding, [
      "korrosion",
      "beschichtung",
      "angerostet",
      "rost",
      "duplex",
      "verwitter"
    ])
  );
  if (coating.length > 0) {
    const extra = maxDurability(coating) >= 2 ? 2 : 1;
    points += extra;
    reasons.push({
      code: "COATING_DEFECT",
      label: "Coating or corrosion defect",
      detail: describeFindings(coating, "Existing coating failure accelerates further rusting.")
    });
  }
  const steelComponents = input.components.filter(
    (component) =>
      matchesText(component.material, ["stahl"]) ||
      matchesText(component.type, ["schutz", "gelander", "geländer"])
  );
  const coatingYear = oldestYear(
    steelComponents.map((component) => component.installYear ?? component.constructionYear)
  );
  const coatingAge = yearsSince(coatingYear, input.asOfYear);
  if (coatingAge !== null && coatingAge >= 20) {
    points += 1;
    reasons.push({
      code: "COATING_AGE",
      label: `Coating / steel install age ${String(coatingAge)} years`,
      detail: `Oldest recorded steel or coating year is ${String(coatingYear)}.`
    });
  }
  if (steelComponents.length === 0 && coating.length === 0) {
    reasons.push({
      code: "LIMITED_STEEL_INVENTORY",
      label: "Limited steel inventory",
      detail: "No coated steel component or corrosion finding is recorded, so this band stays conservative."
    });
  }

  return buildAssessment({
    kind: "STEEL_CORROSION",
    points,
    confidence: coating.length > 0 ? "HIGH" : steelComponents.length > 0 ? "MEDIUM" : "LOW",
    summary: steelSummary(points, humidity, coating.length),
    reasons,
    findings: coating
  });
}

function assessWaterIngress(
  input: DamageMechanismInput,
  findings: readonly MechanismFindingInput[]
): DamageMechanismAssessment {
  const reasons: MechanismReason[] = [];
  let points = 0;
  const heavyRain = input.climate.heavyRainDays20 ?? 0;
  if (heavyRain >= 8) {
    const extra = heavyRain >= 12 ? 2 : 1;
    points += extra;
    reasons.push({
      code: "HEAVY_RAIN",
      label: `${String(heavyRain)} days with ≥ 20 mm rain`,
      detail: "Heavy rainfall days in the observation year, used as a water-ingress load."
    });
  }
  const drainage = findings.filter((finding) =>
    matchesAny(finding, [
      "entwasser",
      "entwässer",
      "ablauf",
      "blasen",
      "verstopf",
      "wasserstau",
      "durchfeucht"
    ])
  );
  if (drainage.length > 0) {
    points += maxDurability(drainage) >= 2 ? 2 : 1;
    reasons.push({
      code: "DRAINAGE_DEFECT",
      label: "Drainage or waterproofing defect",
      detail: describeFindings(drainage, "Standing water or failed outlets keep the deck wet after rain.")
    });
  }
  const joints = findings.filter((finding) =>
    matchesAny(finding, ["fuge", "kappenfuge", "fahrbahnanschluss"])
  );
  if (joints.length > 0) {
    points += maxDurability(joints) >= 2 ? 2 : 1;
    reasons.push({
      code: "OPEN_JOINT",
      label: "Open joint or pavement connection",
      detail: describeFindings(joints, "Open joints let water reach the waterproofing and caps.")
    });
  }
  const vegetation = findings.filter((finding) =>
    matchesAny(finding, ["bewuchs", "vegetation"])
  );
  if (vegetation.length > 0) {
    points += 1;
    reasons.push({
      code: "VEGETATION",
      label: "Vegetation or debris at the structure",
      detail: describeFindings(vegetation, "Plant growth holds moisture and can block drainage.")
    });
  }

  return buildAssessment({
    kind: "WATER_INGRESS",
    points,
    confidence: drainage.length + joints.length > 0 ? "HIGH" : "MEDIUM",
    summary: waterSummary(points, heavyRain, drainage.length + joints.length),
    reasons,
    findings: [...drainage, ...joints, ...vegetation]
  });
}

function assessScour(
  input: DamageMechanismInput,
  findings: readonly MechanismFindingInput[]
): DamageMechanismAssessment {
  const reasons: MechanismReason[] = [];
  let points = 0;
  const watercourse = detectWatercourse(input.crossedFeature);
  if (watercourse) {
    points += 1;
    reasons.push({
      code: "WATERCOURSE",
      label: `Crosses ${watercourse}`,
      detail: `Bauwerksbuch crossed feature: “${input.crossedFeature ?? ""}”.`
    });
  }
  const hydrology = input.hydrology;
  if (hydrology === null) {
    const heavyRain = input.climate.heavyRainDays20 ?? 0;
    if (heavyRain >= 8) {
      points += 1;
      reasons.push({
        code: "HEAVY_RAIN",
        label: `${String(heavyRain)} heavy-rain days`,
        detail: "Used as a flood-load proxy because no local stream gauge is attached."
      });
    }
  } else {
    for (const reason of hydrology.reasons) {
      if (
        reason.code === "NEAREST_GAUGE" ||
        reason.code === "TRIGGER_EXCEEDED" ||
        reason.code === "UNMATCHED_FLOOD_EVENT" ||
        reason.code === "SCOUR_HISTORY"
      ) {
        reasons.push(reason);
      }
    }
    if (hydrology.triggerExceeded || hydrology.unmatchedPostFloodInspection) {
      points += 2;
    }
  }
  const foundation = input.components.find((component) =>
    isFoundationComponent(component.type)
  );
  if (foundation && hydrology === null) {
    reasons.push({
      code: "FOUNDATION_TYPE",
      label: foundation.type ?? "Foundation recorded",
      detail: "Foundation type is known from the structure book; it is not itself a scour finding."
    });
  }
  const scourFindings = findings.filter((finding) => isScourFinding(finding));
  if (scourFindings.length === 0 && hydrology === null) {
    reasons.push({
      code: "NO_SCOUR_FINDING",
      label: "No historical scour finding",
      detail: "Section 7.4 does not record Kolk. This assessment stays a watch, not a calibrated scour model."
    });
  } else if (scourFindings.length > 0) {
    points += 2;
  }
  if (hydrology === null) {
    reasons.push({
      code: "NO_LOCAL_GAUGE",
      label: "No on-site water-level gauge",
      detail: "PEGELONLINE covers federal waterways, not these valley streams. Rainfall is the honest driver."
    });
  }

  const band: DamageMechanismBand =
    scourFindings.length > 0 || (hydrology?.unmatchedPostFloodInspection ?? false)
      ? "HIGH"
      : points >= 2
        ? "MEDIUM"
        : "LOW";
  const confidence: DamageMechanismConfidence =
    scourFindings.length > 0 ? "MEDIUM" : hydrology === null ? "LOW" : "MEDIUM";

  return {
    kind: "SCOUR",
    band,
    confidence,
    summary:
      hydrology?.summary ??
      scourSummary(band, watercourse),
    reasons,
    linkedFindings: uniqueFindings(scourFindings)
  };
}

function buildAssessment(input: {
  readonly kind: DamageMechanismKind;
  readonly points: number;
  readonly confidence: DamageMechanismConfidence;
  readonly summary: string;
  readonly reasons: readonly MechanismReason[];
  readonly findings: readonly MechanismFindingInput[];
}): DamageMechanismAssessment {
  const band: DamageMechanismBand =
    input.points >= 4 ? "HIGH" : input.points >= 2 ? "MEDIUM" : "LOW";
  return {
    kind: input.kind,
    band,
    confidence: input.confidence,
    summary: input.summary,
    reasons: [...input.reasons],
    linkedFindings: uniqueFindings(input.findings)
  };
}

function rcSummary(points: number, age: number | null, freezeThaw: number): string {
  if (points >= 4) {
    return `Corrosion progression risk is high: age${age === null ? "" : ` ${String(age)} years`}, ${String(freezeThaw)} freeze/thaw days, and open concrete damage.`;
  }
  if (points >= 2) {
    return "Corrosion progression risk is elevated from climate exposure and recorded concrete defects.";
  }
  return "Corrosion progression risk is currently low on the recorded evidence.";
}

function steelSummary(points: number, humidity: number, coatingCount: number): string {
  if (points >= 4) {
    return `Steel corrosion risk is high: humid climate${Number.isFinite(humidity) ? ` (RH ${humidity.toFixed(1)}%)` : ""} and existing coating defects.`;
  }
  if (points >= 2 || coatingCount > 0) {
    return "Steel corrosion risk is elevated from wetness and recorded coating condition.";
  }
  return "Steel corrosion risk is currently low on the recorded evidence.";
}

function waterSummary(points: number, heavyRain: number, defectCount: number): string {
  if (points >= 4) {
    return "Water-ingress watch is high: drainage or joint defects sit under a wet climate.";
  }
  if (points >= 2 || defectCount > 0) {
    return `Water-ingress watch is elevated (${String(heavyRain)} heavy-rain days, open drainage or joint defects).`;
  }
  return "Water-ingress watch is currently low on the recorded evidence.";
}

function scourSummary(band: DamageMechanismBand, watercourse: string | null): string {
  if (band === "HIGH") {
    return "Scour vulnerability is high because a scour finding is already recorded.";
  }
  if (watercourse) {
    return `Scour watch for ${watercourse}: foundation and rainfall are known, but there is no Kolk finding and no local gauge.`;
  }
  return "Scour watch is low — no named watercourse or scour finding is recorded.";
}

function matchesAny(finding: MechanismFindingInput, needles: readonly string[]): boolean {
  return needles.some(
    (needle) =>
      matchesText(finding.defectType, [needle]) ||
      matchesText(finding.description, [needle])
  );
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

function maxDurability(findings: readonly MechanismFindingInput[]): number {
  return findings.reduce((highest, finding) => {
    const rating = finding.durabilityRating ?? 0;
    return rating > highest ? rating : highest;
  }, 0);
}

function describeFindings(
  findings: readonly MechanismFindingInput[],
  consequence: string
): string {
  const labels = uniqueFindings(findings)
    .map((finding) => finding.sourceIdentifier ?? finding.defectType)
    .filter((label): label is string => label !== null)
    .slice(0, 3);
  const prefix = labels.length === 0 ? "Inspection findings" : labels.join(", ");
  return `${prefix}. ${consequence}`;
}

function uniqueFindings(
  findings: readonly MechanismFindingInput[]
): DamageMechanismAssessment["linkedFindings"] {
  const seen = new Set<string>();
  const linked: DamageMechanismAssessment["linkedFindings"] = [];
  for (const finding of findings) {
    if (seen.has(finding.id)) {
      continue;
    }
    seen.add(finding.id);
    linked.push({
      id: finding.id,
      defectType: finding.defectType,
      sourceIdentifier: finding.sourceIdentifier
    });
  }
  return linked;
}

function yearsSince(year: number | null, asOfYear: number): number | null {
  if (year === null) {
    return null;
  }
  return Math.max(0, asOfYear - year);
}

function oldestYear(years: readonly (number | null)[]): number | null {
  const known = years.filter((year): year is number => year !== null);
  return known.length === 0 ? null : Math.min(...known);
}
