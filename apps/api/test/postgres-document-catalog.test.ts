import { createHash, randomUUID } from "node:crypto";

import {
  createDatabaseConnection,
  documents,
  type DatabaseConnection
} from "@bridge-os/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PostgresDocumentCatalog } from "../src/features/documents/postgres-document-catalog.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;

describeDatabase("PostgresDocumentCatalog", () => {
  let catalog: PostgresDocumentCatalog;
  let connection: DatabaseConnection;
  const createdDocumentIds: string[] = [];

  beforeAll(() => {
    connection = createDatabaseConnection({ DATABASE_URL: databaseUrl });
    catalog = new PostgresDocumentCatalog(connection.db);
  });

  afterEach(async () => {
    for (const documentId of createdDocumentIds.splice(0)) {
      await connection.db.delete(documents).where(eq(documents.id, documentId));
    }
  });

  afterAll(async () => {
    await connection.close();
  });

  it("persists the parsing lifecycle, pages, and checksum deduplication", async () => {
    const documentId = randomUUID();
    const processingRunId = randomUUID();
    const checksumSha256 = createHash("sha256")
      .update(`catalog-fixture-${documentId}`)
      .digest("hex");
    createdDocumentIds.push(documentId);

    const created = await catalog.createUpload({
      checksumSha256,
      documentId,
      mimeType: "application/pdf",
      originalFilename: "catalog-fixture.pdf",
      processingRunId,
      sizeBytes: 128,
      storageKey: `${documentId}/catalog-fixture.pdf`
    });
    expect(created).toEqual({ created: true, documentId, processingRunId });

    const duplicate = await catalog.createUpload({
      checksumSha256,
      documentId: randomUUID(),
      mimeType: "application/pdf",
      originalFilename: "renamed.pdf",
      processingRunId: randomUUID(),
      sizeBytes: 128,
      storageKey: `${randomUUID()}/renamed.pdf`
    });
    expect(duplicate).toEqual({ created: false, documentId });

    await catalog.markParsing(documentId, processingRunId, "test-parser/1.0");
    await catalog.saveParsedPages(
      documentId,
      processingRunId,
      "test-parser/1.0",
      [
        { pageNumber: 1, textContent: "Bauwerksbuch", textSource: "PDF_TEXT" },
        { pageNumber: 2, textContent: "Pr\u00fcfungen", textSource: "PDF_TEXT" }
      ],
      {
        byteSize: 4,
        mimeType: "image/jpeg",
        pageNumber: 1,
        storageKey: `${documentId}/bridge-photo.jpg`
      }
    );
    await catalog.markExtractionPending(documentId, processingRunId);

    const [detail, page] = await Promise.all([
      catalog.getDocument(documentId),
      catalog.getPage(documentId, 2)
    ]);
    expect(detail).toMatchObject({
      data: {
        id: documentId,
        pages: { count: 2, pageNumbers: [1, 2] },
        processing: {
          pageCount: 2,
          parser: "test-parser/1.0",
          status: "EXTRACTION_PENDING"
        },
        status: "READY"
      }
    });
    expect(page).toMatchObject({
      data: {
        documentId,
        pageNumber: 2,
        textContent: "Pr\u00fcfungen"
      }
    });
    const [storedPhoto] = await connection.db
      .select({
        photoByteSize: documents.photoByteSize,
        photoMimeType: documents.photoMimeType,
        photoPageNumber: documents.photoPageNumber,
        photoStorageKey: documents.photoStorageKey
      })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    expect(storedPhoto).toEqual({
      photoByteSize: 4,
      photoMimeType: "image/jpeg",
      photoPageNumber: 1,
      photoStorageKey: `${documentId}/bridge-photo.jpg`
    });

    const reparseRunId = randomUUID();
    await catalog.createProcessingRun(documentId, reparseRunId);
    await catalog.markParsing(documentId, reparseRunId, "test-parser/2.0");
    await catalog.saveParsedPages(documentId, reparseRunId, "test-parser/2.0", [
      {
        pageNumber: 1,
        textContent: "OCR recovered Bauwerksbuch text",
        textSource: "OCR"
      }
    ]);
    await catalog.markExtractionPending(documentId, reparseRunId);

    const [reparsed, ocrPage] = await Promise.all([
      catalog.getDocument(documentId),
      catalog.getPage(documentId, 1)
    ]);
    expect(reparsed).toMatchObject({
      data: {
        pages: { count: 1, pageNumbers: [1] },
        processing: {
          pageCount: 1,
          parser: "test-parser/2.0",
          status: "EXTRACTION_PENDING"
        }
      }
    });
    expect(ocrPage).toMatchObject({
      data: {
        pageNumber: 1,
        textContent: "OCR recovered Bauwerksbuch text"
      }
    });
    expect(await catalog.getPage(documentId, 2)).toBeNull();

    const [photoRow] = await connection.db
      .select({
        photoByteSize: documents.photoByteSize,
        photoMimeType: documents.photoMimeType,
        photoPageNumber: documents.photoPageNumber,
        photoStorageKey: documents.photoStorageKey
      })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    expect(photoRow).toEqual({
      photoByteSize: null,
      photoMimeType: null,
      photoPageNumber: null,
      photoStorageKey: null
    });
  });
});
