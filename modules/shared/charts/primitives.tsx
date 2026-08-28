"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Shared presentation pieces for the supply chain workspace.
 *
 * Status colours always ship alongside the status word, so state is never
 * carried by hue alone.
 */

export function StatTile({
  label,
  value,
  meta,
  alert = false,
  icon,
  href,
}: {
  label: string;
  value: string;
  meta?: string;
  alert?: boolean;
  icon?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{value}</p>
      {meta ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {alert ? <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden /> : null}
          {meta}
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-card/80"
      >
        {inner}
      </a>
    );
  }

  return <div className="rounded-2xl border border-border/60 bg-card p-4">{inner}</div>;
}

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black tracking-tight">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

const TONES: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const SHIPMENT_TONES: Record<string, string> = {
  draft: "neutral",
  planned: "info",
  loaded: "info",
  in_transit: "progress",
  delivered: "good",
  partially_delivered: "warning",
  failed: "danger",
  cancelled: "danger",
};

const TRANSFER_TONES: Record<string, string> = {
  draft: "neutral",
  approved: "info",
  in_transit: "progress",
  received: "good",
  partially_received: "warning",
  cancelled: "danger",
};

const RETURN_TONES: Record<string, string> = {
  draft: "neutral",
  authorised: "info",
  received: "progress",
  inspected: "good",
  closed: "good",
  rejected: "danger",
};

const URGENCY_TONES: Record<string, string> = {
  critical: "danger",
  high: "warning",
  normal: "neutral",
};

function toneBadge(value: string, tone: string) {
  return (
    <Badge
      variant="outline"
      className={`border-transparent text-[11px] font-black uppercase tracking-widest ${TONES[tone] ?? TONES.neutral}`}
    >
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

export const ShipmentStatusBadge = ({ status }: { status: string }) =>
  toneBadge(status, SHIPMENT_TONES[status] ?? "neutral");

export const TransferStatusBadge = ({ status }: { status: string }) =>
  toneBadge(status, TRANSFER_TONES[status] ?? "neutral");

export const ReturnStatusBadge = ({ status }: { status: string }) =>
  toneBadge(status, RETURN_TONES[status] ?? "neutral");

export const UrgencyBadge = ({ urgency }: { urgency: string }) =>
  toneBadge(urgency, URGENCY_TONES[urgency] ?? "neutral");

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-8 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm italic text-muted-foreground">
      {label}
    </div>
  );
}

/**
 * Sorted single-measure bars. One measure across categories is a magnitude
 * question, so every bar wears the same hue and rank is read from length.
 */
export function RankedBars({
  rows,
  emptyLabel,
  valueSuffix = "",
}: {
  rows: Array<{ key: string; label: string; value: number; meta?: string }>;
  emptyLabel: string;
  valueSuffix?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>;
  }

  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium">{row.label}</span>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {row.value.toLocaleString()}
              {valueSuffix}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(Math.abs(row.value) / max) * 100}%`,
                backgroundColor: "var(--chart-2)",
              }}
            />
          </div>
          {row.meta ? <p className="text-[11px] text-muted-foreground">{row.meta}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function ServiceMeter({
  label,
  value,
  target,
  lowerIsBetter = false,
}: {
  label: string;
  value: number;
  target: number;
  lowerIsBetter?: boolean;
}) {
  const targetPercent = target * 100;
  const meets = lowerIsBetter ? value <= targetPercent : value >= targetPercent;
  const close = lowerIsBetter
    ? value <= targetPercent * 1.25
    : value >= targetPercent * 0.9;

  const tone = meets ? "text-emerald-600 dark:text-emerald-400" : close ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  const bar = meets ? "bg-emerald-500" : close ? "bg-amber-500" : "bg-rose-500";
  const word = meets ? "On target" : close ? "Below target" : "Critical";

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">
        {value.toFixed(1)}
        <span className="ml-0.5 text-lg font-bold text-muted-foreground">%</span>
      </p>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <p className={`mt-2 text-xs font-semibold ${tone}`}>
        {word} · target {targetPercent.toFixed(0)}%
      </p>
    </div>
  );
}
