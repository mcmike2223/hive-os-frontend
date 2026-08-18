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
import { strategyApi } from "@/modules/strategy/api";
import type {
  KpiDirection,
  KpiFrequency,
  ScoreBand,
  StrategyKpi,
  StrategyObjective,
} from "@/modules/strategy/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const DIRECTIONS: KpiDirection[] = ["higher_is_better", "lower_is_better"];
const FREQUENCIES: KpiFrequency[] = ["monthly", "quarterly", "semiannual", "annual"];

const BAND_TONE: Record<ScoreBand, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  off_track: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  unmeasured: "bg-muted text-muted-foreground",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Mirrors the server's arithmetic so the dialog can preview the effect. */
const previewAchievement = (baseline: number, target: number, actual: number, direction: KpiDirection) => {
  if (Math.abs(target - baseline) < 1e-7) {
    const met = direction === "lower_is_better" ? actual <= target : actual >= target;
    return met ? 100 : 0;
  }
  return ((actual - baseline) / (target - baseline)) * 100;
};

export default function StrategyKpisPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [direction, setDirection] = React.useState("");
  const [kpiOpen, setKpiOpen] = React.useState(false);
  const [recording, setRecording] = React.useState<StrategyKpi | null>(null);

  const [form, setForm] = React.useState({
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
  });

  const [readingForm, setReadingForm] = React.useState({
    period_label: "",
    period_start: "",
    period_end: "",
    actual_value: "",
    note: "",
  });

  const kpisQuery = useQuery({
    queryKey: ["strategy", "kpis", search, direction],
    queryFn: () =>
      strategyApi
        .listKpis({
          limit: 50,
          ...(search ? { search } : {}),
          ...(direction ? { direction } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const objectivesQuery = useQuery({
    queryKey: ["strategy", "objective-options"],
    queryFn: () => strategyApi.listObjectives({ limit: 100 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["strategy", "overview-kpis"],
    queryFn: () => strategyApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["strategy"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveKpi = useMutation({
    mutationFn: () =>
      strategyApi.createKpi({
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
        is_active: true,
      }),
    onSuccess: () => {
      toast.success(t("strategy.kpis.saved", "Measure added."));
      invalidate();
      setKpiOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.kpis.save_failed", "Could not add it."))),
  });

  const recordReading = useMutation({
    mutationFn: () =>
      strategyApi.recordReading(recording!.id, {
        period_label: readingForm.period_label,
        period_start: readingForm.period_start,
        period_end: readingForm.period_end,
        actual_value: Number(readingForm.actual_value),
        note: readingForm.note || null,
      }),
    onSuccess: (response: any) => {
      const kpi = response?.data?.data?.kpi;
      toast.success(
        kpi?.achievement_percent === null || kpi?.achievement_percent === undefined
          ? t("strategy.kpis.reading_saved", "Reading recorded.")
          : t("strategy.kpis.reading_saved_with", "Recorded — now {n}% achieved.").replace(
              "{n}",
              Number(kpi.achievement_percent).toFixed(1),
            ),
      );
      invalidate();
      setRecording(null);
      setReadingForm({ period_label: "", period_start: "", period_end: "", actual_value: "", note: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.kpis.reading_failed", "Could not record it."))),
  });

  const kpis = (kpisQuery.data?.data ?? []) as StrategyKpi[];
  const objectives = (objectivesQuery.data?.data ?? []) as StrategyObjective[];
  const summary = overviewQuery.data?.data?.kpis;

  const preview = recording
    ? previewAchievement(
        n(recording.baseline_value),
        n(recording.target_value),
        Number(readingForm.actual_value || 0),
        recording.direction,
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("strategy.kpis.title", "KPIs")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "strategy.kpis.subtitle",
              "Achievement is the distance travelled from the baseline toward the target, and every measure records whether higher or lower is the good direction.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setKpiOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("strategy.kpis.add", "Add Measure")}
        </Button>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label={t("strategy.kpis.total", "Measures")}
            value={n(summary.total).toLocaleString()}
          />
          <StatTile
            label={t("strategy.kpis.measured", "Reported")}
            value={n(summary.measured).toLocaleString()}
            meta={t("strategy.kpis.unreported_meta", "{n} never reported").replace(
              "{n}",
              String(n(summary.total) - n(summary.measured)),
            )}
          />
          <StatTile
            label={t("strategy.overview.stale", "Stale")}
            value={n(summary.stale).toLocaleString()}
            meta={t("strategy.kpis.stale_meta", "older than their own cycle")}
            alert={n(summary.stale) > 0}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="k-search" className="text-xs">
            {t("strategy.common.search", "Search")}
          </Label>
          <Input
            id="k-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("strategy.kpis.search_hint", "Code or name")}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="k-direction" className="text-xs">
            {t("strategy.kpis.direction", "Direction")}
          </Label>
          <select
            id="k-direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("strategy.common.any", "Any")}</option>
            {DIRECTIONS.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Panel
        title={t("strategy.kpis.register", "Measures")}
        description={t(
          "strategy.kpis.register_desc",
          "A measure sitting exactly where it started scores zero, however close to target it happens to look.",
        )}
      >
        {kpisQuery.isLoading ? (
          <LoadingPanel label={t("strategy.common.loading", "Loading measures...")} />
        ) : kpis.length === 0 ? (
          <EmptyPanel label={t("strategy.kpis.none", "No measures match those filters.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.kpis.measure", "Measure")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.kpis.objective", "Objective")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.kpis.direction", "Direction")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.scorecard.journey", "Baseline → target")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.scorecard.latest", "Latest")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.scorecard.achievement", "Achieved")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("strategy.common.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi) => (
                  <tr key={kpi.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{kpi.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {kpi.code} · {kpi.frequency}
                        {kpi.is_stale ? (
                          <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">
                            {t("strategy.overview.stale_word", "stale")}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{kpi.objective?.title ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">
                      {/* Spelled out, because this single field decides how the
                          achievement figure beside it is computed. */}
                      {kpi.direction === "lower_is_better"
                        ? t("strategy.kpis.lower_better", "Lower is better")
                        : t("strategy.kpis.higher_better", "Higher is better")}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums text-muted-foreground">
                      {n(kpi.baseline_value)} → {n(kpi.target_value)}
                      {kpi.unit ? ` ${kpi.unit}` : ""}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {kpi.latest_value === null || kpi.latest_value === undefined
                        ? "—"
                        : kpi.latest_value}
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
                    <td className="py-2 pr-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          setRecording(kpi);
                          const today = new Date();
                          const start = new Date(today.getFullYear(), today.getMonth(), 1);
                          setReadingForm({
                            period_label: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
                            period_start: start.toISOString().slice(0, 10),
                            period_end: today.toISOString().slice(0, 10),
                            actual_value: "",
                            note: "",
                          });
                        }}
                      >
                        {t("strategy.kpis.record", "Record")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add measure */}
      <Dialog open={kpiOpen} onOpenChange={setKpiOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.kpis.add", "Add Measure")}
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
              <Label htmlFor="n-objective">{t("strategy.kpis.objective", "Objective")}</Label>
              <select
                id="n-objective"
                value={form.objective_id}
                onChange={(event) => setForm({ ...form, objective_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("strategy.common.select", "Select...")}</option>
                {objectives.map((objective) => (
                  <option key={objective.id} value={objective.id}>
                    {objective.code} — {objective.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-code">{t("strategy.common.code", "Code")}</Label>
              <Input
                id="n-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-unit">{t("strategy.kpis.unit", "Unit")}</Label>
              <Input
                id="n-unit"
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                placeholder="%, ETB, days"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="n-name">{t("strategy.common.name", "Name")}</Label>
              <Input
                id="n-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="n-direction">{t("strategy.kpis.direction", "Direction")}</Label>
              <select
                id="n-direction"
                value={form.direction}
                onChange={(event) => setForm({ ...form, direction: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="higher_is_better">
                  {t("strategy.kpis.higher_better", "Higher is better")}
                </option>
                <option value="lower_is_better">
                  {t("strategy.kpis.lower_better", "Lower is better")}
                </option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "strategy.kpis.direction_hint",
                  "Cost, wastage and days-to-collect are lower-is-better. Getting this wrong reports a worsening business as improving.",
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-baseline">{t("strategy.kpis.baseline", "Baseline")}</Label>
              <Input
                id="n-baseline"
                type="number"
                step="any"
                value={form.baseline_value}
                onChange={(event) => setForm({ ...form, baseline_value: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-target">{t("strategy.kpis.target", "Target")}</Label>
              <Input
                id="n-target"
                type="number"
                step="any"
                value={form.target_value}
                onChange={(event) => setForm({ ...form, target_value: event.target.value })}
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
                onChange={(event) => setForm({ ...form, weight: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-frequency">{t("strategy.kpis.frequency", "Reported")}</Label>
              <select
                id="n-frequency"
                value={form.frequency}
                onChange={(event) => setForm({ ...form, frequency: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {FREQUENCIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="n-source">{t("strategy.kpis.source", "Where the number comes from")}</Label>
              <Input
                id="n-source"
                value={form.data_source}
                onChange={(event) => setForm({ ...form, data_source: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setKpiOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveKpi.mutate()}
              disabled={
                saveKpi.isPending || !form.objective_id || !form.code.trim() || !form.name.trim()
              }
            >
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record a reading */}
      <Dialog open={recording !== null} onOpenChange={(open) => !open && setRecording(null)}>
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
                onChange={(event) =>
                  setReadingForm({ ...readingForm, period_label: event.target.value })
                }
                placeholder="2026-Q3"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-actual">{t("strategy.kpis.actual", "Actual")}</Label>
              <Input
                id="r-actual"
                type="number"
                step="any"
                value={readingForm.actual_value}
                onChange={(event) =>
                  setReadingForm({ ...readingForm, actual_value: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-start">{t("strategy.kpis.period_start", "From")}</Label>
              <Input
                id="r-start"
                type="date"
                value={readingForm.period_start}
                onChange={(event) =>
                  setReadingForm({ ...readingForm, period_start: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-end">{t("strategy.kpis.period_end", "To")}</Label>
              <Input
                id="r-end"
                type="date"
                min={readingForm.period_start}
                value={readingForm.period_end}
                onChange={(event) =>
                  setReadingForm({ ...readingForm, period_end: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="r-note">{t("strategy.kpis.note", "Note")}</Label>
              <Input
                id="r-note"
                value={readingForm.note}
                onChange={(event) => setReadingForm({ ...readingForm, note: event.target.value })}
              />
            </div>
            {readingForm.actual_value !== "" ? (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                {t("strategy.kpis.preview", "That would read as {n}% achieved.").replace(
                  "{n}",
                  preview.toFixed(1),
                )}
                {preview < 0
                  ? ` ${t("strategy.kpis.preview_backwards", "— the measure has moved away from the baseline.")}`
                  : ""}
              </p>
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
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
