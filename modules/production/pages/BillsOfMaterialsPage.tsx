"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ProductionBom, ProductionBomItem } from "@/modules/production/types";
import {
  BusyLabel,
  ProductionError,
  ProductionLoading,
  ProductionMetricCard,
  ProductionShell,
} from "@/modules/production/components/production-shell";
import { errorText } from "../utils";
import { ProductSearchPicker } from "./orders-pickers";

const COMPONENT_TYPES = [
  "preform",
  "cap",
  "label",
  "shrink_film",
  "carton",
  "pallet",
  "chemical",
  "water",
  "other",
] as const;

type BomStatus = "draft" | "active" | "archived";
type BomStatusFilter = BomStatus | "all";

type ItemDraft = {
  component_product_id: string;
  component_type: string;
  quantity_per_unit: string;
  uom: string;
  scrap_percent: string;
  is_critical: boolean;
  notes: string;
};

type BomForm = {
  id?: number;
  product_id: string;
  name: string;
  code: string;
  version: string;
  pack_size_ml: string;
  units_per_pack: string;
  water_litres_per_unit: string;
  expected_yield_percent: string;
  shelf_life_days: string;
  effective_from: string;
  notes: string;
  items: ItemDraft[];
};

const EMPTY_ITEM: ItemDraft = {
  component_product_id: "",
  component_type: "preform",
  quantity_per_unit: "1",
  uom: "pcs",
  scrap_percent: "0",
  is_critical: false,
  notes: "",
};

const DEFAULT_BOM_FORM: BomForm = {
  product_id: "",
  name: "",
  code: "",
  version: "1",
  pack_size_ml: "500",
  units_per_pack: "12",
  water_litres_per_unit: "0.52",
  expected_yield_percent: "98",
  shelf_life_days: "365",
  effective_from: "",
  notes: "",
  items: [{ ...EMPTY_ITEM }],
};

function bomToForm(bom: ProductionBom): BomForm {
  return {
    id: bom.id,
    product_id: String(bom.product_id),
    name: bom.name,
    code: bom.code,
    version: String(bom.version),
    pack_size_ml: String(bom.pack_size_ml),
    units_per_pack: String(bom.units_per_pack),
    water_litres_per_unit: String(bom.water_litres_per_unit),
    expected_yield_percent: String(bom.expected_yield_percent),
    shelf_life_days: bom.shelf_life_days ? String(bom.shelf_life_days) : "",
    effective_from: bom.effective_from ?? "",
    notes: bom.notes ?? "",
    items: (bom.items ?? []).map((item) => ({
      component_product_id: String(item.component_product_id),
      component_type: item.component_type,
      quantity_per_unit: String(item.quantity_per_unit),
      uom: item.uom,
      scrap_percent: String(item.scrap_percent),
      is_critical: item.is_critical,
      notes: item.notes ?? "",
    })),
  };
}

function bomPayloadFromForm(form: BomForm): Record<string, unknown> {
  return {
    product_id: Number(form.product_id),
    name: form.name.trim(),
    code: form.code.trim(),
    version: Number(form.version || 1),
    pack_size_ml: Number(form.pack_size_ml || 0),
    units_per_pack: Number(form.units_per_pack || 1),
    water_litres_per_unit: Number(form.water_litres_per_unit || 0),
    expected_yield_percent: Number(form.expected_yield_percent || 100),
    shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : undefined,
    effective_from: form.effective_from || undefined,
    notes: form.notes || undefined,
    items: form.items
      .filter((item) => item.component_product_id)
      .map((item) => ({
        component_product_id: Number(item.component_product_id),
        component_type: item.component_type,
        quantity_per_unit: Number(item.quantity_per_unit || 0),
        uom: item.uom || "pcs",
        scrap_percent: Number(item.scrap_percent || 0),
        is_critical: item.is_critical,
        notes: item.notes || undefined,
      })),
  };
}

function hasActiveBomFilters(opts: {
  search: string;
  status: BomStatusFilter;
  productId: string;
}): boolean {
  return Boolean(opts.search.trim() || opts.status !== "all" || opts.productId);
}

function statusTone(status: BomStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "draft":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function effectiveQuantityPerUnit(item: Pick<ProductionBomItem, "quantity_per_unit" | "scrap_percent">): number {
  const qty = Number(item.quantity_per_unit ?? 0);
  const scrap = Number(item.scrap_percent ?? 0);
  return qty * (1 + scrap / 100);
}

function componentLabel(item: ProductionBomItem): string {
  return item.component?.name ?? `#${item.component_product_id}`;
}

const PAGE_SIZE = 15;

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: PAGE_SIZE,
  search: "",
  sortCol: "created_at",
  sortDir: "desc",
};

export default function BillsOfMaterialsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canView = hasAnyPermission([
    "view_production",
    "manage_production",
    "manage_bom",
    "manage_production_boms",
  ]);
  const canManage = hasAnyPermission(["manage_bom", "manage_production_boms", "manage_production"]);

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>({
    page: Number(searchParams.get("page") || DEFAULT_QUERY.page),
    pageSize: Number(searchParams.get("limit") || DEFAULT_QUERY.pageSize),
    search: searchParams.get("search") ?? DEFAULT_QUERY.search,
    sortCol: searchParams.get("sort_col") || DEFAULT_QUERY.sortCol,
    sortDir: searchParams.get("sort_dir") === "asc" ? "asc" : "desc",
  });
  const [statusFilter, setStatusFilter] = React.useState<BomStatusFilter>(
    (searchParams.get("status") as BomStatusFilter) || "all",
  );
  const [productFilter, setProductFilter] = React.useState(searchParams.get("product_id") ?? "");

  const [formOpen, setFormOpen] = React.useState(searchParams.get("add") === "1");
  const [form, setForm] = React.useState<BomForm>(DEFAULT_BOM_FORM);
  const [inspectId, setInspectId] = React.useState<number | null>(
    searchParams.get("bom_id") ? Number(searchParams.get("bom_id")) : null,
  );
  const [activateTarget, setActivateTarget] = React.useState<ProductionBom | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ProductionBom | null>(null);

  const countQueries = useQueries({
    queries: (["active", "draft", "archived"] as const).map((status) => ({
      queryKey: ["production", "boms", "count", status],
      queryFn: () => productionApi.listBoms({ status, limit: 1 }).then((res) => res.data),
      enabled: canView,
    })),
  });

  const bomsQuery = useQuery({
    queryKey: ["production", "boms", tableQuery, statusFilter, productFilter],
    queryFn: () =>
      productionApi
        .listBoms({
          search: tableQuery.search || undefined,
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          sort_col: tableQuery.sortCol,
          sort_dir: tableQuery.sortDir,
          status: statusFilter === "all" ? undefined : statusFilter,
          product_id: productFilter ? Number(productFilter) : undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
    enabled: canView,
  });

  const inspectQuery = useQuery({
    queryKey: ["production", "boms", "detail", inspectId],
    queryFn: () => productionApi.getBom(inspectId!).then((res) => res.data.data as ProductionBom),
    enabled: inspectId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "boms"] });
  }, [queryClient]);

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (tableQuery.search.trim()) params.set("search", tableQuery.search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (productFilter) params.set("product_id", productFilter);
    if (inspectId) params.set("bom_id", String(inspectId));
    if (formOpen) params.set("add", "1");
    if (tableQuery.page > 1) params.set("page", String(tableQuery.page));
    if (tableQuery.pageSize !== DEFAULT_QUERY.pageSize) params.set("limit", String(tableQuery.pageSize));
    if (tableQuery.sortCol !== DEFAULT_QUERY.sortCol) params.set("sort_col", tableQuery.sortCol);
    if (tableQuery.sortDir !== DEFAULT_QUERY.sortDir) params.set("sort_dir", tableQuery.sortDir);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [formOpen, inspectId, pathname, productFilter, router, statusFilter, tableQuery]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setTableQuery((current) => ({ ...current, page: 1 }));
  }, [statusFilter, productFilter, tableQuery.search]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = bomPayloadFromForm(form);
      return form.id ? productionApi.updateBom(form.id, payload) : productionApi.createBom(payload);
    },
    onSuccess: () => {
      toast.success(t("production.boms.saved", "Bill of materials saved."));
      invalidate();
      setFormOpen(false);
      setForm(DEFAULT_BOM_FORM);
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.boms.save_failed", "Could not save the BOM.")));
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => productionApi.activateBom(activateTarget!.id),
    onSuccess: () => {
      toast.success(
        t(
          "production.boms.activated",
          "This version is now the active recipe; the previous one is archived.",
        ),
      );
      invalidate();
      setActivateTarget(null);
      if (inspectId === activateTarget?.id) inspectQuery.refetch();
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.boms.activate_failed", "Could not activate the BOM.")));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => productionApi.deleteBom(deleteTarget!.id),
    onSuccess: () => {
      toast.success(t("production.boms.deleted", "Bill of materials deleted."));
      invalidate();
      if (inspectId === deleteTarget?.id) setInspectId(null);
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.boms.delete_failed", "Could not delete the BOM.")));
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || DEFAULT_QUERY.pageSize),
      search: String(query.search ?? ""),
      sortCol: String(query.sortCol || DEFAULT_QUERY.sortCol),
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
    });
  }, []);

  const openCreate = () => {
    setForm(DEFAULT_BOM_FORM);
    setFormOpen(true);
  };

  const openEdit = (bom: ProductionBom) => {
    setForm(bomToForm(bom));
    setFormOpen(true);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setProductFilter("");
    setTableQuery((current) => ({ ...current, search: "", page: 1 }));
  };

  const filtersActive = hasActiveBomFilters({
    search: tableQuery.search,
    status: statusFilter,
    productId: productFilter,
  });

  const [activeCount, draftCount, archivedCount] = countQueries.map((query) => query.data?.meta?.total ?? 0);
  const inspectBom = inspectQuery.data;

  const columns = React.useMemo<ColumnDef<ProductionBom>[]>(
    () => [
      {
        accessorKey: "code",
        header: t("production.boms.col_bom", "Recipe"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left hover:underline"
            onClick={() => setInspectId(row.original.id)}
          >
            <p className="font-bold">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {row.original.code} · v{row.original.version}
            </p>
          </button>
        ),
      },
      {
        id: "product",
        header: t("production.common.product", "Product"),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.product?.name ?? `#${row.original.product_id}`}</span>
        ),
      },
      {
        id: "pack",
        header: t("production.boms.col_pack", "Pack"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p className="font-semibold">{Number(row.original.pack_size_ml).toLocaleString()} ml</p>
            <p className="text-muted-foreground">
              {row.original.units_per_pack} {t("production.boms.per_pack", "per pack")}
            </p>
          </div>
        ),
      },
      {
        id: "components",
        header: t("production.boms.col_components", "Components"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(row.original.items ?? []).slice(0, 4).map((item) => (
              <Badge key={item.id} variant="secondary" className="text-[10px] font-bold">
                {item.component_type}
              </Badge>
            ))}
            {(row.original.items ?? []).length > 4 ? (
              <Badge variant="outline" className="text-[10px]">
                +{(row.original.items ?? []).length - 4}
              </Badge>
            ) : null}
            {(row.original.items ?? []).length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "expected_yield_percent",
        header: t("production.boms.expected_yield", "Yield"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums font-semibold">
            {Number(row.original.expected_yield_percent).toFixed(1)}%
          </span>
        ),
      },
      {
        accessorKey: "water_litres_per_unit",
        header: t("production.boms.col_water", "Water / unit"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{Number(row.original.water_litres_per_unit).toFixed(3)} L</span>
        ),
      },
      {
        accessorKey: "status",
        header: t("production.common.status", "Status"),
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge
              variant="outline"
              className={`border-transparent text-[11px] font-black uppercase tracking-widest ${statusTone(status)}`}
            >
              {status}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("production.common.actions", "Actions"),
        cell: ({ row }) => {
          const bom = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setInspectId(bom.id)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {canManage ? (
                <>
                  {bom.status !== "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setActivateTarget(bom)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {t("production.boms.activate", "Activate")}
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => openEdit(bom)}>
                    <Pencil className="h-3 w-3" />
                    {t("production.common.edit", "Edit")}
                  </Button>
                  {bom.status !== "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => setDeleteTarget(bom)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canManage, t],
  );

  if (!canView) {
    return (
      <ProductionShell
        title={t("production.boms.title", "Bills of materials")}
        description={t(
          "production.boms.subtitle",
          "What one saleable bottle consumes — preform, cap, label, film, and treated water.",
        )}
      >
        <ProductionError
          error={{
            response: {
              data: {
                message: t("production.common.no_permission", "You do not have permission to view this page."),
              },
            },
          }}
        />
      </ProductionShell>
    );
  }

  return (
    <ProductionShell
      title={t("production.boms.title", "Bills of materials")}
      description={t(
        "production.boms.subtitle",
        "The recipe behind every bottle — components, scrap allowance, water draw, and which version work orders explode against.",
      )}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => bomsQuery.refetch()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${bomsQuery.isFetching ? "animate-spin" : ""}`} />
            {t("production.common.refresh", "Refresh")}
          </Button>
          {canManage ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("production.boms.add_btn", "New recipe")}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <ProductionMetricCard
          title={t("production.boms.active_recipes", "Active recipes")}
          value={activeCount.toLocaleString()}
          description={t("production.boms.active_desc", "One per finished SKU — work orders use these")}
        />
        <ProductionMetricCard
          title={t("production.boms.drafts", "Drafts")}
          value={draftCount.toLocaleString()}
          description={t("production.boms.drafts_desc", "Being revised before activation")}
        />
        <ProductionMetricCard
          title={t("production.boms.archived", "Archived")}
          value={archivedCount.toLocaleString()}
          description={t("production.boms.archived_desc", "Superseded but kept for batch traceability")}
        />
      </div>

      <FilterBar filtersActive={filtersActive} onClear={clearFilters}>
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BomStatusFilter)}>
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {(["draft", "active", "archived"] as const).map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <ProductSearchPicker
            label={t("production.common.product", "Product")}
            value={productFilter}
            onChange={setProductFilter}
            allowClear
            placeholder={t("production.boms.filter_product", "Filter by finished product...")}
          />
        </div>
      </FilterBar>

      {bomsQuery.isError ? (
        <ProductionError error={bomsQuery.error} />
      ) : (
        <DataTable
          columns={columns}
          data={(bomsQuery.data?.data ?? []) as ProductionBom[]}
          totalEntries={bomsQuery.data?.meta?.total ?? 0}
          loading={bomsQuery.isFetching}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("production.boms.search_placeholder", "Search recipes...")}
          resourceName="production-boms"
          syncWithUrl={false}
          defaultSearch={tableQuery.search}
          onRefresh={() => bomsQuery.refetch()}
          getRowId={(row) => String(row.id)}
        />
      )}

      <BomFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        setForm={setForm}
        busy={saveMutation.isPending}
        onSubmit={() => {
          if (!form.product_id || !form.name.trim() || !form.code.trim()) {
            toast.error(t("production.boms.required_fields", "Product, name, and code are required."));
            return;
          }
          saveMutation.mutate();
        }}
      />

      <Dialog open={inspectId !== null} onOpenChange={(open) => !open && setInspectId(null)}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("production.boms.inspect_title", "Recipe detail")}</DialogTitle>
            <DialogDescription>
              {inspectBom ? `${inspectBom.code} · v${inspectBom.version}` : ""}
            </DialogDescription>
          </DialogHeader>
          {inspectQuery.isLoading ? (
            <ProductionLoading cards={2} />
          ) : inspectBom ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{inspectBom.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {inspectBom.product?.name ?? `#${inspectBom.product_id}`} ·{" "}
                    {Number(inspectBom.pack_size_ml).toLocaleString()} ml · {inspectBom.units_per_pack}{" "}
                    {t("production.boms.per_pack", "per pack")}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`border-transparent text-[11px] font-black uppercase tracking-widest ${statusTone(inspectBom.status)}`}
                >
                  {inspectBom.status}
                </Badge>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">{t("production.boms.water_per_unit", "Water per unit")}</dt>
                  <dd className="font-semibold tabular-nums">
                    {Number(inspectBom.water_litres_per_unit).toFixed(3)} L
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("production.boms.expected_yield", "Expected yield")}</dt>
                  <dd className="font-semibold tabular-nums">
                    {Number(inspectBom.expected_yield_percent).toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("production.boms.shelf_life", "Shelf life")}</dt>
                  <dd className="font-semibold tabular-nums">
                    {inspectBom.shelf_life_days
                      ? `${inspectBom.shelf_life_days} ${t("production.boms.days", "days")}`
                      : "—"}
                  </dd>
                </div>
              </dl>

              {inspectBom.notes ? (
                <p className="rounded-xl bg-muted/40 p-3 text-xs">{inspectBom.notes}</p>
              ) : null}

              <div className="rounded-xl border p-3">
                <p className="mb-2 text-sm font-semibold">{t("production.boms.components", "Components")}</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-2 pr-2 font-semibold">{t("production.trace.component", "Component")}</th>
                      <th className="py-2 pr-2 font-semibold">{t("production.boms.qty_per_unit", "Qty / unit")}</th>
                      <th className="py-2 pr-2 font-semibold">{t("production.boms.effective_qty", "With scrap")}</th>
                      <th className="py-2 font-semibold">{t("production.boms.scrap", "Scrap %")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inspectBom.items ?? []).map((item) => (
                      <tr key={item.id} className="border-b border-border/30">
                        <td className="py-2 pr-2">
                          <p className="font-medium">{componentLabel(item)}</p>
                          <p className="text-[11px] text-muted-foreground">{item.component_type}</p>
                          {item.is_critical ? (
                            <Badge variant="secondary" className="mt-1 text-[10px] font-bold">
                              {t("production.boms.critical", "Critical")}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2 tabular-nums">
                          {Number(item.quantity_per_unit).toLocaleString()} {item.uom}
                        </td>
                        <td className="py-2 pr-2 tabular-nums font-semibold">
                          {effectiveQuantityPerUnit(item).toFixed(4)} {item.uom}
                        </td>
                        <td className="py-2 tabular-nums">{Number(item.scrap_percent).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <DialogFooter className="gap-2 sm:justify-start">
                {canManage && inspectBom.status !== "active" ? (
                  <Button size="sm" onClick={() => setActivateTarget(inspectBom)}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    {t("production.boms.activate", "Activate")}
                  </Button>
                ) : null}
                {canManage ? (
                  <Button size="sm" variant="outline" onClick={() => openEdit(inspectBom)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {t("production.common.edit", "Edit")}
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/dashboard/production/orders?search=${encodeURIComponent(inspectBom.code)}`}>
                    {t("production.boms.view_orders", "Work orders using this recipe")}
                  </Link>
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <ProductionError error={inspectQuery.error} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={activateTarget !== null} onOpenChange={(open) => !open && setActivateTarget(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("production.boms.activate_title", "Activate this recipe?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "production.boms.activate_desc",
                "The current active recipe for this product will be archived. New work orders will explode against this version.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("production.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => activateMutation.mutate()}>
              {t("production.boms.activate", "Activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("production.boms.delete_title", "Delete this recipe?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "production.boms.delete_desc",
                "Draft and archived recipes can be removed. Active recipes must be archived first.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("production.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {t("production.common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProductionShell>
  );
}

function FilterBar({
  children,
  filtersActive,
  onClear,
}: {
  children: React.ReactNode;
  filtersActive: boolean;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
      {children}
      {filtersActive ? (
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
          {t("production.common.clear_filters", "Clear filters")}
        </Button>
      ) : null}
    </div>
  );
}

function BomFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: BomForm;
  setForm: React.Dispatch<React.SetStateAction<BomForm>>;
  busy: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {form.id ? t("production.boms.edit_title", "Edit recipe") : t("production.boms.create_title", "New recipe")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "production.boms.create_desc",
              "Scrap percentage is added on top of the theoretical quantity, so a 2% preform allowance draws 1.02 preforms per bottle.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <ProductSearchPicker
              id="bom-product"
              label={t("production.common.product", "Finished product")}
              value={form.product_id}
              onChange={(value) => setForm((prev) => ({ ...prev, product_id: value }))}
            />
            <div className="space-y-2">
              <Label htmlFor="bom-name">{t("production.common.name", "Name")}</Label>
              <Input
                id="bom-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="0.5L Still Water"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bom-code">{t("production.common.code", "Code")}</Label>
              <Input
                id="bom-code"
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="BOM-500ML"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bom-pack">{t("production.boms.pack_size", "Fill volume (ml)")}</Label>
              <Input
                id="bom-pack"
                type="number"
                value={form.pack_size_ml}
                onChange={(event) => setForm((prev) => ({ ...prev, pack_size_ml: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bom-units">{t("production.boms.units_per_pack", "Units per pack")}</Label>
              <Input
                id="bom-units"
                type="number"
                value={form.units_per_pack}
                onChange={(event) => setForm((prev) => ({ ...prev, units_per_pack: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bom-water">{t("production.boms.water_per_unit", "Water per unit (L)")}</Label>
              <Input
                id="bom-water"
                type="number"
                step="0.001"
                value={form.water_litres_per_unit}
                onChange={(event) => setForm((prev) => ({ ...prev, water_litres_per_unit: event.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("production.boms.water_hint", "Include the rinse allowance, not just the fill volume.")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bom-yield">{t("production.boms.expected_yield", "Expected yield (%)")}</Label>
              <Input
                id="bom-yield"
                type="number"
                step="0.01"
                value={form.expected_yield_percent}
                onChange={(event) => setForm((prev) => ({ ...prev, expected_yield_percent: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bom-shelf">{t("production.boms.shelf_life", "Shelf life (days)")}</Label>
              <Input
                id="bom-shelf"
                type="number"
                value={form.shelf_life_days}
                onChange={(event) => setForm((prev) => ({ ...prev, shelf_life_days: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bom-version">{t("production.boms.version", "Version")}</Label>
              <Input
                id="bom-version"
                type="number"
                min="1"
                value={form.version}
                onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bom-effective">{t("production.boms.effective_from", "Effective from")}</Label>
              <Input
                id="bom-effective"
                type="date"
                value={form.effective_from}
                onChange={(event) => setForm((prev) => ({ ...prev, effective_from: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="bom-notes">{t("production.common.notes", "Notes")}</Label>
              <Input
                id="bom-notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{t("production.boms.components", "Components")}</p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }))}
              >
                <Plus className="h-3 w-3" />
                {t("production.boms.add_component", "Add component")}
              </Button>
            </div>

            {form.items.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-xl border bg-background p-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <ProductSearchPicker
                    id={`bom-component-${index}`}
                    label={t("production.trace.component", "Component")}
                    value={item.component_product_id}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        items: prev.items.map((candidate, candidateIndex) =>
                          candidateIndex === index ? { ...candidate, component_product_id: value } : candidate,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-[11px]">{t("production.common.type", "Type")}</Label>
                  <Select
                    value={item.component_type}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        items: prev.items.map((candidate, candidateIndex) =>
                          candidateIndex === index ? { ...candidate, component_type: value } : candidate,
                        ),
                      }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPONENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-[11px]">{t("production.boms.qty_per_unit", "Qty / unit")}</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    className="h-9"
                    value={item.quantity_per_unit}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        items: prev.items.map((candidate, candidateIndex) =>
                          candidateIndex === index
                            ? { ...candidate, quantity_per_unit: event.target.value }
                            : candidate,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="md:col-span-1">
                  <Label className="text-[11px]">{t("production.common.uom", "UoM")}</Label>
                  <Input
                    className="h-9"
                    value={item.uom}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        items: prev.items.map((candidate, candidateIndex) =>
                          candidateIndex === index ? { ...candidate, uom: event.target.value } : candidate,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-[11px]">{t("production.boms.scrap", "Scrap %")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={item.scrap_percent}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        items: prev.items.map((candidate, candidateIndex) =>
                          candidateIndex === index ? { ...candidate, scrap_percent: event.target.value } : candidate,
                        ),
                      }))
                    }
                  />
                  {item.quantity_per_unit ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                      ={" "}
                      {effectiveQuantityPerUnit({
                        quantity_per_unit: item.quantity_per_unit,
                        scrap_percent: item.scrap_percent,
                      }).toFixed(4)}{" "}
                      {item.uom}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-end justify-between gap-2 md:col-span-1">
                  <label className="flex items-center gap-1.5 text-[11px]">
                    <Checkbox
                      checked={item.is_critical}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          items: prev.items.map((candidate, candidateIndex) =>
                            candidateIndex === index ? { ...candidate, is_critical: checked === true } : candidate,
                          ),
                        }))
                      }
                    />
                    {t("production.boms.critical", "Critical")}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="h-8 w-8 shrink-0 p-0 text-destructive"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        items: prev.items.filter((_, candidateIndex) => candidateIndex !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("production.common.cancel", "Cancel")}
          </Button>
          <Button disabled={busy} onClick={onSubmit}>
            <BusyLabel busy={busy}>{t("production.common.save", "Save")}</BusyLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
