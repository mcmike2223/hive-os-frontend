"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/hooks/use-permissions";
import { performanceApi } from "@/modules/performance/api";
import type { Goal, PerformanceReview } from "@/modules/performance/types";
import { PerformanceCharts } from "@/modules/performance/pages/components/performance-charts";
import {
  MetricCard,
  PerformanceEmpty,
  PerformanceError,
  PerformanceLoading,
  PerformanceShell,
  PerformanceStatus,
  PerformanceTable,
  Score,
} from "@/modules/performance/pages/components/performance-shell";
import {
  availableReviewAction,
  hasActiveReviewFilters,
  isReviewOverdue,
  scopeDescription,
  scopeLabel,
  useDebouncedValue,
  type ReviewStatusFilter,
} from "@/modules/performance/utils";

function needsCoaching(review: PerformanceReview): boolean {
  return isReviewOverdue(review) || ["returned", "calibration"].includes(review.status);
}

function goalNeedsAttention(goal: Goal): boolean {
  return ["blocked", "at_risk"].includes(goal.status);
}

export default function TeamPerformancePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canConduct = hasAnyPermission(["conduct_performance_reviews", "manage_performance"]);

  const initialEmployeeId = searchParams.get("employee_id") ?? "";
  const initialCycleId = searchParams.get("cycle_id") ?? "";

  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = React.useState<ReviewStatusFilter>(
    (searchParams.get("status") as ReviewStatusFilter) || "all",
  );
  const [cycleFilter, setCycleFilter] = React.useState(initialCycleId);
  const [employeeFilter, setEmployeeFilter] = React.useState(initialEmployeeId);
  const [overdueOnly, setOverdueOnly] = React.useState(searchParams.get("overdue") === "1");
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const dashboardQuery = useQuery({
    queryKey: ["performance", "dashboard-team"],
    queryFn: performanceApi.dashboard,
  });

  const referencesQuery = useQuery({
    queryKey: ["performance", "references-team"],
    queryFn: performanceApi.references,
  });

  const reviewsQuery = useQuery({
    queryKey: [
      "performance",
      "reviews",
      "team",
      debouncedSearch,
      statusFilter,
      cycleFilter,
      employeeFilter,
      overdueOnly,
      page,
    ],
    queryFn: () =>
      performanceApi.reviews({
        page,
        per_page: 25,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(cycleFilter ? { cycle_id: Number(cycleFilter) } : {}),
        ...(employeeFilter ? { employee_id: Number(employeeFilter) } : {}),
        ...(overdueOnly ? { overdue_only: 1 } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (cycleFilter) params.set("cycle_id", cycleFilter);
    if (employeeFilter) params.set("employee_id", employeeFilter);
    if (overdueOnly) params.set("overdue", "1");
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    cycleFilter,
    employeeFilter,
    overdueOnly,
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
  }, [debouncedSearch, statusFilter, cycleFilter, employeeFilter, overdueOnly]);

  const dashboard = dashboardQuery.data;
  const reviews = reviewsQuery.data?.data ?? [];
  const meta = reviewsQuery.data;
  const references = referencesQuery.data;
  const refetching =
    (reviewsQuery.isFetching && !reviewsQuery.isLoading) || dashboardQuery.isFetching;

  const filtersActive = hasActiveReviewFilters({
    search: searchInput,
    status: statusFilter,
    cycleId: cycleFilter,
    employeeId: employeeFilter,
    overdueOnly,
  });

  const cycleName = references?.cycles.find((cycle) => String(cycle.id) === cycleFilter)?.name;
  const employeeName = references?.employees.find(
    (employee) => String(employee.id) === employeeFilter,
  )?.primary_name;

  const coachingReviews = reviews.filter(needsCoaching);
  const priorityGoals = dashboard?.priority_goals.filter(goalNeedsAttention) ?? [];

  const clearFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setCycleFilter("");
    setEmployeeFilter("");
    setOverdueOnly(false);
  };

  const permissions = {
    canSelf: false,
    canManage: canConduct,
    canCalibrate: hasAnyPermission(["calibrate_performance", "manage_performance"]),
    canAcknowledge: false,
  };

  return (
    <PerformanceShell
      title="Team performance"
      description="Give managers a responsible view of outcomes, review readiness, coaching rhythm, and development needs for their reporting scope."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              dashboardQuery.refetch();
              reviewsQuery.refetch();
              referencesQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canConduct ? (
            <Button asChild>
              <Link href="/dashboard/performance/reviews">
                Conduct reviews
                <ArrowRight aria-hidden="true" data-icon="inline-end" />
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <Alert>
        <UsersRound aria-hidden="true" />
        <AlertTitle>
          Scoped to authorized employees
          {dashboard ? (
            <Badge variant="outline" className="ml-2 align-middle text-[10px] uppercase tracking-widest">
              {scopeLabel(dashboard.scope)}
            </Badge>
          ) : null}
        </AlertTitle>
        <AlertDescription>
          People managers see their reporting tree; employees see themselves; performance
          administrators can view the organization. The API enforces the same boundary for every
          record. {dashboard ? scopeDescription(dashboard.scope) : null}
        </AlertDescription>
      </Alert>

      {dashboardQuery.isLoading ? (
        <PerformanceLoading />
      ) : dashboardQuery.error || !dashboard ? (
        <div className="space-y-3">
          <PerformanceError error={dashboardQuery.error} />
          <Button variant="outline" size="sm" onClick={() => dashboardQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Team completion"
              value={`${dashboard.metrics.completion_rate.toFixed(1)}%`}
              description="Completed reviews within the visible team scope."
            />
            <MetricCard
              title="Team average"
              value={<Score value={dashboard.metrics.average_score} />}
              description="Completed review average; use calibration before comparisons."
            />
            <Link href="/dashboard/performance/goals?status=at_risk" className="block">
              <MetricCard
                title="Goals at risk"
                value={dashboard.metrics.goals_at_risk}
                description="Blocked or at-risk employee commitments."
                status={dashboard.metrics.goals_at_risk ? "at_risk" : "clear"}
              />
            </Link>
            <Link href="/dashboard/performance/team?overdue=1" className="block">
              <MetricCard
                title="Overdue reviews"
                value={dashboard.metrics.reviews_overdue}
                description="Manager or employee action is late."
                status={dashboard.metrics.reviews_overdue ? "overdue" : "clear"}
              />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Team leaderboard</h2>
                </CardTitle>
                <CardDescription>
                  Average completed review scores for employees in your current scope.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.datasets.team_scores.length === 0 ? (
                  <PerformanceEmpty
                    title="No completed reviews yet"
                    description="Scores appear after at least one employee review is completed in scope."
                  />
                ) : (
                  <PerformanceTable
                    caption="Average completed review score by employee."
                    rows={dashboard.datasets.team_scores}
                    getKey={(row) => row.employee_id}
                    columns={[
                      {
                        key: "employee",
                        label: "Employee",
                        render: (row) => (
                          <Link
                            href={`/dashboard/performance/team?employee_id=${row.employee_id}`}
                            className="font-medium hover:underline"
                          >
                            {row.employee}
                          </Link>
                        ),
                      },
                      {
                        key: "reviews",
                        label: "Reviews",
                        align: "right",
                        render: (row) => row.reviews,
                      },
                      {
                        key: "score",
                        label: "Average",
                        align: "right",
                        render: (row) => <Score value={row.score} />,
                      },
                      {
                        key: "actions",
                        label: "",
                        align: "right",
                        render: (row) => (
                          <Button asChild size="sm" variant="ghost" className="h-7">
                            <Link href={`/dashboard/performance/reviews?employee_id=${row.employee_id}`}>
                              Reviews
                            </Link>
                          </Button>
                        ),
                      },
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Coaching priorities</h2>
                </CardTitle>
                <CardDescription>
                  Overdue reviews and at-risk goals that need manager attention now.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {coachingReviews.length === 0 && priorityGoals.length === 0 ? (
                  <PerformanceEmpty
                    title="Team is on track"
                    description="No overdue reviews or at-risk goals in the current filtered register."
                  />
                ) : (
                  <>
                    {coachingReviews.slice(0, 5).map((review) => (
                      <div
                        key={review.id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {review.employee?.primary_name ?? `Employee ${review.employee_id}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isReviewOverdue(review) ? "Overdue review" : "Needs follow-up"} ·{" "}
                            {review.cycle?.name ?? "Cycle"}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="h-7">
                          <Link href={`/dashboard/performance/reviews?review_id=${review.id}`}>
                            Open
                          </Link>
                        </Button>
                      </div>
                    ))}
                    {priorityGoals.slice(0, 5).map((goal) => (
                      <div
                        key={goal.id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{goal.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {goal.employee?.primary_name ?? "Employee"} ·{" "}
                            <PerformanceStatus value={goal.status} />
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="h-7 shrink-0">
                          <Link href={`/dashboard/performance/goals?goal_id=${goal.id}`}>
                            <Target className="mr-1 h-3.5 w-3.5" />
                            Goal
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <PerformanceCharts data={dashboard} focus="team" />
        </>
      )}

      {(cycleFilter || employeeFilter || overdueOnly) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>
            {overdueOnly ? <strong>Overdue only</strong> : null}
            {overdueOnly && (cycleFilter || employeeFilter) ? " · " : null}
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
          <Label htmlFor="team-search" className="text-xs">
            Search
          </Label>
          <Input
            id="team-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Employee name or number"
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="team-status" className="text-xs">
            Stage
          </Label>
          <NativeSelect
            id="team-status"
            className="h-9 w-44"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReviewStatusFilter)}
          >
            <NativeSelectOption value="all">Any stage</NativeSelectOption>
            <NativeSelectOption value="not_started">Not started</NativeSelectOption>
            <NativeSelectOption value="self_review">Self review</NativeSelectOption>
            <NativeSelectOption value="manager_review">Manager review</NativeSelectOption>
            <NativeSelectOption value="calibration">Calibration</NativeSelectOption>
            <NativeSelectOption value="completed">Completed</NativeSelectOption>
          </NativeSelect>
        </div>
        {references ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="team-cycle" className="text-xs">
                Cycle
              </Label>
              <NativeSelect
                id="team-cycle"
                className="h-9 w-48"
                value={cycleFilter}
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
              <Label htmlFor="team-employee" className="text-xs">
                Employee
              </Label>
              <NativeSelect
                id="team-employee"
                className="h-9 w-48"
                value={employeeFilter}
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
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(event) => setOverdueOnly(event.target.checked)}
            className="rounded border-input"
          />
          Overdue only
        </label>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Team review register</h2>
          </CardTitle>
          <CardDescription>
            Review status, ownership, due date, and current outcome for every employee in scope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviewsQuery.isLoading ? (
            <PerformanceLoading cards={2} />
          ) : reviewsQuery.error || !reviewsQuery.data ? (
            <div className="space-y-3">
              <PerformanceError error={reviewsQuery.error} />
              <Button variant="outline" size="sm" onClick={() => reviewsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : reviews.length === 0 ? (
            <PerformanceEmpty
              title="No reviews in scope"
              description={
                filtersActive
                  ? "No team reviews match these filters."
                  : "Activate a review cycle to create one review per active employee."
              }
            />
          ) : (
            <>
              <PerformanceTable<PerformanceReview>
                caption="Team performance reviews ordered by due date."
                rows={reviews}
                getKey={(row) => row.id}
                columns={[
                  {
                    key: "employee",
                    label: "Employee",
                    render: (row) => (
                      <div>
                        <Link
                          href={`/dashboard/performance/team?employee_id=${row.employee_id}`}
                          className="font-medium hover:underline"
                        >
                          {row.employee?.primary_name ?? `Employee ${row.employee_id}`}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {row.employee?.employee_number}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "manager",
                    label: "Manager",
                    render: (row) => row.manager?.primary_name ?? "Unassigned",
                  },
                  {
                    key: "cycle",
                    label: "Cycle",
                    render: (row) => (
                      <Link
                        href={`/dashboard/performance/team?cycle_id=${row.cycle_id}`}
                        className="hover:underline"
                      >
                        {row.cycle?.name ?? "—"}
                      </Link>
                    ),
                  },
                  {
                    key: "due",
                    label: "Due",
                    render: (row) => (
                      <div className="flex items-center gap-2">
                        <span>{row.due_on ?? "Not set"}</span>
                        {isReviewOverdue(row) ? (
                          <Badge variant="destructive" className="text-[10px] uppercase">
                            Overdue
                          </Badge>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => <PerformanceStatus value={row.status} />,
                  },
                  {
                    key: "score",
                    label: "Score",
                    align: "right",
                    render: (row) => <Score value={row.overall_score} />,
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    align: "right",
                    render: (row) => {
                      const next = availableReviewAction(row, permissions);
                      return (
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="ghost" className="h-7">
                            <Link href={`/dashboard/performance/goals?employee_id=${row.employee_id}`}>
                              Goals
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="h-7">
                            <Link href={`/dashboard/performance/reviews?review_id=${row.id}`}>
                              <ExternalLink className="mr-1 h-3.5 w-3.5" />
                              {next ? "Work" : "View"}
                            </Link>
                          </Button>
                        </div>
                      );
                    },
                  },
                ]}
              />

              {meta && meta.last_page > 1 ? (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Page {meta.current_page} of {meta.last_page} · {meta.total} reviews
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

      {dashboard && dashboard.priority_goals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Goal progress in scope</h2>
            </CardTitle>
            <CardDescription>
              Employee commitments ranked by risk and progress within your authorized scope.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceTable<Goal>
              caption="Priority performance goals for the visible team."
              rows={dashboard.priority_goals}
              getKey={(row) => row.id}
              columns={[
                {
                  key: "goal",
                  label: "Goal",
                  render: (row) => (
                    <Link
                      href={`/dashboard/performance/goals?goal_id=${row.id}`}
                      className="hover:underline"
                    >
                      <span className="font-medium">{row.title}</span>
                      <p className="text-xs text-muted-foreground">
                        {row.employee?.primary_name ?? "Employee"}
                      </p>
                    </Link>
                  ),
                },
                {
                  key: "progress",
                  label: "Progress",
                  render: (row) => (
                    <div className="min-w-28 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{Number(row.progress_percent).toFixed(0)}%</span>
                      </div>
                      <Progress value={Number(row.progress_percent)} aria-label={`${row.title} progress`} />
                    </div>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <PerformanceStatus value={row.status} />,
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  render: (row) => (
                    <Button asChild size="sm" variant="ghost" className="h-7">
                      <Link href={`/dashboard/performance/development?employee_id=${row.employee_id}`}>Development</Link>
                    </Button>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}
    </PerformanceShell>
  );
}
