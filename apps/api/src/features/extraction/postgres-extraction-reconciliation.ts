import { createHash } from "node:crypto";

import {
  bridges,
  components,
  documents,
  extractionEntityBindings,
  findings,
  historicalWorks,
  inspections,
  partialStructures,
  plannedInterventions,
  recommendationFindings,
  recommendations,
  sourceEvidence,
  trafficObservations,
  type BridgeDatabase
} from "@bridge-os/db";
import { and, eq, inArray, ne } from "drizzle-orm";

import { ExtractionPipelineError } from "./extraction-error.js";
import type {
  ExtractionEntityKind,
  ExtractionIdentityRecord
} from "./source-identities.js";

export type BridgeTransaction = Parameters<
  Parameters<BridgeDatabase["transaction"]>[0]
>[0];

export interface ExistingBinding {
  readonly entityId: string;
  readonly entityKind: ExtractionEntityKind;
  readonly lastAppliedFingerprint: string;
  readonly sourceIdentityKey: string;
}

export interface DesiredEntity {
  readonly entityId: string;
  readonly entityKind: ExtractionEntityKind;
  readonly fingerprint: string;
  readonly sourceIdentityKey: string;
}

export function desiredEntity(
  identity: ExtractionIdentityRecord,
  entityId: string,
  values: unknown
): DesiredEntity {
  return {
    entityId,
    entityKind: identity.entityKind,
    fingerprint: fingerprint(values),
    sourceIdentityKey: identity.identityKey
  };
}

export function bindingKey(
  binding:
    | Pick<ExistingBinding, "entityKind" | "sourceIdentityKey">
    | DesiredEntity
    | ExtractionIdentityRecord
): string {
  const sourceIdentityKey =
    "identityKey" in binding ? binding.identityKey : binding.sourceIdentityKey;
  return `${binding.entityKind}:${sourceIdentityKey}`;
}

export function staleBindings(
  existingBindings: readonly ExistingBinding[],
  desiredEntities: readonly DesiredEntity[]
): ExistingBinding[] {
  const desiredKeys = new Set(desiredEntities.map(bindingKey));
  return existingBindings.filter(
    (binding) => !desiredKeys.has(bindingKey(binding))
  );
}

export function assertNoStaleBindings(
  existingBindings: readonly ExistingBinding[],
  desiredEntities: readonly DesiredEntity[]
): void {
  const stale = staleBindings(existingBindings, desiredEntities);
  if (stale.length > 0) {
    failReconciliation(
      `Re-extraction omitted ${String(stale.length)} previously extracted record(s); existing data was preserved.`,
      "STALE_EXTRACTED_ENTITY"
    );
  }
}

export async function replaceStaleExtractedEntities(
  transaction: BridgeTransaction,
  documentId: string,
  stale: readonly ExistingBinding[]
): Promise<void> {
  if (stale.length === 0) {
    return;
  }
  if (stale.some((binding) => binding.entityKind === "BRIDGE")) {
    failReconciliation(
      "Existing extraction lineage has no matching bridge identity.",
      "STALE_EXTRACTED_ENTITY"
    );
  }
  await assertStaleEntitiesAreUnused(transaction, documentId, stale);

  const ids = (kind: ExtractionEntityKind): string[] =>
    stale
      .filter((binding) => binding.entityKind === kind)
      .map((binding) => binding.entityId);
  const partialIds = ids("PARTIAL_STRUCTURE");
  if (partialIds.length > 0) {
    await transaction
      .update(documents)
      .set({ partialStructureId: null, updatedAt: new Date() })
      .where(
        and(
          eq(documents.id, documentId),
          inArray(documents.partialStructureId, partialIds)
        )
      );
  }

  await transaction
    .delete(extractionEntityBindings)
    .where(
      and(
        eq(extractionEntityBindings.documentId, documentId),
        inArray(
          extractionEntityBindings.entityId,
          stale.map((binding) => binding.entityId)
        )
      )
    );

  const recommendationIds = ids("RECOMMENDATION");
  if (recommendationIds.length > 0) {
    await transaction
      .delete(recommendations)
      .where(inArray(recommendations.id, recommendationIds));
  }
  const findingIds = ids("FINDING");
  if (findingIds.length > 0) {
    await transaction.delete(findings).where(inArray(findings.id, findingIds));
  }
  const historicalWorkIds = ids("HISTORICAL_WORK");
  if (historicalWorkIds.length > 0) {
    await transaction
      .delete(historicalWorks)
      .where(inArray(historicalWorks.id, historicalWorkIds));
  }
  const trafficIds = ids("TRAFFIC_OBSERVATION");
  if (trafficIds.length > 0) {
    await transaction
      .delete(trafficObservations)
      .where(inArray(trafficObservations.id, trafficIds));
  }
  const componentIds = ids("COMPONENT");
  if (componentIds.length > 0) {
    await transaction.delete(components).where(inArray(components.id, componentIds));
  }
  const inspectionIds = ids("INSPECTION");
  if (inspectionIds.length > 0) {
    await transaction
      .delete(inspections)
      .where(inArray(inspections.id, inspectionIds));
  }
  if (partialIds.length > 0) {
    await transaction
      .delete(partialStructures)
      .where(inArray(partialStructures.id, partialIds));
  }
}

export async function assertDocumentIsNotReviewed(
  transaction: BridgeTransaction,
  documentId: string
): Promise<void> {
  const reviewed = await transaction
    .select({ id: sourceEvidence.id })
    .from(sourceEvidence)
    .where(
      and(
        eq(sourceEvidence.documentId, documentId),
        ne(sourceEvidence.reviewState, "AUTOMATICALLY_EXTRACTED")
      )
    )
    .limit(1);
  if (reviewed.length > 0) {
    failReconciliation(
      "This document has human-reviewed evidence; automatic re-extraction cannot overwrite it.",
      "EXTRACTION_PROTECTED_ENTITY_CONFLICT"
    );
  }
}

export async function assertEntitiesUnchangedSinceExtraction(
  transaction: BridgeTransaction,
  bindings: readonly ExistingBinding[]
): Promise<void> {
  const fingerprints = new Map<string, string>();
  const ids = (kind: ExtractionEntityKind): string[] =>
    bindings
      .filter((binding) => binding.entityKind === kind)
      .map((binding) => binding.entityId);
  const register = (
    entityKind: Exclude<ExtractionEntityKind, "RECOMMENDATION">,
    rows: readonly (Readonly<Record<string, unknown>> & { readonly id: string })[]
  ): void => {
    for (const row of rows) {
      fingerprints.set(
        entityKey(entityKind, row.id),
        fingerprint(databasePayload(row))
      );
    }
  };

  const bridgeIds = ids("BRIDGE");
  if (bridgeIds.length > 0) {
    register(
      "BRIDGE",
      await transaction.select().from(bridges).where(inArray(bridges.id, bridgeIds))
    );
  }
  const partialIds = ids("PARTIAL_STRUCTURE");
  if (partialIds.length > 0) {
    register(
      "PARTIAL_STRUCTURE",
      await transaction
        .select()
        .from(partialStructures)
        .where(inArray(partialStructures.id, partialIds))
    );
  }
  const componentIds = ids("COMPONENT");
  if (componentIds.length > 0) {
    register(
      "COMPONENT",
      await transaction
        .select()
        .from(components)
        .where(inArray(components.id, componentIds))
    );
  }
  const inspectionIds = ids("INSPECTION");
  if (inspectionIds.length > 0) {
    register(
      "INSPECTION",
      await transaction
        .select()
        .from(inspections)
        .where(inArray(inspections.id, inspectionIds))
    );
  }
  const findingIds = ids("FINDING");
  if (findingIds.length > 0) {
    register(
      "FINDING",
      await transaction
        .select()
        .from(findings)
        .where(inArray(findings.id, findingIds))
    );
  }
  const historicalWorkIds = ids("HISTORICAL_WORK");
  if (historicalWorkIds.length > 0) {
    register(
      "HISTORICAL_WORK",
      await transaction
        .select()
        .from(historicalWorks)
        .where(inArray(historicalWorks.id, historicalWorkIds))
    );
  }
  const trafficIds = ids("TRAFFIC_OBSERVATION");
  if (trafficIds.length > 0) {
    register(
      "TRAFFIC_OBSERVATION",
      await transaction
        .select()
        .from(trafficObservations)
        .where(inArray(trafficObservations.id, trafficIds))
    );
  }

  const recommendationIds = ids("RECOMMENDATION");
  if (recommendationIds.length > 0) {
    const rows = await transaction
      .select()
      .from(recommendations)
      .where(inArray(recommendations.id, recommendationIds));
    const links = await transaction
      .select({
        findingId: recommendationFindings.findingId,
        recommendationId: recommendationFindings.recommendationId
      })
      .from(recommendationFindings)
      .where(inArray(recommendationFindings.recommendationId, recommendationIds));
    const linksByRecommendation = new Map<string, string[]>();
    for (const link of links) {
      const linked = linksByRecommendation.get(link.recommendationId) ?? [];
      linked.push(link.findingId);
      linksByRecommendation.set(link.recommendationId, linked);
    }
    for (const row of rows) {
      fingerprints.set(
        entityKey("RECOMMENDATION", row.id),
        fingerprint({
          ...databasePayload(row),
          linkedFindingIds: (linksByRecommendation.get(row.id) ?? []).sort()
        })
      );
    }
  }

  for (const binding of bindings) {
    const current = fingerprints.get(
      entityKey(binding.entityKind, binding.entityId)
    );
    if (current === undefined) {
      failReconciliation(
        `Previously extracted ${binding.entityKind.toLowerCase()} record is missing; existing data was preserved.`,
        "STALE_EXTRACTED_ENTITY"
      );
    }
    if (current !== binding.lastAppliedFingerprint) {
      failReconciliation(
        `Previously extracted ${binding.entityKind.toLowerCase()} record changed after extraction; automatic overwrite was blocked.`,
        "EXTRACTION_PROTECTED_ENTITY_CONFLICT"
      );
    }
  }
}

export async function reconcileRows<TRow extends {
  readonly id: string;
  readonly sourceKey: string;
  readonly values: unknown;
}>(
  rows: readonly TRow[],
  identities: ReadonlyMap<string, ExtractionIdentityRecord>,
  bindings: ReadonlyMap<string, ExistingBinding>,
  changedKeys: ReadonlySet<string>,
  insertRow: (row: TRow) => Promise<unknown>,
  updateRow: (row: TRow) => Promise<unknown>
): Promise<void> {
  for (const row of rows) {
    const identity = requireIdentity(identities, row.sourceKey);
    const key = bindingKey(identity);
    if (!changedKeys.has(key)) {
      continue;
    }
    if (bindings.has(key)) {
      await updateRow(row);
    } else {
      await insertRow(row);
    }
  }
}

export function failReconciliation(message: string, code: string): never {
  throw new ExtractionPipelineError({ code, message, stage: "reconciliation" });
}

async function assertStaleEntitiesAreUnused(
  transaction: BridgeTransaction,
  documentId: string,
  stale: readonly ExistingBinding[]
): Promise<void> {
  const recommendationIds = stale
    .filter((binding) => binding.entityKind === "RECOMMENDATION")
    .map((binding) => binding.entityId);
  if (recommendationIds.length > 0) {
    const planned = await transaction
      .select({ id: plannedInterventions.id })
      .from(plannedInterventions)
      .where(inArray(plannedInterventions.recommendationId, recommendationIds))
      .limit(1);
    if (planned.length > 0) {
      failReconciliation(
        "Previously extracted recommendation is used by planning data; existing data was preserved.",
        "EXTRACTION_PROTECTED_ENTITY_CONFLICT"
      );
    }
  }

  const partialIds = stale
    .filter((binding) => binding.entityKind === "PARTIAL_STRUCTURE")
    .map((binding) => binding.entityId);
  if (partialIds.length > 0) {
    const otherDocuments = await transaction
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          inArray(documents.partialStructureId, partialIds),
          ne(documents.id, documentId)
        )
      )
      .limit(1);
    if (otherDocuments.length > 0) {
      failReconciliation(
        "Previously extracted partial structure is referenced by another document; existing data was preserved.",
        "EXTRACTION_PROTECTED_ENTITY_CONFLICT"
      );
    }
  }
}


function requireIdentity(
  identities: ReadonlyMap<string, ExtractionIdentityRecord>,
  sourceKey: string
): ExtractionIdentityRecord {
  const identity = identities.get(sourceKey);
  if (identity === undefined) {
    throw new Error(`Unresolved extraction identity: ${sourceKey}`);
  }
  return identity;
}

function entityKey(entityKind: ExtractionEntityKind, entityId: string): string {
  return `${entityKind}:${entityId}`;
}

function databasePayload(
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => key !== "id" && key !== "createdAt" && key !== "updatedAt"
    )
  );
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function extractionFingerprint(value: unknown): string {
  return fingerprint(value);
}

function canonicalJson(value: unknown): string {
  if (value === undefined) {
    return '"__undefined__"';
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString().slice(0, 10));
  }
  if (typeof value === "string") {
    return JSON.stringify(canonicalizeDecimalString(value));
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function canonicalizeDecimalString(value: string): string {
  if (!/^-?(?:0|[1-9]\d*)\.\d+$/.test(value)) {
    return value;
  }
  const [whole, fraction] = value.split(".");
  if (whole === undefined || fraction === undefined) {
    return value;
  }
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed.length === 0 ? whole : `${whole}.${trimmed}`;
}
