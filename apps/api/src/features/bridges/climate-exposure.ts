export const DAMAGE_MECHANISM_POLICY_VERSION = "damage-mechanism-v1";

export interface ClimateExposureInput {
  readonly freezeThawDays: number | null;
  readonly heavyRainDays20: number | null;
  readonly deicingDays: number | null;
  readonly maximumDurability: number | null;
}

/**
 * Portfolio/planning shortcut: climate stress only becomes an attention reason
 * when an open durability finding already exists. That keeps weather from
 * inventing urgency on an otherwise clean structure.
 */
export function hasHighEnvironmentalExposure(input: ClimateExposureInput): boolean {
  if ((input.maximumDurability ?? 0) < 2) {
    return false;
  }
  return (
    (input.freezeThawDays ?? 0) >= 40 ||
    (input.heavyRainDays20 ?? 0) >= 8 ||
    (input.deicingDays ?? 0) >= 25
  );
}
