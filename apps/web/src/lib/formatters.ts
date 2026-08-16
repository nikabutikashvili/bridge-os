const locale = "de-DE";
const missingValue = "Not recorded";

type NumericValue = number | string;

export function formatGermanDate(
  value: Date | string | null | undefined
): string {
  if (value === null || value === undefined) {
    return missingValue;
  }

  const date = parseDate(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Cannot format invalid date: ${String(value)}`);
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric"
  }).format(date);
}

export function formatMeasurement(
  value: NumericValue | null | undefined,
  unit: string,
  maximumFractionDigits = 3
): string {
  if (value === null || value === undefined) {
    return missingValue;
  }

  return `${formatNumber(value, maximumFractionDigits)} ${unit}`;
}

export function formatConditionScore(
  value: NumericValue | null | undefined
): string {
  if (value === null || value === undefined) {
    return missingValue;
  }

  return formatNumber(value, 1, 1);
}

export function formatCurrency(
  value: NumericValue | null | undefined,
  currency = "EUR"
): string {
  if (value === null || value === undefined) {
    return missingValue;
  }

  return new Intl.NumberFormat(locale, {
    currency,
    currencyDisplay: "symbol",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(toFiniteNumber(value));
}

export function formatPercentage(
  value: NumericValue | null | undefined,
  maximumFractionDigits = 1
): string {
  if (value === null || value === undefined) {
    return missingValue;
  }

  return `${formatNumber(value, maximumFractionDigits)} %`;
}

function formatNumber(
  value: NumericValue,
  maximumFractionDigits: number,
  minimumFractionDigits = 0
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits
  }).format(toFiniteNumber(value));
}

function toFiniteNumber(value: NumericValue): number {
  if (typeof value === "string" && value.trim().length === 0) {
    throw new RangeError("Cannot format an empty numeric value.");
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new RangeError(`Cannot format non-numeric value: ${String(value)}`);
  }

  return numericValue;
}

function parseDate(value: Date | string): Date {
  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const date = new Date(Date.UTC(year, month - 1, day));

      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        throw new RangeError(`Cannot format invalid date: ${value}`);
      }

      return date;
    }
  }

  return new Date(value);
}
