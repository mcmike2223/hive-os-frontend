"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { talentApi } from "@/modules/humanresources/talent/api";
import type {
  OffboardingCase,
  OffboardingSummary,
  OffboardingTask,
} from "@/modules/humanresources/talent/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart } from "@/modules/shared/charts/charts";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const EXIT_TYPES = [
  "resignation",
  "termination",
  "retirement",
  "end_of_contract",
  "redundancy",
  "death",
] as const;

const CASE_TONE: Record<string, string> = {
  open: "secondary",
  in_progress: "secondary",
  cleared: "default",
  completed: "default",
  cancelled: "outline",
};

export default function OffboardingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    employee_id: "",
    exit_type: "resignation",
    notified_on: "",
    last_working_day: "",
  });
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [settleOpen, setSettleOpen] = React.useState(false);
  const [settleAmount, setSettleAmount] = React.useState("");
  const [settleNotes, setSettleNotes] = React.useState("");

  const listQuery = useQuery({
    queryKey: ["hr-talent", "offboarding", tableQuery],
    queryFn: () =>
      talentApi
        .listOffboarding({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
        })
        .then((res) => res.data),
  });

  const summaryQuery = useQuery({
    queryKey: ["hr-talent", "offboarding", "summary"],
    queryFn: () => talentApi.offboardingSummary().then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["hr-talent", "offboarding", "detail", detailId],
    queryFn: () => talentApi.getOffboarding(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["hr-talent"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const open = useMutation({
    mutationFn: () =>
      talentApi.createOffboarding({
        employee_id: Number(form.employee_id),
        exit_type: form.exit_type,
        notified_on: form.notified_on || null,
        last_working_day: form.last_working_day || null,
      }),
    onSuccess: () => {
      toast.success(
        t("hr_talent.offboarding.opened", "Exit opened with the standard clearance checklist."),
      );
      invalidate();
      setFormOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.offboarding.open_failed", "Could not open the exit."))),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      talentApi.updateOffboardingTask(id, { status }),
    onSuccess: () => {
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.offboarding.task_failed", "Could not update the task."))),
  });

  // The service refuses to clear while a blocking task is outstanding. Its
  // refusal message names how many, so relay it rather than replacing it.
  const clear = useMutation({
    mutationFn: (id: number) => talentApi.clearOffboarding(id),
    onSuccess: () => {
      toast.success(t("hr_talent.offboarding.cleared", "Exit cleared."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.offboarding.clear_failed", "Could not clear the exit."))),
  });

  const settle = useMutation({
    mutationFn: () =>
      talentApi.settleOffboarding(detailId!, {
        final_settlement_amount: Number(settleAmount || 0),
        notes: settleNotes || null,
      }),
    onSuccess: () => {
      toast.success(t("hr_talent.offboarding.settled", "Final settlement recorded."));
      invalidate();
      setSettleOpen(false);
      setSettleAmount("");
      setSettleNotes("");
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.offboarding.settle_failed", "Could not settle the exit."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const summary: OffboardingSummary | undefined = summaryQuery.data?.data;
  const detail: OffboardingCase | undefined = detailQuery.data?.data;

  const columns = React.useMemo<ColumnDef<OffboardingCase>[]>(
    () => [
      {
        id: "case",
        header: t("hr_talent.offboarding.case", "Case"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-bold">{row.original.case_number}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.employee?.primary_name ?? `#${row.original.employee_id}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "exit_type",
        header: t("hr_talent.offboarding.exit_type", "Exit type"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] capitalize">
            {String(row.original.exit_type).replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "last_working_day",
        header: t("hr_talent.offboarding.last_day", "Last day"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.last_working_day ? String(row.original.last_working_day).slice(0, 10) : "—"}
          </span>
        ),
      },
      {
        id: "progress",
        header: t("hr_talent.offboarding.clearance", "Clearance"),
        cell: ({ row }) => {
          const percent = n(row.original.completion_percent);
          const blocking = n(row.original.blocking_tasks_outstanding);
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums">{percent.toFixed(0)}%</span>
              </div>
              {blocking > 0 ? (
                <p className="text-[11px] font-semibold text-destructive">
                  {t("hr_talent.offboarding.blocking", "{n} blocking").replace("{n}", String(blocking))}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "access",
        header: t("hr_talent.offboarding.access", "Access"),
        cell: ({ row }) =>
          row.original.access_revoked_at ? (
            <Badge className="text-[11px]">{t("hr_talent.offboarding.revoked", "Revoked")}</Badge>
          ) : (
            <Badge variant="destructive" className="text-[11px]">
              {t("hr_talent.offboarding.active_access", "Still active")}
            </Badge>
          ),
      },
      {
        accessorKey: "status",
        header: t("hr_talent.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant={(CASE_TONE[row.original.status] ?? "outline") as any} className="text-[11px] capitalize">
            {row.original.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setDetailId(row.original.id)}>
              {t("hr_talent.common.open", "Open")}
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("hr_talent.offboarding.title", "Offboarding and Clearance")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "hr_talent.offboarding.subtitle",
              "Every exit gets the same checklist across HR, IT, facilities and finance — and cannot be settled until the blocking items are done.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("hr_talent.offboarding.open_case", "Open Exit")}
        </Button>
      </div>

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("hr_talent.offboarding.open_cases", "Open exits")}
              value={n(summary.open_cases).toLocaleString()}
              meta={t("hr_talent.offboarding.total_meta", "{n} in total").replace(
                "{n}",
                String(n(summary.total_cases)),
              )}
            />
            <StatTile
              label={t("hr_talent.offboarding.blocked", "Blocked from clearance")}
              value={n(summary.blocked_cases).toLocaleString()}
              alert={n(summary.blocked_cases) > 0}
            />
            <StatTile
              label={t("hr_talent.offboarding.overdue", "Overdue tasks")}
              value={n(summary.overdue_tasks).toLocaleString()}
              alert={n(summary.overdue_tasks) > 0}
            />
            <StatTile
              label={t("hr_talent.offboarding.avg_progress", "Average clearance")}
              value={`${n(summary.average_completion_percent).toFixed(0)}%`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RankedBarChart
              title={t("hr_talent.offboarding.by_department", "Outstanding by department")}
              description={t(
                "hr_talent.offboarding.by_department_desc",
                "Who is holding up clearance, and how much of it is blocking.",
              )}
              rows={(summary.outstanding_by_department ?? []).map((row) => ({
                key: row.department,
                label: row.department,
                value: n(row.outstanding),
                meta: t("hr_talent.offboarding.blocking", "{n} blocking").replace(
                  "{n}",
                  String(n(row.blocking)),
                ),
              }))}
              valueLabel={t("hr_talent.offboarding.open_tasks", "Open tasks")}
              emptyLabel={t("hr_talent.offboarding.nothing_outstanding", "Nothing outstanding.")}
            />
            <ColumnChart
              title={t("hr_talent.offboarding.by_exit_type", "Exits by reason")}
              description={t(
                "hr_talent.offboarding.by_exit_type_desc",
                "Why people are leaving, across every case on record.",
              )}
              rows={(summary.by_exit_type ?? []).map((row) => ({
                key: row.exit_type,
                label: String(row.exit_type).replace(/_/g, " "),
                value: n(row.count),
              }))}
              valueLabel={t("hr_talent.offboarding.cases", "Cases")}
              emptyLabel={t("hr_talent.offboarding.no_cases", "No exits recorded.")}
            />
          </div>
        </>
      ) : null}

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as OffboardingCase[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("hr_talent.offboarding.search", "Search exits...")}
        resourceName="hr-offboarding"
      />

      {/* Open a case */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("hr_talent.offboarding.open_case", "Open Exit")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.offboarding.open_desc",
                  "The standard clearance checklist is created automatically across every department that has to sign off.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="exit-employee">{t("hr_talent.common.employee_id", "Employee ID")}</Label>
              <Input
                id="exit-employee"
                type="number"
                value={form.employee_id}
                onChange={(event) => setForm({ ...form, employee_id: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exit-type">{t("hr_talent.offboarding.exit_type", "Exit type")}</Label>
              <select
                id="exit-type"
                value={form.exit_type}
                onChange={(event) => setForm({ ...form, exit_type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {EXIT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exit-notice">{t("hr_talent.offboarding.notice", "Notice given")}</Label>
              <Input
                id="exit-notice"
                type="date"
                value={form.notified_on}
                onChange={(event) => setForm({ ...form, notified_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exit-last">{t("hr_talent.offboarding.last_day", "Last working day")}</Label>
              <Input
                id="exit-last"
                type="date"
                min={form.notified_on || undefined}
                value={form.last_working_day}
                onChange={(event) => setForm({ ...form, last_working_day: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => open.mutate()} disabled={open.isPending || !form.employee_id}>
              {t("hr_talent.offboarding.open_case", "Open Exit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case detail */}
      <Dialog open={detailId !== null} onOpenChange={(isOpen) => !isOpen && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail ? detail.case_number : t("hr_talent.offboarding.case", "Case")}
              </DialogTitle>
              <DialogDescription>
                {detail
                  ? `${detail.employee?.primary_name ?? `#${detail.employee_id}`} — ${String(
                      detail.exit_type,
                    ).replace(/_/g, " ")}`
                  : t("hr_talent.common.loading", "Loading...")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            {detail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile
                    label={t("hr_talent.offboarding.clearance", "Clearance")}
                    value={`${n(detail.completion_percent).toFixed(0)}%`}
                  />
                  <StatTile
                    label={t("hr_talent.offboarding.blocking_outstanding", "Blocking left")}
                    value={n(detail.blocking_tasks_outstanding).toLocaleString()}
                    alert={n(detail.blocking_tasks_outstanding) > 0}
                  />
                  <StatTile
                    label={t("hr_talent.offboarding.settlement", "Final settlement")}
                    value={detail.settled_at ? money(detail.final_settlement_amount) : "—"}
                    meta={
                      detail.settled_at
                        ? String(detail.settled_at).slice(0, 10)
                        : t("hr_talent.offboarding.not_settled", "Not settled")
                    }
                  />
                </div>

                <Panel title={t("hr_talent.offboarding.checklist", "Clearance checklist")}>
                  {(detail.tasks ?? []).length === 0 ? (
                    <EmptyPanel label={t("hr_talent.offboarding.no_tasks", "No tasks on this case.")} />
                  ) : (
                    <div className="space-y-2">
                      {detail.tasks!.map((task: OffboardingTask) => {
                        const done = task.status === "done" || task.status === "waived";
                        return (
                          <div
                            key={task.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
                                {task.title}
                              </p>
                              <p className="text-[11px] capitalize text-muted-foreground">
                                {task.department.replace(/_/g, " ")}
                                {task.is_blocking
                                  ? ` · ${t("hr_talent.offboarding.blocks_clearance", "blocks clearance")}`
                                  : ""}
                                {task.due_on ? ` · ${t("hr_talent.common.due", "due")} ${task.due_on}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              {done ? (
                                <Badge variant="outline" className="text-[11px] capitalize">
                                  {task.status}
                                </Badge>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-[11px]"
                                    disabled={updateTask.isPending}
                                    onClick={() => updateTask.mutate({ id: task.id, status: "done" })}
                                  >
                                    {t("hr_talent.offboarding.mark_done", "Done")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-[11px]"
                                    disabled={updateTask.isPending}
                                    onClick={() => updateTask.mutate({ id: task.id, status: "waived" })}
                                  >
                                    {t("hr_talent.offboarding.waive", "Waive")}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              </>
            ) : null}
          </div>

          <DialogFooter className="flex-wrap gap-2 border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDetailId(null)}>
              {t("hr_talent.common.close", "Close")}
            </Button>
            {detail && detail.status !== "completed" ? (
              <>
                <Button
                  variant="outline"
                  disabled={clear.isPending || n(detail.blocking_tasks_outstanding) > 0}
                  onClick={() => clear.mutate(detail.id)}
                  title={
                    n(detail.blocking_tasks_outstanding) > 0
                      ? t(
                          "hr_talent.offboarding.blocked_hint",
                          "Blocking tasks must be done before this exit can be cleared.",
                        )
                      : undefined
                  }
                >
                  {t("hr_talent.offboarding.clear", "Clear")}
                </Button>
                <Button
                  disabled={n(detail.blocking_tasks_outstanding) > 0}
                  onClick={() => {
                    setSettleAmount("");
                    setSettleNotes("");
                    setSettleOpen(true);
                  }}
                >
                  {t("hr_talent.offboarding.settle", "Settle")}
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settlement */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("hr_talent.offboarding.settle", "Final Settlement")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.offboarding.settle_desc",
                  "Settling closes the case. It is refused while any blocking clearance task is outstanding.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="settle-amount">{t("hr_talent.offboarding.amount", "Settlement amount")}</Label>
              <Input
                id="settle-amount"
                type="number"
                min={0}
                value={settleAmount}
                onChange={(event) => setSettleAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settle-notes">
                {t("hr_talent.offboarding.interview_notes", "Exit interview notes")}
              </Label>
              <Textarea
                id="settle-notes"
                rows={4}
                value={settleNotes}
                onChange={(event) => setSettleNotes(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setSettleOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => settle.mutate()} disabled={settle.isPending || settleAmount === ""}>
              {t("hr_talent.offboarding.settle", "Settle")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
