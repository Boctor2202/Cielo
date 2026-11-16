/** Civil aviation authorities that issue pilot licences and medicals, for the "Authority" fields. */
export interface Authority {
  /** what is stored and shown, e.g. "DGAC France" */
  label: string;
  name: string;
  /** ISO 3166-1 alpha-2, "EU" for EASA */
  country: string;
  /** other names searched (acronyms in other languages) */
  aka?: string[];
}

export const AUTHORITIES: Authority[] = [
  { label: "EASA", name: "European Union Aviation Safety Agency", country: "EU" },
  { label: "DGAC France", name: "Direction générale de l'Aviation civile", country: "FR", aka: ["DGAC", "DSAC"] },
  { label: "UK CAA", name: "Civil Aviation Authority", country: "GB", aka: ["CAA"] },
  { label: "FAA", name: "Federal Aviation Administration", country: "US" },
  { label: "FOCA", name: "Federal Office of Civil Aviation (OFAC / BAZL)", country: "CH", aka: ["OFAC", "BAZL", "UFAC"] },
  { label: "LBA", name: "Luftfahrt-Bundesamt", country: "DE" },
  { label: "ENAC", name: "Ente Nazionale per l'Aviazione Civile", country: "IT" },
  { label: "AESA", name: "Agencia Estatal de Seguridad Aérea", country: "ES" },
  { label: "ANAC Portugal", name: "Autoridade Nacional da Aviação Civil", country: "PT", aka: ["ANAC"] },
  { label: "ILT", name: "Inspectie Leefomgeving en Transport", country: "NL" },
  { label: "BCAA", name: "Belgian Civil Aviation Authority (DGTA / DGLV)", country: "BE", aka: ["DGTA", "DGLV"] },
  { label: "DAC Luxembourg", name: "Direction de l'Aviation Civile", country: "LU" },
  { label: "DAC Monaco", name: "Direction de l'Aviation Civile de Monaco", country: "MC" },
  { label: "Austro Control", name: "Austro Control GmbH", country: "AT" },
  { label: "IAA", name: "Irish Aviation Authority", country: "IE" },
  { label: "Transportstyrelsen", name: "Swedish Transport Agency", country: "SE" },
  { label: "Luftfartstilsynet", name: "Civil Aviation Authority Norway", country: "NO" },
  { label: "Trafikstyrelsen", name: "Danish Civil Aviation and Railway Authority", country: "DK" },
  { label: "Traficom", name: "Finnish Transport and Communications Agency", country: "FI" },
  { label: "Samgöngustofa", name: "Icelandic Transport Authority (ICETRA)", country: "IS", aka: ["ICETRA"] },
  { label: "ULC", name: "Urząd Lotnictwa Cywilnego", country: "PL" },
  { label: "ÚCL", name: "Úřad pro civilní letectví", country: "CZ", aka: ["UCL", "CAA CZ"] },
  { label: "HCAA", name: "Hellenic Civil Aviation Authority", country: "GR" },
  { label: "Transport Malta", name: "Civil Aviation Directorate", country: "MT" },
  { label: "DCA Cyprus", name: "Department of Civil Aviation", country: "CY" },
  { label: "AACR", name: "Autoritatea Aeronautică Civilă Română", country: "RO" },
  { label: "CCAA", name: "Croatian Civil Aviation Agency", country: "HR" },
  { label: "SHGM", name: "Sivil Havacılık Genel Müdürlüğü", country: "TR", aka: ["DGCA Turkey"] },
  { label: "CAAI", name: "Civil Aviation Authority of Israel", country: "IL" },
  { label: "Transport Canada", name: "Transport Canada Civil Aviation", country: "CA", aka: ["TCCA"] },
  { label: "CASA", name: "Civil Aviation Safety Authority", country: "AU" },
  { label: "CAA NZ", name: "Civil Aviation Authority of New Zealand", country: "NZ" },
  { label: "GCAA", name: "General Civil Aviation Authority", country: "AE" },
  { label: "GACA", name: "General Authority of Civil Aviation", country: "SA" },
  { label: "QCAA", name: "Qatar Civil Aviation Authority", country: "QA" },
  { label: "DGCA India", name: "Directorate General of Civil Aviation", country: "IN", aka: ["DGCA"] },
  { label: "CAAC", name: "Civil Aviation Administration of China", country: "CN" },
  { label: "JCAB", name: "Japan Civil Aviation Bureau", country: "JP" },
  { label: "CAAS", name: "Civil Aviation Authority of Singapore", country: "SG" },
  { label: "CAD Hong Kong", name: "Civil Aviation Department", country: "HK" },
  { label: "ANAC Brasil", name: "Agência Nacional de Aviação Civil", country: "BR" },
  { label: "SACAA", name: "South African Civil Aviation Authority", country: "ZA" },
  { label: "DGAC Maroc", name: "Direction générale de l'Aviation civile", country: "MA" },
  { label: "OACA", name: "Office de l'Aviation Civile et des Aéroports", country: "TN" },
  { label: "ECAA", name: "Egyptian Civil Aviation Authority", country: "EG" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Authorities matching a query on acronym, name or country code; exact acronym first. */
export function searchAuthorities(query: string, limit = 8): Authority[] {
  const q = norm(query.trim());
  if (!q) return AUTHORITIES.slice(0, limit);
  const score = (a: Authority) => {
    const keys = [a.label, ...(a.aka ?? [])].map(norm);
    if (keys.some((k) => k === q)) return 0;
    if (keys.some((k) => k.startsWith(q))) return 1;
    if (norm(a.country) === q) return 2;
    if (keys.some((k) => k.includes(q)) || norm(a.name).includes(q)) return 3;
    return 9;
  };
  return AUTHORITIES.map((a) => ({ a, s: score(a) }))
    .filter((x) => x.s < 9)
    .sort((x, y) => x.s - y.s)
    .slice(0, limit)
    .map((x) => x.a);
}
