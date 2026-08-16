import { createHash } from "node:crypto";

import type { ExtractedEvidence } from "@bridge-os/contracts";

import { ExtractionPipelineError } from "./extraction-error.js";
import type {
  FieldEvidence,
  NormalizedExtractionBundle
} from "./normalized-extraction.js";

export const extractionEntityKinds = [
  "BRIDGE",
  "PARTIAL_STRUCTURE",
  "COMPONENT",
  "INSPECTION",
  "FINDING",
  "RECOMMENDATION",
  "HISTORICAL_WORK",
  "TRAFFIC_OBSERVATION"
] as const;

export type ExtractionEntityKind = (typeof extractionEntityKinds)[number];

export interface ExtractionIdentityRecord {
  readonly entityKind: ExtractionEntityKind;
  readonly identityKey: string;
  readonly sourceKey: string;
}

export interface ExtractionIdentityPlan {
  readonly bridge: ExtractionIdentityRecord;
  readonly components: ReadonlyMap<string, ExtractionIdentityRecord>;
  readonly findings: ReadonlyMap<string, ExtractionIdentityRecord>;
  readonly historicalWorks: ReadonlyMap<string, ExtractionIdentityRecord>;
  readonly inspections: ReadonlyMap<string, ExtractionIdentityRecord>;
  readonly partialStructures: ReadonlyMap<string, ExtractionIdentityRecord>;
  readonly recommendations: ReadonlyMap<string, ExtractionIdentityRecord>;
  readonly trafficObservations: ReadonlyMap<string, ExtractionIdentityRecord>;
}

export function buildExtractionIdentityPlan(
  bundle: NormalizedExtractionBundle
): ExtractionIdentityPlan {
  const externalStructureNumber =
    bundle.bridge.values.externalStructureNumber ??
    evidenceIdentity(bundle.bridge.evidence, bundle.bridge.fieldEvidence);
  const bridge = identity(
    "BRIDGE",
    "$bridge",
    `bridge:${normalizePart(externalStructureNumber)}`
  );
  const partialStructures = identityMap(
    bundle.partialStructures.map((partial) => {
      const externalNumber =
        partial.values.externalPartialStructureNumber ?? partial.sourceKey;
      return identity(
        "PARTIAL_STRUCTURE",
        partial.sourceKey,
        `${bridge.identityKey}:partial:${normalizePart(externalNumber)}`
      );
    })
  );
  const components = identityMap(
    bundle.components.map((component) => {
      const partial = requireIdentity(
        partialStructures,
        component.partialStructureRef,
        "partial structure"
      );
      return identity(
        "COMPONENT",
        component.sourceKey,
        stableKey(
          `${partial.identityKey}:component`,
          normalizePart(component.sourceKey) ||
            evidenceIdentity(component.evidence, component.fieldEvidence)
        )
      );
    })
  );
  const inspections = identityMap(
    bundle.inspections.map((inspection) => {
      const partial = requireIdentity(
        partialStructures,
        inspection.partialStructureRef,
        "partial structure"
      );
      const inspectedOn = inspection.values.inspectedOn ?? inspection.sourceKey;
      const type = inspection.values.type ?? "OTHER";
      return identity(
        "INSPECTION",
        inspection.sourceKey,
        `${partial.identityKey}:inspection:${inspectedOn}:${type}`
      );
    })
  );
  const findings = identityMap(
    bundle.findings.map((finding) => {
      const inspection = requireIdentity(
        inspections,
        finding.inspectionRef,
        "inspection"
      );
      const sourceIdentifier = finding.values.sourceIdentifier;
      const sourcePart =
        sourceIdentifier === null
          ? evidenceIdentity(finding.evidence, finding.fieldEvidence)
          : `source:${normalizePart(sourceIdentifier)}`;
      return identity(
        "FINDING",
        finding.sourceKey,
        stableKey(`${inspection.identityKey}:finding`, sourcePart)
      );
    })
  );
  const recommendations = identityMap(
    bundle.recommendations.map((recommendation) => {
      const partial = requireIdentity(
        partialStructures,
        recommendation.partialStructureRef,
        "partial structure"
      );
      const linkedFindings = recommendation.linkedFindingRefs
        .map(
          (findingRef) =>
            requireIdentity(findings, findingRef, "finding").identityKey
        )
        .sort();
      return identity(
        "RECOMMENDATION",
        recommendation.sourceKey,
        stableKey(`${partial.identityKey}:recommendation`, {
          linkedFindings,
          sourceDescriptor: normalizePart(recommendation.sourceKey)
        })
      );
    })
  );
  const historicalWorks = identityMap(
    bundle.historicalWorks.map((work) => {
      const scope =
        work.partialStructureRef === null
          ? bridge.identityKey
          : requireIdentity(
              partialStructures,
              work.partialStructureRef,
              "partial structure"
            ).identityKey;
      return identity(
        "HISTORICAL_WORK",
        work.sourceKey,
        stableKey(
          `${scope}:historical-work`,
          normalizePart(work.sourceKey) ||
            evidenceIdentity(work.evidence, work.fieldEvidence)
        )
      );
    })
  );
  const trafficObservations = identityMap(
    bundle.trafficObservations.map((observation) =>
      identity(
        "TRAFFIC_OBSERVATION",
        observation.sourceKey,
        `${bridge.identityKey}:traffic:${String(
          observation.values.observationYear
        )}:${observation.values.observedOn ?? "year"}`
      )
    )
  );

  return {
    bridge,
    components,
    findings,
    historicalWorks,
    inspections,
    partialStructures,
    recommendations,
    trafficObservations
  };
}

export function allExtractionIdentities(
  plan: ExtractionIdentityPlan
): readonly ExtractionIdentityRecord[] {
  return [
    plan.bridge,
    ...plan.partialStructures.values(),
    ...plan.components.values(),
    ...plan.inspections.values(),
    ...plan.findings.values(),
    ...plan.recommendations.values(),
    ...plan.historicalWorks.values(),
    ...plan.trafficObservations.values()
  ];
}

function identity(
  entityKind: ExtractionEntityKind,
  sourceKey: string,
  identityKey: string
): ExtractionIdentityRecord {
  return { entityKind, identityKey, sourceKey };
}

function identityMap(
  records: readonly ExtractionIdentityRecord[]
): ReadonlyMap<string, ExtractionIdentityRecord> {
  const bySourceKey = new Map<string, ExtractionIdentityRecord>();
  const seenIdentities = new Set<string>();
  for (const record of records) {
    if (bySourceKey.has(record.sourceKey)) {
      continue;
    }
    let next = record;
    let identityKey = `${record.entityKind}:${record.identityKey}`;
    if (seenIdentities.has(identityKey)) {
      next = {
        ...record,
        identityKey: `${record.identityKey}:${normalizePart(record.sourceKey)}`
      };
      identityKey = `${next.entityKind}:${next.identityKey}`;
    }
    bySourceKey.set(next.sourceKey, next);
    seenIdentities.add(identityKey);
  }
  return bySourceKey;
}

function requireIdentity(
  identities: ReadonlyMap<string, ExtractionIdentityRecord>,
  sourceKey: string,
  label: string
): ExtractionIdentityRecord {
  const result = identities.get(sourceKey);
  if (result === undefined) {
    failIdentity(`Unknown ${label} source reference ${sourceKey}.`);
  }
  return result;
}

function evidenceIdentity(
  evidence: readonly ExtractedEvidence[],
  fieldEvidence: FieldEvidence
): string {
  const citations = [...evidence, ...Object.values(fieldEvidence).flat()]
    .map((citation) => ({
      pageNumber: citation.pageNumber,
      sourceExcerpt: normalizePart(citation.sourceExcerpt)
    }))
    .sort((left, right) =>
      left.pageNumber === right.pageNumber
        ? left.sourceExcerpt.localeCompare(right.sourceExcerpt)
        : left.pageNumber - right.pageNumber
    );
  if (citations.length === 0) {
    return "unidentified";
  }
  return stableKey("evidence", citations);
}

function stableKey(prefix: string, value: unknown): string {
  const digest = createHash("sha256")
    .update(canonicalJson(value))
    .digest("hex")
    .slice(0, 32);
  return `${prefix}:${digest}`;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizePart(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

function failIdentity(message: string): never {
  throw new ExtractionPipelineError({
    code: "EXTRACTION_IDENTITY_INVALID",
    message,
    stage: "validation"
  });
}
