import {
  WMM_COEFFICIENTS,
  WMM_EPOCH,
  WMM_MAX_DEGREE,
  WMM_VALID_FROM,
  WMM_VALID_TO,
} from "@/utils/wmm/wmm2025Coefficients";

export type GeomagneticField = {
  x: number;
  y: number;
  z: number;
  h: number;
  f: number;
  declinationDeg: number;
  inclinationDeg: number;
};

const MAXORD = WMM_MAX_DEGREE;
const STRIDE = MAXORD + 1;
const DEG = Math.PI / 180;

// WGS-84 (km) and geomagnetic reference radius.
const A = 6378.137;
const B = 6356.7523142;
const RE = 6371.2;
const A2 = A * A;
const B2 = B * B;
const C2 = A2 - B2;
const A4 = A2 * A2;
const B4 = B2 * B2;
const C4 = A4 - B4;

const makeMatrix = (): number[][] =>
  Array.from({ length: STRIDE }, () => new Array<number>(STRIDE).fill(0));

// Schmidt-normalized Gauss coefficients and Legendre recursion constants,
// packed as c[m][n] = gₙᵐ and c[n][m-1] = hₙᵐ; built once at module load.
const c = makeMatrix();
const cd = makeMatrix();
const k = makeMatrix();
const fn = new Array<number>(STRIDE).fill(0);
const fm = new Array<number>(STRIDE).fill(0);
const snorm = new Array<number>(STRIDE * STRIDE).fill(0);

for (const { n, m, g, h, gDot, hDot } of WMM_COEFFICIENTS) {
  c[m][n] = g;
  cd[m][n] = gDot;
  if (m !== 0) {
    c[n][m - 1] = h;
    cd[n][m - 1] = hDot;
  }
}

snorm[0] = 1;
for (let n = 1; n <= MAXORD; n++) {
  snorm[n] = (snorm[n - 1] * (2 * n - 1)) / n;
  let j = 2;
  for (let m = 0; m <= n; m++) {
    k[m][n] = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
    if (m > 0) {
      const flnmj = ((n - m + 1) * j) / (n + m);
      snorm[n + m * STRIDE] = snorm[n + (m - 1) * STRIDE] * Math.sqrt(flnmj);
      j = 1;
      c[n][m - 1] = snorm[n + m * STRIDE] * c[n][m - 1];
      cd[n][m - 1] = snorm[n + m * STRIDE] * cd[n][m - 1];
    }
    c[m][n] = snorm[n + m * STRIDE] * c[m][n];
    cd[m][n] = snorm[n + m * STRIDE] * cd[m][n];
  }
  fn[n] = n + 1;
  fm[n] = n;
}
k[1][1] = 0;

export const computeGeomagneticField = (
  latitudeDeg: number,
  longitudeDeg: number,
  altitudeKm: number,
  decimalYear: number
): GeomagneticField | null => {
  if (![latitudeDeg, longitudeDeg, altitudeKm, decimalYear].every(Number.isFinite)) {
    return null;
  }
  if (decimalYear < WMM_VALID_FROM || decimalYear > WMM_VALID_TO) {
    return null;
  }

  const dt = decimalYear - WMM_EPOCH;
  const alt = altitudeKm;
  const rlon = longitudeDeg * DEG;
  const rlat = latitudeDeg * DEG;
  const srlon = Math.sin(rlon);
  const srlat = Math.sin(rlat);
  const crlon = Math.cos(rlon);
  const crlat = Math.cos(rlat);
  const srlat2 = srlat * srlat;
  const crlat2 = crlat * crlat;

  const sp = new Array<number>(STRIDE).fill(0);
  const cp = new Array<number>(STRIDE).fill(0);
  const pp = new Array<number>(STRIDE).fill(0);
  const p = makeMatrix();
  const dp = makeMatrix();
  cp[0] = 1;
  p[0][0] = 1;
  pp[0] = 1;
  sp[1] = srlon;
  cp[1] = crlon;

  // Geodetic → geocentric spherical.
  const q = Math.sqrt(A2 - C2 * srlat2);
  const q1 = alt * q;
  const q2 = ((q1 + A2) / (q1 + B2)) * ((q1 + A2) / (q1 + B2));
  const ct = srlat / Math.sqrt(q2 * crlat2 + srlat2);
  const st = Math.sqrt(1 - ct * ct);
  const r = Math.sqrt(alt * alt + 2 * q1 + (A4 - C4 * srlat2) / (q * q));
  const d = Math.sqrt(A2 * crlat2 + B2 * srlat2);
  const ca = (alt + d) / r;
  const sa = (C2 * crlat * srlat) / (r * d);

  for (let m = 2; m <= MAXORD; m++) {
    sp[m] = sp[1] * cp[m - 1] + cp[1] * sp[m - 1];
    cp[m] = cp[1] * cp[m - 1] - sp[1] * sp[m - 1];
  }

  const aor = RE / r;
  let ar = aor * aor;
  let br = 0;
  let bt = 0;
  let bp = 0;
  let bpp = 0;

  for (let n = 1; n <= MAXORD; n++) {
    ar = ar * aor;
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        p[m][n] = st * p[m - 1][n - 1];
        dp[m][n] = st * dp[m - 1][n - 1] + ct * p[m - 1][n - 1];
      } else if (n === 1 && m === 0) {
        p[m][n] = ct * p[m][n - 1];
        dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1];
      } else if (n > 1 && n !== m) {
        if (m > n - 2) {
          p[m][n - 2] = 0;
          dp[m][n - 2] = 0;
        }
        p[m][n] = ct * p[m][n - 1] - k[m][n] * p[m][n - 2];
        dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1] - k[m][n] * dp[m][n - 2];
      }

      const tcmn = c[m][n] + dt * cd[m][n];
      let temp1: number;
      let temp2: number;
      if (m === 0) {
        temp1 = tcmn * cp[m];
        temp2 = tcmn * sp[m];
      } else {
        const tcnm = c[n][m - 1] + dt * cd[n][m - 1];
        temp1 = tcmn * cp[m] + tcnm * sp[m];
        temp2 = tcmn * sp[m] - tcnm * cp[m];
      }

      const par = ar * p[m][n];
      bt = bt - ar * temp1 * dp[m][n];
      bp += fm[m] * temp2 * par;
      br += fn[n] * temp1 * par;

      // Longitudinal term is 0/0 at the geographic poles; L'Hôpital via pp.
      if (st === 0 && m === 1) {
        pp[n] = n === 1 ? pp[n - 1] : ct * pp[n - 1] - k[m][n] * pp[n - 2];
        bpp += fm[m] * temp2 * ar * pp[n];
      }
    }
  }

  bp = st === 0 ? bpp : bp / st;

  // Rotate geocentric → geodetic.
  const x = -bt * ca - br * sa;
  const y = bp;
  const z = bt * sa - br * ca;

  const h = Math.hypot(x, y);
  const f = Math.hypot(h, z);

  return {
    x,
    y,
    z,
    h,
    f,
    declinationDeg: Math.atan2(y, x) / DEG,
    inclinationDeg: Math.atan2(z, h) / DEG,
  };
};

export const toDecimalYear = (date: Date): number => {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const nextStart = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (nextStart - start);
};

export const getMagneticDeclination = (
  latitudeDeg: number,
  longitudeDeg: number,
  altitudeMeters: number | null,
  date: Date
): number | null => {
  if (!Number.isFinite(latitudeDeg) || !Number.isFinite(longitudeDeg)) {
    return null;
  }
  const altKm = (altitudeMeters ?? 0) / 1000;
  const field = computeGeomagneticField(latitudeDeg, longitudeDeg, altKm, toDecimalYear(date));
  return field ? field.declinationDeg : null;
};
