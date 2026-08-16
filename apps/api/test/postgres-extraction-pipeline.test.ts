import { randomUUID } from "node:crypto";

import {
  bridgeEvidence,
  bridges,
  createDatabaseConnection,
  documentExtractionInvocations,
  documentExtractionRuns,
  documentPageClassifications,
  documentPages,
  documentProcessingRuns,
  documents,
  extractionEntityBindings,
  sourceEvidence,
  type DatabaseConnection
} from "@bridge-os/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ExtractionPipelineService } from "../src/features/extraction/extraction-pipeline-service.js";
import { ExtractionPipelineError } from "../src/features/extraction/extraction-error.js";
import { PostgresExtractionStore } from "../src/features/extraction/postgres-extraction-store.js";
import { DeterministicExtractionProvider } from "./support/deterministic-extraction-provider.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;

describeDatabase("Postgres extraction pipeline", () => {
  let connection: DatabaseConnection;
  const cleanup: { bridgeId: string | null; documentId: string }[] = [];

  beforeAll(async () => {
    connection = createDatabaseConnection({ DATABASE_URL: databaseUrl });
    const staleDocuments = await connection.db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.originalFilename, "extraction-fixture.pdf"));
    for (const document of staleDocuments) {
      await cleanupFixture(connection, document.id, null);
    }
  });

  afterEach(async () => {
    for (const item of cleanup.splice(0)) {
      await cleanupFixture(connection, item.documentId, item.bridgeId);
    }
  });

  afterAll(async () => {
    await connection.close();
  });

  it("commits run state, classification, domain data, and evidence together", async () => {
    const documentId = randomUUID();
    const processingRunId = randomUUID();
    const externalStructureNumber = `EX-${randomUUID().slice(0, 8)}`;
    cleanup.push({ bridgeId: null, documentId });
    await connection.db.insert(documents).values({
      id: documentId,
      originalFilename: "extraction-fixture.pdf",
      status: "READY",
      type: "BAUWERKSBUCH"
    });
    const now = new Date();
    await connection.db.insert(documentProcessingRuns).values({
      id: processingRunId,
      documentId,
      pageCount: 1,
      parser: "test-parser/1.0",
      parsingCompletedAt: now,
      parsingStartedAt: now,
      status: "EXTRACTION_PENDING"
    });
    const pageText = `Bauwerksnummer ${externalStructureNumber} Name Pipelinebruecke Strasse A9`;
    await connection.db.insert(documentPages).values({
      documentId,
      pageNumber: 1,
      textContent: pageText
    });

    const provider = new DeterministicExtractionProvider({
      classify: () => ({
        categories: [{ category: "IDENTITY_OVERVIEW", confidence: 1 }],
        sectionTitle: "Bauwerksdaten"
      }),
      extract: () => identityOutput(externalStructureNumber)
    });
    const service = new ExtractionPipelineService({
      logger: { error: () => undefined, info: () => undefined },
      provider,
      store: new PostgresExtractionStore(connection.db)
    });

    const run = await service.extract(documentId);
    const bridgeId = (
      await connection.db
        .select({ bridgeId: documentExtractionRuns.outputBridgeId })
        .from(documentExtractionRuns)
        .where(eq(documentExtractionRuns.id, run.id))
    )[0]?.bridgeId;
    expect(bridgeId).toBeTruthy();
    cleanup[0] = { bridgeId: bridgeId ?? null, documentId };

    const [bridgeRows, invocationRows, classificationRows, evidenceRows, links] =
      await Promise.all([
        connection.db
          .select()
          .from(bridges)
          .where(eq(bridges.id, bridgeId ?? "")),
        connection.db
          .select()
          .from(documentExtractionInvocations)
          .where(eq(documentExtractionInvocations.runId, run.id)),
        connection.db
          .select()
          .from(documentPageClassifications)
          .where(eq(documentPageClassifications.runId, run.id)),
        connection.db
          .select()
          .from(sourceEvidence)
          .where(eq(sourceEvidence.extractionRunId, run.id)),
        connection.db
          .select()
          .from(bridgeEvidence)
          .where(eq(bridgeEvidence.bridgeId, bridgeId ?? ""))
      ]);

    expect(run.status).toBe("SUCCEEDED");
    expect(bridgeRows[0]).toMatchObject({
      dataOrigin: "EXTRACTED",
      externalStructureNumber,
      name: "Pipelinebruecke",
      road: "A9"
    });
    expect(invocationRows).toHaveLength(2);
    expect(invocationRows.every((invocation) => invocation.status === "SUCCEEDED")).toBe(
      true
    );
    expect(classificationRows).toEqual([
      expect.objectContaining({
        category: "IDENTITY_OVERVIEW",
        confidence: "1.000",
        pageNumber: 1
      })
    ]);
    expect(evidenceRows.length).toBeGreaterThan(0);
    expect(
      evidenceRows.every(
        (evidence) =>
          evidence.documentId === documentId &&
          evidence.extractionMethod === "MODEL_EXTRACTION" &&
          evidence.reviewState === "AUTOMATICALLY_EXTRACTED" &&
          evidence.extractionRunId === run.id
      )
    ).toBe(true);
    expect(new Set(links.map((link) => link.fieldName))).toEqual(
      new Set(["$", "externalStructureNumber", "name", "road"])
    );

    const [processing] = await connection.db
      .select({ status: documentProcessingRuns.status })
      .from(documentProcessingRuns)
      .where(eq(documentProcessingRuns.id, processingRunId));
    expect(processing?.status).toBe("EXTRACTED");

    const repeated = await service.reextract(documentId);
    expect(repeated.resultSummary?.bridgeAction).toBe("UNCHANGED");
    expect(repeated.resultSummary?.inspectionsExtracted).toBe(0);
    const lineage = await connection.db
      .select()
      .from(extractionEntityBindings)
      .where(eq(extractionEntityBindings.documentId, documentId));
    expect(lineage).toEqual([
      expect.objectContaining({
        entityId: bridgeId,
        entityKind: "BRIDGE",
        latestRunId: repeated.id,
        sourceIdentityKey: `bridge:${externalStructureNumber.toLocaleLowerCase("de-DE")}`
      })
    ]);

    await connection.db
      .update(bridges)
      .set({ name: "Manuell gepruefter Name", updatedAt: new Date() })
      .where(eq(bridges.id, bridgeId ?? ""));
    const blocked = await service
      .reextract(documentId)
      .catch((error: unknown) => error);
    expect(blocked).toBeInstanceOf(ExtractionPipelineError);
    expect((blocked as ExtractionPipelineError).code).toBe(
      "EXTRACTION_PROTECTED_ENTITY_CONFLICT"
    );
    const [preserved] = await connection.db
      .select({ name: bridges.name })
      .from(bridges)
      .where(eq(bridges.id, bridgeId ?? ""));
    expect(preserved?.name).toBe("Manuell gepruefter Name");
  });
});

function identityOutput(externalStructureNumber: string): unknown {
  const citation = (sourceExcerpt: string) => ({
    boundingBox: null,
    confidence: 1,
    derivationMethod: null,
    kind: "SOURCE_FACT",
    pageNumber: 1,
    sourceExcerpt
  });
  const field = (value: string, sourceExcerpt: string) => ({
    evidence: [citation(sourceExcerpt)],
    value
  });
  const empty = { evidence: [], value: null };
  return {
    category: "IDENTITY_OVERVIEW",
    bridge: {
      evidence: [citation(`Bauwerksnummer ${externalStructureNumber}`)],
      externalStructureNumber: field(
        externalStructureNumber,
        `Bauwerksnummer ${externalStructureNumber}`
      ),
      name: field("Pipelinebruecke", "Name Pipelinebruecke"),
      road: field("A9", "Strasse A9"),
      location: {
        countryCode: empty,
        federalState: empty,
        district: empty,
        municipality: empty,
        locality: empty,
        postalCode: empty,
        stationing: empty,
        crossedFeature: empty,
        latitude: empty,
        longitude: empty
      },
      owner: empty,
      loadBearingResponsibility: empty,
      responsibleAuthority: empty,
      maintenanceOffice: empty
    }
  };
}

async function cleanupFixture(
  connection: DatabaseConnection,
  documentId: string,
  knownBridgeId: string | null
): Promise<void> {
  const [run] = await connection.db
    .select({ bridgeId: documentExtractionRuns.outputBridgeId })
    .from(documentExtractionRuns)
    .where(eq(documentExtractionRuns.documentId, documentId))
    .limit(1);
  const bridgeId = knownBridgeId ?? run?.bridgeId ?? null;
  if (bridgeId !== null) {
    await connection.db
      .delete(bridgeEvidence)
      .where(eq(bridgeEvidence.bridgeId, bridgeId));
  }
  await connection.db
    .delete(sourceEvidence)
    .where(eq(sourceEvidence.documentId, documentId));
  await connection.db.delete(documents).where(eq(documents.id, documentId));
  if (bridgeId !== null) {
    await connection.db.delete(bridges).where(eq(bridges.id, bridgeId));
  }
}
