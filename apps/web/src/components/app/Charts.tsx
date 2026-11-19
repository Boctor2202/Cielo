"use client";

import { Roll } from "@/components/ui/Roll";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Single-series bar chart (minutes on the y axis, shown as hours). No legend: the card title names the series. */
export function HoursBars({ data, format, height = 220, horizontal = false }: { data: { label: string; minutes: number }[]; format: (m: number) => string; height?: number; horizontal?: boolean }) {
  const rows = data.map((d) => ({ ...d, hours: d.minutes / 60 }));
  const tip = (
    <Tooltip
      cursor={{ fill: "var(--surface-2)" }}
      content={({ active, payload }) => {
        const p = payload?.[0]?.payload as { label: string; minutes: number } | undefined;
        if (!active || !p) return null;
        return (
          <div className="rounded-lg border border-border bg-bg px-3 py-2 text-xs shadow-lg">
            <p className="text-muted">{p.label}</p>
            <p className="num mt-0.5 text-sm font-semibold text-text"><Roll>{format(p.minutes)}</Roll></p>
          </div>
        );
      }}
    />
  );
  const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(height, rows.length * 30 + 20)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis type="number" {...axis} tickFormatter={(v: number) => `${Math.round(v)} h`} />
          <YAxis type="category" dataKey="label" {...axis} width={64} />
          {tip}
          <defs>
            <linearGradient id="hb-h" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.55} />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity={1} />
            </linearGradient>
          </defs>
          <Bar dataKey="hours" fill="url(#hb-h)" radius={[0, 6, 6, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ left: -12, right: 4, top: 8, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
        <YAxis {...axis} tickFormatter={(v: number) => `${Math.round(v)}`} width={44} />
        {tip}
        <defs>
          <linearGradient id="hb-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart-1)" stopOpacity={1} />
            <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <Bar dataKey="hours" fill="url(#hb-v)" radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two-part proportion bar (e.g. day/night) with legend and direct labels — identity never relies on color alone. */
export function SplitBar({ a, b, format }: { a: { label: string; value: number }; b: { label: string; value: number }; format: (m: number) => string }) {
  const total = a.value + b.value || 1;
  const pa = (a.value / total) * 100;
  return (
    <div>
      <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,.2)]" role="img" aria-label={`${a.label} ${Math.round(pa)} %, ${b.label} ${Math.round(100 - pa)} %`}>
        {a.value > 0 && <div className="split-seg h-full rounded-l-full" style={{ width: `${pa}%`, ["--seg" as string]: "var(--chart-1)" }} />}
        {b.value > 0 && <div className="split-seg h-full rounded-r-full" style={{ width: `${100 - pa}%`, ["--seg" as string]: "var(--chart-2)" }} />}
      </div>
      <div className="mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1.5 text-sm">
        {[{ ...a, c: "var(--chart-1)", p: pa }, { ...b, c: "var(--chart-2)", p: 100 - pa }].map((x) => (
          <span key={x.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.c }} />
            <span className="text-muted">{x.label}</span>
            <span className="num font-semibold"><Roll>{format(x.value)}</Roll></span>
            <span className="num text-xs text-muted">{Math.round(x.p)} %</span>
          </span>
        ))}
      </div>
    </div>
  );
}
