import { describe, expect, it } from "vitest";
import { parseAirFranceEp5, type PdfTextItem } from "../src";

// a page laid out as in the EP5: header, column titles, then legs (x positions in points)
const X = { nat: 30, type: 70, immat: 110, sab: 150, esc1: 190, h1: 230, esc2: 290, h2: 330, total: 390, jour: 430, nuit: 470 };
let y = 800;
const row = (cells: [number, string][]): PdfTextItem[] => {
  y -= 12;
  return cells.map(([x, s]) => ({ x, y, s }));
};
const page: PdfTextItem[] = [
  ...row([[200, "CARNET DE VOL - EP5"]]),
  ...row([[30, "MANAC H"], [90, "PIERRE"], [300, "OPL 100%"], [500, "SEPTEMBRE 2026"]]),
  ...row([[X.total, "Total"], [X.jour, "Jour"], [X.nuit, "Nuit"]]),
  ...row([[X.nat, "0"], [X.type, "U-C2"], [X.immat, "HZUN"], [X.sab, "JHD"], [X.esc1, "CDG"], [X.h1, "02 | 14.63"], [X.esc2, "MAN"], [X.h2, "02 | 15.95"], [X.total, "1.32"], [X.jour, "1.32"]]),
  ...row([[X.nat, "0"], [X.type, "U-C2"], [X.immat, "HZUN"], [X.sab, "JHD"], [X.esc1, "CDG"], [X.h1, "02 | 20.42"], [X.esc2, "DUB"], [X.h2, "02 | 22.05"], [X.total, "1.63"], [X.nuit, "1.63"]]),
  ...row([[X.nat, "0"], [X.type, "U-C2"], [X.immat, "HPNO"], [X.sab, "JND"], [X.esc1, "ALG"], [X.h1, "04 | 17.43"], [X.esc2, "CDG"], [X.h2, "04 | 19.73"], [X.total, "2.30"], [X.jour, "0.88"], [X.nuit, "1.42"]]),
];

describe("Air France EP5", () => {
  it("reads the legs with their day | decimal-hour times", () => {
    const r = parseAirFranceEp5([page])!;
    expect(r.legs).toHaveLength(3);
    expect(r.legs[0]).toMatchObject({ date: "2026-09-02", dep: "CDG", arr: "MAN", out: "14:38", in: "15:57", totalMin: 79, dayMin: 79, nightMin: 0, registration: "F-HZUN" });
    expect(r.legs[1]).toMatchObject({ out: "20:25", in: "22:03", totalMin: 98, nightMin: 98 });
    expect(r.legs[2]).toMatchObject({ dep: "ALG", arr: "CDG", dayMin: 53, nightMin: 85 });
  });
});

describe("Air France EP4", () => {
  it("reads the legs of the activity sheet, the month from the header, not from the day it was printed", () => {
    let yy = 800;
    const r = (cells: [number, string][]): PdfTextItem[] => {
      yy -= 12;
      return cells.map(([x, s]) => ({ x, y: yy, s }));
    };
    const p: PdfTextItem[] = [
      ...r([[600, "Edité le 29 octobre 2026"]]),
      ...r([[200, "FEUILLE HORAIRE D'ACTIVITE DU PERSONNEL NAVIGANT EP4"]]),
      ...r([[30, "MANAC H"], [300, "OPL 100%"], [500, "SEPTEMBRE 2026"]]),
      ...r([[30, "0"], [36, "0"], [60, "1168"], [90, "U-23"], [120, "HZUN"], [150, "JHD"], [180, "CDG"], [210, "02 | 14.63"], [260, "02 | 14.42"], [300, "MAN"], [330, "02 | 15.95"], [380, "02 | 15.92"], [430, "1.32"], [470, "1.50"], [510, "1.50"]]),
      ...r([[30, "0"], [36, "0"], [60, "1016"], [90, "U-23"], [120, "HZUN"], [150, "JND"], [180, "CDG"], [210, "02 | 20.42"], [260, "02 | 19.92"], [300, "DUB"], [330, "02 | 22.05"], [380, "02 | 21.67"], [430, "1.63"], [470, "1.75"], [510, "1.75"], [550, "9.13"], [640, "3.55"]]),
      ...r([[30, "Activité"], [80, "Type MVM"], [160, "VAM"], [210, "17 | 08:45"]]),
    ];
    const res = parseAirFranceEp5([p])!;
    expect(res.legs).toHaveLength(2);
    expect(res.legs[0]).toMatchObject({ date: "2026-09-02", dep: "CDG", arr: "MAN", out: "14:38", in: "15:57", totalMin: 79, registration: "F-HZUN", line: "1168" });
    // the duty's night total on its last line is not this leg's night: the logbook works it out
    expect(res.legs[1]).toMatchObject({ dep: "CDG", arr: "DUB", totalMin: 98, nightMin: undefined });
  });
});
