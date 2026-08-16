import type { ExtractedEvidence } from "@bridge-os/contracts";

import {
  gaussKruegerDhdnToWgs84,
  utmToWgs84,
  type GeographicCoordinate
} from "./projected-coordinates.js";

export interface InferableCoordinatePage {
  readonly pageNumber?: number;
  readonly textContent: string;
}

export interface InferredBridgeCoordinates {
  readonly evidence: ExtractedEvidence | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
}

interface ParsedGisCoordinate extends GeographicCoordinate {
  readonly method: "GAUSS_KRUEGER_DHDN_TO_WGS84" | "UTM_ETRS89_TO_WGS84";
}

const utmBlockPattern =
  /utm[- ]koordinaten([\s\S]{0,500}?)(?=gau[sß][- ]kr[uü]ger|gesamtl[aä]nge|5\.\d|$)/i;
const gkBlockPattern =
  /gau[sß][- ]kr[uü]ger[- ]koordinaten([\s\S]{0,500}?)(?=utm[- ]koordinaten|gesamtl[aä]nge|5\.\d|$)/i;
const gisHeadingPattern = /gis[- ]koordinaten|utm[- ]koordinaten|gau[sß][- ]kr[uü]ger/i;
const labeledValuePattern =
  /(rechtswert|hochwert)\s*:?\s*([0-9]{1,3}(?:\.[0-9]{3})+,[0-9]+|[0-9]+(?:[.,][0-9]+)?)/gi;

export function inferBridgeCoordinates(
  pages: readonly InferableCoordinatePage[]
): InferredBridgeCoordinates {
  for (const page of pages) {
    const parsed = parseGisPage(page.textContent);
    if (parsed === null) {
      continue;
    }
    return {
      evidence: coordinateEvidence(page.pageNumber, page.textContent, parsed.method),
      latitude: formatCoordinate(parsed.latitude),
      longitude: formatCoordinate(parsed.longitude)
    };
  }
  return { evidence: null, latitude: null, longitude: null };
}

function parseGisPage(text: string): ParsedGisCoordinate | null {
  const fromUtmBlock = firstConvertiblePair(
    parseProjectedPairs(utmBlockPattern.exec(text)?.[1] ?? ""),
    utmPairToWgs84,
    "UTM_ETRS89_TO_WGS84"
  );
  if (fromUtmBlock !== null) {
    return fromUtmBlock;
  }
  const fromGkBlock = firstConvertiblePair(
    parseProjectedPairs(gkBlockPattern.exec(text)?.[1] ?? ""),
    gkPairToWgs84,
    "GAUSS_KRUEGER_DHDN_TO_WGS84"
  );
  if (fromGkBlock !== null) {
    return fromGkBlock;
  }
  if (!gisHeadingPattern.test(text)) {
    return null;
  }
  const pagePairs = parseProjectedPairs(text);
  return (
    firstConvertiblePair(pagePairs, utmPairToWgs84, "UTM_ETRS89_TO_WGS84") ??
    firstConvertiblePair(pagePairs, gkPairToWgs84, "GAUSS_KRUEGER_DHDN_TO_WGS84")
  );
}

function parseProjectedPairs(
  block: string
): { first: number; second: number }[] {
  if (block.trim().length === 0) {
    return [];
  }
  const pairs: { first: number; second: number }[] = [];
  let rechtswert: number | undefined;
  let hochwert: number | undefined;
  for (const match of block.matchAll(labeledValuePattern)) {
    const label = match[1]?.toLowerCase();
    const value = parseGermanMeters(match[2] ?? "");
    if (label === undefined || value === null) {
      continue;
    }
    if (label === "rechtswert") {
      rechtswert = value;
    } else {
      hochwert = value;
    }
    if (rechtswert !== undefined && hochwert !== undefined) {
      pairs.push({ first: rechtswert, second: hochwert });
      rechtswert = undefined;
      hochwert = undefined;
    }
  }
  return pairs;
}

function firstConvertiblePair(
  pairs: readonly { first: number; second: number }[],
  convert: (pair: { first: number; second: number }) => GeographicCoordinate | null,
  method: ParsedGisCoordinate["method"]
): ParsedGisCoordinate | null {
  for (const pair of pairs) {
    const wgs84 = convert(pair);
    if (wgs84 !== null) {
      return { ...wgs84, method };
    }
  }
  return null;
}

function utmPairToWgs84(pair: {
  readonly first: number;
  readonly second: number;
}): GeographicCoordinate | null {
  const easting = [pair.first, pair.second].find(
    (value) => value >= 250_000 && value <= 850_000
  );
  const northing = [pair.first, pair.second].find(
    (value) => value >= 5_200_000 && value <= 6_200_000
  );
  if (easting === undefined || northing === undefined) {
    return null;
  }
  return utmToWgs84(easting, northing, 32);
}

function gkPairToWgs84(pair: {
  readonly first: number;
  readonly second: number;
}): GeographicCoordinate | null {
  const easting = [pair.first, pair.second].find(
    (value) => value >= 2_400_000 && value <= 5_600_000
  );
  const northing = [pair.first, pair.second].find(
    (value) => value >= 5_200_000 && value <= 6_200_000
  );
  if (easting === undefined || northing === undefined) {
    return null;
  }
  const zone = Math.floor(easting / 1_000_000);
  return gaussKruegerDhdnToWgs84(easting, northing, zone);
}

function parseGermanMeters(raw: string): number | null {
  const trimmed = raw.trim();
  if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(trimmed)) {
    return Number(trimmed.replaceAll(".", "").replace(",", "."));
  }
  if (/^\d+(?:[.,]\d+)?$/.test(trimmed)) {
    return Number(trimmed.replace(",", "."));
  }
  return null;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function coordinateEvidence(
  pageNumber: number | undefined,
  text: string,
  method: ParsedGisCoordinate["method"]
): ExtractedEvidence | null {
  if (pageNumber === undefined || pageNumber < 1) {
    return null;
  }
  const excerpt = gisExcerpt(text);
  if (excerpt === null) {
    return null;
  }
  return {
    boundingBox: null,
    confidence: 1,
    derivationMethod: method,
    kind: "DERIVED",
    pageNumber,
    sourceExcerpt: excerpt
  };
}

function gisExcerpt(text: string): string | null {
  const heading = gisHeadingPattern.exec(text);
  if (heading?.index === undefined) {
    return null;
  }
  return text
    .slice(heading.index, heading.index + 280)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}
