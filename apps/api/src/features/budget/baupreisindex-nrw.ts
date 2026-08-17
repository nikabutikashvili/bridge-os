export const BAUPREISINDEX_NRW_STRASSENBAU_NAME = "Baupreisindex Straßenbau NRW";

export const BAUPREISINDEX_NRW_BASE_YEAR = 2015;

/**
 * Approximate construction-price index for road building work in
 * Nordrhein-Westfalen (2015 = 100), modelled on the published shape of the
 * Destatis / IT.NRW "Preisindizes für die Bauwirtschaft" series: steady
 * pre-2015 growth, a moderate late-2010s climb, and the sharp 2021-2023
 * spike driven by material and energy costs.
 *
 * These are demo placeholder figures, not the official release. Before
 * relying on this for real budget decisions, replace the values with the
 * current series published by IT.NRW / Destatis (Fachserie 17, Reihe 4),
 * and extend the table with each year's new release.
 */
export const BAUPREISINDEX_NRW_STRASSENBAU: Readonly<Record<number, number>> = {
  2005: 78.4,
  2006: 80.1,
  2007: 84.3,
  2008: 89.0,
  2009: 89.6,
  2010: 90.5,
  2011: 93.2,
  2012: 95.8,
  2013: 97.1,
  2014: 98.3,
  2015: 100.0,
  2016: 101.9,
  2017: 105.6,
  2018: 110.8,
  2019: 116.2,
  2020: 119.4,
  2021: 128.3,
  2022: 148.7,
  2023: 162.5,
  2024: 168.9,
  2025: 172.6
};
