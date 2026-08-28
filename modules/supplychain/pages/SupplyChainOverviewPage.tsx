"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, PackageSearch, RefreshCw, Ship, Truck, Undo2 } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { SupplyChainOverview } from "@/modules/supplychain/types";
import { EmptyPanel, Panel, ServiceMeter, StatTile } from "@/modules/shared/charts/primitives";
import { SupplyChainOverviewSkeleton } from "@/modules/supplychain/pages/components/supply-chain-skeletons";
import {
  ColumnChart,
  RankedBarChart,
  SeverityBands,
  TrendChart,
} from "@/modules/shared/charts/charts";

const PRESETS = [7, 30, 90] as const;

const SC = {
  shipments: "/dashboard/supply-chain/shipments",
  replenishment: "/dashboard/supply-chain/replenishment",
  transfers: "/dashboard/supply-chain/transfers",
  returns: "/dashboard/supply-chain/returns",
  landedCosts: "/dashboard/supply-chain/landed-costs",
  routes: "/dashboard/supply-chain/routes",
} as const;

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

function formatMoney(value: number, currency: string) {
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPeriodDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function shortageLabel(row: SupplyChainOverview["replenishment"]["top_shortages"][number]) {
  const product = row.product_name || row.product_sku || `Product #${row.product_id}`;
  const warehouse = row.warehouse_name || row.warehouse_code;
  return warehouse ? `${product} · ${warehouse}` : product;
}

function PanelLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export default function SupplyChainOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(29));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [preset, setPreset] = React.useState<number | null>(30);

  const overviewQuery = useQuery({
    queryKey: ["supply-chain", "overview", from, to],
    queryFn: () => supplyChainApi.overview({ from, to }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const raw: SupplyChainOverview | undefined = overviewQuery.data?.data;
  const refetching = overviewQuery.isFetching && !overviewQuery.isLoading;

  const overview = React.useMemo(() => {
    if (!raw) return undefined;

    const n = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return {
      ...raw,
      base_currency: raw.base_currency || "ETB",
      targets: {
        otif: n(raw.targets?.otif),
        fill_rate: n(raw.targets?.fill_rate),
        return_rate: n(raw.targets?.return_rate),
      },
      service: {
        ...raw.service,
        shipments_total: n(raw.service?.shipments_total),
        shipments_completed: n(raw.service?.shipments_completed),
        shipments_in_flight: n(raw.service?.shipments_in_flight),
        shipments_failed: n(raw.service?.shipments_failed),
        otif_count: n(raw.service?.otif_count),
        fill_rate_percent: n(raw.service?.fill_rate_percent),
        otif_percent: n(raw.service?.otif_percent),
        units_delivered: n(raw.service?.units_delivered),
        delivered_value: n(raw.service?.delivered_value),
      },
      replenishment: {
        ...raw.replenishment,
        open_suggestions: n(raw.replenishment?.open_suggestions),
        critical: n(raw.replenishment?.critical),
        high: n(raw.replenishment?.high),
        suggested_units: n(raw.replenishment?.suggested_units),
        profiles_active: n(raw.replenishment?.profiles_active),
        stockout_risk: n(raw.replenishment?.stockout_risk),
        top_shortages: (raw.replenishment?.top_shortages ?? []).map((row) => ({
          ...row,
          shortfall: n(row.shortfall),
          projected_position: n(row.projected_position),
          suggested_quantity: n(row.suggested_quantity),
        })),
      },
      transfers: {
        in_transit_orders: n(raw.transfers?.in_transit_orders),
        in_transit_units: n(raw.transfers?.in_transit_units),
        awaiting_dispatch: n(raw.transfers?.awaiting_dispatch),
        draft_orders: n(raw.transfers?.draft_orders),
      },
      returns: {
        ...raw.returns,
        total: n(raw.returns?.total),
        open: n(raw.returns?.open),
        units_returned: n(raw.returns?.units_returned),
        credit_value: n(raw.returns?.credit_value),
        return_rate_percent: n(raw.returns?.return_rate_percent),
        by_reason: (raw.returns?.by_reason ?? []).map((row) => ({
          ...row,
          units: n(row.units),
          count: n(row.count),
        })),
      },
      landed_cost: {
        ...raw.landed_cost,
        consignments: n(raw.landed_cost?.consignments),
        goods_value_base: n(raw.landed_cost?.goods_value_base),
        overhead_total: n(raw.landed_cost?.overhead_total),
        total_landed_cost: n(raw.landed_cost?.total_landed_cost),
        average_overhead_percent: n(raw.landed_cost?.average_overhead_percent),
      },
      route_performance: (raw.route_performance ?? []).map((row) => ({
        ...row,
        shipments: n(row.shipments),
        fill_rate_percent: n(row.fill_rate_percent),
        on_time_percent: n(row.on_time_percent),
        otif_percent: n(row.otif_percent),
        units_delivered: n(row.units_delivered),
      })),
      daily_service: (raw.daily_service ?? []).map((row) => ({
        ...row,
        shipments: n(row.shipments),
        delivered_units: n(row.delivered_units),
        fill_rate_percent: n(row.fill_rate_percent),
        otif_percent: n(row.otif_percent),
      })),
      shipment_status_mix: (raw.shipment_status_mix ?? []).map((row) => ({
        ...row,
        count: n(row.count),
        units: n(row.units),
      })),
      cover_distribution: (raw.cover_distribution ?? []).map((row) => ({ ...row, count: n(row.count) })),
      landed_cost_breakdown: (raw.landed_cost_breakdown ?? []).map((row) => ({
        ...row,
        amount: n(row.amount),
        share_percent: n(row.share_percent),
      })),
    } satisfies SupplyChainOverview;
  }, [raw]);

  const applyPreset = (days: number) => {
    setPreset(days);
    setFrom(isoDaysAgo(days - 1));
    setTo(isoDaysAgo(0));
  };

  const currency = overview?.base_currency ?? "ETB";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("supply_chain.overview.title", "Supply Chain Overview")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.overview.subtitle",
              "Service performance on the road, shortages coming down the line, and what imports are really costing.",
            )}
          </p>
          {overview?.period ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("supply_chain.overview.period", "Showing {from} – {to}")
                .replace("{from}", formatPeriodDate(overview.period.from))
                .replace("{to}", formatPeriodDate(overview.period.to))}
            </p>
          ) : null}
        </div>
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
              {t("supply_chain.overview.last_days", "Last {n} days").replace("{n}", String(days))}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="sc-from" className="text-xs">
            {t("supply_chain.common.from", "From")}
          </Label>
          <Input
            id="sc-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset(null);
            }}
            className="h-9 w-[9.5rem]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sc-to" className="text-xs">
            {t("supply_chain.common.to", "To")}
          </Label>
          <Input
            id="sc-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset(null);
            }}
            className="h-9 w-[9.5rem]"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full"
          disabled={overviewQuery.isFetching}
          onClick={() => overviewQuery.refetch()}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />
          {t("supply_chain.common.refresh", "Refresh")}
        </Button>
      </div>

      {overviewQuery.isLoading ? (
        <SupplyChainOverviewSkeleton />
      ) : overviewQuery.isError ? (
        <div className="space-y-3">
          <EmptyPanel
            label={t(
              "supply_chain.overview.load_failed",
              "Could not load supply chain metrics. Check your connection and try again.",
            )}
          />
          <div className="flex justify-center">
            <Button variant="outline" className="rounded-full" onClick={() => overviewQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("supply_chain.common.retry", "Retry")}
            </Button>
          </div>
        </div>
      ) : !overview ? (
        <EmptyPanel
          label={t("supply_chain.overview.unavailable", "Supply chain metrics are not available right now.")}
        />
      ) : (
        <>
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("supply_chain.overview.otif_full", "On time, in full")}
              </p>
              <p className="mt-1 text-6xl font-black leading-none tracking-tight">
                {overview.service.otif_percent.toFixed(1)}
                <span className="ml-1 text-2xl font-bold text-muted-foreground">%</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  "supply_chain.overview.otif_meta",
                  "{done} of {total} completed deliveries, against a {target}% target",
                )
                  .replace("{done}", String(overview.service.otif_count))
                  .replace("{total}", String(overview.service.shipments_completed))
                  .replace("{target}", String(Math.round(overview.targets.otif * 100)))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {overview.service.shipments_total.toLocaleString()}{" "}
                {t("supply_chain.overview.shipments_in_period", "shipments in period")} ·{" "}
                {formatMoney(overview.service.delivered_value, currency)}{" "}
                {t("supply_chain.overview.delivered_value", "delivered value")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                href={SC.shipments}
                label={t("supply_chain.overview.fill_rate", "Fill rate")}
                value={`${overview.service.fill_rate_percent.toFixed(1)}%`}
                meta={`${overview.service.units_delivered.toLocaleString()} ${t("supply_chain.overview.units_delivered", "units delivered")}`}
              />
              <StatTile
                href={SC.shipments}
                icon={<Truck className="h-4 w-4" />}
                label={t("supply_chain.overview.in_flight", "In flight")}
                value={overview.service.shipments_in_flight.toLocaleString()}
                meta={`${overview.service.shipments_failed} ${t("supply_chain.overview.failed", "failed in period")}`}
                alert={overview.service.shipments_failed > 0}
              />
              <StatTile
                href={SC.replenishment}
                icon={<PackageSearch className="h-4 w-4" />}
                label={t("supply_chain.overview.stockout_risk", "Stockout risk")}
                value={overview.replenishment.stockout_risk.toLocaleString()}
                meta={`${overview.replenishment.critical} ${t("supply_chain.overview.critical_suggestions", "critical")} · ${overview.replenishment.high} ${t("supply_chain.overview.high", "high")}`}
                alert={overview.replenishment.stockout_risk > 0}
              />
              <StatTile
                href={SC.landedCosts}
                icon={<Ship className="h-4 w-4" />}
                label={t("supply_chain.overview.import_uplift", "Import uplift")}
                value={`${overview.landed_cost.average_overhead_percent.toFixed(1)}%`}
                meta={`${overview.landed_cost.consignments} ${t("supply_chain.overview.posted_consignments", "posted consignment(s)")}`}
              />
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <ServiceMeter
              label={t("supply_chain.overview.fill_rate", "Fill rate")}
              value={overview.service.fill_rate_percent}
              target={overview.targets.fill_rate}
            />
            <ServiceMeter
              label={t("supply_chain.overview.return_rate", "Return rate")}
              value={overview.returns.return_rate_percent}
              target={overview.targets.return_rate}
              lowerIsBetter
            />
            <StatTile
              href={SC.replenishment}
              label={t("supply_chain.overview.planning_profiles", "Active planning profiles")}
              value={overview.replenishment.profiles_active.toLocaleString()}
              meta={`${overview.replenishment.open_suggestions.toLocaleString()} ${t("supply_chain.overview.open_suggestions", "open suggestions")}`}
            />
          </div>

          <TrendChart
            title={t("supply_chain.overview.service_trend", "Service trend")}
            description={t(
              "supply_chain.overview.service_trend_desc",
              "On-time-in-full against fill rate, day by day. Days with no completed delivery are left out rather than plotted as zero.",
            )}
            points={overview.daily_service.map((row) => ({
              date: row.date,
              otif_percent: row.otif_percent,
              fill_rate_percent: row.fill_rate_percent,
            }))}
            series={[
              { key: "otif_percent", label: t("supply_chain.overview.otif", "OTIF"), suffix: "%" },
              { key: "fill_rate_percent", label: t("supply_chain.overview.fill_rate", "Fill rate"), suffix: "%" },
            ]}
            maxValue={100}
            emptyLabel={t("supply_chain.overview.no_deliveries", "No completed deliveries in this period.")}
            dimmed={refetching}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <ColumnChart
              title={t("supply_chain.overview.daily_volume", "Delivered volume")}
              description={t("supply_chain.overview.daily_volume_desc", "Units that actually reached customers each day.")}
              rows={overview.daily_service.map((row) => ({
                key: row.date,
                label: row.date.slice(5),
                value: row.delivered_units,
                meta: `${row.shipments} ${t("supply_chain.common.shipments", "shipment(s)")} · ${row.fill_rate_percent.toFixed(1)}% fill`,
              }))}
              valueLabel={t("supply_chain.common.units", "units")}
              emptyLabel={t("supply_chain.overview.no_deliveries", "No completed deliveries in this period.")}
              dimmed={refetching}
            />

            <SeverityBands
              title={t("supply_chain.overview.cover", "Cover remaining")}
              description={t(
                "supply_chain.overview.cover_desc",
                "How long the open shortages last at current demand. The top band is already short.",
              )}
              bands={overview.cover_distribution}
              emptyLabel={t("supply_chain.overview.no_shortages", "Nothing is below its reorder point.")}
              dimmed={refetching}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <RankedBarChart
              title={t("supply_chain.overview.top_shortages", "Biggest shortages")}
              description={t(
                "supply_chain.overview.top_shortages_desc",
                "Products furthest below cover once orders and demand are netted off.",
              )}
              rows={overview.replenishment.top_shortages.map((row) => ({
                key: `${row.product_id}-${row.warehouse_id ?? "all"}`,
                label: shortageLabel(row),
                value: row.shortfall,
                meta: `${row.urgency} · ${t("supply_chain.overview.projected", "projected")} ${row.projected_position.toLocaleString()} · ${t("supply_chain.overview.suggest", "suggest")} ${row.suggested_quantity.toLocaleString()}${
                  row.days_of_cover != null ? ` · ${row.days_of_cover.toFixed(1)} ${t("supply_chain.overview.days_cover", "days cover")}` : ""
                }`,
              }))}
              valueLabel={t("supply_chain.overview.shortfall", "shortfall")}
              emptyLabel={t("supply_chain.overview.no_shortages", "Nothing is below its reorder point.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("supply_chain.overview.returns_by_reason", "Returns by reason")}
              description={t("supply_chain.overview.returns_by_reason_desc", "Why goods are coming back.")}
              rows={overview.returns.by_reason.map((row) => ({
                key: row.reason,
                label: row.reason.replace(/_/g, " "),
                value: row.units,
                meta: `${row.count} ${t("supply_chain.overview.cases", "case(s)")}`,
              }))}
              valueLabel={t("supply_chain.common.units", "units")}
              emptyLabel={t("supply_chain.overview.no_returns", "No returns in this period.")}
              dimmed={refetching}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <RankedBarChart
              title={t("supply_chain.overview.import_charges", "Import charges")}
              description={t(
                "supply_chain.overview.import_charges_desc",
                "Overhead on posted import consignments in this period.",
              )}
              rows={overview.landed_cost_breakdown.map((row) => ({
                key: row.component,
                label: row.label,
                value: row.amount,
                meta: `${row.share_percent.toFixed(1)}% ${t("supply_chain.overview.of_overhead", "of overhead")}`,
              }))}
              valueLabel={currency}
              emptyLabel={t("supply_chain.overview.no_imports", "No posted import consignments in this period.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("supply_chain.overview.shipment_mix", "Shipments by status")}
              description={t("supply_chain.overview.shipment_mix_desc", "Shipments created or delivered in this period.")}
              rows={overview.shipment_status_mix.map((row) => ({
                key: row.status,
                label: row.status.replace(/_/g, " "),
                value: row.count,
                meta: `${row.units.toLocaleString()} ${t("supply_chain.common.units", "units")}`,
              }))}
              valueLabel={t("supply_chain.common.shipments", "shipments")}
              emptyLabel={t("supply_chain.overview.no_shipments", "No shipments in this period.")}
              dimmed={refetching}
            />
          </div>

          <Panel
            title={t("supply_chain.overview.route_performance", "Route performance")}
            description={t(
              "supply_chain.overview.route_performance_desc",
              "How each delivery round is actually serving customers.",
            )}
            action={<PanelLink href={SC.routes} label={t("supply_chain.overview.view_routes", "View routes")} />}
          >
            {overview.route_performance.length === 0 ? (
              <p className="py-6 text-center text-sm italic text-muted-foreground">
                {t("supply_chain.overview.no_routes", "No completed deliveries in this period.")}
              </p>
            ) : (
              <div className={`overflow-x-auto ${refetching ? "opacity-50" : ""} transition-opacity`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">{t("supply_chain.common.route", "Route")}</th>
                      <th className="py-2 pr-3 text-right font-semibold">
                        {t("supply_chain.common.shipments", "Shipments")}
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold">
                        {t("supply_chain.overview.fill_rate", "Fill rate")}
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold">
                        {t("supply_chain.overview.on_time", "On time")}
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold">{t("supply_chain.overview.otif", "OTIF")}</th>
                      <th className="py-2 text-right font-semibold">{t("supply_chain.overview.units", "Units")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.route_performance.map((row) => (
                      <tr key={row.route_id ?? "unassigned"} className="border-b border-border/30">
                        <td className="py-2 pr-3 font-medium">{row.route_name}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.shipments}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.fill_rate_percent.toFixed(1)}%</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.on_time_percent.toFixed(1)}%</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.otif_percent.toFixed(1)}%</td>
                        <td className="py-2 text-right tabular-nums">{row.units_delivered.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              href={SC.transfers}
              icon={<ArrowLeftRight className="h-4 w-4" />}
              label={t("supply_chain.overview.in_transit", "Stock in transit")}
              value={overview.transfers.in_transit_units.toLocaleString()}
              meta={`${overview.transfers.in_transit_orders} ${t("supply_chain.overview.transfer_orders", "order(s)")} · ${overview.transfers.awaiting_dispatch} ${t("supply_chain.overview.awaiting_dispatch", "awaiting dispatch")}`}
            />
            <StatTile
              href={SC.returns}
              icon={<Undo2 className="h-4 w-4" />}
              label={t("supply_chain.overview.returns", "Returns")}
              value={overview.returns.units_returned.toLocaleString()}
              meta={`${overview.returns.open} ${t("supply_chain.overview.open_cases", "open")} · ${overview.returns.total} ${t("supply_chain.overview.total_cases", "total")} · ${formatMoney(overview.returns.credit_value, currency)}`}
              alert={overview.returns.open > 0}
            />
            <StatTile
              href={SC.replenishment}
              label={t("supply_chain.overview.open_suggestions", "Open replenishment")}
              value={overview.replenishment.open_suggestions.toLocaleString()}
              meta={`${overview.replenishment.suggested_units.toLocaleString()} ${t("supply_chain.overview.units_suggested", "units suggested")}`}
            />
            <StatTile
              href={SC.landedCosts}
              label={t("supply_chain.overview.landed_total", "Landed cost booked")}
              value={formatMoney(overview.landed_cost.total_landed_cost, currency)}
              meta={`${t("supply_chain.overview.goods", "goods")} ${formatMoney(overview.landed_cost.goods_value_base, currency)} · ${t("supply_chain.overview.overheads", "overheads")} ${formatMoney(overview.landed_cost.overhead_total, currency)}`}
            />
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <PanelLink href={SC.shipments} label={t("supply_chain.overview.go_shipments", "Shipments")} />
            <PanelLink href={SC.replenishment} label={t("supply_chain.overview.go_replenishment", "Replenishment")} />
            <PanelLink href={SC.transfers} label={t("supply_chain.overview.go_transfers", "Transfers")} />
            <PanelLink href={SC.returns} label={t("supply_chain.overview.go_returns", "Returns")} />
            <PanelLink href={SC.landedCosts} label={t("supply_chain.overview.go_landed", "Landed costs")} />
            <PanelLink href={SC.routes} label={t("supply_chain.overview.go_routes", "Routes")} />
          </div>
        </>
      )}
    </div>
  );
}
