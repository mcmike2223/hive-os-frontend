"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  BusyLabel,
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
  hasActiveReviewFilters,
  isReviewOverdue,
  scopeDescription,
  scopeLabel,
  useDebouncedValue,
  type ReviewStatusFilter,
} from "@/modules/performance/utils";

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString();
}

function hasActiveReportScope(opts: { cycleId: string; employeeId: string }): boolean {
  return Boolean(opts.cycleId || opts.employeeId);
}

function exportFileName(cycleName?: string, employeeName?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const parts = ["performance-reviews", date];
  if (cycleName) parts.push(cycleName.replace(/\s+/g, "-").toLowerCase());
  if (employeeName) parts.push(employeeName.replace(/\s+/g, "-").toLowerCase());
  return `${parts.join("-")}.csv`;
}

export default function PerformanceReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canExport = hasAnyPermission(["export_performance_reports", "manage_performance"]);

  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = React.useState<ReviewStatusFilter>(
    (searchParams.get("status") as ReviewStatusFilter) || "all",
  );
  const [cycleFilter, setCycleFilter] = React.useState(searchParams.get("cycle_id") ?? "");
  const [employeeFilter, setEmployeeFilter] = React.useState(searchParams.get("employee_id") ?? "");
  const [overdueOnly, setOverdueOnly] = React.useState(searchParams.get("overdue") === "1");
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));
  const [exporting, setExporting] = React.useState(false);

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const reportParams = {
    ...(cycleFilter ? { cycle_id: Number(cycleFilter) } : {}),
    ...(employeeFilter ? { employee_id: Number(employeeFilter) } : {}),
  };

  const referencesQuery = useQuery({
    queryKey: ["performance", "references-reports"],
    queryFn: performanceApi.references,
  });

  const reportQuery = useQuery({
    queryKey: ["performance", "reports", cycleFilter, employeeFilter],
    queryFn: () => performanceApi.report(reportParams),
    placeholderData: (previous) => previous,
  });

  const reviewsQuery = useQuery({
    queryKey: [
      "performance",
      "reviews",
      "reports",
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

  const references = referencesQuery.data;
  const report = reportQuery.data;
  const reviews = reviewsQuery.data?.data ?? [];
  const meta = reviewsQuery.data;

  const cycleName = references?.cycles.find((cycle) => String(cycle.id) === cycleFilter)?.name;
  const employeeName = references?.employees.find(
    (employee) => String(employee.id) === employeeFilter,
  )?.primary_name;

  const filtersActive = hasActiveReviewFilters({
    search: searchInput,
    status: statusFilter,
    cycleId: cycleFilter,
    employeeId: employeeFilter,
    overdueOnly,
  });

  const scopeActive = hasActiveReportScope({
    cycleId: cycleFilter,
    employeeId: employeeFilter,
  });

  const refetching =
    (reportQuery.isFetching && !reportQuery.isLoading) ||
    (reviewsQuery.isFetching && !reviewsQuery.isLoading);

  const clearFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setCycleFilter("");
    setEmployeeFilter("");
    setOverdueOnly(false);
  };

  const errorText = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error && "response" in error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      if (message) return message;
    }
    return fallback;
  };

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await performanceApi.exportReport({
        ...reportParams,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName(cycleName, employeeName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Performance report exported.");
    } catch (error: unknown) {
      toast.error(errorText(error, "Performance report could not be exported."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PerformanceShell
      title="Performance reports"
      description="Review completion, outcome distribution, goal health, check-in rhythm, and employee-level results with an auditable CSV export."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reportQuery.refetch();
              reviewsQuery.refetch();
              referencesQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canExport ? (
            <Button type="button" onClick={exportCsv} disabled={exporting}>
              <Download aria-hidden="true" data-icon="inline-start" />
              <BusyLabel busy={exporting}>Export reviews CSV</BusyLabel>
            </Button>
          ) : null}
        </div>
      }
    >
      {report ? (
        <Alert>
          <AlertTitle>{scopeLabel(report.scope)}</AlertTitle>
          <AlertDescription>
            {scopeDescription(report.scope)}
            {scopeActive ? " Report scope is narrowed by your selected cycle and/or employee." : ""}{" "}
            Generated {formatGeneratedAt(report.generated_at)}.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Report scope</h2>
          </CardTitle>
          <CardDescription>
            Narrow summary metrics, charts, and CSV export to a specific review cycle or employee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referencesQuery.isLoading ? (
            <PerformanceLoading cards={2} />
          ) : referencesQuery.error ? (
            <PerformanceError error={referencesQuery.error} title="References could not be loaded" />
          ) : references ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="report-cycle" className="text-xs">
                  Review cycle
                </Label>
                <NativeSelect
                  id="report-cycle"
                  className="h-9 w-56"
                  value={cycleFilter}
                  onChange={(event) => setCycleFilter(event.target.value)}
                >
                  <NativeSelectOption value="">All cycles</NativeSelectOption>
                  {references.cycles.map((cycle) => (
                    <NativeSelectOption key={cycle.id} value={String(cycle.id)}>
                      {cycle.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="report-employee" className="text-xs">
                  Employee
                </Label>
                <NativeSelect
                  id="report-employee"
                  className="h-9 w-56"
                  value={employeeFilter}
                  onChange={(event) => setEmployeeFilter(event.target.value)}
                >
                  <NativeSelectOption value="">All employees</NativeSelectOption>
                  {references.employees.map((employee) => (
                    <NativeSelectOption key={employee.id} value={String(employee.id)}>
                      {employee.primary_name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              {scopeActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setCycleFilter("");
                    setEmployeeFilter("");
                  }}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear scope
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {reportQuery.isLoading ? (
        <PerformanceLoading />
      ) : reportQuery.error || !report ? (
        <div className="space-y-3">
          <PerformanceError error={reportQuery.error} />
          <Button variant="outline" size="sm" onClick={() => reportQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              href={`/dashboard/performance/reviews?status=completed${cycleFilter ? `&cycle_id=${cycleFilter}` : ""}${employeeFilter ? `&employee_id=${employeeFilter}` : ""}`}
              className="block"
            >
              <MetricCard
                title="Completed reviews"
                value={report.metrics.reviews_completed}
                description={`${report.metrics.completion_rate.toFixed(1)}% completion rate across ${report.metrics.reviews_total} reviews.`}
                status={report.metrics.completion_rate >= 80 ? "completed" : "manager_review"}
              />
            </Link>
            <MetricCard
              title="Organization average"
              value={<Score value={report.metrics.average_score} />}
              description="Average of completed review outcomes in scope."
            />
            <Link
              href={`/dashboard/performance/goals${cycleFilter ? `?cycle_id=${cycleFilter}` : ""}${employeeFilter ? `${cycleFilter ? "&" : "?"}employee_id=${employeeFilter}` : ""}`}
              className="block"
            >
              <MetricCard
                title="Average goal progress"
                value={`${report.metrics.average_goal_progress.toFixed(1)}%`}
                description={`${report.metrics.goals_total} goals included, ${report.metrics.goals_at_risk} need intervention.`}
                status={report.metrics.goals_at_risk ? "at_risk" : "on_track"}
              />
            </Link>
            <Link
              href={`/dashboard/performance/development?section=plans&status=active${employeeFilter ? `&employee_id=${employeeFilter}` : ""}`}
              className="block"
            >
              <MetricCard
                title="Active support plans"
                value={report.metrics.active_improvement_plans}
                description={`${report.metrics.feedback_pending} pending feedback request(s) in scope.`}
                status="active"
              />
            </Link>
          </div>

          <PerformanceCharts data={report} focus="reports" />

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Goal health snapshot</h2>
              </CardTitle>
              <CardDescription>
                Blocked, at-risk, and lower-progress goals in the selected reporting scope.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.priority_goals.length === 0 ? (
                <PerformanceEmpty
                  title="No priority goals"
                  description="No goals in scope need intervention right now."
                />
              ) : (
                <PerformanceTable<Goal>
                  caption="Priority goals ordered by risk and progress."
                  rows={report.priority_goals}
                  getKey={(row) => row.id}
                  columns={[
                    {
                      key: "goal",
                      label: "Goal",
                      render: (row) => (
                        <Link
                          href={`/dashboard/performance/goals?goal_id=${row.id}`}
                          className="block hover:underline"
                        >
                          <span className="font-medium">{row.title}</span>
                          <p className="text-xs text-muted-foreground">
                            {row.employee?.primary_name ?? "Employee goal"}
                          </p>
                        </Link>
                      ),
                    },
                    {
                      key: "cycle",
                      label: "Cycle",
                      render: (row) => row.cycle?.name ?? "—",
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => <PerformanceStatus value={row.status} />,
                    },
                    {
                      key: "progress",
                      label: "Progress",
                      render: (row) => (
                        <div className="min-w-28 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{Number(row.progress_percent).toFixed(0)}%</span>
                          </div>
                          <Progress
                            value={Number(row.progress_percent)}
                            aria-label={`${row.title} progress`}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {(cycleFilter || employeeFilter) && !reportQuery.isLoading ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
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
            Clear all filters
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="reports-search" className="text-xs">
            Search register
          </Label>
          <Input
            id="reports-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Employee name or number"
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reports-status" className="text-xs">
            Review stage
          </Label>
          <NativeSelect
            id="reports-status"
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
            Clear register filters
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Review outcomes register</h2>
          </CardTitle>
          <CardDescription>
            Auditable review outcomes for export, calibration review, and leadership reporting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviewsQuery.isLoading ? (
            <PerformanceLoading cards={2} />
          ) : reviewsQuery.error || !meta ? (
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
                filtersActive || scopeActive
                  ? "No reviews match the current report scope or register filters."
                  : "Activate a review cycle to create one review per active employee."
              }
            />
          ) : (
            <>
              <PerformanceTable<PerformanceReview>
                caption="Performance review outcomes ordered by due date."
                rows={reviews}
                getKey={(row) => row.id}
                columns={[
                  {
                    key: "employee",
                    label: "Employee",
                    render: (row) => (
                      <div>
                        <Link
                          href={`/dashboard/performance/reviews?review_id=${row.id}`}
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
                    render: (row) => row.cycle?.name ?? "—",
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
                    key: "rating",
                    label: "Rating",
                    render: (row) => row.rating_label ?? "—",
                  },
                  {
                    key: "score",
                    label: "Score",
                    align: "right",
                    render: (row) => <Score value={row.overall_score} />,
                  },
                  {
                    key: "actions",
                    label: "",
                    align: "right",
                    render: (row) => (
                      <Button asChild size="sm" variant="ghost" className="h-7">
                        <Link href={`/dashboard/performance/reviews?review_id=${row.id}`}>
                          Open
                          <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ),
                  },
                ]}
              />
              {meta.last_page > 1 ? (
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
                      onClick={() => setPage(Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={page >= meta.last_page}
                      onClick={() => setPage(page + 1)}
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
    </PerformanceShell>
  );
}
