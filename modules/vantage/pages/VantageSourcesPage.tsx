"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  RefreshCw,
  Sigma,
  X,
} from "lucide-react";
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
import { vantageApi } from "@/modules/vantage/api";
import type { VantageDataset, VantageOverview } from "@/modules/vantage/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { n, useDebouncedValue } from "@/modules/vantage/utils";

type SourceAvailability = "all" | "readable" | "missing";

type SourceSort = "name" | "module" | "metrics_desc";

function canTrend(dataset: VantageDataset): boolean {
  return Boolean(dataset.date_column?.trim());
}

function filterDatasets(
  rows: VantageDataset[],
  opts: {
    search: string;
    availability: SourceAvailability;
    sort: SourceSort;
  },
): VantageDataset[] {
  let list = [...rows];

  if (opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    list = list.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        row.source_table.toLowerCase().includes(q) ||
        (row.module_slug ?? "").toLowerCase().includes(q) ||
        (row.description ?? "").toLowerCase().includes(q),
    );
  }

  if (opts.availability === "readable") {
    list = list.filter((row) => row.is_available);
  } else if (opts.availability === "missing") {
    list = list.filter((row) => !row.is_available);
  }

  if (opts.sort === "module") {
    list.sort((a, b) =>
      (a.module_slug ?? "").localeCompare(b.module_slug ?? "") || a.name.localeCompare(b.name),
    );
  } else if (opts.sort === "metrics_desc") {
    list.sort((a, b) => n(b.metrics_count) - n(a.metrics_count) || a.name.localeCompare(b.name));
  } else {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return list;
}

function hasActiveSourceFilters(opts: {
  search: string;
  moduleSlug: string;
  availability: SourceAvailability;
  showInactive: boolean;
  sort: SourceSort;
}): boolean {
  return Boolean(
    opts.search.trim() ||
      opts.moduleSlug ||
      opts.availability !== "all" ||
      opts.showInactive ||
      opts.sort !== "name",
  );
}

function uniqueModules(datasets: VantageDataset[]): string[] {
  return [...new Set(datasets.map((row) => row.module_slug).filter(Boolean) as string[])].sort();
}

export default function VantageSourcesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canManage = hasAnyPermission(["manage_vantage_metrics", "manage_vantage"]);

  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [moduleFilter, setModuleFilter] = React.useState(searchParams.get("module") ?? "");
  const [availability, setAvailability] = React.useState<SourceAvailability>(
    searchParams.get("missing") === "1"
      ? "missing"
      : searchParams.get("readable") === "1"
        ? "readable"
        : "all",
  );
  const [showInactive, setShowInactive] = React.useState(searchParams.get("show_inactive") === "1");
  const [sort, setSort] = React.useState<SourceSort>(
    (searchParams.get("sort") as SourceSort) || "name",
  );
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));
  const [focusDatasetId, setFocusDatasetId] = React.useState(searchParams.get("dataset_id") ?? "");

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const [detailDataset, setDetailDataset] = React.useState<VantageDataset | null>(null);
  const rowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});

  const overviewQuery = useQuery({
    queryKey: ["vantage", "overview-sources"],
    queryFn: () => vantageApi.overview().then((res) => res.data),
  });

  const datasetsQuery = useQuery({
    queryKey: ["vantage", "datasets", moduleFilter, showInactive, page],
    queryFn: () =>
      vantageApi
        .listDatasets({
          page,
          limit: 50,
          ...(moduleFilter ? { module_slug: moduleFilter } : {}),
          ...(!showInactive ? { active_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const overview: VantageOverview | undefined = overviewQuery.data?.data;
  const datasets = (datasetsQuery.data?.data ?? []) as VantageDataset[];
  const meta = datasetsQuery.data?.meta;
  const refetching = datasetsQuery.isFetching && !datasetsQuery.isLoading;

  const visibleDatasets = React.useMemo(
    () => filterDatasets(datasets, { search: debouncedSearch, availability, sort }),
    [availability, datasets, debouncedSearch, sort],
  );

  const modules = React.useMemo(() => {
    const fromOverview = (overview?.coverage?.sources ?? [])
      .map((row) => row.module_slug)
      .filter(Boolean) as string[];
    if (fromOverview.length > 0) {
      return [...new Set(fromOverview)].sort();
    }
    return uniqueModules(datasets);
  }, [overview?.coverage?.sources, datasets]);

  const filtersActive = hasActiveSourceFilters({
    search: searchInput,
    moduleSlug: moduleFilter,
    availability,
    showInactive,
    sort,
  });

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (moduleFilter) params.set("module", moduleFilter);
    if (availability === "readable") params.set("readable", "1");
    if (availability === "missing") params.set("missing", "1");
    if (showInactive) params.set("show_inactive", "1");
    if (sort !== "name") params.set("sort", sort);
    if (focusDatasetId) params.set("dataset_id", focusDatasetId);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    availability,
    focusDatasetId,
    moduleFilter,
    page,
    pathname,
    router,
    searchInput,
    showInactive,
    sort,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [moduleFilter, showInactive, debouncedSearch, availability]);

  React.useEffect(() => {
    if (!focusDatasetId || datasets.length === 0) return;
    const row = datasets.find((item) => String(item.id) === focusDatasetId);
    if (!row) return;
    const el = rowRefs.current[row.id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setDetailDataset(row);
  }, [focusDatasetId, datasets]);

  const clearFilters = () => {
    setSearchInput("");
    setModuleFilter("");
    setAvailability("all");
    setShowInactive(false);
    setSort("name");
    setFocusDatasetId("");
  };

  const readableCount = datasets.filter((row) => row.is_available).length;
  const missingCount = datasets.length - readableCount;

  return (
    <div className="space-y-6 print:space-y-4">
      <Breadcrumbs
        items={[
          { label: t("vantage.overview.title", "Vantage"), href: "/dashboard/vantage" },
          { label: t("vantage.sources.title", "Data Sources") },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("vantage.sources.title", "Data Sources")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "vantage.sources.subtitle",
              "Every table Vantage is allowed to read, and exactly which of their columns may be aggregated or grouped by. The column lists are an allowlist, not documentation — nothing outside them can ever reach a query.",
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href="/dashboard/vantage">Overview</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href="/dashboard/vantage/metrics">Metrics</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-xs">
              <Link href="/dashboard/vantage/alerts">Alerts</Link>
            </Button>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => {
            datasetsQuery.refetch();
            overviewQuery.refetch();
          }}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
          {t("vantage.common.refresh", "Refresh")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <StatTile
          label={t("vantage.sources.total", "Registered sources")}
          value={(meta?.total ?? datasets.length).toLocaleString()}
          href="/dashboard/vantage/sources"
        />
        <Link href="/dashboard/vantage/sources?readable=1" className="block">
          <StatTile
            label={t("vantage.sources.readable", "Readable now")}
            value={n(overview?.coverage?.available ?? readableCount).toLocaleString()}
          />
        </Link>
        <Link href="/dashboard/vantage/sources?missing=1" className="block">
          <StatTile
            label={t("vantage.sources.missing", "Needing a module")}
            value={n(overview?.coverage?.unavailable ?? missingCount).toLocaleString()}
            meta={t("vantage.sources.missing_meta", "reported as unavailable, never as zero")}
            alert={n(overview?.coverage?.unavailable ?? missingCount) > 0}
          />
        </Link>
        <Link href="/dashboard/vantage/metrics" className="block">
          <StatTile
            label={t("vantage.overview.metrics", "Metrics defined")}
            value={n(overview?.coverage?.metrics).toLocaleString()}
          />
        </Link>
      </div>

      {focusDatasetId ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm print:hidden">
          <span>
            {t("vantage.sources.focused", "Focused on source")}{" "}
            <strong>
              {datasets.find((row) => String(row.id) === focusDatasetId)?.name ??
                `#${focusDatasetId}`}
            </strong>
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setFocusDatasetId("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("vantage.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="s-search" className="text-xs">
            {t("vantage.common.search", "Search")}
          </Label>
          <Input
            id="s-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("vantage.sources.search_hint", "Name, table, or module")}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("vantage.sources.module", "Module")}</Label>
          <Select
            value={moduleFilter || "any"}
            onValueChange={(v) => setModuleFilter(v === "any" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("vantage.common.any", "Any")}</SelectItem>
              {modules.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("vantage.sources.availability", "Availability")}</Label>
          <Select
            value={availability}
            onValueChange={(v) => setAvailability(v as SourceAvailability)}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("vantage.common.any", "Any")}</SelectItem>
              <SelectItem value="readable">{t("vantage.overview.readable", "Readable")}</SelectItem>
              <SelectItem value="missing">
                {t("vantage.overview.not_installed", "Not installed")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("vantage.common.sort", "Sort")}</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SourceSort)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{t("vantage.common.name", "Name")}</SelectItem>
              <SelectItem value="module">{t("vantage.sources.module", "Module")}</SelectItem>
              <SelectItem value="metrics_desc">
                {t("vantage.sources.sort_metrics", "Most metrics")}
              </SelectItem>
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
          {t("vantage.sources.show_inactive", "show retired")}
        </label>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            {t("vantage.common.clear_filters", "Clear filters")}
          </Button>
        ) : null}
      </div>

      {filtersActive && datasets.length > 0 && visibleDatasets.length === 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm print:hidden">
          <span>{t("vantage.sources.no_match", "No sources match those filters on this page.")}</span>
          <Button size="sm" variant="ghost" className="h-7" onClick={clearFilters}>
            {t("vantage.common.clear_filters", "Clear filters")}
          </Button>
        </div>
      ) : null}

      {(availability !== "all" || debouncedSearch.trim()) && datasets.length > 0 ? (
        <p className="text-xs text-muted-foreground print:hidden">
          {t(
            "vantage.sources.filter_page_note",
            "Search and availability filters run on the current API page — use module filter server-side or clear search to see more.",
          )}
        </p>
      ) : null}

      <Panel
        title={t("vantage.sources.registry", "Registry")}
        description={t(
          "vantage.sources.registry_desc",
          "Availability is re-checked against the live schema on every read, so subscribing to a module makes its source usable immediately.",
        )}
      >
        {datasetsQuery.isLoading ? (
          <LoadingPanel label={t("vantage.common.loading", "Loading sources...")} />
        ) : datasetsQuery.isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("vantage.sources.load_failed", "Could not load sources.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => datasetsQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("vantage.common.retry", "Retry")}
            </Button>
          </div>
        ) : visibleDatasets.length === 0 ? (
          <EmptyPanel label={t("vantage.sources.none", "No sources registered.")} />
        ) : (
          <div className={`space-y-2 transition-opacity ${refetching ? "opacity-60" : ""}`}>
            {visibleDatasets.map((dataset) => {
              const focused = focusDatasetId === String(dataset.id);
              const measureCount = (dataset.measures ?? []).length;
              const dimensionCount = (dataset.dimensions ?? []).length;
              return (
                <div
                  key={dataset.id}
                  ref={(el) => {
                    rowRefs.current[dataset.id] = el;
                  }}
                  className={`rounded-lg border px-3 py-2.5 transition-colors ${
                    focused
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/50 hover:border-border"
                  } ${!dataset.is_active ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => {
                        setFocusDatasetId(String(dataset.id));
                        setDetailDataset(dataset);
                      }}
                    >
                      <span className="block font-medium hover:underline">{dataset.name}</span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {dataset.code} · {dataset.source_table}
                        {dataset.module_slug ? ` · ${dataset.module_slug}` : ""}
                        {!dataset.is_active ? (
                          <span className="ml-1.5 font-semibold">
                            {t("vantage.sources.retired", "retired")}
                          </span>
                        ) : null}
                      </span>
                      {dataset.description ? (
                        <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
                          {dataset.description}
                        </span>
                      ) : null}
                    </button>
                    <span className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${
                          dataset.is_available
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {dataset.is_available
                          ? t("vantage.overview.readable", "Readable")
                          : t("vantage.overview.not_installed", "Not installed")}
                      </Badge>
                      <div className="mt-1 flex flex-col items-end gap-0.5">
                        <Link
                          href={`/dashboard/vantage/metrics?dataset_id=${dataset.id}`}
                          className="text-[11px] tabular-nums text-muted-foreground hover:underline"
                        >
                          {t("vantage.overview.metric_count", "{n} metrics").replace(
                            "{n}",
                            String(n(dataset.metrics_count)),
                          )}
                        </Link>
                        {canTrend(dataset) ? (
                          <span className="text-[10px] text-muted-foreground">
                            {t("vantage.sources.trendable", "trendable")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            {t("vantage.sources.no_trend", "no date column")}
                          </span>
                        )}
                      </div>
                    </span>
                  </div>

                  <div className="mt-2 grid gap-2 border-t border-border/30 pt-2 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {t("vantage.sources.measures", "Measurable")} ({measureCount})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {measureCount === 0
                          ? t("vantage.sources.none_declared", "none declared")
                          : (dataset.measures ?? []).join(", ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {t("vantage.sources.dimensions", "Groupable")} ({dimensionCount})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dimensionCount === 0
                          ? t("vantage.sources.none_declared", "none declared")
                          : (dataset.dimensions ?? []).join(", ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {t("vantage.sources.date_column", "Date column")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dataset.date_column ?? t("vantage.sources.none_declared", "none declared")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                      <Link href={`/dashboard/vantage/metrics?dataset_id=${dataset.id}`}>
                        <Sigma className="mr-1 h-3 w-3" />
                        {t("vantage.sources.view_metrics", "View metrics")}
                      </Link>
                    </Button>
                    {canManage && dataset.is_available ? (
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                        <Link
                          href={`/dashboard/vantage/metrics?dataset_id=${dataset.id}&add=1`}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {t("vantage.sources.define_metric", "Define metric")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}

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

      {/* Source detail */}
      <Dialog open={detailDataset !== null} onOpenChange={(open) => !open && setDetailDataset(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detailDataset?.name}
              </DialogTitle>
              <DialogDescription>
                {detailDataset?.code} · {detailDataset?.source_table}
              </DialogDescription>
            </DialogHeader>
          </div>
          {detailDataset ? (
            <div className="space-y-4 px-6 py-5 text-sm">
              {detailDataset.description ? (
                <p className="text-muted-foreground">{detailDataset.description}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${
                    detailDataset.is_available
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {detailDataset.is_available
                    ? t("vantage.overview.readable", "Readable")
                    : t("vantage.overview.not_installed", "Not installed")}
                </Badge>
                {!detailDataset.is_active ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                    {t("vantage.sources.retired", "retired")}
                  </Badge>
                ) : null}
                {canTrend(detailDataset) ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                    {t("vantage.sources.trendable", "trendable")}
                  </Badge>
                ) : null}
              </div>

              {!detailDataset.is_available && detailDataset.module_slug ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  {t(
                    "vantage.sources.subscribe_hint",
                    "Subscribe to the {module} module to make this source readable. Metrics over it report as unavailable until then — never as zero.",
                  ).replace("{module}", detailDataset.module_slug)}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <p className="font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("vantage.sources.module", "Module")}
                  </p>
                  <p>{detailDataset.module_slug ?? "—"}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("vantage.sources.date_column", "Date column")}
                  </p>
                  <p>{detailDataset.date_column ?? "—"}</p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("vantage.sources.measures", "Measurable")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(detailDataset.measures ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {t("vantage.sources.none_declared", "none declared")}
                    </span>
                  ) : (
                    (detailDataset.measures ?? []).map((col) => (
                      <Badge key={col} variant="secondary" className="text-[10px] font-mono">
                        {col}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("vantage.sources.dimensions", "Groupable")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(detailDataset.dimensions ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {t("vantage.sources.none_declared", "none declared")}
                    </span>
                  ) : (
                    (detailDataset.dimensions ?? []).map((col) => (
                      <Badge key={col} variant="outline" className="text-[10px] font-mono">
                        {col}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t(
                  "vantage.sources.allowlist_note",
                  "Filters may use either list. Aggregations may only use measurable columns. Nothing outside these lists can reach a query.",
                )}
              </p>
            </div>
          ) : null}

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button asChild variant="outline">
              <Link href={`/dashboard/vantage/metrics?dataset_id=${detailDataset?.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("vantage.sources.view_metrics", "View metrics")}
              </Link>
            </Button>
            {canManage && detailDataset?.is_available ? (
              <Button asChild>
                <Link href={`/dashboard/vantage/metrics?dataset_id=${detailDataset.id}&add=1`}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("vantage.sources.define_metric", "Define metric")}
                </Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
