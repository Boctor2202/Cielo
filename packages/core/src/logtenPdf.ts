import type { LogbookLeg } from "./airFranceEp5";
import type { PdfTextItem } from "./leon";

/**
 * LogTen's "EASA-FCL Compliant" PDF logbook: the AMC1 FCL.050 layout on two facing pages, the left one with columns
 * 1-8 (date, departure, arrival, aircraft, single-pilot SE / ME, multi-pilot, total time, PIC name, takeoffs and
 * landings by day and night) and the right one with columns 9-12 (night, IFR, P1, P1 u/s, co-pilot, dual,
 * instructor, FSTD session, remarks). A flight's two halves sit on the same line of the two pages. Each page ends
 * with "TOTAL THIS PAGE", "TOTAL FROM PREVIOUS PAGES" and "TOTAL TIME", which are not flights.
 */
export interface LogTenPdf {
  legs: LogbookLeg[];
  /** the totals of the first page's "TOTAL FROM PREVIOUS PAGES" line: the logbook before this export, in minutes */
  previous?: { totalMin: number; landingsDay: number; landingsNight: number };
  /** sum of the flights read versus the "TOTAL THIS PAGE" lines: the reading checked against the document */
  checked: { pages: number; mismatches: number };
}

const HM = /^(\d{1,5}):(\d{2})$/;
const min = (s?: string) => {
  const m = s ? HM.exec(s.trim()) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
const int = (s?: string) => (s && /^\d{1,5}$/.test(s.trim()) ? Number(s.trim()) : 0);
const text = (page: PdfTextItem[]) => page.map((i) => i.s).join(" ");
const isLeft = (page: PdfTextItem[]) => /DEPARTURE/.test(text(page)) && /ARRIVAL/.test(text(page)) && /REGISTRATION/.test(text(page));
const isRight = (page: PdfTextItem[]) => /PILOT FUNCTION TIME/.test(text(page)) && /OPERATIONAL/.test(text(page));

export function isLogTenEasa(pages: PdfTextItem[][]): boolean {
  return pages.some(isLeft) && pages.some(isRight) && pages.some((p) => /TOTAL FROM PREVIOUS PAGES/.test(text(p)));
}

/** Column of an item: the header whose left edge is nearest on the left, splitting at midpoints between headers. */
function column<K extends string>(x: number, heads: [K, number][]): K | undefined {
  const sorted = [...heads].sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < sorted.length; i++) {
    const hi = i + 1 < sorted.length ? (sorted[i]![1] + sorted[i + 1]![1]) / 2 : Infinity;
    const lo = i > 0 ? (sorted[i - 1]![1] + sorted[i]![1]) / 2 : -Infinity;
    if (x >= lo && x < hi) return sorted[i]![0];
  }
  return undefined;
}

const find = (page: PdfTextItem[], s: string) => page.filter((i) => i.s.trim() === s);

type LeftCol = "date" | "depPlace" | "depTime" | "arrPlace" | "arrTime" | "model" | "reg" | "se" | "me" | "mp" | "total" | "pic" | "toD" | "toN" | "ldgD" | "ldgN";
type RightCol = "night" | "ifr" | "p1" | "p1us" | "cop" | "dual" | "instr" | "fstdDate" | "fstdType" | "fstdTime";

function leftHeads(page: PdfTextItem[]): [LeftCol, number][] | null {
  const places = find(page, "PLACE").sort((a, b) => a.x - b.x);
  const placeY = places[0]?.y;
  const times = find(page, "TIME").filter((i) => placeY !== undefined && Math.abs(i.y - placeY) <= 3).sort((a, b) => a.x - b.x);
  const date = find(page, "DATE")[0] ?? page.find((i) => /^\((dd|mm)\/(mm|dd)\/yy\)$/.test(i.s.trim()));
  const model = page.find((i) => /^MAKE, MODEL/.test(i.s.trim()));
  const reg = find(page, "REGISTRATION")[0];
  const se = find(page, "SE")[0];
  const me = find(page, "ME")[0];
  const mp = find(page, "MULTI-")[0];
  const total = find(page, "TOTAL")[0];
  const name = find(page, "NAME PIC")[0];
  // the day / night sub-columns of takeoffs and landings are written in vertical letters: "D A Y", "N I G H T"
  const takeoffs = find(page, "TAKEOFFS")[0];
  const letters = (l: string) => find(page, l).filter((i) => takeoffs && i.y < takeoffs.y && i.x > (name?.x ?? 0)).sort((a, b) => a.x - b.x);
  const d = letters("D");
  const n = letters("N");
  if (places.length < 2 || times.length < 2 || !date || !model || !reg || !se || !me || !mp || !total || !name || d.length < 2 || n.length < 2) return null;
  return [
    ["date", date.x], ["depPlace", places[0]!.x], ["depTime", times[0]!.x], ["arrPlace", places[1]!.x], ["arrTime", times[1]!.x],
    ["model", model.x], ["reg", reg.x], ["se", se.x], ["me", me.x], ["mp", mp.x], ["total", total.x], ["pic", name.x],
    ["toD", d[0]!.x], ["toN", n[0]!.x], ["ldgD", d[1]!.x], ["ldgN", n[1]!.x],
  ];
}

function rightHeads(page: PdfTextItem[]): [RightCol, number][] | null {
  const night = find(page, "NIGHT")[0];
  const ifr = find(page, "IFR")[0];
  const p1 = find(page, "P1")[0];
  const p1us = page.find((i) => /^P1\s*u\/s$/i.test(i.s.trim()));
  const cop = find(page, "CO-")[0] ?? find(page, "CO-PILOT")[0];
  const dual = find(page, "DUAL")[0];
  const instr = find(page, "INSTRUCTOR")[0];
  const fDate = find(page, "DATE")[0];
  const fType = find(page, "TYPE")[0];
  const fTime = find(page, "TOTAL TIME")[0];
  if (!night || !ifr || !p1 || !p1us || !cop || !dual || !instr) return null;
  const heads: [RightCol, number][] = [["night", night.x], ["ifr", ifr.x], ["p1", p1.x], ["p1us", p1us.x], ["cop", cop.x], ["dual", dual.x], ["instr", instr.x]];
  if (fDate) heads.push(["fstdDate", fDate.x]);
  if (fType) heads.push(["fstdType", fType.x]);
  if (fTime) heads.push(["fstdTime", fTime.x]);
  return heads;
}

export function parseLogTenEasa(pages: PdfTextItem[][]): LogTenPdf | null {
  if (!isLogTenEasa(pages)) return null;
  const out: LogTenPdf = { legs: [], checked: { pages: 0, mismatches: 0 } };
  for (let i = 0; i < pages.length; i++) {
    const left = pages[i]!;
    if (!isLeft(left)) continue;
    const right = pages.slice(i + 1).find(isRight);
    const lh = leftHeads(left);
    if (!lh) continue;
    const rh = right ? rightHeads(right) : null;
    const dayFirst = !left.some((it) => /\(mm\/dd\/yy\)/i.test(it.s));
    const dateX = lh.find((h) => h[0] === "date")![1];
    // the flights: a date at the left of the page; the line's other items lie within 4 points of it
    const dates = left.filter((it) => /^\d{2}\/\d{2}\/\d{2}$/.test(it.s.trim()) && Math.abs(it.x - dateX) < 30);
    const rightRows = right ? right.filter((it) => /\S/.test(it.s)) : [];
    const rowYs = dates.map((d) => d.y);
    let pageMin = 0;
    for (const d of dates) {
      const cells: Partial<Record<LeftCol, string>> = {};
      for (const it of left) if (Math.abs(it.y - d.y) <= 4 && it !== d) {
        const c = column(it.x, lh);
        if (c) cells[c] = cells[c] ? `${cells[c]} ${it.s.trim()}` : it.s.trim();
      }
      const rc: Partial<Record<RightCol, string>> = {};
      let remarks: string[] = [];
      if (rh) {
        for (const it of rightRows) {
          const t = it.s.trim();
          // the right page's line is the one nearest this flight's line (the two pages are not drawn at exactly the same height)
          const nearest = rowYs.reduce((best, y) => (Math.abs(y - it.y) < Math.abs(best - it.y) ? y : best), rowYs[0]!);
          if (nearest === d.y && Math.abs(it.y - d.y) <= 8 && (HM.test(t) || /^\d{2}\/\d{2}\/\d{2}$/.test(t) || column(it.x, rh) === "fstdType")) {
            const c = column(it.x, rh);
            if (c) rc[c] = t;
          }
        }
        // remarks are printed small at the top of their cell: the nearest line below them
        for (const it of rightRows) {
          const t = it.s.trim();
          if (HM.test(t) || /^[-–]+$/.test(t) || it.x < (rh.find((h) => h[0] === "fstdTime")?.[1] ?? 0) + 30) continue;
          if (/certify|SIGNATURE|REMARKS|ENDORSEMENTS|PAGE|REPORT|_{3,}/i.test(t)) continue;
          const owner = rowYs.filter((y) => y <= it.y + 1).sort((a, b) => b - a)[0];
          if (owner === d.y && it.y - d.y < 16) remarks.push(t);
        }
      }
      const [a, b, c] = d.s.trim().split("/").map(Number) as [number, number, number];
      const [dd, mm] = dayFirst ? [a, b] : [b, a];
      const date = `${2000 + c}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const total = min(cells.total);
      pageMin += total;
      const fstdMin = min(rc.fstdTime);
      const leg: LogbookLeg = {
        date,
        dep: cells.depPlace ?? "",
        arr: cells.arrPlace ?? "",
        out: cells.depTime,
        in: cells.arrTime,
        totalMin: total,
        nightMin: min(rc.night),
        ifrMin: min(rc.ifr),
        picMin: min(rc.p1),
        picusMin: min(rc.p1us),
        copilotMin: min(rc.cop),
        dualMin: min(rc.dual),
        instructorMin: min(rc.instr),
        multiPilotMin: min(cells.mp),
        takeoffsDay: int(cells.toD),
        takeoffsNight: int(cells.toN),
        landingsDay: int(cells.ldgD),
        landingsNight: int(cells.ldgN),
        registration: cells.reg,
        aircraftType: cells.model,
        picName: cells.pic,
        remarks: remarks.join(" · ") || undefined,
      };
      leg.function = leg.picMin ? (leg.instructorMin ? "FI" : "PIC") : leg.picusMin ? "PICUS" : leg.copilotMin ? "SIC" : leg.dualMin ? "DUAL" : leg.instructorMin ? "FI" : undefined;
      if (fstdMin && !total) {
        leg.fstdMin = fstdMin;
        leg.fstdType = rc.fstdType;
      }
      out.legs.push(leg);
    }
    // the right page's "TOTAL THIS PAGE" line (the first totals line under the flights): night, IFR and P1 read
    if (rh && right && dates.length) {
      const legs = out.legs.slice(-dates.length);
      const lowest = Math.min(...rowYs);
      const totalsYs = [...new Set(right.filter((it) => HM.test(it.s.trim()) && it.y < lowest - 8).map((it) => it.y))].sort((a, b) => b - a);
      const y = totalsYs[0];
      if (y !== undefined) {
        const cell = (k: RightCol) => min(right.find((it) => Math.abs(it.y - y) <= 2 && HM.test(it.s.trim()) && column(it.x, rh) === k)?.s);
        const sum = (k: keyof LogbookLeg) => legs.reduce((t, l) => t + ((l[k] as number) || 0), 0);
        out.checked.pages++;
        if (cell("night") !== sum("nightMin") || cell("ifr") !== sum("ifrMin") || cell("p1") !== sum("picMin")) out.checked.mismatches++;
      }
    }
    // the page's own total, to check the reading
    const thisPage = left.find((it) => /TOTAL THIS PAGE/.test(it.s));
    if (thisPage) {
      const totalX = lh.find((h) => h[0] === "total")![1];
      const cell = left.filter((it) => Math.abs(it.y - thisPage.y) <= 4 && HM.test(it.s.trim())).find((it) => column(it.x, lh) === "total");
      if (cell) {
        out.checked.pages++;
        if (min(cell.s) !== pageMin) out.checked.mismatches++;
      }
      void totalX;
    }
    if (!out.previous) {
      const prev = left.find((it) => /TOTAL FROM PREVIOUS PAGES/.test(it.s));
      if (prev) {
        const row = left.filter((it) => Math.abs(it.y - prev.y) <= 4 && it !== prev);
        const get = (k: LeftCol) => row.filter((it) => column(it.x, lh) === k).map((it) => it.s.trim());
        // the line may print the four durations as one item: "1397:19 905:25 647:44 2950:28"
        const durations = row.flatMap((it) => it.s.trim().split(/\s+/)).filter((s) => HM.test(s));
        out.previous = { totalMin: min(get("total")[0]) || min(durations[durations.length - 1]), landingsDay: int(get("ldgD")[0]), landingsNight: int(get("ldgN")[0]) };
      }
    }
  }
  return out.legs.length ? out : null;
}
