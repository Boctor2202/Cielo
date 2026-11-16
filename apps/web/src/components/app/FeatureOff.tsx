"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FlagGate, type Flags } from "@/lib/flags";

export function FeatureOff({ flag, children }: { flag: keyof Flags; children: ReactNode }) {
  const t = useTranslations("app.flags");
  return (
    <FlagGate flag={flag} message={t("off")}>
      {children}
    </FlagGate>
  );
}
