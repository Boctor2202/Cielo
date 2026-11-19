"use client";

import { Cake, Flag, Globe2, HeartPulse, IdCard, Landmark, Languages, Mail, Plane, Plus, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { licenseStatus, type License, type Pilot, type Regulator } from "@cielo/core";
import { Badge, Card, type Level } from "@/components/app/ui";
import { useFormatDate } from "@/lib/hooks";

const level = (l: Pick<License, "validUntil" | "alertDays">, today: string): Level => {
  const s = licenseStatus(l, today);
  return s.state === "expired" ? "warning" : s.state === "expiring" ? ((s.daysLeft ?? 99) <= 30 ? "caution" : "info") : "ok";
};

/** One line of the pilot's sheet: an icon, a label, the value (or an invitation to fill it). */
function Item({ icon: Icon, label, children, empty, onEdit, wide }: { icon: typeof Cake; label: string; children?: ReactNode; empty?: boolean; onEdit?: () => void; wide?: boolean }) {
  const t = useTranslations("app.profile");
  return (
    <div className={`flex min-w-0 items-start gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
        <Icon size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="mono-label !text-[10px]">{label}</dt>
        <dd className="mt-1 min-w-0">
          {empty ? (
            <button type="button" onClick={onEdit} className="text-sm font-semibold text-accent hover:underline">
              + {t("addInfo")}
            </button>
          ) : (
            children
          )}
        </dd>
      </div>
    </div>
  );
}

/** The pilot's sheet: identity, licensing and current types, as an operator or an examiner would want them. */
export function PilotDetails({
  pilot,
  age,
  flag,
  country,
  regulator,
  creds,
  types,
  typesAuto,
  today,
  onEdit,
  email,
}: {
  pilot: Pilot;
  age?: number;
  flag: string;
  country?: string;
  regulator?: Regulator;
  creds: { licence?: License; medical?: License; language?: License };
  types: string[];
  typesAuto: boolean;
  today: string;
  onEdit: () => void;
  email?: string;
}) {
  const t = useTranslations("app.profile");
  const fd = useFormatDate();
  const validity = (l: License) =>
    l.validUntil ? <Badge level={level(l, today)}>{l.validUntil < today ? t("expired") : t("validUntil", { date: fd(l.validUntil, { day: "2-digit", month: "short", year: "numeric" }) })}</Badge> : <Badge level="ok">{t("noExpiry")}</Badge>;
  const licenceNumber = pilot.licenceNumber || creds.licence?.number;

  return (
    <Card title={t("details")}>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Item icon={Cake} label={t("f.birthDate")} empty={!pilot.birthDate} onEdit={onEdit}>
          <p className="num font-semibold">
            {pilot.birthDate && fd(pilot.birthDate, { day: "2-digit", month: "long", year: "numeric" })}
            {age !== undefined && <span className="ml-2 text-sm font-normal text-muted">{t("age", { n: age })}</span>}
          </p>
        </Item>
        <Item icon={Flag} label={t("f.nationality")} empty={!country} onEdit={onEdit}>
          <p className="font-semibold">
            <span className="mr-1.5 text-lg leading-none" aria-hidden>{flag}</span>
            {country}
          </p>
        </Item>
        <Item icon={Landmark} label={t("f.authority")} empty={!regulator} onEdit={onEdit}>
          <p className="font-semibold">{regulator?.short}</p>
          <p className="truncate text-xs text-muted" title={regulator?.name}>{regulator?.name}</p>
        </Item>
        <Item icon={IdCard} label={t("licence")} empty={!creds.licence && !licenceNumber} onEdit={onEdit}>
          <p className="font-semibold">{creds.licence?.code ?? "—"}</p>
          {licenceNumber && <p className="num truncate text-xs text-muted">{licenceNumber}</p>}
        </Item>
        <Item icon={HeartPulse} label={t("medical")} empty={!creds.medical} onEdit={onEdit}>
          {creds.medical && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{creds.medical.code}</span>
              {validity(creds.medical)}
            </div>
          )}
        </Item>
        <Item icon={Languages} label={t("language")} empty={!creds.language} onEdit={onEdit}>
          {creds.language && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{creds.language.code}</span>
              {validity(creds.language)}
            </div>
          )}
        </Item>
        <Item icon={Plane} label={t("f.currentTypes")} empty={!types.length} onEdit={onEdit} wide>
          <div className="flex flex-wrap items-center gap-2">
            {types.map((x) => (
              <span key={x} className="num inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-sm font-bold tracking-wide text-accent">
                <Plane size={13} aria-hidden /> {x}
              </span>
            ))}
            {typesAuto && <span className="text-xs text-muted">{t("typesAuto")}</span>}
          </div>
        </Item>
        <Item icon={Mail} label={t("f.email")} empty={!email} onEdit={onEdit}>
          <p className="truncate font-semibold" title={email}>{email}</p>
          <Link href="/app/parametres" className="text-xs font-semibold text-accent hover:underline">{t("f.emailChange")}</Link>
        </Item>
        <Item icon={Globe2} label={t("f.base")} empty={!pilot.homeBaseIcao} onEdit={onEdit}>
          <p className="num font-semibold">{pilot.homeBaseIcao}</p>
        </Item>
      </dl>
    </Card>
  );
}

/** Aircraft types as chips: typed (ICAO designator) or picked from what the app suggests. */
export function TypesInput({ value, suggestions, onChange }: { value: string[]; suggestions: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations("app.profile");
  const [text, setText] = useState("");
  const add = (x: string) => {
    const v = x.trim().toUpperCase();
    if (v && !value.includes(v) && value.length < 12) onChange([...value, v]);
    setText("");
  };
  const rest = suggestions.filter((s) => !value.includes(s));
  return (
    <div className="space-y-2">
      <div className="input flex min-h-11 flex-wrap items-center gap-1.5 !py-1.5">
        {value.map((x) => (
          <span key={x} className="num inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-sm font-bold text-accent">
            {x}
            <button type="button" aria-label={t("remove", { x })} onClick={() => onChange(value.filter((v) => v !== x))} className="opacity-70 hover:opacity-100">
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          id="p-types"
          className="num min-w-24 flex-1 bg-transparent uppercase outline-none"
          value={text}
          maxLength={6}
          placeholder={value.length ? "" : "A320, C68A…"}
          onChange={(e) => setText(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === " ") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
        />
      </div>
      {rest.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">{t("suggested")}</span>
          {rest.map((x) => (
            <button key={x} type="button" onClick={() => add(x)} className="num inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent">
              <Plus size={12} /> {x}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
