import type { PageTextSource } from "./page-text.js";

export interface ParsedPdfPage {
  readonly pageNumber: number;
  readonly textContent: string;
  readonly textSource: PageTextSource;
}

export interface ParsedBridgePhoto {
  readonly bytes: Uint8Array;
  readonly mimeType: "image/jpeg";
  readonly pageNumber: number;
}

export interface ParsedPdf {
  readonly pages: ParsedPdfPage[];
  readonly parser: string;
  readonly photo: ParsedBridgePhoto | null;
}

export interface PdfParser {
  readonly name: string;
  parse(content: Uint8Array): Promise<ParsedPdf>;
}
