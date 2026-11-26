import { describe, expect, it } from "vitest";
import { cleanScanned, planScan, scannedCode, type License } from "../src";

const lic = (p: Partial<License>): License => ({ id: p.id ?? "x", pilotId: "p", createdAt: "", updatedAt: "", kind: "licence", code: "", alertDays: [90, 30, 7], ...p }) as License;

describe("scanned titles", () => {
  it("writes them as the forms do", () => {
    expect(scannedCode("medical", "CLASS 1")).toBe("Class 1");
    expect(scannedCode("medical", "Classe 2")).toBe("Class 2");
    expect(scannedCode("medical", "LAPL")).toBe("LAPL medical");
    expect(scannedCode("class_rating", "SEP (L)")).toBe("SEP(land)");
    expect(scannedCode("class_rating", "MEP land")).toBe("MEP(land)");
    expect(scannedCode("type_rating", "A320")).toBe("TR A320");
    expect(scannedCode("type_rating", "tr B737")).toBe("TR B737");
    expect(scannedCode("language", "ENGLISH 6")).toBe("LPE English 6");
    expect(scannedCode("language", "LPE: French level 4")).toBe("LPE French 4");
    expect(scannedCode("licence", "ATPL(A)")).toBe("ATPL(A)");
  });
});

describe("cleaning the AI answer", () => {
  it("drops unknown kinds, empty titles and impossible dates", () => {
    expect(cleanScanned({ kind: "passport", code: "X" })).toBeNull();
    expect(cleanScanned({ kind: "licence", code: "  " })).toBeNull();
    const d = cleanScanned({ kind: "medical", code: "Class 1", issuedOn: "2026-02-30", validUntil: "2027-03-14", limitations: ["vdl", "nonsense code", "VML"] })!;
    expect(d.issuedOn).toBeUndefined();
    expect(d.validUntil).toBe("2027-03-14");
    expect(d.limitations).toEqual(["VDL", "VML"]);
  });
  it("drops a validity that ends before the issue", () => {
    expect(cleanScanned({ kind: "type_rating", code: "A320", issuedOn: "2026-05-01", validUntil: "2025-05-31" })!.validUntil).toBeUndefined();
  });
  it("keeps limitations for a medical only", () => {
    expect(cleanScanned({ kind: "licence", code: "ATPL(A)", limitations: ["VDL"] })!.limitations).toBeUndefined();
  });
});

describe("planning the save", () => {
  const existing = [
    lic({ id: "m", kind: "medical", code: "Class 1", validUntil: "2026-03-14", notes: "Limitations: VDL\nAEMC Paris" }),
    lic({ id: "t", kind: "rating", code: "TR A320", validUntil: "2026-12-31", authority: "DGAC" }),
    lic({ id: "e", kind: "language", code: "LPE English 5", validUntil: "2028-01-01" }),
    lic({ id: "gone", kind: "licence", code: "ATPL(A)", deletedAt: "2026-01-01" }),
  ];
  it("updates the same document, never erasing a value, and adds the others", () => {
    const plan = planScan(
      [
        cleanScanned({ kind: "medical", code: "CLASS 1", validUntil: "2027-03-14", limitations: ["VDL", "VML"] })!,
        cleanScanned({ kind: "type_rating", code: "A320", validUntil: "2026-12-31" })!,
        cleanScanned({ kind: "language", code: "English 6" })!,
        cleanScanned({ kind: "licence", code: "ATPL(A)", number: "FRA.FCL.PA12345", authority: "DGAC France", issuedOn: "2019-06-03" })!,
      ],
      existing,
    );
    expect(plan.map((p) => p.action)).toEqual(["update", "same", "update", "new"]);
    expect(plan[0]!.draft.id).toBe("m");
    expect(plan[0]!.draft.validUntil).toBe("2027-03-14");
    expect(plan[0]!.changes).toEqual(["validUntil", "limitations"]);
    expect(plan[0]!.draft.notes).toBe("Limitations: VDL, VML\nAEMC Paris");
    // the type rating keeps its authority (not read) and its legacy kind
    expect(plan[1]!.draft.authority).toBe("DGAC");
    expect(plan[1]!.draft.kind).toBe("rating");
    expect(plan[2]!.draft.code).toBe("LPE English 6");
    expect(plan[2]!.draft.validUntil).toBeNull();
    // the deleted ATPL is not matched: a new record
    expect(plan[3]!.draft.id).toBeUndefined();
    expect(plan[3]!.draft.number).toBe("FRA.FCL.PA12345");
  });
  it("matches one record per read entry", () => {
    const plan = planScan([cleanScanned({ kind: "medical", code: "Class 1" })!, cleanScanned({ kind: "medical", code: "Class 1" })!], existing);
    expect(plan.map((p) => p.action)).toEqual(["same", "new"]);
  });
});
