import type { ExtractablePageCategory, ExtractedEvidence } from "@bridge-os/contracts";

import type {
  NormalizedFinding,
  NormalizedInspection,
  NormalizedRecommendation
} from "./normalized-extraction.js";
import {
  inferUnitFromText,
  normalizeCurrency,
  normalizeDate,
  normalizeDecimal,
  normalizeInteger,
  normalizeInspectionType,
  normalizeNullableString,
  normalizeUrgency
} from "./normalize-values.js";

export interface InferableSectionPage {
  readonly pageNumber?: number;
  readonly textContent: string;
}

const findingRowPattern =
  /\[(\d+)\]\s*S\s*=\s*(\d)\s*,\s*V\s*=\s*(\d)\s*,\s*D\s*=\s*(\d)(?:\s+EP)?\s*(?:BSP-ID\s+([0-9-]+))?([^\n]*)/gi;
const inspectionRowPattern =
  /(?:H\d+\s+)?(?:\d+\.\s+)?(Hauptprüfung(?:\s+vor der Abnahme)?|Einfache Prüfung|Sonderprüfung)\s+(\d{1,2}\.\d{1,2}\.\d{4})(?:\s+(\d+)\s+Monate)?(?:\s+(\d+,\d+))?/gi;
const recommendationBlockPattern =
  /Ma[sß]nahmenempfehlung\s*\{\s*(\d+)\s*\}([\s\S]*?)(?=Ma[sß]nahmenempfehlung\s*\{\s*\d+\s*\}|$)/gi;
const germanNumberPattern = "--|\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?";
const quantityPattern = new RegExp(`Menge[:\\s]*(${germanNumberPattern})`, "i");
const costPattern = new RegExp(
  `Gesch[äa]tzte Kosten[:\\s]*(${germanNumberPattern})\\s*(EURO|EUR|€)?`,
  "i"
);
const inspectorLabelPattern =
  /Pr[üu]fer(?:in)?[:.]?\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß. \-,/]{1,80})/;

export function inferSection7Categories(
  text: string
): readonly ExtractablePageCategory[] {
  const categories: ExtractablePageCategory[] = [];
  if (
    /\[\d+\]\s*S\s*=/.test(text) ||
    /7\.4\s+Sch[äa]den/i.test(text)
  ) {
    categories.push("FINDINGS_DAMAGE");
  }
  if (
    /Ma[sß]nahmenempfehlung\s*\{/.test(text) ||
    /Dringlichkeit\s+\S+/i.test(text) ||
    /7\.6\s+Empfehlungen/i.test(text)
  ) {
    categories.push("RECOMMENDATIONS");
  }
  if (
    /(?:Hauptprüfung|Einfache Prüfung|Sonderprüfung)\s+\d{1,2}\.\d{1,2}\.\d{4}/.test(
      text
    ) ||
    /7\.3\s+Durchgef[üu]hrte Pr[üu]fungen/i.test(text)
  ) {
    categories.push("INSPECTIONS");
  }
  return categories;
}

export function inferInspectionsFromPages(
  pages: readonly InferableSectionPage[],
  partialStructureRef: string
): NormalizedInspection[] {
  const inspections: NormalizedInspection[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const pageNumber = page.pageNumber ?? 1;
    for (const match of page.textContent.matchAll(inspectionRowPattern)) {
      const typeLabel = match[1];
      const dateText = match[2];
      if (typeLabel === undefined || dateText === undefined) {
        continue;
      }
      const inspectedOn = normalizeDate(dateText);
      const type = normalizeInspectionType(typeLabel);
      const sourceKey = `inspection:${inspectedOn ?? dateText}:${type ?? "OTHER"}`;
      if (seen.has(sourceKey)) {
        continue;
      }
      seen.add(sourceKey);
      const excerpt = collapseWhitespace(match[0]).slice(0, 400);
      const evidence = [sourceEvidence(pageNumber, excerpt)];
      inspections.push({
        sourceKey,
        partialStructureRef,
        evidence,
        fieldEvidence: {
          type: type === null ? [] : evidence,
          inspectedOn: inspectedOn === null ? [] : evidence,
          cycleMonths: match[3] === undefined ? [] : evidence,
          conditionScore: match[4] === undefined ? [] : evidence
        },
        values: {
          type,
          inspectedOn,
          inspector: null,
          conditionScore: normalizeDecimal(match[4] ?? null),
          cycleMonths: normalizeInteger(match[3] ?? null)
        }
      });
    }
  }
  return attachInspectorsToInspections(inspections, pages);
}

export function attachInspectorsToInspections(
  inspections: readonly NormalizedInspection[],
  pages: readonly InferableSectionPage[]
): NormalizedInspection[] {
  const inspectors = inferInspectorsByDate(pages);
  return inspections.map((inspection) => {
    const inspectedOn = inspection.values.inspectedOn;
    if (inspection.values.inspector !== null || inspectedOn === null) {
      return inspection;
    }
    const inspector = inspectors.get(inspectedOn);
    if (inspector === undefined) {
      return inspection;
    }
    const evidence = [
      ...inspection.evidence,
      sourceEvidence(inspector.pageNumber, inspector.excerpt)
    ];
    return {
      ...inspection,
      evidence,
      fieldEvidence: {
        ...inspection.fieldEvidence,
        inspector: [sourceEvidence(inspector.pageNumber, inspector.excerpt)]
      },
      values: {
        ...inspection.values,
        inspector: inspector.name
      }
    };
  });
}

export function inferFindingsFromPages(
  pages: readonly InferableSectionPage[],
  inspectionRef: string,
  partialStructureRef: string
): NormalizedFinding[] {
  const findings: NormalizedFinding[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const pageNumber = page.pageNumber ?? 1;
    const text = page.textContent;
    for (const match of text.matchAll(findingRowPattern)) {
      const identifier = match[1];
      const stability = match[2];
      const traffic = match[3];
      const durability = match[4];
      if (
        identifier === undefined ||
        stability === undefined ||
        traffic === undefined ||
        durability === undefined
      ) {
        continue;
      }
      const sourceKey = `finding:${identifier}`;
      if (seen.has(sourceKey)) {
        continue;
      }
      seen.add(sourceKey);
      const description = inferFindingDescription(text, match);
      const excerpt = collapseWhitespace(match[0]).slice(0, 400);
      const evidence = [sourceEvidence(pageNumber, excerpt)];
      findings.push({
        sourceKey,
        partialStructureRef,
        inspectionRef,
        componentRef: null,
        evidence,
        fieldEvidence: {
          sourceIdentifier: evidence,
          description: description === null ? [] : evidence,
          stabilityRating: evidence,
          trafficSafetyRating: evidence,
          durabilityRating: evidence
        },
        values: {
          sourceIdentifier: identifier,
          defectType: null,
          description,
          location: null,
          extent: null,
          dimensionLength: null,
          dimensionWidth: null,
          dimensionDepth: null,
          dimensionUnit: null,
          quantity: null,
          quantityUnit: null,
          stabilityRating: Number(stability),
          trafficSafetyRating: Number(traffic),
          durabilityRating: Number(durability),
          status: "OPEN"
        }
      });
    }
  }
  return findings;
}

export function inferRecommendationsFromPages(
  pages: readonly InferableSectionPage[],
  partialStructureRef: string
): NormalizedRecommendation[] {
  const recommendations: NormalizedRecommendation[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const pageNumber = page.pageNumber ?? 1;
    for (const match of page.textContent.matchAll(recommendationBlockPattern)) {
      const measureId = match[1];
      const body = match[2] ?? "";
      if (measureId === undefined) {
        continue;
      }
      const sourceKey = `recommendation:${measureId}`;
      if (seen.has(sourceKey)) {
        continue;
      }
      seen.add(sourceKey);
      const workType = firstGroup(/Art der Leistung\s+([^\n]+)/i, body);
      const quantityText = firstGroup(quantityPattern, body);
      const costText = firstGroup(costPattern, body);
      const urgency = normalizeUrgency(
        firstGroup(
          /Dringlichkeit\s+(Sofort|Kurzfristig|Mittelfristig|Langfristig)/i,
          body
        )
      );
      const rawQuantity = parseDashedNumber(quantityText);
      const cost = parseDashedNumber(costText);
      const unit =
        rawQuantity === null
          ? null
          : (inferUnitFromText(workType) ?? inferUnitFromText(body) ?? "Stk");
      const quantity = unit === null ? null : rawQuantity;
      const currency =
        cost === null ? null : normalizeCurrency(firstGroup(/EURO|EUR|€/i, body) ?? "EUR");
      const linkedFindingRefs = assignedFindingRefs(body);
      const excerpt = collapseWhitespace(
        `Maßnahmenempfehlung {${measureId}} ${workType ?? ""} ${urgency ?? ""}`
      ).slice(0, 400);
      const evidence = [sourceEvidence(pageNumber, excerpt)];
      recommendations.push({
        sourceKey,
        partialStructureRef,
        linkedFindingRefs,
        evidence,
        fieldEvidence: {
          workType: workType === null ? [] : evidence,
          urgency: urgency === null ? [] : evidence,
          quantity: quantity === null ? [] : evidence,
          unit: unit === null ? [] : evidence,
          sourceEstimatedCost: cost === null ? [] : evidence,
          sourceEstimatedCostCurrency: currency === null ? [] : evidence
        },
        values: {
          workType,
          description: workType,
          urgency,
          quantity,
          unit,
          sourceEstimatedCost: cost,
          sourceEstimatedCostCurrency: currency,
          targetYear: null,
          plannedYear: null,
          status: "OPEN"
        }
      });
    }
  }
  return recommendations;
}

export function linkRecommendationsFromFindingMentions(
  recommendations: readonly NormalizedRecommendation[],
  findings: readonly NormalizedFinding[]
): NormalizedRecommendation[] {
  if (recommendations.length === 0 || findings.length === 0) {
    return [...recommendations];
  }
  const extraByMeasure = new Map<string, string[]>();
  for (const finding of findings) {
    const description = finding.values.description ?? "";
    for (const match of description.matchAll(/Ma[sß]nahme(?:nempfehlung)?\s*\{(\d+)\}/gi)) {
      const measureId = match[1];
      if (measureId === undefined) {
        continue;
      }
      const refs = extraByMeasure.get(measureId) ?? [];
      refs.push(finding.sourceKey);
      extraByMeasure.set(measureId, refs);
    }
  }
  return recommendations.map((recommendation) => {
    const measureId = recommendationMeasureId(recommendation);
    const extra = measureId === null ? [] : (extraByMeasure.get(measureId) ?? []);
    if (extra.length === 0) {
      return recommendation;
    }
    return {
      ...recommendation,
      linkedFindingRefs: uniqueStrings([...recommendation.linkedFindingRefs, ...extra])
    };
  });
}

export function recommendationMeasureId(
  recommendation: NormalizedRecommendation
): string | null {
  const fromKey = /(?:^recommendation:|\{)(\d+)\}?$/i.exec(recommendation.sourceKey);
  if (fromKey?.[1] !== undefined) {
    return fromKey[1];
  }
  const excerpt = recommendation.evidence
    .map((item) => item.sourceExcerpt ?? "")
    .join(" ");
  return firstGroup(/Ma[sß]nahmenempfehlung\s*\{\s*(\d+)\s*\}/i, excerpt);
}

function assignedFindingRefs(body: string): string[] {
  const assignedSection =
    /Zugeordnete Sch[äa]den:\s*([\s\S]*?)(?=Ma[sß]nahmenempfehlung\s*\{|Art der Leistung|$)/i.exec(
      body
    );
  const target = assignedSection?.[1] ?? body;
  return uniqueStrings(
    [...target.matchAll(/\[(\d+)\]/g)].flatMap((item) =>
      item[1] === undefined ? [] : [item[1]]
    )
  );
}

function inferInspectorsByDate(
  pages: readonly InferableSectionPage[]
): Map<string, { readonly name: string; readonly pageNumber: number; readonly excerpt: string }> {
  const inspectors = new Map<
    string,
    { readonly name: string; readonly pageNumber: number; readonly excerpt: string }
  >();
  for (const page of pages) {
    const pageNumber = page.pageNumber ?? 1;
    const text = page.textContent;
    for (const dateMatch of text.matchAll(/\d{1,2}\.\d{1,2}\.\d{4}/g)) {
      const dateText = dateMatch[0];
      const inspectedOn = normalizeDate(dateText);
      if (inspectedOn === null || inspectors.has(inspectedOn)) {
        continue;
      }
      const index = dateMatch.index ?? 0;
      const after = text.slice(index + dateText.length);
      const untilNextDate = after.split(/\d{1,2}\.\d{1,2}\.\d{4}/)[0] ?? after;
      const before = text.slice(Math.max(0, index - 80), index);
      const afterPrevDate = before.split(/\d{1,2}\.\d{1,2}\.\d{4}/).at(-1) ?? before;
      const inspectorMatch =
        inspectorLabelPattern.exec(untilNextDate.slice(0, 220)) ??
        inspectorLabelPattern.exec(afterPrevDate);
      const name = cleanInspectorName(inspectorMatch?.[1] ?? null);
      if (name === null) {
        continue;
      }
      inspectors.set(inspectedOn, {
        name,
        pageNumber,
        excerpt: collapseWhitespace(`${dateText} Prüfer: ${name}`).slice(0, 400)
      });
    }
  }
  return inspectors;
}

function cleanInspectorName(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const cut = value.split(
    /\s{2,}|\s+(?:Hauptprüfung|Einfache Prüfung|Sonderprüfung|Zustandsnote|Version|Seite)\b/i
  )[0];
  const name = collapseWhitespace(cut ?? value)
    .replace(/[.,;:\s]+$/g, "")
    .trim();
  if (name.length < 2 || name.length > 80 || /^\d/.test(name)) {
    return null;
  }
  return name;
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function inferFindingDescription(
  pageText: string,
  match: RegExpMatchArray
): string | null {
  const trailing = collapseWhitespace(match[6] ?? "")
    .replace(/^BSP-ID\s+[0-9-]+\s*/i, "")
    .trim();
  if (trailing.length >= 12 && !/^S\s*=/.test(trailing)) {
    return trailing.slice(0, 400);
  }
  const start = (match.index ?? 0) + match[0].length;
  const following = pageText.slice(start, start + 400);
  const untilNext = following.split(/\[\d+\]\s*S\s*=/)[0] ?? "";
  const cleaned = collapseWhitespace(untilNext)
    .replace(/Version\s+\d.*$/i, "")
    .replace(/Seite\s+[\d.]+$/i, "")
    .trim();
  if (cleaned.length < 8) {
    return trailing.length > 0 ? trailing : null;
  }
  return cleaned.slice(0, 400);
}

function parseDashedNumber(value: string | null): string | null {
  if (value === null || value === "--") {
    return null;
  }
  return normalizeDecimal(value);
}

function firstGroup(pattern: RegExp, text: string): string | null {
  const match = pattern.exec(text);
  const value = match?.[1] ?? match?.[0];
  return normalizeNullableString(value ?? null);
}

function sourceEvidence(pageNumber: number, excerpt: string): ExtractedEvidence {
  return {
    boundingBox: null,
    confidence: 1,
    derivationMethod: null,
    kind: "SOURCE_FACT",
    pageNumber,
    sourceExcerpt: excerpt.length > 0 ? excerpt : "Abschnitt 7"
  };
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
