"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

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
import { vantageApi } from "@/modules/vantage/api";
import type { VantageAlert, VantageMetric } from "@/modules/vantage/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function VantageAlertsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    metric_id: "",
    name: "",
    comparison: "below",
    threshold: "",
    range_days: "30",
  });

  const alertsQuery = useQuery({
    queryKey: ["vantage", "alerts"],
    queryFn: () => vantageApi.listAlerts({ limit: 50 }).then((res) => res.data),
  });

  const metricsQuery = useQuery({
    queryKey: ["vantage", "metric-options"],
    queryFn: () => vantageApi.listMetrics({ limit: 100 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["vantage", "overview-alerts"],
    queryFn: () => vantageApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["vantage"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      vantageApi.createAlert({
        metric_id: Number(form.metric_id),
        name: form.name,
        comparison: form.comparison,
        threshold: Number(form.threshold || 0),
        range_days: Number(form.range_days || 30),
        is_active: true,
      }),
    onSuccess: () => {
      toast.success(t("vantage.alerts.saved", "Alert created."));
      invalidate();
      setCreateOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("vantage.alerts.save_failed", "Could not create it."))),
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

  const alerts = (alertsQuery.data?.data ?? []) as VantageAlert[];
  const metrics = (metricsQuery.data?.data ?? []) as VantageMetric[];
  const summary = overviewQuery.data?.data?.alerts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("vantage.alerts.title", "Alerts")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "vantage.alerts.subtitle",
              "A threshold on any metric. An alert whose metric cannot be read records no value and does not fire — it will never raise an alarm about a table that is not there.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-full px-5"
            onClick={() => snapshot.mutate()}
            disabled={snapshot.isPending}
          >
            {t("vantage.alerts.snapshot", "Capture Snapshots")}
          </Button>
          <Button
            variant="outline"
            className="rounded-full px-5"
            onClick={() => run.mutate()}
            disabled={run.isPending}
          >
            <Play className="mr-2 h-4 w-4" />
            {t("vantage.alerts.run", "Run Now")}
          </Button>
          <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("vantage.alerts.add", "New Alert")}
          </Button>
        </div>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("vantage.alerts.total", "Alerts")}
            value={n(summary.total).toLocaleString()}
          />
          <StatTile
            label={t("vantage.alerts.active", "Active")}
            value={n(summary.active).toLocaleString()}
          />
          <StatTile
            label={t("vantage.overview.alerts_triggered", "Breached")}
            value={n(summary.triggered).toLocaleString()}
            alert={n(summary.triggered) > 0}
          />
          <StatTile
            label={t("vantage.overview.never_evaluated", "Never evaluated")}
            value={n(summary.never_evaluated).toLocaleString()}
            meta={t("vantage.alerts.never_meta", "the scheduler has not reached these")}
            alert={n(summary.never_evaluated) > 0}
          />
        </div>
      ) : null}

      <Panel
        title={t("vantage.alerts.list", "Thresholds")}
        description={t(
          "vantage.alerts.list_desc",
          "The last value is what the metric read when the alert last ran. A dash means it could not be read at all.",
        )}
      >
        {alertsQuery.isLoading ? (
          <LoadingPanel label={t("vantage.common.loading", "Loading alerts...")} />
        ) : alerts.length === 0 ? (
          <EmptyPanel label={t("vantage.alerts.none", "No alerts set.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("vantage.alerts.alert", "Alert")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("vantage.metrics.metric", "Metric")}</th>
                  <th className="pb-2 pr-3 font-semibold">
                    {t("vantage.alerts.threshold", "Threshold")}
                  </th>
                  <th className="pb-2 pr-3 font-semibold">{t("vantage.alerts.last", "Last value")}</th>
                  <th className="pb-2 pr-6 font-semibold">{t("vantage.common.status", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{alert.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {t("vantage.alerts.window", "over {n} days").replace(
                          "{n}",
                          String(alert.range_days),
                        )}
                        {alert.last_evaluated_at
                          ? ` · ${t("vantage.alerts.checked", "checked {d}").replace(
                              "{d}",
                              String(alert.last_evaluated_at).slice(0, 16).replace("T", " "),
                            )}`
                          : ` · ${t("vantage.alerts.never_run", "never run")}`}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{alert.metric?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {alert.comparison} {n(alert.threshold).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {alert.last_value === null || alert.last_value === undefined
                        ? "—"
                        : n(alert.last_value).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                    </td>
                    <td className="py-2 pr-6">
                      {alert.is_triggered ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-rose-500/15 text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300"
                        >
                          {t("vantage.overview.breached", "Breached")}
                        </Badge>
                      ) : alert.last_value === null || alert.last_value === undefined ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-amber-500/15 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300"
                        >
                          {t("vantage.overview.unreadable", "Unreadable")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                          {t("vantage.overview.ok", "Within threshold")}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* New alert */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("vantage.alerts.add", "New Alert")}
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
              <Label htmlFor="na-comparison">
                {t("vantage.alerts.comparison", "Fire when")}
              </Label>
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
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t("vantage.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending || !form.metric_id || !form.name.trim() || form.threshold === ""
              }
            >
              {t("vantage.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
