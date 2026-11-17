import { describe, expect, it } from "vitest";
import { detectMapping, parseCsv, prepareLogbookTable, rowsToFlights } from "../src";

describe("logbook files from other apps", () => {
  it("ForeFlight: reads the flights table and takes the type from the aircraft table", () => {
    const csv = [
      "ForeFlight Logbook Import,,,,,,,",
      "Aircraft Table,,,,,,,",
      "AircraftID,TypeCode,Year,Make,Model,Category,Class,",
      "F-HLAG,C68A,2019,Cessna,Citation Latitude,Airplane,MEL,",
      ",,,,,,,",
      "Flights Table,,,,,,,",
      "Date,AircraftID,From,To,TimeOut,TimeIn,TotalTime,PIC,SIC,Night,DayLandingsFullStop,NightLandingsFullStop,PilotComments",
      "2026-11-02,F-HLAG,LFPB,LIML,08:05,09:35,1.5,0,1.5,0,1,0,Ferry",
    ].join("\n");
    const t = prepareLogbookTable(parseCsv(csv));
    expect(t.app).toBe("ForeFlight");
    const m = detectMapping(t.header, t.rows);
    const [row] = rowsToFlights(t.rows, m, { dateOrder: "ymd" });
    expect(row!.errors).toEqual([]);
    expect(row!.input).toMatchObject({ date: "2026-11-02", depIcao: "LFPB", arrIcao: "LIML", out: "08:05", in: "09:35", registration: "F-HLAG", aircraftTypeIcao: "C68A" });
    expect(row!.explicit.total).toBe(90);
  });

  it("LogTen: drops the column prefixes", () => {
    const tsv = ["flight_flightDate\tflight_from\tflight_to\tflight_actualDepartureTime\tflight_actualArrivalTime\tflight_totalTime\taircraft_aircraftID\taircraftType_type", "2026-10-10\tLFPB\tEGLF\t10:00\t11:05\t1:05\tF-HONG\tC68A"].join("\n");
    const t = prepareLogbookTable(parseCsv(tsv));
    expect(t.app).toBe("LogTen");
    const [row] = rowsToFlights(t.rows, detectMapping(t.header, t.rows), { dateOrder: "ymd" });
    expect(row!.input).toMatchObject({ depIcao: "LFPB", arrIcao: "EGLF", out: "10:00", in: "11:05", registration: "F-HONG" });
  });

  it("MyFlightbook: splits the route column", () => {
    const csv = ["Date,Tail Number,Model,Category/Class,Route,Landings,Total Flight Time,Comments", "2026-09-01,N123AB,C172,ASEL,KPAO KSQL KPAO,3,1.2,Pattern work"].join("\n");
    const t = prepareLogbookTable(parseCsv(csv));
    expect(t.app).toBe("MyFlightbook");
    const [row] = rowsToFlights(t.rows, detectMapping(t.header, t.rows), { dateOrder: "ymd" });
    expect(row!.input).toMatchObject({ depIcao: "KPAO", arrIcao: "KPAO", registration: "N123AB" });
    expect(row!.explicit.total).toBe(72);
  });
});
