"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, PackageCheck, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { DeliveryRoute, Shipment } from "@/modules/supplychain/types";
import { ShipmentStatusBadge } from "@/modules/shared/charts/primitives";
import {
  SupplyChainDialogSkeleton,
  SupplyChainListSkeleton,
} from "@/modules/supplychain/pages/components/supply-chain-skeletons";
import { fetchInventoryProducts } from "@/modules/inventory/api";
import type { ProductRecord } from "@/modules/inventory/types";
import { warehouseApi } from "@/modules/warehouse/api";
import type { Warehouse, WarehouseLocation } from "@/modules/warehouse/types";
import { crmApi } from "@/modules/crm/api";
import type { CrmContact } from "@/modules/crm/types";
import { fetchUsers } from "@/modules/identity/api";

/** Mirrors the server state machine so an impossible move is never offered. */
const NEXT: Record<string, string[]> = {
  draft: ["planned", "cancelled"],
  planned: ["loaded", "draft", "cancelled"],
  loaded: ["in_transit", "planned", "cancelled"],
  in_transit: [],
  partially_delivered: [],
  delivered: [],
  failed: ["planned", "cancelled"],
  cancelled: [],
};

const FAILURE_REASONS = ["customer_absent", "refused", "access_blocked", "vehicle_breakdown", "other"];
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const EDITABLE = new Set(["draft", "planned", "loaded"]);

type LineDraft = {
  product_id: string;
  quantity: string;
  unit_price: string;
  batch_number: string;
  uom: string;
  expiry_date: string;
};

const EMPTY_LINE: LineDraft = {
  product_id: "",
  quantity: "",
  unit_price: "",
  batch_number: "",
  uom: "pcs",
  expiry_date: "",
};

type ShipmentForm = {
  customer_contact_id: string;
  route_id: string;
  origin_warehouse_id: string;
  origin_location_id: string;
  destination_name: string;
  destination_address: string;
  destination_phone: string;
  vehicle: string;
  driver_id: string;
  priority: string;
  delivery_note_number: string;
  planned_dispatch_at: string;
  notes: string;
  items: LineDraft[];
};

const DEFAULT_FORM: ShipmentForm = {
  customer_contact_id: "",
  route_id: "",
  origin_warehouse_id: "",
  origin_location_id: "",
  destination_name: "",
  destination_address: "",
  destination_phone: "",
  vehicle: "",
  driver_id: "",
  priority: "normal",
  delivery_note_number: "",
  planned_dispatch_at: "",
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

function toDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function contactLabel(c: CrmContact): string {
  const name = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || `Contact #${c.id}`;
  return c.phone ? `${name} · ${c.phone}` : name;
}

function locationLabel(loc: WarehouseLocation): string {
  return loc.name || loc.code || `Location #${loc.id}`;
}

function formFromShipment(s: Shipment): ShipmentForm {
  return {
    customer_contact_id: s.customer_contact_id ? String(s.customer_contact_id) : "",
    route_id: s.route_id ? String(s.route_id) : "",
    origin_warehouse_id: s.origin_warehouse_id ? String(s.origin_warehouse_id) : "",
    origin_location_id: s.origin_location_id ? String(s.origin_location_id) : "",
    destination_name: s.destination_name ?? "",
    destination_address: s.destination_address ?? "",
    destination_phone: s.destination_phone ?? "",
    vehicle: s.vehicle ?? "",
    driver_id: s.driver_id ? String(s.driver_id) : "",
    priority: s.priority || "normal",
    delivery_note_number: s.delivery_note_number ?? "",
    planned_dispatch_at: toDateTimeLocal(s.planned_dispatch_at),
    notes: s.notes ?? "",
    items:
      (s.items ?? []).length > 0
        ? (s.items ?? []).map((item) => ({
            product_id: String(item.product_id),
            quantity: String(item.quantity),
            unit_price: item.unit_price != null ? String(item.unit_price) : "",
            batch_number: item.batch_number ?? "",
            uom: item.uom || "pcs",
            expiry_date: item.expiry_date ? String(item.expiry_date).slice(0, 10) : "",
          }))
        : [{ ...EMPTY_LINE }],
  };
}

function buildPayload(form: ShipmentForm) {
  return {
    customer_contact_id: form.customer_contact_id ? Number(form.customer_contact_id) : null,
    route_id: form.route_id ? Number(form.route_id) : null,
    origin_warehouse_id: form.origin_warehouse_id ? Number(form.origin_warehouse_id) : null,
    origin_location_id: form.origin_location_id ? Number(form.origin_location_id) : null,
    destination_name: form.destination_name || null,
    destination_address: form.destination_address || null,
    destination_phone: form.destination_phone || null,
    vehicle: form.vehicle || null,
    driver_id: form.driver_id ? Number(form.driver_id) : null,
    priority: form.priority || "normal",
    delivery_note_number: form.delivery_note_number || null,
    planned_dispatch_at: form.planned_dispatch_at || null,
    notes: form.notes || null,
    items: form.items
      .filter((line) => line.product_id && line.quantity)
      .map((line) => ({
        product_id: Number(line.product_id),
        quantity: Number(line.quantity),
        unit_price: line.unit_price ? Number(line.unit_price) : null,
        batch_number: line.batch_number || null,
        uom: line.uom || "pcs",
        expiry_date: line.expiry_date || null,
      })),
  };
}

function shipmentUnitTotals(shipment: Shipment) {
  const items = shipment.items ?? [];
  const loadedFromLines = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const delivered = items.reduce((sum, item) => sum + Number(item.delivered_quantity ?? 0), 0);
  const loaded = loadedFromLines > 0 ? loadedFromLines : Number(shipment.total_quantity ?? 0);
  const fillRate = loaded > 0 ? (delivered / loaded) * 100 : Number(shipment.fill_rate_percent ?? 0);

  return { loaded, delivered, fillRate };
}

export default function ShipmentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [routeFilter, setRouteFilter] = React.useState("all");
  const [warehouseFilter, setWarehouseFilter] = React.useState("all");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<ShipmentForm>(DEFAULT_FORM);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [loadingViewId, setLoadingViewId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<Shipment | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [delivering, setDelivering] = React.useState<Shipment | null>(null);
  const [deliveredLines, setDeliveredLines] = React.useState<Record<number, string>>({});
  const [proof, setProof] = React.useState({
    received_by_name: "",
    received_by_phone: "",
    proof_reference: "",
    failure_reason: "",
  });

  const pickerOpenRef = React.useRef(false);
  const pickerCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openPickerCount, setOpenPickerCount] = React.useState(0);

  const handlePickerOpenChange = React.useCallback((open: boolean) => {
    if (pickerCloseTimerRef.current) {
      clearTimeout(pickerCloseTimerRef.current);
      pickerCloseTimerRef.current = null;
    }
    if (open) {
      pickerOpenRef.current = true;
      setOpenPickerCount((n) => n + 1);
      return;
    }
    // Keep the dialog alive through the same click that dismisses the select
    // (including clicks on the dialog body / other fields).
    pickerOpenRef.current = true;
    setOpenPickerCount((n) => Math.max(0, n - 1));
    pickerCloseTimerRef.current = setTimeout(() => {
      pickerOpenRef.current = false;
      pickerCloseTimerRef.current = null;
    }, 300);
  }, []);

  /** Never dismiss the form via outside click — Cancel / X only. Select portals fight Dialog's dismiss layer. */
  const blockOutsideDismiss = React.useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault();
  }, []);

  const allowDialogClose = React.useCallback((open: boolean, close: () => void) => {
    if (!open && (pickerOpenRef.current || openPickerCount > 0)) return;
    if (!open) close();
  }, [openPickerCount]);

  const shipmentsQuery = useQuery({
    queryKey: ["supply-chain", "shipments", tableQuery, statusFilter, routeFilter, warehouseFilter],
    queryFn: () =>
      supplyChainApi
        .listShipments({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          route_id: routeFilter === "all" ? undefined : Number(routeFilter),
          origin_warehouse_id: warehouseFilter === "all" ? undefined : Number(warehouseFilter),
        })
        .then((r) => r.data),
  });

  const routesQuery = useQuery({
    queryKey: ["supply-chain", "routes", "select"],
    queryFn: () => supplyChainApi.listRoutes({ limit: 100, is_active: true }).then((r) => r.data),
  });

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "shipment-picker"],
    queryFn: async () => unwrapList<ProductRecord>(await fetchInventoryProducts({ per_page: 200, limit: 200 })),
    enabled: formOpen,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "warehouses", "shipment-picker"],
    queryFn: async () => unwrapList<Warehouse>((await warehouseApi.listWarehouses({ limit: 200 })).data),
  });

  const locationsQuery = useQuery({
    queryKey: ["warehouse", "locations", "shipment-picker"],
    queryFn: async () => unwrapList<WarehouseLocation>((await warehouseApi.listLocations({ limit: 500 })).data),
    enabled: formOpen || Boolean(detail),
  });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", "shipment-picker"],
    queryFn: async () => unwrapList<CrmContact>((await crmApi.listContacts({ limit: 200, per_page: 200 })).data),
    enabled: formOpen,
  });

  const usersQuery = useQuery({
    queryKey: ["identity", "users", "shipment-drivers"],
    queryFn: async () => {
      const res = await fetchUsers({ per_page: 100 });
      return unwrapList<{ id: number; name?: string; email?: string }>(res);
    },
    enabled: formOpen,
  });

  const routes: DeliveryRoute[] = routesQuery.data?.data ?? [];

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

  const locationsForWarehouse = React.useMemo(() => {
    const warehouseId = form.origin_warehouse_id ? Number(form.origin_warehouse_id) : null;
    if (!warehouseId) return locationsQuery.data ?? [];
    return (locationsQuery.data ?? []).filter((loc) => loc.warehouse_id === warehouseId);
  }, [form.origin_warehouse_id, locationsQuery.data]);

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
        ? supplyChainApi.updateShipment(editingId, payload)
        : supplyChainApi.createShipment(payload);
    },
    onSuccess: (response) => {
      const shipment = response?.data?.data as Shipment | undefined;
      toast.success(
        editingId
          ? t("supply_chain.shipments.updated", "Shipment updated.")
          : shipment
            ? t("supply_chain.shipments.created", "Shipment {number} created.").replace(
                "{number}",
                shipment.shipment_number,
              )
            : t("supply_chain.shipments.created_generic", "Shipment created."),
      );
      invalidate();
      setFormOpen(false);
      resetForm();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message ||
          (editingId
            ? t("supply_chain.shipments.update_failed", "Could not update the shipment.")
            : t("supply_chain.shipments.create_failed", "Could not create the shipment.")),
      ),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => supplyChainApi.transitionShipment(id, status),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.common.updated", "Updated."));
      invalidate();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.common.update_failed", "Could not update.")),
  });

  const deliverMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.recordDelivery(delivering!.id, {
        items: (delivering!.items ?? []).map((item) => ({
          item_id: item.id,
          delivered_quantity: Number(deliveredLines[item.id] ?? item.quantity),
        })),
        received_by_name: proof.received_by_name || undefined,
        received_by_phone: proof.received_by_phone || undefined,
        proof_reference: proof.proof_reference || undefined,
        failure_reason: proof.failure_reason || undefined,
      }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.shipments.delivered", "Delivery recorded."));
      invalidate();
      setDelivering(null);
      setProof({ received_by_name: "", received_by_phone: "", proof_reference: "", failure_reason: "" });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.shipments.deliver_failed", "Could not record the delivery.")),
  });

  const closeDetail = React.useCallback(() => {
    setDetailOpen(false);
    setDetailLoading(false);
    setLoadingViewId(null);
    setDetail(null);
  }, []);

  const openDetail = React.useCallback(async (id: number) => {
    setLoadingViewId(id);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await supplyChainApi.getShipment(id);
      setDetail(res?.data?.data ?? null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("supply_chain.shipments.detail_failed", "Could not load shipment."));
      closeDetail();
    } finally {
      setDetailLoading(false);
      setLoadingViewId(null);
    }
  }, [closeDetail, t]);

  const openEdit = React.useCallback(
    async (shipment: Shipment) => {
      setEditingId(shipment.id);
      setFormOpen(true);
      setEditLoading(true);
      try {
        const res = await supplyChainApi.getShipment(shipment.id);
        const full = (res?.data?.data as Shipment | undefined) ?? shipment;
        setEditingId(full.id);
        setForm(formFromShipment(full));
      } catch {
        setEditingId(shipment.id);
        setForm(formFromShipment(shipment));
      } finally {
        setEditLoading(false);
      }
    },
    [],
  );

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const columns = React.useMemo<ColumnDef<Shipment>[]>(
    () => [
      {
        accessorKey: "shipment_number",
        header: t("supply_chain.shipments.col_shipment", "Shipment"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.shipment_number}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.destination_name ?? "—"}</p>
            {row.original.origin_warehouse_id ? (
              <p className="text-[11px] text-muted-foreground">
                {warehouseNameById.get(row.original.origin_warehouse_id) ??
                  `${t("supply_chain.common.warehouse", "Warehouse")} #${row.original.origin_warehouse_id}`}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "route",
        header: t("supply_chain.common.route", "Route"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.route?.name ?? "—"}</p>
            <p className="text-muted-foreground">{row.original.vehicle ?? "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("supply_chain.common.status", "Status"),
        cell: ({ row }) => (
          <div className="space-y-1">
            <ShipmentStatusBadge status={row.original.status} />
            <p className="text-[11px] capitalize text-muted-foreground">{row.original.priority}</p>
          </div>
        ),
      },
      {
        id: "fill",
        header: t("supply_chain.shipments.col_fill", "Units loaded / delivered"),
        cell: ({ row }) => {
          const shipment = row.original;
          const { loaded, delivered, fillRate } = shipmentUnitTotals(shipment);
          const awaitingDelivery =
            delivered === 0 && ["in_transit", "partially_delivered"].includes(shipment.status);

          return (
            <div className="space-y-0.5 tabular-nums">
              <p className="text-sm">
                {loaded.toLocaleString()} → {delivered.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">{fillRate.toFixed(1)}% fill</p>
              {awaitingDelivery ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {t("supply_chain.shipments.use_deliver", "Use Deliver to record")}
                </p>
              ) : delivered === 0 && !["delivered", "failed", "cancelled"].includes(shipment.status) ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("supply_chain.shipments.not_delivered_yet", "Not delivered yet")}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "dates",
        header: t("supply_chain.shipments.col_dates", "Planned / delivered date"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>
              {row.original.planned_dispatch_at
                ? new Date(row.original.planned_dispatch_at).toLocaleDateString()
                : "—"}
            </p>
            <p className="text-muted-foreground">
              {row.original.delivered_at ? new Date(row.original.delivered_at).toLocaleDateString() : "—"}
            </p>
            {!row.original.delivered_at && row.original.status === "in_transit" ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {t("supply_chain.shipments.awaiting_delivery", "Awaiting delivery")}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => {
          const shipment = row.original;
          const next = NEXT[shipment.status] ?? [];
          const canDeliver = ["in_transit", "partially_delivered"].includes(shipment.status);
          const canEdit = EDITABLE.has(shipment.status);
          const isTransitioning =
            transitionMutation.isPending && transitionMutation.variables?.id === shipment.id;
          const isViewLoading = loadingViewId === shipment.id;
          const isEditLoading = editLoading && editingId === shipment.id;

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isViewLoading || isEditLoading}
                onClick={() => openDetail(shipment.id)}
                aria-label={t("supply_chain.common.view", "View")}
              >
                {isViewLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={isEditLoading || isViewLoading}
                  onClick={() => openEdit(shipment)}
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
                  onValueChange={(status) => transitionMutation.mutate({ id: shipment.id, status })}
                >
                  <SelectTrigger className="h-8 w-[8.5rem] text-xs">
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
              {canDeliver ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    setDelivering(shipment);
                    setDeliveredLines(
                      Object.fromEntries((shipment.items ?? []).map((i) => [i.id, String(i.quantity)])),
                    );
                    setProof({
                      received_by_name: "",
                      received_by_phone: "",
                      proof_reference: "",
                      failure_reason: "",
                    });
                  }}
                >
                  <PackageCheck className="h-3 w-3" />
                  {t("supply_chain.shipments.deliver", "Deliver")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      detailLoading,
      detailOpen,
      editLoading,
      editingId,
      loadingViewId,
      openDetail,
      openEdit,
      t,
      transitionMutation.isPending,
      transitionMutation.variables,
      warehouseNameById,
    ],
  );

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("supply_chain.shipments.title", "Shipments")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.shipments.subtitle",
              "Stock leaves the books at despatch. Anything the customer does not take comes back onto the store count automatically.",
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
          {t("supply_chain.shipments.add", "New Shipment")}
        </Button>
      </div>

      {shipmentsQuery.isPending ? (
        <SupplyChainListSkeleton filters={3} cols={6} />
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
                  {Object.keys(NEXT).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.common.route", "Route")}</Label>
              <Select
                value={routeFilter}
                onValueChange={(v) => {
                  setRouteFilter(v);
                  setTableQuery((p) => ({ ...p, page: 1 }));
                }}
              >
                <SelectTrigger className="h-9 w-[14rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={String(route.id)}>
                      {route.code} — {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.common.warehouse", "Origin warehouse")}</Label>
              <Select
                value={warehouseFilter}
                onValueChange={(v) => {
                  setWarehouseFilter(v);
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
            data={(shipmentsQuery.data?.data ?? []) as Shipment[]}
            totalEntries={shipmentsQuery.data?.meta?.total ?? 0}
            loading={shipmentsQuery.isFetching && !shipmentsQuery.isPending}
            pageIndex={tableQuery.page}
            pageSize={tableQuery.pageSize}
            onQueryChange={handleTableQueryChange}
            searchPlaceholder={t("supply_chain.shipments.search", "Search by number or destination...")}
            resourceName="shipments"
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
          className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
          onInteractOutside={blockOutsideDismiss}
          onFocusOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingId
                  ? t("supply_chain.shipments.edit", "Edit Shipment")
                  : t("supply_chain.shipments.new", "New Shipment")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.shipments.new_desc",
                  "Set the origin location to have the stock issue posted automatically when the load leaves.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            {editLoading ? (
              <SupplyChainDialogSkeleton rows={3} />
            ) : (
            <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t("supply_chain.shipments.customer", "Customer contact")}</Label>
                <Select
                  value={form.customer_contact_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setForm((f) => ({ ...f, customer_contact_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("supply_chain.common.none", "None")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                    {(contactsQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {contactLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("supply_chain.common.route", "Route")}</Label>
                <Select
                  value={form.route_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setForm((f) => ({ ...f, route_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("supply_chain.shipments.select_route", "Select a round")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                    {routes.map((route) => (
                      <SelectItem key={route.id} value={String(route.id)}>
                        {route.code} — {route.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-vehicle">{t("supply_chain.shipments.vehicle", "Vehicle")}</Label>
                <Input
                  id="sh-vehicle"
                  value={form.vehicle}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))}
                  placeholder="AA-3-12345"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("supply_chain.common.warehouse", "Origin warehouse")}</Label>
                <Select
                  value={form.origin_warehouse_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      origin_warehouse_id: v === "none" ? "" : v,
                      origin_location_id: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
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
                <Label>{t("supply_chain.shipments.origin_location", "Origin location")}</Label>
                <Select
                  value={form.origin_location_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setForm((f) => ({ ...f, origin_location_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                    {locationsForWarehouse.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {locationLabel(loc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "supply_chain.shipments.origin_hint",
                    "Required for automatic stock issue at despatch.",
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-planned">{t("supply_chain.shipments.planned", "Planned despatch")}</Label>
                <Input
                  id="sh-planned"
                  type="datetime-local"
                  value={form.planned_dispatch_at}
                  onChange={(e) => setForm((f) => ({ ...f, planned_dispatch_at: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("supply_chain.shipments.priority", "Priority")}</Label>
                <Select
                  value={form.priority}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("supply_chain.shipments.driver", "Driver")}</Label>
                <Select
                  value={form.driver_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setForm((f) => ({ ...f, driver_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                    {(usersQuery.data ?? []).map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name || u.email || `User #${u.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-dn">{t("supply_chain.shipments.delivery_note", "Delivery note #")}</Label>
                <Input
                  id="sh-dn"
                  value={form.delivery_note_number}
                  onChange={(e) => setForm((f) => ({ ...f, delivery_note_number: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sh-dest">{t("supply_chain.shipments.destination", "Destination")}</Label>
                <Input
                  id="sh-dest"
                  value={form.destination_name}
                  onChange={(e) => setForm((f) => ({ ...f, destination_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-phone">{t("supply_chain.shipments.phone", "Phone")}</Label>
                <Input
                  id="sh-phone"
                  value={form.destination_phone}
                  onChange={(e) => setForm((f) => ({ ...f, destination_phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-address">{t("supply_chain.shipments.address", "Address")}</Label>
                <Input
                  id="sh-address"
                  value={form.destination_address}
                  onChange={(e) => setForm((f) => ({ ...f, destination_address: e.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="sh-notes">{t("supply_chain.common.notes", "Notes")}</Label>
                <Textarea
                  id="sh-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("supply_chain.shipments.lines", "Load")}</p>
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
                  <div className="md:col-span-4">
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
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.common.unit_price", "Unit price")}</Label>
                    <Input
                      type="number"
                      className="h-9"
                      value={line.unit_price}
                      onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.common.batch", "Batch / lot")}</Label>
                    <Input
                      className="h-9"
                      value={line.batch_number}
                      onChange={(e) => updateLine(index, { batch_number: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.common.expiry", "Expiry")}</Label>
                    <Input
                      type="date"
                      className="h-9"
                      value={line.expiry_date}
                      onChange={(e) => updateLine(index, { expiry_date: e.target.value })}
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
                if (!form.items.some((l) => l.product_id && l.quantity)) {
                  toast.error(t("supply_chain.shipments.line_required", "Add at least one line to the load."));
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
                {detail?.shipment_number ?? t("supply_chain.shipments.detail", "Shipment")}
              </DialogTitle>
              <DialogDescription>
                {detailLoading
                  ? t("supply_chain.common.loading", "Loading…")
                  : detail?.destination_name || t("supply_chain.shipments.no_destination", "No destination set")}
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
                  <ShipmentStatusBadge status={detail.status} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.common.warehouse", "Origin")}
                  </p>
                  <p>
                    {detail.origin_warehouse_id
                      ? warehouseNameById.get(detail.origin_warehouse_id) ?? `#${detail.origin_warehouse_id}`
                      : "—"}
                    {detail.origin_location_id
                      ? ` · ${locationNameById.get(detail.origin_location_id) ?? `#${detail.origin_location_id}`}`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.common.route", "Route")}
                  </p>
                  <p>{detail.route?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.shipments.vehicle", "Vehicle")} / {t("supply_chain.shipments.driver", "Driver")}
                  </p>
                  <p>
                    {detail.vehicle || "—"}
                    {detail.driver?.name || detail.driver?.email
                      ? ` · ${detail.driver.name || detail.driver.email}`
                      : detail.driver_id
                        ? ` · #${detail.driver_id}`
                        : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.shipments.received_by", "Received by")}
                  </p>
                  <p>
                    {detail.received_by_name || "—"}
                    {detail.received_by_phone ? ` · ${detail.received_by_phone}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.shipments.proof", "Proof")}
                  </p>
                  <p>{detail.proof_reference || "—"}</p>
                </div>
              </div>
              {detail.notes ? <p className="text-muted-foreground">{detail.notes}</p> : null}
              <div className="space-y-2">
                <p className="text-sm font-bold">{t("supply_chain.shipments.lines", "Load")}</p>
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
                      {Number(item.delivered_quantity).toLocaleString()} / {Number(item.quantity).toLocaleString()}
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
                  const s = detail;
                  closeDetail();
                  openEdit(s);
                }}
              >
                {editLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("supply_chain.common.edit", "Edit")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record delivery */}
      <Dialog
        open={delivering !== null}
        onOpenChange={(open) => {
          allowDialogClose(open, () => setDelivering(null));
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
                {t("supply_chain.shipments.record_delivery", "Record Delivery")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.shipments.record_desc",
                  "Enter what the customer actually took. Anything left on the truck is returned to stock automatically.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {(delivering?.items ?? []).map((item) => (
              <div key={item.id} className="grid items-end gap-3 rounded-xl border border-border/40 p-3 md:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold">{item.product?.name ?? `#${item.product_id}`}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("supply_chain.shipments.loaded", "Loaded")} {Number(item.quantity).toLocaleString()} {item.uom}
                    {item.batch_number ? ` · ${item.batch_number}` : ""}
                  </p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor={`deliver-${item.id}`} className="text-xs">
                    {t("supply_chain.shipments.delivered_qty", "Delivered quantity")}
                  </Label>
                  <Input
                    id={`deliver-${item.id}`}
                    type="number"
                    className="h-9"
                    max={Number(item.quantity)}
                    value={deliveredLines[item.id] ?? ""}
                    onChange={(e) => setDeliveredLines((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              </div>
            ))}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pod-name">{t("supply_chain.shipments.received_by", "Received by")}</Label>
                <Input
                  id="pod-name"
                  value={proof.received_by_name}
                  onChange={(e) => setProof((p) => ({ ...p, received_by_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pod-phone">{t("supply_chain.shipments.received_phone", "Received-by phone")}</Label>
                <Input
                  id="pod-phone"
                  value={proof.received_by_phone}
                  onChange={(e) => setProof((p) => ({ ...p, received_by_phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pod-ref">{t("supply_chain.shipments.proof", "Proof reference")}</Label>
                <Input
                  id="pod-ref"
                  value={proof.proof_reference}
                  onChange={(e) => setProof((p) => ({ ...p, proof_reference: e.target.value }))}
                  placeholder="pod/2026-08-15/001.jpg"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("supply_chain.shipments.failure_reason", "Failure reason")}</Label>
                <Select
                  value={proof.failure_reason || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setProof((p) => ({ ...p, failure_reason: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("supply_chain.shipments.if_failed", "If nothing was taken")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                    {FAILURE_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setDelivering(null)}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button className="rounded-full" disabled={deliverMutation.isPending} onClick={() => deliverMutation.mutate()}>
              {deliverMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.shipments.confirm_delivery", "Confirm Delivery")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
