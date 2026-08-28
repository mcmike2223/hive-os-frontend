"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Eye, Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
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
import type { LandedCost } from "@/modules/supplychain/types";
import {
  SupplyChainDialogSkeleton,
  SupplyChainListSkeleton,
} from "@/modules/supplychain/pages/components/supply-chain-skeletons";
import { fetchInventoryProducts, fetchInventorySuppliers } from "@/modules/inventory/api";
import type { ProductRecord, Supplier } from "@/modules/inventory/types";
import { procurementApi } from "@/modules/procurement/api";
import type { PurchaseOrder } from "@/modules/procurement/types";

const OVERHEADS = [
  ["freight_cost", "Freight"],
  ["insurance_cost", "Insurance"],
  ["customs_duty", "Customs duty"],
  ["excise_tax", "Excise"],
  ["port_handling_cost", "Port handling"],
  ["inland_transport_cost", "Inland transport"],
  ["bank_charges", "Bank / LC charges"],
  ["other_costs", "Other"],
] as const;

const STATUSES = ["draft", "allocated", "posted"] as const;
const EDITABLE = new Set(["draft", "allocated"]);
const CAN_ALLOCATE = new Set(["draft", "allocated"]);
const CAN_POST = new Set(["allocated"]);
const CAN_DELETE = new Set(["draft", "allocated"]);

type LineDraft = {
  product_id: string;
  quantity: string;
  unit_price_foreign: string;
  weight_kg: string;
};

const EMPTY_LINE: LineDraft = { product_id: "", quantity: "", unit_price_foreign: "", weight_kg: "" };

type OverheadKey = (typeof OVERHEADS)[number][0];

type CostForm = Record<OverheadKey, string> & {
  reference: string;
  currency: string;
  exchange_rate: string;
  allocation_basis: string;
  purchase_order_id: string;
  supplier_id: string;
  declaration_number: string;
  cleared_on: string;
  notes: string;
  items: LineDraft[];
};

const DEFAULT_FORM: CostForm = {
  reference: "",
  currency: "USD",
  exchange_rate: "",
  allocation_basis: "value",
  purchase_order_id: "",
  supplier_id: "",
  declaration_number: "",
  cleared_on: "",
  notes: "",
  freight_cost: "0",
  insurance_cost: "0",
  customs_duty: "0",
  excise_tax: "0",
  port_handling_cost: "0",
  inland_transport_cost: "0",
  bank_charges: "0",
  other_costs: "0",
  items: [{ ...EMPTY_LINE }],
};

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function formFromCost(cost: LandedCost): CostForm {
  return {
    reference: cost.reference,
    currency: cost.currency,
    exchange_rate: String(cost.exchange_rate),
    allocation_basis: cost.allocation_basis,
    purchase_order_id: cost.purchase_order_id ? String(cost.purchase_order_id) : "",
    supplier_id: cost.supplier_id ? String(cost.supplier_id) : "",
    declaration_number: cost.declaration_number ?? "",
    cleared_on: cost.cleared_on ? String(cost.cleared_on).slice(0, 10) : "",
    notes: cost.notes ?? "",
    freight_cost: String(cost.freight_cost ?? 0),
    insurance_cost: String(cost.insurance_cost ?? 0),
    customs_duty: String(cost.customs_duty ?? 0),
    excise_tax: String(cost.excise_tax ?? 0),
    port_handling_cost: String(cost.port_handling_cost ?? 0),
    inland_transport_cost: String(cost.inland_transport_cost ?? 0),
    bank_charges: String(cost.bank_charges ?? 0),
    other_costs: String(cost.other_costs ?? 0),
    items:
      (cost.lines ?? []).length > 0
        ? (cost.lines ?? []).map((line) => ({
            product_id: String(line.product_id),
            quantity: String(line.quantity),
            unit_price_foreign: String(line.unit_price_foreign),
            weight_kg: line.weight_kg != null ? String(line.weight_kg) : "",
          }))
        : [{ ...EMPTY_LINE }],
  };
}

function buildPayload(form: CostForm) {
  return {
    reference: form.reference.trim(),
    currency: form.currency.trim().toUpperCase(),
    exchange_rate: Number(form.exchange_rate || 1),
    allocation_basis: form.allocation_basis,
    purchase_order_id: form.purchase_order_id ? Number(form.purchase_order_id) : null,
    supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
    declaration_number: form.declaration_number || null,
    cleared_on: form.cleared_on || null,
    notes: form.notes || null,
    ...Object.fromEntries(OVERHEADS.map(([key]) => [key, Number(form[key] || 0)])),
    lines: form.items
      .filter((l) => l.product_id && l.quantity)
      .map((l) => ({
        product_id: Number(l.product_id),
        quantity: Number(l.quantity),
        unit_price_foreign: Number(l.unit_price_foreign || 0),
        weight_kg: l.weight_kg ? Number(l.weight_kg) : null,
      })),
  };
}

function statusBadgeClass(status: string) {
  if (status === "allocated") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (status === "posted") return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  return "bg-muted text-muted-foreground";
}

export default function LandedCostPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [currencyFilter, setCurrencyFilter] = React.useState("all");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [form, setForm] = React.useState<CostForm>(DEFAULT_FORM);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [loadingViewId, setLoadingViewId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<LandedCost | null>(null);

  const [allocatingId, setAllocatingId] = React.useState<number | null>(null);
  const [postingId, setPostingId] = React.useState<number | null>(null);

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

  const costsQuery = useQuery({
    queryKey: ["supply-chain", "landed-costs", tableQuery, statusFilter, currencyFilter],
    queryFn: () =>
      supplyChainApi
        .listLandedCosts({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          currency: currencyFilter === "all" ? undefined : currencyFilter,
        })
        .then((r) => r.data),
  });

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "landed-cost-picker"],
    queryFn: async () => unwrapList<ProductRecord>(await fetchInventoryProducts({ per_page: 200, limit: 200 })),
    enabled: formOpen,
  });

  const suppliersQuery = useQuery({
    queryKey: ["inventory", "suppliers", "landed-cost-picker"],
    queryFn: async () => unwrapList<Supplier>(await fetchInventorySuppliers({ per_page: 200, limit: 200 })),
  });

  const purchaseOrdersQuery = useQuery({
    queryKey: ["procurement", "purchase-orders", "landed-cost-picker"],
    queryFn: async () => {
      const res = await procurementApi.purchaseOrders({ per_page: 100, limit: 100 });
      return res.data ?? [];
    },
  });

  const supplierNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const s of suppliersQuery.data ?? []) {
      map.set(s.id, s.code ? `${s.name} (${s.code})` : s.name);
    }
    return map;
  }, [suppliersQuery.data]);

  const poLabelById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const po of purchaseOrdersQuery.data ?? []) {
      map.set(po.id, po.number);
    }
    return map;
  }, [purchaseOrdersQuery.data]);

  const weightBasisWarning = React.useMemo(() => {
    if (form.allocation_basis !== "weight") return false;
    return form.items.some((l) => l.product_id && l.quantity && !l.weight_kg);
  }, [form.allocation_basis, form.items]);

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
        ? supplyChainApi.updateLandedCost(editingId, payload)
        : supplyChainApi.createLandedCost(payload);
    },
    onSuccess: (response) => {
      toast.success(
        response?.data?.message ||
          (editingId
            ? t("supply_chain.landed.updated", "Consignment updated.")
            : t("supply_chain.landed.created", "Consignment created.")),
      );
      invalidate();
      setFormOpen(false);
      resetForm();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message ||
          (editingId
            ? t("supply_chain.landed.update_failed", "Could not update the consignment.")
            : t("supply_chain.landed.create_failed", "Could not create it.")),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => supplyChainApi.deleteLandedCost(id),
    onSuccess: () => {
      toast.success(t("supply_chain.landed.deleted", "Consignment deleted."));
      invalidate();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.landed.delete_failed", "Could not delete.")),
  });

  const allocateMutation = useMutation({
    mutationFn: (id: number) => supplyChainApi.allocateLandedCost(id),
    onSuccess: (response, id) => {
      toast.success(response?.data?.message || t("supply_chain.landed.allocated", "Landed cost allocated."));
      if (detail?.id === id) {
        setDetail((response?.data?.data as LandedCost) ?? detail);
      }
      invalidate();
      setAllocatingId(null);
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || t("supply_chain.landed.allocate_failed", "Could not allocate."));
      setAllocatingId(null);
    },
  });

  const postMutation = useMutation({
    mutationFn: (id: number) => supplyChainApi.postLandedCost(id),
    onSuccess: (response, id) => {
      toast.success(response?.data?.message || t("supply_chain.landed.posted", "Landed cost posted."));
      if (detail?.id === id) {
        setDetail((response?.data?.data as LandedCost) ?? detail);
      }
      invalidate();
      setPostingId(null);
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || t("supply_chain.landed.post_failed", "Could not post."));
      setPostingId(null);
    },
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
        const res = await supplyChainApi.getLandedCost(id);
        setDetail(res?.data?.data ?? null);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || t("supply_chain.landed.detail_failed", "Could not load consignment."));
        closeDetail();
      } finally {
        setDetailLoading(false);
        setLoadingViewId(null);
      }
    },
    [closeDetail, t],
  );

  const openEdit = React.useCallback(async (cost: LandedCost) => {
    setEditingId(cost.id);
    setFormOpen(true);
    setEditLoading(true);
    try {
      const res = await supplyChainApi.getLandedCost(cost.id);
      const full = (res?.data?.data as LandedCost | undefined) ?? cost;
      setEditingId(full.id);
      setForm(formFromCost(full));
    } catch {
      setEditingId(cost.id);
      setForm(formFromCost(cost));
    } finally {
      setEditLoading(false);
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

  const columns = React.useMemo<ColumnDef<LandedCost>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("supply_chain.landed.col_reference", "Consignment"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.reference}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.declaration_number ?? "—"}</p>
            {row.original.purchase_order_id ? (
              <p className="text-[11px] text-muted-foreground">
                PO {poLabelById.get(row.original.purchase_order_id) ?? `#${row.original.purchase_order_id}`}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "parties",
        header: t("supply_chain.landed.supplier", "Supplier"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.supplier_id
              ? supplierNameById.get(row.original.supplier_id) ?? `#${row.original.supplier_id}`
              : "—"}
          </span>
        ),
      },
      {
        id: "fx",
        header: t("supply_chain.landed.fx", "Currency / rate"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.currency} @ {Number(row.original.exchange_rate).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "goods_value_base",
        header: t("supply_chain.landed.goods", "Goods (base)"),
        cell: ({ row }) => {
          const base = Number(row.original.goods_value_base);
          const foreign = Number(row.original.goods_value);
          return (
            <div className="space-y-0.5 tabular-nums text-xs">
              <p>{base > 0 ? base.toLocaleString() : "—"}</p>
              {foreign > 0 ? (
                <p className="text-muted-foreground">
                  {foreign.toLocaleString()} {row.original.currency}
                </p>
              ) : row.original.status === "draft" ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("supply_chain.landed.allocate_first", "Allocate to compute")}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "overhead_total",
        header: t("supply_chain.landed.overheads", "Overheads"),
        cell: ({ row }) => {
          const goodsBase = Number(row.original.goods_value_base);
          const pct = goodsBase > 0 ? row.original.overhead_percent : 0;
          return (
            <div className="space-y-0.5">
              <p className="tabular-nums">{row.original.overhead_total.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">
                {goodsBase > 0
                  ? `+${pct.toFixed(1)}%`
                  : t("supply_chain.landed.pct_after_allocate", "% after allocate")}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "total_landed_cost",
        header: t("supply_chain.landed.total", "Landed total"),
        cell: ({ row }) => (
          <span className="font-bold tabular-nums">
            {Number(row.original.total_landed_cost) > 0
              ? Number(row.original.total_landed_cost).toLocaleString()
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("supply_chain.common.status", "Status"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`border-transparent text-[11px] font-black uppercase tracking-widest ${statusBadgeClass(row.original.status)}`}
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => {
          const cost = row.original;
          const isViewLoading = loadingViewId === cost.id;
          const isEditLoading = editLoading && editingId === cost.id;
          const isAllocating = allocatingId === cost.id && allocateMutation.isPending;
          const isPosting = postingId === cost.id && postMutation.isPending;

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isViewLoading || isEditLoading}
                onClick={() => openDetail(cost.id)}
                aria-label={t("supply_chain.common.view", "View")}
              >
                {isViewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              {EDITABLE.has(cost.status) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={isEditLoading || isViewLoading}
                  onClick={() => openEdit(cost)}
                  aria-label={t("supply_chain.common.edit", "Edit")}
                >
                  {isEditLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : null}
              {CAN_DELETE.has(cost.status) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(t("supply_chain.landed.delete_confirm", "Delete this consignment?"))) {
                      deleteMutation.mutate(cost.id);
                    }
                  }}
                  aria-label={t("supply_chain.common.delete", "Delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {CAN_ALLOCATE.has(cost.status) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={isAllocating}
                  onClick={() => {
                    setAllocatingId(cost.id);
                    allocateMutation.mutate(cost.id);
                  }}
                >
                  {isAllocating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Calculator className="h-3 w-3" />
                  )}
                  {cost.status === "allocated"
                    ? t("supply_chain.landed.reallocate", "Re-allocate")
                    : t("supply_chain.landed.allocate", "Allocate")}
                </Button>
              ) : null}
              {CAN_POST.has(cost.status) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={isPosting}
                  onClick={() => {
                    setPostingId(cost.id);
                    postMutation.mutate(cost.id);
                  }}
                >
                  {isPosting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                  {t("supply_chain.landed.post", "Post")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      allocateMutation.isPending,
      allocatingId,
      deleteMutation.isPending,
      editLoading,
      editingId,
      loadingViewId,
      openDetail,
      openEdit,
      poLabelById,
      postMutation.isPending,
      postingId,
      supplierNameById,
      t,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("supply_chain.landed.title", "Landed Cost")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.landed.subtitle",
              "What an imported consignment truly cost once freight, duty, port charges and bank fees are spread across the lines at the settlement rate.",
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
          {t("supply_chain.landed.add", "New Consignment")}
        </Button>
      </div>

      {costsQuery.isPending ? (
        <SupplyChainListSkeleton filters={2} cols={8} />
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
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.landed.currency", "Currency")}</Label>
              <Select
                value={currencyFilter}
                onValueChange={(v) => {
                  setCurrencyFilter(v);
                  setTableQuery((p) => ({ ...p, page: 1 }));
                }}
              >
                <SelectTrigger className="h-9 w-[10rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  {["USD", "EUR", "GBP", "ETB"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={(costsQuery.data?.data ?? []) as LandedCost[]}
            totalEntries={costsQuery.data?.meta?.total ?? 0}
            loading={costsQuery.isFetching && !costsQuery.isPending}
            pageIndex={tableQuery.page}
            pageSize={tableQuery.pageSize}
            onQueryChange={handleTableQueryChange}
            searchPlaceholder={t("supply_chain.landed.search", "Search by reference, PO, product…")}
            resourceName="landed-costs"
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
                  ? t("supply_chain.landed.edit", "Edit Consignment")
                  : t("supply_chain.landed.new", "New Import Consignment")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.landed.new_desc",
                  "Use the rate the bank actually settled at, not the invoice-day rate — that difference is real money on an LC.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            {editLoading ? (
              <SupplyChainDialogSkeleton rows={4} />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="lc-ref">{t("supply_chain.landed.reference", "Reference")}</Label>
                    <Input
                      id="lc-ref"
                      value={form.reference}
                      onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                      placeholder="LC-2026-014"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lc-currency">{t("supply_chain.landed.currency", "Currency")}</Label>
                    <Input
                      id="lc-currency"
                      maxLength={3}
                      value={form.currency}
                      onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lc-rate">{t("supply_chain.landed.rate", "Settlement rate")}</Label>
                    <Input
                      id="lc-rate"
                      type="number"
                      step="0.0001"
                      value={form.exchange_rate}
                      onChange={(e) => setForm((f) => ({ ...f, exchange_rate: e.target.value }))}
                      placeholder="57.0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("supply_chain.landed.basis", "Allocation basis")}</Label>
                    <Select
                      value={form.allocation_basis}
                      onOpenChange={handlePickerOpenChange}
                      onValueChange={(v) => setForm((f) => ({ ...f, allocation_basis: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["value", "quantity", "weight"].map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {weightBasisWarning ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {t(
                          "supply_chain.landed.weight_required",
                          "Weight basis needs weight (kg) on every line.",
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>{t("supply_chain.landed.po", "Purchase order")}</Label>
                    <Select
                      value={form.purchase_order_id || "none"}
                      onOpenChange={handlePickerOpenChange}
                      onValueChange={(v) => setForm((f) => ({ ...f, purchase_order_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("supply_chain.common.none", "None")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                        {(purchaseOrdersQuery.data ?? []).map((po: PurchaseOrder) => (
                          <SelectItem key={po.id} value={String(po.id)}>
                            {po.number}
                            {po.supplier?.name ? ` — ${po.supplier.name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("supply_chain.landed.supplier", "Supplier")}</Label>
                    <Select
                      value={form.supplier_id || "none"}
                      onOpenChange={handlePickerOpenChange}
                      onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("supply_chain.common.none", "None")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                        {(suppliersQuery.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                            {s.code ? ` (${s.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lc-decl">{t("supply_chain.landed.declaration", "Declaration number")}</Label>
                    <Input
                      id="lc-decl"
                      value={form.declaration_number}
                      onChange={(e) => setForm((f) => ({ ...f, declaration_number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lc-cleared">{t("supply_chain.landed.cleared_on", "Cleared on")}</Label>
                    <Input
                      id="lc-cleared"
                      type="date"
                      value={form.cleared_on}
                      onChange={(e) => setForm((f) => ({ ...f, cleared_on: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="lc-notes">{t("supply_chain.common.notes", "Notes")}</Label>
                    <Textarea
                      id="lc-notes"
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 md:grid-cols-4">
                  {OVERHEADS.map(([key, label]) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`lc-${key}`} className="text-xs">
                        {label} ({t("supply_chain.landed.base_currency", "base")})
                      </Label>
                      <Input
                        id={`lc-${key}`}
                        type="number"
                        className="h-9"
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">{t("supply_chain.landed.lines", "Consignment lines")}</p>
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
                        <Label className="text-[11px]">{t("supply_chain.common.quantity", "Quantity")}</Label>
                        <Input
                          type="number"
                          className="h-9"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-[11px]">{t("supply_chain.landed.unit_price_foreign", "Unit price (FX)")}</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          className="h-9"
                          value={line.unit_price_foreign}
                          onChange={(e) => updateLine(index, { unit_price_foreign: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-[11px]">{t("supply_chain.landed.weight", "Weight (kg)")}</Label>
                        <Input
                          type="number"
                          className="h-9"
                          value={line.weight_kg}
                          onChange={(e) => updateLine(index, { weight_kg: e.target.value })}
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
                resetForm();
              }}
            >
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={saveMutation.isPending || editLoading}
              onClick={() => {
                if (!form.reference.trim() || !form.exchange_rate) {
                  toast.error(t("supply_chain.landed.required", "Reference and settlement rate are required."));
                  return;
                }
                if (!form.items.some((l) => l.product_id && l.quantity && l.unit_price_foreign)) {
                  toast.error(
                    t("supply_chain.landed.line_required", "Add at least one line with product, quantity and unit price."),
                  );
                  return;
                }
                if (weightBasisWarning) {
                  toast.error(
                    t("supply_chain.landed.weight_required", "Weight basis needs weight (kg) on every line."),
                  );
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
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.reference ?? t("supply_chain.landed.detail", "Consignment")}
              </DialogTitle>
              <DialogDescription>
                {detailLoading
                  ? t("supply_chain.common.loading", "Loading…")
                  : detail
                    ? `${detail.currency} @ ${Number(detail.exchange_rate).toLocaleString()} · ${detail.allocation_basis} basis`
                    : ""}
              </DialogDescription>
            </DialogHeader>
          </div>
          {detailLoading ? (
            <SupplyChainDialogSkeleton rows={4} />
          ) : detail ? (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.common.status", "Status")}
                  </p>
                  <Badge variant="outline" className={`mt-1 border-transparent ${statusBadgeClass(detail.status)}`}>
                    {detail.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.landed.supplier", "Supplier")}
                  </p>
                  <p>
                    {detail.supplier_id
                      ? supplierNameById.get(detail.supplier_id) ?? `#${detail.supplier_id}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.landed.po", "Purchase order")}
                  </p>
                  <p>
                    {detail.purchase_order_id
                      ? poLabelById.get(detail.purchase_order_id) ?? `#${detail.purchase_order_id}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.landed.goods", "Goods (base)")}
                  </p>
                  <p className="tabular-nums">{Number(detail.goods_value_base).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.landed.overheads", "Overheads")}
                  </p>
                  <p className="tabular-nums">
                    {detail.overhead_total.toLocaleString()}
                    {Number(detail.goods_value_base) > 0 ? ` (+${detail.overhead_percent.toFixed(1)}%)` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.landed.total", "Landed total")}
                  </p>
                  <p className="font-bold tabular-nums">{Number(detail.total_landed_cost).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.landed.cleared_on", "Cleared on")}
                  </p>
                  <p>{detail.cleared_on ? new Date(detail.cleared_on).toLocaleDateString() : "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.landed.declaration", "Declaration")}
                  </p>
                  <p>{detail.declaration_number ?? "—"}</p>
                </div>
              </div>
              {detail.notes ? <p className="text-muted-foreground">{detail.notes}</p> : null}
              {detail.status === "allocated" ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {t(
                    "supply_chain.landed.edit_reallocate_hint",
                    "If you edit this consignment it returns to draft — run Allocate again.",
                  )}
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">{t("supply_chain.common.product", "Product")}</th>
                      <th className="py-2 pr-3 text-right font-semibold">{t("supply_chain.common.quantity", "Qty")}</th>
                      <th className="py-2 pr-3 text-right font-semibold">
                        {t("supply_chain.landed.invoice_value", "Invoice (base)")}
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold">
                        {t("supply_chain.landed.overheads", "Overheads")}
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold">{t("supply_chain.landed.uplift", "Uplift")}</th>
                      <th className="py-2 text-right font-semibold">
                        {t("supply_chain.landed.unit_cost", "Landed unit cost")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.lines ?? []).map((line) => (
                      <tr key={line.id} className="border-b border-border/30">
                        <td className="py-2 pr-3 font-medium">{line.product?.name ?? `#${line.product_id}`}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Number(line.quantity).toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {Number(line.line_value_base).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {Number(line.allocated_overhead).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                          +{line.uplift_percent.toFixed(1)}%
                        </td>
                        <td className="py-2 text-right font-bold tabular-nums">
                          {Number(line.landed_unit_cost).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  const c = detail;
                  closeDetail();
                  openEdit(c);
                }}
              >
                {editLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("supply_chain.common.edit", "Edit")}
              </Button>
            ) : null}
            {detail && CAN_ALLOCATE.has(detail.status) ? (
              <Button
                className="rounded-full"
                disabled={allocateMutation.isPending}
                onClick={() => {
                  setAllocatingId(detail.id);
                  allocateMutation.mutate(detail.id);
                }}
              >
                {allocateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {detail.status === "allocated"
                  ? t("supply_chain.landed.reallocate", "Re-allocate")
                  : t("supply_chain.landed.allocate", "Allocate")}
              </Button>
            ) : null}
            {detail && CAN_POST.has(detail.status) ? (
              <Button
                className="rounded-full"
                disabled={postMutation.isPending}
                onClick={() => {
                  setPostingId(detail.id);
                  postMutation.mutate(detail.id);
                }}
              >
                {postMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("supply_chain.landed.post", "Post")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
