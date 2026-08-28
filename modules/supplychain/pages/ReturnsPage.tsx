"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { ReturnItem, Shipment, SupplyChainReturn } from "@/modules/supplychain/types";
import { ReturnStatusBadge } from "@/modules/shared/charts/primitives";
import {
  SupplyChainDialogSkeleton,
  SupplyChainListSkeleton,
} from "@/modules/supplychain/pages/components/supply-chain-skeletons";
import { fetchInventoryProducts } from "@/modules/inventory/api";
import type { ProductRecord } from "@/modules/inventory/types";
import { warehouseApi } from "@/modules/warehouse/api";
import type { WarehouseLocation } from "@/modules/warehouse/types";
import { crmApi } from "@/modules/crm/api";
import type { CrmContact } from "@/modules/crm/types";

const REASONS = ["damaged", "expired", "wrong_item", "short_shelf_life", "quality_complaint", "over_supply", "other"];
const DISPOSITIONS = ["restock", "scrap", "replace", "refund", "quarantine"];
const CONDITIONS = ["good", "damaged", "expired", "contaminated"];
const STATUSES = ["draft", "authorised", "received", "inspected", "closed", "rejected"] as const;

/** Mirrors server TRANSITIONS — inspected is set only via Inspect. */
const NEXT: Record<string, string[]> = {
  draft: ["authorised", "rejected"],
  authorised: ["draft", "received", "rejected"],
  received: ["authorised", "rejected"],
  inspected: ["closed"],
  closed: [],
  rejected: [],
};

const EDITABLE = new Set(["draft"]);

type LineDraft = {
  product_id: string;
  quantity: string;
  unit_price: string;
  batch_number: string;
  uom: string;
  condition: string;
};

const EMPTY_LINE: LineDraft = {
  product_id: "",
  quantity: "",
  unit_price: "",
  batch_number: "",
  uom: "pcs",
  condition: "",
};

type ReturnForm = {
  customer_contact_id: string;
  shipment_id: string;
  reason: string;
  return_location_id: string;
  notes: string;
  items: LineDraft[];
};

const DEFAULT_FORM: ReturnForm = {
  customer_contact_id: "",
  shipment_id: "",
  reason: "damaged",
  return_location_id: "",
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

function contactLabel(c: CrmContact): string {
  const name = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || `Contact #${c.id}`;
  return c.phone ? `${name} · ${c.phone}` : name;
}

function locationLabel(loc: WarehouseLocation): string {
  return loc.name || loc.code || `Location #${loc.id}`;
}

function formFromReturn(record: SupplyChainReturn): ReturnForm {
  return {
    customer_contact_id: record.customer_contact_id ? String(record.customer_contact_id) : "",
    shipment_id: record.shipment_id ? String(record.shipment_id) : "",
    reason: record.reason,
    return_location_id: record.return_location_id ? String(record.return_location_id) : "",
    notes: record.notes ?? "",
    items:
      (record.items ?? []).length > 0
        ? (record.items ?? []).map((item) => ({
            product_id: String(item.product_id),
            quantity: String(item.quantity),
            unit_price: item.unit_price != null ? String(item.unit_price) : "",
            batch_number: item.batch_number ?? "",
            uom: item.uom || "pcs",
            condition: item.condition ?? "",
          }))
        : [{ ...EMPTY_LINE }],
  };
}

function buildPayload(form: ReturnForm) {
  return {
    customer_contact_id: form.customer_contact_id ? Number(form.customer_contact_id) : null,
    shipment_id: form.shipment_id ? Number(form.shipment_id) : null,
    reason: form.reason,
    return_location_id: form.return_location_id ? Number(form.return_location_id) : null,
    notes: form.notes || null,
    items: form.items
      .filter((line) => line.product_id && line.quantity)
      .map((line) => ({
        product_id: Number(line.product_id),
        quantity: Number(line.quantity),
        unit_price: line.unit_price ? Number(line.unit_price) : null,
        batch_number: line.batch_number || null,
        uom: line.uom || "pcs",
        condition: line.condition || null,
      })),
  };
}

function returnUnitTotals(record: SupplyChainReturn) {
  const items = record.items ?? [];
  const returned = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const accepted = items.reduce((sum, item) => sum + Number(item.accepted_quantity ?? 0), 0);
  const acceptRate = returned > 0 ? (accepted / returned) * 100 : 0;

  return { returned, accepted, acceptRate };
}

export default function ReturnsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [reasonFilter, setReasonFilter] = React.useState("all");
  const [dispositionFilter, setDispositionFilter] = React.useState("all");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [form, setForm] = React.useState<ReturnForm>(DEFAULT_FORM);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [loadingViewId, setLoadingViewId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<SupplyChainReturn | null>(null);

  const [inspecting, setInspecting] = React.useState<SupplyChainReturn | null>(null);
  const [inspectLoading, setInspectLoading] = React.useState(false);
  const [disposition, setDisposition] = React.useState("restock");
  const [inspectReturnLocationId, setInspectReturnLocationId] = React.useState("");
  const [inspectionNotes, setInspectionNotes] = React.useState("");
  const [accepted, setAccepted] = React.useState<Record<number, string>>({});
  const [inspectConditions, setInspectConditions] = React.useState<Record<number, string>>({});

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
    pickerOpenRef.current = true;
    setOpenPickerCount((n) => Math.max(0, n - 1));
    pickerCloseTimerRef.current = setTimeout(() => {
      pickerOpenRef.current = false;
      pickerCloseTimerRef.current = null;
    }, 300);
  }, []);

  const blockOutsideDismiss = React.useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault();
  }, []);

  const allowDialogClose = React.useCallback((open: boolean, close: () => void) => {
    if (!open && (pickerOpenRef.current || openPickerCount > 0)) return;
    if (!open) close();
  }, [openPickerCount]);

  const returnsQuery = useQuery({
    queryKey: ["supply-chain", "returns", tableQuery, statusFilter, reasonFilter, dispositionFilter],
    queryFn: () =>
      supplyChainApi
        .listReturns({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          reason: reasonFilter === "all" ? undefined : reasonFilter,
          disposition: dispositionFilter === "all" ? undefined : dispositionFilter,
        })
        .then((r) => r.data),
  });

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "return-picker"],
    queryFn: async () => unwrapList<ProductRecord>(await fetchInventoryProducts({ per_page: 200, limit: 200 })),
    enabled: formOpen,
  });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", "return-picker"],
    queryFn: async () => unwrapList<CrmContact>((await crmApi.listContacts({ limit: 200, per_page: 200 })).data),
  });

  const shipmentsQuery = useQuery({
    queryKey: ["supply-chain", "shipments", "return-picker"],
    queryFn: async () =>
      unwrapList<Shipment>(
        (
          await supplyChainApi.listShipments({
            limit: 100,
            status: undefined,
          })
        ).data?.data ?? [],
      ),
    enabled: formOpen,
  });

  const locationsQuery = useQuery({
    queryKey: ["warehouse", "locations", "return-picker"],
    queryFn: async () => unwrapList<WarehouseLocation>((await warehouseApi.listLocations({ limit: 500 })).data),
    enabled: formOpen || detailOpen || inspecting !== null,
  });

  const contactNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const c of contactsQuery.data ?? []) {
      map.set(c.id, contactLabel(c));
    }
    return map;
  }, [contactsQuery.data]);

  const locationNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const loc of locationsQuery.data ?? []) {
      map.set(loc.id, locationLabel(loc));
    }
    return map;
  }, [locationsQuery.data]);

  const linkableShipments = React.useMemo(
    () =>
      (shipmentsQuery.data ?? []).filter((s) =>
        ["delivered", "partially_delivered", "failed", "in_transit"].includes(s.status),
      ),
    [shipmentsQuery.data],
  );

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const resetForm = React.useCallback(() => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setEditLoading(false);
  }, []);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload(form);
      return editingId
        ? supplyChainApi.updateReturn(editingId, payload)
        : supplyChainApi.createReturn(payload);
    },
    onSuccess: () => {
      toast.success(
        editingId
          ? t("supply_chain.returns.updated", "Return updated.")
          : t("supply_chain.returns.created", "Return logged."),
      );
      invalidate();
      setFormOpen(false);
      resetForm();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message ||
          (editingId
            ? t("supply_chain.returns.update_failed", "Could not update the return.")
            : t("supply_chain.returns.create_failed", "Could not log the return.")),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => supplyChainApi.deleteReturn(id),
    onSuccess: () => {
      toast.success(t("supply_chain.returns.deleted", "Return deleted."));
      invalidate();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.returns.delete_failed", "Could not delete.")),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => supplyChainApi.transitionReturn(id, status),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.common.updated", "Updated."));
      invalidate();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.common.update_failed", "Could not update.")),
  });

  const inspectMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        disposition,
        notes: inspectionNotes || undefined,
        items: (inspecting!.items ?? []).map((item) => ({
          item_id: item.id,
          accepted_quantity: Number(accepted[item.id] ?? item.quantity),
          condition: inspectConditions[item.id] || item.condition || undefined,
        })),
      };

      if (disposition === "restock") {
        const locationId = inspectReturnLocationId || (inspecting?.return_location_id ? String(inspecting.return_location_id) : "");
        if (locationId) {
          payload.return_location_id = Number(locationId);
        }
      }

      return supplyChainApi.inspectReturn(inspecting!.id, payload);
    },
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.returns.inspected", "Return inspected."));
      invalidate();
      setInspecting(null);
      setInspectLoading(false);
      setInspectionNotes("");
      setInspectConditions({});
      setInspectReturnLocationId("");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.returns.inspect_failed", "Could not inspect it.")),
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
        const res = await supplyChainApi.getReturn(id);
        setDetail(res?.data?.data ?? null);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || t("supply_chain.returns.detail_failed", "Could not load return."));
        closeDetail();
      } finally {
        setDetailLoading(false);
        setLoadingViewId(null);
      }
    },
    [closeDetail, t],
  );

  const openEdit = React.useCallback(async (record: SupplyChainReturn) => {
    setEditingId(record.id);
    setFormOpen(true);
    setEditLoading(true);
    try {
      const res = await supplyChainApi.getReturn(record.id);
      const full = (res?.data?.data as SupplyChainReturn | undefined) ?? record;
      setEditingId(full.id);
      setForm(formFromReturn(full));
    } catch {
      setEditingId(record.id);
      setForm(formFromReturn(record));
    } finally {
      setEditLoading(false);
    }
  }, []);

  const openInspect = React.useCallback(async (record: SupplyChainReturn) => {
    setInspecting(record);
    setInspectLoading(true);
    setDisposition(record.disposition ?? "restock");
    setInspectionNotes("");
    setInspectReturnLocationId(record.return_location_id ? String(record.return_location_id) : "");
    setAccepted({});
    setInspectConditions({});
    try {
      const res = await supplyChainApi.getReturn(record.id);
      const full = (res?.data?.data as SupplyChainReturn | undefined) ?? record;
      setInspecting(full);
      setDisposition(full.disposition ?? "restock");
      setInspectReturnLocationId(full.return_location_id ? String(full.return_location_id) : "");
      setAccepted(Object.fromEntries((full.items ?? []).map((i) => [i.id, String(i.quantity)])));
      setInspectConditions(
        Object.fromEntries((full.items ?? []).map((i) => [i.id, i.condition ?? "good"])),
      );
    } catch {
      setAccepted(Object.fromEntries((record.items ?? []).map((i) => [i.id, String(i.quantity)])));
      setInspectConditions(
        Object.fromEntries((record.items ?? []).map((i) => [i.id, i.condition ?? "good"])),
      );
    } finally {
      setInspectLoading(false);
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
      items: f.items.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  };

  const columns = React.useMemo<ColumnDef<SupplyChainReturn>[]>(
    () => [
      {
        accessorKey: "return_number",
        header: t("supply_chain.returns.col_return", "Return"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.return_number}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.shipment?.shipment_number ?? t("supply_chain.returns.no_shipment", "No linked shipment")}
            </p>
            {row.original.customer_contact_id ? (
              <p className="text-[11px] text-muted-foreground">
                {contactNameById.get(row.original.customer_contact_id) ??
                  `${t("supply_chain.shipments.customer", "Customer")} #${row.original.customer_contact_id}`}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "reason",
        header: t("supply_chain.returns.reason", "Reason"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] font-semibold">
            {row.original.reason.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("supply_chain.common.status", "Status"),
        cell: ({ row }) => <ReturnStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "disposition",
        header: t("supply_chain.returns.disposition", "Disposition"),
        cell: ({ row }) => <span className="text-xs capitalize">{row.original.disposition ?? "—"}</span>,
      },
      {
        id: "quantities",
        header: t("supply_chain.returns.col_returned_accepted", "Returned / Accepted"),
        cell: ({ row }) => {
          const { returned, accepted, acceptRate } = returnUnitTotals(row.original);
          return (
            <div className="space-y-0.5 tabular-nums">
              <p className="text-sm">
                {returned.toLocaleString()} → {accepted.toLocaleString()}
              </p>
              {row.original.status === "inspected" || accepted > 0 ? (
                <p className="text-[11px] text-muted-foreground">{acceptRate.toFixed(1)}% accepted</p>
              ) : row.original.status === "received" ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {t("supply_chain.returns.use_inspect", "Use Inspect")}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "credit_amount",
        header: t("supply_chain.returns.credit", "Credit"),
        cell: ({ row }) => {
          const credit = Number(row.original.credit_amount);
          const showHint = credit === 0 && !row.original.disposition;

          return (
            <div className="space-y-0.5">
              <span className="tabular-nums">{credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              {showHint ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("supply_chain.returns.credit_after_inspect", "After inspect (refund/replace)")}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => {
          const record = row.original;
          const next = NEXT[record.status] ?? [];
          const canInspect = record.status === "received";
          const canEdit = EDITABLE.has(record.status);
          const isTransitioning =
            transitionMutation.isPending && transitionMutation.variables?.id === record.id;
          const isViewLoading = loadingViewId === record.id;
          const isEditLoading = editLoading && editingId === record.id;
          const isInspectOpening = inspectLoading && inspecting?.id === record.id;

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isViewLoading || isEditLoading}
                onClick={() => openDetail(record.id)}
                aria-label={t("supply_chain.common.view", "View")}
              >
                {isViewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={isEditLoading || isViewLoading}
                  onClick={() => openEdit(record)}
                  aria-label={t("supply_chain.common.edit", "Edit")}
                >
                  {isEditLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(t("supply_chain.returns.delete_confirm", "Delete this draft return?"))) {
                      deleteMutation.mutate(record.id);
                    }
                  }}
                  aria-label={t("supply_chain.common.delete", "Delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {next.length > 0 ? (
                <Select
                  value=""
                  disabled={isTransitioning}
                  onValueChange={(status) => transitionMutation.mutate({ id: record.id, status })}
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
              {canInspect ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={isInspectOpening}
                  onClick={() => openInspect(record)}
                >
                  {isInspectOpening ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ClipboardCheck className="h-3 w-3" />
                  )}
                  {t("supply_chain.returns.inspect", "Inspect")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      contactNameById,
      deleteMutation,
      editLoading,
      editingId,
      inspectLoading,
      inspecting?.id,
      loadingViewId,
      openDetail,
      openEdit,
      openInspect,
      t,
      transitionMutation.isPending,
      transitionMutation.variables,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("supply_chain.returns.title", "Customer Returns")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.returns.subtitle",
              "Only a restock disposition puts goods back, and it books them into quarantine rather than straight into saleable stock.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("supply_chain.returns.add", "Log Return")}
        </Button>
      </div>

      {returnsQuery.isPending ? (
        <SupplyChainListSkeleton filters={3} cols={7} />
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
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.returns.reason", "Reason")}</Label>
              <Select
                value={reasonFilter}
                onValueChange={(v) => {
                  setReasonFilter(v);
                  setTableQuery((p) => ({ ...p, page: 1 }));
                }}
              >
                <SelectTrigger className="h-9 w-[12rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.returns.disposition", "Disposition")}</Label>
              <Select
                value={dispositionFilter}
                onValueChange={(v) => {
                  setDispositionFilter(v);
                  setTableQuery((p) => ({ ...p, page: 1 }));
                }}
              >
                <SelectTrigger className="h-9 w-[12rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  {DISPOSITIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={(returnsQuery.data?.data ?? []) as SupplyChainReturn[]}
            totalEntries={returnsQuery.data?.meta?.total ?? 0}
            loading={returnsQuery.isFetching && !returnsQuery.isPending}
            pageIndex={tableQuery.page}
            pageSize={tableQuery.pageSize}
            onQueryChange={handleTableQueryChange}
            searchPlaceholder={t(
              "supply_chain.returns.search",
              "Search by number, shipment, product…",
            )}
            resourceName="customer-returns"
          />
        </>
      )}

      {/* Create / edit */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          allowDialogClose(open, () => {
            setFormOpen(false);
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
                  ? t("supply_chain.returns.edit", "Edit Return")
                  : t("supply_chain.returns.new", "Log a Return")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.returns.new_desc",
                  "Set a return location if the goods may be restocked after inspection.",
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
                    <Label>{t("supply_chain.returns.reason", "Reason")}</Label>
                    <Select
                      value={form.reason}
                      onOpenChange={handlePickerOpenChange}
                      onValueChange={(v) => setForm((f) => ({ ...f, reason: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REASONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("supply_chain.shipments.customer", "Customer contact")}</Label>
                    <Select
                      value={form.customer_contact_id || "none"}
                      onOpenChange={handlePickerOpenChange}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, customer_contact_id: v === "none" ? "" : v }))
                      }
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
                    <Label>{t("supply_chain.returns.shipment", "Original shipment")}</Label>
                    <Select
                      value={form.shipment_id || "none"}
                      onOpenChange={handlePickerOpenChange}
                      onValueChange={(v) => setForm((f) => ({ ...f, shipment_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("supply_chain.common.none", "None")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                        {linkableShipments.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.shipment_number}
                            {s.destination_name ? ` — ${s.destination_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("supply_chain.returns.location", "Return location")}</Label>
                    <Select
                      value={form.return_location_id || "none"}
                      onOpenChange={handlePickerOpenChange}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, return_location_id: v === "none" ? "" : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("supply_chain.common.none", "None")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                        {(locationsQuery.data ?? []).map((loc) => (
                          <SelectItem key={loc.id} value={String(loc.id)}>
                            {locationLabel(loc)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {t(
                        "supply_chain.returns.location_hint",
                        "Required if you may restock after inspection (usually quarantine).",
                      )}
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="rt-notes">{t("supply_chain.common.notes", "Notes")}</Label>
                    <Textarea
                      id="rt-notes"
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">{t("supply_chain.returns.lines", "Returned goods")}</p>
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
                    <div
                      key={index}
                      className="grid gap-2 rounded-xl border border-border/40 bg-background p-3 md:grid-cols-12"
                    >
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
                        <Label className="text-[11px]">{t("supply_chain.common.quantity", "Qty")}</Label>
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
                        <Label className="text-[11px]">{t("supply_chain.common.batch", "Batch")}</Label>
                        <Input
                          className="h-9"
                          value={line.batch_number}
                          onChange={(e) => updateLine(index, { batch_number: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-[11px]">{t("supply_chain.returns.condition", "Condition")}</Label>
                        <Select
                          value={line.condition || "none"}
                          onOpenChange={handlePickerOpenChange}
                          onValueChange={(v) => updateLine(index, { condition: v === "none" ? "" : v })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t("supply_chain.common.none", "None")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                            {CONDITIONS.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  toast.error(t("supply_chain.returns.line_required", "Add at least one returned line."));
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
                {detail?.return_number ?? t("supply_chain.returns.detail", "Return")}
              </DialogTitle>
              <DialogDescription>
                {detailLoading
                  ? t("supply_chain.common.loading", "Loading…")
                  : detail?.reason.replace(/_/g, " ") ?? ""}
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
                  <ReturnStatusBadge status={detail.status} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.returns.disposition", "Disposition")}
                  </p>
                  <p className="capitalize">{detail.disposition ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.shipments.customer", "Customer")}
                  </p>
                  <p>
                    {detail.customer_contact_id
                      ? contactNameById.get(detail.customer_contact_id) ?? `#${detail.customer_contact_id}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.returns.shipment", "Shipment")}
                  </p>
                  <p>{detail.shipment?.shipment_number ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.returns.location", "Return location")}
                  </p>
                  <p>
                    {detail.return_location_id
                      ? locationNameById.get(detail.return_location_id) ?? `#${detail.return_location_id}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.returns.credit", "Credit")}
                  </p>
                  <p className="tabular-nums">
                    {Number(detail.credit_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              {detail.notes ? <p className="text-muted-foreground">{detail.notes}</p> : null}
              {detail.inspection_notes ? (
                <p className="text-muted-foreground">
                  <span className="font-semibold">{t("supply_chain.returns.notes", "Inspection notes")}: </span>
                  {detail.inspection_notes}
                </p>
              ) : null}
              <div className="space-y-2">
                <p className="text-sm font-bold">{t("supply_chain.returns.lines", "Returned goods")}</p>
                {(detail.items ?? []).map((item: ReturnItem) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border/40 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold">{item.product?.name ?? `#${item.product_id}`}</p>
                      <p className="text-muted-foreground">
                        {item.batch_number ? `${item.batch_number} · ` : ""}
                        {item.condition ?? "—"} · {item.uom}
                      </p>
                    </div>
                    <p className="tabular-nums font-bold">
                      {Number(item.accepted_quantity).toLocaleString()} / {Number(item.quantity).toLocaleString()}
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
                  const r = detail;
                  closeDetail();
                  openEdit(r);
                }}
              >
                {editLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("supply_chain.common.edit", "Edit")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect */}
      <Dialog
        open={inspecting !== null}
        onOpenChange={(open) => {
          allowDialogClose(open, () => {
            setInspecting(null);
            setInspectLoading(false);
            setInspectionNotes("");
            setInspectConditions({});
            setInspectReturnLocationId("");
          });
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
                {t("supply_chain.returns.inspect_title", "Inspect Return")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.returns.inspect_desc",
                  "Restock books the accepted quantity into the return location. Scrap and quarantine never touch saleable stock.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {inspectLoading ? (
              <SupplyChainDialogSkeleton rows={2} />
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("supply_chain.returns.disposition", "Disposition")}</Label>
                  <Select
                    value={disposition}
                    onOpenChange={handlePickerOpenChange}
                    onValueChange={setDisposition}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPOSITIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {disposition === "restock" ? (
                    <div className="space-y-2 pt-1">
                      <Label>{t("supply_chain.returns.location", "Return location")}</Label>
                      <Select
                        value={inspectReturnLocationId || "none"}
                        onOpenChange={handlePickerOpenChange}
                        onValueChange={(v) => setInspectReturnLocationId(v === "none" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("supply_chain.returns.pick_location", "Select quarantine / hold location")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                          {(locationsQuery.data ?? []).map((loc) => (
                            <SelectItem key={loc.id} value={String(loc.id)}>
                              {locationLabel(loc)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        {t(
                          "supply_chain.returns.restock_location_hint",
                          "Accepted units are booked into this location (usually quarantine, not saleable stock).",
                        )}
                      </p>
                    </div>
                  ) : null}
                </div>

                {(inspecting?.items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="grid items-end gap-3 rounded-xl border border-border/40 p-3 md:grid-cols-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{item.product?.name ?? `#${item.product_id}`}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("supply_chain.returns.returned", "Returned")} {Number(item.quantity).toLocaleString()}{" "}
                        {item.uom}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`accept-${item.id}`} className="text-xs">
                        {t("supply_chain.returns.accepted", "Accepted quantity")}
                      </Label>
                      <Input
                        id={`accept-${item.id}`}
                        type="number"
                        className="h-9"
                        max={Number(item.quantity)}
                        value={accepted[item.id] ?? ""}
                        onChange={(e) => setAccepted((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("supply_chain.returns.condition", "Condition")}</Label>
                      <Select
                        value={inspectConditions[item.id] || "good"}
                        onOpenChange={handlePickerOpenChange}
                        onValueChange={(v) =>
                          setInspectConditions((prev) => ({ ...prev, [item.id]: v }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <Label htmlFor="inspect-notes">{t("supply_chain.returns.notes", "Inspection notes")}</Label>
                  <Textarea
                    id="inspect-notes"
                    rows={2}
                    value={inspectionNotes}
                    onChange={(e) => setInspectionNotes(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setInspecting(null);
                setInspectLoading(false);
                setInspectionNotes("");
                setInspectConditions({});
                setInspectReturnLocationId("");
              }}
            >
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={inspectMutation.isPending || inspectLoading}
              onClick={() => {
                if (disposition === "restock" && !inspectReturnLocationId && !inspecting?.return_location_id) {
                  toast.error(
                    t(
                      "supply_chain.returns.restock_needs_location",
                      "Pick a return location to restock into.",
                    ),
                  );
                  return;
                }
                inspectMutation.mutate();
              }}
            >
              {inspectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.returns.confirm_inspection", "Confirm Inspection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
