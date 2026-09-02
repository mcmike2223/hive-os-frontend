"use client";

import * as React from "react";
import { type FormEvent, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  Plus,
  RefreshCw,
  TrendingUp,
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { performanceApi } from "@/modules/performance/api";
import type {
  Checkin,
  Feedback,
  ImprovementPlan,
  PerformanceReferences,
} from "@/modules/performance/types";
import {
  BusyLabel,
  MetricCard,
  PerformanceEmpty,
  PerformanceError,
  PerformanceLoading,
  PerformanceShell,
  PerformanceStatus,
  PerformanceTable,
} from "@/modules/performance/pages/components/performance-shell";
import { useDebouncedValue } from "@/modules/performance/utils";

type DevelopmentSection = "feedback" | "checkins" | "plans";
type Activity = "feedback" | "checkin" | "plan";

function sectionLabel(section: DevelopmentSection): string {
  switch (section) {
    case "feedback":
      return "Feedback";
    case "checkins":
      return "Check-ins";
    case "plans":
      return "Improvement plans";
  }
}

function activityToSection(activity: Activity): DevelopmentSection {
  if (activity === "checkin") return "checkins";
  if (activity === "plan") return "plans";
  return "feedback";
}

function hasActiveDevelopmentFilters(opts: {
  search: string;
  employeeId: string;
  status: string;
}): boolean {
  return Boolean(opts.search.trim() || opts.employeeId || opts.status);
}

function planActionLabel(
  action: "activate" | "acknowledge" | "successful" | "extend" | "unsuccessful" | "cancel",
): string {
  switch (action) {
    case "activate":
      return "Activate";
    case "acknowledge":
      return "Acknowledge";
    case "successful":
      return "Close successful";
    case "extend":
      return "Extend";
    case "unsuccessful":
      return "Close unsuccessful";
    case "cancel":
      return "Cancel";
  }
}

function availablePlanActions(status: string): Array<
  "activate" | "acknowledge" | "successful" | "extend" | "unsuccessful" | "cancel"
> {
  if (["successful", "unsuccessful", "cancelled"].includes(status)) return [];
  const actions: Array<
    "activate" | "acknowledge" | "successful" | "extend" | "unsuccessful" | "cancel"
  > = ["acknowledge", "cancel"];
  if (status === "draft") actions.unshift("activate");
  if (status === "active" || status === "extended") {
    actions.unshift("successful", "extend", "unsuccessful");
  }
  return actions;
}

type PlanAction = "activate" | "acknowledge" | "successful" | "extend" | "unsuccessful" | "cancel";

export default function PerformanceDevelopmentPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canRequestFeedback = hasAnyPermission([
    "request_performance_feedback",
    "provide_performance_feedback",
    "manage_performance",
  ]);
  const canProvideFeedback = hasAnyPermission(["provide_performance_feedback", "manage_performance"]);
  const canCheckin = hasAnyPermission([
    "manage_own_goals",
    "manage_performance_checkins",
    "manage_performance",
  ]);
  const canManagePlans = hasAnyPermission(["manage_improvement_plans", "manage_performance"]);

  const initialSection = (searchParams.get("section") as DevelopmentSection) || "feedback";
  const shouldOpenAdd = searchParams.get("add") as Activity | null;

  const [activity, setActivity] = useState<Activity | null>(null);
  const [section, setSection] = useState<DevelopmentSection>(initialSection);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [employeeFilter, setEmployeeFilter] = useState(searchParams.get("employee_id") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));

  const [inspectingFeedback, setInspectingFeedback] = useState<Feedback | null>(null);
  const [respondingFeedback, setRespondingFeedback] = useState<Feedback | null>(null);
  const [inspectingCheckin, setInspectingCheckin] = useState<Checkin | null>(null);
  const [inspectingPlan, setInspectingPlan] = useState<ImprovementPlan | null>(null);
  const [extendPlan, setExtendPlan] = useState<ImprovementPlan | null>(null);
  const [extendEndsOn, setExtendEndsOn] = useState("");
  const [extendNotes, setExtendNotes] = useState("");
  const [responseText, setResponseText] = useState("");

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const dashboardQuery = useQuery({
    queryKey: ["performance", "dashboard-development"],
    queryFn: performanceApi.dashboard,
  });

  const referencesQuery = useQuery({
    queryKey: ["performance", "references-development"],
    queryFn: performanceApi.references,
  });

  const feedbackQuery = useQuery({
    queryKey: ["performance", "feedback", debouncedSearch, employeeFilter, statusFilter, page, section],
    queryFn: () =>
      performanceApi.feedback({
        page,
        per_page: 25,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(employeeFilter ? { employee_id: Number(employeeFilter) } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    enabled: section === "feedback",
    placeholderData: (previous) => previous,
  });

  const checkinsQuery = useQuery({
    queryKey: ["performance", "checkins", debouncedSearch, employeeFilter, statusFilter, page, section],
    queryFn: () =>
      performanceApi.checkins({
        page,
        per_page: 25,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(employeeFilter ? { employee_id: Number(employeeFilter) } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    enabled: section === "checkins",
    placeholderData: (previous) => previous,
  });

  const plansQuery = useQuery({
    queryKey: ["performance", "plans", debouncedSearch, employeeFilter, statusFilter, page, section],
    queryFn: () =>
      performanceApi.plans({
        page,
        per_page: 25,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(employeeFilter ? { employee_id: Number(employeeFilter) } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    enabled: section === "plans",
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
    if (section !== "feedback") params.set("section", section);
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (employeeFilter) params.set("employee_id", employeeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [employeeFilter, page, pathname, router, searchInput, section, statusFilter]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, employeeFilter, statusFilter, section]);

  React.useEffect(() => {
    if (!shouldOpenAdd) return;
    setActivity(shouldOpenAdd);
    setSection(activityToSection(shouldOpenAdd));
  }, [shouldOpenAdd]);

  const feedbackMutation = useMutation({
    mutationFn: performanceApi.createFeedback,
    onSuccess: async () => {
      await refresh();
      setActivity(null);
      toast.success("Feedback saved.");
    },
    onError: (error: unknown) => toast.error(errorText(error, "Feedback could not be saved.")),
  });

  const feedbackUpdate = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Record<string, unknown>;
    }) => performanceApi.updateFeedback(id, payload),
    onSuccess: async () => {
      await refresh();
      setRespondingFeedback(null);
      setResponseText("");
      toast.success("Feedback updated.");
    },
    onError: (error: unknown) => toast.error(errorText(error, "Feedback could not be updated.")),
  });

  const checkinMutation = useMutation({
    mutationFn: performanceApi.createCheckin,
    onSuccess: async () => {
      await refresh();
      setActivity(null);
      toast.success("Check-in saved.");
    },
    onError: (error: unknown) => toast.error(errorText(error, "Check-in could not be saved.")),
  });

  const checkinUpdate = useMutation({
    mutationFn: (id: number) => performanceApi.updateCheckin(id, { status: "completed" }),
    onSuccess: async () => {
      await refresh();
      toast.success("Check-in completed.");
    },
    onError: (error: unknown) => toast.error(errorText(error, "Check-in could not be completed.")),
  });

  const planMutation = useMutation({
    mutationFn: performanceApi.createPlan,
    onSuccess: async () => {
      await refresh();
      setActivity(null);
      toast.success("Improvement plan saved.");
    },
    onError: (error: unknown) => toast.error(errorText(error, "Improvement plan could not be saved.")),
  });

  const planAction = useMutation({
    mutationFn: ({
      id,
      action,
      payload = {},
    }: {
      id: number;
      action: PlanAction;
      payload?: Record<string, unknown>;
    }) => performanceApi.planAction(id, action, payload),
    onSuccess: async () => {
      await refresh();
      setExtendPlan(null);
      setExtendEndsOn("");
      setExtendNotes("");
      toast.success("Improvement plan updated.");
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, "Improvement plan could not be updated.")),
  });

  const dashboard = dashboardQuery.data;
  const references = referencesQuery.data;
  const loadingReferences = referencesQuery.isLoading || !references;
  const filtersActive = hasActiveDevelopmentFilters({
    search: searchInput,
    employeeId: employeeFilter,
    status: statusFilter,
  });

  const employeeName = references?.employees.find(
    (employee) => String(employee.id) === employeeFilter,
  )?.primary_name;

  const activeQuery =
    section === "feedback" ? feedbackQuery : section === "checkins" ? checkinsQuery : plansQuery;
  const refetching = activeQuery.isFetching && !activeQuery.isLoading;

  const clearFilters = () => {
    setSearchInput("");
    setEmployeeFilter("");
    setStatusFilter("");
  };

  const statusOptions =
    section === "feedback"
      ? ["requested", "submitted", "declined"]
      : section === "checkins"
        ? ["planned", "completed", "missed", "cancelled"]
        : ["draft", "active", "extended", "successful", "unsuccessful", "cancelled"];

  return (
    <PerformanceShell
      title="Feedback and development"
      description="Keep performance continuous with requested feedback, manager check-ins, coaching support, and time-bound improvement plans."
      actions={
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            dashboardQuery.refetch();
            referencesQuery.refetch();
            feedbackQuery.refetch();
            checkinsQuery.refetch();
            plansQuery.refetch();
          }}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {dashboard ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/dashboard/performance/development?section=feedback&status=requested" className="block">
            <MetricCard
              title="Pending feedback"
              value={dashboard.metrics.feedback_pending}
              description="Requests awaiting a response."
              status={dashboard.metrics.feedback_pending ? "requested" : "clear"}
            />
          </Link>
          <MetricCard
            title="Active plans"
            value={dashboard.metrics.active_improvement_plans}
            description="Time-bound improvement plans in progress."
            status="active"
          />
          <Link href="/dashboard/performance/development?section=checkins&status=planned" className="block">
            <MetricCard
              title="Planned check-ins"
              value={
                dashboard.datasets.checkin_trend.at(-1)?.planned ??
                0
              }
              description="Coaching conversations scheduled this month."
              status="planned"
            />
          </Link>
          <Link href="/dashboard/performance/development?section=checkins&status=completed" className="block">
            <MetricCard
              title="Completed check-ins"
              value={
                dashboard.datasets.checkin_trend.at(-1)?.completed ??
                0
              }
              description="Conversations completed this month."
            />
          </Link>
        </div>
      ) : null}

      <section aria-labelledby="add-development-activity">
        <div className="mb-3">
          <h2 id="add-development-activity" className="text-lg font-semibold">
            Add development activity
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose one activity. The selected form appears directly below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRequestFeedback ? (
            <ActivityButton
              selected={activity === "feedback"}
              controls="feedback-form"
              onClick={() => {
                setActivity(activity === "feedback" ? null : "feedback");
                setSection("feedback");
              }}
              icon={MessageSquareText}
            >
              Feedback
            </ActivityButton>
          ) : null}
          {canCheckin ? (
            <ActivityButton
              selected={activity === "checkin"}
              controls="checkin-form"
              onClick={() => {
                setActivity(activity === "checkin" ? null : "checkin");
                setSection("checkins");
              }}
              icon={CalendarCheck2}
            >
              Check-in
            </ActivityButton>
          ) : null}
          {canManagePlans ? (
            <ActivityButton
              selected={activity === "plan"}
              controls="improvement-plan-form"
              onClick={() => {
                setActivity(activity === "plan" ? null : "plan");
                setSection("plans");
              }}
              icon={TrendingUp}
            >
              Improvement plan
            </ActivityButton>
          ) : null}
        </div>
      </section>

      {activity && loadingReferences ? <PerformanceLoading cards={2} /> : null}
      {referencesQuery.error ? (
        <PerformanceError error={referencesQuery.error} title="Employee references could not be loaded" />
      ) : null}
      {activity === "feedback" && references ? (
        <FeedbackForm
          references={references}
          busy={feedbackMutation.isPending}
          onSubmit={(payload) => feedbackMutation.mutate(payload)}
        />
      ) : null}
      {activity === "checkin" && references ? (
        <CheckinForm
          references={references}
          busy={checkinMutation.isPending}
          onSubmit={(payload) => checkinMutation.mutate(payload)}
        />
      ) : null}
      {activity === "plan" && references ? (
        <PlanForm
          references={references}
          busy={planMutation.isPending}
          onSubmit={(payload) => planMutation.mutate(payload)}
        />
      ) : null}

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {(["feedback", "checkins", "plans"] as DevelopmentSection[]).map((item) => (
          <Button
            key={item}
            type="button"
            variant={section === item ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setSection(item);
              setStatusFilter("");
            }}
          >
            {sectionLabel(item)}
          </Button>
        ))}
      </div>

      {employeeFilter ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>
            Employee <strong>{employeeName ?? `#${employeeFilter}`}</strong>
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEmployeeFilter("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="dev-search" className="text-xs">
            Search
          </Label>
          <Input
            id="dev-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={section === "plans" ? "Title or employee" : "Employee name or number"}
            className="h-9 w-56"
          />
        </div>
        {references ? (
          <div className="space-y-1">
            <Label htmlFor="dev-employee" className="text-xs">
              Employee
            </Label>
            <NativeSelect
              id="dev-employee"
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
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="dev-status" className="text-xs">
            Status
          </Label>
          <NativeSelect
            id="dev-status"
            className="h-9 w-40"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <NativeSelectOption value="">Any status</NativeSelectOption>
            {statusOptions.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option.replaceAll("_", " ")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <SectionCard
        section={section}
        feedbackQuery={feedbackQuery}
        checkinsQuery={checkinsQuery}
        plansQuery={plansQuery}
        canProvideFeedback={canProvideFeedback}
        canManagePlans={canManagePlans}
        feedbackUpdatePending={feedbackUpdate.isPending}
        checkinUpdatePending={checkinUpdate.isPending}
        planActionPending={planAction.isPending}
        onInspectFeedback={setInspectingFeedback}
        onRespondFeedback={setRespondingFeedback}
        onDeclineFeedback={(id) => feedbackUpdate.mutate({ id, payload: { status: "declined" } })}
        onInspectCheckin={setInspectingCheckin}
        onCompleteCheckin={(id) => checkinUpdate.mutate(id)}
        onInspectPlan={setInspectingPlan}
        onPlanAction={(row, action) => {
          if (action === "extend") {
            setExtendPlan(row);
            setExtendEndsOn(row.ends_on);
            setExtendNotes(row.outcome_notes ?? "");
            return;
          }
          planAction.mutate({ id: row.id, action });
        }}
        page={page}
        onPageChange={setPage}
      />

      <Dialog open={inspectingFeedback !== null} onOpenChange={(open) => !open && setInspectingFeedback(null)}>
        <DialogContent className="sm:max-w-lg">
          {inspectingFeedback ? (
            <>
              <DialogHeader>
                <DialogTitle>Feedback for {inspectingFeedback.subject?.primary_name}</DialogTitle>
                <DialogDescription>
                  {inspectingFeedback.relationship.replaceAll("_", " ")} ·{" "}
                  {inspectingFeedback.visibility.replaceAll("_", " ")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <PerformanceStatus value={inspectingFeedback.status} />
                </div>
                {inspectingFeedback.strengths ? (
                  <p>
                    <span className="font-semibold">Strengths:</span> {inspectingFeedback.strengths}
                  </p>
                ) : null}
                <p>
                  <span className="font-semibold">Feedback:</span>{" "}
                  {inspectingFeedback.feedback || "Awaiting response"}
                </p>
                {inspectingFeedback.growth_suggestion ? (
                  <p>
                    <span className="font-semibold">Growth:</span>{" "}
                    {inspectingFeedback.growth_suggestion}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={respondingFeedback !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRespondingFeedback(null);
            setResponseText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {respondingFeedback ? (
            <>
              <DialogHeader>
                <DialogTitle>Submit feedback response</DialogTitle>
                <DialogDescription>
                  Record feedback for {respondingFeedback.subject?.primary_name}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="feedback-response-text">Feedback response (required)</Label>
                <Textarea
                  id="feedback-response-text"
                  value={responseText}
                  onChange={(event) => setResponseText(event.target.value)}
                  minLength={10}
                  maxLength={12000}
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setRespondingFeedback(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={feedbackUpdate.isPending || responseText.trim().length < 10}
                  onClick={() =>
                    feedbackUpdate.mutate({
                      id: respondingFeedback.id,
                      payload: { status: "submitted", feedback: responseText.trim() },
                    })
                  }
                >
                  Submit
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={inspectingCheckin !== null} onOpenChange={(open) => !open && setInspectingCheckin(null)}>
        <DialogContent className="sm:max-w-lg">
          {inspectingCheckin ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Check-in · {inspectingCheckin.employee?.primary_name ?? "Employee"}
                </DialogTitle>
                <DialogDescription>{inspectingCheckin.checkin_on}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Goal:</span>{" "}
                  {inspectingCheckin.goal?.title ?? "General check-in"}
                </p>
                <p>
                  <span className="font-semibold">Wins:</span> {inspectingCheckin.wins ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Blockers:</span> {inspectingCheckin.blockers ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Support needed:</span>{" "}
                  {inspectingCheckin.support_needed ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Next steps:</span>{" "}
                  {inspectingCheckin.next_steps ?? "—"}
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={inspectingPlan !== null} onOpenChange={(open) => !open && setInspectingPlan(null)}>
        <DialogContent className="sm:max-w-lg">
          {inspectingPlan ? (
            <>
              <DialogHeader>
                <DialogTitle>{inspectingPlan.title}</DialogTitle>
                <DialogDescription>
                  {inspectingPlan.employee?.primary_name ?? "Employee"} · {inspectingPlan.starts_on} –{" "}
                  {inspectingPlan.ends_on}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>{inspectingPlan.reason}</p>
                <div>
                  <p className="font-semibold">Objectives</p>
                  <ul className="list-disc pl-5">
                    {inspectingPlan.objectives.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                {inspectingPlan.outcome_notes ? (
                  <p>
                    <span className="font-semibold">Outcome notes:</span> {inspectingPlan.outcome_notes}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={extendPlan !== null}
        onOpenChange={(open) => {
          if (!open) {
            setExtendPlan(null);
            setExtendEndsOn("");
            setExtendNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {extendPlan ? (
            <>
              <DialogHeader>
                <DialogTitle>Extend {extendPlan.title}</DialogTitle>
                <DialogDescription>Set a new end date and optional notes.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Field id="extend-ends-on" label="New end date">
                  <Input
                    id="extend-ends-on"
                    type="date"
                    value={extendEndsOn}
                    onChange={(event) => setExtendEndsOn(event.target.value)}
                  />
                </Field>
                <Field id="extend-notes" label="Outcome notes">
                  <Textarea
                    id="extend-notes"
                    value={extendNotes}
                    onChange={(event) => setExtendNotes(event.target.value)}
                    maxLength={8000}
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setExtendPlan(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={planAction.isPending || !extendEndsOn}
                  onClick={() =>
                    planAction.mutate({
                      id: extendPlan.id,
                      action: "extend",
                      payload: { ends_on: extendEndsOn, outcome_notes: extendNotes || null },
                    })
                  }
                >
                  Extend plan
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PerformanceShell>
  );
}

function SectionCard({
  section,
  feedbackQuery,
  checkinsQuery,
  plansQuery,
  canProvideFeedback,
  canManagePlans,
  feedbackUpdatePending,
  checkinUpdatePending,
  planActionPending,
  onInspectFeedback,
  onRespondFeedback,
  onDeclineFeedback,
  onInspectCheckin,
  onCompleteCheckin,
  onInspectPlan,
  onPlanAction,
  page,
  onPageChange,
}: {
  section: DevelopmentSection;
  feedbackQuery: ReturnType<typeof useQuery>;
  checkinsQuery: ReturnType<typeof useQuery>;
  plansQuery: ReturnType<typeof useQuery>;
  canProvideFeedback: boolean;
  canManagePlans: boolean;
  feedbackUpdatePending: boolean;
  checkinUpdatePending: boolean;
  planActionPending: boolean;
  onInspectFeedback: (row: Feedback) => void;
  onRespondFeedback: (row: Feedback) => void;
  onDeclineFeedback: (id: number) => void;
  onInspectCheckin: (row: Checkin) => void;
  onCompleteCheckin: (id: number) => void;
  onInspectPlan: (row: ImprovementPlan) => void;
  onPlanAction: (row: ImprovementPlan, action: PlanAction) => void;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const query =
    section === "feedback" ? feedbackQuery : section === "checkins" ? checkinsQuery : plansQuery;
  const data = query.data as { data: unknown[]; current_page: number; last_page: number; total: number } | undefined;

  const titles: Record<DevelopmentSection, { title: string; description: string; caption: string }> = {
    feedback: {
      title: "Feedback exchange",
      description: "Requested and submitted feedback with controlled visibility.",
      caption: "Performance feedback requests and responses, newest first.",
    },
    checkins: {
      title: "Performance check-ins",
      description: "Planned and completed employee-manager coaching conversations.",
      caption: "Employee performance check-ins ordered by date.",
    },
    plans: {
      title: "Improvement plans",
      description: "Documented expectations, support resources, success measures, cadence, and outcomes.",
      caption: "Performance improvement plans ordered newest first.",
    },
  };

  const copy = titles[section];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{copy.title}</h2>
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <PerformanceLoading cards={2} />
        ) : query.error || !data ? (
          <div className="space-y-3">
            <PerformanceError error={query.error} />
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Retry
            </Button>
          </div>
        ) : data.data.length === 0 ? (
          <PerformanceEmpty title="No records" description={`No ${sectionLabel(section).toLowerCase()} match these filters.`} />
        ) : section === "feedback" ? (
          <>
            <PerformanceTable<Feedback>
              caption={copy.caption}
              rows={data.data as Feedback[]}
              getKey={(row) => row.id}
              columns={[
                {
                  key: "subject",
                  label: "Employee",
                  render: (row) => (
                    <button type="button" className="text-left hover:underline" onClick={() => onInspectFeedback(row)}>
                      {row.subject?.primary_name ?? `Employee ${row.subject_employee_id}`}
                    </button>
                  ),
                },
                {
                  key: "relationship",
                  label: "Perspective",
                  render: (row) => row.relationship.replaceAll("_", " "),
                },
                {
                  key: "visibility",
                  label: "Visibility",
                  render: (row) => row.visibility.replaceAll("_", " "),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <PerformanceStatus value={row.status} />,
                },
                {
                  key: "feedback",
                  label: "Feedback",
                  render: (row) => (
                    <span className="line-clamp-2 max-w-sm">{row.feedback || "Awaiting response"}</span>
                  ),
                },
                {
                  key: "action",
                  label: "Action",
                  align: "right",
                  render: (row) =>
                    row.status === "requested" ? (
                      <div className="flex justify-end gap-1">
                        {canProvideFeedback ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={feedbackUpdatePending}
                            onClick={() => onRespondFeedback(row)}
                          >
                            Respond
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={feedbackUpdatePending}
                          onClick={() => onDeclineFeedback(row.id)}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Recorded</span>
                    ),
                },
              ]}
            />
            <Pagination meta={data} page={page} onPageChange={onPageChange} noun="feedback" />
          </>
        ) : section === "checkins" ? (
          <>
            <PerformanceTable<Checkin>
              caption={copy.caption}
              rows={data.data as Checkin[]}
              getKey={(row) => row.id}
              columns={[
                {
                  key: "employee",
                  label: "Employee",
                  render: (row) => (
                    <button type="button" className="hover:underline" onClick={() => onInspectCheckin(row)}>
                      {row.employee?.primary_name ?? `Employee ${row.employee_id}`}
                    </button>
                  ),
                },
                { key: "date", label: "Date", render: (row) => row.checkin_on },
                {
                  key: "goal",
                  label: "Goal",
                  render: (row) => row.goal?.title ?? "General check-in",
                },
                {
                  key: "progress",
                  label: "Progress",
                  align: "right",
                  render: (row) =>
                    row.progress_percent == null ? "—" : `${Number(row.progress_percent).toFixed(0)}%`,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <PerformanceStatus value={row.status} />,
                },
                {
                  key: "action",
                  label: "Action",
                  align: "right",
                  render: (row) =>
                    row.status === "planned" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={checkinUpdatePending}
                        onClick={() => onCompleteCheckin(row.id)}
                      >
                        Mark completed
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">Recorded</span>
                    ),
                },
              ]}
            />
            <Pagination meta={data} page={page} onPageChange={onPageChange} noun="check-ins" />
          </>
        ) : (
          <>
            <PerformanceTable<ImprovementPlan>
              caption={copy.caption}
              rows={data.data as ImprovementPlan[]}
              getKey={(row) => row.id}
              columns={[
                {
                  key: "employee",
                  label: "Employee",
                  render: (row) => (
                    <button type="button" className="text-left hover:underline" onClick={() => onInspectPlan(row)}>
                      <span className="font-medium">
                        {row.employee?.primary_name ?? `Employee ${row.employee_id}`}
                      </span>
                      <p className="text-xs text-muted-foreground">{row.title}</p>
                    </button>
                  ),
                },
                {
                  key: "period",
                  label: "Support period",
                  render: (row) => `${row.starts_on} – ${row.ends_on}`,
                },
                {
                  key: "cadence",
                  label: "Check-in",
                  render: (row) => row.checkin_frequency,
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
                    <PlanActions
                      row={row}
                      busy={planActionPending}
                      canManage={canManagePlans}
                      onAction={(action) => onPlanAction(row, action)}
                    />
                  ),
                },
              ]}
            />
            <Pagination meta={data} page={page} onPageChange={onPageChange} noun="plans" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Pagination({
  meta,
  page,
  onPageChange,
  noun,
}: {
  meta: { current_page: number; last_page: number; total: number };
  page: number;
  onPageChange: (page: number) => void;
  noun: string;
}) {
  if (meta.last_page <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between border-t pt-4">
      <p className="text-xs text-muted-foreground">
        Page {meta.current_page} of {meta.last_page} · {meta.total} {noun}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page >= meta.last_page}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

type FormProps = {
  references: PerformanceReferences;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
};

function FeedbackForm({ references, busy, onSubmit }: FormProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const feedback = values.get("feedback") || null;
    onSubmit({
      subject_employee_id: Number(values.get("employee_id")),
      author_employee_id: Number(values.get("author_employee_id")) || null,
      relationship: values.get("relationship"),
      visibility: values.get("visibility"),
      status: feedback ? "submitted" : "requested",
      strengths: values.get("strengths") || null,
      feedback,
      growth_suggestion: values.get("growth") || null,
      due_on: values.get("due_on") || null,
      prompts: ["What should this person continue?", "What could increase their impact?"],
    });
  }

  return (
    <ActivityForm
      id="feedback-form"
      title="Request or record feedback"
      description="Leave feedback blank to send a request, or add feedback now to record a submitted response."
      busy={busy}
      button="Save feedback"
      onSubmit={submit}
    >
      <EmployeeSelect
        references={references}
        id="feedback-subject"
        name="employee_id"
        label="Employee receiving feedback (required)"
      />
      <EmployeeSelect
        references={references}
        id="feedback-author"
        name="author_employee_id"
        label="Feedback author"
        required={false}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Select
          id="feedback-relationship"
          name="relationship"
          label="Relationship (required)"
          options={["manager", "peer", "direct_report", "customer", "self"]}
        />
        <Select
          id="feedback-visibility"
          name="visibility"
          label="Visibility (required)"
          options={["manager_and_subject", "manager_only", "subject_only"]}
        />
        <Field id="feedback-due" label="Response due">
          <Input id="feedback-due" name="due_on" type="date" />
        </Field>
      </div>
      <LongField id="feedback-strengths" name="strengths" label="Strengths" />
      <LongField id="feedback-response" name="feedback" label="Feedback response" />
      <LongField id="feedback-growth" name="growth" label="Growth suggestion" />
    </ActivityForm>
  );
}

function CheckinForm({ references, busy, onSubmit }: FormProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({
      employee_id: Number(values.get("employee_id")),
      manager_employee_id: Number(values.get("manager_employee_id")) || null,
      checkin_on: values.get("checkin_on"),
      progress_percent:
        values.get("progress_percent") === "" ? null : Number(values.get("progress_percent")),
      wins: values.get("wins") || null,
      blockers: values.get("blockers") || null,
      support_needed: values.get("support_needed") || null,
      next_steps: values.get("next_steps") || null,
      status: values.get("status"),
    });
  }

  return (
    <ActivityForm
      id="checkin-form"
      title="Schedule or complete a check-in"
      description="Capture wins, blockers, manager support, next steps, and optional goal progress."
      busy={busy}
      button="Save check-in"
      onSubmit={submit}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <EmployeeSelect
          references={references}
          id="checkin-employee"
          name="employee_id"
          label="Employee (required)"
        />
        <EmployeeSelect
          references={references}
          id="checkin-manager"
          name="manager_employee_id"
          label="Manager"
          required={false}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="checkin-date" label="Check-in date (required)">
          <Input
            id="checkin-date"
            name="checkin_on"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>
        <Field id="checkin-progress" label="Goal progress percent">
          <Input
            id="checkin-progress"
            name="progress_percent"
            type="number"
            min="0"
            max="100"
            step="0.1"
          />
        </Field>
        <Select
          id="checkin-status"
          name="status"
          label="Status (required)"
          options={["planned", "completed", "missed", "cancelled"]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <LongField id="checkin-wins" name="wins" label="Wins" />
        <LongField id="checkin-blockers" name="blockers" label="Blockers" />
        <LongField id="checkin-support" name="support_needed" label="Support needed" />
        <LongField id="checkin-next" name="next_steps" label="Next steps" />
      </div>
    </ActivityForm>
  );
}

function PlanForm({ references, busy, onSubmit }: FormProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const lines = (name: string) =>
      String(values.get(name) ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    onSubmit({
      employee_id: Number(values.get("employee_id")),
      manager_employee_id: Number(values.get("manager_employee_id")) || null,
      title: values.get("title"),
      reason: values.get("reason"),
      objectives: lines("objectives"),
      support_resources: lines("resources"),
      success_measures: lines("measures"),
      starts_on: values.get("starts_on"),
      ends_on: values.get("ends_on"),
      checkin_frequency: values.get("frequency"),
      status: "draft",
    });
  }

  return (
    <ActivityForm
      id="improvement-plan-form"
      title="Create improvement plan"
      description="Use a defined support period, observable objectives, and measurable success criteria. This is a development control, not an automatic disciplinary outcome."
      busy={busy}
      button="Save draft plan"
      onSubmit={submit}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <EmployeeSelect
          references={references}
          id="plan-employee"
          name="employee_id"
          label="Employee (required)"
        />
        <EmployeeSelect
          references={references}
          id="plan-manager"
          name="manager_employee_id"
          label="Responsible manager"
          required={false}
        />
      </div>
      <Field id="plan-title" label="Plan title (required)">
        <Input id="plan-title" name="title" required maxLength={220} />
      </Field>
      <LongField
        id="plan-reason"
        name="reason"
        label="Reason and context (required)"
        required
        minLength={20}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <LinesField
          id="plan-objectives"
          name="objectives"
          label="Objectives, one per line (required)"
          required
        />
        <LinesField id="plan-resources" name="resources" label="Support resources, one per line" />
        <LinesField
          id="plan-measures"
          name="measures"
          label="Success measures, one per line (required)"
          required
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="plan-start" label="Starts on (required)">
          <Input id="plan-start" name="starts_on" type="date" required />
        </Field>
        <Field id="plan-end" label="Ends on (required)">
          <Input id="plan-end" name="ends_on" type="date" required />
        </Field>
        <Select
          id="plan-frequency"
          name="frequency"
          label="Check-in frequency (required)"
          options={["weekly", "biweekly", "monthly"]}
        />
      </div>
    </ActivityForm>
  );
}

function ActivityForm({
  id,
  title,
  description,
  busy,
  button,
  onSubmit,
  children,
}: {
  id: string;
  title: string;
  description: string;
  busy: boolean;
  button: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description} Required fields are identified in each label.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={onSubmit}>
          {children}
          <Button type="submit" disabled={busy} className="w-fit">
            <Plus aria-hidden="true" data-icon="inline-start" />
            <BusyLabel busy={busy}>{button}</BusyLabel>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ActivityButton({
  selected,
  controls,
  onClick,
  icon: Icon,
  children,
}: {
  selected: boolean;
  controls: string;
  onClick: () => void;
  icon: typeof MessageSquareText;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      aria-pressed={selected}
      aria-expanded={selected}
      aria-controls={controls}
      onClick={onClick}
    >
      <Icon aria-hidden="true" data-icon="inline-start" />
      {children}
    </Button>
  );
}

function EmployeeSelect({
  references,
  id,
  name,
  label,
  required = true,
}: {
  references: PerformanceReferences;
  id: string;
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <Field id={id} label={label}>
      <NativeSelect
        id={id}
        name={name}
        required={required}
        className="w-full"
        defaultValue={required ? (references.current_employee_id ?? "") : ""}
      >
        <NativeSelectOption value="">{required ? "Select employee" : "Not specified"}</NativeSelectOption>
        {references.employees.map((employee) => (
          <NativeSelectOption key={employee.id} value={employee.id}>
            {employee.primary_name} ({employee.employee_number})
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function PlanActions({
  row,
  busy,
  canManage,
  onAction,
}: {
  row: ImprovementPlan;
  busy: boolean;
  canManage: boolean;
  onAction: (action: PlanAction) => void;
}) {
  if (!canManage) return <span className="text-muted-foreground">View only</span>;
  if (["successful", "unsuccessful", "cancelled"].includes(row.status)) {
    return <span className="text-muted-foreground">Closed</span>;
  }

  const actions = availablePlanActions(row.status);

  return (
    <>
      <Label htmlFor={`plan-action-${row.id}`} className="sr-only">
        Action for {row.title}
      </Label>
      <NativeSelect
        id={`plan-action-${row.id}`}
        value=""
        className="w-40"
        disabled={busy}
        onChange={(event) => {
          const value = event.target.value as PlanAction;
          if (value) onAction(value);
        }}
      >
        <NativeSelectOption value="">Choose action</NativeSelectOption>
        {actions.map((action) => (
          <NativeSelectOption key={action} value={action}>
            {planActionLabel(action)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  id,
  name,
  label,
  options,
}: {
  id: string;
  name: string;
  label: string;
  options: string[];
}) {
  return (
    <Field id={id} label={label}>
      <NativeSelect id={id} name={name} required className="w-full" defaultValue={options[0]}>
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option.replaceAll("_", " ")}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
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

function LinesField({
  id,
  name,
  label,
  required,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <Field id={id} label={label}>
      <Textarea id={id} name={name} required={required} aria-describedby={`${id}-help`} />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        Each non-empty line becomes one item.
      </p>
    </Field>
  );
}
