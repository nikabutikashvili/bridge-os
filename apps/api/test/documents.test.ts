import type {
  BridgePortfolioQuery,
  BridgePortfolioResponse,
  DocumentDetailResponse,
  DocumentListResponse,
  DocumentOverviewResponse,
  DocumentPageResponse,
  DocumentProcessingStatus,
  DocumentSummary,
  DocumentUploadResponse,
  ErrorEnvelope
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type { BridgePortfolioReader } from "../src/features/bridges/bridge-reader.js";
import type {
  CreateDocumentUploadInput,
  CreateDocumentUploadResult,
  DocumentCatalog,
  DocumentPhotoRecord,
  IngestedDocumentFile,
  ProcessingFailure
} from "../src/features/documents/document-catalog.js";
import { DocumentIngestionService } from "../src/features/documents/document-ingestion-service.js";
import type { DocumentOverviewReader } from "../src/features/documents/document-overview-reader.js";
import { sanitizePdfFilename } from "../src/features/documents/document-ingestion-service.js";
import type { DocumentStorage } from "../src/features/documents/document-storage.js";
import type { ParsedPdfPage, PdfParser } from "../src/features/documents/pdf-parser.js";
import { PdfJsParser } from "../src/features/documents/pdfjs-parser.js";

const testEnv = {
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  DATABASE_URL: "postgres://bridge_os:bridge_os@localhost:5432/bridge_os",
  DOCUMENT_MAX_UPLOAD_BYTES: 1_024 * 1_024,
  DOCUMENT_STORAGE_ROOT: ".data/test-documents",
  LOG_LEVEL: "silent",
  NODE_ENV: "test"
} as const;

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("document ingestion routes", () => {
  it("returns the document and data-quality overview", async () => {
    app = createTestApp(createFixture());
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents/overview"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(emptyDocumentOverview);
  });

  it("stores and parses a valid PDF into page-level text", async () => {
    const fixture = createFixture();
    app = createTestApp(fixture);

    const response = await upload(app, createPdf("Bauwerksbuch Seite 1"));

    expect(response.statusCode).toBe(201);
    const body = response.json<DocumentDetailResponse & { duplicate: boolean }>();
    expect(body.duplicate).toBe(false);
    expect(body.data).toMatchObject({
      mimeType: "application/pdf",
      originalFilename: "Bauwerksbuch-4405884.pdf",
      status: "READY",
      processing: {
        pageCount: 1,
        status: "EXTRACTION_PENDING"
      },
      pages: { count: 1, pageNumbers: [1] }
    });
    expect(fixture.storage.putCount).toBe(1);

    const pageResponse = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${body.data.id}/pages/1`
    });
    expect(pageResponse.statusCode).toBe(200);
    expect(pageResponse.json()).toMatchObject({
      data: { pageNumber: 1, textContent: "Bauwerksbuch Seite 1" }
    });
  });

  it("returns the existing document for a duplicate checksum", async () => {
    const fixture = createFixture();
    app = createTestApp(fixture);
    const pdf = createPdf("Duplicate fixture");

    const first = await upload(app, pdf);
    const second = await upload(app, pdf, "renamed-copy.pdf");
    const firstBody = first.json<DocumentUploadResponse>();

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({
      data: { id: firstBody.data.id },
      duplicate: true
    });
    expect(fixture.storage.putCount).toBe(1);
  });

  it("re-parses a stored PDF and replaces page text", async () => {
    const parser = new SequencePdfParser();
    const fixture = createFixture(parser);
    app = createTestApp(fixture);
    const pdf = createPdf("Original fixture page");

    const uploaded = await upload(app, pdf);
    const documentId = uploaded.json<DocumentUploadResponse>().data.id;
    const reparsed = await fixture.service.reparse(documentId);
    const page = await fixture.catalog.getPage(documentId, 1);

    expect(reparsed.duplicate).toBe(true);
    expect(parser.calls).toBe(2);
    expect(page).toMatchObject({
      data: { pageNumber: 1, textContent: "pass 2" }
    });
  });

  it("stores a parsed bridge photograph beside the PDF", async () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const fixture = createFixture(new PhotoPdfParser(jpeg));
    app = createTestApp(fixture);

    const response = await upload(app, createPdf("Foto der Bruecke"));
    const body = response.json<DocumentUploadResponse>();
    const stored = await fixture.storage.get(`${body.data.id}/bridge-photo.jpg`);

    expect(response.statusCode).toBe(201);
    expect(fixture.storage.putCount).toBe(2);
    expect(stored).toEqual(jpeg);
  });

  it("rejects an invalid file before creating a processing record", async () => {
    const fixture = createFixture();
    app = createTestApp(fixture);

    const response = await upload(
      app,
      new TextEncoder().encode("this is not a PDF")
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "DOCUMENT_INVALID_PDF" }
    });
    expect(fixture.catalog.size).toBe(0);
    expect(fixture.storage.putCount).toBe(0);
  });

  it("persists parser failures and exposes them on the document record", async () => {
    const fixture = createFixture(new FailingPdfParser());
    app = createTestApp(fixture);

    const response = await upload(app, createPdf("Parser failure fixture"));

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: {
        code: "DOCUMENT_PARSING_FAILED",
        message: "The uploaded PDF could not be parsed."
      }
    });
    const failure = response.json<ErrorEnvelope>();
    const documentId = readFailureDocumentId(failure.error.details);
    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${documentId}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      data: {
        status: "FAILED",
        processing: {
          error: {
            code: "DOCUMENT_PARSING_FAILED",
            message: "Deliberate parser failure"
          },
          status: "FAILED"
        }
      }
    });
  });

  it("rejects a non-PDF MIME type", async () => {
    const fixture = createFixture();
    app = createTestApp(fixture);

    const response = await upload(
      app,
      createPdf("MIME fixture"),
      "fixture.txt",
      "text/plain"
    );

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({
      error: { code: "DOCUMENT_INVALID_MIME_TYPE" }
    });
  });

  it("enforces the multipart size limit before ingestion", async () => {
    const fixture = createFixture();
    app = buildApp({
      bridgePortfolioReader: emptyBridgeReader,
      documentService: fixture.service,
      env: { ...testEnv, DOCUMENT_MAX_UPLOAD_BYTES: 1_024 }
    });
    const oversized = new Uint8Array(2_048);
    oversized.set(new TextEncoder().encode("%PDF-1.4"));

    const response = await upload(app, oversized);

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({
      error: {
        code: "DOCUMENT_TOO_LARGE",
        details: { maxUploadBytes: 1_024 }
      }
    });
    expect(fixture.catalog.size).toBe(0);
  });

  it("returns structured not-found errors for documents and pages", async () => {
    app = createTestApp(createFixture());
    const missingId = "00000000-0000-4000-8000-000000000099";

    const [document, page] = await Promise.all([
      app.inject({ method: "GET", url: `/api/v1/documents/${missingId}` }),
      app.inject({
        method: "GET",
        url: `/api/v1/documents/${missingId}/pages/2`
      })
    ]);

    expect(document.statusCode).toBe(404);
    expect(document.json()).toMatchObject({
      error: { code: "DOCUMENT_NOT_FOUND" }
    });
    expect(page.statusCode).toBe(404);
    expect(page.json()).toMatchObject({
      error: { code: "DOCUMENT_PAGE_NOT_FOUND" }
    });
  });
});

describe("document filename sanitization", () => {
  it("keeps only a normalized leaf PDF filename", () => {
    expect(sanitizePdfFilename("../../Heideckh\u00f6fweg Bauwerksbuch.PDF")).toBe(
      "Heideckhofweg-Bauwerksbuch.pdf"
    );
    expect(sanitizePdfFilename("..\\..\\\u0000.pdf")).toBe("bauwerksbuch.pdf");
  });
});

function createTestApp(fixture: TestFixture): FastifyInstance {
  return buildApp({
    bridgePortfolioReader: emptyBridgeReader,
    documentOverviewReader: emptyDocumentOverviewReader,
    documentService: fixture.service,
    env: testEnv
  });
}

const emptyDocumentOverview: DocumentOverviewResponse = {
  asOf: "2026-08-15T12:00:00.000Z",
  summary: {
    totalDocuments: 0,
    linkedDocuments: 0,
    extractionSucceeded: 0,
    extractionPending: 0,
    extractionFailed: 0,
    processingFailed: 0,
    bridgesWithAttention: 0,
    extractedFindingsRequiringReview: 0
  },
  documents: [],
  bridgeDataHealth: []
};

const emptyDocumentOverviewReader: DocumentOverviewReader = {
  listOverview: () => Promise.resolve(emptyDocumentOverview)
};

function createFixture(parser: PdfParser = new PdfJsParser()): TestFixture {
  const catalog = new MemoryDocumentCatalog();
  const storage = new MemoryDocumentStorage();
  return {
    catalog,
    service: new DocumentIngestionService({
      catalog,
      logger: { error: () => undefined, info: () => undefined },
      maxUploadBytes: testEnv.DOCUMENT_MAX_UPLOAD_BYTES,
      parser,
      storage
    }),
    storage
  };
}

interface TestFixture {
  readonly catalog: MemoryDocumentCatalog;
  readonly service: DocumentIngestionService;
  readonly storage: MemoryDocumentStorage;
}

async function upload(
  target: FastifyInstance,
  content: Uint8Array,
  filename = "Bauwerksbuch 4405884.pdf",
  mimeType = "application/pdf"
) {
  const boundary = "bridge-os-document-boundary";
  const prefix =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--\r\n`;
  return target.inject({
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    method: "POST",
    payload: Buffer.concat([Buffer.from(prefix), Buffer.from(content), Buffer.from(suffix)]),
    url: "/api/v1/documents"
  });
}

class MemoryDocumentStorage implements DocumentStorage {
  public putCount = 0;
  private readonly files = new Map<string, Uint8Array>();

  public delete(storageKey: string): Promise<void> {
    this.files.delete(storageKey);
    return Promise.resolve();
  }

  public get(storageKey: string): Promise<Uint8Array> {
    const content = this.files.get(storageKey);
    if (content === undefined) {
      return Promise.reject(new Error("File not found"));
    }
    return Promise.resolve(content);
  }

  public put(storageKey: string, content: Uint8Array): Promise<void> {
    this.putCount += 1;
    this.files.set(storageKey, new Uint8Array(content));
    return Promise.resolve();
  }
}

interface MemoryDocument {
  readonly checksumSha256: string;
  readonly createdAt: string;
  readonly id: string;
  readonly mimeType: "application/pdf";
  readonly originalFilename: string;
  readonly storageKey: string;
  processingRunId: string;
  readonly sizeBytes: number;
  error: { code: string; message: string } | null;
  pageCount: number | null;
  pages: ParsedPdfPage[];
  parser: string | null;
  parsingCompletedAt: string | null;
  parsingStartedAt: string | null;
  processingStatus: DocumentProcessingStatus;
  status: "FAILED" | "PROCESSING" | "READY" | "UPLOADED";
  updatedAt: string;
}

class MemoryDocumentCatalog implements DocumentCatalog {
  private readonly checksumIndex = new Map<string, string>();
  private readonly documents = new Map<string, MemoryDocument>();

  public get size(): number {
    return this.documents.size;
  }

  public createUpload(
    input: CreateDocumentUploadInput
  ): Promise<CreateDocumentUploadResult> {
    const duplicateId = this.checksumIndex.get(input.checksumSha256);
    if (duplicateId !== undefined) {
      return Promise.resolve({ created: false, documentId: duplicateId });
    }
    const now = new Date().toISOString();
    this.documents.set(input.documentId, {
      checksumSha256: input.checksumSha256,
      createdAt: now,
      error: null,
      id: input.documentId,
      mimeType: input.mimeType,
      originalFilename: input.originalFilename,
      pageCount: null,
      pages: [],
      parser: null,
      parsingCompletedAt: null,
      parsingStartedAt: null,
      processingRunId: input.processingRunId,
      processingStatus: "UPLOADED",
      sizeBytes: input.sizeBytes,
      status: "UPLOADED",
      storageKey: input.storageKey,
      updatedAt: now
    });
    this.checksumIndex.set(input.checksumSha256, input.documentId);
    return Promise.resolve({
      created: true,
      documentId: input.documentId,
      processingRunId: input.processingRunId
    });
  }

  public createProcessingRun(
    documentId: string,
    processingRunId: string
  ): Promise<void> {
    const document = this.require(documentId);
    if (document.status !== "READY" && document.status !== "FAILED") {
      throw new Error("Document cannot start a reparse run.");
    }
    document.processingRunId = processingRunId;
    document.error = null;
    document.processingStatus = "UPLOADED";
    document.status = "PROCESSING";
    document.updatedAt = new Date().toISOString();
    return Promise.resolve();
  }

  public getIngestedFile(documentId: string): Promise<IngestedDocumentFile | null> {
    const document = this.documents.get(documentId);
    if (document === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      documentId,
      status: document.status,
      storageKey: document.storageKey
    });
  }

  public getDocument(id: string): Promise<DocumentDetailResponse | null> {
    const document = this.documents.get(id);
    return Promise.resolve(
      document === undefined ? null : { data: detailData(document) }
    );
  }

  public getPage(id: string, pageNumber: number): Promise<DocumentPageResponse | null> {
    const document = this.documents.get(id);
    const page = document?.pages.find((candidate) => candidate.pageNumber === pageNumber);
    if (document === undefined || page === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      data: {
        createdAt: document.createdAt,
        documentId: id,
        pageNumber,
        textContent: page.textContent,
        updatedAt: document.updatedAt
      }
    });
  }

  public listDocuments(): Promise<DocumentListResponse> {
    const data = [...this.documents.values()].map(summaryData);
    return Promise.resolve({ data, total: data.length });
  }

  public markExtractionPending(documentId: string): Promise<void> {
    const document = this.require(documentId);
    document.processingStatus = "EXTRACTION_PENDING";
    document.status = "READY";
    document.updatedAt = new Date().toISOString();
    return Promise.resolve();
  }

  public markFailed(
    documentId: string,
    _processingRunId: string,
    failure: ProcessingFailure
  ): Promise<void> {
    const document = this.require(documentId);
    document.error = { code: failure.code, message: failure.message };
    document.parser = failure.parser;
    document.processingStatus = "FAILED";
    document.status = "FAILED";
    document.updatedAt = new Date().toISOString();
    return Promise.resolve();
  }

  public markParsing(
    documentId: string,
    _processingRunId: string,
    parser: string
  ): Promise<void> {
    const document = this.require(documentId);
    document.parser = parser;
    document.parsingStartedAt = new Date().toISOString();
    document.processingStatus = "PARSING";
    document.status = "PROCESSING";
    document.updatedAt = document.parsingStartedAt;
    return Promise.resolve();
  }

  public saveParsedPages(
    documentId: string,
    _processingRunId: string,
    parser: string,
    pages: readonly ParsedPdfPage[],
    photo: DocumentPhotoRecord | null = null
  ): Promise<void> {
    void photo;
    const document = this.require(documentId);
    document.pageCount = pages.length;
    document.pages = pages.map((page) => ({ ...page }));
    document.parser = parser;
    document.parsingCompletedAt = new Date().toISOString();
    document.processingStatus = "PARSED";
    document.updatedAt = document.parsingCompletedAt;
    return Promise.resolve();
  }

  private require(id: string): MemoryDocument {
    const document = this.documents.get(id);
    if (document === undefined) {
      throw new Error("Missing in-memory document");
    }
    return document;
  }
}

function detailData(document: MemoryDocument): DocumentDetailResponse["data"] {
  return {
    ...summaryData(document),
    pages: {
      count: document.pages.length,
      pageNumbers: document.pages.map((page) => page.pageNumber)
    }
  };
}

function summaryData(document: MemoryDocument): DocumentSummary {
  return {
    bridgeId: null,
    checksumSha256: document.checksumSha256,
    createdAt: document.createdAt,
    id: document.id,
    isDemoFixture: false,
    mimeType: document.mimeType,
    originalFilename: document.originalFilename,
    processing: {
      createdAt: document.createdAt,
      error: document.error,
      id: document.processingRunId,
      pageCount: document.pageCount,
      parser: document.parser,
      parsingCompletedAt: document.parsingCompletedAt,
      parsingStartedAt: document.parsingStartedAt,
      status: document.processingStatus,
      updatedAt: document.updatedAt
    },
    sizeBytes: document.sizeBytes,
    status: document.status,
    type: "BAUWERKSBUCH",
    updatedAt: document.updatedAt
  };
}

class FailingPdfParser implements PdfParser {
  public readonly name = "failing-test-parser";

  public parse(): Promise<never> {
    return Promise.reject(new Error("Deliberate parser failure"));
  }
}

class SequencePdfParser implements PdfParser {
  public readonly name = "sequence-test-parser";
  public calls = 0;

  public parse(): Promise<{
    pages: ParsedPdfPage[];
    parser: string;
    photo: null;
  }> {
    this.calls += 1;
    return Promise.resolve({
      pages: [
        {
          pageNumber: 1,
          textContent: `pass ${String(this.calls)}`,
          textSource: "PDF_TEXT"
        }
      ],
      parser: this.name,
      photo: null
    });
  }
}

class PhotoPdfParser implements PdfParser {
  public readonly name = "photo-test-parser";

  public constructor(private readonly jpeg: Uint8Array) {}

  public parse(): Promise<{
    pages: ParsedPdfPage[];
    parser: string;
    photo: {
      bytes: Uint8Array;
      mimeType: "image/jpeg";
      pageNumber: number;
    };
  }> {
    return Promise.resolve({
      pages: [
        {
          pageNumber: 1,
          textContent: "Foto der Bruecke",
          textSource: "PDF_TEXT"
        }
      ],
      parser: this.name,
      photo: {
        bytes: this.jpeg,
        mimeType: "image/jpeg",
        pageNumber: 1
      }
    });
  }
}

const emptyBridgeReader: BridgePortfolioReader = {
  getBridge: () => Promise.resolve(null),
  getBridgePhoto: () => Promise.resolve(null),
  getDocuments: () => Promise.resolve(null),
  getFinding: () => Promise.resolve(null),
  getFindings: () => Promise.resolve(null),
  getHistory: () => Promise.resolve(null),
  getInspections: () => Promise.resolve(null),
  getRecommendations: () => Promise.resolve(null),
  listBridges: (query) => Promise.resolve(emptyPortfolio(query))
};

function emptyPortfolio(query: BridgePortfolioQuery): BridgePortfolioResponse {
  return {
    asOf: "2026-08-14",
    data: [],
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 0,
      totalPages: 0
    },
    sort: { direction: query.direction, field: query.sort },
    summary: {
      inspectionsDueOrOverdue: 0,
      structures: 0,
      withNotableFindings: 0,
      withOpenRecommendations: 0
    }
  };
}

function createPdf(text: string): Uint8Array {
  const escapedText = text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escapedText}) Tj\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${String(Buffer.byteLength(stream))} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${String(objects.length + 1)}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body +=
    `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\n` +
    `startxref\n${String(xrefOffset)}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

function readFailureDocumentId(details: unknown): string {
  if (
    typeof details !== "object" ||
    details === null ||
    !("documentId" in details) ||
    typeof details.documentId !== "string"
  ) {
    throw new Error("Expected a document id in the failure envelope.");
  }
  return details.documentId;
}
