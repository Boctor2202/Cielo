const REG_PREFIX_2 = ["EC", "OO", "PH", "HB", "OE", "LX", "CS", "EI", "SE", "OY", "LN", "OH", "SP", "OK", "OM", "HA", "YR", "LZ", "SX", "TC", "9H", "5B", "VH", "ZK", "ZS", "VT", "JA", "HL", "VP", "VQ", "A6", "A7", "9V", "CN", "TF", "ES", "YL", "LY", "UR", "S5", "9A", "4X"];
/** "FHAEC" -> "F-HAEC", "phabc" -> "PH-ABC"; US (N…) and already hyphenated registrations unchanged. */
export function normalizeRegistration(raw?: string): string | undefined {
  const r = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!r) return undefined;
  if (r.includes("-") || /^N\d/.test(r)) return r;
  const two = REG_PREFIX_2.find((p) => r.startsWith(p) && r.length - p.length >= 3 && r.length - p.length <= 4);
  if (two) return `${two}-${r.slice(two.length)}`;
  if (/^[FGDIC][A-Z]{4}$/.test(r)) return `${r[0]}-${r.slice(1)}`;
  return r;
}

