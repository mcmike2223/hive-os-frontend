"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  TimerOff,
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
  DowntimeReason,
  OeeMetrics,
  ProductionLine,
  ProductionOrder,
  ProductionRun,
} from "@/modules/production/types";
import {
  BusyLabel,
  ProductionError,
  ProductionLoading,
  ProductionMetricCard,
  ProductionShell,
} from "@/modules/production/components/production-shell";
import { errorText, isoDaysAgo, useDebouncedValue } from "../utils";

/**
 * Defect codes the reject breakdown is keyed by. Keeping them fixed is what
 * makes the reject pareto on the overview meaningful — free-text defect names
 * would fragment into one bar per spelling.
 */
const DEFECT_CODES = [
  "underfill",
  "overfill",
  "cap_defect",
  "seal_leak",
  "bottle_deform",
  "label_misaligned",
  "date_code_illegible",
  "contamination",
  "other",
] as const;

const SHIFTS = ["day", "night", "a", "b", "c"] as const;
type ShiftFilter = (typeof SHIFTS)[number] | "all";

type RunForm = {
  production_order_id: string;
  production_line_id: string;
  shift: string;
  started_at: string;
  ended_at: string;
  planned_runtime_minutes: string;
  good_units: string;
  water_consumed_litres: string;
  power_outage_minutes: string;
  notes: string;
  rejects: Record<string, string>;
};

function emptyRunForm(): RunForm {
  return {
    production_order_id: "",
    production_line_id: "",
    shift: "day",
    started_at: "",
    ended_at: "",
    planned_runtime_minutes: "480",
    good_units: "",
    water_consumed_litres: "",
    power_outage_minutes: "",
    notes: "",
    rejects: {},
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

function runToForm(run: ProductionRun): RunForm {
  const rejects: Record<string, string> = {};
  for (const code of DEFECT_CODES) {
    const value = run.reject_breakdown?.[code];
    if (value !== undefined && value !== null) rejects[code] = String(value);
  }

  return {
    production_order_id: String(run.production_order_id),
    production_line_id: run.production_line_id ? String(run.production_line_id) : "",
    shift: run.shift || "day",
    started_at: toLocalDateTime(run.started_at),
    ended_at: toLocalDateTime(run.ended_at),
    planned_runtime_minutes: String(run.planned_runtime_minutes ?? 480),
    good_units: String(run.good_units ?? ""),
    water_consumed_litres: String(run.water_consumed_litres ?? ""),
    power_outage_minutes: String(run.power_outage_minutes ?? ""),
    notes: run.notes ?? "",
    rejects,
  };
}

function buildRejectBreakdown(rejects: Record<string, string>): Record<string, number> {
  return Object.entries(rejects)
    .filter(([, value]) => Number(value) > 0)
    .reduce<Record<string, number>>((acc, [code, value]) => {
      acc[code] = Number(value);
      return acc;
    }, {});
}

function rejectTotalFromForm(rejects: Record<string, string>): number {
  return Object.values(rejects).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function runPayloadFromForm(form: RunForm): Partial<ProductionRun> {
  const rejectBreakdown = buildRejectBreakdown(form.rejects);
  const rejectTotal = Object.values(rejectBreakdown).reduce((sum, value) => sum + value, 0);

  return {
    production_order_id: Number(form.production_order_id),
    production_line_id: form.production_line_id ? Number(form.production_line_id) : undefined,
    shift: form.shift,
    started_at: form.started_at,
    ended_at: form.ended_at || undefined,
    planned_runtime_minutes: Number(form.planned_runtime_minutes || 0),
    good_units: Number(form.good_units || 0),
    reject_units: rejectTotal,
    reject_breakdown: rejectBreakdown,
    water_consumed_litres: Number(form.water_consumed_litres || 0),
    power_outage_minutes: Number(form.power_outage_minutes || 0),
    notes: form.notes || undefined,
  };
}

function hasActiveRunFilters(opts: {
  search: string;
  lineId: string;
  orderId: string;
  shift: ShiftFilter;
  openOnly: boolean;
  from: string;
  to: string;
}): boolean {
  return Boolean(
    opts.search.trim() ||
      opts.lineId ||
      opts.orderId ||
      opts.shift !== "all" ||
      opts.openOnly ||
      opts.from ||
      opts.to,
  );
}

function defectLabel(code: string): string {
  return code.replace(/_/g, " ");
}

function totalRunsInPeriod(
  linePerformance: Array<{ runs: number }> | undefined,
): number {
  return (linePerformance ?? []).reduce((sum, row) => sum + row.runs, 0);
}

function runYieldPercent(good: number | string, reject: number | string): number | null {
  const goodUnits = Number(good) || 0;
  const rejectUnits = Number(reject) || 0;
  const total = goodUnits + rejectUnits;
  if (total <= 0) return null;
  return Math.round((goodUnits / total) * 1000) / 10;
}

function downtimeMinutes(run: ProductionRun): number {
  return (run.downtime_events ?? []).reduce((sum, event) => sum + Number(event.duration_minutes), 0);
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
  sortCol: "started_at",
  sortDir: "desc",
};

type DowntimeForm = {
  production_run_id: string;
  production_line_id: string;
  reason_code: string;
  started_at: string;
  ended_at: string;
  notes: string;
};

const DEFAULT_DOWNTIME_FORM: DowntimeForm = {
  production_run_id: "",
  production_line_id: "",
  reason_code: "",
  started_at: "",
  ended_at: "",
  notes: "",
};

export default function ShiftRunsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canRecord = hasAnyPermission(["record_production_runs", "manage_production"]);
  const canEdit = hasAnyPermission(["record_production_runs", "manage_production"]);
  const canDelete = hasAnyPermission(["manage_production"]);
  const canDowntime = hasAnyPermission(["record_production_downtime", "manage_production"]);

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>({
    page: Number(searchParams.get("page") || DEFAULT_QUERY.page),
    pageSize: Number(searchParams.get("limit") || DEFAULT_QUERY.pageSize),
    search: searchParams.get("search") ?? DEFAULT_QUERY.search,
    sortCol: searchParams.get("sort_col") || DEFAULT_QUERY.sortCol,
    sortDir: searchParams.get("sort_dir") === "asc" ? "asc" : "desc",
  });
  const [lineFilter, setLineFilter] = React.useState(searchParams.get("line_id") ?? "");
  const [orderFilter, setOrderFilter] = React.useState(searchParams.get("order_id") ?? "");
  const [shiftFilter, setShiftFilter] = React.useState<ShiftFilter>(
    (searchParams.get("shift") as ShiftFilter) || "all",
  );
  const [openOnly, setOpenOnly] = React.useState(searchParams.get("open_only") === "1");
  const [fromDate, setFromDate] = React.useState(searchParams.get("from") ?? "");
  const [toDate, setToDate] = React.useState(searchParams.get("to") ?? "");

  const [createOpen, setCreateOpen] = React.useState(searchParams.get("add") === "1");
  const [runForm, setRunForm] = React.useState<RunForm>(() => {
    const form = emptyRunForm();
    const orderId = searchParams.get("order_id");
    if (orderId) form.production_order_id = orderId;
    return form;
  });
  const [editingRun, setEditingRun] = React.useState<ProductionRun | null>(null);
  const [inspectRunId, setInspectRunId] = React.useState<number | null>(
    searchParams.get("run_id") ? Number(searchParams.get("run_id")) : null,
  );
  const [downtimeRun, setDowntimeRun] = React.useState<ProductionRun | null>(null);
  const [downtimeForm, setDowntimeForm] = React.useState<DowntimeForm>(DEFAULT_DOWNTIME_FORM);
  const [deleteRun, setDeleteRun] = React.useState<ProductionRun | null>(null);
  const [orderSearch, setOrderSearch] = React.useState("");
  const debouncedOrderSearch = useDebouncedValue(orderSearch);

  const periodFrom = fromDate || isoDaysAgo(29);
  const periodTo = toDate || isoDaysAgo(0);

  const overviewQuery = useQuery({
    queryKey: ["production", "overview", "runs-page", periodFrom, periodTo, lineFilter],
    queryFn: () =>
      productionApi
        .overview({
          from: periodFrom,
          to: periodTo,
          production_line_id: lineFilter ? Number(lineFilter) : undefined,
        })
        .then((res) => res.data),
  });

  const openRunsQuery = useQuery({
    queryKey: ["production", "runs", "open-count", periodFrom, periodTo, lineFilter],
    queryFn: () =>
      productionApi
        .listRuns({
          open_only: 1,
          limit: 1,
          from: periodFrom,
          to: periodTo,
          production_line_id: lineFilter ? Number(lineFilter) : undefined,
        })
        .then((res) => res.data),
  });

  const runsQuery = useQuery({
    queryKey: [
      "production",
      "runs",
      tableQuery,
      lineFilter,
      orderFilter,
      shiftFilter,
      openOnly,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      productionApi
        .listRuns({
          search: tableQuery.search || undefined,
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          sort_col: tableQuery.sortCol,
          sort_dir: tableQuery.sortDir,
          production_line_id: lineFilter ? Number(lineFilter) : undefined,
          production_order_id: orderFilter ? Number(orderFilter) : undefined,
          shift: shiftFilter === "all" ? undefined : shiftFilter,
          open_only: openOnly ? 1 : undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const detailQuery = useQuery({
    queryKey: ["production", "run", inspectRunId],
    queryFn: async () => {
      const res = await productionApi.getRun(inspectRunId!);
      return {
        run: res.data.data as ProductionRun,
        oee: res.data.oee as OeeMetrics,
      };
    },
    enabled: inspectRunId !== null,
  });

  const openOrdersQuery = useQuery({
    queryKey: ["production", "orders", "open", debouncedOrderSearch],
    queryFn: () =>
      productionApi
        .listOrders({
          limit: 50,
          open_only: true,
          search: debouncedOrderSearch || undefined,
        })
        .then((res) => res.data),
    enabled: createOpen || editingRun !== null,
  });

  const filterOrdersQuery = useQuery({
    queryKey: ["production", "orders", "runs-filter"],
    queryFn: () => productionApi.listOrders({ limit: 100, open_only: true }).then((res) => res.data),
  });

  const linesQuery = useQuery({
    queryKey: ["production", "lines", "select"],
    queryFn: () => productionApi.listLines({ limit: 100, is_active: true }).then((res) => res.data),
  });

  const reasonsQuery = useQuery({
    queryKey: ["production", "downtime", "reasons"],
    queryFn: () => productionApi.listDowntimeReasons().then((res) => res.data),
    enabled: downtimeRun !== null,
  });

  const orders: ProductionOrder[] = openOrdersQuery.data?.data ?? [];
  const filterOrders: ProductionOrder[] = filterOrdersQuery.data?.data ?? [];
  const lines: ProductionLine[] = linesQuery.data?.data ?? [];
  const reasons: DowntimeReason[] = reasonsQuery.data?.data ?? [];
  const overview = overviewQuery.data?.data;

  const reasonGroups = React.useMemo(() => {
    return reasons.reduce<Record<string, DowntimeReason[]>>((groups, reason) => {
      (groups[reason.group] ||= []).push(reason);
      return groups;
    }, {});
  }, [reasons]);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "runs"] });
    queryClient.invalidateQueries({ queryKey: ["production", "run"] });
    queryClient.invalidateQueries({ queryKey: ["production", "orders"] });
    queryClient.invalidateQueries({ queryKey: ["production", "overview"] });
  }, [queryClient]);

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (tableQuery.search.trim()) params.set("search", tableQuery.search.trim());
    if (lineFilter) params.set("line_id", lineFilter);
    if (orderFilter) params.set("order_id", orderFilter);
    if (shiftFilter !== "all") params.set("shift", shiftFilter);
    if (openOnly) params.set("open_only", "1");
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (inspectRunId) params.set("run_id", String(inspectRunId));
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
    inspectRunId,
    lineFilter,
    openOnly,
    orderFilter,
    pathname,
    router,
    shiftFilter,
    tableQuery,
    toDate,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setTableQuery((current) => ({ ...current, page: 1 }));
  }, [lineFilter, orderFilter, shiftFilter, openOnly, fromDate, toDate]);

  React.useEffect(() => {
    if (searchParams.get("add") === "1" && canRecord) setCreateOpen(true);
  }, [searchParams, canRecord]);

  const createRunMutation = useMutation({
    mutationFn: () => productionApi.createRun(runPayloadFromForm(runForm)),
    onSuccess: () => {
      toast.success(t("production.runs.created", "Shift run recorded."));
      invalidate();
      setCreateOpen(false);
      setRunForm(emptyRunForm());
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.runs.create_failed", "Could not record the run.")));
    },
  });

  const updateRunMutation = useMutation({
    mutationFn: () => productionApi.updateRun(editingRun!.id, runPayloadFromForm(runForm)),
    onSuccess: () => {
      toast.success(t("production.runs.updated", "Shift run updated."));
      invalidate();
      setEditingRun(null);
      setRunForm(emptyRunForm());
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.runs.update_failed", "Could not update the run.")));
    },
  });

  const deleteRunMutation = useMutation({
    mutationFn: () => productionApi.deleteRun(deleteRun!.id),
    onSuccess: () => {
      toast.success(t("production.runs.deleted", "Shift run deleted."));
      invalidate();
      if (inspectRunId === deleteRun?.id) setInspectRunId(null);
      setDeleteRun(null);
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.runs.delete_failed", "Could not delete the run.")));
    },
  });

  const createDowntimeMutation = useMutation({
    mutationFn: () =>
      productionApi.createDowntime({
        production_run_id: downtimeForm.production_run_id ? Number(downtimeForm.production_run_id) : undefined,
        production_line_id: downtimeForm.production_line_id ? Number(downtimeForm.production_line_id) : undefined,
        reason_code: downtimeForm.reason_code,
        started_at: downtimeForm.started_at,
        ended_at: downtimeForm.ended_at || undefined,
        notes: downtimeForm.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(t("production.runs.downtime_recorded", "Stoppage recorded."));
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["production", "downtime"] });
      setDowntimeForm(DEFAULT_DOWNTIME_FORM);
      if (inspectRunId) detailQuery.refetch();
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.runs.downtime_failed", "Could not record the stoppage.")));
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || DEFAULT_QUERY.pageSize),
      search: String(query.search ?? ""),
      sortCol: String(query.sortCol || "started_at"),
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
    });
  }, []);

  const filtersActive = hasActiveRunFilters({
    search: tableQuery.search,
    lineId: lineFilter,
    orderId: orderFilter,
    shift: shiftFilter,
    openOnly,
    from: fromDate,
    to: toDate,
  });

  const refetching = runsQuery.isFetching && !runsQuery.isLoading;

  const clearFilters = () => {
    setLineFilter("");
    setOrderFilter("");
    setShiftFilter("all");
    setOpenOnly(false);
    setFromDate("");
    setToDate("");
    setTableQuery((current) => ({ ...current, search: "", page: 1 }));
  };

  const openDowntimeForRun = (run: ProductionRun) => {
    setDowntimeRun(run);
    setDowntimeForm({
      ...DEFAULT_DOWNTIME_FORM,
      production_run_id: String(run.id),
      production_line_id: run.production_line_id ? String(run.production_line_id) : "",
    });
  };

  const columns = React.useMemo<ColumnDef<ProductionRun>[]>(
    () => [
      {
        id: "run",
        header: t("production.runs.col_run", "Run"),
        cell: ({ row }) => {
          const run = row.original;
          const order = run.order;
          return (
            <button
              type="button"
              className="space-y-0.5 text-left hover:underline"
              onClick={() => setInspectRunId(run.id)}
            >
              <p className="font-bold">{order?.order_number ?? `#${run.production_order_id}`}</p>
              <p className="text-[11px] text-muted-foreground">
                {order?.batch_number ? `${t("production.orders.lot", "Lot")} ${order.batch_number} · ` : ""}
                {run.line?.name ?? "-"} · {t("production.runs.shift", "shift")} {run.shift}
              </p>
            </button>
          );
        },
      },
      {
        accessorKey: "started_at",
        header: t("production.runs.col_window", "Window"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{new Date(row.original.started_at).toLocaleString()}</p>
            <p className="text-muted-foreground">
              {row.original.ended_at
                ? new Date(row.original.ended_at).toLocaleTimeString()
                : t("production.runs.open", "open")}
            </p>
          </div>
        ),
      },
      {
        id: "output",
        header: t("production.runs.col_output", "Output"),
        cell: ({ row }) => {
          const yieldPct = runYieldPercent(row.original.good_units, row.original.reject_units);
          return (
            <div className="space-y-0.5 tabular-nums">
              <p className="text-sm font-semibold">{Number(row.original.good_units).toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">
                {Number(row.original.reject_units).toLocaleString()} {t("production.overview.rejected", "rejected")}
                {yieldPct !== null ? ` · ${yieldPct}%` : ""}
              </p>
            </div>
          );
        },
      },
      {
        id: "downtime",
        header: t("production.overview.downtime", "Downtime"),
        cell: ({ row }) => {
          const minutes = downtimeMinutes(row.original);
          const outage = Number(row.original.power_outage_minutes);
          return (
            <div className="space-y-1">
              <p className="text-sm font-semibold tabular-nums">
                {minutes.toLocaleString()} {t("production.common.min", "min")}
              </p>
              {outage > 0 ? (
                <Badge
                  variant="outline"
                  className="border-transparent bg-amber-500/15 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300"
                >
                  {outage.toLocaleString()} {t("production.runs.outage", "min grid outage")}
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "planned_runtime_minutes",
        header: t("production.runs.col_planned", "Planned"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.planned_runtime_minutes.toLocaleString()} {t("production.common.min", "min")}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("production.common.actions", "Actions"),
        cell: ({ row }) => {
          const run = row.original;
          return (
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setInspectRunId(run.id)}
              >
                <Eye className="h-3 w-3" />
                {t("production.common.inspect", "Inspect")}
              </Button>
              {canDowntime ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => openDowntimeForRun(run)}
                >
                  <TimerOff className="h-3 w-3" />
                  {t("production.runs.log_stoppage", "Stoppage")}
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setEditingRun(run);
                    setRunForm(runToForm(run));
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
    [canDowntime, canEdit, t],
  );

  const inspectRun = detailQuery.data?.run ?? null;
  const inspectOee = detailQuery.data?.oee ?? null;

  return (
    <ProductionShell
      title={t("production.runs.title", "Shift Runs")}
      description={t(
        "production.runs.subtitle",
        "Counts are entered once, here. Work order totals and OEE are both derived from these rows.",
      )}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              runsQuery.refetch();
              overviewQuery.refetch();
              openRunsQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            {t("production.common.refresh", "Refresh")}
          </Button>
          {canRecord ? (
            <Button
              type="button"
              onClick={() => {
                const form = emptyRunForm();
                if (orderFilter) form.production_order_id = orderFilter;
                setRunForm(form);
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("production.runs.add_btn", "Record Shift Run")}
            </Button>
          ) : null}
        </div>
      }
    >
      {overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProductionMetricCard
            title={t("production.overview.oee", "OEE")}
            value={`${overview.oee.oee.toFixed(1)}%`}
            description={`${overview.oee.availability.toFixed(1)}% ${t("production.overview.availability", "availability")} · ${overview.oee.quality.toFixed(1)}% ${t("production.overview.quality", "quality")}`}
          />
          <ProductionMetricCard
            title={t("production.runs.period_output", "Shift output")}
            value={overview.oee.good_units.toLocaleString()}
            description={`${overview.oee.reject_units.toLocaleString()} ${t("production.overview.rejected", "rejected")} · ${totalRunsInPeriod(overview.line_performance)} ${t("production.runs.runs_logged", "runs logged")}`}
          />
          <ProductionMetricCard
            title={t("production.overview.downtime", "Downtime")}
            value={`${overview.oee.downtime_minutes.toLocaleString()} ${t("production.common.min", "min")}`}
            description={t(
              "production.runs.downtime_tile_desc",
              "Stoppage minutes in the selected period — feeds the downtime pareto.",
            )}
          />
          <Link href="/dashboard/production/runs?open_only=1" className="block">
            <ProductionMetricCard
              title={t("production.runs.open_shifts", "Open shift runs")}
              value={(openRunsQuery.data?.meta?.total ?? 0).toLocaleString()}
              description={t(
                "production.runs.open_shifts_desc",
                "Runs without an end time — close them when the shift finishes.",
              )}
            />
          </Link>
        </div>
      ) : overviewQuery.isLoading ? (
        <ProductionLoading />
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.line", "Line")}</Label>
          <Select value={lineFilter || "all"} onValueChange={(value) => setLineFilter(value === "all" ? "" : value)}>
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {lines.map((line) => (
                <SelectItem key={line.id} value={String(line.id)}>
                  {line.code} — {line.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("production.runs.shift_label", "Shift")}</Label>
          <Select value={shiftFilter} onValueChange={(value) => setShiftFilter(value as ShiftFilter)}>
            <SelectTrigger className="h-9 w-[8rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {SHIFTS.map((shift) => (
                <SelectItem key={shift} value={shift}>
                  {shift}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("production.runs.work_order", "Work order")}</Label>
          <Select value={orderFilter || "all"} onValueChange={(value) => setOrderFilter(value === "all" ? "" : value)}>
            <SelectTrigger className="h-9 w-[12rem]">
              <SelectValue placeholder={t("production.common.all", "All")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {filterOrders.map((order) => (
                <SelectItem key={order.id} value={String(order.id)}>
                  {order.order_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="runs-from">
            {t("production.common.from", "From")}
          </Label>
          <Input
            id="runs-from"
            type="date"
            className="h-9 w-[10rem]"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="runs-to">
            {t("production.common.to", "To")}
          </Label>
          <Input
            id="runs-to"
            type="date"
            className="h-9 w-[10rem]"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
            className="rounded border"
          />
          {t("production.runs.open_only", "Open shifts only")}
        </label>
        {filtersActive ? (
          <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            {t("production.common.clear_filters", "Clear filters")}
          </Button>
        ) : null}
      </div>

      {runsQuery.isError ? (
        <ProductionError error={runsQuery.error} />
      ) : (
        <DataTable
          columns={columns}
          data={(runsQuery.data?.data ?? []) as ProductionRun[]}
          totalEntries={runsQuery.data?.meta?.total ?? 0}
          loading={runsQuery.isFetching}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t(
            "production.runs.search_placeholder",
            "Search by order, lot, line, or shift...",
          )}
          resourceName="production-runs"
          syncWithUrl={false}
          defaultSearch={tableQuery.search}
          defaultSortCol={tableQuery.sortCol}
          defaultSortDir={tableQuery.sortDir}
          onRefresh={() => runsQuery.refetch()}
          getRowId={(row) => String(row.id)}
        />
      )}

      <RunFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("production.runs.create_title", "Record Shift Run")}
        description={t(
          "production.runs.create_desc",
          "Reject units are summed from the defect breakdown, so the reject pareto stays consistent across shifts.",
        )}
        form={runForm}
        setForm={setRunForm}
        lines={lines}
        orders={orders}
        orderSearch={orderSearch}
        setOrderSearch={setOrderSearch}
        ordersLoading={openOrdersQuery.isLoading}
        busy={createRunMutation.isPending}
        submitLabel={t("production.runs.save", "Save Run")}
        onSubmit={() => {
          if (!runForm.production_order_id || !runForm.started_at) {
            toast.error(t("production.runs.required_fields", "Work order and start time are required."));
            return;
          }
          createRunMutation.mutate();
        }}
      />

      <RunFormDialog
        open={editingRun !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRun(null);
            setRunForm(emptyRunForm());
          }
        }}
        title={t("production.runs.edit_title", "Edit shift run")}
        description={t(
          "production.runs.edit_desc",
          "Correcting counts here will re-sync the parent work order totals.",
        )}
        form={runForm}
        setForm={setRunForm}
        lines={lines}
        orders={orders}
        orderSearch={orderSearch}
        setOrderSearch={setOrderSearch}
        ordersLoading={openOrdersQuery.isLoading}
        orderReadOnly
        busy={updateRunMutation.isPending}
        submitLabel={t("production.common.save", "Save")}
        onSubmit={() => {
          if (!runForm.production_order_id || !runForm.started_at) {
            toast.error(t("production.runs.required_fields", "Work order and start time are required."));
            return;
          }
          updateRunMutation.mutate();
        }}
      />

      <Dialog open={inspectRunId !== null} onOpenChange={(open) => !open && setInspectRunId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("production.runs.inspect_title", "Shift run detail")}</DialogTitle>
            <DialogDescription>
              {inspectRun?.order?.order_number
                ? `${inspectRun.order.order_number} · ${t("production.orders.lot", "Lot")} ${inspectRun.order.batch_number}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("production.common.loading", "Loading...")}
            </div>
          ) : inspectRun ? (
            <>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t("production.common.line", "Line")}</span>
                  <p className="font-medium">{inspectRun.line?.name ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("production.runs.shift_label", "Shift")}</span>
                  <p className="font-medium capitalize">{inspectRun.shift}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("production.runs.started_at", "Started")}</span>
                  <p className="font-medium">{new Date(inspectRun.started_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("production.runs.ended_at", "Ended")}</span>
                  <p className="font-medium">
                    {inspectRun.ended_at
                      ? new Date(inspectRun.ended_at).toLocaleString()
                      : t("production.runs.open", "open")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("production.runs.good_units", "Good units")}</span>
                  <p className="font-medium tabular-nums">{Number(inspectRun.good_units).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("production.overview.rejected", "Rejected")}</span>
                  <p className="font-medium tabular-nums">
                    {Number(inspectRun.reject_units).toLocaleString()}
                    {runYieldPercent(inspectRun.good_units, inspectRun.reject_units) !== null
                      ? ` (${runYieldPercent(inspectRun.good_units, inspectRun.reject_units)}% ${t("production.runs.yield", "yield")})`
                      : ""}
                  </p>
                </div>
                {inspectOee ? (
                  <>
                    <div>
                      <span className="text-muted-foreground">{t("production.overview.oee", "OEE")}</span>
                      <p className="font-medium tabular-nums">{inspectOee.oee.toFixed(1)}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("production.overview.downtime", "Downtime")}</span>
                      <p className="font-medium tabular-nums">
                        {downtimeMinutes(inspectRun).toLocaleString()} {t("production.common.min", "min")}
                        {Number(inspectRun.power_outage_minutes) > 0
                          ? ` · ${Number(inspectRun.power_outage_minutes)} ${t("production.runs.outage", "min grid outage")}`
                          : ""}
                      </p>
                    </div>
                  </>
                ) : null}
                {Number(inspectRun.water_consumed_litres) > 0 ? (
                  <div>
                    <span className="text-muted-foreground">{t("production.runs.water", "Water consumed")}</span>
                    <p className="font-medium tabular-nums">
                      {Number(inspectRun.water_consumed_litres).toLocaleString()} L
                    </p>
                  </div>
                ) : null}
              </div>

              {inspectRun.reject_breakdown && Object.keys(inspectRun.reject_breakdown).length > 0 ? (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-semibold">
                    {t("production.runs.reject_breakdown", "Reject breakdown")}
                  </p>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(inspectRun.reject_breakdown)
                      .filter(([, qty]) => Number(qty) > 0)
                      .map(([code, qty]) => (
                        <li key={code} className="flex justify-between gap-3">
                          <span className="capitalize">{defectLabel(code)}</span>
                          <span className="font-medium tabular-nums">{Number(qty).toLocaleString()}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {(inspectRun.downtime_events?.length ?? 0) > 0 ? (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-semibold">
                    {t("production.runs.stoppages", "Stoppages")}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {inspectRun.downtime_events?.map((event) => (
                      <li key={event.id} className="flex justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
                        <span>
                          {event.reason_label}{" "}
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {event.category}
                          </Badge>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {Number(event.duration_minutes).toLocaleString()} {t("production.common.min", "min")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {inspectRun.notes ? (
                <div>
                  <span className="text-sm text-muted-foreground">{t("production.common.notes", "Notes")}</span>
                  <p className="text-sm">{inspectRun.notes}</p>
                </div>
              ) : null}

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {inspectRun.order ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/production/orders?order_id=${inspectRun.production_order_id}`}>
                        <ScrollText className="mr-1 h-3.5 w-3.5" />
                        {t("production.runs.view_order", "Work order")}
                      </Link>
                    </Button>
                  ) : null}
                  {inspectRun.order?.batch_number ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/dashboard/production/traceability?batch=${encodeURIComponent(inspectRun.order.batch_number)}`}
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        {t("production.runs.trace_batch", "Trace batch")}
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canDowntime ? (
                    <Button size="sm" variant="outline" onClick={() => openDowntimeForRun(inspectRun)}>
                      <TimerOff className="mr-1 h-3.5 w-3.5" />
                      {t("production.runs.log_stoppage", "Log stoppage")}
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingRun(inspectRun);
                        setRunForm(runToForm(inspectRun));
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      {t("production.common.edit", "Edit")}
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button size="sm" variant="destructive" onClick={() => setDeleteRun(inspectRun)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {t("production.common.delete", "Delete")}
                    </Button>
                  ) : null}
                </div>
              </DialogFooter>
            </>
          ) : (
            <ProductionError error={detailQuery.error} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={downtimeRun !== null} onOpenChange={(open) => !open && setDowntimeRun(null)}>
        <DialogContent className="sm:max-w-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>{t("production.runs.downtime_title", "Log a stoppage")}</DialogTitle>
            <DialogDescription>
              {downtimeRun?.order?.order_number
                ? `${downtimeRun.order.order_number} · ${t("production.runs.shift", "shift")} ${downtimeRun.shift}`
                : t(
                    "production.runs.downtime_desc",
                    "The planned/unplanned split is derived from the reason, so the pareto cannot be skewed by mis-tagging.",
                  )}
            </DialogDescription>
          </DialogHeader>

          {(downtimeRun?.downtime_events?.length ?? 0) > 0 ? (
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <p className="mb-2 font-semibold">{t("production.runs.existing_stoppages", "Already logged")}</p>
              <ul className="space-y-1">
                {downtimeRun?.downtime_events?.map((event) => (
                  <li key={event.id} className="flex justify-between gap-2">
                    <span>{event.reason_label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Number(event.duration_minutes).toLocaleString()} {t("production.common.min", "min")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>{t("production.runs.reason", "Reason")}</Label>
              <Select
                value={downtimeForm.reason_code}
                onValueChange={(value) => setDowntimeForm((prev) => ({ ...prev, reason_code: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("production.runs.select_reason", "Select a reason")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reasonGroups).map(([group, groupReasons]) => (
                    <React.Fragment key={group}>
                      <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {group}
                      </div>
                      {groupReasons.map((reason) => (
                        <SelectItem key={reason.code} value={reason.code}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="downtime-start">{t("production.runs.started_at", "Started")}</Label>
              <Input
                id="downtime-start"
                type="datetime-local"
                value={downtimeForm.started_at}
                onChange={(event) => setDowntimeForm((prev) => ({ ...prev, started_at: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="downtime-end">{t("production.runs.ended_at", "Ended")}</Label>
              <Input
                id="downtime-end"
                type="datetime-local"
                value={downtimeForm.ended_at}
                onChange={(event) => setDowntimeForm((prev) => ({ ...prev, ended_at: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="downtime-notes">{t("production.common.notes", "Notes")}</Label>
              <Input
                id="downtime-notes"
                value={downtimeForm.notes}
                onChange={(event) => setDowntimeForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDowntimeRun(null)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={createDowntimeMutation.isPending}
              onClick={() => {
                if (!downtimeForm.reason_code || !downtimeForm.started_at) {
                  toast.error(t("production.runs.downtime_required", "Reason and start time are required."));
                  return;
                }
                createDowntimeMutation.mutate();
              }}
            >
              {createDowntimeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.runs.save_stoppage", "Save stoppage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteRun !== null} onOpenChange={(open) => !open && setDeleteRun(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("production.runs.delete_title", "Delete shift run?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "production.runs.delete_desc",
                "This removes the run and re-syncs the parent work order totals. Stoppages linked to this run are also removed.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("production.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRunMutation.isPending}
              onClick={() => deleteRunMutation.mutate()}
            >
              {t("production.common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProductionShell>
  );
}

function RunFormDialog({
  open,
  onOpenChange,
  title,
  description,
  form,
  setForm,
  lines,
  orders,
  orderSearch,
  setOrderSearch,
  ordersLoading,
  busy,
  submitLabel,
  onSubmit,
  orderReadOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  form: RunForm;
  setForm: React.Dispatch<React.SetStateAction<RunForm>>;
  lines: ProductionLine[];
  orders: ProductionOrder[];
  orderSearch: string;
  setOrderSearch: (value: string) => void;
  ordersLoading: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  orderReadOnly?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("production.runs.work_order", "Work order")}</Label>
              {!orderReadOnly ? (
                <Input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder={t("production.runs.search_order", "Search open orders...")}
                />
              ) : null}
              <Select
                value={form.production_order_id}
                disabled={orderReadOnly}
                onValueChange={(value) => {
                  const order = orders.find((candidate) => String(candidate.id) === value);
                  setForm((prev) => ({
                    ...prev,
                    production_order_id: value,
                    production_line_id: order?.production_line_id
                      ? String(order.production_line_id)
                      : prev.production_line_id,
                  }));
                }}
              >
                <SelectTrigger className={orderReadOnly ? "bg-muted" : undefined}>
                  <SelectValue
                    placeholder={
                      ordersLoading
                        ? t("production.common.loading", "Loading…")
                        : t("production.runs.select_order", "Select an open work order")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={String(order.id)}>
                      {order.order_number} — {t("production.orders.lot", "Lot")} {order.batch_number}
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
              <Label>{t("production.runs.shift_label", "Shift")}</Label>
              <Select value={form.shift} onValueChange={(value) => setForm((prev) => ({ ...prev, shift: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((shift) => (
                    <SelectItem key={shift} value={shift}>
                      {shift}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-planned">{t("production.runs.planned_minutes", "Planned runtime (min)")}</Label>
              <Input
                id="run-planned"
                type="number"
                value={form.planned_runtime_minutes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, planned_runtime_minutes: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-start">{t("production.runs.started_at", "Started")}</Label>
              <Input
                id="run-start"
                type="datetime-local"
                value={form.started_at}
                onChange={(event) => setForm((prev) => ({ ...prev, started_at: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-end">{t("production.runs.ended_at", "Ended")}</Label>
              <Input
                id="run-end"
                type="datetime-local"
                value={form.ended_at}
                onChange={(event) => setForm((prev) => ({ ...prev, ended_at: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-good">{t("production.runs.good_units", "Good units")}</Label>
              <Input
                id="run-good"
                type="number"
                value={form.good_units}
                onChange={(event) => setForm((prev) => ({ ...prev, good_units: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-water">{t("production.runs.water", "Water consumed (L)")}</Label>
              <Input
                id="run-water"
                type="number"
                step="0.01"
                value={form.water_consumed_litres}
                onChange={(event) => setForm((prev) => ({ ...prev, water_consumed_litres: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-outage">{t("production.runs.grid_outage", "Grid outage (min)")}</Label>
              <Input
                id="run-outage"
                type="number"
                step="0.01"
                value={form.power_outage_minutes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, power_outage_minutes: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-bold">{t("production.runs.reject_breakdown", "Reject breakdown")}</p>
              <p className="text-xs text-muted-foreground">
                {t("production.runs.reject_total", "Total")}:{" "}
                <span className="font-bold tabular-nums">
                  {rejectTotalFromForm(form.rejects).toLocaleString()}
                </span>
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {DEFECT_CODES.map((code) => (
                <div key={code} className="space-y-1">
                  <Label htmlFor={`reject-${code}`} className="text-xs capitalize">
                    {defectLabel(code)}
                  </Label>
                  <Input
                    id={`reject-${code}`}
                    type="number"
                    min="0"
                    className="h-9"
                    value={form.rejects[code] ?? ""}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        rejects: { ...prev.rejects, [code]: event.target.value },
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="run-notes">{t("production.common.notes", "Notes")}</Label>
            <Input
              id="run-notes"
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
