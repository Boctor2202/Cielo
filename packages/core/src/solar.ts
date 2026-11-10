/**
 * Solar position (NOAA algorithm, accurate to ~0.01° — far better than needed
 * for the −6° civil twilight threshold).
 */

const RAD = Math.PI / 180;

/** Sun elevation in degrees above the geometric horizon at the given place and instant. */
export function sunElevation(lat: number, lon: number, when: Date | number): number {
  const ms = typeof when === "number" ? when : when.getTime();
  const jd = ms / 86_400_000 + 2440587.5;
  const t = (jd - 2451545) / 36525; // Julian centuries since J2000

  const l0 = mod(280.46646 + t * (36000.76983 + t * 0.0003032), 360);
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c =
    Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * RAD) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(appLong * RAD)) / RAD;

  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * l0 * RAD) -
      2 * e * Math.sin(m * RAD) +
      4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
      0.5 * y * y * Math.sin(4 * l0 * RAD) -
      1.25 * e * e * Math.sin(2 * m * RAD)); // minutes

  const d = new Date(ms);
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000;
  const trueSolarTime = mod(utcMinutes + eqTime + 4 * lon, 1440);
  let hourAngle = trueSolarTime / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;

  const cosZenith =
    Math.sin(lat * RAD) * Math.sin(decl * RAD) + Math.cos(lat * RAD) * Math.cos(decl * RAD) * Math.cos(hourAngle * RAD);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith))) / RAD;
  return 90 - zenith;
}

function mod(a: number, n: number) {
  return ((a % n) + n) % n;
}

/** EASA definition of night: between the end of evening and beginning of morning civil twilight (sun 6° below the horizon). */
export const CIVIL_TWILIGHT_DEG = -6;

export function isNight(lat: number, lon: number, when: Date | number): boolean {
  return sunElevation(lat, lon, when) < CIVIL_TWILIGHT_DEG;
}
