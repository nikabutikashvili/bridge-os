import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { PageOcrEngine } from "../src/features/documents/page-ocr.js";
import {
  PdfJsParser,
  pdfJsWasmUrl
} from "../src/features/documents/pdfjs-parser.js";

describe("PdfJsParser OCR fallback", () => {
  it("keeps PDF text and does not OCR a digital page", async () => {
    const ocr = new RecordingPageOcr();
    const parser = new PdfJsParser(ocr);
    const parsed = await parser.parse(
      createPdf("Bauwerksbuch Seite mit genug digitalem Textinhalt fuer die Extraktion")
    );

    expect(ocr.calls).toBe(0);
    expect(parsed.parser).toBe(parser.name);
    expect(parsed.pages).toEqual([
      {
        pageNumber: 1,
        textContent:
          "Bauwerksbuch Seite mit genug digitalem Textinhalt fuer die Extraktion",
        textSource: "PDF_TEXT"
      }
    ]);
    expect(parsed.photo).toBeNull();
  });

  it("OCRs a textless page and persists the recovered text", async () => {
    const ocr = new RecordingPageOcr(
      "Bauwerksnummer 4405884 OCR Text genug fuer Klassifikation"
    );
    const parser = new PdfJsParser(ocr);
    const parsed = await parser.parse(createEmptyPagePdf());

    expect(ocr.calls).toBe(1);
    expect(ocr.images[0]?.byteLength).toBeGreaterThan(0);
    expect(parsed.parser).toBe(`${parser.name}+fake-ocr`);
    expect(parsed.pages).toEqual([
      {
        pageNumber: 1,
        textContent: "Bauwerksnummer 4405884 OCR Text genug fuer Klassifikation",
        textSource: "OCR"
      }
    ]);
    expect(parsed.photo).toBeNull();
  });

  it("rasterizes a labelled photograph page as JPEG", async () => {
    const parser = new PdfJsParser();
    const parsed = await parser.parse(
      createPhotoPdf("Foto der Bruecke von Sueden")
    );

    expect(parsed.photo?.pageNumber).toBe(1);
    expect(parsed.photo?.mimeType).toBe("image/jpeg");
    expect(parsed.photo?.bytes[0]).toBe(0xff);
    expect(parsed.photo?.bytes[1]).toBe(0xd8);
  });

  it("points pdf.js at the bundled wasm directory so JBIG2 pages can decode", () => {
    const wasmUrl = pdfJsWasmUrl();
    expect(wasmUrl.endsWith("/wasm/")).toBe(true);
    expect(
      existsSync(join(fileURLToPath(wasmUrl), "jbig2_nowasm_fallback.js"))
    ).toBe(true);
  });
});

class RecordingPageOcr implements PageOcrEngine {
  public readonly name = "fake-ocr";
  public readonly images: Uint8Array[] = [];
  public calls = 0;

  public constructor(private readonly text = "OCR fallback text") {}

  public recognize(imagePng: Uint8Array): Promise<string> {
    this.calls += 1;
    this.images.push(imagePng);
    return Promise.resolve(this.text);
  }
}

function createEmptyPagePdf(): Uint8Array {
  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>"
  ]);
}

function createPdf(text: string): Uint8Array {
  return assembleTextPdf(text, false);
}

function createPhotoPdf(text: string): Uint8Array {
  return assembleTextPdf(text, true);
}

function assembleTextPdf(text: string, includePhotoBlock: boolean): Uint8Array {
  const escapedText = text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
  const photoBlock = includePhotoBlock ? "0.18 0.24 0.30 rg\n72 180 468 500 re f\n0 0 0 rg\n" : "";
  const stream = `${photoBlock}BT\n/F1 12 Tf\n72 120 Td\n(${escapedText}) Tj\nET`;
  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${String(Buffer.byteLength(stream))} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ]);
}

function assemblePdf(objects: readonly string[]): Uint8Array {
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
