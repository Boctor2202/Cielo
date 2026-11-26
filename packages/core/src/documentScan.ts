import { DEFAULT_ALERT_DAYS, DOCUMENT_KINDS, lpeCode, parseLpe } from "./licenses";
import type { License, LicenseKind } from "./types";

/**
 * A licence, a rating or a medical certificate read from a photo or a PDF (by the AI reader of the server), before
 * the pilot checks it. Everything here is a proposal: nothing is saved until the pilot confirms each entry.
 */
export interface ScannedDocument {
  kind: LicenseKind;
  code: string;
  authority?: string;
  number?: string;
  issuedOn?: string;
  validUntil?: string;
  lastCheckOn?: string;
  /** medical certificate only: limitation codes as printed (VDL, VML…) */
  limitations?: string[];
}

type Draft = Omit<License, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string };

export interface ScanPlanItem {
  /** the record to save: a new one, or the existing one with the read values */
  draft: Draft;
  action: "new" | "update" | "same";
  /** the fields the reading changes on the existing record */
  changes: ("code" | "authority" | "number" | "issuedOn" | "validUntil" | "lastCheckOn" | "limitations")[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar date between 1950 and 2100, else undefined. */
const date = (s: string | undefined): string | undefined => {
  const v = s?.trim();
  if (!v || !ISO.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return undefined;
  const y = d.getUTCFullYear();
  return y >= 1950 && y <= 2100 ? v : undefined;
};
const text = (s: string | undefined, max = 80) => {
  const v = s?.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : undefined;
};

/** The title a scanned entry gets in the app, as the forms write it ("Class 1", "SEP(land)", "TR A320", "LPE English 6"). */
export function scannedCode(kind: LicenseKind, raw: string): string {
  const c = raw.replace(/\s+/g, " ").trim();
  const u = c.toUpperCase();
  if (kind === "medical") {
    if (/LAPL/.test(u)) return "LAPL medical";
    if (/(CLASS|CLASSE)?\s*(1|I)\b/.test(u) && !/\b2\b|\bII\b/.test(u)) return "Class 1";
    if (/(CLASS|CLASSE)?\s*(2|II)\b/.test(u)) return "Class 2";
    return c;
  }
  if (kind === "language") {
    const { language, level } = parseLpe(c.replace(/^(LPE|ELP|LANGUAGE PROFICIENCY)\s*:?\s*/i, ""));
    const lang = language ? language[0]!.toUpperCase() + language.slice(1).toLowerCase() : "";
    return lang ? lpeCode(lang, level) : c;
  }
  if (kind === "class_rating") {
    const m = u.match(/^(SEP|MEP|SET|TMG)\s*(?:\(?\s*(L|LAND|S|SEA)\s*\)?)?$/);
    if (m) return m[1] === "TMG" ? "TMG" : `${m[1]}(${m[2]?.startsWith("S") ? "sea" : "land"})`;
    return c;
  }
  if (kind === "type_rating" || kind === "rating") {
    if (/^TR\s/i.test(c) || /\(/.test(c)) return c.replace(/^tr\s/i, "TR ");
    const m = u.match(/^([A-Z0-9-]{2,12})(?:\s+TR)?$/);
    return m ? `TR ${m[1]}` : c;
  }
  return c;
}

/** One entry of the AI answer, checked: unknown kinds, empty titles and impossible dates are dropped. */
export function cleanScanned(d: Partial<Record<keyof ScannedDocument, unknown>>): ScannedDocument | null {
  const kind = String(d.kind ?? "") as LicenseKind;
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) return null;
  const raw = text(typeof d.code === "string" ? d.code : undefined);
  if (!raw) return null;
  const code = scannedCode(kind, raw);
  const issuedOn = date(d.issuedOn as string | undefined);
  let validUntil = date(d.validUntil as string | undefined);
  // a validity that ends before the issue date is a misread
  if (validUntil && issuedOn && validUntil < issuedOn) validUntil = undefined;
  const lims = Array.isArray(d.limitations)
    ? [...new Set((d.limitations as unknown[]).map((x) => String(x).trim().toUpperCase()).filter((x) => /^[A-Z]{2,4}$/.test(x)))]
    : [];
  return {
    kind,
    code,
    authority: text(d.authority as string | undefined),
    number: text(d.number as string | undefined, 40),
    issuedOn,
    validUntil,
    lastCheckOn: date(d.lastCheckOn as string | undefined),
    limitations: kind === "medical" && lims.length ? lims : undefined,
  };
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** The same document: same kind (the older "rating" counts as a type rating) and same title. Medical: one per class. */
const sameDoc = (a: Pick<License, "kind" | "code">, b: ScannedDocument) => {
  const k = (x: string) => (x === "rating" ? "type_rating" : x);
  if (k(a.kind) !== k(b.kind)) return false;
  if (b.kind === "language") return norm(parseLpe(a.code).language) === norm(parseLpe(b.code).language);
  return norm(a.code) === norm(b.code);
};

const LIMS = /^Limitations?: (.*)$/m;
const limsOf = (notes?: string) => notes?.match(LIMS)?.[1]?.split(/,\s*/).filter(Boolean) ?? [];
const withLims = (notes: string | undefined, lims: string[]) => {
  const rest = (notes ?? "").replace(/^Limitations?: .*$\n?/m, "").trim();
  return [lims.length ? `Limitations: ${lims.join(", ")}` : "", rest].filter(Boolean).join("\n") || undefined;
};

/**
 * What saving the read entries would do: each one is new, or updates the pilot's record of the same document
 * (only the fields read; an empty reading never erases a value), or changes nothing.
 */
export function planScan(scanned: ScannedDocument[], existing: License[]): ScanPlanItem[] {
  const alive = existing.filter((l) => !l.deletedAt);
  const used = new Set<string>();
  const out: ScanPlanItem[] = [];
  for (const s of scanned) {
    const prev = alive.find((l) => !used.has(l.id) && sameDoc(l, s));
    if (prev) used.add(prev.id);
    const lims = s.limitations ?? [];
    if (!prev) {
      out.push({
        action: "new",
        changes: [],
        draft: {
          kind: s.kind,
          code: s.code,
          authority: s.authority,
          number: s.number,
          issuedOn: s.issuedOn ?? null,
          validUntil: s.validUntil ?? null,
          lastCheckOn: s.lastCheckOn ?? null,
          alertDays: [...DEFAULT_ALERT_DAYS],
          notes: s.kind === "medical" ? withLims(undefined, lims) : undefined,
        },
      });
      continue;
    }
    const draft: Draft = { ...prev };
    const changes: ScanPlanItem["changes"] = [];
    // a language assessed again at another level: the title carries the level
    if (s.kind === "language" && parseLpe(s.code).level && s.code !== prev.code) {
      draft.code = s.code;
      changes.push("code");
      // level 6 does not expire (FCL.055)
      if ((parseLpe(s.code).level ?? 0) >= 6 && prev.validUntil) {
        draft.validUntil = null;
        changes.push("validUntil");
      }
    }
    for (const f of ["authority", "number", "issuedOn", "validUntil", "lastCheckOn"] as const) {
      const v = s[f];
      if (v && v !== (prev[f] ?? undefined) && !changes.includes(f)) {
        draft[f] = v;
        changes.push(f);
      }
    }
    if (s.kind === "medical" && lims.length && lims.join(",") !== limsOf(prev.notes).join(",")) {
      draft.notes = withLims(prev.notes, lims);
      changes.push("limitations");
    }
    out.push({ action: changes.length ? "update" : "same", changes, draft });
  }
  return out;
}
