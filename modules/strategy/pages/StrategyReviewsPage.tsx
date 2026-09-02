"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { strategyApi } from "@/modules/strategy/api";
import type {
  PlanStatus,
  StrategyOverview,
  StrategyPerspective,
  StrategyPlan,
  StrategyReview,
} from "@/modules/strategy/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { n, useDebouncedValue } from "@/modules/strategy/utils";

type ReviewSort = "held_desc" | "held_asc" | "score_asc" | "score_desc";

/** Suggest a period label from a held-on date (e.g. 2026-Q1). */
function suggestPeriodLabel(heldOn: string): string {
  if (!heldOn) return "";
  const date = new Date(heldOn);
  if (Number.isNaN(date.getTime())) return "";
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

function perspectiveWeightTotal(rows: StrategyPerspective[]): number {
  return rows.reduce((sum, row) => sum + n(row.weight), 0);
}

function filterReviews(
  rows: StrategyReview[],
  search: string,
  sort: ReviewSort,
): StrategyReview[] {
  let list = [...rows];

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (row) =>
        row.period_label.toLowerCase().includes(q) ||
        (row.chaired_by ?? "").toLowerCase().includes(q) ||
        (row.decisions ?? "").toLowerCase().includes(q) ||
        (row.attendees ?? "").toLowerCase().includes(q) ||
        (row.notes ?? "").toLowerCase().includes(q),
    );
  }

  if (sort === "held_asc") {
    list.sort((a, b) => String(a.held_on).localeCompare(String(b.held_on)));
  } else if (sort === "score_asc") {
    list.sort((a, b) => n(a.reported_score) - n(b.reported_score));
  } else if (sort === "score_desc") {
    list.sort((a, b) => n(b.reported_score) - n(a.reported_score));
  } else {
    list.sort((a, b) => String(b.held_on).localeCompare(String(a.held_on)));
  }

  return list;
}

/** Delta from the chronologically prior review for the same plan (negative = score fell). */
function reviewScoreDelta(
  review: StrategyReview,
  all: StrategyReview[],
): number | null {
  const samePlan = all
    .filter((row) => row.plan_id === review.plan_id && row.id !== review.id)
    .sort((a, b) => String(b.held_on).localeCompare(String(a.held_on)));

  const prior = samePlan.find((row) => String(row.held_on) < String(review.held_on));
  if (!prior || prior.reported_score === null || review.reported_score === null) return null;

  return n(review.reported_score) - n(prior.reported_score);
}

function hasActiveReviewFilters(opts: {
  search: string;
  planId: string;
  planStatus: string;
  sort: ReviewSort;
}): boolean {
  return Boolean(opts.search.trim() || opts.planId || opts.planStatus || opts.sort !== "held_desc");
}

const DEFAULT_PERSPECTIVES = [
  { code: "FINANCIAL", name: "Financial", weight: 35, sort_order: 1 },
  { code: "CUSTOMER", name: "Customer", weight: 30, sort_order: 2 },
  { code: "PROCESS", name: "Internal Process", weight: 20, sort_order: 3 },
  { code: "LEARNING", name: "Learning and Growth", weight: 15, sort_order: 4 },
];

const PLAN_STATUSES: PlanStatus[] = ["draft", "active", "closed", "archived"];

const STATUS_TONE: Record<PlanStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  archived: "bg-muted text-muted-foreground",
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyPlanForm = {
  code: "",
  name: "",
  vision: "",
  mission: "",
  notes: "",
  starts_on: today(),
  ends_on: "",
  status: "draft" as PlanStatus,
  seed_perspectives: true,
};

const emptyPerspectiveForm = {
  code: "",
  name: "",
  description: "",
  weight: "25",
  sort_order: "0",
};

export default function StrategyReviewsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canManagePlans = hasAnyPermission(["manage_strategy_plans", "manage_strategy"]);
  const canManageReviews = hasAnyPermission(["manage_strategy_reviews", "manage_strategy"]);

  const [planId, setPlanId] = React.useState(searchParams.get("plan_id") ?? "");
  const [planStatusFilter, setPlanStatusFilter] = React.useState(searchParams.get("plan_status") ?? "");
  const [reviewSearchInput, setReviewSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [reviewSort, setReviewSort] = React.useState<ReviewSort>(
    (searchParams.get("sort") as ReviewSort) || "held_desc",
  );
  const [reviewPage, setReviewPage] = React.useState(Number(searchParams.get("page") || 1));
  const [plansPage, setPlansPage] = React.useState(1);
  const [focusReviewId, setFocusReviewId] = React.useState(searchParams.get("review_id") ?? "");

  const shouldOpenMinute = searchParams.get("minute") === "1" || searchParams.get("add") === "1";
  const shouldOpenPlan = searchParams.get("add_plan") === "1";

  const debouncedReviewSearch = useDebouncedValue(reviewSearchInput.trim());

  const [planOpen, setPlanOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<StrategyPlan | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [detailReview, setDetailReview] = React.useState<StrategyReview | null>(null);
  const [perspectiveOpen, setPerspectiveOpen] = React.useState(false);
  const [editingPerspective, setEditingPerspective] = React.useState<StrategyPerspective | null>(null);

  const [planForm, setPlanForm] = React.useState({ ...emptyPlanForm });
  const [perspectiveForm, setPerspectiveForm] = React.useState({ ...emptyPerspectiveForm });
  const [reviewForm, setReviewForm] = React.useState({
    plan_id: "",
    period_label: suggestPeriodLabel(today()),
    held_on: today(),
    chaired_by: "",
    attendees: "",
    decisions: "",
    notes: "",
  });

  const rowRefs = React.useRef<Record<number, HTMLTableRowElement | null>>({});
  const deepLinkHandled = React.useRef(false);
  const minuteOpened = React.useRef(false);
  const planOpened = React.useRef(false);

  const overviewQuery = useQuery({
    queryKey: ["strategy", "overview-reviews", planId],
    queryFn: () =>
      strategyApi
        .overview(planId ? { plan_id: Number(planId) } : undefined)
        .then((res) => res.data),
  });

  const overview = overviewQuery.data?.data;
  const activePlanId = planId ? Number(planId) : overview?.plan?.id;

  const plansQuery = useQuery({
    queryKey: ["strategy", "plans", planStatusFilter, plansPage],
    queryFn: () =>
      strategyApi
        .listPlans({
          page: plansPage,
          limit: 25,
          ...(planStatusFilter ? { status: planStatusFilter } : {}),
        })
        .then((res) => res.data),
  });

  const reviewsQuery = useQuery({
    queryKey: ["strategy", "reviews", activePlanId, reviewPage],
    queryFn: () =>
      strategyApi
        .listReviews({
          page: reviewPage,
          limit: 50,
          ...(activePlanId ? { plan_id: activePlanId } : {}),
        })
        .then((res) => res.data),
  });

  const perspectivesQuery = useQuery({
    queryKey: ["strategy", "plan-perspectives", activePlanId],
    queryFn: () =>
      strategyApi.listPerspectives({ plan_id: activePlanId, limit: 50 }).then((res) => res.data),
    enabled: !!activePlanId,
  });

  const scorePreviewQuery = useQuery({
    queryKey: ["strategy", "score-preview", reviewForm.plan_id],
    queryFn: () =>
      strategyApi.scorecard(Number(reviewForm.plan_id)).then((res) => res.data?.data?.score),
    enabled: reviewOpen && !!reviewForm.plan_id,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["strategy"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (planId) params.set("plan_id", planId);
    if (planStatusFilter) params.set("plan_status", planStatusFilter);
    if (reviewSearchInput.trim()) params.set("search", reviewSearchInput.trim());
    if (reviewSort !== "held_desc") params.set("sort", reviewSort);
    if (focusReviewId) params.set("review_id", focusReviewId);
    if (reviewPage > 1) params.set("page", String(reviewPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    focusReviewId,
    pathname,
    planId,
    planStatusFilter,
    reviewPage,
    reviewSearchInput,
    reviewSort,
    router,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setReviewPage(1);
  }, [activePlanId, debouncedReviewSearch]);

  const createPlan = useMutation({
    mutationFn: async () => {
      const response = await strategyApi.createPlan({
        code: planForm.code,
        name: planForm.name,
        vision: planForm.vision || null,
        mission: planForm.mission || null,
        notes: planForm.notes || null,
        starts_on: planForm.starts_on,
        ends_on: planForm.ends_on,
        status: planForm.status,
      });
      const plan = response.data?.data as StrategyPlan;
      if (planForm.seed_perspectives && plan?.id) {
        await Promise.all(
          DEFAULT_PERSPECTIVES.map((row) =>
            strategyApi.createPerspective({ plan_id: plan.id, ...row }),
          ),
        );
      }
      return response;
    },
    onSuccess: () => {
      toast.success(t("strategy.plans.saved", "Plan created."));
      invalidate();
      setPlanOpen(false);
      setPlanForm({ ...emptyPlanForm });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.plans.save_failed", "Could not create it."))),
  });

  const updatePlan = useMutation({
    mutationFn: () =>
      strategyApi.updatePlan(editingPlan!.id, {
        code: planForm.code,
        name: planForm.name,
        vision: planForm.vision || null,
        mission: planForm.mission || null,
        notes: planForm.notes || null,
        starts_on: planForm.starts_on,
        ends_on: planForm.ends_on,
        status: planForm.status,
      }),
    onSuccess: () => {
      toast.success(t("strategy.plans.updated", "Plan updated."));
      invalidate();
      setEditingPlan(null);
      setPlanOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.plans.update_failed", "Could not update it."))),
  });

  const savePerspective = useMutation({
    mutationFn: () => {
      const payload = {
        plan_id: activePlanId,
        code: perspectiveForm.code,
        name: perspectiveForm.name,
        description: perspectiveForm.description || null,
        weight: Number(perspectiveForm.weight || 1),
        sort_order: Number(perspectiveForm.sort_order || 0),
      };
      return editingPerspective
        ? strategyApi.updatePerspective(editingPerspective.id, payload)
        : strategyApi.createPerspective(payload);
    },
    onSuccess: () => {
      toast.success(
        editingPerspective
          ? t("strategy.scorecard.perspective_updated", "Perspective updated.")
          : t("strategy.scorecard.perspective_saved", "Perspective added."),
      );
      invalidate();
      setPerspectiveOpen(false);
      setEditingPerspective(null);
      setPerspectiveForm({ ...emptyPerspectiveForm });
    },
    onError: (error: any) =>
      toast.error(
        errorText(
          error,
          t("strategy.scorecard.perspective_failed", "Could not save perspective."),
        ),
      ),
  });

  const createReview = useMutation({
    mutationFn: () =>
      strategyApi.createReview({
        plan_id: Number(reviewForm.plan_id),
        period_label: reviewForm.period_label,
        held_on: reviewForm.held_on,
        chaired_by: reviewForm.chaired_by || null,
        attendees: reviewForm.attendees || null,
        decisions: reviewForm.decisions || null,
        notes: reviewForm.notes || null,
      }),
    onSuccess: (response: any) => {
      const score = response?.data?.data?.reported_score;
      toast.success(
        score === null || score === undefined
          ? t("strategy.reviews.saved", "Review minuted with the score as it stands today.")
          : t("strategy.reviews.saved_with_score", "Minuted — reported score frozen at {n}%.").replace(
              "{n}",
              Number(score).toFixed(1),
            ),
      );
      invalidate();
      setReviewOpen(false);
      setReviewForm({
        plan_id: String(activePlanId ?? ""),
        period_label: suggestPeriodLabel(today()),
        held_on: today(),
        chaired_by: "",
        attendees: "",
        decisions: "",
        notes: "",
      });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.reviews.save_failed", "Could not minute it."))),
  });

  const plans = (plansQuery.data?.data ?? []) as StrategyPlan[];
  const plansMeta = plansQuery.data?.meta;
  const reviews = (reviewsQuery.data?.data ?? []) as StrategyReview[];
  const reviewsMeta = reviewsQuery.data?.meta;
  const perspectives = (perspectivesQuery.data?.data ?? []) as StrategyPerspective[];
  const refetching =
    (plansQuery.isFetching && !plansQuery.isLoading) ||
    (reviewsQuery.isFetching && !reviewsQuery.isLoading);

  const visibleReviews = React.useMemo(
    () => filterReviews(reviews, debouncedReviewSearch, reviewSort),
    [debouncedReviewSearch, reviewSort, reviews],
  );

  const weightTotal = perspectiveWeightTotal(perspectives);
  const weightMismatch = perspectives.length > 0 && Math.abs(weightTotal - 100) > 0.5;

  const planById = React.useMemo(() => {
    const map = new Map<number, StrategyPlan>();
    for (const row of plans) map.set(row.id, row);
    if (overview?.plan) map.set(overview.plan.id, overview.plan as StrategyPlan);
    return map;
  }, [overview?.plan, plans]);

  const reviewFiltersActive = hasActiveReviewFilters({
    search: reviewSearchInput,
    planId,
    planStatus: planStatusFilter,
    sort: reviewSort,
  });

  const scorecardHref = React.useCallback(
    (extra: Record<string, string | number | undefined> = {}) => {
      const params = new URLSearchParams();
      if (activePlanId) params.set("plan_id", String(activePlanId));
      for (const [key, value] of Object.entries(extra)) {
        if (value === undefined || value === "") continue;
        params.set(key, String(value));
      }
      const qs = params.toString();
      return qs ? `/dashboard/strategy/scorecard?${qs}` : "/dashboard/strategy/scorecard";
    },
    [activePlanId],
  );

  const reviewsHref = React.useCallback(
    (extra: Record<string, string | number | boolean | undefined> = {}) => {
      const params = new URLSearchParams();
      if (activePlanId) params.set("plan_id", String(activePlanId));
      for (const [key, value] of Object.entries(extra)) {
        if (value === undefined || value === false || value === "") continue;
        params.set(key, value === true ? "1" : String(value));
      }
      const qs = params.toString();
      return qs ? `/dashboard/strategy/reviews?${qs}` : "/dashboard/strategy/reviews";
    },
    [activePlanId],
  );

  const planQueryString = activePlanId ? `?plan_id=${activePlanId}` : "";

  const openEditPlan = (plan: StrategyPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      code: plan.code,
      name: plan.name,
      vision: plan.vision ?? "",
      mission: plan.mission ?? "",
      notes: plan.notes ?? "",
      starts_on: String(plan.starts_on).slice(0, 10),
      ends_on: String(plan.ends_on).slice(0, 10),
      status: plan.status,
      seed_perspectives: false,
    });
    setPlanOpen(true);
  };

  const openNewPlan = () => {
    setEditingPlan(null);
    setPlanForm({ ...emptyPlanForm, starts_on: today() });
    setPlanOpen(true);
  };

  const openPerspectiveDialog = (row?: StrategyPerspective) => {
    if (row) {
      setEditingPerspective(row);
      setPerspectiveForm({
        code: row.code,
        name: row.name,
        description: row.description ?? "",
        weight: String(n(row.weight)),
        sort_order: String(row.sort_order),
      });
    } else {
      setEditingPerspective(null);
      setPerspectiveForm({ ...emptyPerspectiveForm });
    }
    setPerspectiveOpen(true);
  };

  const openMinuteReview = () => {
    setReviewForm({
      plan_id: String(activePlanId ?? ""),
      period_label: suggestPeriodLabel(today()),
      held_on: today(),
      chaired_by: "",
      attendees: "",
      decisions: "",
      notes: "",
    });
    setReviewOpen(true);
  };

  const clearReviewFilters = () => {
    setReviewSearchInput("");
    setPlanId("");
    setPlanStatusFilter("");
    setReviewSort("held_desc");
    setFocusReviewId("");
  };

  React.useEffect(() => {
    planOpened.current = false;
  }, [shouldOpenPlan]);

  React.useEffect(() => {
    if (shouldOpenPlan && canManagePlans && !planOpened.current) {
      planOpened.current = true;
      openNewPlan();
    }
  }, [shouldOpenPlan, canManagePlans]);

  React.useEffect(() => {
    minuteOpened.current = false;
  }, [shouldOpenMinute]);

  React.useEffect(() => {
    if (shouldOpenMinute && canManageReviews && plans.length > 0 && !minuteOpened.current) {
      minuteOpened.current = true;
      openMinuteReview();
    }
  }, [shouldOpenMinute, canManageReviews, plans.length]);

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [focusReviewId]);

  React.useEffect(() => {
    if (!focusReviewId || reviews.length === 0 || deepLinkHandled.current) return;
    const row = reviews.find((item) => String(item.id) === focusReviewId);
    if (!row) return;
    deepLinkHandled.current = true;
    const el = rowRefs.current[row.id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setDetailReview(row);
  }, [focusReviewId, reviews]);

  React.useEffect(() => {
    if (!reviewOpen || reviewForm.period_label) return;
    setReviewForm((current) => ({
      ...current,
      period_label: suggestPeriodLabel(current.held_on),
    }));
  }, [reviewForm.held_on, reviewForm.period_label, reviewOpen]);

  const liveScore = overview?.score;
  const detailDrift =
    detailReview && liveScore !== null && liveScore !== undefined && detailReview.reported_score !== null
      ? n(liveScore) - n(detailReview.reported_score)
      : null;

  return (
    <div className="space-y-6 print:space-y-4">
      <Breadcrumbs
        items={[
          { label: t("strategy.overview.title", "Strategy"), href: "/dashboard/strategy" },
          { label: t("strategy.reviews.title", "Plans and Reviews") },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("strategy.reviews.title", "Plans and Reviews")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "strategy.reviews.subtitle",
              "The minute book. Each review freezes the score as it stood on the day, so a late reading cannot rewrite what the board was actually told.",
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href={`/dashboard/strategy${planQueryString}`}>Overview</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href={scorecardHref()}>Scorecard</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href={`/dashboard/strategy/kpis${planQueryString}`}>KPIs</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href={`/dashboard/strategy/initiatives${planQueryString}`}>Initiatives</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              plansQuery.refetch();
              reviewsQuery.refetch();
              overviewQuery.refetch();
              perspectivesQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            {t("strategy.common.refresh", "Refresh")}
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            {t("strategy.common.print", "Print")}
          </Button>
          {canManagePlans ? (
            <Button variant="outline" className="rounded-full px-5" onClick={openNewPlan}>
              {t("strategy.plans.add", "New Plan")}
            </Button>
          ) : null}
          {canManageReviews ? (
            <Button
              className="rounded-full px-5"
              onClick={openMinuteReview}
              disabled={plans.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("strategy.reviews.add", "Minute Review")}
            </Button>
          ) : null}
        </div>
      </div>

      {overview?.plans && overview.plans.length > 1 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4 print:hidden">
          <div className="space-y-1">
            <Label className="text-xs">{t("strategy.common.plan", "Plan")}</Label>
            <Select
              value={planId || String(activePlanId ?? "current")}
              onValueChange={(value) => setPlanId(value === "current" ? "" : value)}
            >
              <SelectTrigger className="h-9 w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">
                  {overview.plan?.name ?? t("strategy.common.current_plan", "Current plan")}
                </SelectItem>
                {overview.plans.map((plan: StrategyOverview["plans"][number]) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.code} — {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {overview?.plan ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <StatTile
            label={t("strategy.overview.plan_score", "Plan score today")}
            value={overview.score === null ? "—" : `${n(overview.score).toFixed(1)}%`}
            meta={
              overview.pace !== null && overview.pace !== undefined
                ? t("strategy.reviews.pace_meta", "{n} pts vs elapsed").replace(
                    "{n}",
                    `${overview.pace > 0 ? "+" : ""}${n(overview.pace).toFixed(1)}`,
                  )
                : undefined
            }
            href={scorecardHref()}
          />
          <StatTile
            label={t("strategy.reviews.elapsed", "Plan elapsed")}
            value={`${n(overview.plan.elapsed_percent).toFixed(0)}%`}
            meta={t("strategy.reviews.days_meta", "{n} days remaining").replace(
              "{n}",
              String(n(overview.plan.days_remaining)),
            )}
          />
          <StatTile
            label={t("strategy.reviews.count", "Reviews minuted")}
            value={(reviewsMeta?.total ?? reviews.length).toLocaleString()}
            href={reviewsHref()}
          />
          <StatTile
            label={t("strategy.scorecard.perspectives", "Perspectives")}
            value={String(perspectives.length)}
            meta={
              weightMismatch
                ? t("strategy.reviews.weight_warn", "weights sum to {n}").replace(
                    "{n}",
                    weightTotal.toFixed(0),
                  )
                : t("strategy.reviews.weight_ok", "weights sum to 100")
            }
            alert={weightMismatch}
          />
        </div>
      ) : (
        <EmptyPanel label={t("strategy.overview.no_plan", "No strategic plan has been set up yet.")} />
      )}

      {focusReviewId ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm print:hidden">
          <span>
            {t("strategy.reviews.focused", "Focused on review")}{" "}
            <strong>
              {reviews.find((row) => String(row.id) === focusReviewId)?.period_label ??
                `#${focusReviewId}`}
            </strong>
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setFocusReviewId("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("strategy.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      <Panel
        title={t("strategy.plans.title", "Plans")}
        description={t("strategy.plans.desc", "Only one plan is normally active; the rest are kept for the record.")}
      >
        <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
          <div className="space-y-1">
            <Label className="text-xs">{t("strategy.common.status", "Status")}</Label>
            <Select
              value={planStatusFilter || "any"}
              onValueChange={(v) => {
                setPlanStatusFilter(v === "any" ? "" : v);
                setPlansPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-40 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("strategy.common.any", "Any")}</SelectItem>
                {PLAN_STATUSES.map((value) => (
                  <SelectItem key={value} value={value} className="capitalize">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {plansQuery.isLoading ? (
          <LoadingPanel label={t("strategy.common.loading", "Loading plans...")} />
        ) : plansQuery.isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("strategy.plans.load_failed", "Could not load plans.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => plansQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("strategy.common.retry", "Retry")}
            </Button>
          </div>
        ) : plans.length === 0 ? (
          <div className="space-y-3 py-8 text-center">
            <EmptyPanel label={t("strategy.plans.none", "No plans yet.")} />
            {canManagePlans ? (
              <Button variant="outline" size="sm" onClick={openNewPlan}>
                {t("strategy.plans.add", "New Plan")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={`space-y-3 transition-opacity ${refetching ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.plans.plan", "Plan")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.common.status", "Status")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.plans.period", "Period")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.elapsed", "Elapsed")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.plans.contents", "Contents")}</th>
                    {canManagePlans ? (
                      <th className="pb-2 pr-6 text-right font-semibold">
                        {t("strategy.common.actions", "Actions")}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr
                      key={plan.id}
                      className={`border-b border-border/40 last:border-0 ${
                        activePlanId === plan.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => setPlanId(String(plan.id))}
                        >
                          <span className="block font-medium">{plan.name}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {plan.code}
                            {plan.is_current ? (
                              <span className="ml-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                                {t("strategy.plans.current", "current")}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="outline"
                          className={`border-transparent text-[10px] font-black uppercase tracking-widest capitalize ${STATUS_TONE[plan.status]}`}
                        >
                          {plan.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {String(plan.starts_on).slice(0, 10)} → {String(plan.ends_on).slice(0, 10)}
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {n(plan.elapsed_percent).toFixed(0)}%
                        {plan.days_remaining !== null && plan.days_remaining !== undefined ? (
                          <span className="block text-[11px] text-muted-foreground">
                            {plan.days_remaining < 0
                              ? t("strategy.plans.ended", "ended")
                              : t("strategy.reviews.days_meta", "{n} days remaining").replace(
                                  "{n}",
                                  String(plan.days_remaining),
                                )}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {t("strategy.plans.contents_meta", "{o} objectives · {i} initiatives")
                          .replace("{o}", String(n(plan.objectives_count)))
                          .replace("{i}", String(n(plan.initiatives_count)))}
                      </td>
                      {canManagePlans ? (
                        <td className="py-2 pr-6 text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                              <Link href={scorecardHref({ plan_id: plan.id })}>
                                <ExternalLink className="mr-1 h-3 w-3" />
                                {t("strategy.scorecard.title", "Scorecard")}
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => openEditPlan(plan)}
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              {t("strategy.common.edit", "Edit")}
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {plansMeta && plansMeta.last_page > 1 ? (
              <div className="flex items-center justify-between border-t border-border/40 pt-3 text-sm">
                <span className="text-muted-foreground">
                  {t("strategy.common.page_of", "Page {current} of {last} · {total} total")
                    .replace("{current}", String(plansMeta.current_page))
                    .replace("{last}", String(plansMeta.last_page))
                    .replace("{total}", String(plansMeta.total))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={plansMeta.current_page <= 1}
                    onClick={() => setPlansPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={plansMeta.current_page >= plansMeta.last_page}
                    onClick={() => setPlansPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Panel>

      <Panel
        title={t("strategy.scorecard.perspectives", "Perspectives")}
        description={t(
          "strategy.plans.perspectives_desc",
          "Balanced scorecard perspectives for the selected plan. Weights should sum to 100.",
        )}
        action={
          canManagePlans ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openPerspectiveDialog()}
              disabled={!activePlanId}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("strategy.scorecard.add_perspective", "Add Perspective")}
            </Button>
          ) : null
        }
      >
        {!activePlanId ? (
          <EmptyPanel label={t("strategy.plans.select_plan", "Select a plan to view perspectives.")} />
        ) : perspectivesQuery.isLoading ? (
          <LoadingPanel label={t("strategy.common.loading", "Loading...")} />
        ) : perspectives.length === 0 ? (
          <EmptyPanel label={t("strategy.plans.no_perspectives", "No perspectives for this plan.")} />
        ) : (
          <div className="space-y-3">
            {weightMismatch ? (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {t(
                  "strategy.reviews.weight_mismatch",
                  "Perspective weights sum to {n}% — roll-up assumes 100%.",
                ).replace("{n}", weightTotal.toFixed(0))}
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3">{t("strategy.common.name", "Name")}</th>
                    <th className="pb-2 pr-3">{t("strategy.common.code", "Code")}</th>
                    <th className="pb-2 pr-3">{t("strategy.common.weight", "Weight")}</th>
                    <th className="pb-2 pr-3">{t("strategy.scorecard.objectives", "Objectives")}</th>
                    {canManagePlans ? (
                      <th className="pb-2 text-right">{t("strategy.common.actions", "Actions")}</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {perspectives.map((row) => (
                    <tr key={row.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3 font-medium">{row.name}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{row.code}</td>
                      <td className="py-2 pr-3 tabular-nums">{n(row.weight)}</td>
                      <td className="py-2 pr-3 tabular-nums">{n(row.objectives_count)}</td>
                      {canManagePlans ? (
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => openPerspectiveDialog(row)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            {t("strategy.common.edit", "Edit")}
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={t("strategy.reviews.minutes", "Board reviews")}
        description={t(
          "strategy.reviews.minutes_desc",
          "The reported score is a snapshot taken when the review was minuted, not a live figure.",
        )}
      >
        <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
          <div className="space-y-1">
            <Label htmlFor="r-search" className="text-xs">
              {t("strategy.common.search", "Search")}
            </Label>
            <Input
              id="r-search"
              value={reviewSearchInput}
              onChange={(e) => setReviewSearchInput(e.target.value)}
              placeholder={t("strategy.reviews.search_hint", "Period, chair, decisions...")}
              className="h-9 w-56"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("strategy.common.sort", "Sort")}</Label>
            <Select value={reviewSort} onValueChange={(v) => setReviewSort(v as ReviewSort)}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="held_desc">{t("strategy.reviews.sort_newest", "Newest first")}</SelectItem>
                <SelectItem value="held_asc">{t("strategy.reviews.sort_oldest", "Oldest first")}</SelectItem>
                <SelectItem value="score_desc">{t("strategy.reviews.sort_score_high", "Highest score")}</SelectItem>
                <SelectItem value="score_asc">{t("strategy.reviews.sort_score_low", "Lowest score")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {reviewFiltersActive ? (
            <Button variant="ghost" size="sm" className="h-9" onClick={clearReviewFilters}>
              {t("strategy.common.clear_filters", "Clear filters")}
            </Button>
          ) : null}
        </div>

        {reviewsQuery.isLoading ? (
          <LoadingPanel label={t("strategy.common.loading", "Loading reviews...")} />
        ) : reviewsQuery.isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("strategy.reviews.load_failed", "Could not load reviews.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => reviewsQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("strategy.common.retry", "Retry")}
            </Button>
          </div>
        ) : visibleReviews.length === 0 ? (
          <EmptyPanel label={t("strategy.reviews.none", "No reviews minuted yet.")} />
        ) : (
          <div className={`space-y-3 transition-opacity ${refetching ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.period", "Period")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.held", "Held")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.chair", "Chair")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.reported", "Reported score")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.delta", "Change")}</th>
                    <th className="pb-2 pr-6 font-semibold">{t("strategy.reviews.decisions", "Decisions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReviews.map((review) => {
                    const focused = focusReviewId === String(review.id);
                    const delta = reviewScoreDelta(review, reviews);
                    const planName = planById.get(review.plan_id)?.name;
                    return (
                      <tr
                        key={review.id}
                        ref={(el) => {
                          rowRefs.current[review.id] = el;
                        }}
                        className={`border-b border-border/40 last:border-0 ${
                          focused ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => {
                              setFocusReviewId(String(review.id));
                              setDetailReview(review);
                            }}
                          >
                            <span className="block font-medium tabular-nums">{review.period_label}</span>
                            {planName && !activePlanId ? (
                              <span className="block text-[11px] text-muted-foreground">{planName}</span>
                            ) : null}
                          </button>
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums">
                          {String(review.held_on).slice(0, 10)}
                        </td>
                        <td className="py-2 pr-3 text-xs">{review.chaired_by ?? "—"}</td>
                        <td className="py-2 pr-3 text-sm font-bold tabular-nums">
                          {review.reported_score === null ? "—" : `${n(review.reported_score).toFixed(1)}%`}
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums">
                          {delta === null ? (
                            "—"
                          ) : (
                            <span
                              className={
                                delta > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : delta < 0
                                    ? "text-destructive"
                                    : ""
                              }
                            >
                              {delta > 0 ? "+" : ""}
                              {delta.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-6 text-xs text-muted-foreground line-clamp-2">
                          {review.decisions ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {reviewsMeta && reviewsMeta.last_page > 1 ? (
              <div className="flex items-center justify-between border-t border-border/40 pt-3 text-sm">
                <span className="text-muted-foreground">
                  {t("strategy.common.page_of", "Page {current} of {last} · {total} total")
                    .replace("{current}", String(reviewsMeta.current_page))
                    .replace("{last}", String(reviewsMeta.last_page))
                    .replace("{total}", String(reviewsMeta.total))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reviewsMeta.current_page <= 1}
                    onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reviewsMeta.current_page >= reviewsMeta.last_page}
                    onClick={() => setReviewPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Panel>

      {/* Review detail — immutable snapshot */}
      <Dialog open={detailReview !== null} onOpenChange={(open) => !open && setDetailReview(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detailReview?.period_label}
              </DialogTitle>
              <DialogDescription>
                {t("strategy.reviews.snapshot", "Frozen snapshot — cannot be edited.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {detailReview ? (
            <div className="space-y-4 px-6 py-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    {t("strategy.reviews.reported", "Reported score")}
                  </p>
                  <p className="text-2xl font-black tabular-nums">
                    {detailReview.reported_score === null
                      ? "—"
                      : `${n(detailReview.reported_score).toFixed(1)}%`}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    {t("strategy.reviews.live_score", "Live score today")}
                  </p>
                  <p className="text-2xl font-black tabular-nums">
                    {liveScore === null || liveScore === undefined ? "—" : `${n(liveScore).toFixed(1)}%`}
                  </p>
                  {detailDrift !== null ? (
                    <p
                      className={`text-xs ${
                        Math.abs(detailDrift) > 1 ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                      }`}
                    >
                      {t("strategy.reviews.drift", "{n} pts since this review was minuted").replace(
                        "{n}",
                        `${detailDrift > 0 ? "+" : ""}${detailDrift.toFixed(1)}`,
                      )}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-2 text-xs">
                <p>
                  <span className="text-muted-foreground">{t("strategy.reviews.held", "Held")}: </span>
                  {String(detailReview.held_on).slice(0, 10)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("strategy.reviews.chair", "Chair")}: </span>
                  {detailReview.chaired_by ?? "—"}
                </p>
                {detailReview.attendees ? (
                  <p>
                    <span className="text-muted-foreground">
                      {t("strategy.reviews.attendees", "Attendees")}:{" "}
                    </span>
                    {detailReview.attendees}
                  </p>
                ) : null}
              </div>
              {detailReview.decisions ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    {t("strategy.reviews.decisions", "Decisions")}
                  </p>
                  <p className="text-muted-foreground">{detailReview.decisions}</p>
                </div>
              ) : null}
              {detailReview.notes ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    {t("strategy.reviews.notes", "Notes")}
                  </p>
                  <p className="text-muted-foreground">{detailReview.notes}</p>
                </div>
              ) : null}
              {reviewScoreDelta(detailReview, reviews) !== null ? (
                <p className="text-xs text-muted-foreground">
                  {t("strategy.reviews.vs_prior", "Change from prior review")}:{" "}
                  <strong>
                    {reviewScoreDelta(detailReview, reviews)! > 0 ? "+" : ""}
                    {reviewScoreDelta(detailReview, reviews)!.toFixed(1)}%
                  </strong>
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* New / edit plan */}
      <Dialog
        open={planOpen}
        onOpenChange={(open) => {
          setPlanOpen(open);
          if (!open) {
            setEditingPlan(null);
            setPlanForm({ ...emptyPlanForm });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingPlan ? t("strategy.plans.edit", "Edit Plan") : t("strategy.plans.add", "New Plan")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-code">{t("strategy.common.code", "Code")}</Label>
              <Input
                id="p-code"
                value={planForm.code}
                onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("strategy.common.status", "Status")}</Label>
              <Select
                value={planForm.status}
                onValueChange={(v) => setPlanForm({ ...planForm, status: v as PlanStatus })}
              >
                <SelectTrigger className="capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_STATUSES.map((value) => (
                    <SelectItem key={value} value={value} className="capitalize">
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-name">{t("strategy.common.name", "Name")}</Label>
              <Input
                id="p-name"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-start">{t("strategy.plans.starts", "Starts")}</Label>
              <Input
                id="p-start"
                type="date"
                value={planForm.starts_on}
                onChange={(e) => setPlanForm({ ...planForm, starts_on: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-end">{t("strategy.plans.ends", "Ends")}</Label>
              <Input
                id="p-end"
                type="date"
                min={planForm.starts_on}
                value={planForm.ends_on}
                onChange={(e) => setPlanForm({ ...planForm, ends_on: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-vision">{t("strategy.plans.vision", "Vision")}</Label>
              <Textarea
                id="p-vision"
                rows={2}
                value={planForm.vision}
                onChange={(e) => setPlanForm({ ...planForm, vision: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-mission">{t("strategy.plans.mission", "Mission")}</Label>
              <Textarea
                id="p-mission"
                rows={2}
                value={planForm.mission}
                onChange={(e) => setPlanForm({ ...planForm, mission: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-notes">{t("strategy.reviews.notes", "Notes")}</Label>
              <Textarea
                id="p-notes"
                rows={2}
                value={planForm.notes}
                onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
              />
            </div>
            {!editingPlan ? (
              <label className="flex items-center gap-2 sm:col-span-2 text-sm">
                <input
                  type="checkbox"
                  checked={planForm.seed_perspectives}
                  onChange={(e) => setPlanForm({ ...planForm, seed_perspectives: e.target.checked })}
                  className="h-4 w-4"
                />
                {t(
                  "strategy.plans.seed_perspectives",
                  "Seed default balanced scorecard perspectives (Financial, Customer, Process, Learning)",
                )}
              </label>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setPlanOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => (editingPlan ? updatePlan.mutate() : createPlan.mutate())}
              disabled={
                (editingPlan ? updatePlan.isPending : createPlan.isPending) ||
                !planForm.code.trim() ||
                !planForm.name.trim() ||
                !planForm.ends_on
              }
            >
              {(editingPlan ? updatePlan.isPending : createPlan.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / edit perspective */}
      <Dialog
        open={perspectiveOpen}
        onOpenChange={(open) => {
          setPerspectiveOpen(open);
          if (!open) {
            setEditingPerspective(null);
            setPerspectiveForm({ ...emptyPerspectiveForm });
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle>
                {editingPerspective
                  ? t("strategy.scorecard.edit_perspective", "Edit Perspective")
                  : t("strategy.scorecard.add_perspective", "Add Perspective")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("strategy.common.code", "Code")}</Label>
              <Input
                value={perspectiveForm.code}
                onChange={(e) => setPerspectiveForm({ ...perspectiveForm, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("strategy.common.weight", "Weight")}</Label>
              <Input
                type="number"
                min={0}
                value={perspectiveForm.weight}
                onChange={(e) => setPerspectiveForm({ ...perspectiveForm, weight: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("strategy.common.name", "Name")}</Label>
              <Input
                value={perspectiveForm.name}
                onChange={(e) => setPerspectiveForm({ ...perspectiveForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("strategy.common.description", "Description")}</Label>
              <Textarea
                rows={2}
                value={perspectiveForm.description}
                onChange={(e) =>
                  setPerspectiveForm({ ...perspectiveForm, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("strategy.scorecard.sort_order", "Sort order")}</Label>
              <Input
                type="number"
                min={0}
                value={perspectiveForm.sort_order}
                onChange={(e) =>
                  setPerspectiveForm({ ...perspectiveForm, sort_order: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setPerspectiveOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => savePerspective.mutate()}
              disabled={
                savePerspective.isPending ||
                !perspectiveForm.code.trim() ||
                !perspectiveForm.name.trim() ||
                !activePlanId
              }
            >
              {savePerspective.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Minute a review */}
      <Dialog
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) {
            setReviewForm({
              plan_id: String(activePlanId ?? ""),
              period_label: suggestPeriodLabel(today()),
              held_on: today(),
              chaired_by: "",
              attendees: "",
              decisions: "",
              notes: "",
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.reviews.add", "Minute Review")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "strategy.reviews.minute_desc",
                  "The live scorecard score at save time becomes the reported score — permanently frozen.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("strategy.overview.plan", "Plan")}</Label>
              <Select
                value={reviewForm.plan_id || "none"}
                onValueChange={(v) => setReviewForm({ ...reviewForm, plan_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("strategy.common.select", "Select...")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("strategy.common.select", "Select...")}</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reviewForm.plan_id && scorePreviewQuery.data !== undefined ? (
                <p className="text-xs text-muted-foreground">
                  {scorePreviewQuery.isLoading
                    ? t("strategy.reviews.score_loading", "Loading live score...")
                    : t("strategy.reviews.score_preview", "Will be frozen at {n}%.").replace(
                        "{n}",
                        scorePreviewQuery.data === null
                          ? "—"
                          : n(scorePreviewQuery.data).toFixed(1),
                      )}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-period">{t("strategy.reviews.period", "Period")}</Label>
              <Input
                id="v-period"
                value={reviewForm.period_label}
                onChange={(e) => setReviewForm({ ...reviewForm, period_label: e.target.value })}
                placeholder={suggestPeriodLabel(reviewForm.held_on)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("strategy.reviews.period_unique", "One review per plan per period label.")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-held">{t("strategy.reviews.held", "Held on")}</Label>
              <Input
                id="v-held"
                type="date"
                value={reviewForm.held_on}
                onChange={(e) =>
                  setReviewForm({
                    ...reviewForm,
                    held_on: e.target.value,
                    period_label: reviewForm.period_label || suggestPeriodLabel(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-chair">{t("strategy.reviews.chair", "Chaired by")}</Label>
              <Input
                id="v-chair"
                value={reviewForm.chaired_by}
                onChange={(e) => setReviewForm({ ...reviewForm, chaired_by: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-attendees">{t("strategy.reviews.attendees", "Attendees")}</Label>
              <Textarea
                id="v-attendees"
                rows={2}
                value={reviewForm.attendees}
                onChange={(e) => setReviewForm({ ...reviewForm, attendees: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-decisions">{t("strategy.reviews.decisions", "Decisions")}</Label>
              <Textarea
                id="v-decisions"
                rows={3}
                value={reviewForm.decisions}
                onChange={(e) => setReviewForm({ ...reviewForm, decisions: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-notes">{t("strategy.reviews.notes", "Notes")}</Label>
              <Textarea
                id="v-notes"
                rows={2}
                value={reviewForm.notes}
                onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => createReview.mutate()}
              disabled={
                createReview.isPending || !reviewForm.plan_id || !reviewForm.period_label.trim()
              }
            >
              {createReview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("strategy.reviews.minute", "Minute")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
