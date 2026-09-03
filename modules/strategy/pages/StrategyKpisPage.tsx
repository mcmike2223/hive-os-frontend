"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
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
import { usePermissions } from "@/hooks/use-permissions";
import { strategyApi } from "@/modules/strategy/api";
import type {
  KpiDirection,
  KpiFrequency,
  ScoreBand,
  StrategyKpi,
  StrategyKpiReading,
  StrategyObjective,
  StrategyOverview,
} from "@/modules/strategy/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { n, useDebouncedValue } from "@/modules/strategy/utils";

const SCORE_BANDS: ScoreBand[] = ["on_track", "at_risk", "off_track", "unmeasured"];

type KpiSort = "code" | "worst_achievement" | "stale_first";

/** Raw achievement — can exceed 100 or go negative. */
function previewAchievement(
  baseline: number,
  target: number,
  actual: number,
  direction: KpiDirection,
): number {
  if (Math.abs(target - baseline) < 1e-7) {
    const met = direction === "lower_is_better" ? actual <= target : actual >= target;
    return met ? 100 : 0;
  }
  return ((actual - baseline) / (target - baseline)) * 100;
}

/** Clamped roll-up score used in the scorecard. */
function previewScore(achievement: number): number {
  return Math.max(0, Math.min(100, achievement));
}

function filterAndSortKpis(
  kpis: StrategyKpi[],
  opts: {
    band: string;
    unmeasuredOnly: boolean;
    sort: KpiSort;
  },
): StrategyKpi[] {
  let rows = [...kpis];

  if (opts.unmeasuredOnly) {
    rows = rows.filter((row) => row.latest_value === null || row.latest_value === undefined);
  }

  if (opts.band) {
    rows = rows.filter((row) => (row.status ?? "unmeasured") === opts.band);
  }

  if (opts.sort === "worst_achievement") {
    rows.sort((a, b) => {
      const aScore = a.score ?? a.achievement_percent;
      const bScore = b.score ?? b.achievement_percent;
      if (aScore === null && bScore === null) return a.code.localeCompare(b.code);
      if (aScore === null || aScore === undefined) return 1;
      if (bScore === null || bScore === undefined) return -1;
      return aScore - bScore;
    });
  } else if (opts.sort === "stale_first") {
    rows.sort((a, b) => {
      const aStale = a.is_stale ? 1 : 0;
      const bStale = b.is_stale ? 1 : 0;
      if (bStale !== aStale) return bStale - aStale;
      return a.code.localeCompare(b.code);
    });
  } else {
    rows.sort((a, b) => a.code.localeCompare(b.code));
  }

  return rows;
}

function hasActiveKpiFilters(opts: {
  search: string;
  objectiveId: string;
  direction: string;
  frequency: string;
  band: string;
  staleOnly: boolean;
  unmeasuredOnly: boolean;
  showInactive: boolean;
  sort: KpiSort;
}): boolean {
  return Boolean(
    opts.search.trim() ||
      opts.objectiveId ||
      opts.direction ||
      opts.frequency ||
      opts.band ||
      opts.staleOnly ||
      opts.unmeasuredOnly ||
      opts.showInactive ||
      opts.sort !== "code",
  );
}

/** Months until a reading is considered stale for its frequency. */
function staleAfterMonths(frequency: string): number {
  const map: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    annual: 12,
  };
  return map[frequency] ?? 3;
}

const DIRECTIONS: KpiDirection[] = ["higher_is_better", "lower_is_better"];
const FREQUENCIES: KpiFrequency[] = ["monthly", "quarterly", "semiannual", "annual"];

const BAND_TONE: Record<ScoreBand, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  off_track: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  unmeasured: "bg-muted text-muted-foreground",
};

const emptyKpiForm = {
  objective_id: "",
  code: "",
  name: "",
  unit: "",
  direction: "higher_is_better",
  baseline_value: "0",
  target_value: "100",
  weight: "1",
  frequency: "quarterly",
  data_source: "",
  owner_name: "",
  is_active: true,
};

export default function StrategyKpisPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canManageKpis = hasAnyPermission(["manage_strategy_kpis", "manage_strategy"]);
  const canRecord = hasAnyPermission([
    "record_strategy_readings",
    "manage_strategy_kpis",
    "manage_strategy",
  ]);

  const [planId, setPlanId] = React.useState(searchParams.get("plan_id") ?? "");
  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [direction, setDirection] = React.useState(searchParams.get("direction") ?? "");
  const [frequency, setFrequency] = React.useState(searchParams.get("frequency") ?? "");
  const [bandFilter, setBandFilter] = React.useState(searchParams.get("band") ?? "");
  const [objectiveFilter, setObjectiveFilter] = React.useState(searchParams.get("objective_id") ?? "");
  const [staleOnly, setStaleOnly] = React.useState(searchParams.get("stale") === "1");
  const [unmeasuredOnly, setUnmeasuredOnly] = React.useState(searchParams.get("unmeasured") === "1");
  const [showInactive, setShowInactive] = React.useState(searchParams.get("show_inactive") === "1");
  const [sort, setSort] = React.useState<KpiSort>(
    searchParams.get("stale_first") === "1"
      ? "stale_first"
      : searchParams.get("worst_first") === "1"
        ? "worst_achievement"
        : "code",
  );
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));
  const [focusKpiId, setFocusKpiId] = React.useState(searchParams.get("kpi_id") ?? "");

  const shouldOpenAdd = searchParams.get("add") === "1";
  const shouldOpenEdit = searchParams.get("edit") === "1";
  const shouldOpenRecord = searchParams.get("record") === "1";
  const shouldOpenHistory = searchParams.get("history") === "1";

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const [kpiOpen, setKpiOpen] = React.useState(false);
  const [editingKpi, setEditingKpi] = React.useState<StrategyKpi | null>(null);
  const [recording, setRecording] = React.useState<StrategyKpi | null>(null);
  const [historyKpi, setHistoryKpi] = React.useState<StrategyKpi | null>(null);
  const [detailKpi, setDetailKpi] = React.useState<StrategyKpi | null>(null);

  const [form, setForm] = React.useState({
    ...emptyKpiForm,
    objective_id: searchParams.get("objective_id") ?? "",
  });

  const [readingForm, setReadingForm] = React.useState({
    period_label: "",
    period_start: "",
    period_end: "",
    actual_value: "",
    note: "",
    recorded_by_name: "",
  });

  const rowRefs = React.useRef<Record<number, HTMLTableRowElement | null>>({});
  const deepLinkHandled = React.useRef(false);

  const overviewQuery = useQuery({
    queryKey: ["strategy", "overview-kpis", planId],
    queryFn: () =>
      strategyApi
        .overview(planId ? { plan_id: Number(planId) } : undefined)
        .then((res) => res.data),
  });

  const overview: StrategyOverview | undefined = overviewQuery.data?.data;
  const activePlanId = planId ? Number(planId) : overview?.plan?.id;

  const kpisQuery = useQuery({
    queryKey: [
      "strategy",
      "kpis",
      debouncedSearch,
      direction,
      frequency,
      objectiveFilter,
      staleOnly,
      showInactive,
      activePlanId,
      page,
    ],
    queryFn: () =>
      strategyApi
        .listKpis({
          page,
          limit: staleOnly ? 100 : 50,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(direction ? { direction } : {}),
          ...(frequency ? { frequency } : {}),
          ...(objectiveFilter ? { objective_id: Number(objectiveFilter) } : {}),
          ...(activePlanId ? { plan_id: activePlanId } : {}),
          ...(staleOnly ? { stale_only: 1 } : {}),
          ...(!showInactive ? { active_only: 1 } : {}),
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

  const readingsQuery = useQuery({
    queryKey: ["strategy", "kpi-readings", historyKpi?.id ?? detailKpi?.id ?? recording?.id],
    queryFn: () =>
      strategyApi
        .listReadings((historyKpi ?? detailKpi ?? recording)!.id, { limit: 50 })
        .then((res) => res.data),
    enabled: historyKpi !== null || detailKpi !== null || recording !== null,
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
    if (direction) params.set("direction", direction);
    if (frequency) params.set("frequency", frequency);
    if (bandFilter) params.set("band", bandFilter);
    if (staleOnly) params.set("stale", "1");
    if (unmeasuredOnly) params.set("unmeasured", "1");
    if (showInactive) params.set("show_inactive", "1");
    if (sort === "worst_achievement") params.set("worst_first", "1");
    if (sort === "stale_first") params.set("stale_first", "1");
    if (focusKpiId) params.set("kpi_id", focusKpiId);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    bandFilter,
    direction,
    focusKpiId,
    frequency,
    objectiveFilter,
    page,
    pathname,
    planId,
    router,
    searchInput,
    showInactive,
    sort,
    staleOnly,
    unmeasuredOnly,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, direction, frequency, objectiveFilter, staleOnly, showInactive, activePlanId]);

  const saveKpi = useMutation({
    mutationFn: () => {
      const payload = {
        objective_id: Number(form.objective_id),
        code: form.code,
        name: form.name,
        unit: form.unit || null,
        direction: form.direction,
        baseline_value: Number(form.baseline_value || 0),
        target_value: Number(form.target_value || 0),
        weight: Number(form.weight || 1),
        frequency: form.frequency,
        data_source: form.data_source || null,
        owner_name: form.owner_name || null,
        is_active: form.is_active,
      };
      return editingKpi
        ? strategyApi.updateKpi(editingKpi.id, payload)
        : strategyApi.createKpi(payload);
    },
    onSuccess: () => {
      toast.success(
        t(
          editingKpi ? "strategy.kpis.updated" : "strategy.kpis.saved",
          editingKpi ? "Measure updated." : "Measure added.",
        ),
      );
      invalidate();
      setKpiOpen(false);
      setEditingKpi(null);
      setForm({ ...emptyKpiForm, objective_id: objectiveFilter });
    },
    onError: (error: any) =>
      toast.error(
        errorText(
          error,
          t(
            editingKpi ? "strategy.kpis.update_failed" : "strategy.kpis.save_failed",
            "Could not save it.",
          ),
        ),
      ),
  });

  const recordReading = useMutation({
    mutationFn: () =>
      strategyApi.recordReading(recording!.id, {
        period_label: readingForm.period_label,
        period_start: readingForm.period_start,
        period_end: readingForm.period_end,
        actual_value: Number(readingForm.actual_value),
        note: readingForm.note || null,
        recorded_by_name: readingForm.recorded_by_name || null,
      }),
    onSuccess: (response: any) => {
      const kpi = response?.data?.data?.kpi;
      const score = kpi?.score;
      toast.success(
        score === null || score === undefined
          ? t("strategy.kpis.reading_saved", "Reading recorded.")
          : t("strategy.kpis.reading_saved_with", "Recorded — roll-up score now {n}.").replace(
              "{n}",
              Number(score).toFixed(1),
            ),
      );
      invalidate();
      setRecording(null);
      setReadingForm({
        period_label: "",
        period_start: "",
        period_end: "",
        actual_value: "",
        note: "",
        recorded_by_name: "",
      });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.kpis.reading_failed", "Could not record it."))),
  });

  const kpis = (kpisQuery.data?.data ?? []) as StrategyKpi[];
  const meta = kpisQuery.data?.meta;
  const objectives = (objectivesQuery.data?.data ?? []) as StrategyObjective[];
  const summary = overview?.kpis;
  const readings = (readingsQuery.data?.data ?? []) as StrategyKpiReading[];
  const refetching = kpisQuery.isFetching && !kpisQuery.isLoading;

  const visibleKpis = React.useMemo(
    () => filterAndSortKpis(kpis, { band: bandFilter, unmeasuredOnly, sort }),
    [bandFilter, kpis, sort, unmeasuredOnly],
  );

  const filtersActive = hasActiveKpiFilters({
    search: searchInput,
    objectiveId: objectiveFilter,
    direction,
    frequency,
    band: bandFilter,
    staleOnly,
    unmeasuredOnly,
    showInactive,
    sort,
  });

  const objectiveById = React.useMemo(() => {
    const map = new Map<number, StrategyObjective>();
    for (const row of objectives) map.set(row.id, row);
    return map;
  }, [objectives]);

  const openEdit = React.useCallback((kpi: StrategyKpi) => {
    setEditingKpi(kpi);
    setForm({
      objective_id: String(kpi.objective_id),
      code: kpi.code,
      name: kpi.name,
      unit: kpi.unit ?? "",
      direction: kpi.direction,
      baseline_value: String(n(kpi.baseline_value)),
      target_value: String(n(kpi.target_value)),
      weight: String(n(kpi.weight)),
      frequency: kpi.frequency,
      data_source: kpi.data_source ?? "",
      owner_name: kpi.owner_name ?? "",
      is_active: kpi.is_active !== false,
    });
    setKpiOpen(true);
  }, []);

  const openRecord = React.useCallback(
    (kpi: StrategyKpi, seed?: Partial<typeof readingForm>) => {
      setRecording(kpi);
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setReadingForm({
        period_label: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
        period_start: start.toISOString().slice(0, 10),
        period_end: today.toISOString().slice(0, 10),
        actual_value: "",
        note: "",
        recorded_by_name: "",
        ...seed,
      });
    },
    [],
  );

  const clearFilters = () => {
    setSearchInput("");
    setDirection("");
    setFrequency("");
    setBandFilter("");
    setObjectiveFilter("");
    setStaleOnly(false);
    setUnmeasuredOnly(false);
    setShowInactive(false);
    setSort("code");
    setFocusKpiId("");
  };

  React.useEffect(() => {
    if (shouldOpenAdd && (initialObjectiveId() || objectiveFilter)) {
      setForm((current) => ({
        ...current,
        objective_id: objectiveFilter || initialObjectiveId(),
      }));
      setKpiOpen(true);
    }
  }, [objectiveFilter, shouldOpenAdd]);

  function initialObjectiveId() {
    return searchParams.get("objective_id") ?? "";
  }

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [focusKpiId, shouldOpenEdit, shouldOpenRecord, shouldOpenHistory]);

  React.useEffect(() => {
    if (!focusKpiId || kpis.length === 0 || deepLinkHandled.current) return;
    const kpi = kpis.find((row) => String(row.id) === focusKpiId);
    if (!kpi) return;

    deepLinkHandled.current = true;
    const row = rowRefs.current[kpi.id];
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });

    if (shouldOpenEdit && canManageKpis) {
      openEdit(kpi);
    } else if (shouldOpenRecord && canRecord) {
      openRecord(kpi);
    } else if (shouldOpenHistory) {
      setHistoryKpi(kpi);
    } else {
      setDetailKpi(kpi);
    }
  }, [
    focusKpiId,
    kpis,
    shouldOpenEdit,
    shouldOpenRecord,
    shouldOpenHistory,
    canManageKpis,
    canRecord,
    openEdit,
    openRecord,
  ]);

  const rawPreview = recording
    ? previewAchievement(
        n(recording.baseline_value),
        n(recording.target_value),
        Number(readingForm.actual_value || 0),
        recording.direction,
      )
    : 0;

  const clampedPreview = previewScore(rawPreview);

  const existingPeriod =
    recording && readingForm.period_label.trim()
      ? readings.find((row) => row.period_label === readingForm.period_label.trim())
      : undefined;

  const baselineTargetWarning =
    form.direction === "lower_is_better" &&
    Number(form.baseline_value) < Number(form.target_value) &&
    form.baseline_value !== "" &&
    form.target_value !== "";

  const kpiHref = React.useCallback(
    (extra: Record<string, string | number | boolean | undefined> = {}) => {
      const params = new URLSearchParams();
      if (activePlanId) params.set("plan_id", String(activePlanId));
      for (const [key, value] of Object.entries(extra)) {
        if (value === undefined || value === false || value === "") continue;
        params.set(key, value === true ? "1" : String(value));
      }
      const qs = params.toString();
      return qs ? `/dashboard/strategy/kpis?${qs}` : "/dashboard/strategy/kpis";
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

  return (
    <div className="space-y-6 print:space-y-4">
      <Breadcrumbs
        items={[
          { label: t("strategy.overview.title", "Strategy"), href: "/dashboard/strategy" },
          { label: t("strategy.kpis.title", "KPIs") },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("strategy.kpis.title", "KPIs")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "strategy.kpis.subtitle",
              "Achievement is the distance travelled from the baseline toward the target, and every measure records whether higher or lower is the good direction.",
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href={`/dashboard/strategy${planQueryString}`}>Overview</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href={`/dashboard/strategy/scorecard${planQueryString}`}>Scorecard</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href="/dashboard/strategy/initiatives">Initiatives</Link>
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
              kpisQuery.refetch();
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
          {canManageKpis ? (
            <Button
              className="rounded-full px-5"
              disabled={objectives.length === 0}
              onClick={() => {
                setEditingKpi(null);
                setForm({ ...emptyKpiForm, objective_id: objectiveFilter });
                setKpiOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("strategy.kpis.add", "Add Measure")}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <Link href={kpiHref()} className="block">
            <StatTile
              label={t("strategy.kpis.total", "Measures")}
              value={n(summary.total).toLocaleString()}
            />
          </Link>
          <Link href={kpiHref({ unmeasured: 1 })} className="block">
            <StatTile
              label={t("strategy.kpis.unreported", "Unreported")}
              value={n(summary.total - summary.measured).toLocaleString()}
              meta={t("strategy.kpis.unreported_meta", "{n} never reported").replace(
                "{n}",
                String(n(summary.total) - n(summary.measured)),
              )}
              alert={n(summary.total) - n(summary.measured) > 0}
            />
          </Link>
          <Link href={kpiHref({ stale: 1 })} className="block">
            <StatTile
              label={t("strategy.overview.stale", "Stale")}
              value={n(summary.stale).toLocaleString()}
              meta={t("strategy.kpis.stale_meta", "older than their own cycle")}
              alert={n(summary.stale) > 0}
            />
          </Link>
          <Link href={kpiHref({ worst_first: 1 })} className="block">
            <StatTile
              label={t("strategy.kpis.worst", "Worst performers")}
              value={summary.worst?.length ? String(summary.worst.length) : "0"}
              meta={
                summary.worst?.[0]
                  ? `${summary.worst[0].code} · ${summary.worst[0].score?.toFixed(0) ?? "—"}`
                  : t("strategy.kpis.no_worst", "none flagged")
              }
              alert={(summary.worst?.length ?? 0) > 0}
            />
          </Link>
        </div>
      ) : null}

      {focusKpiId ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm print:hidden">
          <span>
            {t("strategy.kpis.focused", "Focused on measure")}{" "}
            <strong>{kpis.find((row) => String(row.id) === focusKpiId)?.name ?? `#${focusKpiId}`}</strong>
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setFocusKpiId("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("strategy.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      {objectiveFilter ? (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-sm print:hidden">
          <span>
            {t("strategy.kpis.filtered_objective", "Filtered to objective")}{" "}
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

      {filtersActive && kpis.length > 0 && visibleKpis.length === 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm print:hidden">
          <span>{t("strategy.kpis.no_match", "No measures match those filters on this page.")}</span>
          <Button size="sm" variant="ghost" className="h-7" onClick={clearFilters}>
            {t("strategy.common.clear_filters", "Clear filters")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="k-search" className="text-xs">
            {t("strategy.common.search", "Search")}
          </Label>
          <Input
            id="k-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("strategy.kpis.search_hint", "Code or name")}
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
              <SelectValue placeholder={t("strategy.common.any", "Any")} />
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
          <Label className="text-xs">{t("strategy.kpis.direction", "Direction")}</Label>
          <Select value={direction || "any"} onValueChange={(v) => setDirection(v === "any" ? "" : v)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("strategy.common.any", "Any")}</SelectItem>
              {DIRECTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("strategy.kpis.frequency", "Reported")}</Label>
          <Select value={frequency || "any"} onValueChange={(v) => setFrequency(v === "any" ? "" : v)}>
            <SelectTrigger className="h-9 w-40 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("strategy.common.any", "Any")}</SelectItem>
              {FREQUENCIES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("strategy.kpis.status", "Status")}</Label>
          <Select value={bandFilter || "any"} onValueChange={(v) => setBandFilter(v === "any" ? "" : v)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("strategy.common.any", "Any")}</SelectItem>
              {SCORE_BANDS.map((band) => (
                <SelectItem key={band} value={band}>
                  {band.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("strategy.common.sort", "Sort")}</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as KpiSort)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="code">{t("strategy.kpis.sort_code", "Code")}</SelectItem>
              <SelectItem value="worst_achievement">
                {t("strategy.kpis.sort_worst", "Worst achievement")}
              </SelectItem>
              <SelectItem value="stale_first">{t("strategy.kpis.sort_stale", "Stale first")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(e) => setStaleOnly(e.target.checked)}
            className="h-4 w-4"
          />
          {t("strategy.overview.stale_word", "stale")}
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={unmeasuredOnly}
            onChange={(e) => setUnmeasuredOnly(e.target.checked)}
            className="h-4 w-4"
          />
          {t("strategy.kpis.unreported", "unreported")}
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4"
          />
          {t("strategy.kpis.show_inactive", "show retired")}
        </label>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            {t("strategy.common.clear_filters", "Clear filters")}
          </Button>
        ) : null}
      </div>

      {staleOnly ? (
        <p className="text-xs text-muted-foreground print:hidden">
          {t(
            "strategy.kpis.stale_page_note",
            "Stale filtering runs on the current API page — widen search or clear other filters if a stale measure is missing.",
          )}
        </p>
      ) : null}

      <Panel
        title={t("strategy.kpis.register", "Measures")}
        description={t(
          "strategy.kpis.register_desc",
          "A measure sitting exactly where it started scores zero, however close to target it happens to look.",
        )}
      >
        {objectives.length === 0 && !objectivesQuery.isLoading ? (
          <div className="space-y-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("strategy.kpis.no_objectives", "Add objectives on the scorecard before defining measures.")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={scorecardHref()}>
                {t("strategy.scorecard.title", "Scorecard")}
              </Link>
            </Button>
          </div>
        ) : kpisQuery.isLoading ? (
          <LoadingPanel label={t("strategy.common.loading", "Loading measures...")} />
        ) : kpisQuery.isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("strategy.kpis.load_failed", "Could not load measures.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => kpisQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("strategy.common.retry", "Retry")}
            </Button>
          </div>
        ) : visibleKpis.length === 0 ? (
          <EmptyPanel label={t("strategy.kpis.none", "No measures match those filters.")} />
        ) : (
          <div className={`space-y-3 transition-opacity ${refetching ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[76rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.kpis.measure", "Measure")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.kpis.objective", "Objective")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.common.weight", "Weight")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.kpis.direction", "Direction")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.scorecard.journey", "Baseline → target")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.scorecard.latest", "Latest")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.scorecard.achievement", "Achieved")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("strategy.scorecard.score", "Score")}</th>
                    <th className="pb-2 pr-6 text-right font-semibold">
                      {t("strategy.common.actions", "Actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleKpis.map((kpi) => {
                    const focused = focusKpiId === String(kpi.id);
                    const objective = kpi.objective ?? objectiveById.get(kpi.objective_id);
                    return (
                      <tr
                        key={kpi.id}
                        ref={(el) => {
                          rowRefs.current[kpi.id] = el;
                        }}
                        className={`border-b border-border/40 last:border-0 ${
                          focused ? "bg-primary/5" : ""
                        } ${!kpi.is_active ? "opacity-60" : ""}`}
                      >
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => {
                              setFocusKpiId(String(kpi.id));
                              setDetailKpi(kpi);
                            }}
                          >
                            <span className="block font-medium">{kpi.name}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {kpi.code} · {kpi.frequency}
                              {!kpi.is_active ? (
                                <span className="ml-1.5 font-semibold text-muted-foreground">
                                  {t("strategy.kpis.retired", "retired")}
                                </span>
                              ) : null}
                              {kpi.is_stale ? (
                                <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">
                                  {t("strategy.overview.stale_word", "stale")}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {objective ? (
                            <Link href={scorecardHref({ objective_id: objective.id })} className="hover:underline">
                              {objective.title}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums">{n(kpi.weight)}</td>
                        <td className="py-2 pr-3 text-xs">
                          {kpi.direction === "lower_is_better"
                            ? t("strategy.kpis.lower_better", "Lower is better")
                            : t("strategy.kpis.higher_better", "Higher is better")}
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums text-muted-foreground">
                          {n(kpi.baseline_value)} → {n(kpi.target_value)}
                          {kpi.unit ? ` ${kpi.unit}` : ""}
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums">
                          {kpi.latest_value === null || kpi.latest_value === undefined ? "—" : kpi.latest_value}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="block text-sm font-bold tabular-nums">
                            {kpi.achievement_percent === null || kpi.achievement_percent === undefined
                              ? "—"
                              : `${kpi.achievement_percent.toFixed(1)}%`}
                          </span>
                          <Badge
                            variant="outline"
                            className={`border-transparent text-[10px] font-black uppercase tracking-widest ${BAND_TONE[(kpi.status ?? "unmeasured") as ScoreBand]}`}
                          >
                            {(kpi.status ?? "unmeasured").replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-sm font-bold tabular-nums">
                          {kpi.score === null || kpi.score === undefined ? "—" : `${kpi.score.toFixed(1)}`}
                        </td>
                        <td className="py-2 pr-6 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => setHistoryKpi(kpi)}
                            >
                              <History className="mr-1 h-3 w-3" />
                              {t("strategy.kpis.history", "History")}
                            </Button>
                            {canManageKpis ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => openEdit(kpi)}
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                {t("strategy.common.edit", "Edit")}
                              </Button>
                            ) : null}
                            {canRecord && kpi.is_active ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                onClick={() => openRecord(kpi)}
                              >
                                {t("strategy.kpis.record", "Record")}
                              </Button>
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

      {/* KPI detail */}
      <Dialog open={detailKpi !== null} onOpenChange={(open) => !open && setDetailKpi(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">{detailKpi?.name}</DialogTitle>
              <DialogDescription>
                {detailKpi?.code}
                {detailKpi?.owner_name ? ` · ${detailKpi.owner_name}` : ""}
              </DialogDescription>
            </DialogHeader>
          </div>
          {detailKpi ? (
            <div className="space-y-4 px-6 py-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">{t("strategy.scorecard.journey", "Baseline → target")}</p>
                  <p className="font-medium tabular-nums">
                    {n(detailKpi.baseline_value)} → {n(detailKpi.target_value)}
                    {detailKpi.unit ? ` ${detailKpi.unit}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">{t("strategy.kpis.frequency", "Reported")}</p>
                  <p className="font-medium capitalize">{detailKpi.frequency}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("strategy.kpis.stale_after", "Stale after {n} months without a reading").replace(
                      "{n}",
                      String(staleAfterMonths(detailKpi.frequency)),
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">{t("strategy.scorecard.achievement", "Achieved")}</p>
                  <p className="font-bold tabular-nums">
                    {detailKpi.achievement_percent === null || detailKpi.achievement_percent === undefined
                      ? "—"
                      : `${detailKpi.achievement_percent.toFixed(1)}%`}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">{t("strategy.scorecard.score", "Score")}</p>
                  <p className="font-bold tabular-nums">
                    {detailKpi.score === null || detailKpi.score === undefined
                      ? "—"
                      : detailKpi.score.toFixed(1)}
                  </p>
                </div>
              </div>
              {detailKpi.data_source ? (
                <p className="text-xs text-muted-foreground">
                  {t("strategy.kpis.source", "Where the number comes from")}: {detailKpi.data_source}
                </p>
              ) : null}
              {detailKpi.objective || objectiveById.get(detailKpi.objective_id) ? (
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link href={scorecardHref({ objective_id: detailKpi.objective_id })}>
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    {t("strategy.kpis.view_on_scorecard", "View on scorecard")}
                  </Link>
                </Button>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setHistoryKpi(detailKpi)}>
                  <History className="mr-2 h-3.5 w-3.5" />
                  {t("strategy.kpis.history", "History")}
                </Button>
                {canManageKpis ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetailKpi(null);
                      openEdit(detailKpi);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {t("strategy.common.edit", "Edit")}
                  </Button>
                ) : null}
                {canRecord && detailKpi.is_active ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setDetailKpi(null);
                      openRecord(detailKpi);
                    }}
                  >
                    {t("strategy.kpis.record", "Record")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Add / edit measure */}
      <Dialog
        open={kpiOpen}
        onOpenChange={(open) => {
          setKpiOpen(open);
          if (!open) {
            setEditingKpi(null);
            setForm({ ...emptyKpiForm, objective_id: objectiveFilter });
          }
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingKpi ? t("strategy.kpis.edit", "Edit Measure") : t("strategy.kpis.add", "Add Measure")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "strategy.kpis.add_desc",
                  "The baseline is where the measure stood when the plan began. Getting it wrong is what makes a scorecard flatter a business that has not moved.",
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
                  <SelectValue placeholder={t("strategy.common.select", "Select...")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("strategy.common.select", "Select...")}</SelectItem>
                  {objectives.map((objective) => (
                    <SelectItem key={objective.id} value={String(objective.id)}>
                      {objective.code} — {objective.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-code">{t("strategy.common.code", "Code")}</Label>
              <Input id="n-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-unit">{t("strategy.kpis.unit", "Unit")}</Label>
              <Input id="n-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="n-name">{t("strategy.common.name", "Name")}</Label>
              <Input id="n-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="n-owner">{t("strategy.common.owner", "Owner")}</Label>
              <Input
                id="n-owner"
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("strategy.kpis.direction", "Direction")}</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger onPointerDownCapture={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="higher_is_better">
                    {t("strategy.kpis.higher_better", "Higher is better")}
                  </SelectItem>
                  <SelectItem value="lower_is_better">
                    {t("strategy.kpis.lower_better", "Lower is better")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {baselineTargetWarning ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t(
                    "strategy.kpis.lower_better_hint",
                    "For lower-is-better measures, baseline is usually above target (e.g. cost 100 → 80).",
                  )}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-baseline">{t("strategy.kpis.baseline", "Baseline")}</Label>
              <Input
                id="n-baseline"
                type="number"
                step="any"
                value={form.baseline_value}
                onChange={(e) => setForm({ ...form, baseline_value: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-target">{t("strategy.kpis.target", "Target")}</Label>
              <Input
                id="n-target"
                type="number"
                step="any"
                value={form.target_value}
                onChange={(e) => setForm({ ...form, target_value: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-weight">{t("strategy.common.weight", "Weight")}</Label>
              <Input
                id="n-weight"
                type="number"
                min={0}
                step="0.5"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("strategy.kpis.frequency", "Reported")}</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger onPointerDownCapture={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((value) => (
                    <SelectItem key={value} value={value} className="capitalize">
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="n-source">{t("strategy.kpis.source", "Where the number comes from")}</Label>
              <Input
                id="n-source"
                value={form.data_source}
                onChange={(e) => setForm({ ...form, data_source: e.target.value })}
              />
            </div>
            {editingKpi ? (
              <label className="flex items-center gap-2 sm:col-span-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                {t("strategy.kpis.active_measure", "Measure is active (uncheck to retire)")}
              </label>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setKpiOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveKpi.mutate()}
              disabled={saveKpi.isPending || !form.objective_id || !form.code.trim() || !form.name.trim()}
            >
              {saveKpi.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record a reading */}
      <Dialog
        open={recording !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRecording(null);
            setReadingForm({
              period_label: "",
              period_start: "",
              period_end: "",
              actual_value: "",
              note: "",
              recorded_by_name: "",
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.kpis.record_title", "Record actual")}
              </DialogTitle>
              <DialogDescription>
                {recording
                  ? t(
                      "strategy.kpis.record_desc",
                      "{name}: {baseline} → {target}. One reading per period — a restated actual replaces the earlier one.",
                    )
                      .replace("{name}", recording.name)
                      .replace("{baseline}", String(n(recording.baseline_value)))
                      .replace("{target}", String(n(recording.target_value)))
                  : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-label">{t("strategy.kpis.period", "Period")}</Label>
              <Input
                id="r-label"
                value={readingForm.period_label}
                onChange={(e) => setReadingForm({ ...readingForm, period_label: e.target.value })}
              />
              {existingPeriod ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t(
                    "strategy.kpis.period_exists",
                    "A reading for this period exists — saving will replace it.",
                  )}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-actual">{t("strategy.kpis.actual", "Actual")}</Label>
              <Input
                id="r-actual"
                type="number"
                step="any"
                value={readingForm.actual_value}
                onChange={(e) => setReadingForm({ ...readingForm, actual_value: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-start">{t("strategy.kpis.period_start", "From")}</Label>
              <Input
                id="r-start"
                type="date"
                value={readingForm.period_start}
                onChange={(e) => setReadingForm({ ...readingForm, period_start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-end">{t("strategy.kpis.period_end", "To")}</Label>
              <Input
                id="r-end"
                type="date"
                min={readingForm.period_start}
                value={readingForm.period_end}
                onChange={(e) => setReadingForm({ ...readingForm, period_end: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="r-note">{t("strategy.kpis.note", "Note")}</Label>
              <Input
                id="r-note"
                value={readingForm.note}
                onChange={(e) => setReadingForm({ ...readingForm, note: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="r-by">{t("strategy.kpis.recorded_by", "Recorded by")}</Label>
              <Input
                id="r-by"
                value={readingForm.recorded_by_name}
                onChange={(e) => setReadingForm({ ...readingForm, recorded_by_name: e.target.value })}
              />
            </div>
            {readingForm.actual_value !== "" ? (
              <div className="sm:col-span-2 space-y-1 text-xs text-muted-foreground">
                <p>
                  {t("strategy.kpis.preview", "That would read as {n}% achieved.").replace(
                    "{n}",
                    rawPreview.toFixed(1),
                  )}
                </p>
                <p>
                  {t("strategy.kpis.preview_score", "Roll-up score (clamped): {n}.").replace(
                    "{n}",
                    clampedPreview.toFixed(1),
                  )}
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRecording(null)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => recordReading.mutate()}
              disabled={
                recordReading.isPending ||
                !readingForm.period_label.trim() ||
                readingForm.actual_value === "" ||
                !readingForm.period_start ||
                !readingForm.period_end
              }
            >
              {recordReading.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reading history */}
      <Dialog open={historyKpi !== null} onOpenChange={(open) => !open && setHistoryKpi(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.kpis.history_title", "Reading history")}
              </DialogTitle>
              <DialogDescription>{historyKpi?.name}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-6 py-5">
            {readingsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : readingsQuery.isError ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("strategy.kpis.history_failed", "Could not load readings.")}
                </p>
                <Button variant="outline" size="sm" onClick={() => readingsQuery.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("strategy.common.retry", "Retry")}
                </Button>
              </div>
            ) : readings.length === 0 ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("strategy.kpis.no_readings", "No readings recorded yet.")}
                </p>
                {canRecord && historyKpi?.is_active ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      const kpi = historyKpi;
                      setHistoryKpi(null);
                      openRecord(kpi);
                    }}
                  >
                    {t("strategy.kpis.record", "Record")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3">{t("strategy.kpis.period", "Period")}</th>
                    <th className="pb-2 pr-3">{t("strategy.kpis.actual", "Actual")}</th>
                    <th className="pb-2 pr-3">{t("strategy.kpis.recorded_on", "Recorded")}</th>
                    <th className="pb-2 pr-3">{t("strategy.kpis.recorded_by", "By")}</th>
                    <th className="pb-2 pr-3">{t("strategy.kpis.note", "Note")}</th>
                    <th className="pb-2 text-right">{t("strategy.common.actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((reading) => (
                    <tr key={reading.id} className="border-t border-border/40">
                      <td className="py-2 pr-3">{reading.period_label}</td>
                      <td className="py-2 pr-3 tabular-nums">{n(reading.actual_value)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {reading.recorded_on ? String(reading.recorded_on).slice(0, 10) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{reading.recorded_by_name ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{reading.note ?? "—"}</td>
                      <td className="py-2 text-right">
                        {canRecord && historyKpi?.is_active ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px]"
                            onClick={() => {
                              const kpi = historyKpi;
                              setHistoryKpi(null);
                              openRecord(kpi, {
                                period_label: reading.period_label,
                                period_start: String(reading.period_start).slice(0, 10),
                                period_end: String(reading.period_end).slice(0, 10),
                                actual_value: String(n(reading.actual_value)),
                                note: reading.note ?? "",
                                recorded_by_name: reading.recorded_by_name ?? "",
                              });
                            }}
                          >
                            {t("strategy.kpis.record_again", "Update")}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
