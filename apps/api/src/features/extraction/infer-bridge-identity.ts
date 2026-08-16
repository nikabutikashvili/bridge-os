export interface InferredBridgeIdentity {
  readonly externalStructureNumber: string | null;
  readonly name: string | null;
  readonly road: string | null;
}

export interface InferablePage {
  readonly textContent: string;
}

const ignoredNameLines =
  /nächst|ort|verwaltung|titelblatt|bemerkung|autobahn|die autobahn|version|seite|akten|overath|vilkerath/i;

export function inferBridgeIdentity(
  pages: readonly InferablePage[]
): InferredBridgeIdentity {
  const text = pages.map((page) => page.textContent).join("\n");
  const compact = text.normalize("NFKC").replace(/\s+/g, " ").trim();
  return {
    externalStructureNumber: inferStructureNumber(compact, text),
    name: inferName(text),
    road: inferRoad(compact)
  };
}

function inferStructureNumber(compact: string, raw: string): string | null {
  const labeled = /(?:bauwerksnummer|bauwerks-?nr\.?)\D{0,20}(\d{5,8})/i.exec(
    compact
  );
  if (labeled?.[1] !== undefined) {
    return labeled[1];
  }
  const header = /nummer\s+stra(?:ss|ß)e\s+ibwnr\s+(\d{5,8})/i.exec(compact);
  if (header?.[1] !== undefined) {
    return header[1];
  }
  const afterNummer = /(?:^|\n)\s*nummer\s*(?:\n[^\n]*){0,3}?\n\s*(\d{5,8})\b/i.exec(
    raw
  );
  return afterNummer?.[1] ?? null;
}

function inferName(raw: string): string | null {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const labelIndex = lines.findIndex((line) => /^bauwerksname\b/i.test(line));
  if (labelIndex === -1) {
    return null;
  }
  for (const line of lines.slice(labelIndex + 1, labelIndex + 5)) {
    if (line.length < 4 || ignoredNameLines.test(line) || /^\d/.test(line)) {
      continue;
    }
    return line;
  }
  return null;
}

function inferRoad(compact: string): string | null {
  const match = /\b((?:A|B|L|K)\s?\d{1,4})\b/.exec(compact);
  return match?.[1]?.replace(/\s+/g, " ") ?? null;
}
