"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { productionApi } from "@/modules/production/api";
import type {
  ProductionBom,
  ProductionLine,
  ProductionOrder,
  ProductionOrderStatus,
} from "@/modules/production/types";
import { OrderStatusBadge, QaStatusBadge } from "@/modules/production/components/status-badges";
import {
  BusyLabel,
  ProductionError,
  ProductionLoading,
  ProductionMetricCard,
  ProductionShell,
} from "@/modules/production/components/production-shell";
import { errorText, isoDaysAgo } from "../utils";
import {
  LocationSearchPicker,
  ProductSearchPicker,
  WarehouseSearchPicker,
} from "./orders-pickers";

type OrderStatusFilter = ProductionOrderStatus | "all";
type QaStatusFilter = "all" | "pending" | "in_test" | "released" | "quarantined" | "rejected";
type PriorityFilter = "all" | "low" | "normal" | "high" | "urgent";

const ORDER_STATUSES: ProductionOrderStatus[] = [
  "draft",
  "scheduled",
  "released",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
];

const QA_STATUSES = ["pending", "in_test", "released", "quarantined", "rejected"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const NEXT_STATUSES: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["released", "draft", "cancelled"],
  released: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["on_hold", "completed", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

function humaniseStatus(value: string): string {
  return value.replace(/_/g, " ");
}

function emptyOrderForm() {
  return {
    product_id: "",
    bom_id: "",
    production_line_id: "",
    planned_quantity: "",
    uom: "pcs",
    priority: "normal" as (typeof PRIORITIES)[number],
    scheduled_start_at: "",
    scheduled_end_at: "",
    manufactured_on: "",
    expires_on: "",
    output_warehouse_id: "",
    output_location_id: "",
    notes: "",
  };
}

function toLocalDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function orderToForm(order: ProductionOrder) {
  return {
    product_id: String(order.product_id),
    bom_id: order.bom_id ? String(order.bom_id) : "",
    production_line_id: order.production_line_id ? String(order.production_line_id) : "",
    planned_quantity: String(order.planned_quantity),
    uom: order.uom || "pcs",
    priority: order.priority,
    scheduled_start_at: toLocalDateTime(order.scheduled_start_at),
    scheduled_end_at: toLocalDateTime(order.scheduled_end_at),
    manufactured_on: order.manufactured_on ?? "",
    expires_on: order.expires_on ?? "",
    output_warehouse_id: order.output_warehouse_id ? String(order.output_warehouse_id) : "",
    output_location_id: order.output_location_id ? String(order.output_location_id) : "",
    notes: order.notes ?? "",
  };
}

function hasActiveOrderFilters(opts: {
  search: string;
  status: OrderStatusFilter;
  qaStatus: QaStatusFilter;
  lineId: string;
  priority: PriorityFilter;
  openOnly: boolean;
  from: string;
  to: string;
}): boolean {
  return Boolean(
    opts.search.trim() ||
      opts.status !== "all" ||
      opts.qaStatus !== "all" ||
      opts.lineId ||
      opts.priority !== "all" ||
      opts.openOnly ||
      opts.from ||
      opts.to,
  );
}

function canEditOrder(order: ProductionOrder): boolean {
  return !["completed", "cancelled"].includes(order.status);
}

function transitionPermission(targetStatus: string): string[] {
  switch (targetStatus) {
    case "scheduled":
      return ["schedule_production_orders", "manage_production_orders", "manage_production"];
    case "released":
      return ["release_production_orders", "manage_production_orders", "manage_production"];
    case "completed":
      return ["complete_production_orders", "manage_production_orders", "manage_production"];
    case "cancelled":
      return ["cancel_production_orders", "manage_production_orders", "manage_production"];
    default:
      return ["manage_production_orders", "manage_production"];
  }
}

function orderPayloadFromForm(form: ReturnType<typeof emptyOrderForm>) {
  return {
    product_id: Number(form.product_id),
    bom_id: form.bom_id ? Number(form.bom_id) : undefined,
    production_line_id: form.production_line_id ? Number(form.production_line_id) : undefined,
    planned_quantity: Number(form.planned_quantity),
    uom: form.uom || "pcs",
    priority: form.priority,
    scheduled_start_at: form.scheduled_start_at || undefined,
    scheduled_end_at: form.scheduled_end_at || undefined,
    manufactured_on: form.manufactured_on || undefined,
    expires_on: form.expires_on || undefined,
    output_warehouse_id: form.output_warehouse_id ? Number(form.output_warehouse_id) : undefined,
    output_location_id: form.output_location_id ? Number(form.output_location_id) : undefined,
    notes: form.notes || undefined,
  };
}

function editPayloadFromForm(form: ReturnType<typeof emptyOrderForm>) {
  return {
    bom_id: form.bom_id ? Number(form.bom_id) : null,
    production_line_id: form.production_line_id ? Number(form.production_line_id) : null,
    planned_quantity: Number(form.planned_quantity),
    uom: form.uom || "pcs",
    priority: form.priority,
    scheduled_start_at: form.scheduled_start_at || null,
    scheduled_end_at: form.scheduled_end_at || null,
    manufactured_on: form.manufactured_on || null,
    expires_on: form.expires_on || null,
    output_warehouse_id: form.output_warehouse_id ? Number(form.output_warehouse_id) : null,
    output_location_id: form.output_location_id ? Number(form.output_location_id) : null,
    notes: form.notes || null,
  };
}

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 25,
  search: "",
  sortCol: "scheduled_start_at",
  sortDir: "desc",
};

type OrderForm = ReturnType<typeof emptyOrderForm>;

type MaterialForm = {
  component_product_id: string;
  actual_quantity: string;
  supplier_batch_number: string;
  from_location_id: string;
};

const DEFAULT_MATERIAL_FORM: MaterialForm = {
  component_product_id: "",
  actual_quantity: "",
  supplier_batch_number: "",
  from_location_id: "",
};

export default function WorkOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canCreate = hasAnyPermission(["manage_production_orders", "manage_production"]);
  const canEdit = hasAnyPermission(["manage_production_orders", "manage_production"]);
  const canDelete = hasAnyPermission(["manage_production_orders", "manage_production"]);
  const canIssue = hasAnyPermission(["issue_production_materials", "manage_production"]);
  const canQa = hasAnyPermission(["release_production_batches", "manage_production"]);
  const canExport = hasAnyPermission([
    "export_production_reports",
    "view_production_reports",
    "manage_production",
  ]);

  const canTransitionTo = React.useCallback(
    (targetStatus: string) => hasAnyPermission(transitionPermission(targetStatus)),
    [hasAnyPermission],
  );

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>({
    page: Number(searchParams.get("page") || DEFAULT_QUERY.page),
    pageSize: Number(searchParams.get("limit") || DEFAULT_QUERY.pageSize),
    search: searchParams.get("search") ?? DEFAULT_QUERY.search,
    sortCol: searchParams.get("sort_col") || DEFAULT_QUERY.sortCol,
    sortDir: searchParams.get("sort_dir") === "asc" ? "asc" : "desc",
  });
  const [statusFilter, setStatusFilter] = React.useState<OrderStatusFilter>(
    (searchParams.get("status") as OrderStatusFilter) || "all",
  );
  const [qaFilter, setQaFilter] = React.useState<QaStatusFilter>(
    (searchParams.get("qa_status") as QaStatusFilter) || "all",
  );
  const [lineFilter, setLineFilter] = React.useState(searchParams.get("line_id") ?? "");
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>(
    (searchParams.get("priority") as PriorityFilter) || "all",
  );
  const [openOnly, setOpenOnly] = React.useState(searchParams.get("open_only") === "1");
  const [fromDate, setFromDate] = React.useState(searchParams.get("from") ?? "");
  const [toDate, setToDate] = React.useState(searchParams.get("to") ?? "");

  const [createOpen, setCreateOpen] = React.useState(searchParams.get("add") === "1");
  const [form, setForm] = React.useState<OrderForm>(emptyOrderForm());
  const [editingOrder, setEditingOrder] = React.useState<ProductionOrder | null>(null);
  const [inspectOrderId, setInspectOrderId] = React.useState<number | null>(
    searchParams.get("order_id") ? Number(searchParams.get("order_id")) : null,
  );
  const [materialOrderId, setMaterialOrderId] = React.useState<number | null>(null);
  const [materialForm, setMaterialForm] = React.useState<MaterialForm>(DEFAULT_MATERIAL_FORM);
  const [qaOrder, setQaOrder] = React.useState<ProductionOrder | null>(null);
  const [qaDecision, setQaDecision] = React.useState("released");
  const [qaNotes, setQaNotes] = React.useState("");
  const [deleteOrder, setDeleteOrder] = React.useState<ProductionOrder | null>(null);

  const deepLinkHandled = React.useRef(false);

  const overviewQuery = useQuery({
    queryKey: ["production", "overview", "orders-page"],
    queryFn: () =>
      productionApi
        .overview({ from: isoDaysAgo(29), to: isoDaysAgo(0) })
        .then((res) => res.data),
  });

  const ordersQuery = useQuery({
    queryKey: [
      "production",
      "orders",
      tableQuery,
      statusFilter,
      qaFilter,
      lineFilter,
      priorityFilter,
      openOnly,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      productionApi
        .listOrders({
          search: tableQuery.search || undefined,
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          sort_col: tableQuery.sortCol,
          sort_dir: tableQuery.sortDir,
          status: statusFilter === "all" ? undefined : statusFilter,
          qa_status: qaFilter === "all" ? undefined : qaFilter,
          production_line_id: lineFilter ? Number(lineFilter) : undefined,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
          open_only: openOnly ? 1 : undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const detailQuery = useQuery({
    queryKey: ["production", "order", inspectOrderId ?? materialOrderId],
    queryFn: () =>
      productionApi.getOrder((inspectOrderId ?? materialOrderId)!).then((res) => res.data.data),
    enabled: inspectOrderId !== null || materialOrderId !== null,
  });

  const linesQuery = useQuery({
    queryKey: ["production", "lines", "select"],
    queryFn: () => productionApi.listLines({ limit: 100, is_active: true }).then((res) => res.data),
  });

  const bomsQuery = useQuery({
    queryKey: ["production", "boms", "active"],
    queryFn: () => productionApi.listBoms({ limit: 100, status: "active" }).then((res) => res.data),
  });

  const lines: ProductionLine[] = linesQuery.data?.data ?? [];
  const boms: ProductionBom[] = bomsQuery.data?.data ?? [];
  const overview = overviewQuery.data?.data;
  const materialOrder = materialOrderId ? detailQuery.data : null;

  const invalidateOrders = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "orders"] });
    queryClient.invalidateQueries({ queryKey: ["production", "overview"] });
    queryClient.invalidateQueries({ queryKey: ["production", "order"] });
  }, [queryClient]);

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (tableQuery.search.trim()) params.set("search", tableQuery.search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (qaFilter !== "all") params.set("qa_status", qaFilter);
    if (lineFilter) params.set("line_id", lineFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (openOnly) params.set("open_only", "1");
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (inspectOrderId) params.set("order_id", String(inspectOrderId));
    if (createOpen) params.set("add", "1");
    if (tableQuery.page > 1) params.set("page", String(tableQuery.page));
    if (tableQuery.pageSize !== DEFAULT_QUERY.pageSize) params.set("limit", String(tableQuery.pageSize));
    if (tableQuery.sortCol !== DEFAULT_QUERY.sortCol) params.set("sort_col", tableQuery.sortCol);
    if (tableQuery.sortDir !== DEFAULT_QUERY.sortDir) params.set("sort_dir", tableQuery.sortDir);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    createOpen,
    fromDate,
    inspectOrderId,
    lineFilter,
    openOnly,
    pathname,
    priorityFilter,
    qaFilter,
    router,
    statusFilter,
    tableQuery,
    toDate,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setTableQuery((current) => ({ ...current, page: 1 }));
  }, [statusFilter, qaFilter, lineFilter, priorityFilter, openOnly, fromDate, toDate]);

  React.useEffect(() => {
    if (searchParams.get("add") === "1" && canCreate) setCreateOpen(true);
  }, [searchParams, canCreate]);

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [inspectOrderId]);

  React.useEffect(() => {
    if (!inspectOrderId || deepLinkHandled.current || !ordersQuery.data) return;
    const match = ordersQuery.data.data?.find((item: ProductionOrder) => item.id === inspectOrderId);
    if (!match) return;
    deepLinkHandled.current = true;
    window.setTimeout(() => {
      document
        .querySelector(`[data-order-id="${inspectOrderId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [inspectOrderId, ordersQuery.data]);

  const createMutation = useMutation({
    mutationFn: () => productionApi.createOrder(orderPayloadFromForm(form)),
    onSuccess: (response) => {
      const order = response?.data?.data as ProductionOrder | undefined;
      toast.success(
        order
          ? t("production.orders.created_with_lot", "Work order {number} created with lot {batch}.")
              .replace("{number}", order.order_number)
              .replace("{batch}", order.batch_number)
          : t("production.orders.created", "Work order created."),
      );
      invalidateOrders();
      setCreateOpen(false);
      setForm(emptyOrderForm());
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, t("production.orders.create_failed", "Could not create the work order."))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      productionApi.updateOrder(id, payload),
    onSuccess: () => {
      toast.success(t("production.orders.updated", "Work order updated."));
      invalidateOrders();
      setEditingOrder(null);
      setForm(emptyOrderForm());
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, t("production.orders.update_failed", "Could not update the work order."))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productionApi.deleteOrder(id),
    onSuccess: () => {
      toast.success(t("production.orders.deleted", "Draft work order deleted."));
      invalidateOrders();
      setDeleteOrder(null);
      setInspectOrderId(null);
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, t("production.orders.delete_failed", "Could not delete the work order."))),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      productionApi.transitionOrder(id, status),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("production.orders.status_updated", "Status updated."));
      invalidateOrders();
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, t("production.orders.status_failed", "Could not change the status."))),
  });

  const materialMutation = useMutation({
    mutationFn: () =>
      productionApi.issueMaterial(materialOrderId!, {
        component_product_id: Number(materialForm.component_product_id),
        actual_quantity: Number(materialForm.actual_quantity),
        supplier_batch_number: materialForm.supplier_batch_number || undefined,
        from_location_id: materialForm.from_location_id
          ? Number(materialForm.from_location_id)
          : undefined,
      }),
    onSuccess: () => {
      toast.success(t("production.orders.material_issued", "Material issue recorded."));
      invalidateOrders();
      setMaterialOrderId(null);
      setMaterialForm(DEFAULT_MATERIAL_FORM);
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, t("production.orders.material_failed", "Could not record the issue."))),
  });

  const qaMutation = useMutation({
    mutationFn: () =>
      productionApi.recordQaDecision(qaOrder!.id, {
        decision: qaDecision,
        notes: qaNotes || undefined,
      }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("production.orders.qa_recorded", "QA decision recorded."));
      invalidateOrders();
      setQaOrder(null);
      setQaNotes("");
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, t("production.orders.qa_failed", "Could not record the QA decision."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || DEFAULT_QUERY.pageSize),
      search: String(query.search ?? ""),
      sortCol: String(query.sortCol || "scheduled_start_at"),
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
    });
  }, []);

  const filtersActive = hasActiveOrderFilters({
    search: tableQuery.search,
    status: statusFilter,
    qaStatus: qaFilter,
    lineId: lineFilter,
    priority: priorityFilter,
    openOnly,
    from: fromDate,
    to: toDate,
  });

  const refetching = ordersQuery.isFetching && !ordersQuery.isLoading;

  const clearFilters = () => {
    setStatusFilter("all");
    setQaFilter("all");
    setLineFilter("");
    setPriorityFilter("all");
    setOpenOnly(false);
    setFromDate("");
    setToDate("");
    setTableQuery((current) => ({ ...current, search: "", page: 1 }));
  };

  const exportUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    if (tableQuery.search) params.set("search", tableQuery.search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (qaFilter !== "all") params.set("qa_status", qaFilter);
    if (lineFilter) params.set("production_line_id", lineFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (openOnly) params.set("open_only", "1");
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    params.set("sort_col", tableQuery.sortCol);
    params.set("sort_dir", tableQuery.sortDir);
    return `/production/orders/export?${params.toString()}`;
  }, [fromDate, lineFilter, openOnly, priorityFilter, qaFilter, statusFilter, tableQuery, toDate]);

  const columns = React.useMemo<ColumnDef<ProductionOrder>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: t("production.orders.col_order", "Work Order"),
        cell: ({ row }) => (
          <button
            type="button"
            data-order-id={row.original.id}
            className="space-y-0.5 text-left hover:underline"
            onClick={() => setInspectOrderId(row.original.id)}
          >
            <p className="font-bold">{row.original.order_number}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {t("production.orders.lot", "Lot")} {row.original.batch_number}
            </p>
          </button>
        ),
      },
      {
        id: "product",
        header: t("production.common.product", "Product"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {row.original.product?.name ?? `#${row.original.product_id}`}
            </p>
            <p className="text-[11px] text-muted-foreground">{row.original.line?.name ?? "-"}</p>
          </div>
        ),
      },
      {
        accessorKey: "priority",
        header: t("production.common.priority", "Priority"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px] uppercase">
            {row.original.priority}
          </Badge>
        ),
      },
      {
        id: "quantity",
        header: t("production.orders.col_output", "Planned / Produced"),
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div className="space-y-0.5 tabular-nums">
              <p className="text-sm">
                {Number(order.planned_quantity).toLocaleString()} →{" "}
                {Number(order.produced_quantity).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("production.orders.yield", "Yield")} {order.yield_percent}% ·{" "}
                {Number(order.rejected_quantity).toLocaleString()}{" "}
                {t("production.overview.rejected", "rejected")}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("production.common.status", "Status"),
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "qa_status",
        header: t("production.common.qa", "QA"),
        cell: ({ row }) => <QaStatusBadge status={row.original.qa_status} />,
      },
      {
        accessorKey: "scheduled_start_at",
        header: t("production.orders.col_schedule", "Schedule"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.scheduled_start_at?.slice(0, 16).replace("T", " ") ?? "-"}</p>
            <p className="text-muted-foreground">
              {row.original.manufactured_on ?? "-"} / {row.original.expires_on ?? "-"}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        header: t("production.common.actions", "Actions"),
        cell: ({ row }) => {
          const order = row.original;
          const nextStatuses = (NEXT_STATUSES[order.status] ?? []).filter((status) =>
            canTransitionTo(status),
          );

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {nextStatuses.length > 0 ? (
                <Select
                  value=""
                  onValueChange={(status) => transitionMutation.mutate({ id: order.id, status })}
                >
                  <SelectTrigger className="h-8 w-[8.5rem] text-xs">
                    <SelectValue placeholder={t("production.orders.move_to", "Move to...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {nextStatuses.map((status) => (
                      <SelectItem key={status} value={status} className="text-xs">
                        {humaniseStatus(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {canIssue ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    setMaterialOrderId(order.id);
                    setMaterialForm(DEFAULT_MATERIAL_FORM);
                  }}
                >
                  <PackagePlus className="h-3 w-3" />
                  {t("production.orders.issue", "Issue")}
                </Button>
              ) : null}

              {canQa ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    setQaOrder(order);
                    setQaDecision("released");
                    setQaNotes(order.qa_notes ?? "");
                  }}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {t("production.orders.qa", "QA")}
                </Button>
              ) : null}

              {canEdit && canEditOrder(order) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setEditingOrder(order);
                    setForm(orderToForm(order));
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canEdit, canIssue, canQa, canTransitionTo, t, transitionMutation],
  );

  const inspectOrder = detailQuery.data && inspectOrderId ? detailQuery.data : null;

  return (
    <ProductionShell
      title={t("production.orders.title", "Work Orders")}
      description={t(
        "production.orders.subtitle",
        "Each order carries the lot code printed on the bottle and holds its batch until QA releases it.",
      )}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              ordersQuery.refetch();
              overviewQuery.refetch();
              linesQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            {t("production.common.refresh", "Refresh")}
          </Button>
          {canCreate ? (
            <Button
              type="button"
              onClick={() => {
                setForm(emptyOrderForm());
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("production.orders.add_btn", "New Work Order")}
            </Button>
          ) : null}
        </div>
      }
    >
      {overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/dashboard/production/orders?open_only=1" className="block">
            <ProductionMetricCard
              title={t("production.overview.open_orders", "Open work orders")}
              value={overview.orders.open.toLocaleString()}
              description={t("production.overview.of_total", "of {total} in period").replace(
                "{total}",
                String(overview.orders.total),
              )}
            />
          </Link>
          <Link href="/dashboard/production/orders?qa_status=pending" className="block">
            <ProductionMetricCard
              title={t("production.overview.awaiting_qa", "Batches awaiting QA")}
              value={overview.orders.awaiting_qa.toLocaleString()}
              description={`${overview.orders.quarantined.toLocaleString()} ${t("production.overview.quarantined", "quarantined or rejected")}`}
            />
          </Link>
          <ProductionMetricCard
            title={t("production.overview.good_output", "Good output")}
            value={overview.oee.good_units.toLocaleString()}
            description={`${overview.oee.reject_units.toLocaleString()} ${t("production.overview.rejected", "rejected")}`}
          />
          <Link href="/dashboard/production/orders?status=completed" className="block">
            <ProductionMetricCard
              title={t("production.overview.completed_orders", "Completed orders")}
              value={overview.orders.completed.toLocaleString()}
              description={`${Number(overview.orders.produced_quantity).toLocaleString()} ${t("production.orders.units_produced", "units produced")}`}
            />
          </Link>
        </div>
      ) : overviewQuery.isLoading ? (
        <ProductionLoading />
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatusFilter)}>
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {ORDER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {humaniseStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.qa", "QA")}</Label>
          <Select value={qaFilter} onValueChange={(value) => setQaFilter(value as QaStatusFilter)}>
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {QA_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {humaniseStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.line", "Line")}</Label>
          <Select value={lineFilter || "all"} onValueChange={(value) => setLineFilter(value === "all" ? "" : value)}>
            <SelectTrigger className="h-9 w-[11rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all_lines", "All lines")}</SelectItem>
              {lines.map((line) => (
                <SelectItem key={line.id} value={String(line.id)}>
                  {line.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.priority", "Priority")}</Label>
          <Select
            value={priorityFilter}
            onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}
          >
            <SelectTrigger className="h-9 w-[9rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="orders-from" className="text-xs">
            {t("production.common.from", "From")}
          </Label>
          <Input
            id="orders-from"
            type="date"
            className="h-9 w-36"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="orders-to" className="text-xs">
            {t("production.common.to", "To")}
          </Label>
          <Input
            id="orders-to"
            type="date"
            className="h-9 w-36"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
            className="rounded border-input"
          />
          {t("production.orders.open_only", "Open only")}
        </label>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("production.common.clear_filters", "Clear filters")}
          </Button>
        ) : null}
      </div>

      {ordersQuery.isLoading ? (
        <ProductionLoading cards={2} />
      ) : ordersQuery.error ? (
        <div className="space-y-3">
          <ProductionError error={ordersQuery.error} />
          <Button variant="outline" size="sm" onClick={() => ordersQuery.refetch()}>
            {t("production.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={(ordersQuery.data?.data ?? []) as ProductionOrder[]}
          totalEntries={ordersQuery.data?.meta?.total ?? 0}
          loading={ordersQuery.isFetching}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t(
            "production.orders.search_placeholder",
            "Search by order number or lot code...",
          )}
          resourceName="production-orders"
          syncWithUrl={false}
          defaultSearch={tableQuery.search}
          defaultSortCol={tableQuery.sortCol}
          defaultSortDir={tableQuery.sortDir}
          onRefresh={() => ordersQuery.refetch()}
          exportEndpoint={canExport ? exportUrl : undefined}
          getRowId={(row) => String(row.id)}
        />
      )}

      <OrderFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("production.orders.create_title", "New Work Order")}
        description={t(
          "production.orders.create_desc",
          "The order number and lot code are allocated automatically, and the bill of materials is exploded against the planned quantity.",
        )}
        form={form}
        setForm={setForm}
        lines={lines}
        boms={boms}
        busy={createMutation.isPending}
        submitLabel={t("production.orders.create", "Create Work Order")}
        onSubmit={() => {
          if (!form.product_id || !form.planned_quantity) {
            toast.error(
              t("production.orders.required_fields", "Finished product and planned quantity are required."),
            );
            return;
          }
          createMutation.mutate();
        }}
      />

      <OrderFormDialog
        open={editingOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingOrder(null);
            setForm(emptyOrderForm());
          }
        }}
        title={t("production.orders.edit_title", "Edit work order")}
        description={t(
          "production.orders.edit_desc",
          "Update schedule, line, quantity, or BOM before the order is completed or cancelled.",
        )}
        form={form}
        setForm={setForm}
        lines={lines}
        boms={boms}
        busy={updateMutation.isPending}
        productReadOnly
        submitLabel={t("production.orders.save_changes", "Save changes")}
        onSubmit={() => {
          if (!editingOrder) return;
          updateMutation.mutate({ id: editingOrder.id, payload: editPayloadFromForm(form) });
        }}
      />

      <Dialog open={inspectOrderId !== null} onOpenChange={(open) => !open && setInspectOrderId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem]">
          {detailQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("production.common.loading", "Loading...")}
            </div>
          ) : inspectOrder ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {inspectOrder.order_number} · {inspectOrder.batch_number}
                </DialogTitle>
                <DialogDescription>
                  {inspectOrder.product?.name ?? `#${inspectOrder.product_id}`} ·{" "}
                  {inspectOrder.line?.name ?? t("production.orders.no_line", "No line assigned")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t("production.common.status", "Status")}</span>
                  <div className="mt-1">
                    <OrderStatusBadge status={inspectOrder.status} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("production.common.qa", "QA")}</span>
                  <div className="mt-1">
                    <QaStatusBadge status={inspectOrder.qa_status} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("production.orders.planned_quantity", "Planned")}</span>
                  <p className="font-medium tabular-nums">{Number(inspectOrder.planned_quantity).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("production.orders.produced", "Produced")}</span>
                  <p className="font-medium tabular-nums">
                    {Number(inspectOrder.produced_quantity).toLocaleString()} ({inspectOrder.yield_percent}%)
                  </p>
                </div>
                {inspectOrder.bom ? (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">{t("production.common.bom", "Bill of Materials")}</span>
                    <p>
                      <Link
                        href={`/dashboard/production/boms?bom_id=${inspectOrder.bom.id}`}
                        className="font-medium hover:underline"
                      >
                        {inspectOrder.bom.code} — {inspectOrder.bom.name}
                      </Link>
                    </p>
                  </div>
                ) : null}
                {inspectOrder.notes ? (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">{t("production.common.notes", "Notes")}</span>
                    <p>{inspectOrder.notes}</p>
                  </div>
                ) : null}
              </div>
              {(inspectOrder.consumptions?.length ?? 0) > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    {t("production.orders.materials", "Material plan")}
                  </p>
                  <ul className="space-y-1 text-sm">
                    {inspectOrder.consumptions?.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3">
                        <span>
                          {item.component?.name ?? `#${item.component_product_id}`} ({item.component_type})
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {Number(item.actual_quantity).toLocaleString()} / {Number(item.planned_quantity).toLocaleString()}{" "}
                          {item.uom}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {(inspectOrder.runs?.length ?? 0) > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-semibold">{t("production.orders.shift_runs", "Shift runs")}</p>
                  <ul className="space-y-1 text-sm">
                    {inspectOrder.runs?.map((run) => (
                      <li key={run.id}>
                        <Link
                          href={`/dashboard/production/runs?order_id=${inspectOrder.id}`}
                          className="hover:underline"
                        >
                          {run.shift} · {Number(run.good_units).toLocaleString()} good
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <DialogFooter className="flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/production/traceability?batch=${encodeURIComponent(inspectOrder.batch_number)}`}>
                    <ScrollText className="mr-1 h-3.5 w-3.5" />
                    {t("production.orders.trace_batch", "Trace batch")}
                    <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
                {canEdit && canEditOrder(inspectOrder) ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingOrder(inspectOrder);
                      setForm(orderToForm(inspectOrder));
                      setInspectOrderId(null);
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    {t("production.orders.edit", "Edit")}
                  </Button>
                ) : null}
                {canDelete && inspectOrder.status === "draft" ? (
                  <Button size="sm" variant="destructive" onClick={() => setDeleteOrder(inspectOrder)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {t("production.orders.delete_draft", "Delete draft")}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : (
            <ProductionError error={detailQuery.error} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={materialOrderId !== null} onOpenChange={(open) => !open && setMaterialOrderId(null)}>
        <DialogContent className="sm:max-w-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>{t("production.orders.issue_title", "Issue Material to the Line")}</DialogTitle>
            <DialogDescription>
              {t(
                "production.orders.issue_desc",
                "Recording the supplier lot here is what lets a cap or preform defect be traced back upstream later.",
              )}
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading && materialOrderId ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("production.common.loading", "Loading...")}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("production.orders.component", "Component")}</Label>
                <Select
                  value={materialForm.component_product_id}
                  onValueChange={(value) =>
                    setMaterialForm((prev) => ({ ...prev, component_product_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("production.orders.select_component", "Select a planned component")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(materialOrder?.consumptions ?? []).map((consumption) => (
                      <SelectItem key={consumption.id} value={String(consumption.component_product_id)}>
                        {consumption.component?.name ?? `#${consumption.component_product_id}`} (
                        {consumption.component_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ProductSearchPicker
                  value={materialForm.component_product_id}
                  onChange={(value) =>
                    setMaterialForm((prev) => ({ ...prev, component_product_id: value }))
                  }
                  enabled={materialOrderId !== null}
                  placeholder={t("production.orders.search_component", "Search any component product")}
                  emptyText={t(
                    "production.orders.no_products",
                    "No products found. Add one in Inventory → Products.",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue-qty">{t("production.orders.issued_quantity", "Quantity Issued")}</Label>
                <Input
                  id="issue-qty"
                  type="number"
                  step="0.0001"
                  value={materialForm.actual_quantity}
                  onChange={(event) =>
                    setMaterialForm((prev) => ({ ...prev, actual_quantity: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue-lot">{t("production.orders.supplier_lot", "Supplier Lot Number")}</Label>
                <Input
                  id="issue-lot"
                  value={materialForm.supplier_batch_number}
                  onChange={(event) =>
                    setMaterialForm((prev) => ({ ...prev, supplier_batch_number: event.target.value }))
                  }
                />
              </div>
              <LocationSearchPicker
                id="issue-location"
                label={t("production.orders.from_location", "From store location")}
                value={materialForm.from_location_id}
                onChange={(value) =>
                  setMaterialForm((prev) => ({ ...prev, from_location_id: value }))
                }
                enabled={materialOrderId !== null}
                allowClear
                placeholder={t("production.orders.pick_from_location", "Select source location")}
                emptyText={t(
                  "production.orders.no_locations",
                  "No locations found. Create a warehouse shelf or box first.",
                )}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialOrderId(null)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={materialMutation.isPending || detailQuery.isLoading}
              onClick={() => {
                if (!materialForm.component_product_id || !materialForm.actual_quantity) {
                  toast.error(t("production.orders.issue_required", "Component and quantity are required."));
                  return;
                }
                materialMutation.mutate();
              }}
            >
              {materialMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.orders.record_issue", "Record Issue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qaOrder !== null} onOpenChange={(open) => !open && setQaOrder(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>{t("production.orders.qa_title", "QA Decision")}</DialogTitle>
            <DialogDescription>
              {qaOrder
                ? t("production.orders.qa_desc", "Lot {batch} stays unsellable until it is released.").replace(
                    "{batch}",
                    qaOrder.batch_number,
                  )
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("production.orders.decision", "Decision")}</Label>
              <Select value={qaDecision} onValueChange={setQaDecision}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["in_test", "released", "quarantined", "rejected"].map((decision) => (
                    <SelectItem key={decision} value={decision}>
                      {humaniseStatus(decision)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa-notes">{t("production.common.notes", "Notes")}</Label>
              <Input
                id="qa-notes"
                value={qaNotes}
                onChange={(event) => setQaNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQaOrder(null)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button disabled={qaMutation.isPending} onClick={() => qaMutation.mutate()}>
              {qaMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.orders.record_decision", "Record Decision")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOrder !== null} onOpenChange={(open) => !open && setDeleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("production.orders.delete_confirm_title", "Delete draft order?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "production.orders.delete_confirm_desc",
                "This permanently removes the draft work order. Released or completed orders must be cancelled instead.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("production.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOrder && deleteMutation.mutate(deleteOrder.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("production.orders.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProductionShell>
  );
}

function OrderFormDialog({
  open,
  onOpenChange,
  title,
  description,
  form,
  setForm,
  lines,
  boms,
  busy,
  submitLabel,
  onSubmit,
  productReadOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  form: OrderForm;
  setForm: React.Dispatch<React.SetStateAction<OrderForm>>;
  lines: ProductionLine[];
  boms: ProductionBom[];
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  productReadOnly?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <ProductSearchPicker
            id="wo-product"
            label={t("production.orders.finished_product", "Finished product")}
            value={form.product_id}
            onChange={(value) => setForm((prev) => ({ ...prev, product_id: value }))}
            disabled={productReadOnly}
            enabled={open}
            placeholder={t("production.orders.pick_product", "Select finished product")}
            emptyText={t(
              "production.orders.no_products",
              "No products found. Add one in Inventory → Products.",
            )}
          />
          <div className="space-y-2">
            <Label>{t("production.common.bom", "Bill of Materials")}</Label>
            <Select value={form.bom_id} onValueChange={(value) => setForm((prev) => ({ ...prev, bom_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={t("production.orders.bom_auto", "Use the active BOM")} />
              </SelectTrigger>
              <SelectContent>
                {boms.map((bom) => (
                  <SelectItem key={bom.id} value={String(bom.id)}>
                    {bom.code} — {bom.name} (v{bom.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("production.common.line", "Line")}</Label>
            <Select
              value={form.production_line_id}
              onValueChange={(value) => setForm((prev) => ({ ...prev, production_line_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("production.orders.select_line", "Select a line")} />
              </SelectTrigger>
              <SelectContent>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={String(line.id)}>
                    {line.code} — {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wo-quantity">{t("production.orders.planned_quantity", "Planned Quantity")}</Label>
            <Input
              id="wo-quantity"
              type="number"
              min="1"
              value={form.planned_quantity}
              onChange={(event) => setForm((prev) => ({ ...prev, planned_quantity: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wo-start">{t("production.orders.scheduled_start", "Scheduled Start")}</Label>
            <Input
              id="wo-start"
              type="datetime-local"
              value={form.scheduled_start_at}
              onChange={(event) => setForm((prev) => ({ ...prev, scheduled_start_at: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wo-end">{t("production.orders.scheduled_end", "Scheduled End")}</Label>
            <Input
              id="wo-end"
              type="datetime-local"
              value={form.scheduled_end_at}
              onChange={(event) => setForm((prev) => ({ ...prev, scheduled_end_at: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("production.common.priority", "Priority")}</Label>
            <Select
              value={form.priority}
              onValueChange={(value: OrderForm["priority"]) => setForm((prev) => ({ ...prev, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wo-manufactured">{t("production.orders.manufactured_on", "Manufactured on")}</Label>
            <Input
              id="wo-manufactured"
              type="date"
              value={form.manufactured_on}
              onChange={(event) => setForm((prev) => ({ ...prev, manufactured_on: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wo-expires">{t("production.orders.expires_on", "Expires on")}</Label>
            <Input
              id="wo-expires"
              type="date"
              value={form.expires_on}
              onChange={(event) => setForm((prev) => ({ ...prev, expires_on: event.target.value }))}
            />
          </div>
          <WarehouseSearchPicker
            id="wo-warehouse"
            label={t("production.orders.output_warehouse", "Output warehouse")}
            value={form.output_warehouse_id}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                output_warehouse_id: value,
                output_location_id:
                  prev.output_location_id && value !== prev.output_warehouse_id
                    ? ""
                    : prev.output_location_id,
              }))
            }
            enabled={open}
            allowClear
            placeholder={t("production.orders.pick_warehouse", "Select output warehouse")}
            emptyText={t(
              "production.orders.no_warehouses",
              "No warehouses found. Create one in Warehouse → Sites.",
            )}
          />
          <LocationSearchPicker
            id="wo-location"
            label={t("production.orders.output_location", "Finished goods location")}
            value={form.output_location_id}
            onChange={(value) => setForm((prev) => ({ ...prev, output_location_id: value }))}
            warehouseId={form.output_warehouse_id || undefined}
            enabled={open}
            allowClear
            placeholder={t("production.orders.pick_output_location", "Select finished goods location")}
            emptyText={t(
              "production.orders.no_locations",
              "No locations found. Create a warehouse shelf or box first.",
            )}
          />
          <div className="space-y-2">
            <Label htmlFor="wo-uom">{t("production.common.uom", "Unit")}</Label>
            <Input
              id="wo-uom"
              value={form.uom}
              onChange={(event) => setForm((prev) => ({ ...prev, uom: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="wo-notes">{t("production.common.notes", "Notes")}</Label>
            <Input
              id="wo-notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("production.common.cancel", "Cancel")}
          </Button>
          <Button disabled={busy} onClick={onSubmit}>
            <BusyLabel busy={busy}>{submitLabel}</BusyLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
