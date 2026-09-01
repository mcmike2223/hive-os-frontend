"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileText, RefreshCw, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/store/use-translation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchInventoryProducts } from "@/modules/inventory/api";
import type { ProductRecord } from "@/modules/inventory/types";
import { hrFetch, type Employee as HrEmployee, type Paginated as HrPaginated } from "@/modules/humanresources/api";
import { salesApi } from "@/modules/sales/api";
import type { SalesOverview } from "@/modules/sales/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart, TrendChart } from "@/modules/shared/charts/charts";

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

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  const data = (payload as { data?: T[] })?.data;
  return Array.isArray(data) ? data : [];
}

function employeeLabel(employees: Map<number, HrEmployee>, id: number | null | undefined) {
  if (id == null) return null;
  const employee = employees.get(id);
  if (employee) return `${employee.primary_name} (${employee.employee_number})`;
  return `#${id}`;
}

function productLabel(products: Map<number, ProductRecord>, id: number) {
  const product = products.get(id);
  if (product) return product.sku ? `${product.name} (${product.sku})` : product.name;
  return `#${id}`;
}

const money = (value: unknown, currency = "ETB") =>
  `${currency} ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function SalesOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(89));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [preset, setPreset] = React.useState<number | null>(90);

  const overviewQuery = useQuery({
    queryKey: ["sales", "overview", from, to],
    queryFn: () => salesApi.overview({ from, to }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", "sales-overview"],
    queryFn: () => hrFetch<HrPaginated<HrEmployee>>("/employees?per_page=200"),
    staleTime: 5 * 60 * 1000,
  });

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "sales-overview"],
    queryFn: async () => unwrapList<ProductRecord>(await fetchInventoryProducts({ per_page: 200, limit: 200 })),
    staleTime: 5 * 60 * 1000,
  });

  const raw: SalesOverview | undefined = overviewQuery.data?.data;
  const refetching = overviewQuery.isFetching && !overviewQuery.isLoading;
  const currency = raw?.display_currency ?? "ETB";

  const employeeById = React.useMemo(() => {
    const map = new Map<number, HrEmployee>();
    for (const employee of employeesQuery.data?.data ?? []) {
      map.set(employee.id, employee);
    }
    return map;
  }, [employeesQuery.data]);

  const productById = React.useMemo(() => {
    const map = new Map<number, ProductRecord>();
    for (const product of productsQuery.data ?? []) {
      map.set(product.id, product);
    }
    return map;
  }, [productsQuery.data]);

  const applyPreset = (days: number) => {
    setPreset(days);
    setFrom(isoDaysAgo(days - 1));
    setTo(isoDaysAgo(0));
  };

  const openOrdersMeta = React.useMemo(() => {
    if (!raw) return "";
    const parts: string[] = [];
    const overdue = n(raw.fulfilment?.overdue_orders);
    const awaiting = n(raw.fulfilment?.awaiting_approval);
    const openValue = n(raw.fulfilment?.open_value);

    if (overdue > 0) {
      parts.push(
        t("sales.overview.overdue_meta", "{n} past their delivery date").replace("{n}", String(overdue)),
      );
    }
    if (awaiting > 0) {
      parts.push(
        t("sales.overview.awaiting_approval_meta", "{n} awaiting approval").replace("{n}", String(awaiting)),
      );
    }
    if (openValue > 0) {
      parts.push(
        t("sales.overview.open_value_meta", "{value} still to fulfil").replace("{value}", money(openValue, currency)),
      );
    }
    if (parts.length === 0) {
      parts.push(t("sales.overview.no_open_orders_meta", "Nothing waiting to ship"));
    }
    return parts.join(" · ");
  }, [currency, raw, t]);

  const pipelineMeta = React.useMemo(() => {
    if (!raw) return "";
    const parts = [
      t("sales.overview.pipeline_meta", "{value} still open").replace(
        "{value}",
        money(raw.pipeline?.open_value, currency),
      ),
    ];
    const expiring = n(raw.pipeline?.expiring_soon);
    if (expiring > 0) {
      parts.push(
        t("sales.overview.expiring_soon_meta", "{n} expiring soon").replace("{n}", String(expiring)),
      );
    }
    return parts.join(" · ");
  }, [currency, raw, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("sales.overview.title", "Sales Overview")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "sales.overview.subtitle",
            "What was sold, what is still quoted, what is late out the door, and who earned what.",
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
              {t("sales.overview.last_days", "Last {n} days").replace("{n}", String(days))}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="sales-from" className="text-xs">
            {t("sales.common.from", "From")}
          </Label>
          <Input
            id="sales-from"
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
          <Label htmlFor="sales-to" className="text-xs">
            {t("sales.common.to", "To")}
          </Label>
          <Input
            id="sales-to"
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

        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full"
          disabled={overviewQuery.isFetching}
          onClick={() => overviewQuery.refetch()}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />
          {t("sales.common.refresh", "Refresh")}
        </Button>
      </div>

      {overviewQuery.isLoading ? (
        <LoadingPanel label={t("sales.common.loading", "Loading sales performance...")} />
      ) : overviewQuery.isError ? (
        <div className="space-y-3">
          <EmptyPanel
            label={t(
              "sales.overview.load_failed",
              "Could not load sales metrics. Check your connection and try again.",
            )}
          />
          <div className="flex justify-center">
            <Button variant="outline" className="rounded-full" onClick={() => overviewQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("sales.common.retry", "Retry")}
            </Button>
          </div>
        </div>
      ) : !raw ? (
        <EmptyPanel label={t("sales.overview.unavailable", "Sales metrics are not available right now.")} />
      ) : (
        <>
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("sales.overview.booked", "Revenue booked")}
              </p>
              <p className="mt-1 text-5xl font-black leading-none tracking-tight">
                {money(raw.revenue?.booked, currency)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("sales.overview.booked_meta", "{orders} orders, averaging {avg}")
                  .replace("{orders}", String(n(raw.revenue?.orders)))
                  .replace("{avg}", money(raw.revenue?.average_order_value, currency))}
              </p>
              {n(raw.revenue?.cancelled_orders) > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("sales.overview.cancelled_meta", "{n} cancelled ({value})")
                    .replace("{n}", String(n(raw.revenue?.cancelled_orders)))
                    .replace("{value}", money(raw.revenue?.cancelled_value, currency))}
                </p>
              ) : null}
              {n(raw.targets?.target_amount) > 0 ? (
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {t("sales.overview.attainment", "{pct}% of target").replace(
                    "{pct}",
                    n(raw.targets?.attainment_percent).toFixed(0),
                  )}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<TrendingUp className="h-4 w-4" />}
                label={t("sales.overview.margin", "Gross margin")}
                value={`${n(raw.revenue?.margin_percent).toFixed(1)}%`}
                meta={money(raw.revenue?.margin, currency)}
              />
              <StatTile
                icon={<FileText className="h-4 w-4" />}
                label={t("sales.overview.win_rate", "Quote win rate")}
                value={`${n(raw.pipeline?.win_rate_percent).toFixed(0)}%`}
                meta={pipelineMeta}
              />
              <StatTile
                icon={<ClipboardList className="h-4 w-4" />}
                label={t("sales.overview.open_orders", "Open orders")}
                value={n(raw.fulfilment?.open_orders).toLocaleString()}
                meta={openOrdersMeta}
                alert={n(raw.fulfilment?.overdue_orders) > 0 || n(raw.fulfilment?.awaiting_approval) > 0}
              />
              <StatTile
                icon={<Users className="h-4 w-4" />}
                label={t("sales.overview.customers", "Customers buying")}
                value={n(raw.customers?.active).toLocaleString()}
                meta={t("sales.overview.customers_meta", "of {n} on the books").replace(
                  "{n}",
                  String(n(raw.customers?.total)),
                )}
              />
            </div>
          </section>

          <TrendChart
            title={t("sales.overview.daily_revenue", "Revenue over time")}
            description={t(
              "sales.overview.daily_revenue_desc",
              "Booked order value by the day it was placed.",
            )}
            points={(raw.daily ?? []).map((row) => ({
              date: row.date,
              revenue: n(row.revenue),
            }))}
            series={[{ key: "revenue", label: t("sales.overview.revenue", "Revenue") }]}
            emptyLabel={t("sales.overview.no_sales", "Nothing was sold in this range.")}
            dimmed={refetching}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <ColumnChart
              title={t("sales.overview.quote_funnel", "Quotation funnel")}
              description={
                n(raw.pipeline?.expiring_soon) > 0
                  ? t(
                      "sales.overview.quote_funnel_expiring_desc",
                      "Where offers are sitting between draft and converted. {n} expire within 7 days.",
                    ).replace("{n}", String(n(raw.pipeline?.expiring_soon)))
                  : t(
                      "sales.overview.quote_funnel_desc",
                      "Where offers are sitting between draft and converted.",
                    )
              }
              rows={(raw.pipeline?.by_status ?? []).map((row) => ({
                key: row.status,
                label: row.label,
                value: n(row.count),
                meta: money(row.value, currency),
              }))}
              valueLabel={t("sales.overview.quotations", "Quotations")}
              emptyLabel={t("sales.overview.no_quotes", "No quotations in this range.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("sales.overview.order_stages", "Orders by stage")}
              description={t(
                "sales.overview.order_stages_desc",
                "How far each committed order has travelled.",
              )}
              rows={(raw.fulfilment?.by_status ?? []).map((row) => ({
                key: row.status,
                label: row.label,
                value: n(row.count),
              }))}
              valueLabel={t("sales.overview.orders", "Orders")}
              emptyLabel={t("sales.overview.no_orders", "No orders in this range.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("sales.overview.top_customers", "Top customers")}
              description={t(
                "sales.overview.top_customers_desc",
                "Who the revenue actually came from.",
              )}
              rows={(raw.customers?.top ?? []).map((row) => ({
                key: String(row.customer_id),
                label: row.customer,
                value: n(row.revenue),
                meta: t("sales.overview.orders_count", "{n} orders").replace(
                  "{n}",
                  String(n(row.orders)),
                ),
              }))}
              valueLabel={t("sales.overview.revenue", "Revenue")}
              emptyLabel={t("sales.overview.no_customers", "No customer revenue yet.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("sales.overview.top_products", "Top products")}
              description={t(
                "sales.overview.top_products_desc",
                "What is selling, by the value it brought in.",
              )}
              rows={(raw.products ?? []).map((row) => ({
                key: String(row.product_id),
                label: productLabel(productById, row.product_id),
                value: n(row.revenue),
                meta: t("sales.overview.units", "{n} units").replace(
                  "{n}",
                  n(row.quantity).toLocaleString(),
                ),
              }))}
              valueLabel={t("sales.overview.revenue", "Revenue")}
              emptyLabel={t("sales.overview.no_products", "No product revenue yet.")}
              dimmed={refetching}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={t("sales.overview.target_attainment", "Target attainment")}
              description={t(
                "sales.overview.target_attainment_desc",
                "Booked revenue against the target set for each owner.",
              )}
              action={
                <Link
                  href="/dashboard/sales/targets"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {t("sales.overview.manage", "Manage")}
                </Link>
              }
            >
              {(raw.targets?.by_owner ?? []).length === 0 ? (
                <EmptyPanel label={t("sales.overview.no_targets", "No targets have been set.")} />
              ) : (
                <div className="space-y-3">
                  {raw.targets.by_owner.map((row) => {
                    const percent = n(row.attainment_percent);
                    return (
                      <div key={String(row.owner_employee_id ?? "company")} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {row.owner_employee_id
                              ? employeeLabel(employeeById, row.owner_employee_id) ??
                                `${t("sales.overview.owner", "Owner")} #${row.owner_employee_id}`
                              : t("sales.overview.company_wide", "Company-wide")}
                          </span>
                          <span className="tabular-nums">
                            {money(row.actual, currency)} / {money(row.target, currency)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{percent.toFixed(0)}%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel
              title={t("sales.overview.commission", "Commission")}
              description={t(
                "sales.overview.commission_range_desc",
                "Earned on confirmed orders in {from} to {to}, by state of approval.",
              )
                .replace("{from}", from)
                .replace("{to}", to)}
              action={
                <Link
                  href="/dashboard/sales/targets"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {t("sales.overview.view_commissions", "View all")}
                </Link>
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label={t("sales.overview.accrued", "Accrued")}
                  value={money(raw.commissions?.accrued, currency)}
                />
                <StatTile
                  label={t("sales.overview.approved", "Approved")}
                  value={money(raw.commissions?.approved, currency)}
                />
                <StatTile
                  label={t("sales.overview.paid", "Paid")}
                  value={money(raw.commissions?.paid, currency)}
                />
              </div>

              {(raw.commissions?.by_employee ?? []).length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-border/40 pt-4">
                  {raw.commissions.by_employee.slice(0, 5).map((row) => (
                    <div
                      key={row.employee_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {employeeLabel(employeeById, row.employee_id) ??
                          `${t("sales.overview.employee", "Employee")} #${row.employee_id}`}
                      </span>
                      <span className="tabular-nums">
                        {money(row.amount, currency)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t("sales.overview.orders_count", "{n} orders").replace(
                            "{n}",
                            String(n(row.orders)),
                          )}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 border-t border-border/40 pt-4 text-sm italic text-muted-foreground">
                  {t("sales.overview.no_commissions", "No commission recorded in this range.")}
                </p>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
