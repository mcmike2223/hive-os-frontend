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
  Play,
  Plus,
  RefreshCw,
  SlidersHorizontal,
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
import type { EmployeeRef, ReviewCycle } from "@/modules/performance/types";
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

type CycleStatusFilter =
  | "all"
  | "draft"
  | "active"
  | "calibration"
  | "completed"
  | "cancelled";

function completionPercent(cycle: ReviewCycle): number {
  const total = Number(cycle.reviews_count ?? 0);
  const done = Number(cycle.completed_reviews_count ?? 0);
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function cycleTypeLabel(type: string): string {
  return type.replaceAll("_", " ");
}

function nextCycleAction(
  status: string,
): "activate" | "open-calibration" | "complete" | null {
  if (status === "draft") return "activate";
  if (status === "active") return "open-calibration";
  if (status === "calibration") return "complete";
  return null;
}

function canEditCycle(cycle: ReviewCycle): boolean {
  return !["completed", "cancelled"].includes(cycle.status);
}

function emptyCycleForm(year = new Date().getFullYear()) {
  return {
    code: `FY${String(year).slice(-2)}`,
    name: `Annual performance ${year}`,
    description: "",
    cycle_type: "annual",
    period_start: "",
    period_end: "",
    self_review_due_on: "",
    manager_review_due_on: "",
    calibration_due_on: "",
    goal_weight: "60",
    competency_weight: "40",
    requires_calibration: true,
  };
}

function cycleToForm(cycle: ReviewCycle) {
  return {
    code: cycle.code,
    name: cycle.name,
    description: cycle.description ?? "",
    cycle_type: cycle.cycle_type,
    period_start: cycle.period_start,
    period_end: cycle.period_end,
    self_review_due_on: cycle.self_review_due_on ?? "",
    manager_review_due_on: cycle.manager_review_due_on ?? "",
    calibration_due_on: cycle.calibration_due_on ?? "",
    goal_weight: String(cycle.goal_weight),
    competency_weight: String(cycle.competency_weight),
    requires_calibration: cycle.settings?.requires_calibration !== false,
  };
}

function weightsAreValid(goalWeight: string, competencyWeight: string): boolean {
  const goal = Number(goalWeight);
  const competency = Number(competencyWeight);
  if (!Number.isFinite(goal) || !Number.isFinite(competency)) return false;
  return Math.abs(goal + competency - 100) < 0.001;
}

function hasActiveCycleFilters(opts: {
  search: string;
  status: CycleStatusFilter;
}): boolean {
  return Boolean(opts.search.trim() || opts.status !== "all");
}

function actionLabel(action: "activate" | "open-calibration" | "complete" | "cancel"): string {
  switch (action) {
    case "activate":
      return "Activate";
    case "open-calibration":
      return "Open calibration";
    case "complete":
      return "Complete cycle";
    case "cancel":
      return "Cancel";
  }
}

type CycleFormState = ReturnType<typeof emptyCycleForm>;

export default function PerformanceCyclesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canManage = hasAnyPermission(["manage_performance_cycles", "manage_performance"]);

  const shouldOpenAdd = searchParams.get("add") === "1";

  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = React.useState<CycleStatusFilter>(
    (searchParams.get("status") as CycleStatusFilter) || "all",
  );
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));
  const [focusCycleId, setFocusCycleId] = React.useState(searchParams.get("cycle_id") ?? "");

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const [creating, setCreating] = React.useState(false);
  const [editingCycle, setEditingCycle] = React.useState<ReviewCycle | null>(null);
  const [inspecting, setInspecting] = React.useState<ReviewCycle | null>(null);
  const [activating, setActivating] = React.useState<ReviewCycle | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<number[]>([]);
  const [form, setForm] = React.useState<CycleFormState>(emptyCycleForm());

  const rowRefs = React.useRef<Record<number, HTMLTableRowElement | null>>({});
  const deepLinkHandled = React.useRef(false);

  const dashboardQuery = useQuery({
    queryKey: ["performance", "dashboard-cycles"],
    queryFn: performanceApi.dashboard,
  });

  const referencesQuery = useQuery({
    queryKey: ["performance", "references-cycles"],
    queryFn: performanceApi.references,
    enabled: canManage,
  });

  const cyclesQuery = useQuery({
    queryKey: ["performance", "cycles", debouncedSearch, statusFilter, page],
    queryFn: () =>
      performanceApi.cycles({
        page,
        per_page: 25,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["performance"] });
  };

  const errorText = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error && "response" in error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (message) return message;
    }
    return fallback;
  };

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (focusCycleId) params.set("cycle_id", focusCycleId);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [focusCycleId, page, pathname, router, searchInput, statusFilter]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  React.useEffect(() => {
    if (shouldOpenAdd && canManage) setCreating(true);
  }, [shouldOpenAdd, canManage]);

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [focusCycleId]);

  React.useEffect(() => {
    const rows = cyclesQuery.data?.data ?? [];
    if (!focusCycleId || rows.length === 0 || deepLinkHandled.current) return;
    const cycle = rows.find((row) => String(row.id) === focusCycleId);
    if (!cycle) return;
    deepLinkHandled.current = true;
    const row = rowRefs.current[cycle.id];
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    setInspecting(cycle);
  }, [focusCycleId, cyclesQuery.data?.data]);

  const saveCycle = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        cycle_type: form.cycle_type,
        period_start: form.period_start,
        period_end: form.period_end,
        self_review_due_on: form.self_review_due_on || null,
        manager_review_due_on: form.manager_review_due_on || null,
        calibration_due_on: form.calibration_due_on || null,
        goal_weight: Number(form.goal_weight),
        competency_weight: Number(form.competency_weight),
        settings: { requires_calibration: form.requires_calibration },
      };
      return editingCycle
        ? performanceApi.updateCycle(editingCycle.id, payload)
        : performanceApi.createCycle(payload);
    },
    onSuccess: async () => {
      await refresh();
      toast.success(editingCycle ? "Review cycle updated." : "Review cycle created.");
      setCreating(false);
      setEditingCycle(null);
      setForm(emptyCycleForm());
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, "Review cycle could not be saved.")),
  });

  const action = useMutation({
    mutationFn: ({
      id,
      action: next,
      employeeIds,
    }: {
      id: number;
      action: "activate" | "open-calibration" | "complete" | "cancel";
      employeeIds?: number[];
    }) =>
      performanceApi.cycleAction(
        id,
        next,
        next === "activate" && employeeIds?.length ? { employee_ids: employeeIds } : {},
      ),
    onSuccess: async (response: unknown) => {
      await refresh();
      const retained = (response as { reviews_created_or_retained?: number })?.reviews_created_or_retained;
      toast.success(
        retained
          ? `Review cycle updated. ${retained} employee review(s) created or retained.`
          : "Review cycle updated.",
      );
      setActivating(null);
      setSelectedEmployeeIds([]);
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, "Review cycle action could not be completed.")),
  });

  const cycles = cyclesQuery.data?.data ?? [];
  const meta = cyclesQuery.data;
  const employees = referencesQuery.data?.employees ?? [];
  const refetching = cyclesQuery.isFetching && !cyclesQuery.isLoading;
  const filtersActive = hasActiveCycleFilters({ search: searchInput, status: statusFilter });
  const metrics = dashboardQuery.data?.metrics;

  const openCreate = () => {
    setEditingCycle(null);
    setForm(emptyCycleForm());
    setCreating(true);
  };

  const openEdit = (cycle: ReviewCycle) => {
    setEditingCycle(cycle);
    setForm(cycleToForm(cycle));
    setCreating(true);
  };

  const clearFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setFocusCycleId("");
  };

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!weightsAreValid(form.goal_weight, form.competency_weight)) {
      toast.error("Goal and competency weights must total exactly 100%.");
      return;
    }
    saveCycle.mutate();
  };

  return (
    <PerformanceShell
      title="Review cycles"
      description="Design fair review periods, balance outcomes and behaviors, create employee reviews, calibrate results, and lock completed cycles."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              cyclesQuery.refetch();
              dashboardQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canManage ? (
            <Button
              type="button"
              aria-expanded={creating}
              aria-controls="new-performance-cycle"
              onClick={() => {
                if (creating) {
                  setCreating(false);
                  setEditingCycle(null);
                  setForm(emptyCycleForm());
                } else {
                  openCreate();
                }
              }}
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
              {creating ? "Close cycle form" : "New review cycle"}
            </Button>
          ) : null}
        </div>
      }
    >
      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Active cycles"
            value={metrics.active_cycles}
            description="Cycles currently active or in calibration."
            status={metrics.active_cycles ? "active" : "draft"}
          />
          <Link href="/dashboard/performance/reviews" className="block">
            <MetricCard
              title="Review completion"
              value={`${metrics.completion_rate.toFixed(1)}%`}
              description={`${metrics.reviews_completed} of ${metrics.reviews_total} reviews complete.`}
            />
          </Link>
          <Link href="/dashboard/performance/reviews" className="block">
            <MetricCard
              title="Overdue reviews"
              value={metrics.reviews_overdue}
              description="Reviews past due and not completed."
              status={metrics.reviews_overdue ? "overdue" : "clear"}
            />
          </Link>
          <Link href="/dashboard/performance/goals" className="block">
            <MetricCard
              title="Goals at risk"
              value={metrics.goals_at_risk}
              description={`${metrics.goals_total} goal(s) in scope.`}
              status={metrics.goals_at_risk ? "at_risk" : "on_track"}
            />
          </Link>
        </div>
      ) : null}

      {focusCycleId ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>
            Focused on cycle{" "}
            <strong>
              {cycles.find((row) => String(row.id) === focusCycleId)?.name ?? `#${focusCycleId}`}
            </strong>
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setFocusCycleId("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="cycle-search" className="text-xs">
            Search
          </Label>
          <Input
            id="cycle-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Name or code"
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cycle-status" className="text-xs">
            Status
          </Label>
          <NativeSelect
            id="cycle-status"
            className="h-9 w-44"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CycleStatusFilter)}
          >
            <NativeSelectOption value="all">Any status</NativeSelectOption>
            <NativeSelectOption value="draft">Draft</NativeSelectOption>
            <NativeSelectOption value="active">Active</NativeSelectOption>
            <NativeSelectOption value="calibration">Calibration</NativeSelectOption>
            <NativeSelectOption value="completed">Completed</NativeSelectOption>
            <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
          </NativeSelect>
        </div>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {creating && canManage ? (
        <CycleFormCard
          id="new-performance-cycle"
          form={form}
          setForm={setForm}
          busy={saveCycle.isPending}
          editing={editingCycle}
          onSubmit={submitForm}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Cycle register</CardTitle>
          <CardDescription>
            Activating a cycle creates or retains one review for every selected active employee and
            assigns the current reporting manager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cyclesQuery.isLoading ? (
            <PerformanceLoading cards={2} />
          ) : cyclesQuery.error || !cyclesQuery.data ? (
            <div className="space-y-3">
              <PerformanceError error={cyclesQuery.error} />
              <Button variant="outline" size="sm" onClick={() => cyclesQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <PerformanceTable<ReviewCycle>
                caption="Performance review cycles, newest period first."
                rows={cycles}
                getKey={(row) => row.id}
                columns={[
                  {
                    key: "cycle",
                    label: "Cycle",
                    render: (row) => (
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => {
                          setInspecting(row);
                          setFocusCycleId(String(row.id));
                        }}
                      >
                        <span className="font-medium">{row.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {row.code} · {cycleTypeLabel(row.cycle_type)}
                        </p>
                      </button>
                    ),
                  },
                  {
                    key: "period",
                    label: "Period",
                    render: (row) => `${row.period_start} – ${row.period_end}`,
                  },
                  {
                    key: "due",
                    label: "Due dates",
                    render: (row) => (
                      <div className="text-xs text-muted-foreground">
                        <p>Self: {row.self_review_due_on ?? "—"}</p>
                        <p>Manager: {row.manager_review_due_on ?? "—"}</p>
                      </div>
                    ),
                  },
                  {
                    key: "weights",
                    label: "Weighting",
                    render: (row) =>
                      `${Number(row.goal_weight)}% goals · ${Number(row.competency_weight)}% competencies`,
                  },
                  {
                    key: "reviews",
                    label: "Completion",
                    align: "right",
                    render: (row) => {
                      const percent = completionPercent(row);
                      return (
                        <div className="min-w-32 space-y-1.5">
                          <div className="text-xs tabular-nums">
                            {row.completed_reviews_count ?? 0}/{row.reviews_count ?? 0} ({percent}%)
                          </div>
                          <Progress value={percent} aria-label={`${row.name} review completion ${percent} percent`} />
                        </div>
                      );
                    },
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => <PerformanceStatus value={row.status} />,
                  },
                  {
                    key: "action",
                    label: "Next action",
                    align: "right",
                    render: (row) => (
                      <CycleActions
                        cycle={row}
                        canManage={canManage}
                        busy={action.isPending}
                        onInspect={() => {
                          setInspecting(row);
                          setFocusCycleId(String(row.id));
                        }}
                        onEdit={() => openEdit(row)}
                        onAction={(next) => {
                          if (next === "activate") {
                            setActivating(row);
                            setSelectedEmployeeIds([]);
                            return;
                          }
                          action.mutate({ id: row.id, action: next });
                        }}
                      />
                    ),
                  },
                ]}
                rowRef={(row, node) => {
                  rowRefs.current[row.id] = node;
                }}
              />

              {meta && meta.last_page > 1 ? (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Page {meta.current_page} of {meta.last_page} · {meta.total} cycles
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
                <DialogTitle>{inspecting.name}</DialogTitle>
                <DialogDescription>
                  {inspecting.code} · {cycleTypeLabel(inspecting.cycle_type)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <PerformanceStatus value={inspecting.status} />
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Period</span>
                  <span>
                    {inspecting.period_start} – {inspecting.period_end}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Review completion</span>
                  <span className="tabular-nums">
                    {inspecting.completed_reviews_count ?? 0}/{inspecting.reviews_count ?? 0} (
                    {completionPercent(inspecting)}%)
                  </span>
                </div>
                {inspecting.description ? (
                  <p className="rounded-lg border bg-muted/30 p-3 text-muted-foreground">
                    {inspecting.description}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/dashboard/performance/reviews?cycle_id=${inspecting.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open reviews
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/performance/goals?cycle_id=${inspecting.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open goals
                  </Link>
                </Button>
                {canManage && canEditCycle(inspecting) ? (
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
        open={activating !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActivating(null);
            setSelectedEmployeeIds([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {activating ? (
            <>
              <DialogHeader>
                <DialogTitle>Activate {activating.name}</DialogTitle>
                <DialogDescription>
                  Leave all employees unselected to include every active employee, or choose a subset
                  for a pilot cycle.
                </DialogDescription>
              </DialogHeader>
              <EmployeePicker
                employees={employees}
                selected={selectedEmployeeIds}
                onChange={setSelectedEmployeeIds}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setActivating(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({
                      id: activating.id,
                      action: "activate",
                      employeeIds: selectedEmployeeIds.length ? selectedEmployeeIds : undefined,
                    })
                  }
                >
                  <Play className="mr-2 h-4 w-4" />
                  Activate cycle
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PerformanceShell>
  );
}

function CycleFormCard({
  id,
  form,
  setForm,
  busy,
  editing,
  onSubmit,
}: {
  id: string;
  form: CycleFormState;
  setForm: React.Dispatch<React.SetStateAction<CycleFormState>>;
  busy: boolean;
  editing: ReviewCycle | null;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>
          <h2>{editing ? "Edit review cycle" : "Create review cycle"}</h2>
        </CardTitle>
        <CardDescription>
          Required fields are identified in each label. Goal and competency weights must total 100%.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Cycle code (required)" id="cycle-code">
              <Input
                id="cycle-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                required
                maxLength={80}
              />
            </FormField>
            <FormField label="Cycle name (required)" id="cycle-name">
              <Input
                id="cycle-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                maxLength={180}
              />
            </FormField>
            <FormField label="Cycle type (required)" id="cycle-type">
              <NativeSelect
                id="cycle-type"
                className="w-full"
                value={form.cycle_type}
                onChange={(event) => setForm({ ...form, cycle_type: event.target.value })}
                required
              >
                <NativeSelectOption value="probation">Probation</NativeSelectOption>
                <NativeSelectOption value="quarterly">Quarterly</NativeSelectOption>
                <NativeSelectOption value="biannual">Biannual</NativeSelectOption>
                <NativeSelectOption value="annual">Annual</NativeSelectOption>
                <NativeSelectOption value="project">Project</NativeSelectOption>
              </NativeSelect>
            </FormField>
          </div>
          <FormField label="Description" id="cycle-description">
            <Textarea
              id="cycle-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={4000}
            />
          </FormField>
          <div className="grid gap-4 md:grid-cols-3">
            <DateField
              id="cycle-start"
              label="Period starts (required)"
              value={form.period_start}
              onChange={(value) => setForm({ ...form, period_start: value })}
            />
            <DateField
              id="cycle-end"
              label="Period ends (required)"
              value={form.period_end}
              onChange={(value) => setForm({ ...form, period_end: value })}
            />
            <FormField label="Calibration required" id="cycle-calibration">
              <NativeSelect
                id="cycle-calibration"
                className="w-full"
                value={form.requires_calibration ? "1" : "0"}
                onChange={(event) =>
                  setForm({ ...form, requires_calibration: event.target.value === "1" })
                }
              >
                <NativeSelectOption value="1">Yes</NativeSelectOption>
                <NativeSelectOption value="0">No</NativeSelectOption>
              </NativeSelect>
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <DateField
              id="cycle-self-due"
              label="Self-review due"
              value={form.self_review_due_on}
              onChange={(value) => setForm({ ...form, self_review_due_on: value })}
              required={false}
            />
            <DateField
              id="cycle-manager-due"
              label="Manager review due"
              value={form.manager_review_due_on}
              onChange={(value) => setForm({ ...form, manager_review_due_on: value })}
              required={false}
            />
            <DateField
              id="cycle-calibration-due"
              label="Calibration due"
              value={form.calibration_due_on}
              onChange={(value) => setForm({ ...form, calibration_due_on: value })}
              required={false}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Goal weight percent (required)" id="cycle-goal-weight">
              <Input
                id="cycle-goal-weight"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.goal_weight}
                onChange={(event) => setForm({ ...form, goal_weight: event.target.value })}
                required
              />
            </FormField>
            <FormField label="Competency weight percent (required)" id="cycle-competency-weight">
              <Input
                id="cycle-competency-weight"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.competency_weight}
                onChange={(event) => setForm({ ...form, competency_weight: event.target.value })}
                required
              />
            </FormField>
          </div>
          <Button type="submit" className="w-fit" disabled={busy}>
            <BusyLabel busy={busy}>{editing ? "Save changes" : "Create review cycle"}</BusyLabel>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CycleActions({
  cycle,
  canManage,
  busy,
  onInspect,
  onEdit,
  onAction,
}: {
  cycle: ReviewCycle;
  canManage: boolean;
  busy: boolean;
  onInspect: () => void;
  onEdit: () => void;
  onAction: (action: "activate" | "open-calibration" | "complete" | "cancel") => void;
}) {
  if (!canManage) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={onInspect}>
        View
      </Button>
    );
  }

  if (["completed", "cancelled"].includes(cycle.status)) {
    return <span className="text-sm text-muted-foreground">Locked</span>;
  }

  const next = nextCycleAction(cycle.status);

  return (
    <div className="flex justify-end gap-2">
      {canEditCycle(cycle) ? (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      {next ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAction(next)}>
          {next === "activate" ? (
            <Play aria-hidden="true" data-icon="inline-start" />
          ) : (
            <SlidersHorizontal aria-hidden="true" data-icon="inline-start" />
          )}
          {actionLabel(next)}
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onAction("cancel")}>
        Cancel
      </Button>
    </div>
  );
}

function EmployeePicker({
  employees,
  selected,
  onChange,
}: {
  employees: EmployeeRef[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  if (employees.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Employee list unavailable — activation will include all active employees.
      </p>
    );
  }

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
      {employees.map((employee) => {
        const checked = selected.includes(employee.id);
        return (
          <label key={employee.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                if (event.target.checked) onChange([...selected, employee.id]);
                else onChange(selected.filter((id) => id !== employee.id));
              }}
              className="rounded border-input"
            />
            <span>
              {employee.primary_name} ({employee.employee_number})
            </span>
          </label>
        );
      })}
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

function DateField({
  id,
  label,
  value,
  onChange,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <FormField id={id} label={label}>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </FormField>
  );
}
