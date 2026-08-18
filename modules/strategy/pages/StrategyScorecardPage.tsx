"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
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
  Scorecard,
  ScoreBand,
  ScoredObjective,
  StrategyOverview,
  StrategyPerspective,
} from "@/modules/strategy/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

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

/** The bar hue follows the same band, so colour never carries state alone. */
const BAND_BAR: Record<ScoreBand, string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  off_track: "bg-rose-500",
  unmeasured: "bg-muted-foreground/40",
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

export default function StrategyScorecardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [planId, setPlanId] = React.useState<string>("");
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});
  const [objectiveOpen, setObjectiveOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    perspective_id: "",
    code: "",
    title: "",
    owner_name: "",
    department: "",
    weight: "1",
  });

  const overviewQuery = useQuery({
    queryKey: ["strategy", "overview-scorecard"],
    queryFn: () => strategyApi.overview().then((res) => res.data),
  });

  const overview: StrategyOverview | undefined = overviewQuery.data?.data;
  const activePlanId = planId ? Number(planId) : overview?.plan?.id;

  const scorecardQuery = useQuery({
    queryKey: ["strategy", "scorecard", activePlanId],
    queryFn: () => strategyApi.scorecard(activePlanId!).then((res) => res.data),
    enabled: activePlanId !== undefined && activePlanId !== null,
  });

  const perspectivesQuery = useQuery({
    queryKey: ["strategy", "perspective-options", activePlanId],
    queryFn: () =>
      strategyApi.listPerspectives({ plan_id: activePlanId, limit: 50 }).then((res) => res.data),
    enabled: activePlanId !== undefined && activePlanId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["strategy"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveObjective = useMutation({
    mutationFn: () =>
      strategyApi.createObjective({
        plan_id: activePlanId,
        ...(form.perspective_id ? { perspective_id: Number(form.perspective_id) } : {}),
        code: form.code,
        title: form.title,
        owner_name: form.owner_name || null,
        department: form.department || null,
        weight: Number(form.weight || 1),
        status: "active",
      }),
    onSuccess: () => {
      toast.success(t("strategy.scorecard.objective_saved", "Objective added."));
      invalidate();
      setObjectiveOpen(false);
      setForm({ perspective_id: "", code: "", title: "", owner_name: "", department: "", weight: "1" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.scorecard.objective_failed", "Could not add it."))),
  });

  const scorecard: Scorecard | undefined = scorecardQuery.data?.data;
  const perspectives = (perspectivesQuery.data?.data ?? []) as StrategyPerspective[];

  const toggle = (id: number) => setExpanded((current) => ({ ...current, [id]: !current[id] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("strategy.scorecard.title", "Scorecard")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "strategy.scorecard.subtitle",
              "Perspectives hold objectives, objectives are measured by KPIs, and every level rolls up by weight. Anything not yet measured is excluded rather than scored as zero.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => setObjectiveOpen(true)}
          disabled={!activePlanId}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("strategy.scorecard.add_objective", "Add Objective")}
        </Button>
      </div>

      {(overview?.plans ?? []).length > 1 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="sc-plan" className="text-xs">
              {t("strategy.overview.plan", "Plan")}
            </Label>
            <select
              id="sc-plan"
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className="h-9 w-72 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("strategy.overview.current_plan", "Current plan")}</option>
              {overview!.plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {scorecardQuery.isLoading || overviewQuery.isLoading ? (
        <LoadingPanel label={t("strategy.common.loading", "Loading the scorecard...")} />
      ) : !scorecard ? (
        <EmptyPanel label={t("strategy.overview.no_plan", "No strategic plan has been set up yet.")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("strategy.overview.plan_score", "Plan score")}
              value={scorecard.score === null ? "—" : `${scorecard.score.toFixed(1)}%`}
              meta={t("strategy.overview.elapsed_meta_short", "{n}% of the plan elapsed").replace(
                "{n}",
                n(scorecard.plan.elapsed_percent).toFixed(0),
              )}
            />
            <StatTile
              label={t("strategy.scorecard.measured", "Measures reported")}
              value={`${n(scorecard.measurement.measured)} / ${n(scorecard.measurement.kpis)}`}
              meta={t("strategy.scorecard.unmeasured_meta", "{n} never reported").replace(
                "{n}",
                String(n(scorecard.measurement.unmeasured)),
              )}
              alert={n(scorecard.measurement.unmeasured) > 0}
            />
            <StatTile
              label={t("strategy.overview.stale", "Stale measures")}
              value={n(scorecard.measurement.stale).toLocaleString()}
              alert={n(scorecard.measurement.stale) > 0}
            />
            <StatTile
              label={t("strategy.scorecard.perspectives", "Perspectives")}
              value={(scorecard.perspectives ?? []).length.toLocaleString()}
            />
          </div>

          {(scorecard.perspectives ?? []).map((perspective) => (
            <Panel
              key={perspective.code}
              title={perspective.name}
              description={t("strategy.scorecard.weight_desc", "Weight {w} · {n} objectives")
                .replace("{w}", String(n(perspective.weight)))
                .replace("{n}", String((perspective.objectives ?? []).length))}
              action={
                <div className="min-w-[8rem] text-right">
                  <span className="block text-lg font-black tabular-nums">
                    {perspective.score === null ? "—" : `${perspective.score.toFixed(1)}%`}
                  </span>
                  <Badge
                    variant="outline"
                    className={`border-transparent text-[10px] font-black uppercase tracking-widest ${BAND_TONE[perspective.status]}`}
                  >
                    {perspective.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              }
            >
              {(perspective.objectives ?? []).length === 0 ? (
                <EmptyPanel
                  label={t("strategy.scorecard.no_objectives", "No objectives under this perspective.")}
                />
              ) : (
                <div className="space-y-2">
                  {perspective.objectives.map((objective: ScoredObjective) => (
                    <div key={objective.objective_id} className="rounded-lg border border-border/50">
                      <button
                        type="button"
                        onClick={() => toggle(objective.objective_id)}
                        aria-expanded={!!expanded[objective.objective_id]}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left"
                      >
                        {expanded[objective.objective_id] ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{objective.title}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {objective.code}
                            {objective.owner ? ` · ${objective.owner}` : ""} ·{" "}
                            {t("strategy.scorecard.kpi_count", "{m} of {n} measures reported")
                              .replace("{m}", String(objective.measured_kpi_count))
                              .replace("{n}", String(objective.kpi_count))}
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

                      {expanded[objective.objective_id] ? (
                        <div className="border-t border-border/40 px-3 py-2">
                          {objective.kpis.length === 0 ? (
                            <p className="py-2 text-center text-xs italic text-muted-foreground">
                              {t(
                                "strategy.scorecard.no_kpis",
                                "No measures attached — this objective cannot be judged.",
                              )}
                            </p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left uppercase tracking-wide text-muted-foreground">
                                  <th className="pb-1.5 pr-3 font-semibold">
                                    {t("strategy.scorecard.measure", "Measure")}
                                  </th>
                                  <th className="pb-1.5 pr-3 font-semibold">
                                    {t("strategy.scorecard.journey", "Baseline → target")}
                                  </th>
                                  <th className="pb-1.5 pr-3 font-semibold">
                                    {t("strategy.scorecard.latest", "Latest")}
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-semibold">
                                    {t("strategy.scorecard.achievement", "Achieved")}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {objective.kpis.map((kpi) => (
                                  <tr key={kpi.kpi_id} className="border-t border-border/30">
                                    <td className="py-1.5 pr-3">
                                      {kpi.name}
                                      {kpi.direction === "lower_is_better" ? (
                                        <span className="ml-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                                          {t("strategy.scorecard.lower", "lower better")}
                                        </span>
                                      ) : null}
                                      {kpi.is_stale ? (
                                        <span className="ml-1.5 text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                          {t("strategy.overview.stale_word", "stale")}
                                        </span>
                                      ) : null}
                                    </td>
                                    <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                                      {kpi.baseline} → {kpi.target}
                                      {kpi.unit ? ` ${kpi.unit}` : ""}
                                    </td>
                                    <td className="py-1.5 pr-3 tabular-nums">
                                      {kpi.latest === null ? "—" : kpi.latest}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                                      {/* Raw achievement, which can exceed 100
                                          or go negative — the roll-up clamps,
                                          the reading should not. */}
                                      {kpi.achievement_percent === null
                                        ? "—"
                                        : `${kpi.achievement_percent.toFixed(1)}%`}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </>
      )}

      {/* Add objective */}
      <Dialog open={objectiveOpen} onOpenChange={setObjectiveOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.scorecard.add_objective", "Add Objective")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "strategy.scorecard.add_objective_desc",
                  "Weights are normalised against whatever is present, so they do not have to add up to 100.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="o-perspective">
                {t("strategy.scorecard.perspective", "Perspective")}
              </Label>
              <select
                id="o-perspective"
                value={form.perspective_id}
                onChange={(event) => setForm({ ...form, perspective_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("strategy.scorecard.unassigned", "Unassigned")}</option>
                {perspectives.map((perspective) => (
                  <option key={perspective.id} value={perspective.id}>
                    {perspective.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-code">{t("strategy.common.code", "Code")}</Label>
              <Input
                id="o-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-weight">{t("strategy.common.weight", "Weight")}</Label>
              <Input
                id="o-weight"
                type="number"
                min={0}
                step="0.5"
                value={form.weight}
                onChange={(event) => setForm({ ...form, weight: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="o-title">{t("strategy.common.title_field", "Title")}</Label>
              <Input
                id="o-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={t("strategy.scorecard.title_hint", "Grow revenue without buying it with margin")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-owner">{t("strategy.common.owner", "Owner")}</Label>
              <Input
                id="o-owner"
                value={form.owner_name}
                onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-dept">{t("strategy.scorecard.department", "Department")}</Label>
              <Input
                id="o-dept"
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setObjectiveOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveObjective.mutate()}
              disabled={saveObjective.isPending || !form.code.trim() || !form.title.trim()}
            >
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
