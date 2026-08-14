"use client";

import * as React from "react";

/**
 * Plain-HTML chart primitives for the production cockpit.
 *
 * Colours come from the app's validated categorical tokens (--chart-1..4) in
 * fixed order rather than being generated per chart, so a series keeps its hue
 * when a filter changes the row count. The two-series output chart pairs
 * chart-1 with chart-3, which clears the normal-vision floor comfortably but
 * sits in the CVD floor band — hence the direct value labels and the 2px gap
 * between segments, which carry identity when hue alone does not.
 */

export type MeterTone = "good" | "warning" | "critical";

export function toneForTarget(value: number, target: number): MeterTone {
  if (value >= target * 100) return "good";
  if (value >= target * 100 * 0.85) return "warning";
  return "critical";
}

const TONE_CLASSES: Record<MeterTone, { bar: string; text: string; label: string }> = {
  good: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "On target" },
  warning: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Below target" },
  critical: { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", label: "Critical" },
};

/**
 * Hero number with a meter underneath. The status colour is always paired with
 * a written label, so the state is never carried by colour alone.
 */
export function MetricMeter({
  label,
  value,
  target,
  suffix = "%",
  hint,
}: {
  label: string;
  value: number;
  target?: number;
  suffix?: string;
  hint?: string;
}) {
  const tone = target != null ? toneForTarget(value, target) : "good";
  const classes = TONE_CLASSES[tone];
  const width = Math.max(0, Math.min(100, value));

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">
        {value.toFixed(1)}
        <span className="ml-0.5 text-lg font-bold text-muted-foreground">{suffix}</span>
      </p>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={`h-full rounded-full ${classes.bar}`} style={{ width: `${width}%` }} />
      </div>
      <p className={`mt-2 text-xs font-semibold ${classes.text}`}>
        {target != null ? `${classes.label} · target ${(target * 100).toFixed(0)}%` : hint ?? ""}
      </p>
    </div>
  );
}

/**
 * Sorted single-measure bars — the pareto form. One measure across categories
 * is a magnitude question, so every bar wears the same hue and rank is carried
 * by length and order, not by colour.
 */
export function ParetoBars({
  rows,
  emptyLabel,
  valueSuffix = "",
}: {
  rows: Array<{ key: string; label: string; value: number; sharePercent: number; meta?: string }>;
  emptyLabel: string;
  valueSuffix?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>;
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium">{row.label}</span>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {row.value.toLocaleString()}
              {valueSuffix}
              <span className="ml-2 text-xs font-medium text-muted-foreground">{row.sharePercent.toFixed(1)}%</span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(row.value / max) * 100}%`, backgroundColor: "var(--chart-2)" }}
            />
          </div>
          {row.meta ? <p className="text-[11px] text-muted-foreground">{row.meta}</p> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Good vs reject output per day. Two series, so a legend is always present and
 * both segments are directly labelled.
 */
export function DailyOutputChart({
  rows,
  emptyLabel,
}: {
  rows: Array<{ date: string; good_units: number; reject_units: number }>;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>;
  }

  const max = Math.max(...rows.map((row) => row.good_units + row.reject_units), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-2 text-xs font-semibold">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--chart-1)" }} />
          Good units
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--chart-3)" }} />
          Rejects
        </span>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => {
          const total = row.good_units + row.reject_units;
          return (
            <div key={row.date} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">{row.date}</span>
                <span className="text-xs font-semibold tabular-nums">
                  <span style={{ color: "var(--chart-1)" }}>{row.good_units.toLocaleString()}</span>
                  <span className="mx-1 text-muted-foreground">/</span>
                  <span style={{ color: "var(--chart-3)" }}>{row.reject_units.toLocaleString()}</span>
                </span>
              </div>
              {/* 2px surface gap between the segments so the boundary reads
                  without relying on the hue difference. */}
              <div className="flex h-2.5 w-full items-stretch gap-[2px] overflow-hidden rounded-full bg-muted">
                <div
                  className="rounded-l-full"
                  style={{ width: `${(row.good_units / max) * 100}%`, backgroundColor: "var(--chart-1)" }}
                />
                <div
                  className="rounded-r-full"
                  style={{ width: `${(row.reject_units / max) * 100}%`, backgroundColor: "var(--chart-3)" }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">{total.toLocaleString()} units total</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
