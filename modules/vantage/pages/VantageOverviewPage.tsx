"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Database, PlugZap, Sigma } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Label } from "@/components/ui/label";
import { vantageApi } from "@/modules/vantage/api";
import type { RenderedWidget, VantageOverview } from "@/modules/vantage/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart, TrendChart } from "@/modules/shared/charts/charts";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Formats a value the way its own metric says it should be read. */
const formatValue = (value: number | null, format: string, unit: string | null) => {
  if (value === null) {
    return "—";
  }

  switch (format) {
    case "currency":
      return `ETB ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "duration":
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
    default:
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
  }
};

/**
 * The panel a widget shows when its source cannot be read.
 *
 * Deliberately not a zero and not an empty chart: it names the module that
 * would provide the data, so the reader knows this is a subscription gap
 * rather than a business result.
 */
function UnavailableWidget({ widget, label }: { widget: RenderedWidget; label: string }) {
  return (
    <div className="flex h-full flex-col justify-center rounded-2xl border border-dashed border-border/60 bg-card/40 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {widget.title}
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <PlugZap className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        {widget.reason ?? label}
      </p>
    </div>
  );
}

export default function VantageOverviewPage() {
  const { t } = useTranslation();
  const [dashboardId, setDashboardId] = React.useState<string>("");

  const overviewQuery = useQuery({
    queryKey: ["vantage", "overview", dashboardId],
    queryFn: () =>
      vantageApi
        .overview(dashboardId ? { dashboard_id: Number(dashboardId) } : undefined)
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const raw: VantageOverview | undefined = overviewQuery.data?.data;
  const refetching = overviewQuery.isFetching && !overviewQuery.isLoading;

  const stats = (raw?.widgets ?? []).filter((widget) => widget.visual === "stat");
  const charts = (raw?.widgets ?? []).filter((widget) => widget.visual !== "stat");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("vantage.overview.title", "Vantage")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "vantage.overview.subtitle",
            "Reporting across every module you have. Anything drawn from a module you have not subscribed to says so rather than showing zero — a zero is a measurement, and inventing one is worse than showing nothing.",
          )}
        </p>
      </div>

      {(raw?.dashboards ?? []).length > 1 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="vg-dashboard" className="text-xs">
              {t("vantage.overview.dashboard", "Dashboard")}
            </Label>
            <select
              id="vg-dashboard"
              value={dashboardId}
              onChange={(event) => setDashboardId(event.target.value)}
              className="h-9 w-72 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("vantage.overview.default", "Default dashboard")}</option>
              {raw!.dashboards.map((dashboard) => (
                <option key={dashboard.id} value={dashboard.id}>
                  {dashboard.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {overviewQuery.isLoading ? (
        <LoadingPanel label={t("vantage.common.loading", "Loading the dashboard...")} />
      ) : !raw ? (
        <EmptyPanel label={t("vantage.overview.unavailable", "Vantage is not available right now.")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={<Database className="h-4 w-4" />}
              label={t("vantage.overview.sources", "Sources readable")}
              value={`${n(raw.coverage?.available)} / ${n(raw.coverage?.datasets)}`}
              meta={t("vantage.overview.sources_meta", "{n} need a module you do not have").replace(
                "{n}",
                String(n(raw.coverage?.unavailable)),
              )}
              alert={n(raw.coverage?.unavailable) > 0}
            />
            <StatTile
              icon={<Sigma className="h-4 w-4" />}
              label={t("vantage.overview.metrics", "Metrics defined")}
              value={n(raw.coverage?.metrics).toLocaleString()}
            />
            <StatTile
              icon={<BellRing className="h-4 w-4" />}
              label={t("vantage.overview.alerts_triggered", "Alerts breached")}
              value={n(raw.alerts?.triggered).toLocaleString()}
              meta={t("vantage.overview.alerts_meta", "of {n} active").replace(
                "{n}",
                String(n(raw.alerts?.active)),
              )}
              alert={n(raw.alerts?.triggered) > 0}
            />
            <StatTile
              label={t("vantage.overview.never_evaluated", "Never evaluated")}
              value={n(raw.alerts?.never_evaluated).toLocaleString()}
              // The number that tells an operator the scheduler is not running.
              meta={t("vantage.overview.never_meta", "alerts that have not run yet")}
              alert={n(raw.alerts?.never_evaluated) > 0}
            />
          </div>

          {!raw.dashboard ? (
            <EmptyPanel
              label={t("vantage.overview.no_dashboard", "No dashboard has been built yet.")}
            />
          ) : (
            <>
              {stats.length > 0 ? (
                <section
                  className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
                    refetching ? "opacity-50 transition-opacity" : "transition-opacity"
                  }`}
                >
                  {stats.map((widget) =>
                    widget.available ? (
                      <div
                        key={widget.widget_id}
                        className="rounded-2xl border border-border/60 bg-card p-5"
                      >
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          {widget.title}
                        </p>
                        <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">
                          {formatValue(
                            widget.value,
                            widget.metric?.format ?? "number",
                            widget.metric?.unit ?? null,
                          )}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {t("vantage.overview.range_meta", "last {n} days").replace(
                            "{n}",
                            String(widget.range_days),
                          )}
                          {widget.metric?.dataset ? ` · ${widget.metric.dataset}` : ""}
                        </p>
                        {widget.change_percent !== null && widget.change_percent !== undefined ? (
                          <p
                            className={`mt-1 text-xs font-semibold ${
                              // Direction decides whether a rise is good news.
                              (widget.metric?.direction === "lower_is_better"
                                ? -widget.change_percent
                                : widget.change_percent) >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                            }`}
                          >
                            {widget.change_percent >= 0 ? "+" : ""}
                            {widget.change_percent.toFixed(1)}%{" "}
                            {t("vantage.overview.vs_previous", "vs the period before")}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] italic text-muted-foreground">
                            {/* Null rather than a fabricated 0% or +100%. */}
                            {t("vantage.overview.no_comparison", "no comparable previous period")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <UnavailableWidget
                        key={widget.widget_id}
                        widget={widget}
                        label={t("vantage.overview.source_missing", "Source not available.")}
                      />
                    ),
                  )}
                </section>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                {charts.map((widget) => {
                  if (!widget.available) {
                    return (
                      <UnavailableWidget
                        key={widget.widget_id}
                        widget={widget}
                        label={t("vantage.overview.source_missing", "Source not available.")}
                      />
                    );
                  }

                  const description = t("vantage.overview.widget_meta", "{dataset} · last {n} days")
                    .replace("{dataset}", widget.metric?.dataset ?? "")
                    .replace("{n}", String(widget.range_days));

                  if (widget.visual === "trend") {
                    return (
                      <div key={widget.widget_id} className="lg:col-span-2">
                        <TrendChart
                          title={widget.title}
                          description={t(
                            "vantage.overview.trend_desc",
                            "The live series rebuilt from the records, against what was reported at each month end. Where the two differ, the records have changed since.",
                          )}
                          points={widget.points.map((point, index) => ({
                            date: point.label,
                            live: n(point.value),
                            reported: n(widget.reported?.[index]?.value ?? point.value),
                          }))}
                          series={[
                            { key: "live", label: t("vantage.overview.live", "Live") },
                            { key: "reported", label: t("vantage.overview.reported", "Reported") },
                          ]}
                          emptyLabel={t("vantage.overview.no_points", "Nothing to trend yet.")}
                          dimmed={refetching}
                        />
                      </div>
                    );
                  }

                  const rows = widget.rows.map((row) => ({
                    key: row.label,
                    label: row.label,
                    value: row.value,
                  }));

                  return widget.visual === "bar" ? (
                    <RankedBarChart
                      key={widget.widget_id}
                      title={widget.title}
                      description={description}
                      rows={rows}
                      valueLabel={widget.metric?.name ?? t("vantage.overview.value", "Value")}
                      emptyLabel={t("vantage.overview.no_rows", "Nothing in this window.")}
                      dimmed={refetching}
                    />
                  ) : (
                    <ColumnChart
                      key={widget.widget_id}
                      title={widget.title}
                      description={description}
                      rows={rows}
                      valueLabel={widget.metric?.name ?? t("vantage.overview.value", "Value")}
                      emptyLabel={t("vantage.overview.no_rows", "Nothing in this window.")}
                      dimmed={refetching}
                    />
                  );
                })}
              </div>
            </>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={t("vantage.overview.coverage", "What Vantage can read")}
              description={t(
                "vantage.overview.coverage_desc",
                "Availability is checked against the live schema on every load, so a module added or dropped shows up immediately.",
              )}
            >
              {(raw.coverage?.sources ?? []).length === 0 ? (
                <EmptyPanel label={t("vantage.overview.no_sources", "No sources registered.")} />
              ) : (
                <div className="space-y-1.5">
                  {raw.coverage.sources.map((source) => (
                    <div
                      key={source.dataset_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{source.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {source.source_table}
                          {source.module_slug ? ` · ${source.module_slug}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={`block text-xs font-semibold ${
                            source.is_available
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {source.is_available
                            ? t("vantage.overview.readable", "Readable")
                            : t("vantage.overview.not_installed", "Not installed")}
                        </span>
                        <span className="block text-[11px] tabular-nums text-muted-foreground">
                          {t("vantage.overview.metric_count", "{n} metrics").replace(
                            "{n}",
                            String(source.metric_count),
                          )}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title={t("vantage.overview.alerts", "Alerts")}
              description={t(
                "vantage.overview.alerts_desc",
                "An alert whose metric cannot be read shows no value and does not fire — it will not raise an alarm about a table that is not there.",
              )}
            >
              {(raw.alerts?.rows ?? []).length === 0 ? (
                <EmptyPanel label={t("vantage.overview.no_alerts", "No alerts set.")} />
              ) : (
                <div className="space-y-1.5">
                  {raw.alerts.rows.slice(0, 8).map((alert) => (
                    <div
                      key={alert.alert_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{alert.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {alert.metric ?? "—"} · {alert.comparison}{" "}
                          {alert.threshold.toLocaleString()}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={`block text-xs font-semibold ${
                            alert.is_triggered ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {alert.is_triggered
                            ? t("vantage.overview.breached", "Breached")
                            : alert.last_value === null
                              ? t("vantage.overview.unreadable", "Unreadable")
                              : t("vantage.overview.ok", "Within threshold")}
                        </span>
                        <span className="block text-[11px] tabular-nums text-muted-foreground">
                          {alert.last_value === null
                            ? "—"
                            : alert.last_value.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
