"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import type {
  Aggregation,
  MetricEvaluation,
  VantageDataset,
  VantageMetric,
} from "@/modules/vantage/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { RankedBarChart } from "@/modules/shared/charts/charts";

const AGGREGATIONS: Aggregation[] = ["count", "count_distinct", "sum", "avg", "min", "max"];
const FORMATS = ["number", "currency", "percent", "duration"] as const;

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function VantageMetricsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [inspecting, setInspecting] = React.useState<VantageMetric | null>(null);
  const [breakdown, setBreakdown] = React.useState("");

  const [form, setForm] = React.useState({
    dataset_id: "",
    code: "",
    name: "",
    aggregation: "count",
    measure_column: "",
    filters: "",
    unit: "",
    format: "number",
    direction: "higher_is_better",
    target_value: "",
  });

  const metricsQuery = useQuery({
    queryKey: ["vantage", "metrics", search],
    queryFn: () =>
      vantageApi.listMetrics({ limit: 50, ...(search ? { search } : {}) }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const datasetsQuery = useQuery({
    queryKey: ["vantage", "datasets"],
    queryFn: () => vantageApi.listDatasets({ limit: 100 }).then((res) => res.data),
  });

  const evaluationQuery = useQuery({
    queryKey: ["vantage", "evaluate", inspecting?.id, breakdown],
    queryFn: () =>
      vantageApi
        .evaluateMetric(inspecting!.id, {
          range_days: 365,
          ...(breakdown ? { breakdown } : {}),
        })
        .then((res) => res.data),
    enabled: inspecting !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["vantage"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      vantageApi.createMetric({
        dataset_id: Number(form.dataset_id),
        code: form.code,
        name: form.name,
        aggregation: form.aggregation,
        measure_column: form.measure_column || null,
        filters: form.filters || null,
        unit: form.unit || null,
        format: form.format,
        direction: form.direction,
        ...(form.target_value ? { target_value: Number(form.target_value) } : {}),
        is_active: true,
      }),
    onSuccess: () => {
      toast.success(t("vantage.metrics.saved", "Metric defined."));
      invalidate();
      setCreateOpen(false);
    },
    // The API refuses a definition it could never evaluate, and says why —
    // a bad column or an aggregation with no column to work on.
    onError: (error: any) =>
      toast.error(errorText(error, t("vantage.metrics.save_failed", "Could not define it."))),
  });

  const metrics = (metricsQuery.data?.data ?? []) as VantageMetric[];
  const datasets = (datasetsQuery.data?.data ?? []) as VantageDataset[];
  const evaluation: MetricEvaluation | undefined = evaluationQuery.data?.data;

  const selectedDataset = datasets.find((dataset) => String(dataset.id) === form.dataset_id);
  const needsColumn = form.aggregation !== "count";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("vantage.metrics.title", "Metrics")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "vantage.metrics.subtitle",
              "A metric names a dataset, an aggregation from a fixed list, and a column that dataset allows. Nothing else ever reaches the query.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("vantage.metrics.add", "Define Metric")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="m-search" className="text-xs">
            {t("vantage.common.search", "Search")}
          </Label>
          <Input
            id="m-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("vantage.metrics.search_hint", "Code or name")}
            className="h-9 w-56"
          />
        </div>
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
        ) : metrics.length === 0 ? (
          <EmptyPanel label={t("vantage.metrics.none", "No metrics defined yet.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("vantage.metrics.metric", "Metric")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("vantage.metrics.source", "Source")}</th>
                  <th className="pb-2 pr-3 font-semibold">
                    {t("vantage.metrics.definition", "Definition")}
                  </th>
                  <th className="pb-2 pr-3 font-semibold">{t("vantage.metrics.filters", "Filters")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("vantage.common.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{metric.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {metric.code}
                        {metric.unit ? ` · ${metric.unit}` : ""}
                        {metric.direction === "lower_is_better"
                          ? ` · ${t("vantage.metrics.lower", "lower is better")}`
                          : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {metric.dataset?.name ?? "—"}
                      {metric.dataset && metric.dataset.is_available === false ? (
                        <span className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          {t("vantage.metrics.unavailable", "needs {n}").replace(
                            "{n}",
                            metric.dataset.module_slug ?? "another module",
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
                    <td className="py-2 pr-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          setInspecting(metric);
                          setBreakdown("");
                        }}
                      >
                        {t("vantage.metrics.inspect", "Evaluate")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Define */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("vantage.metrics.add", "Define Metric")}
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
              <Label htmlFor="nm-dataset">{t("vantage.metrics.source", "Source")}</Label>
              <select
                id="nm-dataset"
                value={form.dataset_id}
                onChange={(event) =>
                  setForm({ ...form, dataset_id: event.target.value, measure_column: "" })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("vantage.common.select", "Select...")}</option>
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                    {dataset.is_available === false ? " (not installed)" : ""}
                  </option>
                ))}
              </select>
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
            <div className="space-y-1.5">
              <Label htmlFor="nm-agg">{t("vantage.metrics.aggregation", "Aggregation")}</Label>
              <select
                id="nm-agg"
                value={form.aggregation}
                onChange={(event) => setForm({ ...form, aggregation: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {AGGREGATIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-column">{t("vantage.metrics.column", "Column")}</Label>
              <select
                id="nm-column"
                value={form.measure_column}
                onChange={(event) => setForm({ ...form, measure_column: event.target.value })}
                disabled={!needsColumn || !selectedDataset}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">
                  {needsColumn
                    ? t("vantage.common.select", "Select...")
                    : t("vantage.metrics.not_needed", "Not needed for a count")}
                </option>
                {/* Only the dataset's own allowlist is offered. */}
                {(selectedDataset?.measures ?? []).map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
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
              <Label htmlFor="nm-format">{t("vantage.metrics.format", "Format")}</Label>
              <select
                id="nm-format"
                value={form.format}
                onChange={(event) => setForm({ ...form, format: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {FORMATS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-direction">{t("vantage.metrics.direction", "Direction")}</Label>
              <select
                id="nm-direction"
                value={form.direction}
                onChange={(event) => setForm({ ...form, direction: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="higher_is_better">
                  {t("vantage.metrics.higher", "Higher is better")}
                </option>
                <option value="lower_is_better">
                  {t("vantage.metrics.lower_full", "Lower is better")}
                </option>
              </select>
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
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t("vantage.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                !form.dataset_id ||
                !form.code.trim() ||
                !form.name.trim() ||
                (needsColumn && !form.measure_column)
              }
            >
              {t("vantage.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluate */}
      <Dialog open={inspecting !== null} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {inspecting?.name ?? ""}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "vantage.metrics.evaluate_desc",
                  "Evaluated over the last 365 days, with the reported history beside the live figure.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {evaluationQuery.isLoading ? (
              <LoadingPanel label={t("vantage.common.loading", "Evaluating...")} />
            ) : !evaluation ? (
              <EmptyPanel label={t("vantage.metrics.no_result", "Nothing to show.")} />
            ) : !evaluation.available ? (
              <EmptyPanel label={evaluation.reason ?? "Source not available."} />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile
                    label={t("vantage.metrics.value", "Value")}
                    value={
                      evaluation.value === null
                        ? "—"
                        : evaluation.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    }
                  />
                  <StatTile
                    label={t("vantage.metrics.rows", "Rows matched")}
                    value={n(evaluation.matched_rows).toLocaleString()}
                  />
                  <StatTile
                    label={t("vantage.metrics.previous", "Previous period")}
                    value={
                      evaluation.previous_value === null
                        ? "—"
                        : evaluation.previous_value.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                    }
                  />
                </div>

                {(inspecting?.dataset?.dimensions ?? []).length > 0 ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="ev-breakdown" className="text-xs">
                      {t("vantage.metrics.breakdown", "Break down by")}
                    </Label>
                    <select
                      id="ev-breakdown"
                      value={breakdown}
                      onChange={(event) => setBreakdown(event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">{t("vantage.metrics.no_breakdown", "No breakdown")}</option>
                      {(inspecting?.dataset?.dimensions ?? []).map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
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
            <Button variant="ghost" onClick={() => setInspecting(null)}>
              {t("vantage.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
