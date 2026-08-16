import { randomUUID } from "node:crypto";

import {
  createBridgeSchema,
  createComponentSchema,
  createFindingSchema,
  createHistoricalWorkSchema,
  createInspectionSchema,
  createPartialStructureSchema,
  createRecommendationSchema,
  createTrafficObservationSchema
} from "@bridge-os/contracts";
import {
  bridgeEvidence,
  bridges,
  componentEvidence,
  components,
  documentExtractionRuns,
  documents,
  extractionEntityBindings,
  findingEvidence,
  findings,
  historicalWorkEvidence,
  historicalWorks,
  inspectionEvidence,
  inspections,
  partialStructureEvidence,
  partialStructures,
  recommendationEvidence,
  recommendationFindings,
  recommendations,
  sourceEvidence,
  trafficObservationEvidence,
  trafficObservations,
  type ExtractionResultSummaryValue
} from "@bridge-os/db";
import { and, eq, inArray, sql } from "drizzle-orm";

import { EvidenceCollector } from "./extraction-evidence-collector.js";
import type {
  ExtractionDocumentContext,
  ExtractionPersistenceResult
} from "./extraction-store.js";
import type { NormalizedExtractionBundle } from "./normalized-extraction.js";
import {
  assertDocumentIsNotReviewed,
  assertEntitiesUnchangedSinceExtraction,
  bindingKey,
  desiredEntity,
  failReconciliation,
  reconcileRows,
  replaceStaleExtractedEntities,
  staleBindings,
  type BridgeTransaction,
  type DesiredEntity,
  type ExistingBinding
} from "./postgres-extraction-reconciliation.js";
import {
  buildExtractionIdentityPlan,
  type ExtractionIdentityRecord
} from "./source-identities.js";

export async function persistNormalizedExtraction(
  transaction: BridgeTransaction,
  runId: string,
  context: ExtractionDocumentContext,
  bundle: NormalizedExtractionBundle
): Promise<ExtractionPersistenceResult> {
  const lockedRun = await transaction.execute<{ id: string }>(sql`
    select ${documentExtractionRuns.id} as id
    from ${documentExtractionRuns}
    where ${documentExtractionRuns.id} = ${runId}
      and ${documentExtractionRuns.documentId} = ${context.documentId}
      and ${documentExtractionRuns.status} = 'PERSISTING'
    for update
  `);
  if (lockedRun.rows.length !== 1) {
    throw new Error("Extraction run is not in the persisting state.");
  }
  const [document] = await transaction
    .select({ bridgeId: documents.bridgeId, metadata: documents.metadata })
    .from(documents)
    .where(eq(documents.id, context.documentId))
    .limit(1);
  if (document === undefined) {
    throw new Error("Extraction document no longer exists.");
  }
  const identityPlan = buildExtractionIdentityPlan(bundle);
  const existingBindings = await transaction
    .select({
      entityId: extractionEntityBindings.entityId,
      entityKind: extractionEntityBindings.entityKind,
      lastAppliedFingerprint: extractionEntityBindings.lastAppliedFingerprint,
      sourceIdentityKey: extractionEntityBindings.sourceIdentityKey
    })
    .from(extractionEntityBindings)
    .where(eq(extractionEntityBindings.documentId, context.documentId));
  const bindingsByIdentity = new Map(
    existingBindings.map((binding) => [bindingKey(binding), binding])
  );
  const isReextraction = existingBindings.length > 0;
  const bridgeBinding = bindingsByIdentity.get(bindingKey(identityPlan.bridge));
  if (isReextraction && bridgeBinding === undefined) {
    failReconciliation(
      "Existing extraction lineage has no matching bridge identity.",
      "STALE_EXTRACTED_ENTITY"
    );
  }
  if (!isReextraction && document.bridgeId !== null) {
    failReconciliation(
      "The document is already assigned to a bridge without extraction lineage.",
      "EXTRACTION_PROTECTED_ENTITY_CONFLICT"
    );
  }

  const bridgeId = bridgeBinding?.entityId ?? randomUUID();
  const bridge = createBridgeSchema.parse(bundle.bridge.values);
  const externalStructureNumber = bridge.externalStructureNumber;
  if (externalStructureNumber === null) {
    failReconciliation(
      "Bridge extraction requires an external structure number.",
      "EXTRACTION_IDENTITY_INVALID"
    );
  }
  const bridgeValues = {
    externalStructureNumber,
    name: bridge.name,
    road: bridge.road,
    countryCode: bridge.location.countryCode,
    federalState: bridge.location.federalState,
    district: bridge.location.district,
    municipality: bridge.location.municipality,
    locality: bridge.location.locality,
    postalCode: bridge.location.postalCode,
    stationing: bridge.location.stationing,
    crossedFeature: bridge.location.crossedFeature,
    latitude: bridge.location.latitude,
    longitude: bridge.location.longitude,
    owner: bridge.owner,
    loadBearingResponsibility: bridge.loadBearingResponsibility,
    responsibleAuthority: bridge.responsibleAuthority,
    maintenanceOffice: bridge.maintenanceOffice,
    dataOrigin: bridge.dataOrigin
  } satisfies Omit<typeof bridges.$inferInsert, "id">;

  if (!isReextraction) {
    const conflictingBridge = await transaction
      .select({ id: bridges.id })
      .from(bridges)
      .where(eq(bridges.externalStructureNumber, externalStructureNumber))
      .limit(1);
    if (conflictingBridge.length > 0) {
      failReconciliation(
        `Bridge ${externalStructureNumber} already exists and is not owned by this document extraction.`,
        "EXTRACTION_PROTECTED_ENTITY_CONFLICT"
      );
    }
  }

  const partialIds = idMap(
    bundle.partialStructures,
    identityPlan.partialStructures,
    bindingsByIdentity
  );
  const partialRows = bundle.partialStructures.map((partial) => ({
    id: requireId(partialIds, partial.sourceKey),
    sourceKey: partial.sourceKey,
    values: createPartialStructureSchema.parse({
          bridgeId,
          ...partial.values
    })
  }));

  const componentIds = idMap(
    bundle.components,
    identityPlan.components,
    bindingsByIdentity
  );
  const componentRows = bundle.components.map((component) => ({
    id: requireId(componentIds, component.sourceKey),
    sourceKey: component.sourceKey,
    values: createComponentSchema.parse({
          bridgeId,
          partialStructureId: requireId(
            partialIds,
            component.partialStructureRef
          ),
          ...component.values
    })
  }));

  const inspectionIds = idMap(
    bundle.inspections,
    identityPlan.inspections,
    bindingsByIdentity
  );
  const inspectionRows = bundle.inspections.map((inspection) => ({
    id: requireId(inspectionIds, inspection.sourceKey),
    sourceKey: inspection.sourceKey,
    values: createInspectionSchema.parse({
          bridgeId,
          partialStructureId: requireId(
            partialIds,
            inspection.partialStructureRef
          ),
          ...inspection.values
    })
  }));

  const findingIds = idMap(
    bundle.findings,
    identityPlan.findings,
    bindingsByIdentity
  );
  const findingRows = bundle.findings.map((finding) => ({
    id: requireId(findingIds, finding.sourceKey),
    sourceKey: finding.sourceKey,
    values: createFindingSchema.parse({
          bridgeId,
          partialStructureId: requireId(
            partialIds,
            finding.partialStructureRef
          ),
          inspectionId: requireId(inspectionIds, finding.inspectionRef),
          componentId:
            finding.componentRef === null
              ? null
              : requireId(componentIds, finding.componentRef),
          ...finding.values
    })
  }));

  const recommendationIds = idMap(
    bundle.recommendations,
    identityPlan.recommendations,
    bindingsByIdentity
  );
  const recommendationRows = bundle.recommendations.map((recommendation) => ({
    id: requireId(recommendationIds, recommendation.sourceKey),
    linkedFindingIds: recommendation.linkedFindingRefs
      .map((findingRef) => requireId(findingIds, findingRef))
      .sort(),
    sourceKey: recommendation.sourceKey,
    values: createRecommendationSchema.parse({
          bridgeId,
          partialStructureId: requireId(
            partialIds,
            recommendation.partialStructureRef
          ),
          ...recommendation.values
    })
  }));
  const recommendationFindingRows = recommendationRows.flatMap((recommendation) =>
    recommendation.linkedFindingIds.map((findingId) => ({
      bridgeId,
      findingId,
      partialStructureId: recommendation.values.partialStructureId,
      recommendationId: recommendation.id
    }))
  );

  const historicalWorkIds = idMap(
    bundle.historicalWorks,
    identityPlan.historicalWorks,
    bindingsByIdentity
  );
  const historicalWorkRows = bundle.historicalWorks.map((work) => ({
    id: requireId(historicalWorkIds, work.sourceKey),
    sourceKey: work.sourceKey,
    values: createHistoricalWorkSchema.parse({
          bridgeId,
          partialStructureId:
            work.partialStructureRef === null
              ? null
              : requireId(partialIds, work.partialStructureRef),
          ...work.values
    })
  }));

  const trafficIds = idMap(
    bundle.trafficObservations,
    identityPlan.trafficObservations,
    bindingsByIdentity
  );
  const trafficRows = bundle.trafficObservations.map((observation) => ({
    id: requireId(trafficIds, observation.sourceKey),
    sourceKey: observation.sourceKey,
    values: createTrafficObservationSchema.parse({
          bridgeId,
          ...observation.values
    })
  }));

  const desiredEntities: DesiredEntity[] = [
    desiredEntity(identityPlan.bridge, bridgeId, bridgeValues),
    ...partialRows.map((row) =>
      desiredEntity(requireIdentity(identityPlan.partialStructures, row.sourceKey), row.id, row.values)
    ),
    ...componentRows.map((row) =>
      desiredEntity(requireIdentity(identityPlan.components, row.sourceKey), row.id, row.values)
    ),
    ...inspectionRows.map((row) =>
      desiredEntity(requireIdentity(identityPlan.inspections, row.sourceKey), row.id, row.values)
    ),
    ...findingRows.map((row) =>
      desiredEntity(requireIdentity(identityPlan.findings, row.sourceKey), row.id, row.values)
    ),
    ...recommendationRows.map((row) =>
      desiredEntity(
        requireIdentity(identityPlan.recommendations, row.sourceKey),
        row.id,
        { ...row.values, linkedFindingIds: row.linkedFindingIds }
      )
    ),
    ...historicalWorkRows.map((row) =>
      desiredEntity(requireIdentity(identityPlan.historicalWorks, row.sourceKey), row.id, row.values)
    ),
    ...trafficRows.map((row) =>
      desiredEntity(requireIdentity(identityPlan.trafficObservations, row.sourceKey), row.id, row.values)
    )
  ];

  if (isReextraction) {
    await assertDocumentIsNotReviewed(transaction, context.documentId);
    await assertEntitiesUnchangedSinceExtraction(
      transaction,
      existingBindings
    );
  }

  const changedEntities = desiredEntities.filter((entity) => {
    const binding = bindingsByIdentity.get(bindingKey(entity));
    return binding?.lastAppliedFingerprint !== entity.fingerprint;
  });
  const changedKeys = new Set(changedEntities.map(bindingKey));

  if (!isReextraction) {
    await transaction.insert(bridges).values({ id: bridgeId, ...bridgeValues });
  } else if (changedKeys.has(bindingKey(identityPlan.bridge))) {
    await transaction
      .update(bridges)
      .set({ ...bridgeValues, updatedAt: new Date() })
      .where(eq(bridges.id, bridgeId));
  }
  await reconcileRows(
    partialRows,
    identityPlan.partialStructures,
    bindingsByIdentity,
    changedKeys,
    async (row) => transaction.insert(partialStructures).values({ id: row.id, ...row.values }),
    async (row) => transaction.update(partialStructures).set({ ...row.values, updatedAt: new Date() }).where(eq(partialStructures.id, row.id))
  );
  await reconcileRows(
    componentRows,
    identityPlan.components,
    bindingsByIdentity,
    changedKeys,
    async (row) => transaction.insert(components).values({ id: row.id, ...row.values }),
    async (row) => transaction.update(components).set({ ...row.values, updatedAt: new Date() }).where(eq(components.id, row.id))
  );
  await reconcileRows(
    inspectionRows,
    identityPlan.inspections,
    bindingsByIdentity,
    changedKeys,
    async (row) => transaction.insert(inspections).values({ id: row.id, ...row.values }),
    async (row) => transaction.update(inspections).set({ ...row.values, updatedAt: new Date() }).where(eq(inspections.id, row.id))
  );
  await reconcileRows(
    findingRows,
    identityPlan.findings,
    bindingsByIdentity,
    changedKeys,
    async (row) => transaction.insert(findings).values({ id: row.id, ...row.values }),
    async (row) => transaction.update(findings).set({ ...row.values, updatedAt: new Date() }).where(eq(findings.id, row.id))
  );
  await reconcileRows(
    recommendationRows,
    identityPlan.recommendations,
    bindingsByIdentity,
    changedKeys,
    async (row) => transaction.insert(recommendations).values({ id: row.id, ...row.values }),
    async (row) => transaction.update(recommendations).set({ ...row.values, updatedAt: new Date() }).where(eq(recommendations.id, row.id))
  );
  await reconcileRows(
    historicalWorkRows,
    identityPlan.historicalWorks,
    bindingsByIdentity,
    changedKeys,
    async (row) => transaction.insert(historicalWorks).values({ id: row.id, ...row.values }),
    async (row) => transaction.update(historicalWorks).set({ ...row.values, updatedAt: new Date() }).where(eq(historicalWorks.id, row.id))
  );
  await reconcileRows(
    trafficRows,
    identityPlan.trafficObservations,
    bindingsByIdentity,
    changedKeys,
    async (row) => transaction.insert(trafficObservations).values({ id: row.id, ...row.values }),
    async (row) => transaction.update(trafficObservations).set({ ...row.values, updatedAt: new Date() }).where(eq(trafficObservations.id, row.id))
  );

  const changedRecommendationIds = recommendationRows
    .filter((row) =>
      changedKeys.has(bindingKey(requireIdentity(identityPlan.recommendations, row.sourceKey)))
    )
    .map((row) => row.id);
  if (changedRecommendationIds.length > 0) {
    await transaction
      .delete(recommendationFindings)
      .where(inArray(recommendationFindings.recommendationId, changedRecommendationIds));
    const changedLinks = recommendationFindingRows.filter((link) =>
      changedRecommendationIds.includes(link.recommendationId)
    );
    if (changedLinks.length > 0) {
      await transaction.insert(recommendationFindings).values(changedLinks);
    }
  }

  if (isReextraction) {
    await replaceStaleExtractedEntities(
      transaction,
      context.documentId,
      staleBindings(existingBindings, desiredEntities)
    );
  }

  const collector = new EvidenceCollector(context.documentId, runId);
  const bridgeLinks = collector.links(
    bundle.bridge.evidence,
    bundle.bridge.fieldEvidence
  );
  const partialLinks = bundle.partialStructures.flatMap((record) =>
    collector.links(record.evidence, record.fieldEvidence).map((link) => ({
      partialStructureId: requireId(partialIds, record.sourceKey),
      ...link
    }))
  );
  const componentLinks = bundle.components.flatMap((record) =>
    collector.links(record.evidence, record.fieldEvidence).map((link) => ({
      componentId: requireId(componentIds, record.sourceKey),
      ...link
    }))
  );
  const inspectionLinks = bundle.inspections.flatMap((record) =>
    collector.links(record.evidence, record.fieldEvidence).map((link) => ({
      inspectionId: requireId(inspectionIds, record.sourceKey),
      ...link
    }))
  );
  const findingLinks = bundle.findings.flatMap((record) =>
    collector.links(record.evidence, record.fieldEvidence).map((link) => ({
      findingId: requireId(findingIds, record.sourceKey),
      ...link
    }))
  );
  const recommendationLinks = bundle.recommendations.flatMap((record) =>
    collector.links(record.evidence, record.fieldEvidence).map((link) => ({
      recommendationId: requireId(recommendationIds, record.sourceKey),
      ...link
    }))
  );
  const historicalWorkLinks = bundle.historicalWorks.flatMap((record) =>
    collector.links(record.evidence, record.fieldEvidence).map((link) => ({
      historicalWorkId: requireId(historicalWorkIds, record.sourceKey),
      ...link
    }))
  );
  const trafficLinks = bundle.trafficObservations.flatMap((record) =>
    collector.links(record.evidence, record.fieldEvidence).map((link) => ({
      trafficObservationId: requireId(trafficIds, record.sourceKey),
      ...link
    }))
  );

  if (collector.evidenceRows.length > 0) {
    await transaction.insert(sourceEvidence).values(collector.evidenceRows);
  }
  if (bridgeLinks.length > 0) {
    await transaction.insert(bridgeEvidence).values(
      bridgeLinks.map((link) => ({ bridgeId, ...link }))
    );
  }
  if (partialLinks.length > 0) {
    await transaction.insert(partialStructureEvidence).values(partialLinks);
  }
  if (componentLinks.length > 0) {
    await transaction.insert(componentEvidence).values(componentLinks);
  }
  if (inspectionLinks.length > 0) {
    await transaction.insert(inspectionEvidence).values(inspectionLinks);
  }
  if (findingLinks.length > 0) {
    await transaction.insert(findingEvidence).values(findingLinks);
  }
  if (recommendationLinks.length > 0) {
    await transaction.insert(recommendationEvidence).values(recommendationLinks);
  }
  if (historicalWorkLinks.length > 0) {
    await transaction.insert(historicalWorkEvidence).values(historicalWorkLinks);
  }
  if (trafficLinks.length > 0) {
    await transaction.insert(trafficObservationEvidence).values(trafficLinks);
  }

  for (const entity of desiredEntities) {
    const binding = bindingsByIdentity.get(bindingKey(entity));
    if (binding === undefined) {
      await transaction.insert(extractionEntityBindings).values({
        documentId: context.documentId,
        entityId: entity.entityId,
        entityKind: entity.entityKind,
        lastAppliedFingerprint: entity.fingerprint,
        latestRunId: runId,
        sourceIdentityKey: entity.sourceIdentityKey
      });
    } else {
      await transaction
        .update(extractionEntityBindings)
        .set({
          lastAppliedFingerprint: entity.fingerprint,
          latestRunId: runId,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(extractionEntityBindings.documentId, context.documentId),
            eq(extractionEntityBindings.entityKind, entity.entityKind),
            eq(extractionEntityBindings.sourceIdentityKey, entity.sourceIdentityKey)
          )
        );
    }
  }

  const onlyPartialStructureId =
    bundle.partialStructures.length === 1
      ? requireId(partialIds, bundle.partialStructures[0]?.sourceKey ?? "")
      : null;
  const updatedDocuments = await transaction
    .update(documents)
    .set({
      bridgeId,
      metadata: {
        ...document.metadata,
        extractionPerformed: true,
        extractionRunId: runId,
        sourceMode: "MODEL_EXTRACTION"
      },
      partialStructureId: onlyPartialStructureId,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(documents.id, context.documentId),
        isReextraction
          ? eq(documents.bridgeId, bridgeId)
          : sql`${documents.bridgeId} is null`
      )
    )
    .returning({ id: documents.id });
  if (updatedDocuments.length !== 1) {
    throw new Error("Extraction document assignment changed during persistence.");
  }

  const summary: ExtractionResultSummaryValue = {
    bridgeAction: isReextraction
      ? changedEntities.length > 0
        ? "UPDATED"
        : "UNCHANGED"
      : "CREATED",
    componentsExtracted: componentRows.length,
    findingsExtracted: findingRows.length,
    historicalWorksExtracted: historicalWorkRows.length,
    inspectionsExtracted: inspectionRows.length,
    partialStructuresExtracted: partialRows.length,
    recommendationsExtracted: recommendationRows.length,
    trafficObservationsExtracted: trafficRows.length
  };
  return { bridgeId, summary };
}

function idMap(
  records: readonly { readonly sourceKey: string }[],
  identities: ReadonlyMap<string, ExtractionIdentityRecord>,
  bindings: ReadonlyMap<string, ExistingBinding>
): Map<string, string> {
  return new Map(
    records.map((record) => {
      const identity = requireIdentity(identities, record.sourceKey);
      const binding = bindings.get(bindingKey(identity));
      return [record.sourceKey, binding?.entityId ?? randomUUID()];
    })
  );
}

function requireId(ids: ReadonlyMap<string, string>, sourceKey: string): string {
  const id = ids.get(sourceKey);
  if (id === undefined) {
    throw new Error(`Unresolved extraction source key: ${sourceKey}`);
  }
  return id;
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
