"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackagePlus, Plus, ShieldCheck } from "lucide-react";
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
import { productionApi } from "@/modules/production/api";
import type { ProductionBom, ProductionLine, ProductionOrder } from "@/modules/production/types";
import { OrderStatusBadge, QaStatusBadge } from "@/modules/production/components/status-badges";

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "scheduled_start_at",
  sortDir: "desc",
};

/**
 * The next status a supervisor can move an order to, mirroring the server's
 * state machine. Anything the server would reject is never offered.
 */
const NEXT_STATUSES: Record<string, string[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["released", "draft", "cancelled"],
  released: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["on_hold", "completed", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

type OrderForm = {
  product_id: string;
  bom_id: string;
  production_line_id: string;
  planned_quantity: string;
  uom: string;
  priority: "low" | "normal" | "high" | "urgent";
  scheduled_start_at: string;
  output_location_id: string;
  notes: string;
};

const DEFAULT_ORDER_FORM: OrderForm = {
  product_id: "",
  bom_id: "",
  production_line_id: "",
  planned_quantity: "",
  uom: "pcs",
  priority: "normal",
  scheduled_start_at: "",
  output_location_id: "",
  notes: "",
};

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
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [qaFilter, setQaFilter] = React.useState("all");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<OrderForm>(DEFAULT_ORDER_FORM);

  const [materialOrder, setMaterialOrder] = React.useState<ProductionOrder | null>(null);
  const [materialForm, setMaterialForm] = React.useState<MaterialForm>(DEFAULT_MATERIAL_FORM);

  const [qaOrder, setQaOrder] = React.useState<ProductionOrder | null>(null);
  const [qaDecision, setQaDecision] = React.useState("released");
  const [qaNotes, setQaNotes] = React.useState("");

  const ordersQuery = useQuery({
    queryKey: ["production", "orders", tableQuery, statusFilter, qaFilter],
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
        })
        .then((res) => res.data),
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

  const invalidateOrders = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "orders"] });
    queryClient.invalidateQueries({ queryKey: ["production", "overview"] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: () =>
      productionApi.createOrder({
        product_id: Number(form.product_id),
        bom_id: form.bom_id ? Number(form.bom_id) : undefined,
        production_line_id: form.production_line_id ? Number(form.production_line_id) : undefined,
        planned_quantity: Number(form.planned_quantity),
        uom: form.uom || "pcs",
        priority: form.priority,
        scheduled_start_at: form.scheduled_start_at || undefined,
        output_location_id: form.output_location_id ? Number(form.output_location_id) : undefined,
        notes: form.notes || undefined,
      }),
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
      setForm(DEFAULT_ORDER_FORM);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.orders.create_failed", "Could not create the work order."));
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => productionApi.transitionOrder(id, status),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("production.orders.status_updated", "Status updated."));
      invalidateOrders();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.orders.status_failed", "Could not change the status."));
    },
  });

  const materialMutation = useMutation({
    mutationFn: () =>
      productionApi.issueMaterial(materialOrder!.id, {
        component_product_id: Number(materialForm.component_product_id),
        actual_quantity: Number(materialForm.actual_quantity),
        supplier_batch_number: materialForm.supplier_batch_number || undefined,
        from_location_id: materialForm.from_location_id ? Number(materialForm.from_location_id) : undefined,
      }),
    onSuccess: () => {
      toast.success(t("production.orders.material_issued", "Material issue recorded."));
      invalidateOrders();
      setMaterialOrder(null);
      setMaterialForm(DEFAULT_MATERIAL_FORM);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.orders.material_failed", "Could not record the issue."));
    },
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
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.orders.qa_failed", "Could not record the QA decision."));
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
      sortCol: String(query.sortCol || "scheduled_start_at"),
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
    });
  }, []);

  const columns = React.useMemo<ColumnDef<ProductionOrder>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: t("production.orders.col_order", "Work Order"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.order_number}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {t("production.orders.lot", "Lot")} {row.original.batch_number}
            </p>
          </div>
        ),
      },
      {
        id: "product",
        header: t("production.common.product", "Product"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{row.original.product?.name ?? `#${row.original.product_id}`}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.line?.name ?? "-"}</p>
          </div>
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
                {Number(order.planned_quantity).toLocaleString()} → {Number(order.produced_quantity).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("production.orders.yield", "Yield")} {order.yield_percent}% ·{" "}
                {Number(order.rejected_quantity).toLocaleString()} {t("production.overview.rejected", "rejected")}
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
        accessorKey: "expires_on",
        header: t("production.orders.col_dates", "Made / Expires"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.manufactured_on ?? "-"}</p>
            <p className="text-muted-foreground">{row.original.expires_on ?? "-"}</p>
          </div>
        ),
      },
      {
        id: "actions",
        header: t("production.common.actions", "Actions"),
        cell: ({ row }) => {
          const order = row.original;
          const nextStatuses = NEXT_STATUSES[order.status] ?? [];

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
                        {status.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  setMaterialOrder(order);
                  setMaterialForm(DEFAULT_MATERIAL_FORM);
                }}
              >
                <PackagePlus className="h-3 w-3" />
                {t("production.orders.issue", "Issue")}
              </Button>

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
            </div>
          );
        },
      },
    ],
    [t, transitionMutation],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("production.orders.title", "Work Orders")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "production.orders.subtitle",
              "Each order carries the lot code printed on the bottle and holds its batch until QA releases it.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setForm(DEFAULT_ORDER_FORM);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("production.orders.add_btn", "New Work Order")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {Object.keys(NEXT_STATUSES).map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.qa", "QA")}</Label>
          <Select value={qaFilter} onValueChange={setQaFilter}>
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {["pending", "in_test", "released", "quarantined", "rejected"].map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={(ordersQuery.data?.data ?? []) as ProductionOrder[]}
        totalEntries={ordersQuery.data?.meta?.total ?? 0}
        loading={ordersQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("production.orders.search_placeholder", "Search by order number or lot code...")}
        resourceName="production-orders"
      />

      {/* Create work order */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("production.orders.create_title", "New Work Order")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "production.orders.create_desc",
                  "The order number and lot code are allocated automatically, and the bill of materials is exploded against the planned quantity.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wo-product">{t("production.common.product_id", "Finished Product ID")}</Label>
              <Input
                id="wo-product"
                type="number"
                value={form.product_id}
                onChange={(event) => setForm((prev) => ({ ...prev, product_id: event.target.value }))}
                placeholder="e.g. 42"
              />
            </div>
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
                placeholder="24000"
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
              <Label>{t("production.common.priority", "Priority")}</Label>
              <Select
                value={form.priority}
                onValueChange={(value: OrderForm["priority"]) => setForm((prev) => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["low", "normal", "high", "urgent"].map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-location">
                {t("production.orders.output_location", "Finished Goods Location ID")}
              </Label>
              <Input
                id="wo-location"
                type="number"
                value={form.output_location_id}
                onChange={(event) => setForm((prev) => ({ ...prev, output_location_id: event.target.value }))}
                placeholder={t("production.orders.optional", "Optional")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-uom">{t("production.common.uom", "Unit")}</Label>
              <Input
                id="wo-uom"
                value={form.uom}
                onChange={(event) => setForm((prev) => ({ ...prev, uom: event.target.value }))}
                placeholder="pcs"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="wo-notes">{t("production.common.notes", "Notes")}</Label>
              <Input
                id="wo-notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder={t("production.orders.notes_placeholder", "Optional notes for the shift team...")}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setCreateOpen(false)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={createMutation.isPending}
              onClick={() => {
                if (!form.product_id || !form.planned_quantity) {
                  toast.error(
                    t("production.orders.required_fields", "Finished product and planned quantity are required."),
                  );
                  return;
                }
                createMutation.mutate();
              }}
            >
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.orders.create", "Create Work Order")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue material */}
      <Dialog open={materialOrder !== null} onOpenChange={(open) => !open && setMaterialOrder(null)}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("production.orders.issue_title", "Issue Material to the Line")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "production.orders.issue_desc",
                  "Recording the supplier lot here is what lets a cap or preform defect be traced back upstream later.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("production.orders.component", "Component")}</Label>
              <Select
                value={materialForm.component_product_id}
                onValueChange={(value) => setMaterialForm((prev) => ({ ...prev, component_product_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("production.orders.select_component", "Select a planned component")} />
                </SelectTrigger>
                <SelectContent>
                  {(materialOrder?.consumptions ?? []).map((consumption) => (
                    <SelectItem key={consumption.id} value={String(consumption.component_product_id)}>
                      {consumption.component?.name ?? `#${consumption.component_product_id}`} ({consumption.component_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {t("production.orders.component_hint", "Not listed? Type the product ID below instead.")}
              </p>
              <Input
                type="number"
                value={materialForm.component_product_id}
                onChange={(event) =>
                  setMaterialForm((prev) => ({ ...prev, component_product_id: event.target.value }))
                }
                placeholder={t("production.common.product_id", "Product ID")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-qty">{t("production.orders.issued_quantity", "Quantity Issued")}</Label>
              <Input
                id="issue-qty"
                type="number"
                step="0.0001"
                value={materialForm.actual_quantity}
                onChange={(event) => setMaterialForm((prev) => ({ ...prev, actual_quantity: event.target.value }))}
                placeholder="24800"
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
                placeholder="PF-IMP-2026-014"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-location">{t("production.orders.from_location", "From Store Location ID")}</Label>
              <Input
                id="issue-location"
                type="number"
                value={materialForm.from_location_id}
                onChange={(event) => setMaterialForm((prev) => ({ ...prev, from_location_id: event.target.value }))}
                placeholder={t(
                  "production.orders.from_location_hint",
                  "Optional — set it to also post the stock issue",
                )}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setMaterialOrder(null)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={materialMutation.isPending}
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

      {/* QA decision */}
      <Dialog open={qaOrder !== null} onOpenChange={(open) => !open && setQaOrder(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("production.orders.qa_title", "QA Decision")}
              </DialogTitle>
              <DialogDescription>
                {qaOrder
                  ? t("production.orders.qa_desc", "Lot {batch} stays unsellable until it is released.").replace(
                      "{batch}",
                      qaOrder.batch_number,
                    )
                  : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label>{t("production.orders.decision", "Decision")}</Label>
              <Select value={qaDecision} onValueChange={setQaDecision}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["in_test", "released", "quarantined", "rejected"].map((decision) => (
                    <SelectItem key={decision} value={decision}>
                      {decision.replace(/_/g, " ")}
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
                placeholder={t("production.orders.qa_notes_placeholder", "Reference the release test results...")}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setQaOrder(null)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button className="rounded-full" disabled={qaMutation.isPending} onClick={() => qaMutation.mutate()}>
              {qaMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.orders.record_decision", "Record Decision")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
