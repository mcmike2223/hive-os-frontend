"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Droplets, Factory, Loader2, PackageCheck, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productionApi } from "@/modules/production/api";
import type { ProductionLine, ProductionOverview } from "@/modules/production/types";
import { DailyOutputChart, MetricMeter, ParetoBars } from "@/modules/production/components/metric-bars";

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

export default function ProductionOverviewPage() {
  const { t } = useTranslation();

  const [from, setFrom] = React.useState(isoDaysAgo(29));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [lineId, setLineId] = React.useState<string>("all");

  const linesQuery = useQuery({
    queryKey: ["production", "lines", "select"],
    queryFn: () => productionApi.listLines({ limit: 100, is_active: true }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["production", "overview", from, to, lineId],
    queryFn: () =>
      productionApi
        .overview({
          from,
          to,
          production_line_id: lineId === "all" ? undefined : lineId,
        })
        .then((res) => res.data),
  });

  const overview: ProductionOverview | undefined = overviewQuery.data?.data;
  const lines: ProductionLine[] = linesQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("production.overview.title", "Production Overview")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "production.overview.subtitle",
              "Line effectiveness, stoppage causes, reject drivers, and treated-water compliance.",
            )}
          </p>
        </div>

        {/* Filters in one row above the charts. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="production-from" className="text-xs">
              {t("production.common.from", "From")}
            </Label>
            <Input
              id="production-from"
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="h-9 w-[9.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="production-to" className="text-xs">
              {t("production.common.to", "To")}
            </Label>
            <Input
              id="production-to"
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className="h-9 w-[9.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("production.common.line", "Line")}</Label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger className="h-9 w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("production.common.all_lines", "All lines")}</SelectItem>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={String(line.id)}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("production.common.loading", "Loading plant performance...")}
        </div>
      ) : !overview ? (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
          {t("production.overview.unavailable", "Production metrics are not available right now.")}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricMeter
              label={t("production.overview.oee", "OEE")}
              value={overview.oee.oee}
              target={overview.targets.overall}
            />
            <MetricMeter
              label={t("production.overview.availability", "Availability")}
              value={overview.oee.availability}
              target={overview.targets.availability}
            />
            <MetricMeter
              label={t("production.overview.performance", "Performance")}
              value={overview.oee.performance}
              target={overview.targets.performance}
            />
            <MetricMeter
              label={t("production.overview.quality", "Quality")}
              value={overview.oee.quality}
              target={overview.targets.quality}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryTile
              href="/dashboard/production/orders?open_only=1"
              icon={<Factory className="h-4 w-4" />}
              label={t("production.overview.open_orders", "Open work orders")}
              value={overview.orders.open.toLocaleString()}
              meta={t("production.overview.of_total", "of {total} in period").replace(
                "{total}",
                String(overview.orders.total),
              )}
            />
            <SummaryTile
              icon={<PackageCheck className="h-4 w-4" />}
              label={t("production.overview.good_output", "Good output")}
              value={overview.oee.good_units.toLocaleString()}
              meta={`${overview.oee.reject_units.toLocaleString()} ${t("production.overview.rejected", "rejected")}`}
            />
            <SummaryTile
              href="/dashboard/production/orders?qa_status=pending"
              icon={<ShieldCheck className="h-4 w-4" />}
              label={t("production.overview.awaiting_qa", "Batches awaiting QA")}
              value={overview.orders.awaiting_qa.toLocaleString()}
              meta={`${overview.orders.quarantined.toLocaleString()} ${t("production.overview.quarantined", "quarantined or rejected")}`}
              alert={overview.orders.quarantined > 0}
            />
            <SummaryTile
              icon={<Droplets className="h-4 w-4" />}
              label={t("production.overview.water_compliance", "Treated water compliance")}
              value={`${overview.water_treatment.compliance_percent.toFixed(1)}%`}
              meta={`${overview.water_treatment.logs.toLocaleString()} ${t("production.overview.readings", "readings")} · ${overview.water_treatment.failed} ${t("production.overview.failed", "failed")}`}
              alert={overview.water_treatment.failed > 0}
            />
          </div>

          {/* The jar fleet is a standing position rather than a period figure,
              so it sits apart from the OEE row it would otherwise be read against. */}
          {overview.containers && overview.containers.by_type.length > 0 ? (
            <Panel
              title={t("production.overview.containers", "Returnable jar fleet")}
              description={t(
                "production.overview.containers_desc",
                "Containers out with customers right now, and the refundable deposit the plant is holding against them.",
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">{t("production.containers.col_type", "Container")}</th>
                      <th className="py-2 pr-3 text-right font-semibold">
                        {t("production.overview.in_circulation", "In circulation")}
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold">
                        {t("production.containers.col_deposit", "Deposit Held")}
                      </th>
                      <th className="py-2 text-right font-semibold">
                        {t("production.containers.col_return_rate", "Return Rate")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.containers.by_type.map((row) => (
                      <tr key={row.container_type_id} className="border-b border-border/30">
                        <td className="py-2 pr-3 font-medium">{row.name}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {row.containers_out.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          ETB {row.deposit_held.toLocaleString()}
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {row.return_rate_percent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="py-2 pr-3">{t("production.overview.total", "Total")}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {overview.containers.total_containers_out.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        ETB {overview.containers.total_deposit_held.toLocaleString()}
                      </td>
                      <td className="py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title={t("production.overview.downtime_pareto", "Downtime by cause")}
              description={t(
                "production.overview.downtime_desc",
                "Stoppage minutes ranked by reason. The top bar is where the next hour of uptime is.",
              )}
            >
              <ParetoBars
                rows={overview.downtime_pareto.map((row) => ({
                  key: row.reason_code,
                  label: row.label,
                  value: row.minutes,
                  sharePercent: row.share_percent,
                  meta: `${row.occurrences} ${t("production.overview.stoppages", "stoppage(s)")} · ${row.category}`,
                }))}
                valueSuffix={` ${t("production.common.min", "min")}`}
                emptyLabel={t("production.overview.no_downtime", "No downtime recorded in this period.")}
              />
            </Panel>

            <Panel
              title={t("production.overview.reject_pareto", "Rejects by defect")}
              description={t(
                "production.overview.reject_desc",
                "Units scrapped, grouped by the defect the shift log recorded.",
              )}
            >
              <ParetoBars
                rows={overview.reject_pareto.map((row) => ({
                  key: row.defect_code,
                  label: row.label,
                  value: row.units,
                  sharePercent: row.share_percent,
                }))}
                valueSuffix={` ${t("production.common.units", "units")}`}
                emptyLabel={t("production.overview.no_rejects", "No rejects recorded in this period.")}
              />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title={t("production.overview.daily_output", "Daily output")}
              description={t("production.overview.daily_output_desc", "Good units against rejects, day by day.")}
            >
              <DailyOutputChart
                rows={overview.daily_output}
                emptyLabel={t("production.overview.no_output", "No shift runs recorded in this period.")}
              />
            </Panel>

            <Panel
              title={t("production.overview.line_performance", "Line performance")}
              description={t("production.overview.line_performance_desc", "OEE broken down by line.")}
            >
              {overview.line_performance.length === 0 ? (
                <p className="py-6 text-center text-sm italic text-muted-foreground">
                  {t("production.overview.no_lines", "No line activity in this period.")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">{t("production.common.line", "Line")}</th>
                        <th className="py-2 pr-3 text-right font-semibold">OEE</th>
                        <th className="py-2 pr-3 text-right font-semibold">A</th>
                        <th className="py-2 pr-3 text-right font-semibold">P</th>
                        <th className="py-2 pr-3 text-right font-semibold">Q</th>
                        <th className="py-2 text-right font-semibold">
                          {t("production.overview.downtime", "Downtime")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.line_performance.map((row) => (
                        <tr key={row.production_line_id ?? "unassigned"} className="border-b border-border/30">
                          <td className="py-2 pr-3 font-medium">{row.line_name}</td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{row.oee.toFixed(1)}%</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{row.availability.toFixed(1)}%</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{row.performance.toFixed(1)}%</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{row.quality.toFixed(1)}%</td>
                          <td className="py-2 text-right tabular-nums">
                            {row.downtime_minutes.toLocaleString()} {t("production.common.min", "min")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  meta,
  alert = false,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
  alert?: boolean;
  href?: string;
}) {
  const content = (
    <div className="rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {alert ? <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden /> : null}
        {meta}
      </p>
    </div>
  );

  return href ? <Link href={href} className="block">{content}</Link> : content;
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <header className="mb-4">
        <h2 className="text-base font-black tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}
