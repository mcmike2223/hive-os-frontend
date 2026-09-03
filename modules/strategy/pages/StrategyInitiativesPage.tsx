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
  TrendingUp,
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
  InitiativeStatus,
  StrategyInitiative,
  StrategyObjective,
  StrategyOverview,
} from "@/modules/strategy/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { n, useDebouncedValue } from "@/modules/strategy/utils";

type InitiativeSort = "due_date" | "overdue_first" | "worst_burn" | "code";

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** Late or burning budget faster than progress — the dashboard's at-risk definition. */
function isAtRisk(row: StrategyInitiative): boolean {
  return Boolean(row.is_overdue || row.is_overspending);
}

/** Positive means spend is ahead of delivery (budget % minus progress %). */
function burnGap(row: StrategyInitiative): number {
  const used = row.budget_used_percent;
  if (used === null || used === undefined) return 0;
  return used - row.progress_percent;
}

function filterAndSortInitiatives(
  rows: StrategyInitiative[],
  opts: {
    overdueOnly: boolean;
    overspendingOnly: boolean;
    atRiskOnly: boolean;
    sort: InitiativeSort;
  },
): StrategyInitiative[] {
  let list = [...rows];

  if (opts.atRiskOnly) {
    list = list.filter(isAtRisk);
  }
  if (opts.overdueOnly) {
    list = list.filter((row) => row.is_overdue);
  }
  if (opts.overspendingOnly) {
    list = list.filter((row) => row.is_overspending);
  }

  if (opts.sort === "overdue_first") {
    list.sort((a, b) => {
      const aLate = a.is_overdue ? 1 : 0;
      const bLate = b.is_overdue ? 1 : 0;
      if (bLate !== aLate) return bLate - aLate;
      return (a.ends_on ?? "").localeCompare(b.ends_on ?? "");
    });
  } else if (opts.sort === "worst_burn") {
    list.sort((a, b) => burnGap(b) - burnGap(a));
  } else if (opts.sort === "code") {
    list.sort((a, b) => a.code.localeCompare(b.code));
  } else {
    list.sort((a, b) => (a.ends_on ?? "").localeCompare(b.ends_on ?? ""));
  }

  return list;
}

function hasActiveInitiativeFilters(opts: {
  search: string;
  objectiveId: string;
  status: string;
  openOnly: boolean;
  overdueOnly: boolean;
  overspendingOnly: boolean;
  atRiskOnly: boolean;
  sort: InitiativeSort;
}): boolean {
  return Boolean(
    opts.search.trim() ||
      opts.objectiveId ||
      opts.status ||
      opts.openOnly ||
      opts.overdueOnly ||
      opts.overspendingOnly ||
      opts.atRiskOnly ||
      opts.sort !== "due_date",
  );
}

function burnPreview(budget: number, spent: number, progress: number): string {
  if (budget <= 0) return "";
  const budgetPct = ((spent / budget) * 100).toFixed(0);
  return `${budgetPct}% of budget against ${progress}% delivered`;
}

const STATUSES: InitiativeStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "on_hold",
  "cancelled",
];

const STATUS_TONE: Record<InitiativeStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  on_hold: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cancelled: "bg-muted text-muted-foreground",
};

const emptyForm = {
  objective_id: "",
  code: "",
  name: "",
  description: "",
  owner_name: "",
  starts_on: "",
  ends_on: "",
  budget: "0",
  spent: "0",
  progress_percent: "0",
  status: "not_started" as InitiativeStatus,
};

export default function StrategyInitiativesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canManage = hasAnyPermission(["manage_strategy_initiatives", "manage_strategy"]);

  const [planId, setPlanId] = React.useState(searchParams.get("plan_id") ?? "");
  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [status, setStatus] = React.useState(searchParams.get("status") ?? "");
  const [objectiveFilter, setObjectiveFilter] = React.useState(searchParams.get("objective_id") ?? "");
  const [openOnly, setOpenOnly] = React.useState(searchParams.get("open_only") === "1");
  const [overdueOnly, setOverdueOnly] = React.useState(searchParams.get("overdue") === "1");
  const [overspendingOnly, setOverspendingOnly] = React.useState(searchParams.get("overspending") === "1");
  const [atRiskOnly, setAtRiskOnly] = React.useState(searchParams.get("at_risk") === "1");
  const [sort, setSort] = React.useState<InitiativeSort>(
    searchParams.get("worst_burn") === "1"
      ? "worst_burn"
      : searchParams.get("overdue_first") === "1"
        ? "overdue_first"
        : "due_date",
  );
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));
  const [focusInitiativeId, setFocusInitiativeId] = React.useState(
    searchParams.get("initiative_id") ?? "",
  );

  const shouldOpenAdd = searchParams.get("add") === "1";
  const shouldOpenEdit = searchParams.get("edit") === "1";
  const shouldOpenUpdate = searchParams.get("update") === "1";

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingInitiative, setEditingInitiative] = React.useState<StrategyInitiative | null>(null);
  const [progressInitiative, setProgressInitiative] = React.useState<StrategyInitiative | null>(null);
  const [detailInitiative, setDetailInitiative] = React.useState<StrategyInitiative | null>(null);

  const [form, setForm] = React.useState({
    ...emptyForm,
    objective_id: searchParams.get("objective_id") ?? "",
  });

  const [progressForm, setProgressForm] = React.useState({
    progress_percent: "0",
    spent: "0",
    status: "in_progress" as InitiativeStatus,
  });

  const rowRefs = React.useRef<Record<number, HTMLTableRowElement | null>>({});
  const deepLinkHandled = React.useRef(false);

  const overviewQuery = useQuery({
    queryKey: ["strategy", "overview-initiatives", planId],
    queryFn: () =>
      strategyApi
        .overview(planId ? { plan_id: Number(planId) } : undefined)
        .then((res) => res.data),
  });

  const overview: StrategyOverview | undefined = overviewQuery.data?.data;
  const activePlanId = planId ? Number(planId) : overview?.plan?.id;

  const initiativesQuery = useQuery({
    queryKey: [
      "strategy",
      "initiatives",
      debouncedSearch,
      status,
      openOnly,
      objectiveFilter,
      activePlanId,
      page,
    ],
    queryFn: () =>
      strategyApi
        .listInitiatives({
          page,
          limit: 50,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(status ? { status } : {}),
          ...(openOnly ? { open_only: 1 } : {}),
          ...(objectiveFilter ? { objective_id: Number(objectiveFilter) } : {}),
          ...(activePlanId ? { plan_id: activePlanId } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const objectivesQuery = useQuery({
    queryKey: ["strategy", "objective-options", activePlanId],
    queryFn: () =>
      strategyApi
        .listObjectives({
          limit: 200,
          ...(activePlanId ? { plan_id: activePlanId } : {}),
        })
        .then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["strategy"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (planId) params.set("plan_id", planId);
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (objectiveFilter) params.set("objective_id", objectiveFilter);
    if (status) params.set("status", status);
    if (openOnly) params.set("open_only", "1");
    if (overdueOnly) params.set("overdue", "1");
    if (overspendingOnly) params.set("overspending", "1");
    if (atRiskOnly) params.set("at_risk", "1");
    if (sort === "worst_burn") params.set("worst_burn", "1");
    if (sort === "overdue_first") params.set("overdue_first", "1");
    if (focusInitiativeId) params.set("initiative_id", focusInitiativeId);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    atRiskOnly,
    focusInitiativeId,
    objectiveFilter,
    openOnly,
    overdueOnly,
    overspendingOnly,
    page,
    pathname,
    planId,
    router,
    searchInput,
    sort,
    status,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, openOnly, objectiveFilter, activePlanId]);

  const saveInitiative = useMutation({
    mutationFn: () => {
      const payload = {
        plan_id: activePlanId,
        ...(form.objective_id ? { objective_id: Number(form.objective_id) } : { objective_id: null }),
        code: form.code,
        name: form.name,
        description: form.description || null,
        owner_name: form.owner_name || null,
        ...(form.starts_on ? { starts_on: form.starts_on } : {}),
        ...(form.ends_on ? { ends_on: form.ends_on } : {}),
        budget: Number(form.budget || 0),
        spent: Number(form.spent || 0),
        progress_percent: Number(form.progress_percent || 0),
        status: form.status,
      };
      return editingInitiative
        ? strategyApi.updateInitiative(editingInitiative.id, payload)
        : strategyApi.createInitiative(payload);
    },
    onSuccess: () => {
      toast.success(
        t(
          editingInitiative ? "strategy.initiatives.updated" : "strategy.initiatives.saved",
          editingInitiative ? "Initiative updated." : "Initiative added.",
        ),
      );
      invalidate();
      setFormOpen(false);
      setEditingInitiative(null);
      setForm({ ...emptyForm, objective_id: objectiveFilter });
    },
    onError: (error: any) =>
      toast.error(
        errorText(
          error,
          t(
            editingInitiative ? "strategy.initiatives.update_failed" : "strategy.initiatives.save_failed",
            "Could not save it.",
          ),
        ),
      ),
  });

  const updateProgress = useMutation({
    mutationFn: () =>
      strategyApi.updateInitiative(progressInitiative!.id, {
        progress_percent: Number(progressForm.progress_percent || 0),
        spent: Number(progressForm.spent || 0),
        status: progressForm.status,
      }),
    onSuccess: () => {
      toast.success(t("strategy.initiatives.updated", "Initiative updated."));
      invalidate();
      setProgressInitiative(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.initiatives.update_failed", "Could not update it."))),
  });

  const initiatives = (initiativesQuery.data?.data ?? []) as StrategyInitiative[];
  const meta = initiativesQuery.data?.meta;
  const objectives = (objectivesQuery.data?.data ?? []) as StrategyObjective[];
  const summary = overview?.initiatives;
  const refetching = initiativesQuery.isFetching && !initiativesQuery.isLoading;

  const visibleInitiatives = React.useMemo(
    () =>
      filterAndSortInitiatives(initiatives, {
        overdueOnly,
        overspendingOnly,
        atRiskOnly,
        sort,
      }),
    [atRiskOnly, initiatives, overdueOnly, overspendingOnly, sort],
  );

  const filtersActive = hasActiveInitiativeFilters({
    search: searchInput,
    objectiveId: objectiveFilter,
    status,
    openOnly,
    overdueOnly,
    overspendingOnly,
    atRiskOnly,
    sort,
  });

  const objectiveById = React.useMemo(() => {
    const map = new Map<number, StrategyObjective>();
    for (const row of objectives) map.set(row.id, row);
    return map;
  }, [objectives]);

  const initiativeHref = React.useCallback(
    (extra: Record<string, string | number | boolean | undefined> = {}) => {
      const params = new URLSearchParams();
      if (activePlanId) params.set("plan_id", String(activePlanId));
      for (const [key, value] of Object.entries(extra)) {
        if (value === undefined || value === false || value === "") continue;
        params.set(key, value === true ? "1" : String(value));
      }
      const qs = params.toString();
      return qs ? `/dashboard/strategy/initiatives?${qs}` : "/dashboard/strategy/initiatives";
    },
    [activePlanId],
  );

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

  const planQueryString = activePlanId ? `?plan_id=${activePlanId}` : "";

  const openEdit = React.useCallback((row: StrategyInitiative) => {
    setEditingInitiative(row);
    setForm({
      objective_id: row.objective_id ? String(row.objective_id) : "",
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      owner_name: row.owner_name ?? "",
      starts_on: row.starts_on ? String(row.starts_on).slice(0, 10) : "",
      ends_on: row.ends_on ? String(row.ends_on).slice(0, 10) : "",
      budget: String(n(row.budget)),
      spent: String(n(row.spent)),
      progress_percent: String(row.progress_percent),
      status: row.status,
    });
    setFormOpen(true);
  }, []);

  const openProgress = React.useCallback((row: StrategyInitiative) => {
    setProgressInitiative(row);
    setProgressForm({
      progress_percent: String(row.progress_percent),
      spent: String(n(row.spent)),
      status: row.status,
    });
  }, []);

  const clearFilters = () => {
    setSearchInput("");
    setStatus("");
    setObjectiveFilter("");
    setOpenOnly(false);
    setOverdueOnly(false);
    setOverspendingOnly(false);
    setAtRiskOnly(false);
    setSort("due_date");
    setFocusInitiativeId("");
  };

  React.useEffect(() => {
    if (shouldOpenAdd && (objectiveFilter || searchParams.get("objective_id"))) {
      setForm((current) => ({
        ...current,
        objective_id: objectiveFilter || searchParams.get("objective_id") || "",
      }));
      setFormOpen(true);
    }
  }, [objectiveFilter, shouldOpenAdd, searchParams]);

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [focusInitiativeId, shouldOpenEdit, shouldOpenUpdate]);

  React.useEffect(() => {
    if (!focusInitiativeId || initiatives.length === 0 || deepLinkHandled.current) return;
    const row = initiatives.find((item) => String(item.id) === focusInitiativeId);
    if (!row) return;

    deepLinkHandled.current = true;
    const el = rowRefs.current[row.id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

    if (shouldOpenEdit && canManage) {
      openEdit(row);
    } else if (shouldOpenUpdate && canManage) {
      openProgress(row);
    } else {
      setDetailInitiative(row);
    }
  }, [
    focusInitiativeId,
    initiatives,
    shouldOpenEdit,
    shouldOpenUpdate,
    canManage,
    openEdit,
    openProgress,
  ]);

  const progressBurnPreview =
    progressInitiative && n(progressInitiative.budget) > 0
      ? burnPreview(
          n(progressInitiative.budget),
          Number(progressForm.spent || 0),
          Number(progressForm.progress_percent || 0),
        )
      : "";

  const progressOverspending =
    progressInitiative &&
    n(progressInitiative.budget) > 0 &&
    Number(progressForm.progress_percent || 0) + 15 <
      (Number(progressForm.spent || 0) / n(progressInitiative.budget)) * 100;

  return (
    <div className="space-y-6 print:space-y-4">
      <Breadcrumbs
        items={[
          { label: t("strategy.overview.title", "Strategy"), href: "/dashboard/strategy" },
          { label: t("strategy.initiatives.title", "Initiatives") },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("strategy.initiatives.title", "Initiatives")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "strategy.initiatives.subtitle",
              "The work meant to move the objectives. Progress and spend are compared, not read separately — 30% delivered on 80% of the budget is the thing worth catching.",
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
              <Link href="/dashboard/strategy/reviews">Plans & Reviews</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              initiativesQuery.refetch();
              overviewQuery.refetch();
              objectivesQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            {t("strategy.common.refresh", "Refresh")}
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            {t("strategy.common.print", "Print")}
          </Button>
          {canManage ? (
            <Button
              className="rounded-full px-5"
              disabled={!activePlanId}
              onClick={() => {
                setEditingInitiative(null);
                setForm({ ...emptyForm, objective_id: objectiveFilter });
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("strategy.initiatives.add", "Add Initiative")}
            </Button>
          ) : null}
        </div>
      </div>

      {!activePlanId && !overviewQuery.isLoading ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm print:hidden">
          {t("strategy.initiatives.no_plan", "Set up a strategy plan before adding initiatives.")}{" "}
          <Link href="/dashboard/strategy/reviews?add_plan=1" className="font-semibold underline">
            {t("strategy.reviews.title", "Plans & Reviews")}
          </Link>
        </div>
      ) : null}

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
                {overview.plans.map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.code} — {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
          <Link href={initiativeHref()} className="block">
            <StatTile
              label={t("strategy.overview.delivery", "Delivery")}
              value={`${n(summary.weighted_progress_percent).toFixed(0)}%`}
              meta={t("strategy.initiatives.weighted_meta", "weighted by budget")}
            />
          </Link>
          <Link href={initiativeHref({ open_only: 1 })} className="block">
            <StatTile
              label={t("strategy.initiatives.open", "Open")}
              value={n(summary.open).toLocaleString()}
              meta={t("strategy.initiatives.completed_meta", "{n} completed").replace(
                "{n}",
                String(n(summary.completed)),
              )}
            />
          </Link>
          <Link href={initiativeHref({ overdue: 1, open_only: 1 })} className="block">
            <StatTile
              label={t("strategy.initiatives.overdue", "Late")}
              value={n(summary.overdue).toLocaleString()}
              alert={n(summary.overdue) > 0}
            />
          </Link>
          <Link href={initiativeHref({ overspending: 1, open_only: 1 })} className="block">
            <StatTile
              label={t("strategy.overview.overspending", "Overspending")}
              value={n(summary.overspending).toLocaleString()}
              meta={t("strategy.initiatives.spend_meta", "{spent} of {budget}")
                .replace("{spent}", money(summary.spent))
                .replace("{budget}", money(summary.budget))}
              alert={n(summary.overspending) > 0}
            />
          </Link>
        </div>
      ) : null}

      {focusInitiativeId ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm print:hidden">
          <span>
            {t("strategy.initiatives.focused", "Focused on initiative")}{" "}
            <strong>
              {initiatives.find((row) => String(row.id) === focusInitiativeId)?.name ??
                `#${focusInitiativeId}`}
            </strong>
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setFocusInitiativeId("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("strategy.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      {objectiveFilter ? (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-sm print:hidden">
          <span>
            {t("strategy.initiatives.filtered_objective", "Filtered to objective")}{" "}
            <strong>
              {objectiveById.get(Number(objectiveFilter))?.title ?? `#${objectiveFilter}`}
            </strong>
          </span>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="ghost" className="h-7">
              <Link href={scorecardHref({ objective_id: objectiveFilter })}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                {t("strategy.scorecard.title", "Scorecard")}
              </Link>
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setObjectiveFilter("")}>
              <X className="mr-1 h-3.5 w-3.5" />
              {t("strategy.common.clear", "Clear")}
            </Button>
          </div>
        </div>
      ) : null}

      {filtersActive && initiatives.length > 0 && visibleInitiatives.length === 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm print:hidden">
          <span>
            {t("strategy.initiatives.no_match", "No initiatives match those filters on this page.")}
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={clearFilters}>
            {t("strategy.common.clear_filters", "Clear filters")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="i-search" className="text-xs">
            {t("strategy.common.search", "Search")}
          </Label>
          <Input
            id="i-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("strategy.initiatives.search_hint", "Code, name, or owner")}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("strategy.kpis.objective", "Objective")}</Label>
          <Select
            value={objectiveFilter || "any"}
            onValueChange={(v) => setObjectiveFilter(v === "any" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("strategy.common.any", "Any")}</SelectItem>
              {objectives.map((objective) => (
                <SelectItem key={objective.id} value={String(objective.id)}>
                  {objective.code} — {objective.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("strategy.common.status", "Status")}</Label>
          <Select value={status || "any"} onValueChange={(v) => setStatus(v === "any" ? "" : v)}>
            <SelectTrigger className="h-9 w-44 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("strategy.common.any", "Any")}</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("strategy.common.sort", "Sort")}</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as InitiativeSort)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">{t("strategy.initiatives.sort_due", "Due date")}</SelectItem>
              <SelectItem value="overdue_first">
                {t("strategy.initiatives.sort_overdue", "Late first")}
              </SelectItem>
              <SelectItem value="worst_burn">
                {t("strategy.initiatives.sort_burn", "Worst burn gap")}
              </SelectItem>
              <SelectItem value="code">{t("strategy.kpis.sort_code", "Code")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
            className="h-4 w-4"
          />
          {t("strategy.initiatives.open_only", "Open only")}
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={atRiskOnly}
            onChange={(event) => setAtRiskOnly(event.target.checked)}
            className="h-4 w-4"
          />
          {t("strategy.initiatives.at_risk", "at risk")}
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(event) => setOverdueOnly(event.target.checked)}
            className="h-4 w-4"
          />
          {t("strategy.overview.late", "late")}
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={overspendingOnly}
            onChange={(event) => setOverspendingOnly(event.target.checked)}
            className="h-4 w-4"
          />
          {t("strategy.overview.overspending", "overspending")}
        </label>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            {t("strategy.common.clear_filters", "Clear filters")}
          </Button>
        ) : null}
      </div>

      {(overdueOnly || overspendingOnly || atRiskOnly) ? (
        <p className="text-xs text-muted-foreground print:hidden">
          {t(
            "strategy.initiatives.risk_page_note",
            "Late and overspending filters run on the current API page — use Open only and sort to surface at-risk work.",
          )}
        </p>
      ) : null}

      <Panel
        title={t("strategy.initiatives.list", "Initiatives")}
        description={t(
          "strategy.initiatives.list_desc",
          "Burn is only judged while the work is open — a finished initiative is judged on its final cost, not its rate of spend.",
        )}
      >
        {initiativesQuery.isLoading ? (
          <LoadingPanel label={t("strategy.common.loading", "Loading initiatives...")} />
        ) : initiativesQuery.isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("strategy.initiatives.load_failed", "Could not load initiatives.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => initiativesQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("strategy.common.retry", "Retry")}
            </Button>
          </div>
        ) : visibleInitiatives.length === 0 ? (
          <EmptyPanel label={t("strategy.initiatives.none", "No initiatives match those filters.")} />
        ) : (
          <div className={`space-y-3 transition-opacity ${refetching ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[72rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-semibold">
                      {t("strategy.initiatives.initiative", "Initiative")}
                    </th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.kpis.objective", "Objective")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.common.status", "Status")}</th>
                    <th className="pb-2 pr-3 font-semibold">
                      {t("strategy.initiatives.progress", "Progress")}
                    </th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.initiatives.budget", "Budget")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.initiatives.burn_gap", "Burn gap")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.initiatives.due", "Due")}</th>
                    <th className="pb-2 pr-6 text-right font-semibold">
                      {t("strategy.common.actions", "Actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInitiatives.map((row) => {
                    const focused = focusInitiativeId === String(row.id);
                    const objective = row.objective ?? objectiveById.get(row.objective_id ?? 0);
                    const gap = burnGap(row);
                    const risky = isAtRisk(row);
                    return (
                      <tr
                        key={row.id}
                        ref={(el) => {
                          rowRefs.current[row.id] = el;
                        }}
                        className={`border-b border-border/40 last:border-0 ${
                          focused ? "bg-primary/5" : risky ? "bg-destructive/5" : ""
                        }`}
                      >
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => {
                              setFocusInitiativeId(String(row.id));
                              setDetailInitiative(row);
                            }}
                          >
                            <span className="block font-medium">{row.name}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {row.code}
                              {row.owner_name ? ` · ${row.owner_name}` : ""}
                              {risky ? (
                                <span className="ml-1.5 font-semibold text-destructive">
                                  {[
                                    row.is_overdue ? t("strategy.overview.late", "late") : null,
                                    row.is_overspending
                                      ? t("strategy.overview.overspending", "overspending")
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {objective ? (
                            <Link
                              href={scorecardHref({ objective_id: objective.id })}
                              className="hover:underline"
                            >
                              {objective.title}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            variant="outline"
                            className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.status]}`}
                          >
                            {row.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums">
                          {row.progress_percent}%
                          <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-indigo-500"
                              style={{ width: `${Math.max(0, Math.min(100, row.progress_percent))}%` }}
                            />
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums">
                          {money(row.spent)} / {money(row.budget)}
                          {row.budget_used_percent !== null && row.budget_used_percent !== undefined ? (
                            <span
                              className={`block text-[11px] ${
                                row.is_overspending
                                  ? "font-semibold text-destructive"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {t("strategy.initiatives.used", "{n}% used").replace(
                                "{n}",
                                row.budget_used_percent.toFixed(0),
                              )}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums">
                          {row.budget_used_percent === null || row.budget_used_percent === undefined ? (
                            "—"
                          ) : (
                            <span className={gap > 15 ? "font-semibold text-destructive" : ""}>
                              {gap > 0 ? "+" : ""}
                              {gap.toFixed(0)}%
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums">
                          {row.ends_on ? String(row.ends_on).slice(0, 10) : "—"}
                          {row.is_overdue ? (
                            <span className="block text-[11px] font-semibold text-destructive">
                              {t("strategy.overview.late", "late")}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-6 text-right">
                          <div className="flex justify-end gap-1">
                            {canManage ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => openEdit(row)}
                                >
                                  <Pencil className="mr-1 h-3 w-3" />
                                  {t("strategy.common.edit", "Edit")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px]"
                                  onClick={() => openProgress(row)}
                                >
                                  <TrendingUp className="mr-1 h-3 w-3" />
                                  {t("strategy.initiatives.update", "Update")}
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {meta && meta.last_page > 1 ? (
              <div className="flex items-center justify-between border-t border-border/40 pt-3 text-sm">
                <span className="text-muted-foreground">
                  {t("strategy.common.page_of", "Page {current} of {last} · {total} total")
                    .replace("{current}", String(meta.current_page))
                    .replace("{last}", String(meta.last_page))
                    .replace("{total}", String(meta.total))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.current_page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.current_page >= meta.last_page}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Panel>

      {/* Detail */}
      <Dialog open={detailInitiative !== null} onOpenChange={(open) => !open && setDetailInitiative(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detailInitiative?.name}
              </DialogTitle>
              <DialogDescription>
                {detailInitiative?.code}
                {detailInitiative?.owner_name ? ` · ${detailInitiative.owner_name}` : ""}
              </DialogDescription>
            </DialogHeader>
          </div>
          {detailInitiative ? (
            <div className="space-y-4 px-6 py-5 text-sm">
              {detailInitiative.description ? (
                <p className="text-muted-foreground">{detailInitiative.description}</p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    {t("strategy.initiatives.progress", "Progress")}
                  </p>
                  <p className="font-bold tabular-nums">{detailInitiative.progress_percent}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    {t("strategy.initiatives.budget", "Budget")}
                  </p>
                  <p className="font-medium tabular-nums">
                    {money(detailInitiative.spent)} / {money(detailInitiative.budget)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    {t("strategy.initiatives.due", "Due")}
                  </p>
                  <p className="font-medium">
                    {detailInitiative.ends_on ? String(detailInitiative.ends_on).slice(0, 10) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    {t("strategy.initiatives.burn_gap", "Burn gap")}
                  </p>
                  <p
                    className={`font-bold tabular-nums ${
                      burnGap(detailInitiative) > 15 ? "text-destructive" : ""
                    }`}
                  >
                    {detailInitiative.budget_used_percent === null ||
                    detailInitiative.budget_used_percent === undefined
                      ? "—"
                      : `${burnGap(detailInitiative) > 0 ? "+" : ""}${burnGap(detailInitiative).toFixed(0)}%`}
                  </p>
                </div>
              </div>
              {detailInitiative.objective_id ? (
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link href={scorecardHref({ objective_id: detailInitiative.objective_id })}>
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    {t("strategy.initiatives.view_on_scorecard", "View on scorecard")}
                  </Link>
                </Button>
              ) : null}
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const row = detailInitiative;
                      setDetailInitiative(null);
                      openEdit(row);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {t("strategy.common.edit", "Edit")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const row = detailInitiative;
                      setDetailInitiative(null);
                      openProgress(row);
                    }}
                  >
                    <TrendingUp className="mr-2 h-3.5 w-3.5" />
                    {t("strategy.initiatives.update", "Update")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Create / full edit */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingInitiative(null);
            setForm({ ...emptyForm, objective_id: objectiveFilter });
          }
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingInitiative
                  ? t("strategy.initiatives.edit", "Edit Initiative")
                  : t("strategy.initiatives.add", "Add Initiative")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "strategy.initiatives.add_desc",
                  "Attaching it to an objective is what turns that objective from an aspiration into a plan.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("strategy.kpis.objective", "Objective")}</Label>
              <Select
                value={form.objective_id || "none"}
                onValueChange={(v) => setForm({ ...form, objective_id: v === "none" ? "" : v })}
              >
                <SelectTrigger onPointerDownCapture={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("strategy.initiatives.no_objective", "Not tied to one objective")}
                  </SelectItem>
                  {objectives.map((objective) => (
                    <SelectItem key={objective.id} value={String(objective.id)}>
                      {objective.code} — {objective.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-code">{t("strategy.common.code", "Code")}</Label>
              <Input
                id="ni-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-owner">{t("strategy.common.owner", "Owner")}</Label>
              <Input
                id="ni-owner"
                value={form.owner_name}
                onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ni-name">{t("strategy.common.name", "Name")}</Label>
              <Input
                id="ni-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ni-desc">{t("strategy.common.description", "Description")}</Label>
              <Textarea
                id="ni-desc"
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-start">{t("strategy.initiatives.starts", "Starts")}</Label>
              <Input
                id="ni-start"
                type="date"
                value={form.starts_on}
                onChange={(event) => setForm({ ...form, starts_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-end">{t("strategy.initiatives.ends", "Ends")}</Label>
              <Input
                id="ni-end"
                type="date"
                min={form.starts_on}
                value={form.ends_on}
                onChange={(event) => setForm({ ...form, ends_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-budget">{t("strategy.initiatives.budget", "Budget")}</Label>
              <Input
                id="ni-budget"
                type="number"
                min={0}
                value={form.budget}
                onChange={(event) => setForm({ ...form, budget: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-spent">{t("strategy.initiatives.spent", "Spent")}</Label>
              <Input
                id="ni-spent"
                type="number"
                min={0}
                value={form.spent}
                onChange={(event) => setForm({ ...form, spent: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-progress">{t("strategy.initiatives.progress", "Progress %")}</Label>
              <Input
                id="ni-progress"
                type="number"
                min={0}
                max={100}
                value={form.progress_percent}
                onChange={(event) => setForm({ ...form, progress_percent: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("strategy.common.status", "Status")}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as InitiativeStatus })}
              >
                <SelectTrigger className="capitalize" onPointerDownCapture={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value} className="capitalize">
                      {value.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveInitiative.mutate()}
              disabled={
                saveInitiative.isPending ||
                !form.code.trim() ||
                !form.name.trim() ||
                !activePlanId
              }
            >
              {saveInitiative.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick progress update */}
      <Dialog
        open={progressInitiative !== null}
        onOpenChange={(open) => !open && setProgressInitiative(null)}
      >
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.initiatives.update", "Update")}
              </DialogTitle>
              <DialogDescription>
                {progressInitiative
                  ? t(
                      "strategy.initiatives.update_desc",
                      "{name} — progress is reported, spend is recorded, and the gap between them is what the dashboard watches.",
                    ).replace("{name}", progressInitiative.name)
                  : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="u-progress">{t("strategy.initiatives.progress", "Progress %")}</Label>
              <Input
                id="u-progress"
                type="number"
                min={0}
                max={100}
                value={progressForm.progress_percent}
                onChange={(event) =>
                  setProgressForm({ ...progressForm, progress_percent: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-spent">{t("strategy.initiatives.spent", "Spent")}</Label>
              <Input
                id="u-spent"
                type="number"
                min={0}
                value={progressForm.spent}
                onChange={(event) => setProgressForm({ ...progressForm, spent: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("strategy.common.status", "Status")}</Label>
              <Select
                value={progressForm.status}
                onValueChange={(v) =>
                  setProgressForm({ ...progressForm, status: v as InitiativeStatus })
                }
              >
                <SelectTrigger className="capitalize" onPointerDownCapture={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value} className="capitalize">
                      {value.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {progressBurnPreview ? (
              <p
                className={`text-xs ${
                  progressOverspending ? "font-semibold text-destructive" : "text-muted-foreground"
                }`}
              >
                {progressBurnPreview}
                {progressOverspending
                  ? ` · ${t("strategy.overview.overspending", "overspending")}`
                  : ""}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setProgressInitiative(null)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => updateProgress.mutate()} disabled={updateProgress.isPending}>
              {updateProgress.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
