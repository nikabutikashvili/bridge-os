import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { getDocument, version } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { PageOcrEngine } from "./page-ocr.js";
import {
  compactPageText,
  hasInsufficientPageText
} from "./page-text.js";
import {
  createPdfCanvasFactory,
  rasterizePdfPage,
  rasterizePdfPageJpeg
} from "./pdf-page-canvas.js";
import type { ParsedBridgePhoto, ParsedPdf, ParsedPdfPage, PdfParser } from "./pdf-parser.js";
import { selectBridgePhotoPage } from "./select-bridge-photo-page.js";
import { TesseractCliPageOcr } from "./tesseract-cli-page-ocr.js";

const require = createRequire(import.meta.url);

interface TextItem {
  readonly hasEOL: boolean;
  readonly str: string;
  readonly transform: readonly number[];
}

export class PdfJsParser implements PdfParser {
  public readonly name = `pdfjs-dist/${version}`;

  public constructor(private readonly ocr: PageOcrEngine | null = null) {}

  public async parse(content: Uint8Array): Promise<ParsedPdf> {
    const canvasFactory = createPdfCanvasFactory();
    const loadingTask = getDocument({
      data: new Uint8Array(content),
      stopAtErrors: true,
      useSystemFonts: true,
      wasmUrl: pdfJsWasmUrl(),
      useWasm: false
    });
    try {
      const document = await loadingTask.promise;
      const pages: ParsedPdfPage[] = [];
      let usedOcr = false;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        try {
          const text = await page.getTextContent();
          const parsedPage = await this.parsePage(
            pageNumber,
            renderPageText(text.items),
            page,
            canvasFactory
          );
          if (parsedPage.textSource === "OCR") {
            usedOcr = true;
          }
          pages.push(parsedPage);
        } finally {
          page.cleanup();
        }
      }
      return {
        pages,
        parser:
          usedOcr && this.ocr !== null
            ? `${this.name}+${this.ocr.name}`
            : this.name,
        photo: await extractBridgePhoto(document, pages, canvasFactory)
      };
    } finally {
      await loadingTask.destroy();
    }
  }

  private async parsePage(
    pageNumber: number,
    textContent: string,
    page: Parameters<typeof rasterizePdfPage>[0],
    canvasFactory: ReturnType<typeof createPdfCanvasFactory>
  ): Promise<ParsedPdfPage> {
    if (this.ocr === null || !hasInsufficientPageText(textContent)) {
      return { pageNumber, textContent, textSource: "PDF_TEXT" };
    }

    try {
      const ocrText = (
        await this.ocr.recognize(await rasterizePdfPage(page, canvasFactory))
      ).trim();
      if (compactPageText(ocrText).length <= compactPageText(textContent).length) {
        return { pageNumber, textContent, textSource: "PDF_TEXT" };
      }
      return { pageNumber, textContent: ocrText, textSource: "OCR" };
    } catch {
      return { pageNumber, textContent, textSource: "PDF_TEXT" };
    }
  }
}

export function pdfJsWasmUrl(): string {
  const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
  return `${pathToFileURL(join(pdfjsRoot, "wasm")).href}/`;
}

export function createOcrPdfParser(): PdfJsParser {
  return new PdfJsParser(new TesseractCliPageOcr());
}

async function extractBridgePhoto(
  document: { getPage(pageNumber: number): Promise<Parameters<typeof rasterizePdfPageJpeg>[0] & { cleanup(): void }> },
  pages: readonly ParsedPdfPage[],
  canvasFactory: ReturnType<typeof createPdfCanvasFactory>
): Promise<ParsedBridgePhoto | null> {
  const pageNumber = selectBridgePhotoPage(pages);
  if (pageNumber === null) {
    return null;
  }

  try {
    const page = await document.getPage(pageNumber);
    try {
      const bytes = await rasterizePdfPageJpeg(page, canvasFactory);
      if (bytes === null || bytes.byteLength === 0) {
        return null;
      }
      return { bytes, mimeType: "image/jpeg", pageNumber };
    } finally {
      page.cleanup();
    }
  } catch {
    return null;
  }
}

function renderPageText(items: readonly unknown[]): string {
  const lines: string[] = [];
  let currentLine = "";
  let previousY: number | null = null;

  const flushLine = (): void => {
    const normalized = currentLine.replace(/\s+/g, " ").trim();
    if (normalized.length > 0) {
      lines.push(normalized);
    }
    currentLine = "";
  };

  for (const candidate of items) {
    if (!isTextItem(candidate)) {
      continue;
    }
    const text = candidate.str.replace(/\s+/g, " ").trim();
    const currentY: number | null = candidate.transform[5] ?? previousY;
    if (
      currentLine.length > 0 &&
      previousY !== null &&
      currentY !== null &&
      Math.abs(currentY - previousY) > 2.5
    ) {
      flushLine();
    }
    if (text.length > 0) {
      currentLine = currentLine.length === 0 ? text : `${currentLine} ${text}`;
    }
    if (candidate.hasEOL) {
      flushLine();
    }
    previousY = currentY;
  }
  flushLine();
  return lines.join("\n");
}

function isTextItem(value: unknown): value is TextItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item["str"] === "string" &&
    typeof item["hasEOL"] === "boolean" &&
    Array.isArray(item["transform"]) &&
    item["transform"].every((entry) => typeof entry === "number")
  );
}
