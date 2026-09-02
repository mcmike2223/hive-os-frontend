"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Play,
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
import { usePermissions } from "@/hooks/use-permissions";
import { vantageApi } from "@/modules/vantage/api";
import type { MetricFormat, VantageAlert, VantageMetric, VantageOverview } from "@/modules/vantage/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { formatMetricValue, n, useDebouncedValue } from "@/modules/vantage/utils";

type AlertStatus = "all" | "triggered" | "unreadable" | "ok" | "never_evaluated";

function alertReadStatus(alert: VantageAlert): "breached" | "unreadable" | "ok" | "inactive" | "never" {
  if (!alert.is_active) return "inactive";
  if (!alert.last_evaluated_at) return "never";
  if (alert.last_value === null || alert.last_value === undefined) return "unreadable";
  if (alert.is_triggered) return "breached";
  return "ok";
}

function formatAlertValue(alert: VantageAlert): string {
  const format = (alert.metric?.format ?? "number") as MetricFormat;
  const unit = alert.metric?.unit ?? null;
  const value = alert.last_value === null || alert.last_value === undefined ? null : n(alert.last_value);
  return formatMetricValue(value, format, unit);
}

function formatThreshold(alert: VantageAlert): string {
  const format = (alert.metric?.format ?? "number") as MetricFormat;
  const unit = alert.metric?.unit ?? null;
  return formatMetricValue(n(alert.threshold), format, unit);
}

function formatEvaluatedAt(value: string | null): string {
  if (!value) return "—";
  return String(value).slice(0, 16).replace("T", " ");
}

const emptyAlertForm = {
  metric_id: "",
  name: "",
  comparison: "below",
  threshold: "",
  range_days: "30",
  is_active: true,
};

function alertToForm(alert: VantageAlert) {
  return {
    metric_id: String(alert.metric_id),
    name: alert.name,
    comparison: alert.comparison,
    threshold: String(alert.threshold),
    range_days: String(alert.range_days),
    is_active: alert.is_active,
  };
}

function hasActiveAlertFilters(opts: {
  search: string;
  metricId: string;
  status: AlertStatus;
  showInactive: boolean;
}): boolean {
  return Boolean(opts.search.trim() || opts.metricId || opts.status !== "all" || opts.showInactive);
}

function StatusBadge({ alert, t }: { alert: VantageAlert; t: (key: string, fallback: string) => string }) {
  const status = alertReadStatus(alert);

  if (status === "breached") {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-rose-500/15 text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300"
      >
        {t("vantage.overview.breached", "Breached")}
      </Badge>
    );
  }

  if (status === "inactive") {
    return (
      <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {t("vantage.alerts.retired", "Retired")}
      </Badge>
    );
  }

  if (status === "never") {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-slate-500/15 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300"
      >
        {t("vantage.alerts.never_run", "Never run")}
      </Badge>
    );
  }

  if (status === "unreadable") {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-amber-500/15 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300"
      >
        {t("vantage.overview.unreadable", "Unreadable")}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
      {t("vantage.overview.ok", "Within threshold")}
    </Badge>
  );
}

export default function VantageAlertsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canManage = hasAnyPermission(["manage_vantage_alerts", "manage_vantage"]);
  const canRunSnapshots = hasAnyPermission(["manage_vantage_metrics", "manage_vantage"]);

  const initialMetricId = searchParams.get("metric_id") ?? "";
  const shouldOpenAdd = searchParams.get("add") === "1";

  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [metricFilter, setMetricFilter] = React.useState(initialMetricId);
  const [statusFilter, setStatusFilter] = React.useState<AlertStatus>(
    (searchParams.get("status") as AlertStatus) || "all",
  );
  const [showInactive, setShowInactive] = React.useState(searchParams.get("show_inactive") === "1");
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));
  const [focusAlertId, setFocusAlertId] = React.useState(searchParams.get("alert_id") ?? "");

  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingAlert, setEditingAlert] = React.useState<VantageAlert | null>(null);
  const [inspecting, setInspecting] = React.useState<VantageAlert | null>(null);
  const [form, setForm] = React.useState({ ...emptyAlertForm, metric_id: initialMetricId });

  const rowRefs = React.useRef<Record<number, HTMLTableRowElement | null>>({});
  const deepLinkHandled = React.useRef(false);

  const overviewQuery = useQuery({
    queryKey: ["vantage", "overview-alerts"],
    queryFn: () => vantageApi.overview().then((res) => res.data),
  });

  const alertsQuery = useQuery({
    queryKey: ["vantage", "alerts", debouncedSearch, metricFilter, statusFilter, showInactive, page],
    queryFn: () =>
      vantageApi
        .listAlerts({
          page,
          limit: 50,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(metricFilter ? { metric_id: Number(metricFilter) } : {}),
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(!showInactive ? { active_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const metricsQuery = useQuery({
    queryKey: ["vantage", "metric-options-alerts"],
    queryFn: () => vantageApi.listMetrics({ limit: 200, active_only: 1 }).then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["vantage"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (metricFilter) params.set("metric_id", metricFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (showInactive) params.set("show_inactive", "1");
    if (focusAlertId) params.set("alert_id", focusAlertId);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    focusAlertId,
    metricFilter,
    page,
    pathname,
    router,
    searchInput,
    showInactive,
    statusFilter,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, metricFilter, statusFilter, showInactive]);

  const saveAlert = useMutation({
    mutationFn: () => {
      const payload = {
        metric_id: Number(form.metric_id),
        name: form.name,
        comparison: form.comparison,
        threshold: Number(form.threshold || 0),
        range_days: Number(form.range_days || 30),
        is_active: form.is_active,
      };
      return editingAlert
        ? vantageApi.updateAlert(editingAlert.id, payload)
        : vantageApi.createAlert(payload);
    },
    onSuccess: () => {
      toast.success(
        t(
          editingAlert ? "vantage.alerts.updated" : "vantage.alerts.saved",
          editingAlert ? "Alert updated." : "Alert created.",
        ),
      );
      invalidate();
      setFormOpen(false);
      setEditingAlert(null);
      setForm({ ...emptyAlertForm });
    },
    onError: (error: any) =>
      toast.error(
        errorText(
          error,
          t(
            editingAlert ? "vantage.alerts.update_failed" : "vantage.alerts.save_failed",
            "Could not save it.",
          ),
        ),
      ),
  });

  const run = useMutation({
    mutationFn: () => vantageApi.runAlerts(),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("vantage.alerts.ran", "Alerts evaluated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("vantage.alerts.run_failed", "Could not run them."))),
  });

  const snapshot = useMutation({
    mutationFn: () => vantageApi.runSnapshots(),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("vantage.alerts.snapped", "Snapshots captured."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("vantage.alerts.snap_failed", "Could not capture them."))),
  });

  const overview: VantageOverview | undefined = overviewQuery.data?.data;
  const summary = overview?.alerts;
  const alerts = (alertsQuery.data?.data ?? []) as VantageAlert[];
  const meta = alertsQuery.data?.meta;
  const metrics = (metricsQuery.data?.data ?? []) as VantageMetric[];
  const refetching = alertsQuery.isFetching && !alertsQuery.isLoading;

  const openCreate = React.useCallback(() => {
    setEditingAlert(null);
    setForm({
      ...emptyAlertForm,
      metric_id: metricFilter || initialMetricId,
    });
    setFormOpen(true);
  }, [initialMetricId, metricFilter]);

  const openEdit = React.useCallback((alert: VantageAlert) => {
    setEditingAlert(alert);
    setForm(alertToForm(alert));
    setFormOpen(true);
  }, []);

  const openInspect = React.useCallback((alert: VantageAlert) => {
    setInspecting(alert);
    setFocusAlertId(String(alert.id));
  }, []);

  const clearFilters = () => {
    setSearchInput("");
    setMetricFilter("");
    setStatusFilter("all");
    setShowInactive(false);
    setFocusAlertId("");
  };

  const filtersActive = hasActiveAlertFilters({
    search: searchInput,
    metricId: metricFilter,
    status: statusFilter,
    showInactive,
  });

  React.useEffect(() => {
    if (shouldOpenAdd && canManage) openCreate();
  }, [shouldOpenAdd, canManage, openCreate]);

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [focusAlertId]);

  React.useEffect(() => {
    if (!focusAlertId || alerts.length === 0 || deepLinkHandled.current) return;
    const alert = alerts.find((row) => String(row.id) === focusAlertId);
    if (!alert) return;
    deepLinkHandled.current = true;
    const row = rowRefs.current[alert.id];
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    setInspecting(alert);
  }, [focusAlertId, alerts]);

  const focusedMetricName =
    metrics.find((metric) => String(metric.id) === metricFilter)?.name ?? null;

  return (
    <div className="space-y-6 print:space-y-4">
      <Breadcrumbs
        items={[
          { label: t("vantage.overview.title", "Vantage"), href: "/dashboard/vantage" },
          { label: t("vantage.alerts.title", "Alerts") },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("vantage.alerts.title", "Alerts")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "vantage.alerts.subtitle",
              "A threshold on any metric. An alert whose metric cannot be read records no value and does not fire — it will never raise an alarm about a table that is not there.",
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
              <Link href="/dashboard/vantage/sources">Data Sources</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              alertsQuery.refetch();
              overviewQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            {t("vantage.common.refresh", "Refresh")}
          </Button>
          {canRunSnapshots ? (
            <Button
              variant="outline"
              className="rounded-full px-5"
              onClick={() => snapshot.mutate()}
              disabled={snapshot.isPending}
            >
              {t("vantage.alerts.snapshot", "Capture Snapshots")}
            </Button>
          ) : null}
          {canManage ? (
            <>
              <Button
                variant="outline"
                className="rounded-full px-5"
                onClick={() => run.mutate()}
                disabled={run.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {t("vantage.alerts.run", "Run Now")}
              </Button>
              <Button className="rounded-full px-5" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                {t("vantage.alerts.add", "New Alert")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
          <StatTile
            icon={<BellRing className="h-4 w-4" />}
            label={t("vantage.alerts.total", "Alerts")}
            value={n(summary.total).toLocaleString()}
            href="/dashboard/vantage/alerts"
          />
          <StatTile
            label={t("vantage.alerts.active", "Active")}
            value={n(summary.active).toLocaleString()}
            href="/dashboard/vantage/alerts"
          />
          <Link href="/dashboard/vantage/alerts?status=triggered" className="block">
            <StatTile
              label={t("vantage.overview.alerts_triggered", "Breached")}
              value={n(summary.triggered).toLocaleString()}
              alert={n(summary.triggered) > 0}
            />
          </Link>
          <Link href="/dashboard/vantage/alerts?status=never_evaluated" className="block">
            <StatTile
              label={t("vantage.overview.never_evaluated", "Never evaluated")}
              value={n(summary.never_evaluated).toLocaleString()}
              meta={t("vantage.alerts.never_meta", "the scheduler has not reached these")}
              alert={n(summary.never_evaluated) > 0}
            />
          </Link>
        </div>
      ) : null}

      {metricFilter ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm print:hidden">
          <span>
            {t("vantage.alerts.metric_focus", "Showing alerts for metric")}{" "}
            <strong>{focusedMetricName ?? `#${metricFilter}`}</strong>
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setMetricFilter("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("vantage.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="a-search" className="text-xs">
            {t("vantage.common.search", "Search")}
          </Label>
          <Input
            id="a-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("vantage.alerts.search_hint", "Alert or metric name")}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("vantage.metrics.metric", "Metric")}</Label>
          <Select
            value={metricFilter || "any"}
            onValueChange={(value) => setMetricFilter(value === "any" ? "" : value)}
          >
            <SelectTrigger className="h-9 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("vantage.common.any", "Any")}</SelectItem>
              {metrics.map((metric) => (
                <SelectItem key={metric.id} value={String(metric.id)}>
                  {metric.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("vantage.common.status", "Status")}</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as AlertStatus)}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("vantage.common.any", "Any")}</SelectItem>
              <SelectItem value="triggered">{t("vantage.overview.breached", "Breached")}</SelectItem>
              <SelectItem value="unreadable">{t("vantage.overview.unreadable", "Unreadable")}</SelectItem>
              <SelectItem value="ok">{t("vantage.overview.ok", "Within threshold")}</SelectItem>
              <SelectItem value="never_evaluated">
                {t("vantage.overview.never_evaluated", "Never evaluated")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="rounded border-input"
          />
          {t("vantage.alerts.show_retired", "Show retired")}
        </label>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("vantage.common.clear_filters", "Clear filters")}
          </Button>
        ) : null}
      </div>

      <Panel
        title={t("vantage.alerts.list", "Thresholds")}
        description={t(
          "vantage.alerts.list_desc",
          "The last value is what the metric read when the alert last ran. A dash means it could not be read at all.",
        )}
      >
        {alertsQuery.isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("vantage.alerts.load_failed", "Could not load alerts.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => alertsQuery.refetch()}>
              {t("vantage.common.retry", "Retry")}
            </Button>
          </div>
        ) : alertsQuery.isLoading ? (
          <LoadingPanel label={t("vantage.common.loading", "Loading alerts...")} />
        ) : alerts.length === 0 ? (
          <EmptyPanel
            label={
              filtersActive
                ? t("vantage.alerts.none_filtered", "No alerts match these filters.")
                : t("vantage.alerts.none", "No alerts set.")
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-semibold">{t("vantage.alerts.alert", "Alert")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("vantage.metrics.metric", "Metric")}</th>
                    <th className="pb-2 pr-3 font-semibold">
                      {t("vantage.alerts.threshold", "Threshold")}
                    </th>
                    <th className="pb-2 pr-3 font-semibold">{t("vantage.alerts.last", "Last value")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("vantage.common.status", "Status")}</th>
                    <th className="pb-2 font-semibold print:hidden">{t("vantage.common.actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr
                      key={alert.id}
                      ref={(node) => {
                        rowRefs.current[alert.id] = node;
                      }}
                      className={`border-b border-border/40 last:border-0 ${
                        focusAlertId === String(alert.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => openInspect(alert)}
                        >
                          <span className="block font-medium">{alert.name}</span>
                        </button>
                        <span className="block text-[11px] text-muted-foreground">
                          {t("vantage.alerts.window", "over {n} days").replace(
                            "{n}",
                            String(alert.range_days),
                          )}
                          {alert.last_evaluated_at
                            ? ` · ${t("vantage.alerts.checked", "checked {d}").replace(
                                "{d}",
                                formatEvaluatedAt(alert.last_evaluated_at),
                              )}`
                            : ` · ${t("vantage.alerts.never_run", "never run")}`}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {alert.metric ? (
                          <Link
                            href={`/dashboard/vantage/metrics?metric_id=${alert.metric_id}`}
                            className="hover:underline"
                          >
                            {alert.metric.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {alert.comparison} {formatThreshold(alert)}
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">{formatAlertValue(alert)}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge alert={alert} t={t} />
                      </td>
                      <td className="py-2 print:hidden">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openInspect(alert)}>
                            {t("vantage.common.view", "View")}
                          </Button>
                          {canManage ? (
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(alert)}>
                              <Pencil className="mr-1 h-3 w-3" />
                              {t("vantage.common.edit", "Edit")}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {meta && meta.last_page > 1 ? (
              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-4 print:hidden">
                <p className="text-xs text-muted-foreground">
                  {t("vantage.common.page_of", "Page {page} of {total}")
                    .replace("{page}", String(meta.current_page))
                    .replace("{total}", String(meta.last_page))}
                  {" · "}
                  {meta.total.toLocaleString()} {t("vantage.alerts.total", "Alerts").toLowerCase()}
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
      </Panel>

      {/* Create / edit */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingAlert(null);
            setForm({ ...emptyAlertForm });
          }
        }}
      >
        <DialogContent className="rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl sm:max-w-lg">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingAlert
                  ? t("vantage.alerts.edit", "Edit Alert")
                  : t("vantage.alerts.add", "New Alert")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "vantage.alerts.add_desc",
                  "The metric is evaluated over its own window each time the alert runs, and compared against the threshold.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="na-metric">{t("vantage.metrics.metric", "Metric")}</Label>
              <select
                id="na-metric"
                value={form.metric_id}
                onChange={(event) => setForm({ ...form, metric_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={Boolean(editingAlert)}
              >
                <option value="">{t("vantage.common.select", "Select...")}</option>
                {metrics.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="na-name">{t("vantage.common.name", "Name")}</Label>
              <Input
                id="na-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="na-comparison">{t("vantage.alerts.comparison", "Fire when")}</Label>
              <select
                id="na-comparison"
                value={form.comparison}
                onChange={(event) => setForm({ ...form, comparison: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="below">{t("vantage.alerts.below", "Below the threshold")}</option>
                <option value="above">{t("vantage.alerts.above", "Above the threshold")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="na-threshold">{t("vantage.alerts.threshold", "Threshold")}</Label>
              <Input
                id="na-threshold"
                type="number"
                step="any"
                value={form.threshold}
                onChange={(event) => setForm({ ...form, threshold: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="na-range">{t("vantage.alerts.range", "Window (days)")}</Label>
              <Input
                id="na-range"
                type="number"
                min={1}
                value={form.range_days}
                onChange={(event) => setForm({ ...form, range_days: event.target.value })}
              />
            </div>
            {editingAlert ? (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                  className="rounded border-input"
                />
                {t("vantage.alerts.active_label", "Alert is active")}
              </label>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("vantage.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveAlert.mutate()}
              disabled={
                saveAlert.isPending || !form.metric_id || !form.name.trim() || form.threshold === ""
              }
            >
              {t("vantage.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog
        open={inspecting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInspecting(null);
            setFocusAlertId("");
          }
        }}
      >
        <DialogContent className="rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl sm:max-w-lg">
          {inspecting ? (
            <>
              <div className="border-b border-border/40 px-6 py-5">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black tracking-tight">{inspecting.name}</DialogTitle>
                  <DialogDescription>
                    {inspecting.metric?.name ?? t("vantage.alerts.no_metric", "Metric removed")}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="space-y-4 px-6 py-5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("vantage.common.status", "Status")}</span>
                  <StatusBadge alert={inspecting} t={t} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("vantage.alerts.threshold", "Threshold")}</span>
                  <span className="font-medium tabular-nums">
                    {inspecting.comparison} {formatThreshold(inspecting)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("vantage.alerts.last", "Last value")}</span>
                  <span className="font-medium tabular-nums">{formatAlertValue(inspecting)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("vantage.alerts.range", "Window (days)")}</span>
                  <span className="font-medium tabular-nums">{inspecting.range_days}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t("vantage.alerts.last_evaluated", "Last evaluated")}
                  </span>
                  <span className="font-medium">{formatEvaluatedAt(inspecting.last_evaluated_at)}</span>
                </div>
                {inspecting.last_triggered_at ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("vantage.alerts.last_breach", "Last breach")}
                    </span>
                    <span className="font-medium text-rose-600 dark:text-rose-400">
                      {formatEvaluatedAt(inspecting.last_triggered_at)}
                    </span>
                  </div>
                ) : null}
                {alertReadStatus(inspecting) === "unreadable" ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    {t(
                      "vantage.alerts.unreadable_hint",
                      "The metric could not be read on the last run — usually because its source module is not installed. This is not treated as a breach.",
                    )}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="border-t border-border/40 px-6 py-4">
                {inspecting.metric ? (
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/vantage/metrics?metric_id=${inspecting.metric_id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {t("vantage.alerts.open_metric", "Open metric")}
                    </Link>
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    onClick={() => {
                      setInspecting(null);
                      openEdit(inspecting);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("vantage.common.edit", "Edit")}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
