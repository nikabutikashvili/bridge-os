import type { InflationAdjustedEstimate } from "@bridge-os/contracts";

import {
  BAUPREISINDEX_NRW_BASE_YEAR,
  BAUPREISINDEX_NRW_STRASSENBAU,
  BAUPREISINDEX_NRW_STRASSENBAU_NAME
} from "./baupreisindex-nrw.js";
import { money, toMinorUnits } from "./calculations.js";

const indexedYears = Object.keys(BAUPREISINDEX_NRW_STRASSENBAU).map(Number);
const earliestIndexedYear = Math.min(...indexedYears);
const latestIndexedYear = Math.max(...indexedYears);

export interface InflationAdjustmentInput {
  readonly amount: string;
  readonly currency: string;
  readonly sourceYear: number;
  readonly asOfYear: number;
}

/**
 * Projects a historical cost estimate onto a later year using the NRW road
 * construction price index. Returns null when there is nothing meaningful to
 * show (the estimate is already dated at or after asOfYear).
 *
 * Years outside the indexed range are clamped to the nearest known year and
 * flagged as `extrapolated` so callers can make that visible rather than
 * imply precision the index table doesn't have.
 */
export function adjustForConstructionPriceInflation(
  input: InflationAdjustmentInput
): InflationAdjustedEstimate | null {
  const sourceYear = clamp(input.sourceYear, earliestIndexedYear, latestIndexedYear);
  const asOfYear = clamp(input.asOfYear, earliestIndexedYear, latestIndexedYear);
  if (sourceYear >= asOfYear) {
    return null;
  }

  const sourceIndex = BAUPREISINDEX_NRW_STRASSENBAU[sourceYear];
  const targetIndex = BAUPREISINDEX_NRW_STRASSENBAU[asOfYear];
  if (sourceIndex === undefined || targetIndex === undefined) {
    return null;
  }

  // Index values carry one decimal place; scale to tenths so the whole
  // computation stays in integer (bigint) arithmetic, matching the
  // minor-units approach used elsewhere for money.
  const sourceIndexTenths = BigInt(Math.round(sourceIndex * 10));
  const targetIndexTenths = BigInt(Math.round(targetIndex * 10));
  const sourceMinorUnits = toMinorUnits(input.amount);
  const adjustedMinorUnits =
    (sourceMinorUnits * targetIndexTenths + sourceIndexTenths / 2n) / sourceIndexTenths;

  return {
    amount: money(adjustedMinorUnits, input.currency).amount,
    currency: input.currency,
    sourceYear,
    asOfYear,
    indexName: BAUPREISINDEX_NRW_STRASSENBAU_NAME,
    indexBaseYear: BAUPREISINDEX_NRW_BASE_YEAR,
    extrapolated: sourceYear !== input.sourceYear || asOfYear !== input.asOfYear
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
