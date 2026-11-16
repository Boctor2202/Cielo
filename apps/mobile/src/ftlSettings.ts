import { getCalendars } from "expo-localization";
import { DEFAULT_FTL_SETTINGS, type FtlSettings, type Pilot } from "@cielo/core";
import { lookupAirport } from "./airports";

/** FTL reference time: home base timezone when known, else the device timezone. */
export function ftlSettingsFor(pilot: Pilot): FtlSettings {
  let deviceTz: string | undefined;
  try {
    deviceTz = getCalendars()[0]?.timeZone ?? undefined;
  } catch {
    deviceTz = undefined;
  }
  const base = pilot.homeBaseIcao ? lookupAirport(pilot.homeBaseIcao) : undefined;
  return {
    ...DEFAULT_FTL_SETTINGS,
    homeBaseIcao: pilot.homeBaseIcao,
    regime: pilot.ftlRegime ?? "oro",
    homeTimezone: base?.timezone ?? deviceTz ?? DEFAULT_FTL_SETTINGS.homeTimezone,
  };
}
