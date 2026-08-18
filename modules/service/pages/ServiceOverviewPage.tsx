"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, HardHat, Wrench } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { serviceApi } from "@/modules/service/api";
import type { ServiceOverview } from "@/modules/service/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart, SeverityBands } from "@/modules/shared/charts/charts";

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const PRESETS = [30, 90, 365] as const;

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Priority is an ordered urgency scale, so it earns the reserved severity ramp:
 * critical is what stops the customer working today.
 */
const PRIORITY_SEVERITY: Record<string, string> = {
  critical: "critical",
  high: "warning",
  normal: "caution",
  low: "good",
};

export default function ServiceOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(89));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [preset, setPreset] = React.useState<number | null>(90);

  const overviewQuery = useQuery({
    queryKey: ["service", "overview", from, to],
    queryFn: () => serviceApi.overview({ from, to }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const raw: ServiceOverview | undefined = overviewQuery.data?.data;
  const refetching = overviewQuery.isFetching && !overviewQuery.isLoading;

  const applyPreset = (days: number) => {
    setPreset(days);
    setFrom(isoDaysAgo(days - 1));
    setTo(isoDaysAgo(0));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("service.overview.title", "Service Overview")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "service.overview.subtitle",
            "Whether the promises in your contracts are actually being kept, what is at risk right now, what the work costs against what you can invoice, and which equipment keeps coming back.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex gap-1.5">
          {PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={preset === days}
              onClick={() => applyPreset(days)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                preset === days
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("service.overview.last_days", "Last {n} days").replace("{n}", String(days))}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="service-from" className="text-xs">
            {t("service.common.from", "From")}
          </Label>
          <Input
            id="service-from"
            type="date"
            value={from}
            max={to}
            onChange={(event) => {
              setFrom(event.target.value);
              setPreset(null);
            }}
            className="h-9 w-[9.5rem]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="service-to" className="text-xs">
            {t("service.common.to", "To")}
          </Label>
          <Input
            id="service-to"
            type="date"
            value={to}
            min={from}
            onChange={(event) => {
              setTo(event.target.value);
              setPreset(null);
            }}
            className="h-9 w-[9.5rem]"
          />
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <LoadingPanel label={t("service.common.loading", "Loading service performance...")} />
      ) : !raw ? (
        <EmptyPanel
          label={t("service.overview.unavailable", "Service metrics are not available right now.")}
        />
      ) : (
        <>
          {/* One hero figure. Resolution compliance is the promise the customer
              actually bought, measured from frozen deadlines and real
              timestamps rather than from a status somebody set by hand. */}
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("service.overview.compliance", "Resolution SLA met")}
              </p>
              <p className="mt-1 text-5xl font-black leading-none tracking-tight">
                {n(raw.sla?.resolution_compliance_percent).toFixed(1)}
                <span className="ml-1 text-2xl font-bold text-muted-foreground">%</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  "service.overview.compliance_meta",
                  "{met} on time, {late} late · mean {hours}h to fix",
                )
                  .replace("{met}", String(n(raw.sla?.resolution_met)))
                  .replace("{late}", String(n(raw.sla?.resolution_breached)))
                  .replace("{hours}", n(raw.sla?.mean_resolution_hours).toFixed(1))}
              </p>
              {n(raw.sla?.uncovered_requests) > 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {/* Requests with no contract had no promise attached, so they
                      are excluded from the figure rather than counted as met. */}
                  {t(
                    "service.overview.uncovered_meta",
                    "{n} request(s) had no contract, so nothing to judge them against",
                  ).replace("{n}", String(n(raw.sla?.uncovered_requests)))}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<AlertTriangle className="h-4 w-4" />}
                label={t("service.overview.at_risk", "At risk now")}
                value={(raw.breaching ?? []).length.toLocaleString()}
                meta={t("service.overview.open_meta", "{n} open requests").replace(
                  "{n}",
                  String(n(raw.queue?.open)),
                )}
                alert={(raw.breaching ?? []).length > 0}
              />
              <StatTile
                icon={<Wrench className="h-4 w-4" />}
                label={t("service.overview.first_time_fix", "First-time fix")}
                value={`${n(raw.work?.first_time_fix_percent).toFixed(1)}%`}
                // The measure that says whether engineers arrive prepared.
                meta={t("service.overview.completed_meta", "across {n} completed visits").replace(
                  "{n}",
                  String(n(raw.work?.completed)),
                )}
              />
              <StatTile
                icon={<HardHat className="h-4 w-4" />}
                label={t("service.overview.response", "Response SLA met")}
                value={`${n(raw.sla?.response_compliance_percent).toFixed(1)}%`}
                meta={t("service.overview.unack_meta", "{n} still unacknowledged").replace(
                  "{n}",
                  String(n(raw.queue?.unacknowledged)),
                )}
                alert={n(raw.queue?.unacknowledged) > 0}
              />
              <StatTile
                icon={<CalendarClock className="h-4 w-4" />}
                label={t("service.overview.preventive_due", "Preventive due")}
                value={n(raw.preventive?.due_now).toLocaleString()}
                meta={t("service.overview.due_soon_meta", "{n} falling due within 30 days").replace(
                  "{n}",
                  String(n(raw.preventive?.due_soon)),
                )}
                alert={n(raw.preventive?.due_now) > 0}
              />
            </div>
          </section>

          <Panel
            title={t("service.overview.breach_queue", "Clock running out")}
            description={t(
              "service.overview.breach_queue_desc",
              "Open requests already past a deadline or within eight hours of one — worst first, and every hour figure is net of time spent waiting on the customer.",
            )}
          >
            {(raw.breaching ?? []).length === 0 ? (
              <EmptyPanel
                label={t("service.overview.nothing_at_risk", "Nothing is against the clock.")}
              />
            ) : (
              <div className="space-y-1.5">
                {raw.breaching.slice(0, 8).map((row) => {
                  const late = row.response_late || row.resolution_late;
                  return (
                    <div
                      key={row.request_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.subject}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {row.request_number}
                          {row.customer ? ` · ${row.customer}` : ""} ·{" "}
                          <span className="capitalize">{row.priority}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {/* The word carries the state, never the colour alone. */}
                        <span
                          className={`block text-xs font-semibold ${
                            late ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {row.response_late
                            ? t("service.overview.response_late", "Response late")
                            : row.resolution_late
                              ? t("service.overview.resolution_late", "Resolution late")
                              : t("service.overview.due_soon", "Due soon")}
                        </span>
                        <span className="block text-[11px] tabular-nums text-muted-foreground">
                          {row.hours_remaining === null
                            ? t("service.overview.no_deadline", "no deadline")
                            : row.hours_remaining < 0
                              ? t("service.overview.hours_over", "{n}h over").replace(
                                  "{n}",
                                  Math.abs(row.hours_remaining).toFixed(1),
                                )
                              : t("service.overview.hours_left", "{n}h left").replace(
                                  "{n}",
                                  row.hours_remaining.toFixed(1),
                                )}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <SeverityBands
              title={t("service.overview.priority_mix", "Open requests by urgency")}
              description={t(
                "service.overview.priority_mix_desc",
                "What is waiting, ordered by how badly it hurts the customer.",
              )}
              bands={(raw.queue?.by_priority ?? []).map((row) => ({
                key: row.priority,
                label: row.label,
                severity: PRIORITY_SEVERITY[row.priority] ?? "caution",
                count: n(row.count),
              }))}
              emptyLabel={t("service.overview.no_open", "Nothing open right now.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("service.overview.repeat_offenders", "Equipment that keeps failing")}
              description={t(
                "service.overview.repeat_offenders_desc",
                "Faults raised per asset — the list that decides what to replace rather than keep repairing.",
              )}
              rows={(raw.assets?.most_faults ?? []).map((row) => ({
                key: String(row.asset_id),
                label: row.asset,
                value: n(row.faults),
                meta: row.customer ?? undefined,
              }))}
              valueLabel={t("service.overview.faults", "Faults")}
              emptyLabel={t("service.overview.no_faults", "No faults recorded against any asset.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("service.overview.coverage_mix", "Who pays for the work")}
              description={t(
                "service.overview.coverage_mix_desc",
                "Warranty and contract work is absorbed; only chargeable work reaches an invoice.",
              )}
              rows={(raw.work?.by_coverage ?? []).map((row) => ({
                key: row.coverage,
                label: row.label,
                value: n(row.count),
                meta: money(row.cost),
              }))}
              valueLabel={t("service.overview.visits", "Visits")}
              emptyLabel={t("service.overview.no_work", "No work orders in this range.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("service.overview.work_types", "Work by type")}
              description={t(
                "service.overview.work_types_desc",
                "Preventive against corrective — the balance that says whether equipment is being looked after or patched up.",
              )}
              rows={(raw.work?.by_type ?? []).map((row) => ({
                key: row.type,
                label: row.label,
                value: n(row.count),
              }))}
              valueLabel={t("service.overview.visits", "Visits")}
              emptyLabel={t("service.overview.no_work", "No work orders in this range.")}
              dimmed={refetching}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={t("service.overview.economics", "What service costs and earns")}
              description={t(
                "service.overview.economics_desc",
                "Completed visits only — work still in progress has no final cost yet.",
              )}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <StatTile
                  label={t("service.overview.billable", "Billable")}
                  value={money(raw.work?.billable_cost)}
                  meta={t("service.overview.billable_meta", "chargeable work you can invoice")}
                />
                <StatTile
                  label={t("service.overview.absorbed", "Absorbed")}
                  value={money(raw.work?.absorbed_cost)}
                  meta={t(
                    "service.overview.absorbed_meta",
                    "carried under warranty and contract",
                  )}
                  alert={n(raw.work?.absorbed_cost) > n(raw.work?.billable_cost)}
                />
                <StatTile
                  label={t("service.overview.labour", "Labour")}
                  value={money(raw.work?.labour_cost)}
                  meta={t("service.overview.labour_meta", "{n} hours on site").replace(
                    "{n}",
                    n(raw.work?.labour_hours).toLocaleString(),
                  )}
                />
                <StatTile
                  label={t("service.overview.parts", "Parts")}
                  value={money(raw.work?.parts_cost)}
                  meta={t("service.overview.parts_meta", "consumed across {n} visits").replace(
                    "{n}",
                    String(n(raw.work?.completed)),
                  )}
                />
              </div>

              <div className="mt-4 grid gap-3 border-t border-border/40 pt-4 sm:grid-cols-3">
                <StatTile
                  label={t("service.overview.contracts_in_force", "Contracts in force")}
                  value={n(raw.contracts?.in_force).toLocaleString()}
                  meta={t("service.overview.contract_value_meta", "{v} on the books").replace(
                    "{v}",
                    money(raw.contracts?.annual_value),
                  )}
                />
                <StatTile
                  label={t("service.overview.renewals", "Renewals due")}
                  value={n(raw.contracts?.expiring_soon).toLocaleString()}
                  meta={t("service.overview.renewals_meta", "expiring within 60 days")}
                  alert={n(raw.contracts?.expiring_soon) > 0}
                />
                <StatTile
                  label={t("service.overview.satisfaction", "Satisfaction")}
                  value={
                    raw.sla?.average_satisfaction === null ||
                    raw.sla?.average_satisfaction === undefined
                      ? "—"
                      : `${n(raw.sla.average_satisfaction).toFixed(1)} / 5`
                  }
                  meta={t("service.overview.satisfaction_meta", "captured when a request closes")}
                />
              </div>
            </Panel>

            <Panel
              title={t("service.overview.preventive", "Preventive maintenance")}
              description={t(
                "service.overview.preventive_desc",
                "Overdue first, then whatever is closest. A plan with no visit on record counts from today, not from zero.",
              )}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label={t("service.overview.plans", "Active plans")}
                  value={n(raw.preventive?.plans).toLocaleString()}
                />
                <StatTile
                  label={t("service.overview.assets_faulty", "Faulty assets")}
                  value={n(raw.assets?.faulty).toLocaleString()}
                  meta={t("service.overview.assets_meta", "of {n} on the books").replace(
                    "{n}",
                    String(n(raw.assets?.total)),
                  )}
                  alert={n(raw.assets?.faulty) > 0}
                />
                <StatTile
                  label={t("service.overview.warranty", "Warranty ending")}
                  value={n(raw.assets?.warranty_expiring).toLocaleString()}
                  meta={t("service.overview.warranty_meta", "{n} still under warranty").replace(
                    "{n}",
                    String(n(raw.assets?.under_warranty)),
                  )}
                  alert={n(raw.assets?.warranty_expiring) > 0}
                />
              </div>

              {(raw.preventive?.upcoming ?? []).length > 0 ? (
                <div className="mt-4 space-y-1.5 border-t border-border/40 pt-4">
                  {raw.preventive.upcoming.slice(0, 6).map((plan) => (
                    <div key={plan.plan_id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{plan.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{plan.asset}</span>
                      </span>
                      <span
                        className={`shrink-0 text-xs font-semibold tabular-nums ${
                          plan.is_due ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {plan.is_due
                          ? t("service.overview.overdue_days", "{n} days overdue").replace(
                              "{n}",
                              String(Math.abs(n(plan.days_remaining))),
                            )
                          : t("service.overview.in_days", "in {n} days").replace(
                              "{n}",
                              String(n(plan.days_remaining)),
                            )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border-t border-border/40 pt-4">
                  <EmptyPanel
                    label={t("service.overview.nothing_preventive", "Nothing due in the window.")}
                  />
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
