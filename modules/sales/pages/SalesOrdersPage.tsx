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
import type {
  Availability,
  FulfilmentCapabilities,
  FulfilmentStatus,
  OrderStatus,
  SalesCustomer,
  SalesOrder,
} from "@/modules/sales/types";
import { SalesLinePriceHint } from "@/modules/sales/components/sales-line-price-hint";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { SupplyChainDialogSkeleton } from "@/modules/supplychain/pages/components/supply-chain-skeletons";
import { warehouseApi } from "@/modules/warehouse/api";
import type { Warehouse } from "@/modules/warehouse/types";

const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "pending_approval",
  "confirmed",
  "fulfilled",
  "closed",
  "cancelled",
];

const FULFILMENT_STATUSES: FulfilmentStatus[] = ["pending", "partial", "complete"];

/** Mirrors SalesOrder::TRANSITIONS on the server. */
const TRANSITIONS: Record<string, OrderStatus[]> = {
  draft: ["pending_approval", "confirmed", "cancelled"],
  pending_approval: ["confirmed", "draft", "cancelled"],
  confirmed: ["fulfilled", "cancelled"],
  fulfilled: ["closed"],
  closed: [],
  cancelled: [],
};

const EDITABLE = new Set<OrderStatus>(["draft", "pending_approval"]);

const STATUS_TONE: Record<string, string> = {
  draft: "outline",
  pending_approval: "secondary",
  confirmed: "default",
  fulfilled: "default",
  closed: "secondary",
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

type OrderForm = {
  customer_id: string;
  warehouse_id: string;
  ordered_on: string;
  requested_delivery_date: string;
  customer_reference: string;
  notes: string;
  currency: string;
  lines: LineDraft[];
};

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_FORM: OrderForm = {
  customer_id: "",
  warehouse_id: "",
  ordered_on: today(),
  requested_delivery_date: "",
  customer_reference: "",
  notes: "",
  currency: "ETB",
  lines: [{ ...EMPTY_LINE }],
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

function orderToLines(order: SalesOrder): LineDraft[] {
  const rows = order.lines ?? [];
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

export default function SalesOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [fulfilmentFilter, setFulfilmentFilter] = React.useState("all");
  const [openOnly, setOpenOnly] = React.useState(false);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [form, setForm] = React.useState<OrderForm>(DEFAULT_FORM);

  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [transitioningId, setTransitioningId] = React.useState<number | null>(null);

  const [deliveries, setDeliveries] = React.useState<Record<number, string>>({});
  const [invoiceDocumentId, setInvoiceDocumentId] = React.useState("");

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
    queryKey: ["sales", "orders", tableQuery, statusFilter, fulfilmentFilter, openOnly],
    queryFn: () =>
      salesApi
        .listOrders({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          fulfilment_status: fulfilmentFilter === "all" ? undefined : fulfilmentFilter,
          open_only: openOnly ? 1 : undefined,
        })
        .then((res) => res.data),
  });

  const capabilitiesQuery = useQuery({
    queryKey: ["sales", "fulfilment-status"],
    queryFn: () => salesApi.fulfilmentStatus().then((res) => res.data),
  });

  const customersQuery = useQuery({
    queryKey: ["sales", "customer-options"],
    queryFn: () => salesApi.listCustomers({ limit: 200, is_active: 1 }).then((res) => res.data),
    enabled: formOpen,
  });

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "sales-order-picker"],
    queryFn: async () => unwrapList<ProductRecord>(await fetchInventoryProducts({ per_page: 200, limit: 200 })),
    enabled: formOpen || detailId !== null,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list", "sales-order-picker"],
    queryFn: async () => unwrapList<Warehouse>((await warehouseApi.listWarehouses({ limit: 100 })).data),
    enabled: formOpen,
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

  const invoicePreviewQuery = useQuery({
    queryKey: ["sales", "invoice-preview", detailId],
    queryFn: () => salesApi.invoicePreview(detailId!).then((res) => res.data),
    enabled: detailId !== null && capabilitiesQuery.data?.data?.invoicing?.available,
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
        return salesApi.updateOrderLines(editingId, lines);
      }
      return salesApi.createOrder({
        customer_id: Number(form.customer_id),
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
        ordered_on: form.ordered_on || undefined,
        requested_delivery_date: form.requested_delivery_date || undefined,
        customer_reference: form.customer_reference || undefined,
        notes: form.notes || undefined,
        currency: form.currency || "ETB",
        lines,
      });
    },
    onSuccess: (response: any) => {
      toast.success(
        response?.data?.message ??
          t(editingId ? "sales.orders.updated" : "sales.orders.created", editingId ? "Order updated." : "Order created."),
      );
      invalidate();
      closeForm();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.orders.save_failed", "Could not save the order."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => {
      setTransitioningId(id);
      return salesApi.transitionOrder(id, status);
    },
    onSuccess: () => {
      toast.success(t("sales.orders.moved", "Order updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.orders.move_failed", "That transition was refused."))),
    onSettled: () => setTransitioningId(null),
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

  const markInvoiced = useMutation({
    mutationFn: () => salesApi.markInvoiced(detailId!, Number(invoiceDocumentId)),
    onSuccess: () => {
      toast.success(t("sales.orders.invoiced", "Invoice recorded on the order."));
      setInvoiceDocumentId("");
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.orders.invoice_failed", "Could not record the invoice."))),
  });

  const openDetail = React.useCallback((id: number) => {
    setDetailId(id);
    setDeliveries({});
    setInvoiceDocumentId("");
  }, []);

  const openEdit = React.useCallback(async (order: SalesOrder) => {
    setEditingId(order.id);
    setFormOpen(true);
    setEditLoading(true);
    try {
      const res = await salesApi.getOrder(order.id);
      const full = (res?.data?.data as SalesOrder | undefined) ?? order;
      setForm({
        customer_id: String(full.customer_id),
        warehouse_id: full.warehouse_id ? String(full.warehouse_id) : "",
        ordered_on: String(full.ordered_on).slice(0, 10),
        requested_delivery_date: full.requested_delivery_date
          ? String(full.requested_delivery_date).slice(0, 10)
          : "",
        customer_reference: full.customer_reference ?? "",
        notes: full.notes ?? "",
        currency: full.currency || "ETB",
        lines: orderToLines(full),
      });
    } catch {
      setForm({
        ...DEFAULT_FORM,
        lines: orderToLines(order),
      });
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

  const capabilities: FulfilmentCapabilities | undefined = capabilitiesQuery.data?.data;
  const detail: SalesOrder | undefined = detailQuery.data?.data;
  const detailLoading = detailQuery.isPending && detailId !== null;
  const detailFetching = detailQuery.isFetching;
  const availability = availabilityQuery.data?.data;
  const invoicePreview = invoicePreviewQuery.data?.data;
  const customers = (customersQuery.data?.data ?? []) as SalesCustomer[];

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
          <span className="font-semibold tabular-nums">
            {money(row.original.total, row.original.currency)}
          </span>
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
                {percent <= 0 && row.original.status === "confirmed"
                  ? t("sales.orders.fulfilment_hint", "Record deliveries in order detail")
                  : row.original.fulfilment_status}
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
        header: t("sales.common.actions", "Actions"),
        cell: ({ row }) => {
          const record = row.original;
          const next = TRANSITIONS[record.status] ?? [];
          const isViewLoading = detailFetching && detailId === record.id;
          const isTransitioning = transitioningId === record.id;

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
    [detailFetching, detailId, openDetail, openEdit, t, transition, transitioningId],
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
                placeholder={t("sales.orders.price_from_list", "from price list")}
                onChange={(e) => {
                  const next = [...form.lines];
                  next[index] = { ...line, unit_price: e.target.value };
                  setForm((f) => ({ ...f, lines: next }));
                }}
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
          <h1 className="text-3xl font-black tracking-tight">{t("sales.orders.title", "Sales Orders")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "sales.orders.subtitle",
              "Committed customer demand: what was promised, what has shipped, and what is still owed.",
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
          {t("sales.orders.add", "New Order")}
        </Button>
      </div>

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
              {capabilities[key]?.available ? "" : ` — ${t("sales.orders.not_installed", "not installed")}`}
            </Badge>
          ))}
        </div>
      ) : null}

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
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("sales.orders.fulfilment", "Fulfilment")}</Label>
          <Select
            value={fulfilmentFilter}
            onValueChange={(v) => {
              setFulfilmentFilter(v);
              setTableQuery((p) => ({ ...p, page: 1 }));
            }}
          >
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("sales.common.all", "All")}</SelectItem>
              {FULFILMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
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
          {t("sales.orders.open_only", "Open only")}
        </label>
      </div>

      {listQuery.isPending ? (
        <PanelTableSkeleton rows={8} cols={7} />
      ) : listQuery.isError ? (
        <EmptyPanel label={t("sales.orders.load_failed", "Could not load orders.")} />
      ) : (
        <DataTable
          columns={columns}
          data={(listQuery.data?.data ?? []) as SalesOrder[]}
          totalEntries={listQuery.data?.meta?.total ?? 0}
          loading={listQuery.isFetching && !listQuery.isPending}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("sales.orders.search", "Search orders, customer, reference…")}
          resourceName="sales-orders"
        />
      )}

      {/* Create / edit lines */}
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
                {editingId ? t("sales.orders.edit", "Edit Order Lines") : t("sales.orders.add", "New Order")}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? t("sales.orders.edit_desc", "Only lines can change while the order is still a draft.")
                  : t(
                      "sales.orders.form_desc",
                      "Leave unit price blank to use the customer's price list. Stock checks use the ship-from warehouse.",
                    )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {editLoading ? (
              <SupplyChainDialogSkeleton rows={3} />
            ) : editingId ? (
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {t("sales.common.customer", "Customer")}:{" "}
                {customers.find((c) => String(c.id) === form.customer_id)?.name ?? `#${form.customer_id}`}
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
                    <SelectTrigger>
                      <SelectValue placeholder={t("sales.common.select", "Select...")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("sales.common.select", "Select...")}</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("sales.orders.warehouse", "Ship from warehouse")}</Label>
                  <Select
                    value={form.warehouse_id || "none"}
                    onOpenChange={handlePickerOpenChange}
                    onValueChange={(v) => setForm((f) => ({ ...f, warehouse_id: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("sales.common.none", "None")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("sales.common.none", "None")}</SelectItem>
                      {(warehousesQuery.data ?? []).map((wh) => (
                        <SelectItem key={wh.id} value={String(wh.id)}>
                          {wh.name}
                          {wh.code ? ` (${wh.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="so-ordered">{t("sales.orders.ordered", "Ordered on")}</Label>
                  <Input
                    id="so-ordered"
                    type="date"
                    value={form.ordered_on}
                    onChange={(e) => setForm((f) => ({ ...f, ordered_on: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="so-due">{t("sales.orders.due", "Requested delivery")}</Label>
                  <Input
                    id="so-due"
                    type="date"
                    value={form.requested_delivery_date}
                    onChange={(e) => setForm((f) => ({ ...f, requested_delivery_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="so-ref">{t("sales.orders.customer_ref", "Customer reference")}</Label>
                  <Input
                    id="so-ref"
                    value={form.customer_reference}
                    onChange={(e) => setForm((f) => ({ ...f, customer_reference: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="so-currency">{t("sales.common.currency", "Currency")}</Label>
                  <Input
                    id="so-currency"
                    maxLength={3}
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="so-notes">{t("sales.common.notes", "Notes")}</Label>
                  <Textarea
                    id="so-notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
              disabled={
                saveMutation.isPending ||
                editLoading ||
                (!editingId && !form.customer_id) ||
                !form.lines.some((l) => l.product_id && Number(l.quantity) > 0)
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("sales.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setDeliveries({});
            setInvoiceDocumentId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.order_number ?? t("sales.orders.title", "Order")}
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

          <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">
            {detailLoading || !detail ? (
              <SupplyChainDialogSkeleton rows={4} />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    {detail.status.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {detail.fulfilment_status}
                  </Badge>
                  {detail.is_overdue ? (
                    <Badge variant="destructive">{t("sales.orders.overdue", "Overdue")}</Badge>
                  ) : null}
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  {detail.quotation_id ? (
                    <p>
                      <span className="text-muted-foreground">{t("sales.orders.from_quote", "From quotation")}: </span>
                      <Link href="/dashboard/sales/quotations" className="font-medium text-primary hover:underline">
                        #{detail.quotation_id}
                      </Link>
                    </p>
                  ) : null}
                  {detail.customer_reference ? (
                    <p>
                      <span className="text-muted-foreground">{t("sales.orders.customer_ref", "Customer ref")}: </span>
                      {detail.customer_reference}
                    </p>
                  ) : null}
                  {detail.requested_delivery_date ? (
                    <p>
                      <span className="text-muted-foreground">{t("sales.orders.due", "Due")}: </span>
                      {String(detail.requested_delivery_date).slice(0, 10)}
                    </p>
                  ) : null}
                  {detail.shipment_id ? (
                    <p>
                      <span className="text-muted-foreground">{t("sales.orders.shipment", "Shipment")}: </span>
                      <Link
                        href="/dashboard/supply-chain/shipments"
                        className="font-medium text-primary hover:underline"
                      >
                        #{detail.shipment_id}
                      </Link>
                    </p>
                  ) : null}
                  {detail.invoice_document_id ? (
                    <p>
                      <span className="text-muted-foreground">{t("sales.orders.invoice", "Invoice")}: </span>
                      <Link
                        href={`/dashboard/finance/sales?document=${detail.invoice_document_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        #{detail.invoice_document_id}
                      </Link>
                    </p>
                  ) : null}
                </div>

                {detail.notes ? <p className="text-sm text-muted-foreground">{detail.notes}</p> : null}

                <div className="grid gap-3 sm:grid-cols-4">
                  <StatTile
                    label={t("sales.orders.fulfilment", "Fulfilment")}
                    value={`${n(detail.fulfilment_percent).toFixed(0)}%`}
                    meta={
                      n(detail.fulfilment_percent) <= 0 && detail.status === "confirmed"
                        ? t(
                            "sales.orders.fulfilment_detail_hint",
                            "Delivered qty ÷ ordered qty — use Deliver below to increase progress.",
                          )
                        : detail.fulfilment_status
                    }
                  />
                  <StatTile label={t("sales.common.total", "Total")} value={money(detail.total, detail.currency)} />
                  <StatTile
                    label={t("sales.common.subtotal", "Subtotal")}
                    value={money(detail.subtotal, detail.currency)}
                  />
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
                    <table className="w-full min-w-[48rem] text-sm">
                      <thead>
                        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="pb-2 font-semibold">{t("sales.pricing.product", "Product")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.common.quantity", "Ordered")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.orders.delivered", "Delivered")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.orders.invoiced", "Invoiced")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.orders.outstanding", "Outstanding")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.orders.margin", "Margin")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.common.total", "Total")}</th>
                          {detail.status === "confirmed" ? (
                            <th className="pb-2 text-right font-semibold">{t("sales.orders.deliver_now", "Deliver")}</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.lines ?? []).map((line) => (
                          <tr key={line.id} className="border-b border-border/40 last:border-0">
                            <td className="py-2">{productLabel(productById, line.product_id, line.description)}</td>
                            <td className="py-2 text-right tabular-nums">{n(line.quantity)}</td>
                            <td className="py-2 text-right tabular-nums">{n(line.delivered_quantity)}</td>
                            <td className="py-2 text-right tabular-nums">{n(line.invoiced_quantity)}</td>
                            <td className="py-2 text-right tabular-nums">{n(line.outstanding_quantity)}</td>
                            <td className="py-2 text-right tabular-nums">
                              {money(line.margin_amount, detail.currency)}
                            </td>
                            <td className="py-2 text-right tabular-nums">{money(line.line_total, detail.currency)}</td>
                            {detail.status === "confirmed" ? (
                              <td className="py-2 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  max={n(line.outstanding_quantity)}
                                  value={deliveries[line.id] ?? ""}
                                  onChange={(e) =>
                                    setDeliveries({ ...deliveries, [line.id]: e.target.value })
                                  }
                                  className="ml-auto h-8 w-24"
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
                        {deliver.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t("sales.orders.record_delivery", "Record delivery")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={ship.isPending || !capabilities?.shipping?.available}
                        onClick={() => ship.mutate(detail.id)}
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
                  <Panel title={t("sales.orders.shortfalls", "Stock shortfalls")}>
                    <div className="space-y-1.5">
                      {availability.lines
                        .filter((line: Availability["lines"][number]) => n(line.shortfall) > 0)
                        .map((line: Availability["lines"][number]) => (
                          <div
                            key={line.line_id}
                            className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                          >
                            <span>{productLabel(productById, line.product_id)}</span>
                            <span className="tabular-nums">
                              {t("sales.orders.short_by", "short {n}").replace("{n}", String(n(line.shortfall)))}
                            </span>
                          </div>
                        ))}
                    </div>
                  </Panel>
                ) : null}

                {capabilities?.invoicing?.available && invoicePreview ? (
                  <Panel
                    title={t("sales.orders.invoice", "Invoicing")}
                    description={invoicePreview.reason ?? undefined}
                  >
                    <div className="space-y-3 text-sm">
                      <p>
                        {t("sales.orders.invoice_ready", "Ready to invoice")}:{" "}
                        <span className="font-semibold tabular-nums">
                          {money(invoicePreview.amount, invoicePreview.currency ?? detail.currency)}
                        </span>
                        {" · "}
                        {invoicePreview.lines} {t("sales.common.lines", "lines")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "sales.orders.invoice_how",
                          "Sales does not create the invoice here. Create the sales invoice in Finance → Sales, then paste its document ID below to link them.",
                        )}{" "}
                        <Link href="/dashboard/finance/sales" className="font-medium text-primary hover:underline">
                          {t("sales.orders.open_finance_sales", "Open Finance → Sales")}
                        </Link>
                      </p>
                      {detail.invoice_document_id ? (
                        <p className="text-muted-foreground">
                          {t("sales.orders.already_invoiced", "Already linked to invoice")}{" "}
                          <Link
                            href={`/dashboard/finance/sales?document=${detail.invoice_document_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            #{detail.invoice_document_id}
                          </Link>
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="inv-doc">{t("sales.orders.finance_doc_id", "Finance document ID")}</Label>
                            <Input
                              id="inv-doc"
                              type="number"
                              className="h-9 w-40"
                              value={invoiceDocumentId}
                              onChange={(e) => setInvoiceDocumentId(e.target.value)}
                            />
                          </div>
                          <Button
                            variant="outline"
                            disabled={markInvoiced.isPending || !invoiceDocumentId}
                            onClick={() => markInvoiced.mutate()}
                          >
                            {markInvoiced.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {t("sales.orders.mark_invoiced", "Mark invoiced")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Panel>
                ) : null}

                {(detail.commissions ?? []).length > 0 ? (
                  <Panel title={t("sales.orders.commission", "Commission")}>
                    {detail.commissions!.map((commission) => (
                      <div key={commission.id} className="flex items-center justify-between text-sm">
                        <span>
                          {t("sales.overview.employee", "Employee")} #{commission.employee_id}
                        </span>
                        <span className="tabular-nums">
                          {money(commission.amount, detail.currency)}
                          <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                            {commission.status}
                          </Badge>
                        </span>
                      </div>
                    ))}
                  </Panel>
                ) : null}

                {(TRANSITIONS[detail.status] ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2 border-t border-border/40 pt-4">
                    {EDITABLE.has(detail.status) ? (
                      <Button variant="outline" size="sm" onClick={() => openEdit(detail)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        {t("sales.common.edit", "Edit lines")}
                      </Button>
                    ) : null}
                    {(TRANSITIONS[detail.status] ?? []).map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        size="sm"
                        className="capitalize"
                        disabled={transition.isPending}
                        onClick={() => transition.mutate({ id: detail.id, status })}
                      >
                        {status.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </>
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
