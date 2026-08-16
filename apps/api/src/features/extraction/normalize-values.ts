export type RawNumber = number | string;

export function normalizeNullableString(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length === 0 ? null : normalized;
}

export function normalizeDecimal(
  value: RawNumber | null,
  options: { readonly allowNegative?: boolean } = {}
): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    if (!options.allowNegative && value < 0) {
      return null;
    }
    return String(value);
  }

  let normalized = stripTrailingUnit(value.replace(/[\s']/g, "").trim());
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized =
      normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
        ? normalized.replaceAll(".", "").replace(",", ".")
        : normalized.replaceAll(",", "");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replaceAll(".", "");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const pattern = options.allowNegative
    ? /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/
    : /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
  return pattern.test(normalized) ? normalized : null;
}

export function normalizeInteger(value: RawNumber | null): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  const compact = stripTrailingUnit(value.replace(/[\s']/g, "").trim());
  const normalized = /^\d{1,3}(?:[.,]\d{3})+$/.test(compact)
    ? compact.replace(/[.,]/g, "")
    : compact;
  if (!/^-?(?:0|[1-9]\d*)$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function normalizeDate(value: string | null): string | null {
  const text = normalizeNullableString(value);
  if (text === null) {
    return null;
  }
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (german !== null) {
    const [, day, month, year] = german;
    if (day === undefined || month === undefined || year === undefined) {
      return null;
    }
    return assertIsoDate(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    );
  }
  return assertIsoDate(text);
}

export function normalizeCurrency(value: string | null): string | null {
  const text = normalizeNullableString(value);
  if (text === null) {
    return null;
  }
  const compact = text.replace(/[.\s]/g, "").toUpperCase();
  if (
    compact === "\u20ac" ||
    compact === "EUR" ||
    compact === "EURO" ||
    compact === "EUROS"
  ) {
    return "EUR";
  }
  return /^[A-Z]{3}$/.test(compact) ? compact : null;
}

export function normalizeUnit(value: string | null): string | null {
  const text = normalizeNullableString(value);
  if (text === null) {
    return null;
  }
  const key = text.toLocaleLowerCase("de-DE").replace(/\s+/g, "");
  const aliases: Readonly<Record<string, string>> = {
    laufendemeter: "m",
    laufendermeter: "m",
    lfdm: "m",
    "lfdm-d-": "m",
    "lfdm-a-": "m",
    lfm: "m",
    m: "m",
    meter: "m",
    cm: "cm",
    mm: "mm",
    m2: "m2",
    "m\u00b2": "m2",
    qm: "m2",
    dm2: "dm2",
    stk: "Stk",
    stueck: "Stk",
    "st\u00fcck": "Stk"
  };
  return aliases[key] ?? text;
}

export function inferUnitFromText(value: string | null): string | null {
  const text = normalizeNullableString(value);
  if (text === null) {
    return null;
  }
  const lower = text.toLocaleLowerCase("de-DE");
  if (/m\s*[²2]|qm|instandsetzungsfl[äa]che/.test(lower)) {
    return "m2";
  }
  if (/m\s*[³3]/.test(lower)) {
    return "m3";
  }
  if (/lfd\s*m|laufende[mn]?\s*meter|\blfdm\b|\blfm\b/.test(lower)) {
    return "m";
  }
  if (/st[üu]ck|\bstk\b|\bstck\b|\bst\.\b/.test(lower)) {
    return "Stk";
  }
  if (/psch|pauschal/.test(lower)) {
    return "pauschal";
  }
  if (/\bcm\b/.test(lower)) {
    return "cm";
  }
  if (/\bmm\b/.test(lower)) {
    return "mm";
  }
  if (/\bm\b/.test(lower)) {
    return "m";
  }
  return null;
}

export function normalizeUrgency(value: string | null): string | null {
  const text = normalizeNullableString(value);
  if (text === null) {
    return null;
  }
  const compact = text.toLocaleLowerCase("de-DE").replace(/[\s_\-./]+/g, "");
  if (compact.includes("sofort")) {
    return "SOFORT";
  }
  if (compact.includes("kurzfrist")) {
    return "KURZFRISTIG";
  }
  if (compact.includes("mittelfrist")) {
    return "MITTELFRISTIG";
  }
  if (compact.includes("langfrist")) {
    return "LANGFRISTIG";
  }
  const upper = text.toUpperCase();
  if (
    upper === "SOFORT" ||
    upper === "KURZFRISTIG" ||
    upper === "MITTELFRISTIG" ||
    upper === "LANGFRISTIG"
  ) {
    return upper;
  }
  return text;
}

export function normalizeSvdRating(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 && value <= 4 ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 4 ? parsed : null;
  }
  return null;
}

export function normalizeInspectionType(
  value: unknown
): "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null {
  if (
    value === "MAIN" ||
    value === "SIMPLE" ||
    value === "SPECIAL" ||
    value === "OTHER"
  ) {
    return value;
  }
  const text = typeof value === "string" ? value.toLocaleLowerCase("de-DE") : "";
  if (text.length === 0) {
    return null;
  }
  if (text.includes("haupt")) {
    return "MAIN";
  }
  if (text.includes("einfach")) {
    return "SIMPLE";
  }
  if (text.includes("sonder")) {
    return "SPECIAL";
  }
  return null;
}

export function normalizeFindingStatus(
  value: unknown
): "OPEN" | "MONITORING" | "RESOLVED" | "DISMISSED" | null {
  if (
    value === "OPEN" ||
    value === "MONITORING" ||
    value === "RESOLVED" ||
    value === "DISMISSED"
  ) {
    return value;
  }
  const text = typeof value === "string" ? value.toLocaleLowerCase("de-DE") : "";
  if (text.length === 0) {
    return null;
  }
  if (/offen|open/.test(text)) {
    return "OPEN";
  }
  if (/monitor|beobacht|überwach|ueberwach/.test(text)) {
    return "MONITORING";
  }
  if (/behoben|erledigt|resolved|geschlossen/.test(text)) {
    return "RESOLVED";
  }
  if (/verworfen|dismissed|gegenstandslos/.test(text)) {
    return "DISMISSED";
  }
  return null;
}

export function normalizeRecommendationStatus(
  value: unknown
):
  | "OPEN"
  | "APPROVED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | null {
  if (
    value === "OPEN" ||
    value === "APPROVED" ||
    value === "SCHEDULED" ||
    value === "IN_PROGRESS" ||
    value === "COMPLETED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  const text = typeof value === "string" ? value.toLocaleLowerCase("de-DE") : "";
  if (text.length === 0) {
    return null;
  }
  if (/offen|open/.test(text)) {
    return "OPEN";
  }
  if (/genehmigt|approved/.test(text)) {
    return "APPROVED";
  }
  if (/geplant|scheduled/.test(text)) {
    return "SCHEDULED";
  }
  if (/in\s*arbeit|in_progress|laufend/.test(text)) {
    return "IN_PROGRESS";
  }
  if (/abgeschlossen|completed|erledigt/.test(text)) {
    return "COMPLETED";
  }
  if (/storniert|cancelled|abgebrochen/.test(text)) {
    return "CANCELLED";
  }
  return null;
}

function stripTrailingUnit(value: string): string {
  return value.replace(
    /(?:m\u00b2|m2|qm|stk|stueck|st\u00fcck|euro|eur|€|m|%)$/i,
    ""
  );
}

function assertIsoDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return value;
}
