"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, PackageMinus, Warehouse as WarehouseIcon } from "lucide-react";
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
import { warehouseApi } from "@/modules/warehouse/api";
import type { Warehouse, WarehouseOverview } from "@/modules/warehouse/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart, SeverityBands, TrendChart } from "@/modules/shared/charts/charts";

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const PRESETS = [7, 30, 90] as const;

export default function WarehouseOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(29));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [preset, setPreset] = React.useState<number | null>(30);
  const [warehouseId, setWarehouseId] = React.useState("all");

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "warehouses", "select"],
    queryFn: () => warehouseApi.listWarehouses({ limit: 100 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["warehouse", "overview", from, to, warehouseId],
    queryFn: () =>
      warehouseApi
        .overview({ from, to, warehouse_id: warehouseId === "all" ? undefined : warehouseId })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const warehouses: Warehouse[] = warehousesQuery.data?.data ?? [];
  const raw: WarehouseOverview | undefined = overviewQuery.data?.data;
  const refetching = overviewQuery.isFetching && !overviewQuery.isLoading;

  /**
   * Coerce before rendering. A field the API has not shipped yet arrives as
   * undefined, and one `undefined.toLocaleString()` takes the page down through
   * the error boundary — the dashboard should degrade to zeros instead.
   */
  const overview = React.useMemo(() => {
    if (!raw) return undefined;

    const n = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return {
      stock: {
        on_hand: n(raw.stock?.on_hand),
        reserved: n(raw.stock?.reserved),
        available: n(raw.stock?.available),
        in_transit: n(raw.stock?.in_transit),
        stock_value: n(raw.stock?.stock_value),
        uncosted_lines: n(raw.stock?.uncosted_lines),
        distinct_products: n(raw.stock?.distinct_products),
        stock_lines: n(raw.stock?.stock_lines),
        negative_lines: n(raw.stock?.negative_lines),
      },
      movements: {
        total: n(raw.movements?.total),
        received_quantity: n(raw.movements?.received_quantity),
        issued_quantity: n(raw.movements?.issued_quantity),
        net_quantity: n(raw.movements?.net_quantity),
      },
      daily_movements: (raw.daily_movements ?? []).map((row) => ({
        date: row.date,
        received: n(row.received),
        issued: n(row.issued),
        movements: n(row.movements),
      })),
      movement_mix: (raw.movement_mix ?? []).map((row) => ({ ...row, count: n(row.count), quantity: n(row.quantity) })),
      capacity: (raw.capacity ?? []).map((row) => ({
        ...row,
        locations: n(row.locations),
        occupied_locations: n(row.occupied_locations),
        utilisation_percent: n(row.utilisation_percent),
        on_hand: n(row.on_hand),
      })),
      expiry_bands: (raw.expiry_bands ?? []).map((row) => ({ ...row, count: n(row.count), quantity: n(row.quantity) })),
      top_products: (raw.top_products ?? []).map((row) => ({ ...row, on_hand: n(row.on_hand), lines: n(row.lines) })),
      dead_stock: {
        lines: n(raw.dead_stock?.lines),
        quantity: n(raw.dead_stock?.quantity),
        value: n(raw.dead_stock?.value),
        products: n(raw.dead_stock?.products),
      },
    };
  }, [raw]);

  const applyPreset = (days: number) => {
    setPreset(days);
    setFrom(isoDaysAgo(days - 1));
    setTo(isoDaysAgo(0));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("warehouse.overview.title", "Warehouse Overview")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "warehouse.overview.subtitle",
            "What is on the shelves right now, what moved, how full each site is, and what is about to expire or has stopped moving.",
          )}
        </p>
      </div>

      {/* One filter row, scoping everything below it. */}
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
              {t("warehouse.overview.last_days", "Last {n} days").replace("{n}", String(days))}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="wh-from" className="text-xs">
            {t("warehouse.overview.from", "From")}
          </Label>
          <Input
            id="wh-from"
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
          <Label htmlFor="wh-to" className="text-xs">
            {t("warehouse.overview.to", "To")}
          </Label>
          <Input
            id="wh-to"
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
        <div className="space-y-1">
          <Label className="text-xs">{t("warehouse.overview.site", "Site")}</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="h-9 w-[12rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("warehouse.overview.all_sites", "All sites")}</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <LoadingPanel label={t("warehouse.overview.loading", "Loading warehouse position...")} />
      ) : !overview ? (
        <EmptyPanel label={t("warehouse.overview.unavailable", "Warehouse metrics are not available right now.")} />
      ) : (
        <>
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("warehouse.overview.available_stock", "Available stock")}
              </p>
              <p className="mt-1 text-6xl font-black leading-none tracking-tight">
                {overview.stock.available.toLocaleString()}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("warehouse.overview.available_meta", "{onHand} on hand less {reserved} reserved, across {lines} stock lines")
                  .replace("{onHand}", overview.stock.on_hand.toLocaleString())
                  .replace("{reserved}", overview.stock.reserved.toLocaleString())
                  .replace("{lines}", overview.stock.stock_lines.toLocaleString())}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<Boxes className="h-4 w-4" />}
                label={t("warehouse.overview.products", "Distinct products")}
                value={overview.stock.distinct_products.toLocaleString()}
                meta={`${overview.stock.stock_lines.toLocaleString()} ${t("warehouse.overview.lines", "stock lines")}`}
              />
              <StatTile
                label={t("warehouse.overview.stock_value", "Valued stock")}
                value={`ETB ${overview.stock.stock_value.toLocaleString()}`}
                meta={
                  overview.stock.uncosted_lines > 0
                    ? t("warehouse.overview.uncosted", "{n} line(s) carry no unit cost").replace(
                        "{n}",
                        String(overview.stock.uncosted_lines),
                      )
                    : t("warehouse.overview.all_costed", "Every line is costed")
                }
                alert={overview.stock.uncosted_lines > 0}
              />
              <StatTile
                icon={<WarehouseIcon className="h-4 w-4" />}
                label={t("warehouse.overview.movements", "Movements in period")}
                value={overview.movements.total.toLocaleString()}
                meta={`${t("warehouse.overview.net", "net")} ${overview.movements.net_quantity >= 0 ? "+" : ""}${overview.movements.net_quantity.toLocaleString()}`}
              />
              <StatTile
                icon={<PackageMinus className="h-4 w-4" />}
                label={t("warehouse.overview.dead_stock", "Dead stock")}
                value={overview.dead_stock.quantity.toLocaleString()}
                meta={t("warehouse.overview.dead_meta", "{lines} line(s) unmoved for 90 days").replace(
                  "{lines}",
                  String(overview.dead_stock.lines),
                )}
                alert={overview.dead_stock.lines > 0}
              />
            </div>
          </section>

          {overview.stock.negative_lines > 0 ? (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <span>
                {t(
                  "warehouse.overview.negative_warning",
                  "{n} stock line(s) are negative — goods were issued that the books never received.",
                ).replace("{n}", String(overview.stock.negative_lines))}
              </span>
            </div>
          ) : null}

          <TrendChart
            title={t("warehouse.overview.flow", "Goods in and out")}
            description={t(
              "warehouse.overview.flow_desc",
              "Received against issued each day. Days with no movement are left out rather than drawn as zero.",
            )}
            points={overview.daily_movements.map((row) => ({
              date: row.date,
              received: row.received,
              issued: row.issued,
            }))}
            series={[
              { key: "received", label: t("warehouse.overview.received", "Received"), suffix: "" },
              { key: "issued", label: t("warehouse.overview.issued", "Issued"), suffix: "" },
            ]}
            emptyLabel={t("warehouse.overview.no_movements", "No stock movements in this period.")}
            dimmed={refetching}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <ColumnChart
              title={t("warehouse.overview.daily_activity", "Movement volume")}
              description={t("warehouse.overview.daily_activity_desc", "How many movements were posted each day.")}
              rows={overview.daily_movements.map((row) => ({
                key: row.date,
                label: row.date.slice(5),
                value: row.movements,
                meta: `${row.received.toLocaleString()} ${t("warehouse.overview.in", "in")} · ${row.issued.toLocaleString()} ${t("warehouse.overview.out", "out")}`,
              }))}
              valueLabel={t("warehouse.overview.movements_label", "movements")}
              emptyLabel={t("warehouse.overview.no_movements", "No stock movements in this period.")}
              dimmed={refetching}
            />

            <SeverityBands
              title={t("warehouse.overview.shelf_life", "Shelf-life exposure")}
              description={t(
                "warehouse.overview.shelf_life_desc",
                "Batched stock by how long it has left. The top band is already past its date.",
              )}
              bands={overview.expiry_bands}
              emptyLabel={t("warehouse.overview.no_expiry", "No stock carries an expiry date.")}
              dimmed={refetching}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <RankedBarChart
              title={t("warehouse.overview.site_utilisation", "Site utilisation")}
              description={t(
                "warehouse.overview.site_utilisation_desc",
                "Share of each site's locations currently holding stock.",
              )}
              rows={overview.capacity.map((row) => ({
                key: String(row.warehouse_id),
                label: row.name,
                value: row.utilisation_percent,
                meta: `${row.occupied_locations}/${row.locations} ${t("warehouse.overview.locations_used", "locations")} · ${row.on_hand.toLocaleString()} ${t("warehouse.overview.on_hand_short", "on hand")}`,
              }))}
              valueLabel={t("warehouse.overview.utilisation", "utilisation")}
              valueSuffix="%"
              emptyLabel={t("warehouse.overview.no_sites", "No warehouses defined yet.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("warehouse.overview.movement_mix", "Movements by type")}
              description={t("warehouse.overview.movement_mix_desc", "What kind of movement the period was made of.")}
              rows={overview.movement_mix.map((row) => ({
                key: row.type,
                label: row.type.replace(/_/g, " "),
                value: row.count,
                meta: `${row.quantity.toLocaleString()} ${t("warehouse.overview.units", "units")}`,
              }))}
              valueLabel={t("warehouse.overview.movements_label", "movements")}
              emptyLabel={t("warehouse.overview.no_movements", "No stock movements in this period.")}
              dimmed={refetching}
            />
          </div>

          <Panel
            title={t("warehouse.overview.largest_holdings", "Largest holdings")}
            description={t("warehouse.overview.largest_holdings_desc", "Products taking up the most stock right now.")}
          >
            {overview.top_products.length === 0 ? (
              <p className="py-6 text-center text-sm italic text-muted-foreground">
                {t("warehouse.overview.no_stock", "No stock on hand.")}
              </p>
            ) : (
              <div className={`overflow-x-auto ${refetching ? "opacity-50" : ""} transition-opacity`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">{t("warehouse.overview.product", "Product")}</th>
                      <th className="py-2 pr-3 text-right font-semibold">
                        {t("warehouse.overview.on_hand_short", "On hand")}
                      </th>
                      <th className="py-2 text-right font-semibold">{t("warehouse.overview.lines", "Stock lines")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.top_products.map((row) => (
                      <tr key={row.product_id} className="border-b border-border/30">
                        <td className="py-2 pr-3 font-medium">#{row.product_id}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.on_hand.toLocaleString()}</td>
                        <td className="py-2 text-right tabular-nums">{row.lines.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
