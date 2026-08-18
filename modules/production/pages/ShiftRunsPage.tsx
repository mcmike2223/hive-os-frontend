"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, TimerOff } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productionApi } from "@/modules/production/api";
import type {
  DowntimeReason,
  ProductionLine,
  ProductionOrder,
  ProductionRun,
} from "@/modules/production/types";

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
  sortCol: "started_at",
  sortDir: "desc",
};

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

type RunForm = {
  production_order_id: string;
  production_line_id: string;
  shift: string;
  started_at: string;
  ended_at: string;
  planned_runtime_minutes: string;
  good_units: string;
  water_consumed_litres: string;
  notes: string;
  rejects: Record<string, string>;
};

const DEFAULT_RUN_FORM: RunForm = {
  production_order_id: "",
  production_line_id: "",
  shift: "day",
  started_at: "",
  ended_at: "",
  planned_runtime_minutes: "480",
  good_units: "",
  water_consumed_litres: "",
  notes: "",
  rejects: {},
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
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [runOpen, setRunOpen] = React.useState(false);
  const [runForm, setRunForm] = React.useState<RunForm>(DEFAULT_RUN_FORM);
  const [downtimeRun, setDowntimeRun] = React.useState<ProductionRun | null>(null);
  const [downtimeForm, setDowntimeForm] = React.useState<DowntimeForm>(DEFAULT_DOWNTIME_FORM);

  const runsQuery = useQuery({
    queryKey: ["production", "runs", tableQuery],
    queryFn: () =>
      productionApi
        .listRuns({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          sort_col: tableQuery.sortCol,
          sort_dir: tableQuery.sortDir,
        })
        .then((res) => res.data),
  });

  const openOrdersQuery = useQuery({
    queryKey: ["production", "orders", "open"],
    queryFn: () => productionApi.listOrders({ limit: 100, open_only: true }).then((res) => res.data),
  });

  const linesQuery = useQuery({
    queryKey: ["production", "lines", "select"],
    queryFn: () => productionApi.listLines({ limit: 100, is_active: true }).then((res) => res.data),
  });

  const reasonsQuery = useQuery({
    queryKey: ["production", "downtime", "reasons"],
    queryFn: () => productionApi.listDowntimeReasons().then((res) => res.data),
  });

  const orders: ProductionOrder[] = openOrdersQuery.data?.data ?? [];
  const lines: ProductionLine[] = linesQuery.data?.data ?? [];
  const reasons: DowntimeReason[] = reasonsQuery.data?.data ?? [];

  const reasonGroups = React.useMemo(() => {
    return reasons.reduce<Record<string, DowntimeReason[]>>((groups, reason) => {
      (groups[reason.group] ||= []).push(reason);
      return groups;
    }, {});
  }, [reasons]);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "runs"] });
    queryClient.invalidateQueries({ queryKey: ["production", "orders"] });
    queryClient.invalidateQueries({ queryKey: ["production", "overview"] });
  }, [queryClient]);

  const createRunMutation = useMutation({
    mutationFn: () => {
      const rejectBreakdown = Object.entries(runForm.rejects)
        .filter(([, value]) => Number(value) > 0)
        .reduce<Record<string, number>>((acc, [code, value]) => {
          acc[code] = Number(value);
          return acc;
        }, {});

      const rejectTotal = Object.values(rejectBreakdown).reduce((sum, value) => sum + value, 0);

      return productionApi.createRun({
        production_order_id: Number(runForm.production_order_id),
        production_line_id: runForm.production_line_id ? Number(runForm.production_line_id) : undefined,
        shift: runForm.shift,
        started_at: runForm.started_at,
        ended_at: runForm.ended_at || undefined,
        planned_runtime_minutes: Number(runForm.planned_runtime_minutes || 0),
        good_units: Number(runForm.good_units || 0),
        reject_units: rejectTotal,
        reject_breakdown: rejectBreakdown,
        water_consumed_litres: Number(runForm.water_consumed_litres || 0),
        notes: runForm.notes || undefined,
      } as Partial<ProductionRun>);
    },
    onSuccess: () => {
      toast.success(t("production.runs.created", "Shift run recorded."));
      invalidate();
      setRunOpen(false);
      setRunForm(DEFAULT_RUN_FORM);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.runs.create_failed", "Could not record the run."));
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
      setDowntimeRun(null);
      setDowntimeForm(DEFAULT_DOWNTIME_FORM);
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || t("production.runs.downtime_failed", "Could not record the stoppage."),
      );
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
      sortCol: String(query.sortCol || "started_at"),
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
    });
  }, []);

  const columns = React.useMemo<ColumnDef<ProductionRun>[]>(
    () => [
      {
        id: "run",
        header: t("production.runs.col_run", "Run"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.order?.order_number ?? `#${row.original.production_order_id}`}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.line?.name ?? "-"} · {t("production.runs.shift", "shift")} {row.original.shift}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "started_at",
        header: t("production.runs.col_window", "Window"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{new Date(row.original.started_at).toLocaleString()}</p>
            <p className="text-muted-foreground">
              {row.original.ended_at ? new Date(row.original.ended_at).toLocaleTimeString() : t("production.runs.open", "open")}
            </p>
          </div>
        ),
      },
      {
        id: "output",
        header: t("production.runs.col_output", "Output"),
        cell: ({ row }) => (
          <div className="space-y-0.5 tabular-nums">
            <p className="text-sm font-semibold">{Number(row.original.good_units).toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">
              {Number(row.original.reject_units).toLocaleString()} {t("production.overview.rejected", "rejected")}
            </p>
          </div>
        ),
      },
      {
        id: "downtime",
        header: t("production.overview.downtime", "Downtime"),
        cell: ({ row }) => {
          const minutes = (row.original.downtime_events ?? []).reduce(
            (sum, event) => sum + Number(event.duration_minutes),
            0,
          );
          const outage = Number(row.original.power_outage_minutes);

          return (
            <div className="space-y-1">
              <p className="text-sm font-semibold tabular-nums">
                {minutes.toLocaleString()} {t("production.common.min", "min")}
              </p>
              {outage > 0 ? (
                <Badge variant="outline" className="border-transparent bg-amber-500/15 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
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
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              const run = row.original;
              setDowntimeRun(run);
              setDowntimeForm({
                ...DEFAULT_DOWNTIME_FORM,
                production_run_id: String(run.id),
                production_line_id: run.production_line_id ? String(run.production_line_id) : "",
              });
            }}
          >
            <TimerOff className="h-3 w-3" />
            {t("production.runs.log_stoppage", "Log Stoppage")}
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("production.runs.title", "Shift Runs")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "production.runs.subtitle",
              "Counts are entered once, here. Work order totals and OEE are both derived from these rows.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setRunForm(DEFAULT_RUN_FORM);
            setRunOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("production.runs.add_btn", "Record Shift Run")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(runsQuery.data?.data ?? []) as ProductionRun[]}
        totalEntries={runsQuery.data?.meta?.total ?? 0}
        loading={runsQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("production.runs.search_placeholder", "Search shift runs...")}
        resourceName="production-runs"
      />

      {/* Record run */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("production.runs.create_title", "Record Shift Run")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "production.runs.create_desc",
                  "Reject units are summed from the defect breakdown, so the reject pareto stays consistent across shifts.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("production.runs.work_order", "Work Order")}</Label>
                <Select
                  value={runForm.production_order_id}
                  onValueChange={(value) => {
                    const order = orders.find((candidate) => String(candidate.id) === value);
                    setRunForm((prev) => ({
                      ...prev,
                      production_order_id: value,
                      production_line_id: order?.production_line_id ? String(order.production_line_id) : prev.production_line_id,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("production.runs.select_order", "Select an open work order")} />
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
                  value={runForm.production_line_id}
                  onValueChange={(value) => setRunForm((prev) => ({ ...prev, production_line_id: value }))}
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
                <Select value={runForm.shift} onValueChange={(value) => setRunForm((prev) => ({ ...prev, shift: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["day", "night", "a", "b", "c"].map((shift) => (
                      <SelectItem key={shift} value={shift}>
                        {shift}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-planned">{t("production.runs.planned_minutes", "Planned Runtime (min)")}</Label>
                <Input
                  id="run-planned"
                  type="number"
                  value={runForm.planned_runtime_minutes}
                  onChange={(event) =>
                    setRunForm((prev) => ({ ...prev, planned_runtime_minutes: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-start">{t("production.runs.started_at", "Started")}</Label>
                <Input
                  id="run-start"
                  type="datetime-local"
                  value={runForm.started_at}
                  onChange={(event) => setRunForm((prev) => ({ ...prev, started_at: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-end">{t("production.runs.ended_at", "Ended")}</Label>
                <Input
                  id="run-end"
                  type="datetime-local"
                  value={runForm.ended_at}
                  onChange={(event) => setRunForm((prev) => ({ ...prev, ended_at: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-good">{t("production.runs.good_units", "Good Units")}</Label>
                <Input
                  id="run-good"
                  type="number"
                  value={runForm.good_units}
                  onChange={(event) => setRunForm((prev) => ({ ...prev, good_units: event.target.value }))}
                  placeholder="23100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-water">{t("production.runs.water", "Water Consumed (L)")}</Label>
                <Input
                  id="run-water"
                  type="number"
                  step="0.01"
                  value={runForm.water_consumed_litres}
                  onChange={(event) => setRunForm((prev) => ({ ...prev, water_consumed_litres: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold">{t("production.runs.reject_breakdown", "Reject Breakdown")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("production.runs.reject_total", "Total")}:{" "}
                  <span className="font-bold tabular-nums">
                    {Object.values(runForm.rejects)
                      .reduce((sum, value) => sum + (Number(value) || 0), 0)
                      .toLocaleString()}
                  </span>
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {DEFECT_CODES.map((code) => (
                  <div key={code} className="space-y-1">
                    <Label htmlFor={`reject-${code}`} className="text-xs capitalize">
                      {code.replace(/_/g, " ")}
                    </Label>
                    <Input
                      id={`reject-${code}`}
                      type="number"
                      min="0"
                      className="h-9"
                      value={runForm.rejects[code] ?? ""}
                      onChange={(event) =>
                        setRunForm((prev) => ({
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
                value={runForm.notes}
                onChange={(event) => setRunForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setRunOpen(false)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={createRunMutation.isPending}
              onClick={() => {
                if (!runForm.production_order_id || !runForm.started_at) {
                  toast.error(t("production.runs.required_fields", "Work order and start time are required."));
                  return;
                }
                createRunMutation.mutate();
              }}
            >
              {createRunMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.runs.save", "Save Run")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log downtime */}
      <Dialog open={downtimeRun !== null} onOpenChange={(open) => !open && setDowntimeRun(null)}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("production.runs.downtime_title", "Log a Stoppage")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "production.runs.downtime_desc",
                  "The planned/unplanned split is derived from the reason, so the pareto cannot be skewed by mis-tagging.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
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

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setDowntimeRun(null)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
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
              {t("production.runs.save_stoppage", "Save Stoppage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
