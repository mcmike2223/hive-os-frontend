"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { TransferOrder } from "@/modules/supplychain/types";
import { TransferStatusBadge } from "@/modules/shared/charts/primitives";

const NEXT: Record<string, string[]> = {
  draft: ["approved", "cancelled"],
  approved: ["draft", "cancelled"],
  in_transit: [],
  partially_received: [],
  received: [],
  cancelled: [],
};

type LineDraft = { product_id: string; quantity: string; batch_number: string };
const EMPTY_LINE: LineDraft = { product_id: "", quantity: "", batch_number: "" };

export default function StockTransfersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    from_warehouse_id: "",
    to_warehouse_id: "",
    from_location_id: "",
    to_location_id: "",
    vehicle: "",
    reason: "",
    items: [{ ...EMPTY_LINE }] as LineDraft[],
  });

  const transfersQuery = useQuery({
    queryKey: ["supply-chain", "transfers", tableQuery, statusFilter],
    queryFn: () =>
      supplyChainApi
        .listTransfers({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          status: statusFilter === "all" ? undefined : statusFilter,
        })
        .then((r) => r.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const mutate = (fn: () => Promise<unknown>, successKey: string, fallback: string) =>
    fn()
      .then((response: any) => {
        toast.success(response?.data?.message || t(successKey, fallback));
        invalidate();
      })
      .catch((e: any) => toast.error(e?.response?.data?.message || t("supply_chain.common.update_failed", "Could not update.")));

  const createMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.createTransfer({
        from_warehouse_id: Number(form.from_warehouse_id),
        to_warehouse_id: Number(form.to_warehouse_id),
        from_location_id: form.from_location_id ? Number(form.from_location_id) : undefined,
        to_location_id: form.to_location_id ? Number(form.to_location_id) : undefined,
        vehicle: form.vehicle || undefined,
        reason: form.reason || undefined,
        items: form.items
          .filter((l) => l.product_id && l.quantity)
          .map((l) => ({
            product_id: Number(l.product_id),
            quantity: Number(l.quantity),
            batch_number: l.batch_number || undefined,
          })),
      }),
    onSuccess: () => {
      toast.success(t("supply_chain.transfers.created", "Transfer created."));
      invalidate();
      setCreateOpen(false);
      setForm((f) => ({ ...f, items: [{ ...EMPTY_LINE }] }));
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.transfers.create_failed", "Could not create the transfer.")),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const columns = React.useMemo<ColumnDef<TransferOrder>[]>(
    () => [
      {
        accessorKey: "transfer_number",
        header: t("supply_chain.transfers.col_transfer", "Transfer"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.transfer_number}</p>
            <p className="text-[11px] text-muted-foreground">
              #{row.original.from_warehouse_id} → #{row.original.to_warehouse_id}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("supply_chain.common.status", "Status"),
        cell: ({ row }) => <TransferStatusBadge status={row.original.status} />,
      },
      {
        id: "quantities",
        header: t("supply_chain.transfers.col_quantities", "Requested / Sent / Received"),
        cell: ({ row }) => {
          const items = row.original.items ?? [];
          const sum = (key: "quantity" | "dispatched_quantity" | "received_quantity") =>
            items.reduce((total, item) => total + Number(item[key]), 0);
          return (
            <span className="text-xs tabular-nums">
              {sum("quantity").toLocaleString()} / {sum("dispatched_quantity").toLocaleString()} /{" "}
              {sum("received_quantity").toLocaleString()}
            </span>
          );
        },
      },
      {
        id: "in_transit",
        header: t("supply_chain.transfers.in_transit", "In transit"),
        cell: ({ row }) => {
          const value = row.original.in_transit_quantity;
          return (
            <span className={`font-bold tabular-nums ${value > 0 ? "text-indigo-600 dark:text-indigo-400" : ""}`}>
              {value.toLocaleString()}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => {
          const transfer = row.original;
          const next = NEXT[transfer.status] ?? [];

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {next.length > 0 ? (
                <Select
                  value=""
                  onValueChange={(status) =>
                    mutate(
                      () => supplyChainApi.transitionTransfer(transfer.id, status),
                      "supply_chain.common.updated",
                      "Updated.",
                    )
                  }
                >
                  <SelectTrigger className="h-8 w-[8rem] text-xs">
                    <SelectValue placeholder={t("supply_chain.common.move_to", "Move to...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {next.map((status) => (
                      <SelectItem key={status} value={status} className="text-xs">{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {transfer.status === "approved" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() =>
                    mutate(
                      () => supplyChainApi.dispatchTransfer(transfer.id),
                      "supply_chain.transfers.dispatched",
                      "Transfer despatched.",
                    )
                  }
                >
                  <TruckIcon className="h-3 w-3" />
                  {t("supply_chain.transfers.dispatch", "Despatch")}
                </Button>
              ) : null}

              {["in_transit", "partially_received"].includes(transfer.status) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    mutate(
                      () => supplyChainApi.receiveTransfer(transfer.id),
                      "supply_chain.transfers.received",
                      "Transfer received.",
                    )
                  }
                >
                  {t("supply_chain.transfers.receive", "Receive")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("supply_chain.transfers.title", "Stock Transfers")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.transfers.subtitle",
              "Despatch and receipt are posted separately, so stock on a truck between two of your sites is still visible and still yours.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("supply_chain.transfers.add", "New Transfer")}
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t("supply_chain.common.status", "Status")}</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[12rem]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
            {Object.keys(NEXT).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={(transfersQuery.data?.data ?? []) as TransferOrder[]}
        totalEntries={transfersQuery.data?.meta?.total ?? 0}
        loading={transfersQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("supply_chain.transfers.search", "Search transfers...")}
        resourceName="stock-transfers"
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.transfers.new", "New Stock Transfer")}
              </DialogTitle>
              <DialogDescription>
                {t("supply_chain.transfers.new_desc", "Set both locations to have the stock movements posted on despatch and receipt.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              {([
                ["from_warehouse_id", t("supply_chain.transfers.from_warehouse", "From warehouse ID")],
                ["to_warehouse_id", t("supply_chain.transfers.to_warehouse", "To warehouse ID")],
                ["from_location_id", t("supply_chain.transfers.from_location", "From location ID")],
                ["to_location_id", t("supply_chain.transfers.to_location", "To location ID")],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`tr-${key}`}>{label}</Label>
                  <Input
                    id={`tr-${key}`}
                    type="number"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="tr-vehicle">{t("supply_chain.shipments.vehicle", "Vehicle")}</Label>
                <Input id="tr-vehicle" value={form.vehicle} onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tr-reason">{t("supply_chain.transfers.reason", "Reason")}</Label>
                <Input id="tr-reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("supply_chain.transfers.lines", "Lines")}</p>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_LINE }] }))}>
                  <Plus className="h-3 w-3" />
                  {t("supply_chain.shipments.add_line", "Add Line")}
                </Button>
              </div>

              {form.items.map((line, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-border/40 bg-background p-3 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <Label className="text-[11px]">{t("supply_chain.common.product_id", "Product ID")}</Label>
                    <Input type="number" className="h-9" value={line.product_id} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, product_id: e.target.value } : l)) }))} />
                  </div>
                  <div className="md:col-span-4">
                    <Label className="text-[11px]">{t("supply_chain.common.quantity", "Quantity")}</Label>
                    <Input type="number" className="h-9" value={line.quantity} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)) }))} />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-[11px]">{t("supply_chain.common.batch", "Batch / lot")}</Label>
                    <Input className="h-9" value={line.batch_number} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, batch_number: e.target.value } : l)) }))} />
                  </div>
                  <div className="flex items-end md:col-span-1">
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setCreateOpen(false)}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={createMutation.isPending}
              onClick={() => {
                if (!form.from_warehouse_id || !form.to_warehouse_id) {
                  toast.error(t("supply_chain.transfers.warehouses_required", "Both warehouses are required."));
                  return;
                }
                createMutation.mutate();
              }}
            >
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
