/**
 * Labels of every file Geardown exports. Exports are always in English, the language of aviation records and
 * of the recruiters and authorities who read them, whatever the language of the app.
 */
export const EXPORT_EN = {
  group: { month: "Month", year: "Year", type: "Aircraft type", registration: "Registration", function: "Function", route: "Route", airport: "Airport" } as Record<string, string>,
  col: {
    flights: "Flights", total: "Total (h)", pic: "PIC (h)", copilot: "Co-pilot (h)", dual: "Dual (h)", instructor: "Instructor (h)",
    multiPilot: "Multi-pilot (h)", night: "Night (h)", ifr: "IFR (h)", fstd: "FSTD (h)", landings: "Landings",
  },
  total: "Total",
  nights: {
    country: "Country", nights: "Nights", stays: "Stays", airports: "Airports", from: "From", to: "To", total: "Total",
    sheetCountries: "Countries", sheetStays: "Stays", unknown: "Unknown country", file: "layover-nights",
  },
};

/** "2026-11" → "November 2026" for export rows. */
export const exportMonth = (ym: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-15T12:00:00Z`));
