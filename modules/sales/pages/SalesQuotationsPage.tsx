"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { PanelTableSkeleton } from "@/components/ui/loading-states";
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
import { fetchInventoryProducts } from "@/modules/inventory/api";
import type { ProductRecord } from "@/modules/inventory/types";
import { salesApi } from "@/modules/sales/api";
import { SalesLinePriceHint } from "@/modules/sales/components/sales-line-price-hint";
import type { QuotationStatus, SalesCustomer, SalesQuotation } from "@/modules/sales/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { SupplyChainDialogSkeleton } from "@/modules/supplychain/pages/components/supply-chain-skeletons";
import { warehouseApi } from "@/modules/warehouse/api";
import type { Warehouse } from "@/modules/warehouse/types";

const QUOTATION_STATUSES: QuotationStatus[] = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "converted",
  "cancelled",
];

/** Mirrors SalesQuotation::TRANSITIONS on the server. */
const TRANSITIONS: Record<string, QuotationStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "declined", "expired", "draft", "cancelled"],
  accepted: ["converted", "cancelled"],
  declined: ["draft"],
  expired: ["draft"],
  converted: [],
  cancelled: [],
};

const EDITABLE = new Set<QuotationStatus>(["draft", "sent", "accepted", "declined", "expired"]);

const STATUS_TONE: Record<string, string> = {
  draft: "outline",
  sent: "secondary",
  accepted: "default",
  converted: "default",
  declined: "destructive",
  expired: "destructive",
  cancelled: "outline",
};

type LineDraft = {
  product_id: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_percent: string;
  description: string;
};

const EMPTY_LINE: LineDraft = {
  product_id: "",
  quantity: "1",
  unit_price: "",
  discount_percent: "0",
  tax_percent: "15",
  description: "",
};

type QuotationForm = {
  customer_id: string;
  issued_on: string;
  valid_until: string;
  currency: string;
  terms: string;
  notes: string;
  lines: LineDraft[];
};

type ConvertForm = {
  warehouse_id: string;
  requested_delivery_date: string;
  customer_reference: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_FORM: QuotationForm = {
  customer_id: "",
  issued_on: today(),
  valid_until: "",
  currency: "ETB",
  terms: "",
  notes: "",
  lines: [{ ...EMPTY_LINE }],
};

const DEFAULT_CONVERT: ConvertForm = {
  warehouse_id: "",
  requested_delivery_date: "",
  customer_reference: "",
};

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && "data" in payload) {
    const inner = (payload as { data: unknown }).data;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown, currency = "ETB") =>
  `${currency} ${n(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function productLabel(products: Map<number, ProductRecord>, productId: number, description?: string | null) {
  const product = products.get(productId);
  if (product) {
    const base = product.name || product.sku || `Product #${productId}`;
    return product.sku && product.name ? `${product.name} (${product.sku})` : base;
  }
  return description || `Product #${productId}`;
}

function linesToPayload(lines: LineDraft[]) {
  return lines
    .filter((line) => line.product_id && Number(line.quantity) > 0)
    .map((line) => ({
      product_id: Number(line.product_id),
      quantity: Number(line.quantity),
      ...(line.unit_price ? { unit_price: Number(line.unit_price) } : {}),
      discount_percent: Number(line.discount_percent || 0),
      tax_percent: Number(line.tax_percent || 0),
      ...(line.description ? { description: line.description } : {}),
    }));
}

function quotationToLines(quotation: SalesQuotation): LineDraft[] {
  const rows = quotation.lines ?? [];
  if (rows.length === 0) return [{ ...EMPTY_LINE }];
  return rows.map((line) => ({
    product_id: String(line.product_id),
    quantity: String(line.quantity),
    unit_price: line.unit_price ? String(line.unit_price) : "",
    discount_percent: String(line.discount_percent ?? 0),
    tax_percent: String(line.tax_percent ?? 0),
    description: line.description ?? "",
  }));
}

export default function SalesQuotationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [openOnly, setOpenOnly] = React.useState(false);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [form, setForm] = React.useState<QuotationForm>(DEFAULT_FORM);

  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [transitioningId, setTransitioningId] = React.useState<number | null>(null);
  const [convertingId, setConvertingId] = React.useState<number | null>(null);

  const [convertOpen, setConvertOpen] = React.useState(false);
  const [convertTargetId, setConvertTargetId] = React.useState<number | null>(null);
  const [convertForm, setConvertForm] = React.useState<ConvertForm>(DEFAULT_CONVERT);

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
      setOpenPickerCount((c) => c + 1);
      return;
    }
    pickerOpenRef.current = true;
    setOpenPickerCount((c) => Math.max(0, c - 1));
    pickerCloseTimerRef.current = setTimeout(() => {
      pickerOpenRef.current = false;
      pickerCloseTimerRef.current = null;
    }, 300);
  }, []);

  const blockOutsideDismiss = React.useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault();
  }, []);

  const allowDialogClose = React.useCallback(
    (open: boolean, close: () => void) => {
      if (!open && (pickerOpenRef.current || openPickerCount > 0)) return;
      if (!open) close();
    },
    [openPickerCount],
  );

  const listQuery = useQuery({
    queryKey: ["sales", "quotations", tableQuery, statusFilter, openOnly],
    queryFn: () =>
      salesApi
        .listQuotations({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          open_only: openOnly ? 1 : undefined,
        })
        .then((res) => res.data),
  });

  const customersQuery = useQuery({
    queryKey: ["sales", "customer-options"],
    queryFn: () => salesApi.listCustomers({ limit: 200, is_active: 1 }).then((res) => res.data),
    enabled: formOpen,
  });

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "sales-quotation-picker"],
    queryFn: async () => unwrapList<ProductRecord>(await fetchInventoryProducts({ per_page: 200, limit: 200 })),
    enabled: formOpen || detailId !== null,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list", "sales-quotation-picker"],
    queryFn: async () => unwrapList<Warehouse>((await warehouseApi.listWarehouses({ limit: 100 })).data),
    enabled: convertOpen,
  });

  const detailQuery = useQuery({
    queryKey: ["sales", "quotation", detailId],
    queryFn: () => salesApi.getQuotation(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const productById = React.useMemo(() => {
    const map = new Map<number, ProductRecord>();
    for (const p of productsQuery.data ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [productsQuery.data]);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const resetForm = React.useCallback(() => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setEditLoading(false);
  }, []);

  const closeForm = React.useCallback(() => {
    setFormOpen(false);
    resetForm();
  }, [resetForm]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const lines = linesToPayload(form.lines);
      if (editingId) {
        return salesApi.updateQuotationLines(editingId, lines);
      }
      return salesApi.createQuotation({
        customer_id: Number(form.customer_id),
        issued_on: form.issued_on || undefined,
        valid_until: form.valid_until || undefined,
        currency: form.currency || "ETB",
        terms: form.terms || undefined,
        notes: form.notes || undefined,
        lines,
      });
    },
    onSuccess: (response: any) => {
      toast.success(
        response?.data?.message ??
          t(
            editingId ? "sales.quotations.updated" : "sales.quotations.created",
            editingId ? "Quotation updated." : "Quotation created.",
          ),
      );
      invalidate();
      closeForm();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.quotations.save_failed", "Could not save the quotation."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => {
      setTransitioningId(id);
      return salesApi.transitionQuotation(id, status);
    },
    onSuccess: () => {
      toast.success(t("sales.quotations.moved", "Quotation updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.quotations.move_failed", "That transition was refused."))),
    onSettled: () => setTransitioningId(null),
  });

  const convert = useMutation({
    mutationFn: (id: number) =>
      salesApi.convertQuotation(id, {
        warehouse_id: convertForm.warehouse_id ? Number(convertForm.warehouse_id) : undefined,
        requested_delivery_date: convertForm.requested_delivery_date || undefined,
        customer_reference: convertForm.customer_reference || undefined,
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("sales.quotations.converted", "Converted to an order."));
      setConvertOpen(false);
      setConvertTargetId(null);
      setConvertForm(DEFAULT_CONVERT);
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.quotations.convert_failed", "Could not convert it."))),
    onSettled: () => setConvertingId(null),
  });

  const openDetail = React.useCallback((id: number) => {
    setDetailId(id);
  }, []);

  const openEdit = React.useCallback(async (quotation: SalesQuotation) => {
    setEditingId(quotation.id);
    setFormOpen(true);
    setEditLoading(true);
    try {
      const res = await salesApi.getQuotation(quotation.id);
      const full = (res?.data?.data as SalesQuotation | undefined) ?? quotation;
      setForm({
        customer_id: String(full.customer_id),
        issued_on: String(full.issued_on).slice(0, 10),
        valid_until: full.valid_until ? String(full.valid_until).slice(0, 10) : "",
        currency: full.currency || "ETB",
        terms: full.terms ?? "",
        notes: full.notes ?? "",
        lines: quotationToLines(full),
      });
    } catch {
      setForm({
        ...DEFAULT_FORM,
        lines: quotationToLines(quotation),
      });
    } finally {
      setEditLoading(false);
    }
  }, []);

  const openConvert = React.useCallback((id: number) => {
    setConvertTargetId(id);
    setConvertForm(DEFAULT_CONVERT);
    setConvertOpen(true);
  }, []);

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const detail: SalesQuotation | undefined = detailQuery.data?.data;
  const detailLoading = detailQuery.isPending && detailId !== null;
  const detailFetching = detailQuery.isFetching;
  const customers = (customersQuery.data?.data ?? []) as SalesCustomer[];
  const warehouses = warehousesQuery.data ?? [];

  const transitionButtons = React.useCallback(
    (record: SalesQuotation, inDetail = false) => {
      const next = (TRANSITIONS[record.status] ?? []).filter((status) => status !== "converted");
      const isTransitioning = transitioningId === record.id;
      const isConverting = convertingId === record.id;
      const canConvert = record.status === "accepted" && !record.converted_order_id;

      return (
        <>
          {canConvert ? (
            <Button
              size="sm"
              className={inDetail ? "" : "text-[11px]"}
              disabled={isConverting || isTransitioning}
              onClick={() => openConvert(record.id)}
            >
              {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("sales.quotations.convert", "Convert")}
            </Button>
          ) : null}
          {next.map((status) => (
            <Button
              key={status}
              variant="outline"
              size="sm"
              className={inDetail ? "capitalize" : "h-8 text-[11px] capitalize"}
              disabled={isTransitioning || isConverting}
              onClick={() => transition.mutate({ id: record.id, status })}
            >
              {isTransitioning ? <Loader2 className="h-3 w-3 animate-spin" /> : status.replace(/_/g, " ")}
            </Button>
          ))}
        </>
      );
    },
    [convertingId, openConvert, t, transition, transitioningId],
  );

  const columns = React.useMemo<ColumnDef<SalesQuotation>[]>(
    () => [
      {
        id: "number",
        header: t("sales.quotations.number", "Quotation"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-bold">{row.original.quotation_number}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.customer?.name ?? `#${row.original.customer_id}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "issued_on",
        header: t("sales.quotations.issued", "Issued"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">{String(row.original.issued_on).slice(0, 10)}</span>
        ),
      },
      {
        accessorKey: "valid_until",
        header: t("sales.quotations.valid_until", "Valid until"),
        cell: ({ row }) => (
          <span
            className={`text-xs tabular-nums ${
              row.original.is_expired ? "font-semibold text-destructive" : ""
            }`}
          >
            {row.original.valid_until ? String(row.original.valid_until).slice(0, 10) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: t("sales.common.total", "Total"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{money(row.original.total, row.original.currency)}</span>
        ),
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
        header: t("sales.common.actions", "Actions"),
        cell: ({ row }) => {
          const record = row.original;
          const isViewLoading = detailFetching && detailId === record.id;
          const isTransitioning = transitioningId === record.id;
          const next = (TRANSITIONS[record.status] ?? []).filter((s) => s !== "converted");

          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isViewLoading || isTransitioning}
                onClick={() => openDetail(record.id)}
                aria-label={t("sales.common.open", "Open")}
              >
                {isViewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              {EDITABLE.has(record.status) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={isViewLoading || isTransitioning}
                  onClick={() => openEdit(record)}
                  aria-label={t("sales.common.edit", "Edit")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {record.status === "accepted" && !record.converted_order_id ? (
                <Button
                  size="sm"
                  className="h-8 text-[11px]"
                  disabled={convertingId === record.id || isTransitioning}
                  onClick={() => openConvert(record.id)}
                >
                  {convertingId === record.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {t("sales.quotations.convert", "Convert")}
                </Button>
              ) : null}
              {next.slice(0, 2).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px] capitalize"
                  disabled={isTransitioning || isViewLoading}
                  onClick={() => transition.mutate({ id: record.id, status })}
                >
                  {isTransitioning ? <Loader2 className="h-3 w-3 animate-spin" /> : status.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          );
        },
      },
    ],
    [
      convertingId,
      detailFetching,
      detailId,
      openConvert,
      openDetail,
      openEdit,
      t,
      transition,
      transitioningId,
    ],
  );

  const renderLineEditor = () => (
    <div className="space-y-2">
      <Label>{t("sales.common.lines", "Lines")}</Label>
      {form.lines.map((line, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-border/50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px]">{t("sales.pricing.product", "Product")}</Label>
              <Select
                value={line.product_id || "none"}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => {
                  const next = [...form.lines];
                  next[index] = { ...line, product_id: v === "none" ? "" : v };
                  setForm((f) => ({ ...f, lines: next }));
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("sales.common.select", "Select...")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("sales.common.select", "Select...")}</SelectItem>
                  {(productsQuery.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name || p.sku || `#${p.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t("sales.common.quantity", "Qty")}</Label>
              <Input
                type="number"
                min={0}
                value={line.quantity}
                onChange={(e) => {
                  const next = [...form.lines];
                  next[index] = { ...line, quantity: e.target.value };
                  setForm((f) => ({ ...f, lines: next }));
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">
                {t("sales.orders.price_override", "Unit price override")}
              </Label>
              <Input
                type="number"
                min={0}
                value={line.unit_price}
                onChange={(e) => {
                  const next = [...form.lines];
                  next[index] = { ...line, unit_price: e.target.value };
                  setForm((f) => ({ ...f, lines: next }));
                }}
                placeholder={t("sales.orders.price_from_list", "from price list")}
                className="h-9"
              />
              <SalesLinePriceHint
                customerId={form.customer_id}
                productId={line.product_id}
                quantity={line.quantity}
                currency={form.currency}
                manualPrice={line.unit_price}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t("sales.common.discount", "Discount %")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={line.discount_percent}
                onChange={(e) => {
                  const next = [...form.lines];
                  next[index] = { ...line, discount_percent: e.target.value };
                  setForm((f) => ({ ...f, lines: next }));
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t("sales.common.tax", "Tax %")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={line.tax_percent}
                onChange={(e) => {
                  const next = [...form.lines];
                  next[index] = { ...line, tax_percent: e.target.value };
                  setForm((f) => ({ ...f, lines: next }));
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px]">{t("sales.common.description", "Description")}</Label>
              <Input
                value={line.description}
                onChange={(e) => {
                  const next = [...form.lines];
                  next[index] = { ...line, description: e.target.value };
                  setForm((f) => ({ ...f, lines: next }));
                }}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-destructive"
              disabled={form.lines.length === 1}
              onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }))}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t("sales.common.remove_line", "Remove")}
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))}
      >
        <Plus className="mr-2 h-4 w-4" />
        {t("sales.common.add_line", "Add line")}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("sales.quotations.title", "Quotations")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "sales.quotations.subtitle",
              "Offers to customers. An accepted quotation converts to an order at exactly the price quoted.",
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
          {t("sales.quotations.add", "New Quotation")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("sales.common.status", "Status")}</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setTableQuery((p) => ({ ...p, page: 1 }));
            }}
          >
            <SelectTrigger className="h-9 w-[11rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("sales.common.all", "All")}</SelectItem>
              {QUOTATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-full border border-border/60 px-3 text-xs">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => {
              setOpenOnly(e.target.checked);
              setTableQuery((p) => ({ ...p, page: 1 }));
            }}
          />
          {t("sales.quotations.open_only", "Open only")}
        </label>
      </div>

      {listQuery.isPending ? (
        <PanelTableSkeleton rows={8} cols={6} />
      ) : listQuery.isError ? (
        <EmptyPanel label={t("sales.quotations.load_failed", "Could not load quotations.")} />
      ) : (
        <DataTable
          columns={columns}
          data={(listQuery.data?.data ?? []) as SalesQuotation[]}
          totalEntries={listQuery.data?.meta?.total ?? 0}
          loading={listQuery.isFetching && !listQuery.isPending}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("sales.quotations.search", "Search quotations, customer…")}
          resourceName="sales-quotations"
        />
      )}

      {/* Create / edit */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => allowDialogClose(open, () => (open ? setFormOpen(true) : closeForm()))}
      >
        <DialogContent
          className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingId
                  ? t("sales.quotations.edit", "Edit Quotation Lines")
                  : t("sales.quotations.add", "New Quotation")}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? t(
                      "sales.quotations.edit_desc",
                      "Only lines can change after creation. Header fields are shown for reference.",
                    )
                  : t(
                      "sales.quotations.form_desc",
                      "Leave the unit price blank and the customer's price list decides, including quantity breaks.",
                    )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {editLoading ? (
              <SupplyChainDialogSkeleton rows={3} />
            ) : editingId ? (
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                <p>
                  {t("sales.common.customer", "Customer")}:{" "}
                  {customers.find((c) => String(c.id) === form.customer_id)?.name ?? `#${form.customer_id}`}
                </p>
                <p>
                  {t("sales.quotations.valid_until", "Valid until")}: {form.valid_until || "—"} ·{" "}
                  {form.currency}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("sales.common.customer", "Customer")}</Label>
                  <Select
                    value={form.customer_id || "none"}
                    onOpenChange={handlePickerOpenChange}
                    onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("sales.common.select", "Select...")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("sales.common.select", "Select...")}</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={String(customer.id)}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("sales.quotations.issued", "Issued")}</Label>
                  <Input
                    type="date"
                    value={form.issued_on}
                    onChange={(e) => setForm((f) => ({ ...f, issued_on: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("sales.quotations.valid_until", "Valid until")}</Label>
                  <Input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("sales.common.currency", "Currency")}</Label>
                  <Input
                    value={form.currency}
                    maxLength={3}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    className="h-9 uppercase"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("sales.quotations.terms", "Terms")}</Label>
                  <Textarea
                    value={form.terms}
                    onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("sales.common.notes", "Notes")}</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            )}

            {renderLineEditor()}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={closeForm}>
              {t("sales.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending ||
                (!editingId && !form.customer_id) ||
                !form.lines.some((line) => line.product_id && Number(line.quantity) > 0)
              }
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("sales.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to order */}
      <Dialog
        open={convertOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConvertOpen(false);
            setConvertTargetId(null);
            setConvertingId(null);
            setConvertForm(DEFAULT_CONVERT);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("sales.quotations.convert", "Convert to order")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "sales.quotations.convert_desc",
                  "Optional fulfilment details are passed to the new sales order.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label>{t("sales.orders.warehouse", "Ship-from warehouse")}</Label>
              <Select
                value={convertForm.warehouse_id || "none"}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) =>
                  setConvertForm((f) => ({ ...f, warehouse_id: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("sales.common.select", "Select...")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("sales.common.optional", "Optional")}</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.orders.requested_delivery", "Requested delivery")}</Label>
              <Input
                type="date"
                value={convertForm.requested_delivery_date}
                onChange={(e) =>
                  setConvertForm((f) => ({ ...f, requested_delivery_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.orders.customer_reference", "Customer reference")}</Label>
              <Input
                value={convertForm.customer_reference}
                onChange={(e) => setConvertForm((f) => ({ ...f, customer_reference: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setConvertOpen(false)}>
              {t("sales.common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={convert.isPending || convertTargetId === null}
              onClick={() => {
                if (convertTargetId !== null) {
                  setConvertingId(convertTargetId);
                  convert.mutate(convertTargetId);
                }
              }}
            >
              {convert.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("sales.quotations.convert", "Convert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => allowDialogClose(open, () => !open && setDetailId(null))}
      >
        <DialogContent
          className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail ? detail.quotation_number : t("sales.quotations.title", "Quotation")}
              </DialogTitle>
              <DialogDescription>
                {detailLoading
                  ? t("sales.common.loading", "Loading...")
                  : detail
                    ? `${detail.customer?.name ?? ""} — ${money(detail.total, detail.currency)}`
                    : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
            {detailLoading ? (
              <SupplyChainDialogSkeleton rows={4} />
            ) : detail ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={(STATUS_TONE[detail.status] ?? "outline") as any} className="capitalize">
                    {detail.status.replace(/_/g, " ")}
                  </Badge>
                  {detail.is_expired ? (
                    <Badge variant="destructive" className="text-[11px]">
                      {t("sales.quotations.expired", "Past validity date")}
                    </Badge>
                  ) : null}
                  {detail.converted_order_id ? (
                    <span className="text-sm">
                      <span className="text-muted-foreground">{t("sales.quotations.order", "Order")}: </span>
                      <Link
                        href="/dashboard/sales/orders"
                        className="font-medium text-primary hover:underline"
                      >
                        {detail.order?.order_number ?? `#${detail.converted_order_id}`}
                      </Link>
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile
                    label={t("sales.quotations.issued", "Issued")}
                    value={String(detail.issued_on).slice(0, 10)}
                  />
                  <StatTile
                    label={t("sales.quotations.valid_until", "Valid until")}
                    value={detail.valid_until ? String(detail.valid_until).slice(0, 10) : "—"}
                  />
                  <StatTile label={t("sales.common.total", "Total")} value={money(detail.total, detail.currency)} />
                </div>

                {detail.terms ? (
                  <Panel title={t("sales.quotations.terms", "Terms")}>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.terms}</p>
                  </Panel>
                ) : null}

                {detail.notes ? <p className="text-sm text-muted-foreground">{detail.notes}</p> : null}

                <Panel title={t("sales.common.lines", "Lines")}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-sm">
                      <thead>
                        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="pb-2 font-semibold">{t("sales.pricing.product", "Product")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.common.quantity", "Qty")}</th>
                          <th className="pb-2 text-right font-semibold">
                            {t("sales.pricing.unit_price", "Unit price")}
                          </th>
                          <th className="pb-2 text-right font-semibold">{t("sales.common.discount", "Disc %")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.common.tax", "Tax %")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.common.total", "Total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.lines ?? []).map((line) => (
                          <tr key={line.id} className="border-b border-border/40 last:border-0">
                            <td className="py-2">
                              {productLabel(productById, line.product_id, line.description)}
                            </td>
                            <td className="py-2 text-right tabular-nums">{n(line.quantity)}</td>
                            <td className="py-2 text-right tabular-nums">
                              {money(line.unit_price, detail.currency)}
                            </td>
                            <td className="py-2 text-right tabular-nums">{n(line.discount_percent)}%</td>
                            <td className="py-2 text-right tabular-nums">{n(line.tax_percent)}%</td>
                            <td className="py-2 text-right font-semibold tabular-nums">
                              {money(line.line_total, detail.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border/60">
                          <td colSpan={5} className="py-2 text-right text-xs text-muted-foreground">
                            {t("sales.common.subtotal", "Subtotal")}
                          </td>
                          <td className="py-2 text-right tabular-nums">{money(detail.subtotal, detail.currency)}</td>
                        </tr>
                        {n(detail.discount_total) > 0 ? (
                          <tr>
                            <td colSpan={5} className="py-1 text-right text-xs text-muted-foreground">
                              {t("sales.common.discount", "Discount")}
                            </td>
                            <td className="py-1 text-right tabular-nums text-destructive">
                              −{money(detail.discount_total, detail.currency)}
                            </td>
                          </tr>
                        ) : null}
                        <tr>
                          <td colSpan={5} className="py-1 text-right text-xs text-muted-foreground">
                            {t("sales.common.tax_total", "Tax")}
                          </td>
                          <td className="py-1 text-right tabular-nums">{money(detail.tax_total, detail.currency)}</td>
                        </tr>
                        <tr>
                          <td colSpan={5} className="py-1 text-right text-sm font-bold">
                            {t("sales.common.total", "Total")}
                          </td>
                          <td className="py-1 text-right font-black tabular-nums">
                            {money(detail.total, detail.currency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Panel>

                {(TRANSITIONS[detail.status] ?? []).filter((s) => s !== "converted").length > 0 ||
                (detail.status === "accepted" && !detail.converted_order_id) ? (
                  <div className="flex flex-wrap gap-2 border-t border-border/40 pt-4">
                    {EDITABLE.has(detail.status) ? (
                      <Button variant="outline" size="sm" onClick={() => openEdit(detail)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        {t("sales.common.edit", "Edit lines")}
                      </Button>
                    ) : null}
                    {transitionButtons(detail, true)}
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyPanel label={t("sales.quotations.load_failed", "Could not load the quotation.")} />
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
