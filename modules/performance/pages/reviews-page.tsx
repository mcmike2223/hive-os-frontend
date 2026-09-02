"use client";

import * as React from "react";
import { type FormEvent, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  RefreshCw,
  Scale,
  Send,
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { performanceApi } from "@/modules/performance/api";
import type { Competency, PerformanceReview } from "@/modules/performance/types";
import {
  BusyLabel,
  MetricCard,
  PerformanceEmpty,
  PerformanceError,
  PerformanceLoading,
  PerformanceShell,
  PerformanceStatus,
  Score,
} from "@/modules/performance/pages/components/performance-shell";
import {
  availableReviewAction,
  describeEvidence,
  hasActiveReviewFilters,
  isReviewOverdue,
  reviewStageLabel,
  useDebouncedValue,
  type ReviewStatusFilter,
} from "@/modules/performance/utils";

type ReviewAction = "self-submit" | "manager-submit" | "calibrate" | "acknowledge";

export default function PerformanceReviewsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canSelf = hasAnyPermission(["submit_self_reviews", "manage_performance"]);
  const canManage = hasAnyPermission(["conduct_performance_reviews", "manage_performance"]);
  const canCalibrate = hasAnyPermission(["calibrate_performance", "manage_performance"]);
  const canAcknowledge = hasAnyPermission(["acknowledge_performance_reviews", "manage_performance"]);

  const initialCycleId = searchParams.get("cycle_id") ?? "";
  const initialEmployeeId = searchParams.get("employee_id") ?? "";
  const initialReviewId = searchParams.get("review_id") ?? "";

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>(
    (searchParams.get("status") as ReviewStatusFilter) || "all",
  );
  const [cycleFilter, setCycleFilter] = useState(initialCycleId);
  const [employeeFilter, setEmployeeFilter] = useState(initialEmployeeId);
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get("overdue") === "1");
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [selectedId, setSelectedId] = useState<number | null>(
    initialReviewId ? Number(initialReviewId) : null,
  );

  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const workspaceRef = React.useRef<HTMLElement | null>(null);
  const deepLinkHandled = React.useRef(false);

  const dashboardQuery = useQuery({
    queryKey: ["performance", "dashboard-reviews"],
    queryFn: performanceApi.dashboard,
  });

  const referencesQuery = useQuery({
    queryKey: ["performance", "references-reviews"],
    queryFn: performanceApi.references,
  });

  const reviewsQuery = useQuery({
    queryKey: [
      "performance",
      "reviews",
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

  const detailQuery = useQuery({
    queryKey: ["performance", "review", selectedId],
    queryFn: () => performanceApi.review(selectedId!),
    enabled: selectedId !== null,
  });

  const errorText = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error && "response" in error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      if (message) return message;
    }
    return fallback;
  };

  const action = useMutation({
    mutationFn: ({
      id,
      action: next,
      payload,
    }: {
      id: number;
      action: ReviewAction;
      payload: Record<string, unknown>;
    }) => performanceApi.reviewAction(id, next, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["performance"] });
      toast.success("Performance review updated.");
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, "The review action could not be completed.")),
  });

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (cycleFilter) params.set("cycle_id", cycleFilter);
    if (employeeFilter) params.set("employee_id", employeeFilter);
    if (overdueOnly) params.set("overdue", "1");
    if (selectedId) params.set("review_id", String(selectedId));
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
    selectedId,
    statusFilter,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, cycleFilter, employeeFilter, overdueOnly]);

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [selectedId]);

  React.useEffect(() => {
    if (!selectedId || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId, detailQuery.data]);

  const reviews = reviewsQuery.data?.data ?? [];
  const meta = reviewsQuery.data;
  const references = referencesQuery.data;
  const metrics = dashboardQuery.data?.metrics;
  const refetching = reviewsQuery.isFetching && !reviewsQuery.isLoading;
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

  const clearFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setCycleFilter("");
    setEmployeeFilter("");
    setOverdueOnly(false);
    setSelectedId(null);
  };

  const permissions = { canSelf, canManage, canCalibrate, canAcknowledge };

  return (
    <PerformanceShell
      title="Employee and manager reviews"
      description="Employees reflect on outcomes and behaviors; managers evaluate evidence, calibration protects consistency, and employees acknowledge completed reviews."
    >
      <Alert>
        <Scale aria-hidden="true" />
        <AlertTitle>Evidence-led and manager-accountable</AlertTitle>
        <AlertDescription>
          Goal progress and competency ratings determine the configured score. Attendance snapshots
          can support context, but they never calculate or change an employee rating.
        </AlertDescription>
      </Alert>

      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Review completion"
            value={`${metrics.completion_rate.toFixed(1)}%`}
            description={`${metrics.reviews_completed} of ${metrics.reviews_total} reviews complete.`}
          />
          <Link href="/dashboard/performance/reviews?overdue=1" className="block">
            <MetricCard
              title="Overdue reviews"
              value={metrics.reviews_overdue}
              description="Reviews past due and not completed."
              status={metrics.reviews_overdue ? "overdue" : "clear"}
            />
          </Link>
          <Link href="/dashboard/performance/reviews?status=calibration" className="block">
            <MetricCard
              title="In calibration"
              value={
                dashboardQuery.data?.datasets.review_status.find(
                  (row) => row.status === "calibration",
                )?.value ?? 0
              }
              description="Manager evaluations awaiting calibration."
              status="calibration"
            />
          </Link>
          <Link href="/dashboard/performance/cycles" className="block">
            <MetricCard
              title="Average score"
              value={<Score value={metrics.average_score} />}
              description="Across completed reviews in your scope."
            />
          </Link>
        </div>
      ) : null}

      {(cycleFilter || employeeFilter || overdueOnly) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>
            {overdueOnly ? (
              <strong>Overdue only</strong>
            ) : null}
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
          <Label htmlFor="review-search" className="text-xs">
            Search
          </Label>
          <Input
            id="review-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Employee name or number"
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="review-status" className="text-xs">
            Stage
          </Label>
          <NativeSelect
            id="review-status"
            className="h-9 w-44"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReviewStatusFilter)}
          >
            <NativeSelectOption value="all">Any stage</NativeSelectOption>
            <NativeSelectOption value="not_started">Not started</NativeSelectOption>
            <NativeSelectOption value="self_review">Self review</NativeSelectOption>
            <NativeSelectOption value="manager_review">Manager review</NativeSelectOption>
            <NativeSelectOption value="calibration">Calibration</NativeSelectOption>
            <NativeSelectOption value="manager_submitted">Manager submitted</NativeSelectOption>
            <NativeSelectOption value="completed">Completed</NativeSelectOption>
            <NativeSelectOption value="returned">Returned</NativeSelectOption>
          </NativeSelect>
        </div>
        {references ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="review-cycle-filter" className="text-xs">
                Cycle
              </Label>
              <NativeSelect
                id="review-cycle-filter"
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
              <Label htmlFor="review-employee-filter" className="text-xs">
                Employee
              </Label>
              <NativeSelect
                id="review-employee-filter"
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            reviewsQuery.refetch();
            dashboardQuery.refetch();
            referencesQuery.refetch();
            if (selectedId) detailQuery.refetch();
          }}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {reviewsQuery.isLoading ? (
        <PerformanceLoading />
      ) : reviewsQuery.error || !reviewsQuery.data ? (
        <div className="space-y-3">
          <PerformanceError error={reviewsQuery.error} />
          <Button variant="outline" size="sm" onClick={() => reviewsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : reviews.length === 0 ? (
        <PerformanceEmpty
          title="No reviews yet"
          description={
            filtersActive
              ? "No reviews match these filters."
              : "Activate a review cycle to create one review per active employee."
          }
        />
      ) : (
        <>
          <div className="grid gap-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                expanded={selectedId === review.id}
                nextAction={availableReviewAction(review, permissions)}
                onToggle={() =>
                  setSelectedId((current) => (current === review.id ? null : review.id))
                }
              />
            ))}
          </div>

          {meta && meta.last_page > 1 ? (
            <div className="flex items-center justify-between border-t pt-4">
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

      {selectedId !== null ? (
        <section
          ref={workspaceRef}
          id={`review-workspace-${selectedId}`}
          aria-labelledby="review-workspace-heading"
          className="scroll-mt-6"
        >
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>
                  <h2 id="review-workspace-heading">Review workspace</h2>
                </CardTitle>
                <CardDescription>
                  Complete the action available for this review stage. Required fields are identified
                  in each label.
                </CardDescription>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                <X className="mr-1 h-3.5 w-3.5" />
                Close
              </Button>
            </CardHeader>
            <CardContent>
              {detailQuery.isLoading || referencesQuery.isLoading ? (
                <PerformanceLoading cards={2} />
              ) : detailQuery.error || !detailQuery.data ? (
                <PerformanceError
                  error={detailQuery.error}
                  title="Review details could not be loaded"
                />
              ) : (
                <ReviewWorkspace
                  review={detailQuery.data}
                  competencies={referencesQuery.data?.competencies ?? []}
                  permissions={permissions}
                  busy={action.isPending}
                  onAction={(next, payload) =>
                    action.mutate({ id: detailQuery.data.id, action: next, payload })
                  }
                />
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </PerformanceShell>
  );
}

function ReviewCard({
  review,
  expanded,
  nextAction,
  onToggle,
}: {
  review: PerformanceReview;
  expanded: boolean;
  nextAction: string | null;
  onToggle: () => void;
}) {
  const overdue = isReviewOverdue(review);

  return (
    <Card className={expanded ? "border-primary/40" : undefined}>
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {review.employee?.primary_name ?? `Employee ${review.employee_id}`}
            </span>
            <PerformanceStatus value={review.status} />
            {overdue ? (
              <Badge variant="destructive" className="text-[10px] uppercase tracking-widest">
                Overdue
              </Badge>
            ) : null}
            {review.workflow_status && review.workflow_status !== "not_required" ? (
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                Workflow {review.workflow_status}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/dashboard/performance/reviews?cycle_id=${review.cycle_id}`}
              className="hover:underline"
            >
              {review.cycle?.name ?? "Review cycle"}
            </Link>
            {" · "}Manager: {review.manager?.primary_name ?? "Unassigned"}
            {" · "}Due: {review.due_on ?? "Not set"}
            {" · "}Stage: {reviewStageLabel(review.status)}
          </p>
          {nextAction ? (
            <p className="text-xs text-muted-foreground">
              Next step: <span className="font-medium text-foreground">{nextAction.replace("-", " ")}</span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Overall score</p>
            <Score value={review.overall_score} />
            {review.rating_label ? (
              <p className="text-[11px] text-muted-foreground">{review.rating_label}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            aria-expanded={expanded}
            aria-controls={`review-workspace-${review.id}`}
            onClick={onToggle}
          >
            Work on review
            <ChevronRightIcon
              aria-hidden="true"
              data-icon="inline-end"
              className={expanded ? "rotate-90 transition-transform" : "transition-transform"}
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewWorkspace({
  review,
  competencies,
  permissions,
  busy,
  onAction,
}: {
  review: PerformanceReview;
  competencies: Competency[];
  permissions: {
    canSelf: boolean;
    canManage: boolean;
    canCalibrate: boolean;
    canAcknowledge: boolean;
  };
  busy: boolean;
  onAction: (action: ReviewAction, payload: Record<string, unknown>) => void;
}) {
  const evidence = review.evidence_snapshot;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Employee" value={review.employee?.primary_name ?? `Employee ${review.employee_id}`} />
        <Summary label="Manager" value={review.manager?.primary_name ?? "Not assigned"} />
        <Summary label="Stage" value={<PerformanceStatus value={review.status} />} />
        <Summary label="Rating" value={review.rating_label ?? "Not rated"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Self score" value={<Score value={review.self_score} />} />
        <Summary label="Manager score" value={<Score value={review.manager_score} />} />
        <Summary label="Goal score" value={<Score value={review.goal_score} />} />
        <Summary label="Overall" value={<Score value={review.overall_score} />} />
      </div>

      {evidence ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Attendance evidence snapshot</AlertTitle>
          <AlertDescription>{describeEvidence(evidence)}</AlertDescription>
        </Alert>
      ) : null}

      {review.scores && review.scores.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>Recorded scores</h3>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {review.scores.map((score) => (
              <div
                key={score.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <span>
                  {score.competency?.name ?? score.goal?.title ?? score.source} · {score.source}
                </span>
                <span className="font-semibold tabular-nums">{Number(score.score).toFixed(1)} / 5</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {permissions.canSelf && ["not_started", "self_review", "returned"].includes(review.status) ? (
        <SelfReviewForm
          review={review}
          competencies={competencies}
          busy={busy}
          onSubmit={(payload) => onAction("self-submit", payload)}
        />
      ) : null}
      {permissions.canManage && ["not_started", "manager_review", "returned"].includes(review.status) ? (
        <ManagerReviewForm
          review={review}
          competencies={competencies}
          busy={busy}
          onSubmit={(payload) => onAction("manager-submit", payload)}
        />
      ) : null}
      {permissions.canCalibrate && ["calibration", "manager_submitted"].includes(review.status) ? (
        <CalibrationForm
          review={review}
          busy={busy}
          onSubmit={(payload) => onAction("calibrate", payload)}
        />
      ) : null}
      {permissions.canAcknowledge && review.status === "completed" && !review.acknowledged_at ? (
        <AcknowledgeForm busy={busy} onSubmit={(payload) => onAction("acknowledge", payload)} />
      ) : null}
      {review.status === "completed" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>Completed review summary</h3>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Summary label="Goal score" value={<Score value={review.goal_score} />} />
            <Summary label="Competency score" value={<Score value={review.competency_score} />} />
            <Summary label="Overall score" value={<Score value={review.overall_score} />} />
            <p className="text-sm">
              <span className="font-semibold">Manager summary:</span>{" "}
              {review.manager_summary ?? "No summary recorded."}
            </p>
            {review.employee_comments ? (
              <p className="text-sm">
                <span className="font-semibold">Employee comments:</span> {review.employee_comments}
              </p>
            ) : null}
            {review.acknowledged_at ? (
              <p className="text-xs text-muted-foreground">
                Acknowledged {String(review.acknowledged_at).slice(0, 16).replace("T", " ")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SelfReviewForm({
  review,
  competencies,
  busy,
  onSubmit,
}: {
  review: PerformanceReview;
  competencies: Competency[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  return (
    <ActionForm
      title="Submit self-review"
      description="Reflect on delivered outcomes, strengths, growth areas, and one competency."
      busy={busy}
      button="Submit self-review"
      icon="send"
      onSubmit={(values) =>
        onSubmit({
          self_summary: values.get("summary"),
          strengths: values.get("strengths") || null,
          development_areas: values.get("development") || null,
          career_aspirations: values.get("career") || null,
          scores: [scorePayload(values)],
        })
      }
    >
      <LongField
        id={`self-summary-${review.id}`}
        name="summary"
        label="Self-review summary (required)"
        minLength={20}
        required
      />
      <LongField id={`self-strengths-${review.id}`} name="strengths" label="Strengths demonstrated" />
      <LongField id={`self-development-${review.id}`} name="development" label="Development areas" />
      <LongField id={`self-career-${review.id}`} name="career" label="Career aspirations" />
      <ScoreFields prefix={`self-${review.id}`} competencies={competencies} />
    </ActionForm>
  );
}

function ManagerReviewForm({
  review,
  competencies,
  busy,
  onSubmit,
}: {
  review: PerformanceReview;
  competencies: Competency[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  return (
    <ActionForm
      title="Submit manager evaluation"
      description="Evaluate results and behaviors using documented evidence. The configured cycle weights calculate the overall score."
      busy={busy}
      button="Submit manager evaluation"
      icon="send"
      onSubmit={(values) =>
        onSubmit({
          manager_summary: values.get("summary"),
          strengths: values.get("strengths"),
          development_areas: values.get("development"),
          potential_rating: values.get("potential") || null,
          recommendation: values.get("recommendation") || null,
          scores: [scorePayload(values)],
        })
      }
    >
      <LongField
        id={`manager-summary-${review.id}`}
        name="summary"
        label="Manager summary (required)"
        minLength={20}
        required
      />
      <div className="grid gap-4 md:grid-cols-2">
        <LongField
          id={`manager-strengths-${review.id}`}
          name="strengths"
          label="Demonstrated strengths (required)"
          required
        />
        <LongField
          id={`manager-development-${review.id}`}
          name="development"
          label="Development areas (required)"
          required
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          id={`manager-potential-${review.id}`}
          name="potential"
          label="Potential assessment"
          options={["", "low", "moderate", "high", "critical"]}
        />
        <Select
          id={`manager-recommendation-${review.id}`}
          name="recommendation"
          label="Recommendation"
          options={[
            "",
            "retain",
            "develop",
            "promote",
            "reward",
            "improvement_plan",
            "role_change",
          ]}
        />
      </div>
      <ScoreFields prefix={`manager-${review.id}`} competencies={competencies} />
    </ActionForm>
  );
}

function CalibrationForm({
  review,
  busy,
  onSubmit,
}: {
  review: PerformanceReview;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  return (
    <ActionForm
      title="Calibrate final result"
      description={`Manager result: ${Number(review.manager_score ?? 0).toFixed(1)}%. Record the calibrated score and rationale.`}
      busy={busy}
      button="Complete calibration"
      icon="scale"
      onSubmit={(values) =>
        onSubmit({
          calibrated_score: Number(values.get("score")),
          calibration_notes: values.get("notes"),
        })
      }
    >
      <Field id={`calibrated-score-${review.id}`} label="Calibrated score out of 100 (required)">
        <Input
          id={`calibrated-score-${review.id}`}
          name="score"
          type="number"
          min="0"
          max="100"
          step="0.1"
          defaultValue={Number(review.manager_score ?? 0)}
          required
        />
      </Field>
      <LongField
        id={`calibration-notes-${review.id}`}
        name="notes"
        label="Calibration rationale (required)"
        minLength={10}
        required
      />
    </ActionForm>
  );
}

function AcknowledgeForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  return (
    <ActionForm
      title="Acknowledge completed review"
      description="Acknowledgement confirms the employee received the review; it does not necessarily indicate agreement."
      busy={busy}
      button="Acknowledge review"
      icon="check"
      onSubmit={(values) => onSubmit({ employee_comments: values.get("comments") || null })}
    >
      <LongField id="review-acknowledgement-comments" name="comments" label="Employee comments" />
    </ActionForm>
  );
}

function ActionForm({
  title,
  description,
  busy,
  button,
  icon,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  busy: boolean;
  button: string;
  icon: "send" | "scale" | "check";
  onSubmit: (values: FormData) => void;
  children: React.ReactNode;
}) {
  const Icon = icon === "scale" ? Scale : icon === "check" ? CheckCircle2 : Send;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{title}</h3>
        </CardTitle>
        <CardDescription>{description} Required fields are identified in each label.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={submit}>
          {children}
          <Button type="submit" className="w-fit" disabled={busy}>
            <Icon aria-hidden="true" data-icon="inline-start" />
            <BusyLabel busy={busy}>{button}</BusyLabel>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ScoreFields({
  prefix,
  competencies,
}: {
  prefix: string;
  competencies: Competency[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Select
        id={`${prefix}-competency`}
        name="competency_id"
        label="Competency"
        options={["", ...competencies.map((item) => String(item.id))]}
        optionLabel={(value) =>
          competencies.find((item) => String(item.id) === value)?.name ??
          (value ? value : "General performance")
        }
      />
      <Field id={`${prefix}-score`} label="Score out of 5 (required)">
        <Input
          id={`${prefix}-score`}
          name="score"
          type="number"
          min="0"
          max="5"
          step="0.1"
          required
        />
      </Field>
      <Field id={`${prefix}-evidence`} label="Rating evidence">
        <Input id={`${prefix}-evidence`} name="evidence" maxLength={4000} />
      </Field>
    </div>
  );
}

function scorePayload(values: FormData) {
  const competency = Number(values.get("competency_id"));
  return {
    competency_id: competency || null,
    score: Number(values.get("score")),
    evidence: values.get("evidence") || null,
  };
}

function LongField({
  id,
  name,
  label,
  required,
  minLength,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <Field id={id} label={label}>
      <Textarea
        id={id}
        name={name}
        required={required}
        minLength={minLength}
        maxLength={12000}
      />
    </Field>
  );
}

function Select({
  id,
  name,
  label,
  options,
  optionLabel,
}: {
  id: string;
  name: string;
  label: string;
  options: string[];
  optionLabel?: (value: string) => string;
}) {
  return (
    <Field id={id} label={label}>
      <NativeSelect id={id} name={name} className="w-full" defaultValue={options[0]}>
        {options.map((option) => (
          <NativeSelectOption key={option || "empty"} value={option}>
            {optionLabel?.(option) ?? (option ? option.replaceAll("_", " ") : "Not specified")}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function Field({
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

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
