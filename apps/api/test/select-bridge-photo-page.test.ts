import { describe, expect, it } from "vitest";

import { selectBridgePhotoPage } from "../src/features/documents/select-bridge-photo-page.js";

describe("selectBridgePhotoPage", () => {
  it("prefers an explicit Foto page over identity and drawings", () => {
    expect(
      selectBridgePhotoPage([
        {
          pageNumber: 1,
          textContent:
            "Bauwerksbuch Identifikation Bauwerksnummer 4405884 Strasse A57 Gemeinde Meerbusch",
          textSource: "PDF_TEXT"
        },
        {
          pageNumber: 2,
          textContent: "Foto 1 Ansicht der Bruecke von Sueden",
          textSource: "PDF_TEXT"
        },
        {
          pageNumber: 3,
          textContent: "Querschnitt und Längsschnitt des Überbaus",
          textSource: "PDF_TEXT"
        }
      ])
    ).toBe(2);
  });

  it("selects a Bauwerksansicht caption and skips a Lageplan", () => {
    expect(
      selectBridgePhotoPage([
        {
          pageNumber: 4,
          textContent: "Lageplan der Massnahme",
          textSource: "PDF_TEXT"
        },
        {
          pageNumber: 5,
          textContent: "Bauwerksansicht von Westen",
          textSource: "PDF_TEXT"
        }
      ])
    ).toBe(5);
  });

  it("does not treat a dense identity page as a photograph", () => {
    expect(
      selectBridgePhotoPage([
        {
          pageNumber: 1,
          textContent:
            "Bauwerksbuch Seite mit genug digitalem Textinhalt fuer die Extraktion der Identitaet",
          textSource: "PDF_TEXT"
        }
      ])
    ).toBeNull();
  });

  it("can recover a scanned photo page from short OCR text", () => {
    expect(
      selectBridgePhotoPage([
        {
          pageNumber: 1,
          textContent: "Titelblatt",
          textSource: "OCR"
        }
      ])
    ).toBe(1);
  });
});
