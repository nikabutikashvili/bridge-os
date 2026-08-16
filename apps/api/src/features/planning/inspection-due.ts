import type { InspectionDueStatus } from "@bridge-os/contracts";

interface InspectionCycle {
  readonly cycleMonths: number | null;
  readonly inspectedOn: string | null;
}

export function deriveInspectionDueStatus(
  latest: InspectionCycle | undefined,
  asOf: string
): InspectionDueStatus {
  if (latest?.inspectedOn == null || latest.cycleMonths === null) {
    return "UNKNOWN";
  }
  const dueOn = addCalendarMonths(latest.inspectedOn, latest.cycleMonths);
  if (dueOn < asOf) {
    return "OVERDUE";
  }
  return dueOn <= addDays(asOf, 180) ? "DUE_SOON" : "CURRENT";
}

function addCalendarMonths(value: string, months: number): string {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`Invalid inspection date: ${value}`);
  }
  const targetMonthStart = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = targetMonthStart.getUTCFullYear();
  const targetMonth = targetMonthStart.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const result = new Date(
    Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))
  );
  return result.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
