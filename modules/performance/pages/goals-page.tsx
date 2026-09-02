"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { performanceApi } from "@/modules/performance/api";
import type { Goal, PerformanceReferences } from "@/modules/performance/types";
import {
  BusyLabel,
  MetricCard,
  PerformanceError,
  PerformanceLoading,
  PerformanceShell,
  PerformanceStatus,
  PerformanceTable,
} from "@/modules/performance/pages/components/performance-shell";
import { useDebouncedValue } from "@/modules/performance/utils";

type GoalStatusFilter =
  | "all"
  | "draft"
  | "pending_approval"
  | "active"
  | "at_risk"
  | "blocked"
  | "completed"
  | "cancelled";

function goalTypeLabel(type: string): string {
  return type.replaceAll("_", " ").toUpperCase();
}

function metricTypeLabel(type: string): string {
  return type.replaceAll("_", " ");
}

function canEditGoal(goal: Goal): boolean {
  return !["completed", "cancelled"].includes(goal.status);
}

function needsAttention(goal: Goal): boolean {
  return ["at_risk", "blocked"].includes(goal.status);
}

function formatGoalValue(value: string | number, unit: string | null): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

function emptyGoalForm(cycleId = "", employeeId = "") {
  return {
    cycle_id: cycleId,
    employee_id: employeeId,
    title: "",
    description: "",
    goal_type: "okr",
    metric_type: "percentage",
    unit: "",
    baseline_value: "0",
    target_value: "100",
    current_value: "0",
    weight: "100",
    starts_on: "",
    due_on: "",
    owner_notes: "",
  };
}

function goalToForm(goal: Goal) {
  return {
    cycle_id: String(goal.cycle_id),
    employee_id: String(goal.employee_id),
    title: goal.title,
    description: goal.description ?? "",
    goal_type: goal.goal_type,
    metric_type: goal.metric_type,
    unit: goal.unit ?? "",
    baseline_value: String(goal.baseline_value),
    target_value: String(goal.target_value),
    current_value: String(goal.current_value),
    weight: String(goal.weight),
    starts_on: goal.starts_on ?? "",
    due_on: goal.due_on ?? "",
    owner_notes: goal.owner_notes ?? "",
  };
}

function hasActiveGoalFilters(opts: {
  search: string;
  status: GoalStatusFilter;
  cycleId: string;
  employeeId: string;
}): boolean {
  return Boolean(
    opts.search.trim() || opts.status !== "all" || opts.cycleId || opts.employeeId,
  );
}

function availableGoalActions(goal: Goal): Array<
  "submit" | "approve" | "mark-at-risk" | "block" | "cancel" | "reopen"
> {
  const actions: Array<"submit" | "approve" | "mark-at-risk" | "block" | "cancel" | "reopen"> = [];
  if (goal.status === "draft") actions.push("submit");
  if (goal.status === "pending_approval") actions.push("approve");
  if (!["completed", "cancelled"].includes(goal.status)) {
    actions.push("mark-at-risk", "block", "cancel");
  } else {
    actions.push("reopen");
  }
  return actions;
}

function actionLabel(
  action: "submit" | "approve" | "mark-at-risk" | "block" | "cancel" | "reopen",
): string {
  switch (action) {
    case "submit":
      return "Submit";
    case "approve":
      return "Approve";
    case "mark-at-risk":
      return "Mark at risk";
    case "block":
      return "Block";
    case "cancel":
      return "Cancel";
    case "reopen":
      return "Reopen";
  }
}

type GoalFormState = ReturnType<typeof emptyGoalForm>;
type GoalAction = "submit" | "approve" | "mark-at-risk" | "block" | "cancel" | "reopen";

export default function PerformanceGoalsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canCreate = hasAnyPermission([
    "manage_own_goals",
    "manage_team_goals",
    "manage_performance",
  ]);
  const canApprove = hasAnyPermission([
    "manage_team_goals",
    "approve_performance_goals",
    "manage_performance",
  ]);
  const canManageTeam = hasAnyPermission(["manage_team_goals", "manage_performance"]);

  const shouldOpenAdd = searchParams.get("add") === "1";
  const initialCycleId = searchParams.get("cycle_id") ?? "";
  const initialEmployeeId = searchParams.get("employee_id") ?? "";

  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = React.useState<GoalStatusFilter>(
    (searchParams.get("status") as GoalStatusFilter) || "all",
  );
  const [cycleFilter, setCycleFilter] = React.useState(initialCycleId);
  const [employeeFilter, setEmployeeFilter] = React.useState(initialEmployeeId);
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));
  const [focusGoalId, setFocusGoalId] = React.useState(searchParams.get("goal_id") ?? "");

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const [creating, setCreating] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<Goal | null>(null);
  const [inspecting, setInspecting] = React.useState<Goal | null>(null);
  const [notesAction, setNotesAction] = React.useState<{
    goal: Goal;
    action: "mark-at-risk" | "block";
  } | null>(null);
  const [actionNotes, setActionNotes] = React.useState("");
  const [form, setForm] = React.useState<GoalFormState>(
    emptyGoalForm(initialCycleId, initialEmployeeId),
  );

  const rowRefs = React.useRef<Record<number, HTMLTableRowElement | null>>({});
  const deepLinkHandled = React.useRef(false);

  const dashboardQuery = useQuery({
    queryKey: ["performance", "dashboard-goals"],
    queryFn: performanceApi.dashboard,
  });

  const referencesQuery = useQuery({
    queryKey: ["performance", "references-goals"],
    queryFn: performanceApi.references,
  });

  const goalsQuery = useQuery({
    queryKey: [
      "performance",
      "goals",
      debouncedSearch,
      statusFilter,
      cycleFilter,
      employeeFilter,
      page,
    ],
    queryFn: () =>
      performanceApi.goals({
        page,
        per_page: 25,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(cycleFilter ? { cycle_id: Number(cycleFilter) } : {}),
        ...(employeeFilter ? { employee_id: Number(employeeFilter) } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["performance"] });
  };

  const errorText = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error && "response" in error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      if (message) return message;
    }
    return fallback;
  };

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (cycleFilter) params.set("cycle_id", cycleFilter);
    if (employeeFilter) params.set("employee_id", employeeFilter);
    if (focusGoalId) params.set("goal_id", focusGoalId);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    cycleFilter,
    employeeFilter,
    focusGoalId,
    page,
    pathname,
    router,
    searchInput,
    statusFilter,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, cycleFilter, employeeFilter]);

  React.useEffect(() => {
    if (shouldOpenAdd && canCreate) setCreating(true);
  }, [shouldOpenAdd, canCreate]);

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [focusGoalId]);

  React.useEffect(() => {
    const rows = goalsQuery.data?.data ?? [];
    if (!focusGoalId || rows.length === 0 || deepLinkHandled.current) return;
    const goal = rows.find((row) => String(row.id) === focusGoalId);
    if (!goal) return;
    deepLinkHandled.current = true;
    const row = rowRefs.current[goal.id];
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    setInspecting(goal);
  }, [focusGoalId, goalsQuery.data?.data]);

  const saveGoal = useMutation({
    mutationFn: () => {
      const payload = {
        cycle_id: Number(form.cycle_id),
        employee_id: Number(form.employee_id),
        title: form.title,
        description: form.description || null,
        goal_type: form.goal_type,
        metric_type: form.metric_type,
        unit: form.unit || null,
        baseline_value: Number(form.baseline_value || 0),
        target_value: Number(form.target_value),
        current_value: Number(form.current_value || 0),
        weight: Number(form.weight),
        starts_on: form.starts_on || null,
        due_on: form.due_on || null,
        owner_notes: form.owner_notes || null,
        ...(editingGoal ? {} : { status: "draft" }),
      };
      return editingGoal
        ? performanceApi.updateGoal(editingGoal.id, payload)
        : performanceApi.createGoal(payload);
    },
    onSuccess: async () => {
      await refresh();
      toast.success(editingGoal ? "Goal updated." : "Goal created.");
      setCreating(false);
      setEditingGoal(null);
      setForm(emptyGoalForm(cycleFilter, employeeFilter));
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, "Goal could not be saved.")),
  });

  const updateProgress = useMutation({
    mutationFn: ({ id, current }: { id: number; current: number }) =>
      performanceApi.updateGoal(id, { current_value: current }),
    onSuccess: async () => {
      await refresh();
      toast.success("Goal progress updated.");
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, "Goal could not be updated.")),
  });

  const goalAction = useMutation({
    mutationFn: ({
      id,
      action,
      notes,
    }: {
      id: number;
      action: GoalAction;
      notes?: string;
    }) => performanceApi.goalAction(id, action, notes ? { notes } : {}),
    onSuccess: async () => {
      await refresh();
      toast.success("Goal status updated.");
      setNotesAction(null);
      setActionNotes("");
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, "Goal status could not be updated.")),
  });

  const goals = goalsQuery.data?.data ?? [];
  const meta = goalsQuery.data;
  const references = referencesQuery.data;
  const metrics = dashboardQuery.data?.metrics;
  const refetching = goalsQuery.isFetching && !goalsQuery.isLoading;
  const filtersActive = hasActiveGoalFilters({
    search: searchInput,
    status: statusFilter,
    cycleId: cycleFilter,
    employeeId: employeeFilter,
  });

  const cycleName = references?.cycles.find((cycle) => String(cycle.id) === cycleFilter)?.name;
  const employeeName = references?.employees.find(
    (employee) => String(employee.id) === employeeFilter,
  )?.primary_name;

  const openCreate = () => {
    setEditingGoal(null);
    setForm(
      emptyGoalForm(
        cycleFilter,
        employeeFilter || String(references?.current_employee_id ?? ""),
      ),
    );
    setCreating(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setForm(goalToForm(goal));
    setCreating(true);
  };

  const clearFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setCycleFilter("");
    setEmployeeFilter("");
    setFocusGoalId("");
  };

  const runAction = (goal: Goal, action: GoalAction) => {
    if (action === "approve" && !canApprove) {
      toast.error("You do not have permission to approve goals.");
      return;
    }
    if ((action === "mark-at-risk" || action === "block") && canManageTeam) {
      setNotesAction({ goal, action });
      setActionNotes(goal.manager_notes ?? "");
      return;
    }
    goalAction.mutate({ id: goal.id, action });
  };

  return (
    <PerformanceShell
      title="Goals and OKRs"
      description="Align employee outcomes to measurable targets, update progress during check-ins, approve commitments, and surface blocked work before review time."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              goalsQuery.refetch();
              dashboardQuery.refetch();
              referencesQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canCreate ? (
            <Button
              type="button"
              aria-expanded={creating}
              aria-controls="new-performance-goal"
              onClick={() => {
                if (creating) {
                  setCreating(false);
                  setEditingGoal(null);
                  setForm(emptyGoalForm(cycleFilter, employeeFilter));
                } else {
                  openCreate();
                }
              }}
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
              {creating ? "Close goal form" : "New goal"}
            </Button>
          ) : null}
        </div>
      }
    >
      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Goal progress"
            value={`${metrics.average_goal_progress.toFixed(1)}%`}
            description={`Average across ${metrics.goals_total} visible goal(s).`}
            status={metrics.goals_at_risk ? "at_risk" : "active"}
          />
          <Link href="/dashboard/performance/goals?status=at_risk" className="block">
            <MetricCard
              title="At risk"
              value={metrics.goals_at_risk}
              description="Goals flagged for manager intervention."
              status={metrics.goals_at_risk ? "at_risk" : "clear"}
            />
          </Link>
          <Link href="/dashboard/performance/goals?status=blocked" className="block">
            <MetricCard
              title="Blocked goals"
              value={
                dashboardQuery.data?.datasets.goal_status.find((row) => row.status === "blocked")
                  ?.value ?? 0
              }
              description="Commitments that cannot proceed without support."
              status="blocked"
            />
          </Link>
          <Link href="/dashboard/performance/cycles" className="block">
            <MetricCard
              title="Total goals"
              value={metrics.goals_total}
              description="Goals visible in your current scope."
            />
          </Link>
        </div>
      ) : null}

      {(cycleFilter || employeeFilter) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>
            {cycleFilter ? (
              <>
                Cycle <strong>{cycleName ?? `#${cycleFilter}`}</strong>
              </>
            ) : null}
            {cycleFilter && employeeFilter ? " · " : null}
            {employeeFilter ? (
              <>
                Employee <strong>{employeeName ?? `#${employeeFilter}`}</strong>
              </>
            ) : null}
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="goal-search" className="text-xs">
            Search
          </Label>
          <Input
            id="goal-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Title or description"
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="goal-status" className="text-xs">
            Status
          </Label>
          <NativeSelect
            id="goal-status"
            className="h-9 w-44"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as GoalStatusFilter)}
          >
            <NativeSelectOption value="all">Any status</NativeSelectOption>
            <NativeSelectOption value="draft">Draft</NativeSelectOption>
            <NativeSelectOption value="pending_approval">Pending approval</NativeSelectOption>
            <NativeSelectOption value="active">Active</NativeSelectOption>
            <NativeSelectOption value="at_risk">At risk</NativeSelectOption>
            <NativeSelectOption value="blocked">Blocked</NativeSelectOption>
            <NativeSelectOption value="completed">Completed</NativeSelectOption>
            <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
          </NativeSelect>
        </div>
        {references ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="goal-cycle-filter" className="text-xs">
                Cycle
              </Label>
              <NativeSelect
                id="goal-cycle-filter"
                className="h-9 w-48"
                value={cycleFilter || ""}
                onChange={(event) => setCycleFilter(event.target.value)}
              >
                <NativeSelectOption value="">Any cycle</NativeSelectOption>
                {references.cycles.map((cycle) => (
                  <NativeSelectOption key={cycle.id} value={String(cycle.id)}>
                    {cycle.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-employee-filter" className="text-xs">
                Employee
              </Label>
              <NativeSelect
                id="goal-employee-filter"
                className="h-9 w-48"
                value={employeeFilter || ""}
                onChange={(event) => setEmployeeFilter(event.target.value)}
              >
                <NativeSelectOption value="">Any employee</NativeSelectOption>
                {references.employees.map((employee) => (
                  <NativeSelectOption key={employee.id} value={String(employee.id)}>
                    {employee.primary_name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </>
        ) : null}
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {creating && canCreate && references ? (
        <GoalFormCard
          id="new-performance-goal"
          form={form}
          setForm={setForm}
          references={references}
          busy={saveGoal.isPending}
          editing={editingGoal}
          onSubmit={(event) => {
            event.preventDefault();
            saveGoal.mutate();
          }}
        />
      ) : null}

      {referencesQuery.error ? (
        <PerformanceError error={referencesQuery.error} title="Goal references could not be loaded" />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Goal portfolio</CardTitle>
          <CardDescription>
            Progress is calculated from baseline, current, and target values. A goal reaching its
            target is completed automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goalsQuery.isLoading ? (
            <PerformanceLoading cards={2} />
          ) : goalsQuery.error || !goalsQuery.data ? (
            <div className="space-y-3">
              <PerformanceError error={goalsQuery.error} />
              <Button variant="outline" size="sm" onClick={() => goalsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <PerformanceTable<Goal>
                caption="Visible employee goals ordered by risk and due date."
                rows={goals}
                getKey={(row) => row.id}
                rowRef={(row, node) => {
                  rowRefs.current[row.id] = node;
                }}
                columns={[
                  {
                    key: "goal",
                    label: "Goal",
                    render: (row) => (
                      <button
                        type="button"
                        className="min-w-52 text-left hover:underline"
                        onClick={() => {
                          setInspecting(row);
                          setFocusGoalId(String(row.id));
                        }}
                      >
                        <span className="font-medium">{row.title}</span>
                        <p className="text-xs text-muted-foreground">
                          {row.employee?.primary_name ?? `Employee ${row.employee_id}`} ·{" "}
                          {goalTypeLabel(row.goal_type)}
                          {needsAttention(row) ? " · needs attention" : ""}
                        </p>
                      </button>
                    ),
                  },
                  {
                    key: "cycle",
                    label: "Cycle",
                    render: (row) => (
                      <Link
                        href={`/dashboard/performance/goals?cycle_id=${row.cycle_id}`}
                        className="text-xs hover:underline"
                      >
                        {row.cycle?.name ?? "—"}
                      </Link>
                    ),
                  },
                  {
                    key: "progress",
                    label: "Progress",
                    render: (row) => (
                      <div className="min-w-36 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>{Number(row.progress_percent).toFixed(0)}%</span>
                          <span>
                            {formatGoalValue(row.current_value, row.unit ?? null)} /{" "}
                            {formatGoalValue(row.target_value, row.unit ?? null)}
                          </span>
                        </div>
                        <Progress
                          value={Number(row.progress_percent)}
                          aria-label={`${row.title} progress ${Number(row.progress_percent).toFixed(0)} percent`}
                        />
                      </div>
                    ),
                  },
                  {
                    key: "due",
                    label: "Due",
                    render: (row) => row.due_on ?? "No due date",
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => <PerformanceStatus value={row.status} />,
                  },
                  {
                    key: "actions",
                    label: "Update",
                    align: "right",
                    render: (row) => (
                      <GoalActions
                        goal={row}
                        canEdit={canEditGoal(row)}
                        canApprove={canApprove}
                        busy={updateProgress.isPending || goalAction.isPending}
                        onProgress={(current) => updateProgress.mutate({ id: row.id, current })}
                        onEdit={() => openEdit(row)}
                        onAction={(next) => runAction(row, next)}
                      />
                    ),
                  },
                ]}
              />

              {meta && meta.last_page > 1 ? (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Page {meta.current_page} of {meta.last_page} · {meta.total} goals
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={page >= meta.last_page}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={inspecting !== null} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="sm:max-w-lg">
          {inspecting ? (
            <>
              <DialogHeader>
                <DialogTitle>{inspecting.title}</DialogTitle>
                <DialogDescription>
                  {inspecting.employee?.primary_name ?? `Employee ${inspecting.employee_id}`} ·{" "}
                  {inspecting.cycle?.name ?? "No cycle"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <PerformanceStatus value={inspecting.status} />
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="tabular-nums">{Number(inspecting.progress_percent).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Measurement</span>
                  <span>
                    {metricTypeLabel(inspecting.metric_type)} · weight {Number(inspecting.weight)}%
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Values</span>
                  <span className="text-right tabular-nums">
                    {formatGoalValue(inspecting.baseline_value, inspecting.unit ?? null)} →{" "}
                    {formatGoalValue(inspecting.current_value, inspecting.unit ?? null)} /{" "}
                    {formatGoalValue(inspecting.target_value, inspecting.unit ?? null)}
                  </span>
                </div>
                {inspecting.description ? (
                  <p className="rounded-lg border bg-muted/30 p-3 text-muted-foreground">
                    {inspecting.description}
                  </p>
                ) : null}
                {inspecting.owner_notes ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Employee notes:</span>{" "}
                    {inspecting.owner_notes}
                  </p>
                ) : null}
                {inspecting.manager_notes ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Manager notes:</span>{" "}
                    {inspecting.manager_notes}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="flex-wrap gap-2">
                {inspecting.cycle_id ? (
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/performance/cycles?cycle_id=${inspecting.cycle_id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open cycle
                    </Link>
                  </Button>
                ) : null}
                {canCreate && canEditGoal(inspecting) ? (
                  <Button
                    onClick={() => {
                      setInspecting(null);
                      openEdit(inspecting);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={notesAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNotesAction(null);
            setActionNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {notesAction ? (
            <>
              <DialogHeader>
                <DialogTitle>{actionLabel(notesAction.action)}</DialogTitle>
                <DialogDescription>
                  Optional context for {notesAction.goal.title} — visible to managers reviewing this
                  goal.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="goal-action-notes">Manager notes</Label>
                <Textarea
                  id="goal-action-notes"
                  value={actionNotes}
                  onChange={(event) => setActionNotes(event.target.value)}
                  maxLength={6000}
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setNotesAction(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={goalAction.isPending}
                  onClick={() =>
                    goalAction.mutate({
                      id: notesAction.goal.id,
                      action: notesAction.action,
                      notes: actionNotes,
                    })
                  }
                >
                  {actionLabel(notesAction.action)}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PerformanceShell>
  );
}

function GoalFormCard({
  id,
  form,
  setForm,
  references,
  busy,
  editing,
  onSubmit,
}: {
  id: string;
  form: GoalFormState;
  setForm: React.Dispatch<React.SetStateAction<GoalFormState>>;
  references: PerformanceReferences;
  busy: boolean;
  editing: Goal | null;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const openCycles = references.cycles.filter(
    (cycle) => !["completed", "cancelled"].includes(cycle.status),
  );

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>
          <h2>{editing ? "Edit employee goal" : "Create employee goal"}</h2>
        </CardTitle>
        <CardDescription>
          Set one measurable outcome. Required fields are identified in each label.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Employee (required)" id="goal-employee">
              <NativeSelect
                id="goal-employee"
                className="w-full"
                value={form.employee_id}
                onChange={(event) => setForm({ ...form, employee_id: event.target.value })}
                required
                disabled={Boolean(editing)}
              >
                <NativeSelectOption value="" disabled>
                  Select employee
                </NativeSelectOption>
                {references.employees.map((employee) => (
                  <NativeSelectOption key={employee.id} value={String(employee.id)}>
                    {employee.primary_name} ({employee.employee_number})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Review cycle (required)" id="goal-cycle">
              <NativeSelect
                id="goal-cycle"
                className="w-full"
                value={form.cycle_id}
                onChange={(event) => setForm({ ...form, cycle_id: event.target.value })}
                required
                disabled={Boolean(editing)}
              >
                <NativeSelectOption value="" disabled>
                  Select cycle
                </NativeSelectOption>
                {openCycles.map((cycle) => (
                  <NativeSelectOption key={cycle.id} value={String(cycle.id)}>
                    {cycle.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField label="Goal title (required)" id="goal-title">
            <Input
              id="goal-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
              maxLength={220}
            />
          </FormField>
          <FormField label="Outcome description" id="goal-description">
            <Textarea
              id="goal-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={6000}
            />
          </FormField>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Goal type (required)" id="goal-type">
              <NativeSelect
                id="goal-type"
                className="w-full"
                value={form.goal_type}
                onChange={(event) => setForm({ ...form, goal_type: event.target.value })}
                required
              >
                {["okr", "kpi", "development", "project", "behavioral"].map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Measurement (required)" id="goal-metric">
              <NativeSelect
                id="goal-metric"
                className="w-full"
                value={form.metric_type}
                onChange={(event) => setForm({ ...form, metric_type: event.target.value })}
                required
              >
                {["percentage", "number", "currency", "binary", "milestone"].map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Unit" id="goal-unit">
              <Input
                id="goal-unit"
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                maxLength={40}
                placeholder="%, ETB, cases"
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField
              id="goal-baseline"
              label="Baseline"
              value={form.baseline_value}
              onChange={(value) => setForm({ ...form, baseline_value: value })}
            />
            <NumberField
              id="goal-current"
              label="Current value"
              value={form.current_value}
              onChange={(value) => setForm({ ...form, current_value: value })}
            />
            <NumberField
              id="goal-target"
              label="Target (required)"
              value={form.target_value}
              onChange={(value) => setForm({ ...form, target_value: value })}
              required
            />
            <NumberField
              id="goal-weight"
              label="Weight percent (required)"
              value={form.weight}
              onChange={(value) => setForm({ ...form, weight: value })}
              required
              min="0"
              max="100"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DateField
              id="goal-start"
              label="Starts on"
              value={form.starts_on}
              onChange={(value) => setForm({ ...form, starts_on: value })}
            />
            <DateField
              id="goal-due"
              label="Due on"
              value={form.due_on}
              onChange={(value) => setForm({ ...form, due_on: value })}
            />
          </div>
          <FormField label="Employee notes" id="goal-notes">
            <Textarea
              id="goal-notes"
              value={form.owner_notes}
              onChange={(event) => setForm({ ...form, owner_notes: event.target.value })}
              maxLength={6000}
            />
          </FormField>
          <Button type="submit" className="w-fit" disabled={busy}>
            <BusyLabel busy={busy}>{editing ? "Save changes" : "Create goal"}</BusyLabel>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function GoalActions({
  goal,
  canEdit,
  canApprove,
  busy,
  onProgress,
  onEdit,
  onAction,
}: {
  goal: Goal;
  canEdit: boolean;
  canApprove: boolean;
  busy: boolean;
  onProgress: (value: number) => void;
  onEdit: () => void;
  onAction: (action: GoalAction) => void;
}) {
  const [current, setCurrent] = React.useState(String(Number(goal.current_value)));
  const locked = !canEdit;

  React.useEffect(() => {
    setCurrent(String(Number(goal.current_value)));
  }, [goal.current_value]);

  const actions = availableGoalActions(goal).filter((action) => {
    if (action === "approve") return canApprove;
    if (action === "submit") return true;
    return true;
  });

  return (
    <div className="flex min-w-60 flex-col items-end gap-2">
      <form
        className="flex gap-2"
        aria-label={`Update ${goal.title} progress`}
        onSubmit={(event) => {
          event.preventDefault();
          onProgress(Number(current));
        }}
      >
        <Label htmlFor={`goal-current-${goal.id}`} className="sr-only">
          Current value for {goal.title}
        </Label>
        <Input
          id={`goal-current-${goal.id}`}
          name="current"
          type="number"
          step="0.01"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          className="w-24"
          disabled={locked || busy}
        />
        <Button type="submit" size="sm" variant="outline" disabled={locked || busy}>
          <Target aria-hidden="true" data-icon="inline-start" />
          Save
        </Button>
      </form>
      <div className="flex gap-2">
        {canEdit ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Label htmlFor={`goal-action-${goal.id}`} className="sr-only">
          Action for {goal.title}
        </Label>
        <NativeSelect
          id={`goal-action-${goal.id}`}
          value=""
          className="w-36"
          disabled={busy || actions.length === 0}
          onChange={(event) => {
            const value = event.target.value as GoalAction;
            if (value) onAction(value);
          }}
        >
          <NativeSelectOption value="">Choose action</NativeSelectOption>
          {actions.map((action) => (
            <NativeSelectOption key={action} value={action}>
              {actionLabel(action)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  required,
  min,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <FormField id={id} label={label}>
      <Input
        id={id}
        type="number"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        min={min}
        max={max}
      />
    </FormField>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField id={id} label={label}>
      <Input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </FormField>
  );
}
