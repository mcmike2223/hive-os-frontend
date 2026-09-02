"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
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
import type { ProductionLine } from "@/modules/production/types";
import {
  BusyLabel,
  ProductionError,
  ProductionLoading,
  ProductionMetricCard,
  ProductionShell,
} from "@/modules/production/components/production-shell";
import { errorText } from "../utils";
import { WarehouseSearchPicker } from "./orders-pickers";

const LINE_TYPES = [
  { value: "blow_fill_cap", label: "Blow-Fill-Cap" },
  { value: "three_in_one", label: "3-in-1 Rinse-Fill-Cap" },
  { value: "jar_line", label: "20L Returnable Jar" },
  { value: "preform_blowing", label: "Preform Blowing" },
  { value: "packing", label: "Packing / Shrink Wrap" },
  { value: "manual", label: "Manual / Semi-Automatic" },
] as const;

type LineActiveFilter = "all" | "active" | "retired";

type LineForm = {
  id?: number;
  name: string;
  code: string;
  line_type: string;
  rated_speed_bph: string;
  supported_formats: string;
  output_warehouse_id: string;
  component_warehouse_id: string;
  commissioned_on: string;
  is_active: boolean;
  notes: string;
};

const DEFAULT_LINE_FORM: LineForm = {
  name: "",
  code: "",
  line_type: "blow_fill_cap",
  rated_speed_bph: "",
  supported_formats: "",
  output_warehouse_id: "",
  component_warehouse_id: "",
  commissioned_on: "",
  is_active: true,
  notes: "",
};

function lineTypeLabel(lineType: string): string {
  return LINE_TYPES.find((type) => type.value === lineType)?.label ?? lineType.replace(/_/g, " ");
}

function lineToForm(line: ProductionLine): LineForm {
  return {
    id: line.id,
    name: line.name,
    code: line.code,
    line_type: line.line_type,
    rated_speed_bph: String(line.rated_speed_bph ?? ""),
    supported_formats: (line.supported_formats ?? []).join(", "),
    output_warehouse_id: line.output_warehouse_id ? String(line.output_warehouse_id) : "",
    component_warehouse_id: line.component_warehouse_id ? String(line.component_warehouse_id) : "",
    commissioned_on: line.commissioned_on ?? "",
    is_active: line.is_active,
    notes: line.notes ?? "",
  };
}

function linePayloadFromForm(form: LineForm): Record<string, unknown> {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    line_type: form.line_type,
    rated_speed_bph: Number(form.rated_speed_bph || 0),
    supported_formats: form.supported_formats
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    output_warehouse_id: form.output_warehouse_id ? Number(form.output_warehouse_id) : undefined,
    component_warehouse_id: form.component_warehouse_id ? Number(form.component_warehouse_id) : undefined,
    commissioned_on: form.commissioned_on || undefined,
    is_active: form.is_active,
    notes: form.notes || undefined,
  };
}

function hasActiveLineFilters(opts: {
  search: string;
  lineType: string;
  active: LineActiveFilter;
}): boolean {
  return Boolean(opts.search.trim() || opts.lineType || opts.active !== "all");
}

function sumNameplateSpeed(lines: ProductionLine[]): number {
  return lines.reduce((sum, line) => sum + Number(line.rated_speed_bph ?? 0), 0);
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
  sortCol: "name",
  sortDir: "asc",
};

export default function ProductionLinesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canView = hasAnyPermission(["view_production", "manage_production", "manage_production_lines"]);
  const canManage = hasAnyPermission(["manage_production_lines", "manage_production"]);

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>({
    page: Number(searchParams.get("page") || DEFAULT_QUERY.page),
    pageSize: Number(searchParams.get("limit") || DEFAULT_QUERY.pageSize),
    search: searchParams.get("search") ?? DEFAULT_QUERY.search,
    sortCol: searchParams.get("sort_col") || DEFAULT_QUERY.sortCol,
    sortDir: searchParams.get("sort_dir") === "desc" ? "desc" : "asc",
  });
  const [lineTypeFilter, setLineTypeFilter] = React.useState(searchParams.get("line_type") ?? "");
  const [activeFilter, setActiveFilter] = React.useState<LineActiveFilter>(
    searchParams.get("active") === "0"
      ? "retired"
      : searchParams.get("active") === "1"
        ? "active"
        : "all",
  );

  const [formOpen, setFormOpen] = React.useState(searchParams.get("add") === "1");
  const [form, setForm] = React.useState<LineForm>(DEFAULT_LINE_FORM);
  const [inspectId, setInspectId] = React.useState<number | null>(
    searchParams.get("line_id") ? Number(searchParams.get("line_id")) : null,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<ProductionLine | null>(null);

  const countQueries = useQueries({
    queries: [
      {
        queryKey: ["production", "lines", "count", "active"],
        queryFn: () => productionApi.listLines({ is_active: 1, limit: 1 }).then((res) => res.data),
        enabled: canView,
      },
      {
        queryKey: ["production", "lines", "count", "retired"],
        queryFn: () => productionApi.listLines({ is_active: 0, limit: 1 }).then((res) => res.data),
        enabled: canView,
      },
      {
        queryKey: ["production", "lines", "nameplate"],
        queryFn: () => productionApi.listLines({ is_active: 1, limit: 100 }).then((res) => res.data),
        enabled: canView,
      },
    ],
  });

  const linesQuery = useQuery({
    queryKey: ["production", "lines", tableQuery, lineTypeFilter, activeFilter],
    queryFn: () =>
      productionApi
        .listLines({
          search: tableQuery.search || undefined,
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          sort_col: tableQuery.sortCol,
          sort_dir: tableQuery.sortDir,
          line_type: lineTypeFilter || undefined,
          is_active:
            activeFilter === "active" ? 1 : activeFilter === "retired" ? 0 : undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
    enabled: canView,
  });

  const inspectQuery = useQuery({
    queryKey: ["production", "lines", "detail", inspectId],
    queryFn: () => productionApi.getLine(inspectId!).then((res) => res.data.data as ProductionLine),
    enabled: inspectId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "lines"] });
    queryClient.invalidateQueries({ queryKey: ["production", "overview"] });
  }, [queryClient]);

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (tableQuery.search.trim()) params.set("search", tableQuery.search.trim());
    if (lineTypeFilter) params.set("line_type", lineTypeFilter);
    if (activeFilter === "active") params.set("active", "1");
    if (activeFilter === "retired") params.set("active", "0");
    if (inspectId) params.set("line_id", String(inspectId));
    if (formOpen) params.set("add", "1");
    if (tableQuery.page > 1) params.set("page", String(tableQuery.page));
    if (tableQuery.pageSize !== DEFAULT_QUERY.pageSize) params.set("limit", String(tableQuery.pageSize));
    if (tableQuery.sortCol !== DEFAULT_QUERY.sortCol) params.set("sort_col", tableQuery.sortCol);
    if (tableQuery.sortDir !== DEFAULT_QUERY.sortDir) params.set("sort_dir", tableQuery.sortDir);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [activeFilter, formOpen, inspectId, lineTypeFilter, pathname, router, tableQuery]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setTableQuery((current) => ({ ...current, page: 1 }));
  }, [lineTypeFilter, activeFilter, tableQuery.search]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = linePayloadFromForm(form);
      return form.id ? productionApi.updateLine(form.id, payload) : productionApi.createLine(payload);
    },
    onSuccess: () => {
      toast.success(t("production.lines.saved", "Production line saved."));
      invalidate();
      setFormOpen(false);
      setForm(DEFAULT_LINE_FORM);
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.lines.save_failed", "Could not save the line.")));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => productionApi.deleteLine(deleteTarget!.id),
    onSuccess: (response) => {
      toast.success(
        response?.data?.message || t("production.lines.deleted", "Production line removed."),
      );
      invalidate();
      if (inspectId === deleteTarget?.id) setInspectId(null);
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.lines.delete_failed", "Could not remove the line.")));
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || DEFAULT_QUERY.pageSize),
      search: String(query.search ?? ""),
      sortCol: String(query.sortCol || DEFAULT_QUERY.sortCol),
      sortDir: query.sortDir === "desc" ? "desc" : "asc",
    });
  }, []);

  const openCreate = () => {
    setForm(DEFAULT_LINE_FORM);
    setFormOpen(true);
  };

  const openEdit = (line: ProductionLine) => {
    setForm(lineToForm(line));
    setFormOpen(true);
  };

  const clearFilters = () => {
    setLineTypeFilter("");
    setActiveFilter("all");
    setTableQuery((current) => ({ ...current, search: "", page: 1 }));
  };

  const filtersActive = hasActiveLineFilters({
    search: tableQuery.search,
    lineType: lineTypeFilter,
    active: activeFilter,
  });

  const activeCount = countQueries[0].data?.meta?.total ?? 0;
  const retiredCount = countQueries[1].data?.meta?.total ?? 0;
  const nameplateTotal = sumNameplateSpeed((countQueries[2].data?.data ?? []) as ProductionLine[]);
  const inspectLine = inspectQuery.data;

  const columns = React.useMemo<ColumnDef<ProductionLine>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("production.lines.col_line", "Line"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left hover:underline"
            onClick={() => setInspectId(row.original.id)}
          >
            <p className="font-bold">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </button>
        ),
      },
      {
        accessorKey: "line_type",
        header: t("production.common.type", "Type"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] font-semibold">
            {lineTypeLabel(row.original.line_type)}
          </Badge>
        ),
      },
      {
        accessorKey: "rated_speed_bph",
        header: t("production.lines.rated_speed", "Rated speed"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums font-semibold">
            {Number(row.original.rated_speed_bph).toLocaleString()} {t("production.lines.bph", "bph")}
          </span>
        ),
      },
      {
        id: "formats",
        header: t("production.lines.formats", "Formats"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(row.original.supported_formats ?? []).slice(0, 3).map((format) => (
              <Badge key={format} variant="secondary" className="text-[10px] font-bold">
                {format}
              </Badge>
            ))}
            {(row.original.supported_formats ?? []).length > 3 ? (
              <Badge variant="outline" className="text-[10px]">
                +{(row.original.supported_formats ?? []).length - 3}
              </Badge>
            ) : null}
            {(row.original.supported_formats ?? []).length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "commissioned_on",
        header: t("production.lines.commissioned", "Commissioned"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">{row.original.commissioned_on ?? "—"}</span>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("production.common.status", "Status"),
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge
              variant="outline"
              className="border-transparent bg-emerald-500/15 text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300"
            >
              {t("production.common.active", "Active")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-transparent bg-muted text-[11px] font-black uppercase tracking-widest text-muted-foreground"
            >
              {t("production.common.retired", "Retired")}
            </Badge>
          ),
      },
      {
        id: "actions",
        header: t("production.common.actions", "Actions"),
        cell: ({ row }) => {
          const line = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setInspectId(line.id)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {canManage ? (
                <>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(line)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => setDeleteTarget(line)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
        title={t("production.lines.title", "Production lines")}
        description={t(
          "production.lines.subtitle",
          "The rated speed here is the denominator of the OEE performance factor.",
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
      title={t("production.lines.title", "Production lines")}
      description={t(
        "production.lines.subtitle",
        "Nameplate speed, supported formats, and default warehouses — the master data OEE and work orders depend on.",
      )}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => linesQuery.refetch()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${linesQuery.isFetching ? "animate-spin" : ""}`} />
            {t("production.common.refresh", "Refresh")}
          </Button>
          {canManage ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("production.lines.add_btn", "Add line")}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <ProductionMetricCard
          title={t("production.lines.active_lines", "Active lines")}
          value={activeCount.toLocaleString()}
          description={t("production.lines.active_desc", "Available for scheduling and shift runs")}
        />
        <ProductionMetricCard
          title={t("production.lines.retired_lines", "Retired lines")}
          value={retiredCount.toLocaleString()}
          description={t("production.lines.retired_desc", "Deactivated but kept for OEE history")}
        />
        <ProductionMetricCard
          title={t("production.lines.nameplate_total", "Combined nameplate")}
          value={`${nameplateTotal.toLocaleString()} ${t("production.lines.bph", "bph")}`}
          description={t("production.lines.nameplate_desc", "Sum of rated speed on active lines")}
        />
      </div>

      <FilterBar filtersActive={filtersActive} onClear={clearFilters}>
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.type", "Line type")}</Label>
          <Select value={lineTypeFilter || "all"} onValueChange={(value) => setLineTypeFilter(value === "all" ? "" : value)}>
            <SelectTrigger className="h-9 w-[12rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {LINE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.status", "Status")}</Label>
          <Select value={activeFilter} onValueChange={(value) => setActiveFilter(value as LineActiveFilter)}>
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              <SelectItem value="active">{t("production.common.active", "Active")}</SelectItem>
              <SelectItem value="retired">{t("production.common.retired", "Retired")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {linesQuery.isError ? (
        <ProductionError error={linesQuery.error} />
      ) : (
        <DataTable
          columns={columns}
          data={(linesQuery.data?.data ?? []) as ProductionLine[]}
          totalEntries={linesQuery.data?.meta?.total ?? 0}
          loading={linesQuery.isFetching}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("production.lines.search_placeholder", "Search lines...")}
          resourceName="production-lines"
          syncWithUrl={false}
          defaultSearch={tableQuery.search}
          onRefresh={() => linesQuery.refetch()}
          getRowId={(row) => String(row.id)}
        />
      )}

      <LineFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        setForm={setForm}
        busy={saveMutation.isPending}
        onSubmit={() => {
          if (!form.name.trim() || !form.code.trim()) {
            toast.error(t("production.lines.required_fields", "Name and code are required."));
            return;
          }
          saveMutation.mutate();
        }}
      />

      <Dialog open={inspectId !== null} onOpenChange={(open) => !open && setInspectId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("production.lines.inspect_title", "Line detail")}</DialogTitle>
            <DialogDescription>{inspectLine ? inspectLine.code : ""}</DialogDescription>
          </DialogHeader>
          {inspectQuery.isLoading ? (
            <ProductionLoading cards={2} />
          ) : inspectLine ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{inspectLine.name}</p>
                  <p className="text-sm text-muted-foreground">{lineTypeLabel(inspectLine.line_type)}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`border-transparent text-[11px] font-black uppercase tracking-widest ${
                    inspectLine.is_active
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {inspectLine.is_active
                    ? t("production.common.active", "Active")
                    : t("production.common.retired", "Retired")}
                </Badge>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t("production.lines.rated_speed", "Rated speed")}</dt>
                  <dd className="font-semibold tabular-nums">
                    {Number(inspectLine.rated_speed_bph).toLocaleString()} {t("production.lines.bph", "bph")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("production.lines.commissioned", "Commissioned")}</dt>
                  <dd className="font-semibold tabular-nums">{inspectLine.commissioned_on ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">{t("production.lines.formats", "Formats")}</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {(inspectLine.supported_formats ?? []).length > 0 ? (
                      (inspectLine.supported_formats ?? []).map((format) => (
                        <Badge key={format} variant="secondary" className="text-[10px] font-bold">
                          {format}
                        </Badge>
                      ))
                    ) : (
                      <span>—</span>
                    )}
                  </dd>
                </div>
                {inspectLine.output_warehouse_id ? (
                  <div>
                    <dt className="text-muted-foreground">{t("production.lines.output_warehouse", "Output warehouse")}</dt>
                    <dd className="font-semibold">#{inspectLine.output_warehouse_id}</dd>
                  </div>
                ) : null}
                {inspectLine.component_warehouse_id ? (
                  <div>
                    <dt className="text-muted-foreground">
                      {t("production.lines.component_warehouse", "Component warehouse")}
                    </dt>
                    <dd className="font-semibold">#{inspectLine.component_warehouse_id}</dd>
                  </div>
                ) : null}
              </dl>

              {inspectLine.notes ? (
                <p className="rounded-xl bg-muted/40 p-3 text-xs">{inspectLine.notes}</p>
              ) : null}

              <p className="text-[11px] text-muted-foreground">
                {t("production.lines.code_hint", "The code prefixes every lot number produced on this line.")}
              </p>

              <DialogFooter className="gap-2 sm:justify-start">
                {canManage ? (
                  <Button size="sm" variant="outline" onClick={() => openEdit(inspectLine)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {t("production.common.edit", "Edit")}
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/dashboard/production/runs?line_id=${inspectLine.id}`}>
                    {t("production.lines.view_runs", "Shift runs on this line")}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/dashboard/production/orders?line_id=${inspectLine.id}`}>
                    {t("production.lines.view_orders", "Work orders on this line")}
                  </Link>
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <ProductionError error={inspectQuery.error} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("production.lines.delete_title", "Remove this line?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "production.lines.delete_desc",
                "Lines with production history are retired instead of deleted so OEE records stay intact.",
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

function LineFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: LineForm;
  setForm: React.Dispatch<React.SetStateAction<LineForm>>;
  busy: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {form.id
              ? t("production.lines.edit_title", "Edit production line")
              : t("production.lines.create_title", "Add production line")}
          </DialogTitle>
          <DialogDescription>
            {t("production.lines.create_desc", "Describe the equipment as it runs, not as it was sold.")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="line-name">{t("production.common.name", "Name")}</Label>
            <Input
              id="line-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Line 1 — PET Blow-Fill-Cap"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line-code">{t("production.common.code", "Code")}</Label>
            <Input
              id="line-code"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="L1"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("production.lines.code_hint", "The code prefixes every lot number produced on this line.")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("production.common.type", "Type")}</Label>
            <Select value={form.line_type} onValueChange={(value) => setForm((prev) => ({ ...prev, line_type: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="line-speed">{t("production.lines.rated_speed_bph", "Rated speed (bottles/hour)")}</Label>
            <Input
              id="line-speed"
              type="number"
              value={form.rated_speed_bph}
              onChange={(event) => setForm((prev) => ({ ...prev, rated_speed_bph: event.target.value }))}
              placeholder="6000"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="line-formats">{t("production.lines.supported_formats", "Supported formats")}</Label>
            <Input
              id="line-formats"
              value={form.supported_formats}
              onChange={(event) => setForm((prev) => ({ ...prev, supported_formats: event.target.value }))}
              placeholder="0.5L, 1L, 2L"
            />
          </div>
          <WarehouseSearchPicker
            id="line-output-wh"
            label={t("production.lines.output_warehouse", "Output warehouse")}
            value={form.output_warehouse_id}
            onChange={(value) => setForm((prev) => ({ ...prev, output_warehouse_id: value }))}
            allowClear
          />
          <WarehouseSearchPicker
            id="line-component-wh"
            label={t("production.lines.component_warehouse", "Component warehouse")}
            value={form.component_warehouse_id}
            onChange={(value) => setForm((prev) => ({ ...prev, component_warehouse_id: value }))}
            allowClear
          />
          <div className="space-y-2">
            <Label htmlFor="line-commissioned">{t("production.lines.commissioned", "Commissioned on")}</Label>
            <Input
              id="line-commissioned"
              type="date"
              value={form.commissioned_on}
              onChange={(event) => setForm((prev) => ({ ...prev, commissioned_on: event.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked === true }))}
              />
              {t("production.common.active", "Active")}
            </label>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="line-notes">{t("production.common.notes", "Notes")}</Label>
            <Input
              id="line-notes"
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
            <BusyLabel busy={busy}>{t("production.common.save", "Save")}</BusyLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
