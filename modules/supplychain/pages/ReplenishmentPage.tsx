"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Loader2, Play, Search } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { ReplenishmentSuggestion, StockPosition } from "@/modules/supplychain/types";
import { Panel, StatTile, UrgencyBadge } from "@/modules/shared/charts/primitives";
import { SupplyChainReplenishmentSkeleton } from "@/modules/supplychain/pages/components/supply-chain-skeletons";
import { fetchInventoryProducts } from "@/modules/inventory/api";
import type { ProductRecord } from "@/modules/inventory/types";
import { warehouseApi } from "@/modules/warehouse/api";
import type { Warehouse } from "@/modules/warehouse/types";

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

export default function ReplenishmentPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("open");
  const [urgencyFilter, setUrgencyFilter] = React.useState("all");
  const [warehouseFilter, setWarehouseFilter] = React.useState("all");

  const [resolving, setResolving] = React.useState<ReplenishmentSuggestion | null>(null);
  const [resolveStatus, setResolveStatus] = React.useState("actioned");
  const [resolveReference, setResolveReference] = React.useState("");

  const [positionProduct, setPositionProduct] = React.useState("");
  const [positionWarehouse, setPositionWarehouse] = React.useState("network");
  const [positionHorizon, setPositionHorizon] = React.useState("30");
  const [position, setPosition] = React.useState<StockPosition | null>(null);

  const [runWarehouse, setRunWarehouse] = React.useState("network");
  const [runHorizon, setRunHorizon] = React.useState("30");
  const [runOpen, setRunOpen] = React.useState(false);

  const [selected, setSelected] = React.useState<Record<number, boolean>>({});

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "planning-picker"],
    queryFn: async () => {
      const res = await fetchInventoryProducts({ per_page: 200, limit: 200 });
      return unwrapList<ProductRecord>(res);
    },
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "warehouses", "planning-picker"],
    queryFn: async () => {
      const res = await warehouseApi.listWarehouses({ limit: 200 }).then((r) => r.data);
      return unwrapList<Warehouse>(res);
    },
  });

  const warehouseNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const wh of warehousesQuery.data ?? []) {
      map.set(wh.id, wh.code ? `${wh.name} (${wh.code})` : wh.name);
    }
    return map;
  }, [warehousesQuery.data]);

  const suggestionsQuery = useQuery({
    queryKey: ["supply-chain", "suggestions", tableQuery, statusFilter, urgencyFilter, warehouseFilter],
    queryFn: () =>
      supplyChainApi
        .listSuggestions({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          urgency: urgencyFilter === "all" ? undefined : urgencyFilter,
          warehouse_id: warehouseFilter === "all" ? undefined : Number(warehouseFilter),
        })
        .then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const runMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.runReplenishment({
        warehouse_id: runWarehouse === "network" ? undefined : Number(runWarehouse),
        horizon_days: Number(runHorizon) || 30,
      }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.replenishment.run_done", "Replenishment run complete."));
      invalidate();
      setRunOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("supply_chain.replenishment.run_failed", "The run could not complete."));
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.resolveSuggestion(resolving!.id, {
        status: resolveStatus,
        converted_reference: resolveReference || undefined,
      }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.replenishment.resolved", "Suggestion resolved."));
      invalidate();
      setResolving(null);
      setResolveReference("");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("supply_chain.replenishment.resolve_failed", "Could not resolve it."));
    },
  });

  const bridgeQuery = useQuery({
    queryKey: ["supply-chain", "procurement-bridge"],
    queryFn: () => supplyChainApi.procurementBridgeStatus().then((res) => res.data),
    retry: false,
  });

  const bridgeAvailable = bridgeQuery.data?.data?.available === true;

  const convertMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.convertSuggestions({
        suggestion_ids: Object.entries(selected)
          .filter(([, isSelected]) => isSelected)
          .map(([id]) => Number(id)),
      }),
    onSuccess: (response) => {
      toast.success(
        response?.data?.message || t("supply_chain.replenishment.converted", "Requisition raised."),
      );
      invalidate();
      setSelected({});
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ||
          t("supply_chain.replenishment.convert_failed", "Could not raise the requisition."),
      );
    },
  });

  const positionMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.position({
        product_id: Number(positionProduct),
        warehouse_id: positionWarehouse === "network" ? undefined : Number(positionWarehouse),
        horizon_days: Number(positionHorizon) || 30,
      }),
    onSuccess: (response) => setPosition(response?.data?.data ?? null),
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("supply_chain.replenishment.position_failed", "Could not read the position."));
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const rows: ReplenishmentSuggestion[] = suggestionsQuery.data?.data ?? [];
  const openCritical = rows.filter((row) => row.urgency === "critical").length;

  const columns = React.useMemo<ColumnDef<ReplenishmentSuggestion>[]>(
    () => [
      ...(bridgeAvailable
        ? [
            {
              id: "select",
              header: () => <span className="sr-only">{t("supply_chain.replenishment.select", "Select")}</span>,
              cell: ({ row }: { row: { original: ReplenishmentSuggestion } }) =>
                row.original.status === "open" ? (
                  <Checkbox
                    checked={selected[row.original.id] === true}
                    aria-label={t("supply_chain.replenishment.select_row", "Select this suggestion")}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => ({ ...prev, [row.original.id]: checked === true }))
                    }
                  />
                ) : null,
            } as ColumnDef<ReplenishmentSuggestion>,
          ]
        : []),
      {
        id: "product",
        header: t("supply_chain.common.product", "Product"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.product?.name ?? `#${row.original.product_id}`}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.warehouse_id
                ? warehouseNameById.get(row.original.warehouse_id) ??
                  `${t("supply_chain.common.warehouse", "Warehouse")} #${row.original.warehouse_id}`
                : t("supply_chain.replenishment.network_wide", "Network-wide")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "urgency",
        header: t("supply_chain.common.urgency", "Urgency"),
        cell: ({ row }) => (
          <div className="space-y-1">
            <UrgencyBadge urgency={row.original.urgency} />
            <p className="text-[11px] text-muted-foreground">{row.original.reason?.replace(/_/g, " ")}</p>
          </div>
        ),
      },
      {
        id: "position",
        header: t("supply_chain.replenishment.netting", "Netting"),
        cell: ({ row }) => {
          const s = row.original;
          const projected = Number(s.projected_position);
          return (
            <div className="space-y-0.5 text-xs tabular-nums">
              <p>
                {Number(s.on_hand).toLocaleString()} + {Number(s.on_order).toLocaleString()} +{" "}
                {Number(s.in_transit).toLocaleString()}
              </p>
              <p className="text-muted-foreground">
                − {Number(s.allocated).toLocaleString()} − {Number(s.forecast_demand).toLocaleString()}
              </p>
              <p className={`font-semibold ${projected < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>
                = {projected.toLocaleString()}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "projected_position",
        header: t("supply_chain.replenishment.projected", "Projected"),
        cell: ({ row }) => {
          const projected = Number(row.original.projected_position);
          return (
            <span
              className={`font-bold tabular-nums ${projected < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}
            >
              {projected.toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: "suggested_quantity",
        header: t("supply_chain.replenishment.suggested", "Suggested"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold tabular-nums">{Number(row.original.suggested_quantity).toLocaleString()}</p>
            {row.original.days_of_cover !== null && row.original.days_of_cover !== undefined ? (
              <p className="text-[11px] text-muted-foreground">
                {Number(row.original.days_of_cover).toFixed(1)} {t("supply_chain.overview.days_cover", "days cover")}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("supply_chain.common.status", "Status"),
        cell: ({ row }) => <span className="text-xs capitalize">{row.original.status}</span>,
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) =>
          row.original.status === "open" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setResolving(row.original);
                setResolveStatus("actioned");
                setResolveReference("");
              }}
            >
              {t("supply_chain.replenishment.resolve", "Resolve")}
            </Button>
          ) : null,
      },
    ],
    [bridgeAvailable, selected, t, warehouseNameById],
  );

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("supply_chain.replenishment.title", "Replenishment")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.replenishment.subtitle",
              "What the business is short of once stock, open purchase orders, transfers, production demand and forecast are netted off against each other.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bridgeAvailable ? (
            <Button
              variant="outline"
              className="rounded-full px-5"
              disabled={selectedCount === 0 || convertMutation.isPending}
              onClick={() => convertMutation.mutate()}
            >
              {convertMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FilePlus2 className="mr-2 h-4 w-4" />
              )}
              {selectedCount > 0
                ? t("supply_chain.replenishment.raise_selected", "Raise Requisition ({n})").replace(
                    "{n}",
                    String(selectedCount),
                  )
                : t("supply_chain.replenishment.raise", "Raise Requisition")}
            </Button>
          ) : null}
          <Button className="rounded-full px-5" onClick={() => setRunOpen(true)}>
            <Play className="mr-2 h-4 w-4" />
            {t("supply_chain.replenishment.run", "Run Replenishment")}
          </Button>
        </div>
      </div>

      {bridgeAvailable && selectedCount > 0 ? (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          {t(
            "supply_chain.replenishment.raise_hint",
            "The selected lines are grouped onto one draft requisition. Procurement still approves it before anything is ordered.",
          )}
        </p>
      ) : null}

      {suggestionsQuery.isPending ? (
        <SupplyChainReplenishmentSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label={t("supply_chain.replenishment.open", "Open suggestions")}
              value={(suggestionsQuery.data?.meta?.total ?? 0).toLocaleString()}
            />
            <StatTile
              label={t("supply_chain.replenishment.critical_on_page", "Critical on this page")}
              value={openCritical.toLocaleString()}
              alert={openCritical > 0}
              meta={t("supply_chain.replenishment.critical_meta", "Already below safety stock")}
            />
            <StatTile
              label={t("supply_chain.replenishment.units", "Units suggested on this page")}
              value={rows
                .reduce((sum, row) => sum + Number(row.suggested_quantity), 0)
                .toLocaleString()}
            />
          </div>

          <Panel
            title={t("supply_chain.replenishment.position_title", "Check a stock position")}
            description={t(
              "supply_chain.replenishment.position_desc",
              "The same netting the run uses, for one product — the answer to “why did it suggest that”.",
            )}
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1 space-y-1">
                <Label htmlFor="position-product" className="text-xs">
                  {t("supply_chain.common.product", "Product")}
                </Label>
                <Select value={positionProduct || undefined} onValueChange={setPositionProduct}>
                  <SelectTrigger id="position-product" className="h-9">
                    <SelectValue
                      placeholder={
                        productsQuery.isLoading
                          ? t("supply_chain.common.loading", "Loading…")
                          : t("supply_chain.planning.pick_product", "Select a product")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(productsQuery.data ?? []).map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.name}
                        {product.sku ? ` (${product.sku})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[180px] space-y-1">
                <Label htmlFor="position-warehouse" className="text-xs">
                  {t("supply_chain.common.warehouse", "Warehouse")}
                </Label>
                <Select value={positionWarehouse} onValueChange={setPositionWarehouse}>
                  <SelectTrigger id="position-warehouse" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="network">
                      {t("supply_chain.planning.network_wide", "Network-wide (all warehouses)")}
                    </SelectItem>
                    {(warehousesQuery.data ?? []).map((wh) => (
                      <SelectItem key={wh.id} value={String(wh.id)}>
                        {wh.name}
                        {wh.code ? ` (${wh.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28 space-y-1">
                <Label htmlFor="position-horizon" className="text-xs">
                  {t("supply_chain.replenishment.horizon", "Horizon (days)")}
                </Label>
                <Input
                  id="position-horizon"
                  type="number"
                  min={1}
                  max={365}
                  className="h-9"
                  value={positionHorizon}
                  onChange={(e) => setPositionHorizon(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="h-9 rounded-full"
                disabled={!positionProduct || positionMutation.isPending}
                onClick={() => positionMutation.mutate()}
              >
                {positionMutation.isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="mr-2 h-3.5 w-3.5" />
                )}
                {t("supply_chain.replenishment.check", "Check")}
              </Button>
            </div>

            {position ? (
              <div className="mt-4 space-y-3">
                <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {(
                    [
                      ["on_hand", t("supply_chain.replenishment.on_hand", "On hand")],
                      ["on_order", t("supply_chain.replenishment.on_order", "On order")],
                      ["in_transit", t("supply_chain.replenishment.in_transit", "In transit")],
                      ["allocated", t("supply_chain.replenishment.allocated", "Allocated")],
                      ["forecast_demand", t("supply_chain.replenishment.forecast", "Forecast")],
                      ["projected_position", t("supply_chain.replenishment.projected", "Projected")],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</dt>
                      <dd
                        className={`text-sm font-bold tabular-nums ${key === "projected_position" && position[key] < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}
                      >
                        {position[key].toLocaleString()}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {position.on_hand.toLocaleString()} + {position.on_order.toLocaleString()} +{" "}
                  {position.in_transit.toLocaleString()} − {position.allocated.toLocaleString()} −{" "}
                  {position.forecast_demand.toLocaleString()} ={" "}
                  <span
                    className={`font-semibold ${position.projected_position < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}
                  >
                    {position.projected_position.toLocaleString()}
                  </span>
                </p>
              </div>
            ) : null}
          </Panel>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.common.status", "Status")}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[10rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  {["open", "actioned", "dismissed", "expired"].map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.common.urgency", "Urgency")}</Label>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="h-9 w-[10rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  {["critical", "high", "normal"].map((urgency) => (
                    <SelectItem key={urgency} value={urgency}>
                      {urgency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.common.warehouse", "Warehouse")}</Label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="h-9 w-[14rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  {(warehousesQuery.data ?? []).map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>
                      {wh.name}
                      {wh.code ? ` (${wh.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            totalEntries={suggestionsQuery.data?.meta?.total ?? 0}
            loading={suggestionsQuery.isFetching && !suggestionsQuery.isPending}
            pageIndex={tableQuery.page}
            pageSize={tableQuery.pageSize}
            onQueryChange={handleTableQueryChange}
            searchPlaceholder={t("supply_chain.replenishment.search", "Search by product, SKU, urgency…")}
            resourceName="suggestions"
          />
        </>
      )}

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.replenishment.run_title", "Run Replenishment")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.replenishment.run_desc",
                  "Evaluate active planning profiles and refresh open suggestions. Existing open lines for the same product and warehouse are updated, not duplicated.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("supply_chain.common.warehouse", "Warehouse")}</Label>
              <Select value={runWarehouse} onValueChange={setRunWarehouse}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">
                    {t("supply_chain.replenishment.run_all_profiles", "All profiles (any warehouse)")}
                  </SelectItem>
                  {(warehousesQuery.data ?? []).map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>
                      {wh.name}
                      {wh.code ? ` (${wh.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="run-horizon">{t("supply_chain.replenishment.horizon", "Horizon (days)")}</Label>
              <Input
                id="run-horizon"
                type="number"
                min={1}
                max={365}
                value={runHorizon}
                onChange={(e) => setRunHorizon(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setRunOpen(false)}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button className="rounded-full" disabled={runMutation.isPending} onClick={() => runMutation.mutate()}>
              {runMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {t("supply_chain.replenishment.run", "Run Replenishment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolving !== null} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.replenishment.resolve_title", "Resolve Suggestion")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.replenishment.resolve_desc",
                  "Mark it actioned once a requisition or order has been raised, or dismiss it if the shortage is not real.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label>{t("supply_chain.common.status", "Status")}</Label>
              <Select value={resolveStatus} onValueChange={setResolveStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="actioned">{t("supply_chain.replenishment.actioned", "Actioned")}</SelectItem>
                  <SelectItem value="dismissed">{t("supply_chain.replenishment.dismissed", "Dismissed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolve-reference">
                {t("supply_chain.replenishment.reference", "Requisition or order reference")}
              </Label>
              <Input
                id="resolve-reference"
                value={resolveReference}
                onChange={(e) => setResolveReference(e.target.value)}
                placeholder="PR-202608-0042"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setResolving(null)}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button className="rounded-full" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate()}>
              {resolveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
