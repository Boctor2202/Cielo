import { useMemo } from "react";
import { currencyAlerts, type CurrencyItem } from "@cielo/core";
import { currencyFor } from "./currencyAlerts";
import { todayUtc, useApp } from "./state";

/** Recent-experience items and those that need attention, kept in step with the logbook. */
export function useCurrency(): { items: CurrencyItem[]; alerts: CurrencyItem[] } {
  const { flights, aircraftTypes, licenses, pilot } = useApp();
  const today = todayUtc();
  return useMemo(() => {
    const items = currencyFor(flights, aircraftTypes, licenses, pilot, today);
    return { items, alerts: currencyAlerts(items, today) };
  }, [flights, aircraftTypes, licenses, pilot, today]);
}

