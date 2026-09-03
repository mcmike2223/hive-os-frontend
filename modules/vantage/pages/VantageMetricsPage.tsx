"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  Pencil,
  Plus,
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
import { vantageApi } from "@/modules/vantage/api";
import type {
  Aggregation,
  MetricEvaluation,
  VantageDataset,
  VantageMetric,
  VantageOverview,
} from "@/modules/vantage/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { RankedBarChart, TrendChart } from "@/modules/shared/charts/charts";
import { formatMetricValue, n, useDebouncedValue } from "@/modules/vantage/utils";

function changePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function targetGap(
  value: number | null,
  target: number | null,
  direction: string,
): number | null {
  if (value === null || target === null) return null;
  return direction === "lower_is_better" ? target - value : value - target;
}

function aggregationNeedsColumn(aggregation: string): boolean {
  return aggregation !== "count";
}

const emptyMetricForm = {
  dataset_id: "",
  code: "",
  name: "",
  description: "",
  aggregation: "count",
  measure_column: "",
  filters: "",
  unit: "",
  format: "number",
  direction: "higher_is_better",
  target_value: "",
  is_active: true,
};

function metricToForm(metric: VantageMetric) {
  return {
    dataset_id: String(metric.dataset_id),
    code: metric.code,
    name: metric.name,
    description: metric.description ?? "",
    aggregation: metric.aggregation,
    measure_column: metric.measure_column ?? "",
    filters: metric.filters ?? "",
    unit: metric.unit ?? "",
    format: metric.format,
    direction: metric.direction,
    target_value:
      metric.target_value === null || metric.target_value === undefined
        ? ""
        : String(n(metric.target_value)),
    is_active: metric.is_active !== false,
  };
}

const AGGREGATIONS: Aggregation[] = ["count", "count_distinct", "sum", "avg", "min", "max"];
const FORMATS = ["number", "currency", "percent", "duration"] as const;
const RANGE_OPTIONS = [30, 90, 180, 365] as const;

export default function VantageMetricsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canManage = hasAnyPermission(["manage_vantage_metrics", "manage_vantage"]);

  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [datasetFilter, setDatasetFilter] = React.useState(searchParams.get("dataset_id") ?? "");
  const [aggregationFilter, setAggregationFilter] = React.useState(searchParams.get("aggregation") ?? "");
  const [showInactive, setShowInactive] = React.useState(searchParams.get("show_inactive") === "1");
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));
  const [focusMetricId, setFocusMetricId] = React.useState(searchParams.get("metric_id") ?? "");

  const shouldOpenAdd = searchParams.get("add") === "1";

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingMetric, setEditingMetric] = React.useState<VantageMetric | null>(null);
  const [inspecting, setInspecting] = React.useState<VantageMetric | null>(null);
  const [breakdown, setBreakdown] = React.useState("");
  const [rangeDays, setRangeDays] = React.useState(365);

  const [form, setForm] = React.useState({ ...emptyMetricForm });

  const rowRefs = React.useRef<Record<number, HTMLTableRowElement | null>>({});
  const deepLinkHandled = React.useRef(false);

  const overviewQuery = useQuery({
    queryKey: ["vantage", "overview-metrics"],
    queryFn: () => vantageApi.overview().then((res) => res.data),
  });

  const overview: VantageOverview | undefined = overviewQuery.data?.data;

  const metricsQuery = useQuery({
    queryKey: [
      "vantage",
      "metrics",
      debouncedSearch,
      datasetFilter,
      aggregationFilter,
      showInactive,
      page,
    ],
    queryFn: () =>
      vantageApi
        .listMetrics({
          page,
          limit: 50,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(datasetFilter ? { dataset_id: Number(datasetFilter) } : {}),
          ...(aggregationFilter ? { aggregation: aggregationFilter } : {}),
          ...(!showInactive ? { active_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const datasetsQuery = useQuery({
    queryKey: ["vantage", "datasets"],
    queryFn: () => vantageApi.listDatasets({ limit: 100 }).then((res) => res.data),
  });

  const evaluationQuery = useQuery({
    queryKey: ["vantage", "evaluate", inspecting?.id, breakdown, rangeDays],
    queryFn: () =>
      vantageApi
        .evaluateMetric(inspecting!.id, {
          range_days: rangeDays,
          ...(breakdown ? { breakdown } : {}),
        })
        .then((res) => res.data),
    enabled: inspecting !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["vantage"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (datasetFilter) params.set("dataset_id", datasetFilter);
    if (aggregationFilter) params.set("aggregation", aggregationFilter);
    if (showInactive) params.set("show_inactive", "1");
    if (focusMetricId) params.set("metric_id", focusMetricId);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    aggregationFilter,
    datasetFilter,
    focusMetricId,
    page,
    pathname,
    router,
    searchInput,
    showInactive,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, datasetFilter, aggregationFilter, showInactive]);

  const saveMetric = useMutation({
    mutationFn: () => {
      const payload = {
        dataset_id: Number(form.dataset_id),
        code: form.code,
        name: form.name,
        description: form.description || null,
        aggregation: form.aggregation,
        measure_column: form.measure_column || null,
        filters: form.filters || null,
        unit: form.unit || null,
        format: form.format,
        direction: form.direction,
        ...(form.target_value ? { target_value: Number(form.target_value) } : { target_value: null }),
        is_active: form.is_active,
      };
      return editingMetric
        ? vantageApi.updateMetric(editingMetric.id, payload)
        : vantageApi.createMetric(payload);
    },
    onSuccess: () => {
      toast.success(
        t(
          editingMetric ? "vantage.metrics.updated" : "vantage.metrics.saved",
          editingMetric ? "Metric updated." : "Metric defined.",
        ),
      );
      invalidate();
      setFormOpen(false);
      setEditingMetric(null);
      setForm({ ...emptyMetricForm });
    },
    onError: (error: any) =>
      toast.error(
        errorText(
          error,
          t(
            editingMetric ? "vantage.metrics.update_failed" : "vantage.metrics.save_failed",
            "Could not save it.",
          ),
        ),
      ),
  });

  const metrics = (metricsQuery.data?.data ?? []) as VantageMetric[];
  const meta = metricsQuery.data?.meta;
  const datasets = (datasetsQuery.data?.data ?? []) as VantageDataset[];
  const evaluation: MetricEvaluation | undefined = evaluationQuery.data?.data;
  const refetching = metricsQuery.isFetching && !metricsQuery.isLoading;

  const selectedDataset = datasets.find((dataset) => String(dataset.id) === form.dataset_id);
  const needsColumn = aggregationNeedsColumn(form.aggregation);

  const datasetById = React.useMemo(() => {
    const map = new Map<number, VantageDataset>();
    for (const row of datasets) map.set(row.id, row);
    return map;
  }, [datasets]);

  const openCreate = React.useCallback(() => {
    setEditingMetric(null);
    setForm({
      ...emptyMetricForm,
      dataset_id: datasetFilter,
    });
    setFormOpen(true);
  }, [datasetFilter]);

  const openEdit = React.useCallback((metric: VantageMetric) => {
    setEditingMetric(metric);
    setForm(metricToForm(metric));
    setFormOpen(true);
  }, []);

  const openInspect = React.useCallback((metric: VantageMetric) => {
    setInspecting(metric);
    setBreakdown("");
    setRangeDays(365);
  }, []);

  const clearFilters = () => {
    setSearchInput("");
    setDatasetFilter("");
    setAggregationFilter("");
    setShowInactive(false);
    setFocusMetricId("");
  };

  const filtersActive = Boolean(
    searchInput.trim() || datasetFilter || aggregationFilter || showInactive,
  );

  React.useEffect(() => {
    if (shouldOpenAdd && canManage) openCreate();
  }, [shouldOpenAdd, canManage, openCreate]);

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [focusMetricId]);

  React.useEffect(() => {
    if (!focusMetricId || metrics.length === 0 || deepLinkHandled.current) return;
    const metric = metrics.find((row) => String(row.id) === focusMetricId);
    if (!metric) return;
    deepLinkHandled.current = true;
    const row = rowRefs.current[metric.id];
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    openInspect(metric);
  }, [focusMetricId, metrics, openInspect]);

  const inspectFormat = inspecting?.format ?? "number";
  const inspectUnit = inspecting?.unit ?? null;
  const inspectDirection = inspecting?.direction ?? "higher_is_better";
  const inspectTarget =
    evaluation?.metric?.target ??
    (inspecting?.target_value !== null && inspecting?.target_value !== undefined
      ? n(inspecting.target_value)
      : null);

  const delta = evaluation?.available
    ? changePercent(evaluation.value, evaluation.previous_value)
    : null;

  const gap = evaluation?.available ? targetGap(evaluation.value, inspectTarget, inspectDirection) : null;

  const trendPoints = React.useMemo(() => {
    if (!evaluation?.series?.points?.length) return [];
    return evaluation.series.points.map((point) => ({
      date: point.label,
      live: point.value ?? 0,
      reported:
        evaluation.reported?.find((row) => row.label === point.label)?.value ?? 0,
    }));
  }, [evaluation?.series?.points, evaluation?.reported]);

  return (
    <div className="space-y-6 print:space-y-4">
      <Breadcrumbs
        items={[
          { label: t("vantage.overview.title", "Vantage"), href: "/dashboard/vantage" },
          { label: t("vantage.metrics.title", "Metrics") },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("vantage.metrics.title", "Metrics")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "vantage.metrics.subtitle",
              "A metric names a dataset, an aggregation from a fixed list, and a column that dataset allows. Nothing else ever reaches the query.",
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href="/dashboard/vantage">Overview</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href="/dashboard/vantage/sources">Data Sources</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href="/dashboard/vantage/alerts">Alerts</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              metricsQuery.refetch();
              datasetsQuery.refetch();
              overviewQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            {t("vantage.common.refresh", "Refresh")}
          </Button>
          {canManage ? (
            <Button className="rounded-full px-5" onClick={openCreate} disabled={datasets.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              {t("vantage.metrics.add", "Define Metric")}
            </Button>
          ) : null}
        </div>
      </div>

      {overview?.coverage ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <StatTile
            label={t("vantage.overview.metrics", "Metrics defined")}
            value={n(overview.coverage.metrics).toLocaleString()}
          />
          <StatTile
            label={t("vantage.overview.sources", "Sources readable")}
            value={`${n(overview.coverage.available)} / ${n(overview.coverage.datasets)}`}
            meta={t("vantage.overview.sources_meta", "{n} need a module you do not have").replace(
              "{n}",
              String(n(overview.coverage.unavailable)),
            )}
            alert={n(overview.coverage.unavailable) > 0}
            href="/dashboard/vantage/sources"
          />
          <Link
            href={
              datasetFilter
                ? `/dashboard/vantage/metrics?dataset_id=${datasetFilter}`
                : "/dashboard/vantage/metrics"
            }
            className="block"
          >
            <StatTile
              label={t("vantage.metrics.on_page", "On this page")}
              value={String(meta?.total ?? metrics.length)}
            />
          </Link>
          <StatTile
            label={t("vantage.overview.alerts_triggered", "Alerts breached")}
            value={n(overview.alerts?.triggered).toLocaleString()}
            href="/dashboard/vantage/alerts"
            alert={n(overview.alerts?.triggered) > 0}
          />
        </div>
      ) : null}

      {datasets.length === 0 && !datasetsQuery.isLoading ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm print:hidden">
          {t("vantage.metrics.no_sources", "Register data sources before defining metrics.")}{" "}
          <Link href="/dashboard/vantage/sources" className="font-semibold underline">
            {t("vantage.sources.title", "Data Sources")}
          </Link>
        </div>
      ) : null}

      {focusMetricId ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm print:hidden">
          <span>
            {t("vantage.metrics.focused", "Focused on")}{" "}
            <strong>
              {metrics.find((row) => String(row.id) === focusMetricId)?.name ?? `#${focusMetricId}`}
            </strong>
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setFocusMetricId("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("vantage.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      {datasetFilter ? (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-sm print:hidden">
          <span>
            {t("vantage.metrics.filtered_source", "Filtered to source")}{" "}
            <strong>{datasetById.get(Number(datasetFilter))?.name ?? `#${datasetFilter}`}</strong>
          </span>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="ghost" className="h-7">
              <Link href="/dashboard/vantage/sources">
                <Database className="mr-1 h-3.5 w-3.5" />
                {t("vantage.sources.title", "Data Sources")}
              </Link>
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setDatasetFilter("")}>
              <X className="mr-1 h-3.5 w-3.5" />
              {t("vantage.common.clear", "Clear")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="m-search" className="text-xs">
            {t("vantage.common.search", "Search")}
          </Label>
          <Input
            id="m-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("vantage.metrics.search_hint", "Code or name")}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("vantage.metrics.source", "Source")}</Label>
          <Select
            value={datasetFilter || "any"}
            onValueChange={(v) => setDatasetFilter(v === "any" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("vantage.common.any", "Any")}</SelectItem>
              {datasets.map((dataset) => (
                <SelectItem key={dataset.id} value={String(dataset.id)}>
                  {dataset.name}
                  {dataset.is_available === false ? " (not installed)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("vantage.metrics.aggregation", "Aggregation")}</Label>
          <Select
            value={aggregationFilter || "any"}
            onValueChange={(v) => setAggregationFilter(v === "any" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("vantage.common.any", "Any")}</SelectItem>
              {AGGREGATIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4"
          />
          {t("vantage.metrics.show_inactive", "show retired")}
        </label>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            {t("vantage.common.clear_filters", "Clear filters")}
          </Button>
        ) : null}
      </div>

      <Panel
        title={t("vantage.metrics.register", "Defined metrics")}
        description={t(
          "vantage.metrics.register_desc",
          "A metric over a source you do not have is kept and reported as unavailable rather than deleted — subscribe and it starts working.",
        )}
      >
        {metricsQuery.isLoading ? (
          <LoadingPanel label={t("vantage.common.loading", "Loading metrics...")} />
        ) : metricsQuery.isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("vantage.metrics.load_failed", "Could not load metrics.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => metricsQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("vantage.common.retry", "Retry")}
            </Button>
          </div>
        ) : metrics.length === 0 ? (
          <EmptyPanel label={t("vantage.metrics.none", "No metrics defined yet.")} />
        ) : (
          <div className={`space-y-3 transition-opacity ${refetching ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-semibold">{t("vantage.metrics.metric", "Metric")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("vantage.metrics.source", "Source")}</th>
                    <th className="pb-2 pr-3 font-semibold">
                      {t("vantage.metrics.definition", "Definition")}
                    </th>
                    <th className="pb-2 pr-3 font-semibold">{t("vantage.metrics.filters", "Filters")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("vantage.metrics.target", "Target")}</th>
                    <th className="pb-2 pr-6 text-right font-semibold">
                      {t("vantage.common.actions", "Actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric) => {
                    const focused = focusMetricId === String(metric.id);
                    const unavailable = metric.dataset?.is_available === false;
                    return (
                      <tr
                        key={metric.id}
                        ref={(el) => {
                          rowRefs.current[metric.id] = el;
                        }}
                        className={`border-b border-border/40 last:border-0 ${
                          focused ? "bg-primary/5" : ""
                        } ${!metric.is_active ? "opacity-60" : ""}`}
                      >
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => {
                              setFocusMetricId(String(metric.id));
                              openInspect(metric);
                            }}
                          >
                            <span className="block font-medium">{metric.name}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {metric.code}
                              {metric.unit ? ` · ${metric.unit}` : ""}
                              {metric.format !== "number" ? ` · ${metric.format}` : ""}
                              {!metric.is_active ? (
                                <span className="ml-1.5 font-semibold">
                                  {t("vantage.metrics.retired", "retired")}
                                </span>
                              ) : null}
                              {metric.direction === "lower_is_better"
                                ? ` · ${t("vantage.metrics.lower", "lower is better")}`
                                : ""}
                            </span>
                          </button>
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {metric.dataset ? (
                            <Link
                              href={`/dashboard/vantage/metrics?dataset_id=${metric.dataset_id}`}
                              className="hover:underline"
                            >
                              {metric.dataset.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {unavailable ? (
                            <span className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              {t("vantage.metrics.unavailable", "needs {n}").replace(
                                "{n}",
                                metric.dataset?.module_slug ?? "another module",
                              )}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums text-muted-foreground">
                          {metric.aggregation}
                          {metric.measure_column ? `(${metric.measure_column})` : "(*)"}
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {metric.filters ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-xs tabular-nums">
                          {metric.target_value === null || metric.target_value === undefined
                            ? "—"
                            : formatMetricValue(n(metric.target_value), metric.format, metric.unit)}
                        </td>
                        <td className="py-2 pr-6 text-right">
                          <div className="flex justify-end gap-1">
                            {canManage ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => openEdit(metric)}
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                {t("vantage.common.edit", "Edit")}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => openInspect(metric)}
                            >
                              {t("vantage.metrics.inspect", "Evaluate")}
                            </Button>
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
                  {t("vantage.common.page_of", "Page {current} of {last} · {total} total")
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

      {/* Create / edit */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingMetric(null);
            setForm({ ...emptyMetricForm });
          }
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingMetric
                  ? t("vantage.metrics.edit", "Edit Metric")
                  : t("vantage.metrics.add", "Define Metric")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "vantage.metrics.add_desc",
                  "Only the columns a dataset declares can be aggregated or filtered on. A definition that could never be evaluated is refused here rather than showing up as a broken widget later.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("vantage.metrics.source", "Source")}</Label>
              <Select
                value={form.dataset_id || "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    dataset_id: v === "none" ? "" : v,
                    measure_column: "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("vantage.common.select", "Select...")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("vantage.common.select", "Select...")}</SelectItem>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={String(dataset.id)}>
                      {dataset.name}
                      {dataset.is_available === false ? " (not installed)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-code">{t("vantage.common.code", "Code")}</Label>
              <Input
                id="nm-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-name">{t("vantage.common.name", "Name")}</Label>
              <Input
                id="nm-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nm-desc">{t("vantage.common.description", "Description")}</Label>
              <Textarea
                id="nm-desc"
                rows={2}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("vantage.metrics.aggregation", "Aggregation")}</Label>
              <Select
                value={form.aggregation}
                onValueChange={(v) => setForm({ ...form, aggregation: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("vantage.metrics.column", "Column")}</Label>
              <Select
                value={form.measure_column || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, measure_column: v === "none" ? "" : v })
                }
                disabled={!needsColumn || !selectedDataset}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      needsColumn
                        ? t("vantage.common.select", "Select...")
                        : t("vantage.metrics.not_needed", "Not needed for a count")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {needsColumn
                      ? t("vantage.common.select", "Select...")
                      : t("vantage.metrics.not_needed", "Not needed for a count")}
                  </SelectItem>
                  {(selectedDataset?.measures ?? []).map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nm-filters">{t("vantage.metrics.filters", "Filters")}</Label>
              <Input
                id="nm-filters"
                value={form.filters}
                onChange={(event) => setForm({ ...form, filters: event.target.value })}
                placeholder="status=confirmed, region=North"
              />
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "vantage.metrics.filters_hint",
                  "Equality only, as column=value pairs. Values are always bound, never pasted into the query.",
                )}
                {selectedDataset
                  ? ` ${t("vantage.metrics.filterable", "Filterable here: {n}").replace(
                      "{n}",
                      [...(selectedDataset.dimensions ?? []), ...(selectedDataset.measures ?? [])].join(
                        ", ",
                      ),
                    )}`
                  : ""}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("vantage.metrics.format", "Format")}</Label>
              <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("vantage.metrics.direction", "Direction")}</Label>
              <Select
                value={form.direction}
                onValueChange={(v) => setForm({ ...form, direction: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="higher_is_better">
                    {t("vantage.metrics.higher", "Higher is better")}
                  </SelectItem>
                  <SelectItem value="lower_is_better">
                    {t("vantage.metrics.lower_full", "Lower is better")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-unit">{t("vantage.metrics.unit", "Unit")}</Label>
              <Input
                id="nm-unit"
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-target">{t("vantage.metrics.target", "Target")}</Label>
              <Input
                id="nm-target"
                type="number"
                step="any"
                value={form.target_value}
                onChange={(event) => setForm({ ...form, target_value: event.target.value })}
              />
            </div>
            {editingMetric ? (
              <label className="flex items-center gap-2 sm:col-span-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                {t("vantage.metrics.active", "Metric is active (uncheck to retire)")}
              </label>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("vantage.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveMetric.mutate()}
              disabled={
                saveMetric.isPending ||
                !form.dataset_id ||
                !form.code.trim() ||
                !form.name.trim() ||
                (needsColumn && !form.measure_column)
              }
            >
              {saveMetric.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("vantage.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluate */}
      <Dialog
        open={inspecting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInspecting(null);
            setBreakdown("");
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {inspecting?.name ?? ""}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "vantage.metrics.evaluate_desc",
                  "Evaluated over the selected window, with live series beside reported snapshots.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("vantage.metrics.window", "Window")}</Label>
                <Select
                  value={String(rangeDays)}
                  onValueChange={(v) => setRangeDays(Number(v))}
                >
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANGE_OPTIONS.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {t("vantage.metrics.last_days", "Last {n} days").replace("{n}", String(days))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(inspecting?.dataset?.dimensions ?? []).length > 0 ? (
                <div className="space-y-1">
                  <Label className="text-xs">{t("vantage.metrics.breakdown", "Break down by")}</Label>
                  <Select value={breakdown || "none"} onValueChange={(v) => setBreakdown(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t("vantage.metrics.no_breakdown", "No breakdown")}
                      </SelectItem>
                      {(inspecting?.dataset?.dimensions ?? []).map((column) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {evaluationQuery.isLoading ? (
              <LoadingPanel label={t("vantage.common.loading", "Evaluating...")} />
            ) : evaluationQuery.isError ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("vantage.metrics.evaluate_failed", "Could not evaluate this metric.")}
                </p>
                <Button variant="outline" size="sm" onClick={() => evaluationQuery.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("vantage.common.retry", "Retry")}
                </Button>
              </div>
            ) : !evaluation ? (
              <EmptyPanel label={t("vantage.metrics.no_result", "Nothing to show.")} />
            ) : !evaluation.available ? (
              <EmptyPanel label={evaluation.reason ?? "Source not available."} />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    label={t("vantage.metrics.value", "Value")}
                    value={formatMetricValue(evaluation.value, inspectFormat, inspectUnit)}
                  />
                  <StatTile
                    label={t("vantage.metrics.previous", "Previous period")}
                    value={formatMetricValue(evaluation.previous_value, inspectFormat, inspectUnit)}
                    meta={
                      delta === null
                        ? undefined
                        : t("vantage.metrics.change", "{n}% vs prior").replace(
                            "{n}",
                            `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`,
                          )
                    }
                    alert={delta !== null && delta < 0 && inspectDirection === "higher_is_better"}
                  />
                  <StatTile
                    label={t("vantage.metrics.rows", "Rows matched")}
                    value={n(evaluation.matched_rows).toLocaleString()}
                  />
                  {inspectTarget !== null ? (
                    <StatTile
                      label={t("vantage.metrics.vs_target", "Vs target")}
                      value={
                        gap === null
                          ? "—"
                          : formatMetricValue(gap, inspectFormat, inspectUnit)
                      }
                      meta={formatMetricValue(inspectTarget, inspectFormat, inspectUnit)}
                      alert={gap !== null && gap < 0}
                    />
                  ) : null}
                </div>

                {evaluation.series?.available && trendPoints.length > 1 ? (
                  <TrendChart
                    title={t("vantage.metrics.trend", "Live vs reported")}
                    description={t(
                      "vantage.metrics.trend_desc",
                      "Live series from the evaluator; reported points from month-end snapshots.",
                    )}
                    points={trendPoints}
                    series={[
                      { key: "live", label: t("vantage.metrics.live", "Live") },
                      { key: "reported", label: t("vantage.metrics.reported", "Reported") },
                    ]}
                    emptyLabel={t("vantage.overview.no_rows", "Nothing in this window.")}
                    maxValue={inspectFormat === "percent" ? 100 : undefined}
                  />
                ) : evaluation.series && !evaluation.series.available ? (
                  <EmptyPanel label={evaluation.series.reason ?? ""} />
                ) : null}

                {(evaluation.reported ?? []).length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("vantage.metrics.reported_history", "Reported snapshots")}
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="pb-2 pr-3">{t("vantage.metrics.period", "Period")}</th>
                          <th className="pb-2 pr-3">{t("vantage.metrics.value", "Value")}</th>
                          <th className="pb-2">{t("vantage.metrics.captured", "Captured")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluation.reported.map((row) => (
                          <tr key={`${row.label}-${row.captured_on}`} className="border-t border-border/40">
                            <td className="py-2 pr-3">{row.label}</td>
                            <td className="py-2 pr-3 tabular-nums">
                              {formatMetricValue(row.value, inspectFormat, inspectUnit)}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {row.captured_on ? String(row.captured_on).slice(0, 10) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {evaluation.breakdown?.available ? (
                  <RankedBarChart
                    title={t("vantage.metrics.by", "By {n}").replace("{n}", breakdown)}
                    rows={evaluation.breakdown.rows.map((row) => ({
                      key: row.label,
                      label: row.label,
                      value: row.value,
                    }))}
                    valueLabel={inspecting?.name ?? ""}
                    emptyLabel={t("vantage.overview.no_rows", "Nothing in this window.")}
                  />
                ) : evaluation.breakdown ? (
                  <EmptyPanel label={evaluation.breakdown.reason ?? ""} />
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            {inspecting && canManage ? (
              <Button asChild variant="outline" className="mr-auto">
                <Link href={`/dashboard/vantage/alerts?metric_id=${inspecting.id}&add=1`}>
                  <BellRing className="mr-2 h-4 w-4" />
                  {t("vantage.metrics.create_alert", "Create alert")}
                </Link>
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setInspecting(null)}>
              {t("vantage.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
