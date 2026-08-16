import { describe, expect, it } from "vitest";

import { inferBridgeCoordinates } from "../src/features/extraction/infer-bridge-coordinates.js";
import {
  gaussKruegerDhdnToWgs84,
  utmToWgs84
} from "../src/features/extraction/projected-coordinates.js";

const bauwerksbuch2GisPage = `5.1.1 GIS-Koordinaten
            Gauß-Krüger-Koordinaten
            Bezugssystem    DE_DHDN_3GK_NW177
            Rechtswert              2593161,340
            Hochwert                5647981,550
            UTM-Koordinaten
            Bezugssystem    ETRS_UTM_NW489
            Rechtswert              5646659,710
            Hochwert                 382394,030`;

const bauwerksbuch4GisPage = `5.1.1 GIS-Koordinaten
            Gauß-Krüger-Koordinaten
            Bezugssystem    DE_DHDN_3GK_NW177
            Rechtswert              2603266,200
            Hochwert                5649706,620
            UTM-Koordinaten
            Bezugssystem    ETRS_UTM_NW489
            Rechtswert              5647971,890
            Hochwert                 392557,040`;

const bauwerksbuch5GisPage = `5.1.1 GIS-Koordinaten
            Gauß-Krüger-Koordinaten
            Bezugssystem    DE_DHDN_3GK_NW177
            Rechtswert              2596524,960
            Hochwert                5649678,030
            UTM-Koordinaten
            Bezugssystem    ETRS_UTM_NW489
            Rechtswert              5648217,445
            Hochwert                 385822,703`;

describe("utmToWgs84", () => {
  it("converts ETRS89 UTM zone 32N easting/northing used in Bauwerksbuch GIS blocks", () => {
    const coordinate = utmToWgs84(382_394.03, 5_646_659.71, 32);
    expect(coordinate).not.toBeNull();
    expect(coordinate?.latitude).toBeGreaterThan(50.9);
    expect(coordinate?.latitude).toBeLessThan(51.1);
    expect(coordinate?.longitude).toBeGreaterThan(7.1);
    expect(coordinate?.longitude).toBeLessThan(7.5);
  });
});

describe("gaussKruegerDhdnToWgs84", () => {
  it("converts DHDN Gauß-Krüger zone 2 to nearby WGS84", () => {
    const coordinate = gaussKruegerDhdnToWgs84(2_593_161.34, 5_647_981.55, 2);
    expect(coordinate).not.toBeNull();
    expect(coordinate?.latitude).toBeGreaterThan(50.9);
    expect(coordinate?.latitude).toBeLessThan(51.1);
    expect(coordinate?.longitude).toBeGreaterThan(7.1);
    expect(coordinate?.longitude).toBeLessThan(7.5);
  });
});

describe("inferBridgeCoordinates", () => {
  it("prefers the UTM GIS block and converts swapped Rechtswert/Hochwert labels", () => {
    const inferred = inferBridgeCoordinates([
      { pageNumber: 10, textContent: bauwerksbuch2GisPage }
    ]);

    expect(inferred.latitude).toMatch(/^50\.\d{6}$/);
    expect(inferred.longitude).toMatch(/^7\.\d{6}$/);
    expect(inferred.evidence).toMatchObject({
      derivationMethod: "UTM_ETRS89_TO_WGS84",
      kind: "DERIVED",
      pageNumber: 10
    });
  });

  it("converts GIS blocks from later Bauwerksbuch fixtures", () => {
    for (const textContent of [bauwerksbuch4GisPage, bauwerksbuch5GisPage]) {
      const inferred = inferBridgeCoordinates([{ pageNumber: 7, textContent }]);
      expect(inferred.latitude).toMatch(/^50\.\d{6}$/);
      expect(inferred.longitude).toMatch(/^7\.\d{6}$/);
      expect(inferred.evidence?.derivationMethod).toBe("UTM_ETRS89_TO_WGS84");
    }
  });

  it("falls back to Gauß-Krüger when UTM is absent", () => {
    const inferred = inferBridgeCoordinates([
      {
        pageNumber: 8,
        textContent: `5.1.1 GIS-Koordinaten
Gauß-Krüger-Koordinaten
Bezugssystem    DE_DHDN_3GK_NW177
Rechtswert              2593161,340
Hochwert                5647981,550`
      }
    ]);

    expect(inferred.latitude).toMatch(/^50\.\d{6}$/);
    expect(inferred.longitude).toMatch(/^7\.\d{6}$/);
    expect(inferred.evidence?.derivationMethod).toBe("GAUSS_KRUEGER_DHDN_TO_WGS84");
  });

  it("returns nulls when the document has no GIS coordinates", () => {
    expect(
      inferBridgeCoordinates([{ pageNumber: 1, textContent: "Bauwerksbuch Nummer 4405884" }])
    ).toEqual({
      evidence: null,
      latitude: null,
      longitude: null
    });
  });
});
