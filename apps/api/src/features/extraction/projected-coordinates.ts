const WGS84_A = 6_378_137;
const WGS84_F = 1 / 298.257_223_563;
const BESSEL_A = 6_377_397.155;
const BESSEL_F = 1 / 299.152_812_8;
const UTM_SCALE = 0.9996;
const DEG = Math.PI / 180;
const ARCSEC = Math.PI / 648_000;

export interface GeographicCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}

export function utmToWgs84(
  easting: number,
  northing: number,
  zone: number
): GeographicCoordinate | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing) || zone < 1 || zone > 60) {
    return null;
  }
  return inverseTransverseMercator({
    a: WGS84_A,
    easting,
    f: WGS84_F,
    falseEasting: 500_000,
    falseNorthing: 0,
    k0: UTM_SCALE,
    longitudeOriginDeg: zone * 6 - 183,
    northing
  });
}

export function gaussKruegerDhdnToWgs84(
  easting: number,
  northing: number,
  zone: number
): GeographicCoordinate | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing) || zone < 2 || zone > 5) {
    return null;
  }
  const bessel = inverseTransverseMercator({
    a: BESSEL_A,
    easting,
    f: BESSEL_F,
    falseEasting: zone * 1_000_000 + 500_000,
    falseNorthing: 0,
    k0: 1,
    longitudeOriginDeg: zone * 3,
    northing
  });
  if (bessel === null) {
    return null;
  }
  return helmertDhdnToWgs84(bessel);
}

function inverseTransverseMercator(params: {
  readonly a: number;
  readonly easting: number;
  readonly f: number;
  readonly falseEasting: number;
  readonly falseNorthing: number;
  readonly k0: number;
  readonly longitudeOriginDeg: number;
  readonly northing: number;
}): GeographicCoordinate | null {
  const { a, f, k0 } = params;
  const e2 = f * (2 - f);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = params.easting - params.falseEasting;
  const y = params.northing - params.falseNorthing;
  const m = y / k0;
  const mu =
    m /
    (a *
      (1 -
        e2 / 4 -
        (3 * e2 ** 2) / 64 -
        (5 * e2 ** 3) / 256));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const ePrime2 = e2 / (1 - e2);
  const n1 = a / Math.sqrt(1 - e2 * sinPhi1 * sinPhi1);
  const t1 = tanPhi1 * tanPhi1;
  const c1 = ePrime2 * cosPhi1 * cosPhi1;
  const r1 = (a * (1 - e2)) / (1 - e2 * sinPhi1 * sinPhi1) ** 1.5;
  const d = x / (n1 * k0);
  const latitude =
    phi1 -
    ((n1 * tanPhi1) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ePrime2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ePrime2 - 3 * c1 ** 2) *
          d ** 6) /
          720);
  const longitude =
    params.longitudeOriginDeg * DEG +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ePrime2 + 24 * t1 ** 2) *
        d ** 5) /
        120) /
      cosPhi1;
  const latitudeDeg = latitude / DEG;
  const longitudeDeg = longitude / DEG;
  if (
    !Number.isFinite(latitudeDeg) ||
    !Number.isFinite(longitudeDeg) ||
    Math.abs(latitudeDeg) > 90 ||
    Math.abs(longitudeDeg) > 180
  ) {
    return null;
  }
  return { latitude: latitudeDeg, longitude: longitudeDeg };
}

function helmertDhdnToWgs84(
  coordinate: GeographicCoordinate
): GeographicCoordinate | null {
  const ecef = geodeticToEcef(coordinate, BESSEL_A, BESSEL_F);
  const rx = 0.202 * ARCSEC;
  const ry = 0.045 * ARCSEC;
  const rz = -2.455 * ARCSEC;
  const scale = 1 + 6.7e-6;
  const transformed = {
    x: 598.1 + scale * (ecef.x - rz * ecef.y + ry * ecef.z),
    y: 73.7 + scale * (rz * ecef.x + ecef.y - rx * ecef.z),
    z: 418.2 + scale * (-ry * ecef.x + rx * ecef.y + ecef.z)
  };
  return ecefToGeodetic(transformed, WGS84_A, WGS84_F);
}

function geodeticToEcef(
  coordinate: GeographicCoordinate,
  a: number,
  f: number
): { x: number; y: number; z: number } {
  const e2 = f * (2 - f);
  const phi = coordinate.latitude * DEG;
  const lambda = coordinate.longitude * DEG;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const n = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  return {
    x: n * cosPhi * Math.cos(lambda),
    y: n * cosPhi * Math.sin(lambda),
    z: n * (1 - e2) * sinPhi
  };
}

function ecefToGeodetic(
  point: { readonly x: number; readonly y: number; readonly z: number },
  a: number,
  f: number
): GeographicCoordinate | null {
  const e2 = f * (2 - f);
  const longitude = Math.atan2(point.y, point.x);
  const p = Math.hypot(point.x, point.y);
  let phi = Math.atan2(point.z, p * (1 - e2));
  for (let step = 0; step < 8; step += 1) {
    const sinPhi = Math.sin(phi);
    const n = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
    const next = Math.atan2(point.z + e2 * n * sinPhi, p);
    if (Math.abs(next - phi) < 1e-12) {
      phi = next;
      break;
    }
    phi = next;
  }
  const latitudeDeg = phi / DEG;
  const longitudeDeg = longitude / DEG;
  if (
    !Number.isFinite(latitudeDeg) ||
    !Number.isFinite(longitudeDeg) ||
    Math.abs(latitudeDeg) > 90 ||
    Math.abs(longitudeDeg) > 180
  ) {
    return null;
  }
  return { latitude: latitudeDeg, longitude: longitudeDeg };
}
