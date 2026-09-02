"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { hrFetch, type Employee as HrEmployee, type Paginated as HrPaginated } from "@/modules/humanresources/api";
import { strategyApi } from "@/modules/strategy/api";
import type {
  ObjectiveStatus,
  ScoreBand,
  Scorecard,
  ScoredKpi,
  ScoredObjective,
  ScoredPerspective,
  StrategyObjective,
  StrategyOverview,
  StrategyPerspective,
} from "@/modules/strategy/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

function employeeLabel(
  employees: Map<number, { id: number; first_name?: string; last_name?: string; name?: string }>,
  id: number | null | undefined,
): string | null {
  if (id == null) return null;
  const row = employees.get(id);
  if (!row) return null;
  if (row.name) return row.name;
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || null;
}

function metaById(objectives: StrategyObjective[]): Map<number, StrategyObjective> {
  const map = new Map<number, StrategyObjective>();
  for (const row of objectives) map.set(row.id, row);
  return map;
}

/** Root objectives for a perspective panel; children render nested under their parent. */
function rootsForPerspective(
  scored: ScoredObjective[],
  meta: Map<number, StrategyObjective>,
): ScoredObjective[] {
  const ids = new Set(scored.map((row) => row.objective_id));
  return scored.filter((row) => {
    const parentId = meta.get(row.objective_id)?.parent_id;
    return parentId == null || !ids.has(parentId);
  });
}

function childrenOf(
  parentId: number,
  scored: ScoredObjective[],
  meta: Map<number, StrategyObjective>,
): ScoredObjective[] {
  const childIds = new Set(
    [...meta.values()].filter((row) => row.parent_id === parentId).map((row) => row.id),
  );
  return scored.filter((row) => childIds.has(row.objective_id));
}

function filterObjectives(
  objectives: ScoredObjective[],
  meta: Map<number, StrategyObjective>,
  opts: {
    search: string;
    band: string;
    sortWorstFirst: boolean;
    hideAchieved: boolean;
  },
): ScoredObjective[] {
  let rows = [...objectives];
  if (opts.hideAchieved) {
    rows = rows.filter((row) => meta.get(row.objective_id)?.status !== "achieved");
  }
  if (opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        (row.owner ?? "").toLowerCase().includes(q),
    );
  }
  if (opts.band) {
    rows = rows.filter((row) => row.status === opts.band);
  }
  if (opts.sortWorstFirst) {
    rows.sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return a.score - b.score;
    });
  }
  return rows;
}

function hasActiveFilters(opts: {
  search: string;
  band: string;
  perspective: string;
  hideAchieved: boolean;
}): boolean {
  return Boolean(opts.search.trim() || opts.band || opts.perspective || opts.hideAchieved);
}

const OBJECTIVE_STATUSES: ObjectiveStatus[] = ["active", "achieved", "dropped"];

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const BAND_TONE: Record<ScoreBand, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  off_track: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  unmeasured: "bg-muted text-muted-foreground",
};

const BAND_BAR: Record<ScoreBand, string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  off_track: "bg-rose-500",
  unmeasured: "bg-muted-foreground/40",
};

const STATUS_TONE: Record<ObjectiveStatus, string> = {
  active: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  achieved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  dropped: "bg-muted text-muted-foreground",
};

function ScoreBar({ score, band }: { score: number | null; band: ScoreBand }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${BAND_BAR[band]}`}
        style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }}
      />
    </div>
  );
}

const emptyObjectiveForm = {
  perspective_id: "",
  parent_id: "",
  code: "",
  title: "",
  description: "",
  owner_name: "",
  owner_employee_id: "",
  department: "",
  weight: "1",
  status: "active" as ObjectiveStatus,
};

const emptyPerspectiveForm = {
  code: "",
  name: "",
  description: "",
  weight: "25",
  sort_order: "0",
};

export default function StrategyScorecardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canManageObjectives = hasAnyPermission(["manage_strategy_objectives", "manage_strategy"]);
  const canManagePlans = hasAnyPermission(["manage_strategy_plans", "manage_strategy"]);
  const canManageKpis = hasAnyPermission(["manage_strategy_kpis", "manage_strategy"]);
  const canManageInitiatives = hasAnyPermission(["manage_strategy_initiatives", "manage_strategy"]);
  const canRecord = hasAnyPermission([
    "record_strategy_readings",
    "manage_strategy_kpis",
    "manage_strategy",
  ]);

  const [planId, setPlanId] = React.useState(searchParams.get("plan_id") ?? "");
  const [asOf, setAsOf] = React.useState(searchParams.get("as_of") ?? "");
  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");
  const [bandFilter, setBandFilter] = React.useState(searchParams.get("band") ?? "");
  const [perspectiveFilter, setPerspectiveFilter] = React.useState(
    searchParams.get("perspective") ?? "",
  );
  const [sortWorstFirst, setSortWorstFirst] = React.useState(
    searchParams.get("worst_first") === "1",
  );
  const [hideAchieved, setHideAchieved] = React.useState(
    searchParams.get("hide_achieved") === "1",
  );
  const [showDropped, setShowDropped] = React.useState(false);
  const [focusObjectiveId, setFocusObjectiveId] = React.useState(
    searchParams.get("objective_id") ?? "",
  );

  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});
  const [collapsedPerspectives, setCollapsedPerspectives] = React.useState<Record<string, boolean>>(
    {},
  );

  const [objectiveOpen, setObjectiveOpen] = React.useState(false);
  const [editingObjectiveId, setEditingObjectiveId] = React.useState<number | null>(null);
  const [detailObjectiveId, setDetailObjectiveId] = React.useState<number | null>(null);
  const [perspectiveOpen, setPerspectiveOpen] = React.useState(false);
  const [editingPerspective, setEditingPerspective] = React.useState<StrategyPerspective | null>(
    null,
  );

  const [form, setForm] = React.useState(emptyObjectiveForm);
  const [perspectiveForm, setPerspectiveForm] = React.useState(emptyPerspectiveForm);

  const objectiveRefs = React.useRef<Record<number, HTMLDivElement | null>>({});

  const overviewQuery = useQuery({
    queryKey: ["strategy", "overview-scorecard", planId],
    queryFn: () =>
      strategyApi
        .overview(planId ? { plan_id: Number(planId) } : undefined)
        .then((res) => res.data),
  });

  const overview: StrategyOverview | undefined = overviewQuery.data?.data;
  const activePlanId = planId ? Number(planId) : overview?.plan?.id;
  const hrEnabled = overview?.integrations?.human_resources ?? false;

  const scorecardQuery = useQuery({
    queryKey: ["strategy", "scorecard", activePlanId, asOf],
    queryFn: () =>
      strategyApi
        .scorecard(activePlanId!, asOf ? { as_of: asOf } : undefined)
        .then((res) => res.data),
    enabled: activePlanId !== undefined && activePlanId !== null,
    placeholderData: (previous) => previous,
  });

  const perspectivesQuery = useQuery({
    queryKey: ["strategy", "perspective-options", activePlanId],
    queryFn: () =>
      strategyApi.listPerspectives({ plan_id: activePlanId, limit: 50 }).then((res) => res.data),
    enabled: !!activePlanId,
  });

  const objectivesMetaQuery = useQuery({
    queryKey: ["strategy", "objectives-meta", activePlanId],
    queryFn: () =>
      strategyApi.listObjectives({ plan_id: activePlanId, limit: 500 }).then((res) => res.data),
    enabled: !!activePlanId,
  });

  const droppedQuery = useQuery({
    queryKey: ["strategy", "objectives-dropped", activePlanId],
    queryFn: () =>
      strategyApi
        .listObjectives({ plan_id: activePlanId, status: "dropped", limit: 100 })
        .then((res) => res.data),
    enabled: !!activePlanId && showDropped,
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", "strategy-scorecard"],
    queryFn: () => hrFetch<HrPaginated<HrEmployee>>("/employees?per_page=200"),
    enabled: hrEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ["strategy", "objective-detail", detailObjectiveId],
    queryFn: () => strategyApi.getObjective(detailObjectiveId!).then((res) => res.data),
    enabled: detailObjectiveId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["strategy"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const refreshAll = () => {
    overviewQuery.refetch();
    scorecardQuery.refetch();
    perspectivesQuery.refetch();
    objectivesMetaQuery.refetch();
  };

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (planId) params.set("plan_id", planId);
    if (asOf) params.set("as_of", asOf);
    if (search.trim()) params.set("search", search.trim());
    if (bandFilter) params.set("band", bandFilter);
    if (perspectiveFilter) params.set("perspective", perspectiveFilter);
    if (sortWorstFirst) params.set("worst_first", "1");
    if (hideAchieved) params.set("hide_achieved", "1");
    if (focusObjectiveId) params.set("objective_id", focusObjectiveId);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    asOf,
    bandFilter,
    focusObjectiveId,
    hideAchieved,
    pathname,
    perspectiveFilter,
    planId,
    router,
    search,
    sortWorstFirst,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  const saveObjective = useMutation({
    mutationFn: () => {
      const payload = {
        plan_id: activePlanId,
        ...(form.perspective_id
          ? { perspective_id: Number(form.perspective_id) }
          : { perspective_id: null }),
        ...(form.parent_id ? { parent_id: Number(form.parent_id) } : { parent_id: null }),
        code: form.code,
        title: form.title,
        description: form.description || null,
        owner_name: form.owner_name || null,
        owner_employee_id: form.owner_employee_id ? Number(form.owner_employee_id) : null,
        department: form.department || null,
        weight: Number(form.weight || 1),
        status: form.status,
      };
      return editingObjectiveId
        ? strategyApi.updateObjective(editingObjectiveId, payload)
        : strategyApi.createObjective(payload);
    },
    onSuccess: () => {
      toast.success(editingObjectiveId ? "Objective updated." : "Objective added.");
      invalidate();
      setObjectiveOpen(false);
      setEditingObjectiveId(null);
      setForm(emptyObjectiveForm);
    },
    onError: (error: any) => toast.error(errorText(error, "Could not save objective.")),
  });

  const savePerspective = useMutation({
    mutationFn: () => {
      const payload = {
        code: perspectiveForm.code,
        name: perspectiveForm.name,
        description: perspectiveForm.description || null,
        weight: Number(perspectiveForm.weight || 1),
        sort_order: Number(perspectiveForm.sort_order || 0),
      };
      return editingPerspective
        ? strategyApi.updatePerspective(editingPerspective.id, payload)
        : strategyApi.createPerspective({ plan_id: activePlanId, ...payload });
    },
    onSuccess: () => {
      toast.success(editingPerspective ? "Perspective updated." : "Perspective added.");
      invalidate();
      setPerspectiveOpen(false);
      setEditingPerspective(null);
      setPerspectiveForm(emptyPerspectiveForm);
    },
    onError: (error: any) => toast.error(errorText(error, "Could not save perspective.")),
  });

  const scorecard: Scorecard | undefined = scorecardQuery.data?.data;
  const perspectives = (perspectivesQuery.data?.data ?? []) as StrategyPerspective[];
  const objectivesMeta = (objectivesMetaQuery.data?.data ?? []) as StrategyObjective[];
  const droppedObjectives = (droppedQuery.data?.data ?? []) as StrategyObjective[];
  const objectiveMeta = React.useMemo(() => metaById(objectivesMeta), [objectivesMeta]);

  const perspectiveMeta = React.useMemo(() => {
    const map = new Map<number, StrategyPerspective>();
    for (const row of perspectives) map.set(row.id, row);
    return map;
  }, [perspectives]);

  const employeeById = React.useMemo(() => {
    const map = new Map<number, HrEmployee>();
    for (const row of employeesQuery.data?.data ?? []) map.set(row.id, row);
    return map;
  }, [employeesQuery.data]);

  const initiativeCountByObjective = React.useMemo(() => {
    const map = new Map<number, number>();
    for (const objective of objectivesMeta) map.set(objective.id, n(objective.initiatives_count));
    return map;
  }, [objectivesMeta]);

  const withoutInitiativeCount = React.useMemo(
    () =>
      objectivesMeta.filter(
        (row) => row.status !== "dropped" && n(row.initiatives_count) === 0,
      ).length,
    [objectivesMeta],
  );

  const parentOptions = React.useMemo(
    () => objectivesMeta.filter((row) => row.parent_id === null && row.id !== editingObjectiveId),
    [objectivesMeta, editingObjectiveId],
  );

  const filtersActive = hasActiveFilters({
    search,
    band: bandFilter,
    perspective: perspectiveFilter,
    hideAchieved,
  });

  const allObjectiveIds = React.useMemo(() => {
    if (!scorecard) return [];
    return scorecard.perspectives.flatMap((p) => p.objectives.map((o) => o.objective_id));
  }, [scorecard]);

  const openAddObjective = (perspectiveId?: number | null) => {
    setEditingObjectiveId(null);
    setForm({ ...emptyObjectiveForm, perspective_id: perspectiveId ? String(perspectiveId) : "" });
    setObjectiveOpen(true);
  };

  const openEditObjective = (objective: ScoredObjective) => {
    const meta = objectiveMeta.get(objective.objective_id);
    setEditingObjectiveId(objective.objective_id);
    setForm({
      perspective_id: meta?.perspective_id ? String(meta.perspective_id) : "",
      parent_id: meta?.parent_id ? String(meta.parent_id) : "",
      code: objective.code,
      title: objective.title,
      description: meta?.description ?? "",
      owner_name: objective.owner ?? "",
      owner_employee_id: meta?.owner_employee_id ? String(meta.owner_employee_id) : "",
      department: objective.department ?? "",
      weight: String(objective.weight),
      status: meta?.status ?? "active",
    });
    setObjectiveOpen(true);
  };

  const openPerspectiveDialog = (perspective?: StrategyPerspective) => {
    if (perspective) {
      setEditingPerspective(perspective);
      setPerspectiveForm({
        code: perspective.code,
        name: perspective.name,
        description: perspective.description ?? "",
        weight: String(n(perspective.weight)),
        sort_order: String(perspective.sort_order ?? 0),
      });
    } else {
      setEditingPerspective(null);
      setPerspectiveForm(emptyPerspectiveForm);
    }
    setPerspectiveOpen(true);
  };

  const toggle = (id: number) => setExpanded((c) => ({ ...c, [id]: !c[id] }));
  const expandAll = () => {
    const next: Record<number, boolean> = {};
    for (const id of allObjectiveIds) next[id] = true;
    setExpanded(next);
  };
  const collapseAll = () => setExpanded({});

  const clearFilters = () => {
    setSearch("");
    setBandFilter("");
    setPerspectiveFilter("");
    setSortWorstFirst(false);
    setHideAchieved(false);
  };

  React.useEffect(() => {
    if (!focusObjectiveId || !scorecard) return;
    const id = Number(focusObjectiveId);
    if (!Number.isFinite(id)) return;
    setExpanded((c) => ({ ...c, [id]: true }));
    window.requestAnimationFrame(() => {
      objectiveRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [focusObjectiveId, scorecard]);

  const detailData = detailQuery.data?.data;
  const detailObjective = detailData?.objective as StrategyObjective | undefined;
  const detailScored = detailData?.scored as ScoredObjective | undefined;
  const refetching = scorecardQuery.isFetching && !scorecardQuery.isLoading;

  const renderKpiTable = (objective: ScoredObjective) => (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left uppercase tracking-wide text-muted-foreground">
          <th className="pb-1.5 pr-3 font-semibold">Measure</th>
          <th className="pb-1.5 pr-3 font-semibold">Baseline → target</th>
          <th className="pb-1.5 pr-3 font-semibold">Latest</th>
          <th className="pb-1.5 pr-3 text-right font-semibold">Achieved</th>
          <th className="pb-1.5 pr-3 text-right font-semibold">Score</th>
          <th className="pb-1.5 text-right font-semibold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {objective.kpis.map((kpi: ScoredKpi) => (
          <tr key={kpi.kpi_id} className="border-t border-border/30">
            <td className="py-1.5 pr-3">
              <Link href={`/dashboard/strategy/kpis?kpi_id=${kpi.kpi_id}`} className="hover:underline">
                {kpi.name}
              </Link>
              <span className="ml-1.5 text-[10px] text-muted-foreground">{kpi.code}</span>
              {kpi.is_stale ? (
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-600">
                  stale
                </span>
              ) : null}
            </td>
            <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
              {kpi.baseline} → {kpi.target}
              {kpi.unit ? ` ${kpi.unit}` : ""}
            </td>
            <td className="py-1.5 pr-3 tabular-nums">{kpi.latest === null ? "—" : kpi.latest}</td>
            <td className="py-1.5 pr-3 text-right">
              <span className="block font-semibold tabular-nums">
                {kpi.achievement_percent === null ? "—" : `${kpi.achievement_percent.toFixed(1)}%`}
              </span>
              <Badge
                variant="outline"
                className={`border-transparent text-[9px] font-black uppercase tracking-widest ${BAND_TONE[kpi.status]}`}
              >
                {kpi.status.replace(/_/g, " ")}
              </Badge>
            </td>
            <td className="py-1.5 pr-3 text-right tabular-nums font-semibold">
              {kpi.score === null ? "—" : `${kpi.score.toFixed(1)}%`}
            </td>
            <td className="py-1.5 text-right">
              <div className="flex justify-end gap-1">
                <Button asChild size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]">
                  <Link href={`/dashboard/strategy/kpis?kpi_id=${kpi.kpi_id}&history=1`}>
                    <History className="mr-1 h-3 w-3" />
                    History
                  </Link>
                </Button>
                {canManageKpis ? (
                  <Button asChild size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]">
                    <Link href={`/dashboard/strategy/kpis?kpi_id=${kpi.kpi_id}&edit=1`}>Edit</Link>
                  </Button>
                ) : null}
                {canRecord && (kpi.latest === null || kpi.is_stale) ? (
                  <Button asChild size="sm" variant="link" className="h-6 px-1 text-[10px]">
                    <Link
                      href={`/dashboard/strategy/kpis?objective_id=${objective.objective_id}&kpi_id=${kpi.kpi_id}&record=1`}
                    >
                      Record
                    </Link>
                  </Button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderObjective = (objective: ScoredObjective, depth = 0, allScored: ScoredObjective[]) => {
    const meta = objectiveMeta.get(objective.objective_id);
    const lifecycle = meta?.status ?? "active";
    const initiativeCount = initiativeCountByObjective.get(objective.objective_id) ?? 0;
    const childRows = childrenOf(objective.objective_id, allScored, objectiveMeta);

    return (
      <div key={objective.objective_id} className="space-y-2">
        <div
          ref={(el) => {
            objectiveRefs.current[objective.objective_id] = el;
          }}
          className={`rounded-lg border border-border/50 ${
            focusObjectiveId === String(objective.objective_id) ? "ring-2 ring-primary/40" : ""
          }`}
          style={{ marginLeft: depth * 16 }}
        >
          <div className="flex w-full items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => toggle(objective.objective_id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              {expanded[objective.objective_id] ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{objective.title}</span>
                  {lifecycle !== "active" ? (
                    <Badge
                      variant="outline"
                      className={`border-transparent text-[9px] font-black uppercase ${STATUS_TONE[lifecycle]}`}
                    >
                      {lifecycle}
                    </Badge>
                  ) : null}
                  {objective.kpi_count === 0 ? (
                    <Badge variant="outline" className="border-transparent text-[9px] text-amber-700">
                      no measure
                    </Badge>
                  ) : null}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {objective.code}
                  {objective.owner ? ` · ${objective.owner}` : ""}
                  {meta?.perspective_id
                    ? ` · ${perspectiveMeta.get(meta.perspective_id)?.name ?? ""}`
                    : ""}
                  {" · "}
                  {objective.measured_kpi_count} of {objective.kpi_count} measures
                  {initiativeCount === 0 ? (
                    <span className="ml-1 font-semibold text-amber-600">· no initiative</span>
                  ) : (
                    <Link
                      href={`/dashboard/strategy/initiatives?objective_id=${objective.objective_id}`}
                      className="ml-1 text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      · {initiativeCount} initiative{initiativeCount === 1 ? "" : "s"}
                    </Link>
                  )}
                </span>
                <span className="mt-1.5 block">
                  <ScoreBar score={objective.score} band={objective.status} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold tabular-nums">
                  {objective.score === null ? "—" : `${objective.score.toFixed(1)}%`}
                </span>
                <span className="block text-[11px] capitalize text-muted-foreground">
                  {objective.status.replace(/_/g, " ")}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => setDetailObjectiveId(objective.objective_id)}
              >
                View
              </Button>
              {canManageObjectives ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => openEditObjective(objective)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Edit
                </Button>
              ) : null}
            </div>
          </div>

          {expanded[objective.objective_id] ? (
            <div className="border-t border-border/40 px-3 py-2">
              {meta?.description ? (
                <p className="mb-2 text-xs text-muted-foreground">{meta.description}</p>
              ) : null}
              <div className="mb-2 flex flex-wrap gap-2">
                {canManageKpis ? (
                  <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                    <Link href={`/dashboard/strategy/kpis?objective_id=${objective.objective_id}&add=1`}>
                      Add measure
                    </Link>
                  </Button>
                ) : null}
                {canManageInitiatives ? (
                  <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                    <Link
                      href={`/dashboard/strategy/initiatives?objective_id=${objective.objective_id}&add=1`}
                    >
                      Add initiative
                    </Link>
                  </Button>
                ) : null}
              </div>
              {objective.kpis.length === 0 ? (
                <p className="py-2 text-center text-xs italic text-muted-foreground">
                  No measures attached — this objective cannot be judged.
                </p>
              ) : (
                renderKpiTable(objective)
              )}
            </div>
          ) : null}
        </div>
        {childRows.map((child) => renderObjective(child, depth + 1, allScored))}
      </div>
    );
  };

  const visiblePerspectives = (scorecard?.perspectives ?? []).filter((p) => {
    if (!perspectiveFilter) return true;
    if (perspectiveFilter === "unassigned") return p.perspective_id === null;
    return String(p.perspective_id) === perspectiveFilter;
  });

  const totalScoredBeforeFilter = (scorecard?.perspectives ?? []).reduce(
    (sum, p) => sum + (p.objectives?.length ?? 0),
    0,
  );
  const totalScoredAfterFilter = visiblePerspectives.reduce((sum, p) => {
    const roots = rootsForPerspective(p.objectives ?? [], objectiveMeta);
    return sum + filterObjectives(roots, objectiveMeta, { search, band: bandFilter, sortWorstFirst, hideAchieved }).length;
  }, 0);

  return (
    <div className="space-y-6 print:space-y-4">
      <Breadcrumbs
        items={[
          { label: t("strategy.overview.title", "Strategy"), href: "/dashboard/strategy" },
          { label: t("strategy.scorecard.title", "Scorecard") },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight">Scorecard</h1>
            {scorecard?.plan?.status ? (
              <Badge variant="outline" className="capitalize">
                {scorecard.plan.status}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Perspectives hold objectives, objectives are measured by KPIs, and every level rolls up by weight.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href="/dashboard/strategy">Overview</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href="/dashboard/strategy/kpis">KPIs</Link>
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
          <Button variant="outline" size="sm" className="rounded-full" onClick={refreshAll}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {canManagePlans ? (
            <Button
              variant="outline"
              className="rounded-full px-5"
              onClick={() => openPerspectiveDialog()}
              disabled={!activePlanId}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Perspective
            </Button>
          ) : null}
          {canManageObjectives ? (
            <Button className="rounded-full px-5" onClick={() => openAddObjective()} disabled={!activePlanId}>
              <Plus className="mr-2 h-4 w-4" />
              Add Objective
            </Button>
          ) : null}
        </div>
      </div>

      {scorecard ? (
        <div
          className={`space-y-4 transition-opacity print:hidden ${refetching ? "opacity-60" : ""}`}
        >
          {focusObjectiveId ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
              <span>
                Focused on objective{" "}
                <strong>
                  {objectiveMeta.get(Number(focusObjectiveId))?.title ??
                    `#${focusObjectiveId}`}
                </strong>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => setFocusObjectiveId("")}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          ) : null}

          {filtersActive && totalScoredBeforeFilter > 0 && totalScoredAfterFilter === 0 ? (
            <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
              <span>No objectives match the current filters.</span>
              <Button size="sm" variant="outline" className="h-7" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
            {(overview?.plans ?? []).length > 0 ? (
              <div className="space-y-1">
                <Label className="text-xs">Plan</Label>
                <Select
                  value={planId || "current"}
                  onValueChange={(v) => setPlanId(v === "current" ? "" : v)}
                >
                  <SelectTrigger className="h-9 w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current plan</SelectItem>
                    {(overview?.plans ?? []).map((plan) => (
                      <SelectItem key={plan.id} value={String(plan.id)}>
                        {plan.name} ({plan.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs">Perspective</Label>
              <Select
                value={perspectiveFilter || "any"}
                onValueChange={(v) => setPerspectiveFilter(v === "any" ? "" : v)}
              >
                <SelectTrigger className="h-9 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any perspective</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {perspectives.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">As of</Label>
              <div className="flex gap-1">
                <Input
                  type="date"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                  className="h-9 w-40"
                />
                {asOf ? (
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setAsOf("")}>
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Objective or owner"
                className="h-9 w-44"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Standing</Label>
              <Select value={bandFilter || "any"} onValueChange={(v) => setBandFilter(v === "any" ? "" : v)}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="on_track">On track</SelectItem>
                  <SelectItem value="at_risk">At risk</SelectItem>
                  <SelectItem value="off_track">Off track</SelectItem>
                  <SelectItem value="unmeasured">Unmeasured</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={sortWorstFirst} onChange={(e) => setSortWorstFirst(e.target.checked)} className="h-4 w-4" />
              Worst first
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={hideAchieved} onChange={(e) => setHideAchieved(e.target.checked)} className="h-4 w-4" />
              Hide achieved
            </label>
            <div className="flex gap-2 pb-0.5 sm:ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={expandAll}>
                Expand all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={collapseAll}>
                Collapse all
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {scorecardQuery.isLoading && !scorecard ? (
        <LoadingPanel label="Loading the scorecard..." />
      ) : scorecardQuery.isError || overviewQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Could not load the scorecard.</p>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : !scorecard ? (
        <div className="space-y-4 text-center">
          <EmptyPanel label="No strategic plan has been set up yet." />
          <Button asChild className="rounded-full">
            <Link href="/dashboard/strategy/reviews?add_plan=1">Set up a plan</Link>
          </Button>
        </div>
      ) : (
        <>
          <Link
            href={`/dashboard/strategy${planId ? `?plan_id=${planId}` : ""}`}
            className={`block rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40 ${refetching ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Plan score{scorecard.as_of ? ` · as of ${scorecard.as_of}` : ""}
                </p>
                <p className="text-3xl font-black tabular-nums">
                  {scorecard.score === null ? "—" : `${scorecard.score.toFixed(1)}%`}
                </p>
              </div>
              <Badge variant="outline" className={`border-transparent text-[10px] font-black uppercase ${BAND_TONE[scorecard.status]}`}>
                {scorecard.status.replace(/_/g, " ")}
              </Badge>
              {scorecard.pace !== null && scorecard.pace !== undefined ? (
                <p className={`text-xs font-semibold ${scorecard.pace >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {scorecard.pace >= 0
                    ? `${scorecard.pace.toFixed(1)} points ahead of the clock`
                    : `${Math.abs(scorecard.pace).toFixed(1)} points behind the clock`}
                </p>
              ) : null}
              <div className="text-xs text-muted-foreground sm:ml-auto sm:text-right">
                <p className="font-medium text-foreground">{scorecard.plan.name}</p>
                <p>
                  {scorecard.plan.starts_on} → {scorecard.plan.ends_on}
                </p>
                <p>
                  {n(scorecard.plan.elapsed_percent).toFixed(0)}% elapsed
                  {scorecard.plan.days_remaining !== null && scorecard.plan.days_remaining !== undefined
                    ? ` · ${scorecard.plan.days_remaining} days remaining`
                    : ""}
                </p>
              </div>
            </div>
          </Link>

          <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${refetching ? "opacity-60" : ""}`}>
            <StatTile
              label="Measures reported"
              value={`${n(scorecard.measurement.measured)} / ${n(scorecard.measurement.kpis)}`}
              meta={`${n(scorecard.measurement.unmeasured)} never reported`}
              alert={n(scorecard.measurement.unmeasured) > 0}
              href="/dashboard/strategy/kpis?unmeasured=1"
            />
            <StatTile
              label="Stale measures"
              value={n(scorecard.measurement.stale).toLocaleString()}
              alert={n(scorecard.measurement.stale) > 0}
              href="/dashboard/strategy/kpis?stale=1"
            />
            <StatTile
              label="Without initiative"
              value={withoutInitiativeCount.toLocaleString()}
              alert={withoutInitiativeCount > 0}
              href="/dashboard/strategy/initiatives"
            />
            <StatTile
              label="Perspectives"
              value={(scorecard.perspectives ?? []).length.toLocaleString()}
              href="/dashboard/strategy/reviews"
            />
          </div>

          {visiblePerspectives.length === 0 ? (
            <Panel title="No perspectives to show">
              <div className="space-y-3 text-center">
                <EmptyPanel
                  label={
                    filtersActive
                      ? "No perspectives match the current filters."
                      : "This plan has no perspectives yet."
                  }
                />
                {canManagePlans && !filtersActive ? (
                  <Button size="sm" onClick={() => openPerspectiveDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add first perspective
                  </Button>
                ) : null}
              </div>
            </Panel>
          ) : (
            visiblePerspectives.map((perspective: ScoredPerspective) => {
              const allScored = perspective.objectives ?? [];
              const roots = rootsForPerspective(allScored, objectiveMeta);
              const objectives = filterObjectives(roots, objectiveMeta, {
                search,
                band: bandFilter,
                sortWorstFirst,
                hideAchieved,
              });
              const perspectiveInfo =
                perspective.perspective_id != null
                  ? perspectiveMeta.get(perspective.perspective_id)
                  : null;
              const collapsed = collapsedPerspectives[perspective.code];

              return (
                <Panel
                  key={perspective.code}
                  title={perspective.name}
                  description={
                    [
                      `Weight ${n(perspective.weight)} · ${objectives.length} objective${objectives.length === 1 ? "" : "s"}`,
                      perspectiveInfo?.description,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  }
                  action={
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          setCollapsedPerspectives((c) => ({
                            ...c,
                            [perspective.code]: !c[perspective.code],
                          }))
                        }
                      >
                        {collapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      {canManagePlans && perspective.perspective_id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            const row = perspectiveMeta.get(perspective.perspective_id!);
                            if (row) openPerspectiveDialog(row);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      ) : null}
                      <div className="min-w-[8rem] text-right">
                        <span className="block text-lg font-black tabular-nums">
                          {perspective.score === null ? "—" : `${perspective.score.toFixed(1)}%`}
                        </span>
                        <Badge variant="outline" className={`border-transparent text-[10px] font-black uppercase ${BAND_TONE[perspective.status]}`}>
                          {perspective.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  }
                >
                  {!collapsed ? (
                    objectives.length === 0 ? (
                      <div className="space-y-3">
                        <EmptyPanel
                          label={
                            filtersActive && allScored.length > 0
                              ? "No objectives match the current filters."
                              : "No objectives under this perspective."
                          }
                        />
                        {canManageObjectives && !filtersActive ? (
                          <Button size="sm" variant="outline" onClick={() => openAddObjective(perspective.perspective_id)}>
                            <Plus className="mr-2 h-3.5 w-3.5" />
                            Add Objective
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {objectives.map((objective) => renderObjective(objective, 0, allScored))}
                      </div>
                    )
                  ) : null}
                </Panel>
              );
            })
          )}

          <Panel
            title="Dropped objectives"
            description="Archived objectives are excluded from the score roll-up."
            action={
              <Button size="sm" variant="outline" onClick={() => setShowDropped((v) => !v)}>
                {showDropped ? "Hide" : "Show"}
              </Button>
            }
          >
            {showDropped ? (
              droppedQuery.isLoading ? (
                <LoadingPanel label="Loading..." />
              ) : droppedObjectives.length === 0 ? (
                <EmptyPanel label="No dropped objectives." />
              ) : (
                <ul className="space-y-1 text-sm">
                  {droppedObjectives.map((row) => (
                    <li key={row.id} className="rounded border border-border/50 px-3 py-2">
                      {row.code} — {row.title}
                      {canManageObjectives ? (
                        <Button
                          size="sm"
                          variant="link"
                          className="ml-2 h-auto p-0 text-xs"
                          onClick={() => {
                            setEditingObjectiveId(row.id);
                            setForm({
                              perspective_id: row.perspective_id ? String(row.perspective_id) : "",
                              parent_id: row.parent_id ? String(row.parent_id) : "",
                              code: row.code,
                              title: row.title,
                              description: row.description ?? "",
                              owner_name: row.owner_name ?? "",
                              owner_employee_id: row.owner_employee_id ? String(row.owner_employee_id) : "",
                              department: row.department ?? "",
                              weight: String(n(row.weight)),
                              status: "active",
                            });
                            setObjectiveOpen(true);
                          }}
                        >
                          Reactivate
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-xs text-muted-foreground">Toggle to review archived objectives.</p>
            )}
          </Panel>
        </>
      )}

      {/* Objective dialog */}
      <Dialog
        open={objectiveOpen}
        onOpenChange={(open) => {
          setObjectiveOpen(open);
          if (!open) {
            setEditingObjectiveId(null);
            setForm(emptyObjectiveForm);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0">
          <DialogHeader className="border-b border-border/40 px-6 py-5">
            <DialogTitle>{editingObjectiveId ? "Edit Objective" : "Add Objective"}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Perspective</Label>
              <Select value={form.perspective_id || "unassigned"} onValueChange={(v) => setForm({ ...form, perspective_id: v === "unassigned" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {perspectives.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Parent objective</Label>
              <Select value={form.parent_id || "none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {parentOptions.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.code} — {o.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Weight</Label>
              <Input type="number" min={0} step="0.5" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            {hrEnabled ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>HR owner</Label>
                <Select value={form.owner_employee_id || "none"} onValueChange={(v) => {
                  const id = v === "none" ? "" : v;
                  const name = id ? employeeLabel(employeeById, Number(id)) : "";
                  setForm({ ...form, owner_employee_id: id, owner_name: name ?? form.owner_name });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(employeesQuery.data?.data ?? []).map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {employeeLabel(employeeById, emp.id) ?? `Employee #${emp.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Owner name</Label>
              <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            {editingObjectiveId ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ObjectiveStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBJECTIVE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setObjectiveOpen(false)}>Cancel</Button>
            <Button onClick={() => saveObjective.mutate()} disabled={saveObjective.isPending || !form.code.trim() || !form.title.trim()}>
              {saveObjective.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Perspective dialog */}
      <Dialog open={perspectiveOpen} onOpenChange={(open) => { setPerspectiveOpen(open); if (!open) setEditingPerspective(null); }}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0">
          <DialogHeader className="border-b border-border/40 px-6 py-5">
            <DialogTitle>{editingPerspective ? "Edit Perspective" : "Add Perspective"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={perspectiveForm.code} onChange={(e) => setPerspectiveForm({ ...perspectiveForm, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Weight</Label>
              <Input type="number" min={0} value={perspectiveForm.weight} onChange={(e) => setPerspectiveForm({ ...perspectiveForm, weight: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input type="number" min={0} value={perspectiveForm.sort_order} onChange={(e) => setPerspectiveForm({ ...perspectiveForm, sort_order: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input value={perspectiveForm.name} onChange={(e) => setPerspectiveForm({ ...perspectiveForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={perspectiveForm.description} onChange={(e) => setPerspectiveForm({ ...perspectiveForm, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setPerspectiveOpen(false)}>Cancel</Button>
            <Button onClick={() => savePerspective.mutate()} disabled={savePerspective.isPending || !perspectiveForm.code.trim() || !perspectiveForm.name.trim()}>
              {savePerspective.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      <Dialog open={detailObjectiveId !== null} onOpenChange={(open) => !open && setDetailObjectiveId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0">
          <DialogHeader className="border-b border-border/40 px-6 py-5">
            <DialogTitle>{detailObjective?.title ?? "Objective"}</DialogTitle>
            <DialogDescription>
              {detailObjective?.code}
              {detailObjective?.perspective?.name ? ` · ${detailObjective.perspective.name}` : ""}
              {detailScored?.score != null ? ` · ${detailScored.score.toFixed(1)}%` : ""}
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : detailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">Could not load objective details.</p>
              <Button size="sm" variant="outline" onClick={() => detailQuery.refetch()}>Retry</Button>
            </div>
          ) : detailObjective && detailScored ? (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5 text-sm">
              {detailObjective.description ? <p className="text-muted-foreground">{detailObjective.description}</p> : null}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Status</p>
                  <p className="capitalize">{detailObjective.status}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Owner</p>
                  <p>
                    {detailObjective.owner_employee_id
                      ? employeeLabel(employeeById, detailObjective.owner_employee_id) ??
                        detailObjective.owner_name ??
                        "—"
                      : detailObjective.owner_name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Department</p>
                  <p>{detailObjective.department ?? "—"}</p>
                </div>
              </div>
              {detailScored.kpis.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Measures</p>
                  {renderKpiTable(detailScored)}
                </div>
              ) : null}
              {(detailObjective.children ?? []).length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Child objectives</p>
                  <ul className="space-y-1">
                    {detailObjective.children!.map((child) => (
                      <li key={child.id}>
                        <button
                          type="button"
                          className="w-full rounded border border-border/50 px-3 py-1.5 text-left text-xs hover:bg-muted/40"
                          onClick={() => {
                            setDetailObjectiveId(null);
                            setFocusObjectiveId(String(child.id));
                          }}
                        >
                          {child.code} — {child.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {(detailObjective.initiatives ?? []).length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Initiatives</p>
                  <ul className="space-y-1">
                    {detailObjective.initiatives!.map((init) => (
                      <li key={init.id}>
                        <Link
                          href={`/dashboard/strategy/initiatives?initiative_id=${init.id}`}
                          className="flex items-center justify-between rounded border border-border/50 px-3 py-1.5 text-xs hover:bg-muted/40"
                        >
                          <span>{init.name}</span>
                          <span>{init.progress_percent}%</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex gap-2">
                {canManageObjectives ? (
                  <Button size="sm" variant="outline" onClick={() => { setDetailObjectiveId(null); openEditObjective(detailScored); }}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
