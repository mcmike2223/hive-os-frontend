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
import { talentApi } from "@/modules/humanresources/talent/api";
import type {
  Competency,
  DevelopmentPlan,
  TrainingCourse,
  TrainingEnrollment,
  TrainingSession,
  TrainingSummary,
} from "@/modules/humanresources/talent/types";
import { StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart } from "@/modules/shared/charts/charts";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const TABS = ["courses", "sessions", "enrollments", "plans"] as const;
type Tab = (typeof TABS)[number];

const OUTCOMES = ["attended", "completed", "failed", "no_show", "cancelled"] as const;

const ENROLLMENT_TONE: Record<string, string> = {
  completed: "default",
  registered: "secondary",
  attended: "secondary",
  failed: "destructive",
  no_show: "destructive",
  cancelled: "outline",
};

export default function TrainingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<Tab>("courses");
  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });

  const [courseOpen, setCourseOpen] = React.useState(false);
  const [courseForm, setCourseForm] = React.useState({
    id: undefined as number | undefined,
    code: "",
    title: "",
    category: "",
    provider: "",
    duration_hours: "8",
    cost_per_seat: "0",
    competency_id: "",
    target_level: "",
  });

  const [sessionOpen, setSessionOpen] = React.useState(false);
  const [sessionForm, setSessionForm] = React.useState({
    course_id: "",
    starts_at: "",
    ends_at: "",
    location: "",
    trainer: "",
    capacity: "",
    budget_amount: "0",
  });

  const [enrolOpen, setEnrolOpen] = React.useState(false);
  const [enrolForm, setEnrolForm] = React.useState({ session_id: "", employee_id: "" });

  const [outcomeFor, setOutcomeFor] = React.useState<TrainingEnrollment | null>(null);
  const [outcomeForm, setOutcomeForm] = React.useState({
    status: "completed",
    score: "",
    feedback_rating: "",
  });

  const summaryQuery = useQuery({
    queryKey: ["hr-talent", "training", "summary"],
    queryFn: () => talentApi.trainingSummary().then((res) => res.data),
  });

  const coursesQuery = useQuery({
    queryKey: ["hr-talent", "training", "courses", tableQuery],
    queryFn: () =>
      talentApi
        .listCourses({ page: tableQuery.page, limit: tableQuery.pageSize, search: tableQuery.search || undefined })
        .then((res) => res.data),
    enabled: tab === "courses",
  });

  // The session and enrol dialogs both need the full course list regardless of
  // which tab is showing, so this one is not tab-gated.
  const courseOptionsQuery = useQuery({
    queryKey: ["hr-talent", "training", "course-options"],
    queryFn: () => talentApi.listCourses({ limit: 100 }).then((res) => res.data),
  });

  const sessionsQuery = useQuery({
    queryKey: ["hr-talent", "training", "sessions", tableQuery],
    queryFn: () =>
      talentApi.listSessions({ page: tableQuery.page, limit: tableQuery.pageSize }).then((res) => res.data),
    enabled: tab === "sessions" || enrolOpen,
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["hr-talent", "training", "enrollments", tableQuery],
    queryFn: () =>
      talentApi.listEnrollments({ page: tableQuery.page, limit: tableQuery.pageSize }).then((res) => res.data),
    enabled: tab === "enrollments",
  });

  const plansQuery = useQuery({
    queryKey: ["hr-talent", "training", "plans", tableQuery],
    queryFn: () =>
      talentApi.listPlans({ page: tableQuery.page, limit: tableQuery.pageSize }).then((res) => res.data),
    enabled: tab === "plans",
  });

  const competencyQuery = useQuery({
    queryKey: ["hr-talent", "competency-options"],
    queryFn: () => talentApi.listCompetencies({ limit: 100 }).then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["hr-talent"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveCourse = useMutation({
    mutationFn: () => {
      const payload = {
        code: courseForm.code,
        title: courseForm.title,
        category: courseForm.category || null,
        provider: courseForm.provider || null,
        duration_hours: Number(courseForm.duration_hours || 0),
        cost_per_seat: Number(courseForm.cost_per_seat || 0),
        competency_id: courseForm.competency_id ? Number(courseForm.competency_id) : null,
        target_level: courseForm.target_level ? Number(courseForm.target_level) : null,
      };

      return courseForm.id ? talentApi.updateCourse(courseForm.id, payload) : talentApi.createCourse(payload);
    },
    onSuccess: () => {
      toast.success(t("hr_talent.training.course_saved", "Course saved."));
      invalidate();
      setCourseOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.training.course_failed", "Could not save the course."))),
  });

  const saveSession = useMutation({
    mutationFn: () =>
      talentApi.createSession({
        course_id: Number(sessionForm.course_id),
        starts_at: sessionForm.starts_at || null,
        ends_at: sessionForm.ends_at || null,
        location: sessionForm.location || null,
        trainer: sessionForm.trainer || null,
        capacity: sessionForm.capacity ? Number(sessionForm.capacity) : null,
        budget_amount: Number(sessionForm.budget_amount || 0),
      }),
    onSuccess: () => {
      toast.success(t("hr_talent.training.session_saved", "Session scheduled."));
      invalidate();
      setSessionOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.training.session_failed", "Could not schedule the session."))),
  });

  const enrol = useMutation({
    mutationFn: () =>
      talentApi.enrol(Number(enrolForm.session_id), { employee_id: Number(enrolForm.employee_id) }),
    onSuccess: () => {
      toast.success(t("hr_talent.training.enrolled", "Employee enrolled."));
      invalidate();
      setEnrolOpen(false);
    },
    // The service refuses a full session and a duplicate seat by name, so
    // relay its message rather than a generic failure.
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.training.enrol_failed", "Could not enrol that employee."))),
  });

  const recordOutcome = useMutation({
    mutationFn: () =>
      talentApi.recordOutcome(outcomeFor!.id, {
        status: outcomeForm.status,
        score: outcomeForm.score ? Number(outcomeForm.score) : null,
        feedback_rating: outcomeForm.feedback_rating ? Number(outcomeForm.feedback_rating) : null,
      }),
    onSuccess: () => {
      toast.success(
        t("hr_talent.training.outcome_saved", "Outcome recorded. A pass raises the linked competency."),
      );
      invalidate();
      setOutcomeFor(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.training.outcome_failed", "Could not record the outcome."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const summary: TrainingSummary | undefined = summaryQuery.data?.data;
  const competencies = (competencyQuery.data?.data ?? []) as Competency[];
  const courseOptions = (courseOptionsQuery.data?.data ?? []) as TrainingCourse[];
  const sessions = (sessionsQuery.data?.data ?? []) as TrainingSession[];

  const courseColumns = React.useMemo<ColumnDef<TrainingCourse>[]>(
    () => [
      {
        id: "course",
        header: t("hr_talent.training.course", "Course"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.title}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: t("hr_talent.common.category", "Category"),
        cell: ({ row }) => <span className="text-xs">{row.original.category ?? "—"}</span>,
      },
      {
        id: "builds",
        header: t("hr_talent.training.builds", "Builds"),
        cell: ({ row }) =>
          row.original.competency_id ? (
            <Badge variant="outline" className="text-[11px]">
              {row.original.competency?.name ?? `#${row.original.competency_id}`}
              {row.original.target_level ? ` → L${row.original.target_level}` : ""}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "duration_hours",
        header: t("hr_talent.training.duration", "Hours"),
        cell: ({ row }) => <span className="tabular-nums">{n(row.original.duration_hours)}</span>,
      },
      {
        accessorKey: "cost_per_seat",
        header: t("hr_talent.training.cost_per_seat", "Per seat"),
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.cost_per_seat)}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCourseForm({
                  id: row.original.id,
                  code: row.original.code,
                  title: row.original.title,
                  category: row.original.category ?? "",
                  provider: row.original.provider ?? "",
                  duration_hours: String(n(row.original.duration_hours)),
                  cost_per_seat: String(n(row.original.cost_per_seat)),
                  competency_id: row.original.competency_id ? String(row.original.competency_id) : "",
                  target_level: row.original.target_level ? String(row.original.target_level) : "",
                });
                setCourseOpen(true);
              }}
            >
              {t("hr_talent.common.edit", "Edit")}
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  const sessionColumns = React.useMemo<ColumnDef<TrainingSession>[]>(
    () => [
      {
        id: "session",
        header: t("hr_talent.training.session", "Session"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.course?.title ?? `#${row.original.course_id}`}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.location ?? t("hr_talent.training.no_location", "Location not set")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "starts_at",
        header: t("hr_talent.training.starts", "Starts"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.starts_at ? String(row.original.starts_at).slice(0, 10) : "—"}
          </span>
        ),
      },
      {
        id: "seats",
        header: t("hr_talent.training.seats", "Seats"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.capacity
              ? `${n(row.original.enrollments?.length)} / ${row.original.capacity}`
              : t("hr_talent.training.unlimited", "Unlimited")}
          </span>
        ),
      },
      {
        accessorKey: "budget_amount",
        header: t("hr_talent.training.budget", "Budget"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs tabular-nums">
            <p>{money(row.original.budget_amount)}</p>
            <p className="text-muted-foreground">
              {t("hr_talent.training.actual", "Actual")} {money(row.original.actual_cost)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("hr_talent.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] capitalize">
            {String(row.original.status).replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEnrolForm({ session_id: String(row.original.id), employee_id: "" });
                setEnrolOpen(true);
              }}
            >
              {t("hr_talent.training.enrol", "Enrol")}
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  const enrollmentColumns = React.useMemo<ColumnDef<TrainingEnrollment>[]>(
    () => [
      {
        id: "employee",
        header: t("hr_talent.common.employee", "Employee"),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.employee?.primary_name ?? `#${row.original.employee_id}`}
          </span>
        ),
      },
      {
        id: "course",
        header: t("hr_talent.training.course", "Course"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.session?.course?.title ?? `#${row.original.session_id}`}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("hr_talent.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant={(ENROLLMENT_TONE[row.original.status] ?? "outline") as any} className="text-[11px] capitalize">
            {row.original.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "score",
        header: t("hr_talent.training.score", "Score"),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.score ?? "—"}</span>
        ),
      },
      {
        id: "applied",
        header: t("hr_talent.training.applied", "Competency"),
        cell: ({ row }) =>
          row.original.competency_applied ? (
            <Badge className="text-[11px]">{t("hr_talent.training.raised", "Raised")}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOutcomeFor(row.original);
                setOutcomeForm({
                  status: "completed",
                  score: row.original.score ? String(row.original.score) : "",
                  feedback_rating: row.original.feedback_rating
                    ? String(row.original.feedback_rating)
                    : "",
                });
              }}
            >
              {t("hr_talent.training.record_outcome", "Outcome")}
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  const planColumns = React.useMemo<ColumnDef<DevelopmentPlan>[]>(
    () => [
      {
        id: "employee",
        header: t("hr_talent.common.employee", "Employee"),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.employee?.primary_name ?? `#${row.original.employee_id}`}
          </span>
        ),
      },
      {
        id: "objective",
        header: t("hr_talent.training.objective", "Objective"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm">{row.original.objective ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.competency?.name ?? ""}
              {row.original.target_level ? ` → L${row.original.target_level}` : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "progress_percent",
        header: t("hr_talent.training.progress", "Progress"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{n(row.original.progress_percent)}%</span>
        ),
      },
      {
        accessorKey: "due_on",
        header: t("hr_talent.common.due", "Due"),
        cell: ({ row }) => <span className="text-xs tabular-nums">{row.original.due_on ?? "—"}</span>,
      },
      {
        accessorKey: "status",
        header: t("hr_talent.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] capitalize">
            {String(row.original.status).replace(/_/g, " ")}
          </Badge>
        ),
      },
    ],
    [t],
  );

  const activeQuery =
    tab === "courses"
      ? coursesQuery
      : tab === "sessions"
        ? sessionsQuery
        : tab === "enrollments"
          ? enrollmentsQuery
          : plansQuery;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("hr_talent.training.title", "Training and Development")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "hr_talent.training.subtitle",
              "Courses, seats and outcomes. Completing a course raises the competency it was built for, which is what closes a succession gap.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={() => setSessionOpen(true)}>
            {t("hr_talent.training.schedule", "Schedule Session")}
          </Button>
          <Button
            className="rounded-full px-5"
            onClick={() => {
              setCourseForm({
                id: undefined,
                code: "",
                title: "",
                category: "",
                provider: "",
                duration_hours: "8",
                cost_per_seat: "0",
                competency_id: "",
                target_level: "",
              });
              setCourseOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("hr_talent.training.add_course", "Add Course")}
          </Button>
        </div>
      </div>

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("hr_talent.training.completion", "Completion rate")}
              value={`${n(summary.completion_rate_percent).toFixed(0)}%`}
              meta={t("hr_talent.training.completion_meta", "{done} of {total} seats").replace(
                "{done}",
                String(n(summary.completed)),
              ).replace("{total}", String(n(summary.enrollments)))}
            />
            <StatTile
              label={t("hr_talent.training.no_show", "No-show rate")}
              value={`${n(summary.no_show_rate_percent).toFixed(0)}%`}
              alert={n(summary.no_show_rate_percent) > 10}
            />
            <StatTile
              label={t("hr_talent.training.spend", "Spend against budget")}
              value={money(summary.actual_cost)}
              meta={t("hr_talent.training.budget_meta", "{budget} budgeted").replace(
                "{budget}",
                money(summary.budget),
              )}
              alert={n(summary.actual_cost) > n(summary.budget)}
            />
            <StatTile
              label={t("hr_talent.training.hours", "Hours delivered")}
              value={n(summary.training_hours).toLocaleString()}
              meta={
                summary.average_rating !== null && summary.average_rating !== undefined
                  ? t("hr_talent.training.rating_meta", "{rating}/5 average rating").replace(
                      "{rating}",
                      n(summary.average_rating).toFixed(1),
                    )
                  : t("hr_talent.training.no_rating", "Not rated yet")
              }
            />
          </div>

          <ColumnChart
            title={t("hr_talent.training.by_category", "Seats by category")}
            description={t(
              "hr_talent.training.by_category_desc",
              "Where training effort is actually going, and what it cost.",
            )}
            rows={(summary.by_category ?? []).map((row) => ({
              key: row.category,
              label: row.category,
              value: n(row.enrollments),
              meta: `${n(row.sessions)} ${t("hr_talent.training.sessions", "sessions")} · ${money(row.cost)}`,
            }))}
            valueLabel={t("hr_talent.training.enrollments", "Enrollments")}
            emptyLabel={t("hr_talent.training.no_data", "No training recorded yet.")}
          />
        </>
      ) : null}

      <div className="flex gap-2 border-b border-border/60">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${
              tab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            aria-current={tab === value ? "page" : undefined}
          >
            {value}
          </button>
        ))}
      </div>

      <DataTable
        columns={
          (tab === "courses"
            ? courseColumns
            : tab === "sessions"
              ? sessionColumns
              : tab === "enrollments"
                ? enrollmentColumns
                : planColumns) as ColumnDef<any>[]
        }
        data={(activeQuery.data?.data ?? []) as any[]}
        totalEntries={activeQuery.data?.meta?.total ?? 0}
        loading={activeQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("hr_talent.training.search", "Search training...")}
        resourceName={`hr-training-${tab}`}
      />

      {/* Course */}
      <Dialog open={courseOpen} onOpenChange={setCourseOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {courseForm.id
                  ? t("hr_talent.training.edit_course", "Edit Course")
                  : t("hr_talent.training.new_course", "New Course")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.training.course_desc",
                  "Link a course to the competency it builds and the level it certifies — that link is what makes completion move a succession gap.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="course-code">{t("hr_talent.common.code", "Code")}</Label>
              <Input
                id="course-code"
                value={courseForm.code}
                onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-title">{t("hr_talent.common.title", "Title")}</Label>
              <Input
                id="course-title"
                value={courseForm.title}
                onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-category">{t("hr_talent.common.category", "Category")}</Label>
              <Input
                id="course-category"
                value={courseForm.category}
                onChange={(event) => setCourseForm({ ...courseForm, category: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-provider">{t("hr_talent.training.provider", "Provider")}</Label>
              <Input
                id="course-provider"
                value={courseForm.provider}
                onChange={(event) => setCourseForm({ ...courseForm, provider: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-hours">{t("hr_talent.training.duration", "Hours")}</Label>
              <Input
                id="course-hours"
                type="number"
                min={0}
                value={courseForm.duration_hours}
                onChange={(event) => setCourseForm({ ...courseForm, duration_hours: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-cost">{t("hr_talent.training.cost_per_seat", "Cost per seat")}</Label>
              <Input
                id="course-cost"
                type="number"
                min={0}
                value={courseForm.cost_per_seat}
                onChange={(event) => setCourseForm({ ...courseForm, cost_per_seat: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-competency">
                {t("hr_talent.training.competency_built", "Competency built")}
              </Label>
              <select
                id="course-competency"
                value={courseForm.competency_id}
                onChange={(event) => setCourseForm({ ...courseForm, competency_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("hr_talent.common.none", "None")}</option>
                {competencies.map((competency) => (
                  <option key={competency.id} value={competency.id}>
                    {competency.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-target">{t("hr_talent.training.target_level", "Certifies level")}</Label>
              <Input
                id="course-target"
                type="number"
                min={1}
                max={10}
                value={courseForm.target_level}
                onChange={(event) => setCourseForm({ ...courseForm, target_level: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCourseOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveCourse.mutate()}
              disabled={saveCourse.isPending || !courseForm.code.trim() || !courseForm.title.trim()}
            >
              {t("hr_talent.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session */}
      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("hr_talent.training.schedule", "Schedule Session")}
              </DialogTitle>
              <DialogDescription>
                {t("hr_talent.training.session_desc", "A dated running of a course, with its own seats and budget.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="session-course">{t("hr_talent.training.course", "Course")}</Label>
              <select
                id="session-course"
                value={sessionForm.course_id}
                onChange={(event) => setSessionForm({ ...sessionForm, course_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("hr_talent.common.select", "Select...")}</option>
                {courseOptions.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-starts">{t("hr_talent.training.starts", "Starts")}</Label>
              <Input
                id="session-starts"
                type="date"
                value={sessionForm.starts_at}
                onChange={(event) => setSessionForm({ ...sessionForm, starts_at: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-ends">{t("hr_talent.training.ends", "Ends")}</Label>
              <Input
                id="session-ends"
                type="date"
                value={sessionForm.ends_at}
                min={sessionForm.starts_at || undefined}
                onChange={(event) => setSessionForm({ ...sessionForm, ends_at: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-location">{t("hr_talent.training.location", "Location")}</Label>
              <Input
                id="session-location"
                value={sessionForm.location}
                onChange={(event) => setSessionForm({ ...sessionForm, location: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-trainer">{t("hr_talent.training.trainer", "Trainer")}</Label>
              <Input
                id="session-trainer"
                value={sessionForm.trainer}
                onChange={(event) => setSessionForm({ ...sessionForm, trainer: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-capacity">{t("hr_talent.training.capacity", "Capacity")}</Label>
              <Input
                id="session-capacity"
                type="number"
                min={1}
                value={sessionForm.capacity}
                onChange={(event) => setSessionForm({ ...sessionForm, capacity: event.target.value })}
                placeholder={t("hr_talent.training.unlimited", "Unlimited")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-budget">{t("hr_talent.training.budget", "Budget")}</Label>
              <Input
                id="session-budget"
                type="number"
                min={0}
                value={sessionForm.budget_amount}
                onChange={(event) => setSessionForm({ ...sessionForm, budget_amount: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setSessionOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => saveSession.mutate()} disabled={saveSession.isPending || !sessionForm.course_id}>
              {t("hr_talent.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrol */}
      <Dialog open={enrolOpen} onOpenChange={setEnrolOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("hr_talent.training.enrol", "Enrol")}
              </DialogTitle>
              <DialogDescription>
                {t("hr_talent.training.enrol_desc", "Seats are limited by the session capacity.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="enrol-session">{t("hr_talent.training.session", "Session")}</Label>
              <select
                id="enrol-session"
                value={enrolForm.session_id}
                onChange={(event) => setEnrolForm({ ...enrolForm, session_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("hr_talent.common.select", "Select...")}</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.course?.title ?? `#${session.course_id}`}
                    {session.starts_at ? ` — ${String(session.starts_at).slice(0, 10)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enrol-employee">{t("hr_talent.common.employee_id", "Employee ID")}</Label>
              <Input
                id="enrol-employee"
                type="number"
                value={enrolForm.employee_id}
                onChange={(event) => setEnrolForm({ ...enrolForm, employee_id: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setEnrolOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => enrol.mutate()}
              disabled={enrol.isPending || !enrolForm.session_id || !enrolForm.employee_id}
            >
              {t("hr_talent.training.enrol", "Enrol")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome */}
      <Dialog open={outcomeFor !== null} onOpenChange={(open) => !open && setOutcomeFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("hr_talent.training.record_outcome", "Record Outcome")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.training.outcome_desc",
                  "Marking a seat completed raises the linked competency to the level the course certifies — once, never twice.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="outcome-status">{t("hr_talent.common.status", "Status")}</Label>
              <select
                id="outcome-status"
                value={outcomeForm.status}
                onChange={(event) => setOutcomeForm({ ...outcomeForm, status: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {OUTCOMES.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outcome-score">{t("hr_talent.training.score", "Score")}</Label>
              <Input
                id="outcome-score"
                type="number"
                min={0}
                max={100}
                value={outcomeForm.score}
                onChange={(event) => setOutcomeForm({ ...outcomeForm, score: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outcome-rating">{t("hr_talent.training.rating", "Rating (1–5)")}</Label>
              <Input
                id="outcome-rating"
                type="number"
                min={1}
                max={5}
                value={outcomeForm.feedback_rating}
                onChange={(event) => setOutcomeForm({ ...outcomeForm, feedback_rating: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setOutcomeFor(null)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => recordOutcome.mutate()} disabled={recordOutcome.isPending}>
              {t("hr_talent.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
