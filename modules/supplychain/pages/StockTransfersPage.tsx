"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, Trash2, TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { TransferOrder, TransferOrderItem } from "@/modules/supplychain/types";
import { TransferStatusBadge } from "@/modules/shared/charts/primitives";
import {
  SupplyChainDialogSkeleton,
  SupplyChainListSkeleton,
} from "@/modules/supplychain/pages/components/supply-chain-skeletons";
import { fetchInventoryProducts } from "@/modules/inventory/api";
import type { ProductRecord } from "@/modules/inventory/types";
import { warehouseApi } from "@/modules/warehouse/api";
import type { Warehouse, WarehouseLocation } from "@/modules/warehouse/types";

const NEXT: Record<string, string[]> = {
  draft: ["approved", "cancelled"],
  approved: ["draft", "cancelled"],
  in_transit: [],
  partially_received: [],
  received: [],
  cancelled: [],
};

const EDITABLE = new Set(["draft", "approved"]);

type LineDraft = { product_id: string; quantity: string; batch_number: string; uom: string };
const EMPTY_LINE: LineDraft = { product_id: "", quantity: "", batch_number: "", uom: "pcs" };

type TransferForm = {
  from_warehouse_id: string;
  to_warehouse_id: string;
  from_location_id: string;
  to_location_id: string;
  vehicle: string;
  reason: string;
  notes: string;
  items: LineDraft[];
};

const DEFAULT_FORM: TransferForm = {
  from_warehouse_id: "",
  to_warehouse_id: "",
  from_location_id: "",
  to_location_id: "",
  vehicle: "",
  reason: "",
  notes: "",
  items: [{ ...EMPTY_LINE }],
};

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function locationLabel(loc: WarehouseLocation): string {
  return loc.name || loc.code || `Location #${loc.id}`;
}

function formFromTransfer(tr: TransferOrder): TransferForm {
  return {
    from_warehouse_id: String(tr.from_warehouse_id),
    to_warehouse_id: String(tr.to_warehouse_id),
    from_location_id: tr.from_location_id ? String(tr.from_location_id) : "",
    to_location_id: tr.to_location_id ? String(tr.to_location_id) : "",
    vehicle: tr.vehicle ?? "",
    reason: tr.reason ?? "",
    notes: tr.notes ?? "",
    items:
      (tr.items ?? []).length > 0
        ? (tr.items ?? []).map((item) => ({
            product_id: String(item.product_id),
            quantity: String(item.quantity),
            batch_number: item.batch_number ?? "",
            uom: item.uom || "pcs",
          }))
        : [{ ...EMPTY_LINE }],
  };
}

function buildPayload(form: TransferForm) {
  return {
    from_warehouse_id: Number(form.from_warehouse_id),
    to_warehouse_id: Number(form.to_warehouse_id),
    from_location_id: form.from_location_id ? Number(form.from_location_id) : null,
    to_location_id: form.to_location_id ? Number(form.to_location_id) : null,
    vehicle: form.vehicle || null,
    reason: form.reason || null,
    notes: form.notes || null,
    items: form.items
      .filter((l) => l.product_id && l.quantity)
      .map((l) => ({
        product_id: Number(l.product_id),
        quantity: Number(l.quantity),
        batch_number: l.batch_number || null,
        uom: l.uom || "pcs",
      })),
  };
}

function transferInTransitUnits(transfer: TransferOrder): number {
  const items = transfer.items ?? [];
  const fromLines = items.reduce(
    (sum, item) =>
      sum + Math.max(0, Number(item.dispatched_quantity ?? 0) - Number(item.received_quantity ?? 0)),
    0,
  );

  if (fromLines > 0) return fromLines;
  return Number(transfer.in_transit_quantity ?? 0);
}

export default function StockTransfersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [fromWarehouseFilter, setFromWarehouseFilter] = React.useState("all");
  const [toWarehouseFilter, setToWarehouseFilter] = React.useState("all");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<TransferForm>(DEFAULT_FORM);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [loadingViewId, setLoadingViewId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<TransferOrder | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [dispatchLoading, setDispatchLoading] = React.useState(false);
  const [receiveLoading, setReceiveLoading] = React.useState(false);
  const [dispatching, setDispatching] = React.useState<TransferOrder | null>(null);
  const [receiving, setReceiving] = React.useState<TransferOrder | null>(null);
  const [lineQtys, setLineQtys] = React.useState<Record<number, string>>({});

  const pickerOpenRef = React.useRef(false);
  const pickerCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePickerOpenChange = React.useCallback((open: boolean) => {
    if (pickerCloseTimerRef.current) {
      clearTimeout(pickerCloseTimerRef.current);
      pickerCloseTimerRef.current = null;
    }
    if (open) {
      pickerOpenRef.current = true;
      return;
    }
    pickerOpenRef.current = true;
    pickerCloseTimerRef.current = setTimeout(() => {
      pickerOpenRef.current = false;
      pickerCloseTimerRef.current = null;
    }, 300);
  }, []);

  const blockOutsideDismiss = React.useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault();
  }, []);

  const allowDialogClose = React.useCallback((open: boolean, close: () => void) => {
    if (!open && pickerOpenRef.current) return;
    if (!open) close();
  }, []);

  const transfersQuery = useQuery({
    queryKey: ["supply-chain", "transfers", tableQuery, statusFilter, fromWarehouseFilter, toWarehouseFilter],
    queryFn: () =>
      supplyChainApi
        .listTransfers({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          from_warehouse_id: fromWarehouseFilter === "all" ? undefined : Number(fromWarehouseFilter),
          to_warehouse_id: toWarehouseFilter === "all" ? undefined : Number(toWarehouseFilter),
        })
        .then((r) => r.data),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "warehouses", "transfer-picker"],
    queryFn: async () => unwrapList<Warehouse>((await warehouseApi.listWarehouses({ limit: 200 })).data),
  });

  const locationsQuery = useQuery({
    queryKey: ["warehouse", "locations", "transfer-picker"],
    queryFn: async () => unwrapList<WarehouseLocation>((await warehouseApi.listLocations({ limit: 500 })).data),
    enabled: formOpen || Boolean(detail),
  });

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "transfer-picker"],
    queryFn: async () => unwrapList<ProductRecord>(await fetchInventoryProducts({ per_page: 200, limit: 200 })),
    enabled: formOpen,
  });

  const warehouseNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const wh of warehousesQuery.data ?? []) {
      map.set(wh.id, wh.code ? `${wh.name} (${wh.code})` : wh.name);
    }
    return map;
  }, [warehousesQuery.data]);

  const locationNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const loc of locationsQuery.data ?? []) {
      map.set(loc.id, locationLabel(loc));
    }
    return map;
  }, [locationsQuery.data]);

  const fromLocations = React.useMemo(() => {
    const id = form.from_warehouse_id ? Number(form.from_warehouse_id) : null;
    if (!id) return locationsQuery.data ?? [];
    return (locationsQuery.data ?? []).filter((l) => l.warehouse_id === id);
  }, [form.from_warehouse_id, locationsQuery.data]);

  const toLocations = React.useMemo(() => {
    const id = form.to_warehouse_id ? Number(form.to_warehouse_id) : null;
    if (!id) return locationsQuery.data ?? [];
    return (locationsQuery.data ?? []).filter((l) => l.warehouse_id === id);
  }, [form.to_warehouse_id, locationsQuery.data]);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const resetForm = React.useCallback(() => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }, []);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload(form);
      return editingId
        ? supplyChainApi.updateTransfer(editingId, payload)
        : supplyChainApi.createTransfer(payload);
    },
    onSuccess: (response) => {
      toast.success(
        editingId
          ? t("supply_chain.transfers.updated", "Transfer updated.")
          : response?.data?.message || t("supply_chain.transfers.created", "Transfer created."),
      );
      invalidate();
      setFormOpen(false);
      resetForm();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message ||
          (editingId
            ? t("supply_chain.transfers.update_failed", "Could not update the transfer.")
            : t("supply_chain.transfers.create_failed", "Could not create the transfer.")),
      ),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => supplyChainApi.transitionTransfer(id, status),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.common.updated", "Updated."));
      invalidate();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.common.update_failed", "Could not update.")),
  });

  const dispatchMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.dispatchTransfer(dispatching!.id, {
        items: (dispatching!.items ?? []).map((item) => ({
          item_id: item.id,
          quantity: Number(lineQtys[item.id] ?? item.quantity),
        })),
      }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.transfers.dispatched", "Transfer despatched."));
      invalidate();
      setDispatching(null);
      setLineQtys({});
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.transfers.dispatch_failed", "Could not despatch.")),
  });

  const receiveMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.receiveTransfer(receiving!.id, {
        items: (receiving!.items ?? []).map((item) => ({
          item_id: item.id,
          quantity: Number(lineQtys[item.id] ?? item.dispatched_quantity),
        })),
      }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.transfers.received", "Transfer received."));
      invalidate();
      setReceiving(null);
      setLineQtys({});
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.transfers.receive_failed", "Could not receive.")),
  });

  const closeDetail = React.useCallback(() => {
    setDetailOpen(false);
    setDetailLoading(false);
    setLoadingViewId(null);
    setDetail(null);
  }, []);

  const openDetail = React.useCallback(
    async (id: number) => {
      setLoadingViewId(id);
      setDetailOpen(true);
      setDetailLoading(true);
      setDetail(null);
      try {
        const res = await supplyChainApi.getTransfer(id);
        setDetail(res?.data?.data ?? null);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || t("supply_chain.transfers.detail_failed", "Could not load transfer."));
        closeDetail();
      } finally {
        setDetailLoading(false);
        setLoadingViewId(null);
      }
    },
    [closeDetail, t],
  );

  const openEdit = React.useCallback(async (transfer: TransferOrder) => {
    setEditingId(transfer.id);
    setFormOpen(true);
    setEditLoading(true);
    try {
      const res = await supplyChainApi.getTransfer(transfer.id);
      const full = (res?.data?.data as TransferOrder | undefined) ?? transfer;
      setEditingId(full.id);
      setForm(formFromTransfer(full));
    } catch {
      setEditingId(transfer.id);
      setForm(formFromTransfer(transfer));
    } finally {
      setEditLoading(false);
    }
  }, []);

  const openDispatch = React.useCallback(async (transfer: TransferOrder) => {
    setDispatching(transfer);
    setDispatchLoading(true);
    setLineQtys({});
    try {
      const res = await supplyChainApi.getTransfer(transfer.id);
      const full = (res?.data?.data as TransferOrder | undefined) ?? transfer;
      setDispatching(full);
      setLineQtys(Object.fromEntries((full.items ?? []).map((i) => [i.id, String(i.quantity)])));
    } catch {
      setDispatching(transfer);
      setLineQtys(Object.fromEntries((transfer.items ?? []).map((i) => [i.id, String(i.quantity)])));
    } finally {
      setDispatchLoading(false);
    }
  }, []);

  const openReceive = React.useCallback(async (transfer: TransferOrder) => {
    setReceiving(transfer);
    setReceiveLoading(true);
    setLineQtys({});
    try {
      const res = await supplyChainApi.getTransfer(transfer.id);
      const full = (res?.data?.data as TransferOrder | undefined) ?? transfer;
      setReceiving(full);
      setLineQtys(
        Object.fromEntries((full.items ?? []).map((i) => [i.id, String(i.dispatched_quantity)])),
      );
    } catch {
      setReceiving(transfer);
      setLineQtys(
        Object.fromEntries((transfer.items ?? []).map((i) => [i.id, String(i.dispatched_quantity)])),
      );
    } finally {
      setReceiveLoading(false);
    }
  }, []);

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  };

  const columns = React.useMemo<ColumnDef<TransferOrder>[]>(
    () => [
      {
        accessorKey: "transfer_number",
        header: t("supply_chain.transfers.col_transfer", "Transfer"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.transfer_number}</p>
            <p className="text-[11px] text-muted-foreground">
              {warehouseNameById.get(row.original.from_warehouse_id) ?? `#${row.original.from_warehouse_id}`}
              {" → "}
              {warehouseNameById.get(row.original.to_warehouse_id) ?? `#${row.original.to_warehouse_id}`}
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
          const sum = (key: keyof TransferOrderItem) =>
            items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
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
        header: t("supply_chain.transfers.in_transit", "In transit (units)"),
        cell: ({ row }) => {
          const transfer = row.original;
          const value = transferInTransitUnits(transfer);

          return (
            <div className="space-y-0.5">
              <span className={`font-bold tabular-nums ${value > 0 ? "text-indigo-600 dark:text-indigo-400" : ""}`}>
                {value.toLocaleString()}
              </span>
             
            </div>
          );
        },
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => {
          const transfer = row.original;
          const next = NEXT[transfer.status] ?? [];
          const isTransitioning =
            transitionMutation.isPending && transitionMutation.variables?.id === transfer.id;
          const isViewLoading = loadingViewId === transfer.id;
          const isEditLoading = editLoading && editingId === transfer.id;
          const isDispatchLoading = dispatchLoading && dispatching?.id === transfer.id;
          const isReceiveLoading = receiveLoading && receiving?.id === transfer.id;

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isViewLoading || isEditLoading}
                onClick={() => openDetail(transfer.id)}
                aria-label={t("supply_chain.common.view", "View")}
              >
                {isViewLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
              {EDITABLE.has(transfer.status) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={isEditLoading || isViewLoading}
                  onClick={() => openEdit(transfer)}
                  aria-label={t("supply_chain.common.edit", "Edit")}
                >
                  {isEditLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : null}
              {next.length > 0 ? (
                <Select
                  value=""
                  disabled={isTransitioning}
                  onValueChange={(status) => transitionMutation.mutate({ id: transfer.id, status })}
                >
                  <SelectTrigger className="h-8 w-[8rem] text-xs">
                    {isTransitioning ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("supply_chain.common.updating", "Updating…")}
                      </span>
                    ) : (
                      <SelectValue placeholder={t("supply_chain.common.move_to", "Move to...")} />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {next.map((status) => (
                      <SelectItem key={status} value={status} className="text-xs">
                        {status.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {transfer.status === "approved" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={isDispatchLoading}
                  onClick={() => openDispatch(transfer)}
                >
                  {isDispatchLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <TruckIcon className="h-3 w-3" />
                  )}
                  {t("supply_chain.transfers.dispatch", "Despatch")}
                </Button>
              ) : null}
              {["in_transit", "partially_received"].includes(transfer.status) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={isReceiveLoading}
                  onClick={() => openReceive(transfer)}
                >
                  {isReceiveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {t("supply_chain.transfers.receive", "Receive")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      dispatchLoading,
      dispatching?.id,
      editLoading,
      editingId,
      loadingViewId,
      openDetail,
      openDispatch,
      openEdit,
      openReceive,
      receiveLoading,
      receiving?.id,
      t,
      transitionMutation.isPending,
      transitionMutation.variables,
      warehouseNameById,
    ],
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
        <Button
          className="rounded-full px-5"
          onClick={() => {
            resetForm();
            setEditLoading(false);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("supply_chain.transfers.add", "New Transfer")}
        </Button>
      </div>

      {transfersQuery.isPending ? (
        <SupplyChainListSkeleton filters={3} cols={5} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.common.status", "Status")}</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setTableQuery((p) => ({ ...p, page: 1 }));
                }}
              >
                <SelectTrigger className="h-9 w-[12rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  {Object.keys(NEXT).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.transfers.from_warehouse", "From warehouse")}</Label>
              <Select
                value={fromWarehouseFilter}
                onValueChange={(v) => {
                  setFromWarehouseFilter(v);
                  setTableQuery((p) => ({ ...p, page: 1 }));
                }}
              >
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
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.transfers.to_warehouse", "To warehouse")}</Label>
              <Select
                value={toWarehouseFilter}
                onValueChange={(v) => {
                  setToWarehouseFilter(v);
                  setTableQuery((p) => ({ ...p, page: 1 }));
                }}
              >
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
            data={(transfersQuery.data?.data ?? []) as TransferOrder[]}
            totalEntries={transfersQuery.data?.meta?.total ?? 0}
            loading={transfersQuery.isFetching && !transfersQuery.isPending}
            pageIndex={tableQuery.page}
            pageSize={tableQuery.pageSize}
            onQueryChange={handleTableQueryChange}
            searchPlaceholder={t("supply_chain.transfers.search", "Search by number, product, vehicle…")}
            resourceName="transfers"
          />
        </>
      )}

      {/* Create / edit */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          allowDialogClose(open, () => {
            setFormOpen(false);
            setEditLoading(false);
            resetForm();
          });
          if (open) setFormOpen(true);
        }}
      >
        <DialogContent
          className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
          onInteractOutside={blockOutsideDismiss}
          onFocusOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingId
                  ? t("supply_chain.transfers.edit", "Edit Stock Transfer")
                  : t("supply_chain.transfers.new", "New Stock Transfer")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.transfers.new_desc",
                  "Set both locations to have the stock movements posted on despatch and receipt.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            {editLoading ? (
              <SupplyChainDialogSkeleton rows={3} />
            ) : (
            <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("supply_chain.transfers.from_warehouse", "From warehouse")}</Label>
                <Select
                  value={form.from_warehouse_id || undefined}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, from_warehouse_id: v, from_location_id: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("supply_chain.planning.pick_warehouse", "Select warehouse")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(warehousesQuery.data ?? []).map((wh) => (
                      <SelectItem key={wh.id} value={String(wh.id)}>
                        {wh.name}
                        {wh.code ? ` (${wh.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("supply_chain.transfers.to_warehouse", "To warehouse")}</Label>
                <Select
                  value={form.to_warehouse_id || undefined}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setForm((f) => ({ ...f, to_warehouse_id: v, to_location_id: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("supply_chain.planning.pick_warehouse", "Select warehouse")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(warehousesQuery.data ?? []).map((wh) => (
                      <SelectItem key={wh.id} value={String(wh.id)}>
                        {wh.name}
                        {wh.code ? ` (${wh.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("supply_chain.transfers.from_location", "From location")}</Label>
                <Select
                  value={form.from_location_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setForm((f) => ({ ...f, from_location_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                    {fromLocations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {locationLabel(loc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {t("supply_chain.transfers.from_hint", "Needed to issue stock on despatch.")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("supply_chain.transfers.to_location", "To location")}</Label>
                <Select
                  value={form.to_location_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setForm((f) => ({ ...f, to_location_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                    {toLocations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {locationLabel(loc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {t("supply_chain.transfers.to_hint", "Needed to receive stock at destination.")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tr-vehicle">{t("supply_chain.shipments.vehicle", "Vehicle")}</Label>
                <Input
                  id="tr-vehicle"
                  value={form.vehicle}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tr-reason">{t("supply_chain.transfers.reason", "Reason")}</Label>
                <Input
                  id="tr-reason"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tr-notes">{t("supply_chain.common.notes", "Notes")}</Label>
                <Textarea
                  id="tr-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("supply_chain.transfers.lines", "Lines")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_LINE }] }))}
                >
                  <Plus className="h-3 w-3" />
                  {t("supply_chain.shipments.add_line", "Add Line")}
                </Button>
              </div>

              {form.items.map((line, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-border/40 bg-background p-3 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <Label className="text-[11px]">{t("supply_chain.common.product", "Product")}</Label>
                    <Select
                      value={line.product_id || undefined}
                      onOpenChange={handlePickerOpenChange}
                      onValueChange={(v) => updateLine(index, { product_id: v })}
                    >
                      <SelectTrigger className="h-9">
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
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.common.quantity", "Quantity")}</Label>
                    <Input
                      type="number"
                      className="h-9"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-[11px]">{t("supply_chain.common.uom", "UOM")}</Label>
                    <Input
                      className="h-9"
                      value={line.uom}
                      onChange={(e) => updateLine(index, { uom: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-[11px]">{t("supply_chain.common.batch", "Batch / lot")}</Label>
                    <Input
                      className="h-9"
                      value={line.batch_number}
                      onChange={(e) => updateLine(index, { batch_number: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end md:col-span-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive"
                      onClick={() =>
                        setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            </>
            )}
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setFormOpen(false);
                setEditLoading(false);
                resetForm();
              }}
            >
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={saveMutation.isPending || editLoading}
              onClick={() => {
                if (!form.from_warehouse_id || !form.to_warehouse_id) {
                  toast.error(t("supply_chain.transfers.warehouses_required", "Both warehouses are required."));
                  return;
                }
                if (form.from_warehouse_id === form.to_warehouse_id) {
                  toast.error(t("supply_chain.transfers.same_warehouse", "From and to warehouses must differ."));
                  return;
                }
                if (!form.items.some((l) => l.product_id && l.quantity)) {
                  toast.error(t("supply_chain.transfers.line_required", "Add at least one line."));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={detailOpen} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.transfer_number ?? t("supply_chain.transfers.detail", "Transfer")}
              </DialogTitle>
              <DialogDescription>
                {detailLoading
                  ? t("supply_chain.common.loading", "Loading…")
                  : detail
                    ? `${warehouseNameById.get(detail.from_warehouse_id) ?? `#${detail.from_warehouse_id}`} → ${warehouseNameById.get(detail.to_warehouse_id) ?? `#${detail.to_warehouse_id}`}`
                    : ""}
              </DialogDescription>
            </DialogHeader>
          </div>
          {detailLoading ? (
            <SupplyChainDialogSkeleton rows={3} />
          ) : detail ? (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.common.status", "Status")}
                  </p>
                  <TransferStatusBadge status={detail.status} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.shipments.vehicle", "Vehicle")}
                  </p>
                  <p>{detail.vehicle || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.transfers.from_location", "From location")}
                  </p>
                  <p>
                    {detail.from_location_id
                      ? locationNameById.get(detail.from_location_id) ?? `#${detail.from_location_id}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.transfers.to_location", "To location")}
                  </p>
                  <p>
                    {detail.to_location_id
                      ? locationNameById.get(detail.to_location_id) ?? `#${detail.to_location_id}`
                      : "—"}
                  </p>
                </div>
              </div>
              {detail.reason ? <p>{detail.reason}</p> : null}
              {detail.notes ? <p className="text-muted-foreground">{detail.notes}</p> : null}
              <div className="space-y-2">
                <p className="text-sm font-bold">{t("supply_chain.transfers.lines", "Lines")}</p>
                {(detail.items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border/40 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold">{item.product?.name ?? `#${item.product_id}`}</p>
                      <p className="text-muted-foreground">
                        {item.batch_number ? `${item.batch_number} · ` : ""}
                        {item.uom}
                      </p>
                    </div>
                    <p className="tabular-nums font-bold">
                      {Number(item.quantity).toLocaleString()} / {Number(item.dispatched_quantity).toLocaleString()} /{" "}
                      {Number(item.received_quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={closeDetail}>
              {t("supply_chain.common.close", "Close")}
            </Button>
            {detail && EDITABLE.has(detail.status) ? (
              <Button
                className="rounded-full"
                disabled={editLoading}
                onClick={() => {
                  const tr = detail;
                  closeDetail();
                  openEdit(tr);
                }}
              >
                {editLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("supply_chain.common.edit", "Edit")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Despatch */}
      <Dialog
        open={dispatching !== null}
        onOpenChange={(open) => {
          allowDialogClose(open, () => {
            setDispatching(null);
            setDispatchLoading(false);
            setLineQtys({});
          });
        }}
      >
        <DialogContent
          className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
          onInteractOutside={blockOutsideDismiss}
          onFocusOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.transfers.dispatch_title", "Despatch Transfer")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.transfers.dispatch_desc",
                  "Confirm quantities leaving the origin. Stock issues when a from-location is set.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto px-6 py-5">
            {dispatchLoading ? (
              <SupplyChainDialogSkeleton rows={2} />
            ) : (
            (dispatching?.items ?? []).map((item) => (
              <div key={item.id} className="grid items-end gap-3 rounded-xl border border-border/40 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold">{item.product?.name ?? `#${item.product_id}`}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("supply_chain.transfers.requested", "Requested")} {Number(item.quantity).toLocaleString()}{" "}
                    {item.uom}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("supply_chain.transfers.dispatch_qty", "Despatch qty")}</Label>
                  <Input
                    type="number"
                    className="h-9"
                    max={Number(item.quantity)}
                    value={lineQtys[item.id] ?? ""}
                    onChange={(e) => setLineQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              </div>
            ))
            )}
          </div>
          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setDispatching(null);
                setDispatchLoading(false);
                setLineQtys({});
              }}
            >
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={dispatchMutation.isPending || dispatchLoading}
              onClick={() => dispatchMutation.mutate()}
            >
              {dispatchMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.transfers.confirm_dispatch", "Confirm Despatch")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive */}
      <Dialog
        open={receiving !== null}
        onOpenChange={(open) => {
          allowDialogClose(open, () => {
            setReceiving(null);
            setReceiveLoading(false);
            setLineQtys({});
          });
        }}
      >
        <DialogContent
          className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
          onInteractOutside={blockOutsideDismiss}
          onFocusOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.transfers.receive_title", "Receive Transfer")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.transfers.receive_desc",
                  "Enter what arrived. Receiving less than despatched leaves the transfer partially received.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto px-6 py-5">
            {receiveLoading ? (
              <SupplyChainDialogSkeleton rows={2} />
            ) : (
            (receiving?.items ?? []).map((item) => (
              <div key={item.id} className="grid items-end gap-3 rounded-xl border border-border/40 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold">{item.product?.name ?? `#${item.product_id}`}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("supply_chain.transfers.despatched", "Despatched")}{" "}
                    {Number(item.dispatched_quantity).toLocaleString()} {item.uom}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("supply_chain.transfers.receive_qty", "Receive qty")}</Label>
                  <Input
                    type="number"
                    className="h-9"
                    max={Number(item.dispatched_quantity)}
                    value={lineQtys[item.id] ?? ""}
                    onChange={(e) => setLineQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              </div>
            ))
            )}
          </div>
          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setReceiving(null);
                setReceiveLoading(false);
                setLineQtys({});
              }}
            >
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={receiveMutation.isPending || receiveLoading}
              onClick={() => receiveMutation.mutate()}
            >
              {receiveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.transfers.confirm_receive", "Confirm Receipt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
