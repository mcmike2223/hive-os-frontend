"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { salesApi } from "@/modules/sales/api";
import type {
  Availability,
  FulfilmentCapabilities,
  OrderStatus,
  SalesOrder,
} from "@/modules/sales/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Mirrors SalesOrder::TRANSITIONS; the backend remains the authority. */
const TRANSITIONS: Record<string, OrderStatus[]> = {
  draft: ["pending_approval", "confirmed", "cancelled"],
  pending_approval: ["confirmed", "draft", "cancelled"],
  confirmed: ["cancelled"],
  fulfilled: ["closed"],
  closed: [],
  cancelled: [],
};

const STATUS_TONE: Record<string, string> = {
  draft: "outline",
  pending_approval: "secondary",
  confirmed: "default",
  fulfilled: "default",
  closed: "secondary",
  cancelled: "outline",
};

export default function SalesOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [deliveries, setDeliveries] = React.useState<Record<number, string>>({});

  const listQuery = useQuery({
    queryKey: ["sales", "orders", tableQuery],
    queryFn: () =>
      salesApi
        .listOrders({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
        })
        .then((res) => res.data),
  });

  const capabilitiesQuery = useQuery({
    queryKey: ["sales", "fulfilment-status"],
    queryFn: () => salesApi.fulfilmentStatus().then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["sales", "order", detailId],
    queryFn: () => salesApi.getOrder(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const availabilityQuery = useQuery({
    queryKey: ["sales", "availability", detailId],
    queryFn: () => salesApi.availability(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      salesApi.transitionOrder(id, status),
    onSuccess: () => {
      toast.success(t("sales.orders.moved", "Order updated."));
      invalidate();
    },
    // Confirming refuses unpriced or empty orders by name; relay the reason.
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.orders.move_failed", "That transition was refused."))),
  });

  const deliver = useMutation({
    mutationFn: () =>
      salesApi.deliverOrder(
        detailId!,
        Object.entries(deliveries)
          .filter(([, quantity]) => Number(quantity) > 0)
          .map(([lineId, quantity]) => ({ line_id: Number(lineId), quantity: Number(quantity) })),
      ),
    onSuccess: () => {
      toast.success(t("sales.orders.delivered", "Delivery recorded."));
      setDeliveries({});
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.orders.deliver_failed", "Could not record the delivery."))),
  });

  const ship = useMutation({
    mutationFn: (id: number) => salesApi.shipOrder(id),
    onSuccess: (response: any) => {
      const data = response?.data?.data;
      toast[data?.created ? "success" : "info"](
        data?.created
          ? t("sales.orders.shipped", "Shipment created in Supply Chain.")
          : (data?.reason ?? t("sales.orders.no_shipment", "No shipment was created.")),
      );
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.orders.ship_failed", "Could not create the shipment."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const capabilities: FulfilmentCapabilities | undefined = capabilitiesQuery.data?.data;
  const detail: SalesOrder | undefined = detailQuery.data?.data;
  const availability: Availability | undefined = availabilityQuery.data?.data;

  const columns = React.useMemo<ColumnDef<SalesOrder>[]>(
    () => [
      {
        id: "number",
        header: t("sales.orders.number", "Order"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-bold">{row.original.order_number}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.customer?.name ?? `#${row.original.customer_id}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "ordered_on",
        header: t("sales.orders.ordered", "Ordered"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">{String(row.original.ordered_on).slice(0, 10)}</span>
        ),
      },
      {
        id: "delivery",
        header: t("sales.orders.due", "Due"),
        cell: ({ row }) => (
          <span
            className={`text-xs tabular-nums ${
              row.original.is_overdue ? "font-semibold text-destructive" : ""
            }`}
          >
            {row.original.requested_delivery_date
              ? String(row.original.requested_delivery_date).slice(0, 10)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: t("sales.common.total", "Total"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{money(row.original.total)}</span>
        ),
      },
      {
        id: "fulfilment",
        header: t("sales.orders.fulfilment", "Fulfilment"),
        cell: ({ row }) => {
          const percent = n(row.original.fulfilment_percent);
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums">{percent.toFixed(0)}%</span>
              </div>
              <p className="text-[11px] capitalize text-muted-foreground">
                {row.original.fulfilment_status}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("sales.common.status", "Status"),
        cell: ({ row }) => (
          <Badge
            variant={(STATUS_TONE[row.original.status] ?? "outline") as any}
            className="text-[11px] capitalize"
          >
            {row.original.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const next = TRANSITIONS[row.original.status] ?? [];
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => setDetailId(row.original.id)}>
                {t("sales.common.open", "Open")}
              </Button>
              {next.slice(0, 2).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  className="text-[11px] capitalize"
                  disabled={transition.isPending}
                  onClick={() => transition.mutate({ id: row.original.id, status })}
                >
                  {status.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          );
        },
      },
    ],
    [t, transition],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("sales.orders.title", "Sales Orders")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "sales.orders.subtitle",
            "Committed customer demand: what was promised, what has shipped, and what is still owed.",
          )}
        </p>
      </div>

      {/* Honest about what this tenant can actually do with an order. */}
      {capabilities ? (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["shipping", t("sales.orders.cap_shipping", "Supply Chain shipping")],
              ["invoicing", t("sales.orders.cap_invoicing", "Finance invoicing")],
              ["production", t("sales.orders.cap_production", "Make-to-order production")],
            ] as const
          ).map(([key, label]) => (
            <Badge
              key={key}
              variant={capabilities[key]?.available ? "default" : "outline"}
              className="text-[11px]"
            >
              {label}
              {capabilities[key]?.available
                ? ""
                : ` — ${t("sales.orders.not_installed", "not installed")}`}
            </Badge>
          ))}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as SalesOrder[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("sales.orders.search", "Search orders...")}
        resourceName="sales-orders"
      />

      <Dialog open={detailId !== null} onOpenChange={(isOpen) => !isOpen && setDetailId(null)}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail ? detail.order_number : t("sales.orders.title", "Order")}
              </DialogTitle>
              <DialogDescription>
                {detail
                  ? `${detail.customer?.name ?? ""} — ${money(detail.total)}`
                  : t("sales.common.loading", "Loading...")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            {detail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile
                    label={t("sales.orders.fulfilment", "Fulfilment")}
                    value={`${n(detail.fulfilment_percent).toFixed(0)}%`}
                    meta={detail.fulfilment_status}
                  />
                  <StatTile label={t("sales.common.total", "Total")} value={money(detail.total)} />
                  <StatTile
                    label={t("sales.orders.stock", "Stock cover")}
                    value={
                      availability
                        ? availability.available
                          ? t("sales.orders.in_stock", "Covered")
                          : t("sales.orders.short", "Short")
                        : "—"
                    }
                    meta={availability?.reason ?? undefined}
                    alert={availability ? !availability.available : false}
                  />
                </div>

                <Panel title={t("sales.common.lines", "Lines")}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-sm">
                      <thead>
                        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="pb-2 font-semibold">{t("sales.pricing.product", "Product")}</th>
                          <th className="pb-2 text-right font-semibold">
                            {t("sales.common.quantity", "Ordered")}
                          </th>
                          <th className="pb-2 text-right font-semibold">
                            {t("sales.orders.delivered", "Delivered")}
                          </th>
                          <th className="pb-2 text-right font-semibold">
                            {t("sales.orders.outstanding", "Outstanding")}
                          </th>
                          <th className="pb-2 text-right font-semibold">
                            {t("sales.common.total", "Total")}
                          </th>
                          {detail.status === "confirmed" ? (
                            <th className="pb-2 text-right font-semibold">
                              {t("sales.orders.deliver_now", "Deliver")}
                            </th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.lines ?? []).map((line) => (
                          <tr key={line.id} className="border-b border-border/40 last:border-0">
                            <td className="py-2">#{line.product_id}</td>
                            <td className="py-2 text-right tabular-nums">{n(line.quantity)}</td>
                            <td className="py-2 text-right tabular-nums">
                              {n(line.delivered_quantity)}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {n(line.outstanding_quantity)}
                            </td>
                            <td className="py-2 text-right tabular-nums">{money(line.line_total)}</td>
                            {detail.status === "confirmed" ? (
                              <td className="py-2 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  max={n(line.outstanding_quantity)}
                                  value={deliveries[line.id] ?? ""}
                                  onChange={(event) =>
                                    setDeliveries({ ...deliveries, [line.id]: event.target.value })
                                  }
                                  className="ml-auto h-8 w-24"
                                  aria-label={t("sales.orders.deliver_qty", "Quantity to deliver")}
                                />
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {detail.status === "confirmed" ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-4">
                      <Button
                        variant="outline"
                        disabled={
                          deliver.isPending ||
                          !Object.values(deliveries).some((value) => Number(value) > 0)
                        }
                        onClick={() => deliver.mutate()}
                      >
                        {t("sales.orders.record_delivery", "Record delivery")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={ship.isPending || !capabilities?.shipping?.available}
                        onClick={() => ship.mutate(detail.id)}
                        title={
                          capabilities?.shipping?.available
                            ? undefined
                            : t(
                                "sales.orders.no_supply_chain",
                                "Supply Chain is not installed; record deliveries directly instead.",
                              )
                        }
                      >
                        {detail.shipment_id
                          ? t("sales.orders.shipment_exists", "Shipment #{id}").replace(
                              "{id}",
                              String(detail.shipment_id),
                            )
                          : t("sales.orders.create_shipment", "Create shipment")}
                      </Button>
                    </div>
                  ) : null}
                </Panel>

                {availability && !availability.available && availability.lines.length > 0 ? (
                  <Panel
                    title={t("sales.orders.shortfalls", "Stock shortfalls")}
                    description={t(
                      "sales.orders.shortfalls_desc",
                      "On-hand less what is already reserved against other orders.",
                    )}
                  >
                    <div className="space-y-1.5">
                      {availability.lines
                        .filter((line) => n(line.shortfall) > 0)
                        .map((line) => (
                          <div
                            key={line.line_id}
                            className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                          >
                            <span>#{line.product_id}</span>
                            <span className="tabular-nums">
                              {t("sales.orders.short_by", "short {n}").replace(
                                "{n}",
                                String(n(line.shortfall)),
                              )}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {t("sales.orders.on_hand", "{n} available").replace(
                                  "{n}",
                                  String(n(line.on_hand)),
                                )}
                              </span>
                            </span>
                          </div>
                        ))}
                    </div>
                  </Panel>
                ) : null}

                {(detail.commissions ?? []).length > 0 ? (
                  <Panel title={t("sales.orders.commission", "Commission")}>
                    {detail.commissions!.map((commission) => (
                      <div
                        key={commission.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          {t("sales.overview.employee", "Employee")} #{commission.employee_id}
                        </span>
                        <span className="tabular-nums">
                          {money(commission.amount)}
                          <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                            {commission.status}
                          </Badge>
                        </span>
                      </div>
                    ))}
                  </Panel>
                ) : null}
              </>
            ) : (
              <EmptyPanel label={t("sales.common.loading", "Loading...")} />
            )}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDetailId(null)}>
              {t("sales.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
