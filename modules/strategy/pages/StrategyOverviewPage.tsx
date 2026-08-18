"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Gauge, Rocket, Target } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Label } from "@/components/ui/label";
import { strategyApi } from "@/modules/strategy/api";
import type { ScoreBand, StrategyOverview } from "@/modules/strategy/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart, SeverityBands, TrendChart } from "@/modules/shared/charts/charts";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Score bands are an ordered performance scale, so they earn the reserved
 * severity ramp. Unmeasured is deliberately the neutral one — a reporting gap
 * is not a failure, and colouring it as one would misread the business.
 */
const BAND_RAMP: Record<ScoreBand, string> = {
  on_track: "good",
  at_risk: "caution",
  off_track: "critical",
  unmeasured: "warning",
};

export default function StrategyOverviewPage() {
  const { t } = useTranslation();
  const [planId, setPlanId] = React.useState<string>("");

  const overviewQuery = useQuery({
    queryKey: ["strategy", "overview", planId],
    queryFn: () =>
      strategyApi.overview(planId ? { plan_id: Number(planId) } : undefined).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const raw: StrategyOverview | undefined = overviewQuery.data?.data;
  const refetching = overviewQuery.isFetching && !overviewQuery.isLoading;

  const pace = raw?.pace ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("strategy.overview.title", "Strategy")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "strategy.overview.subtitle",
            "One score for the plan, set against how much of the plan's life has already gone — because 40% achieved is good news early and very bad news late.",
          )}
        </p>
      </div>

      {(raw?.plans ?? []).length > 1 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="sp-plan" className="text-xs">
              {t("strategy.overview.plan", "Plan")}
            </Label>
            <select
              id="sp-plan"
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className="h-9 w-72 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("strategy.overview.current_plan", "Current plan")}</option>
              {raw!.plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {overviewQuery.isLoading ? (
        <LoadingPanel label={t("strategy.common.loading", "Loading the scorecard...")} />
      ) : !raw || !raw.plan ? (
        <EmptyPanel
          label={t(
            "strategy.overview.no_plan",
            "No strategic plan has been set up yet.",
          )}
        />
      ) : (
        <>
          {/* One hero figure. The score alone says nothing; the score against
              elapsed time is the whole judgement. */}
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("strategy.overview.plan_score", "Plan score")}
              </p>
              <p className="mt-1 text-5xl font-black leading-none tracking-tight">
                {raw.score === null ? "—" : raw.score.toFixed(1)}
                {raw.score !== null ? (
                  <span className="ml-1 text-2xl font-bold text-muted-foreground">%</span>
                ) : null}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("strategy.overview.elapsed_meta", "{elapsed}% of the plan has gone · {days} days left")
                  .replace("{elapsed}", n(raw.plan.elapsed_percent).toFixed(0))
                  .replace("{days}", String(n(raw.plan.days_remaining)))}
              </p>
              {pace !== null ? (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    pace >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {pace >= 0
                    ? t("strategy.overview.ahead", "{n} points ahead of the clock").replace(
                        "{n}",
                        pace.toFixed(1),
                      )
                    : t("strategy.overview.behind", "{n} points behind the clock").replace(
                        "{n}",
                        Math.abs(pace).toFixed(1),
                      )}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-muted-foreground">{raw.plan.name}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<Target className="h-4 w-4" />}
                label={t("strategy.overview.objectives", "Objectives")}
                value={n(raw.objectives?.total).toLocaleString()}
                meta={t("strategy.overview.no_kpi_meta", "{n} with no measure at all").replace(
                  "{n}",
                  String(n(raw.objectives?.without_kpi)),
                )}
                alert={n(raw.objectives?.without_kpi) > 0}
              />
              <StatTile
                icon={<Gauge className="h-4 w-4" />}
                label={t("strategy.overview.stale", "Stale measures")}
                value={n(raw.kpis?.stale).toLocaleString()}
                // A scorecard full of stale numbers is worse than an empty one,
                // because it looks current.
                meta={t("strategy.overview.measured_meta", "{measured} of {total} reported").
                  replace("{measured}", String(n(raw.measurement?.measured))).
                  replace("{total}", String(n(raw.measurement?.kpis)))}
                alert={n(raw.kpis?.stale) > 0}
              />
              <StatTile
                icon={<Rocket className="h-4 w-4" />}
                label={t("strategy.overview.delivery", "Initiative delivery")}
                value={`${n(raw.initiatives?.weighted_progress_percent).toFixed(0)}%`}
                // Weighted by budget: a nearly-finished small project and a
                // barely-started large one are not equally reassuring.
                meta={t("strategy.overview.delivery_meta", "weighted by budget · {spent} of {budget}")
                  .replace("{spent}", money(raw.initiatives?.spent))
                  .replace("{budget}", money(raw.initiatives?.budget))}
              />
              <StatTile
                icon={<AlertTriangle className="h-4 w-4" />}
                label={t("strategy.overview.at_risk", "Initiatives at risk")}
                value={(raw.initiatives?.at_risk ?? []).length.toLocaleString()}
                meta={t("strategy.overview.at_risk_meta", "{overdue} late · {over} overspending")
                  .replace("{overdue}", String(n(raw.initiatives?.overdue)))
                  .replace("{over}", String(n(raw.initiatives?.overspending)))}
                alert={(raw.initiatives?.at_risk ?? []).length > 0}
              />
            </div>
          </section>

          {(raw.reviews ?? []).length > 1 ? (
            <TrendChart
              title={t("strategy.overview.trend", "Score as reported to the board")}
              description={t(
                "strategy.overview.trend_desc",
                "Each point is what the scorecard genuinely said on the day of that review — later readings do not rewrite the minute book.",
              )}
              points={raw.reviews
                .filter((review) => review.reported_score !== null)
                .map((review) => ({
                  date: review.period_label,
                  reported: n(review.reported_score),
                }))}
              series={[
                {
                  key: "reported",
                  label: t("strategy.overview.reported_score", "Reported score"),
                  suffix: "%",
                },
              ]}
              // The score is a percentage, so the axis is pinned to 100 rather
              // than scaled to the data — otherwise a low-scoring plan looks
              // like it is filling the chart.
              maxValue={100}
              emptyLabel={t("strategy.overview.no_reviews", "No board reviews minuted yet.")}
              dimmed={refetching}
            />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <RankedBarChart
              title={t("strategy.overview.perspectives", "Score by perspective")}
              description={t(
                "strategy.overview.perspectives_desc",
                "Each perspective's own weighted roll-up. Weights are normalised, so a half-built scorecard still scores sensibly.",
              )}
              rows={(raw.perspectives ?? [])
                .filter((row) => row.score !== null)
                .map((row) => ({
                  key: row.code,
                  label: row.name,
                  value: n(row.score),
                  meta: t("strategy.overview.weight_meta", "weight {n}").replace(
                    "{n}",
                    String(n(row.weight)),
                  ),
                }))}
              valueLabel={t("strategy.overview.score", "Score")}
              valueSuffix="%"
              emptyLabel={t("strategy.overview.no_perspectives", "Nothing scored yet.")}
              dimmed={refetching}
            />

            <SeverityBands
              title={t("strategy.overview.objective_bands", "Objectives by standing")}
              description={t(
                "strategy.overview.objective_bands_desc",
                "Unmeasured is a reporting gap rather than a failure, and is counted apart from the rest.",
              )}
              bands={(raw.objectives?.by_status ?? []).map((row) => ({
                key: row.band,
                label: row.label,
                severity: BAND_RAMP[row.band] ?? "caution",
                count: n(row.count),
              }))}
              emptyLabel={t("strategy.overview.no_objectives", "No objectives set.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("strategy.overview.lagging", "Objectives furthest behind")}
              description={t(
                "strategy.overview.lagging_desc",
                "Worst first. Unmeasured objectives are left out — they are a reporting problem, not a performance one, and mixing them hides the real laggards.",
              )}
              rows={(raw.objectives?.lagging ?? []).map((row) => ({
                key: row.code,
                label: row.title,
                value: n(row.score),
                meta: row.owner ?? undefined,
              }))}
              valueLabel={t("strategy.overview.score", "Score")}
              valueSuffix="%"
              emptyLabel={t("strategy.overview.nothing_lagging", "Nothing measured is behind.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("strategy.overview.kpi_directions", "Measures by direction")}
              description={t(
                "strategy.overview.kpi_directions_desc",
                "A scorecard made only of 'higher is better' measures usually means cost and quality are not being tracked at all.",
              )}
              rows={(raw.kpis?.by_direction ?? []).map((row) => ({
                key: row.direction,
                label: row.label,
                value: n(row.count),
              }))}
              valueLabel={t("strategy.overview.kpis", "KPIs")}
              emptyLabel={t("strategy.overview.no_kpis", "No measures defined.")}
              dimmed={refetching}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={t("strategy.overview.worst_kpis", "Measures furthest from target")}
              description={t(
                "strategy.overview.worst_kpis_desc",
                "Achievement is the distance travelled from the baseline, so a measure sitting where it started scores zero however close to target it looks.",
              )}
            >
              {(raw.kpis?.worst ?? []).length === 0 ? (
                <EmptyPanel label={t("strategy.overview.no_kpis", "No measures defined.")} />
              ) : (
                <div className="space-y-1.5">
                  {raw.kpis.worst.slice(0, 6).map((kpi) => (
                    <div
                      key={kpi.kpi_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{kpi.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {/* Both ends shown, because the direction is what
                              makes the number mean anything. */}
                          {t("strategy.overview.kpi_meta", "{baseline} → {target}{unit} · now {latest}")
                            .replace("{baseline}", String(kpi.baseline))
                            .replace("{target}", String(kpi.target))
                            .replace("{unit}", kpi.unit ? ` ${kpi.unit}` : "")
                            .replace("{latest}", kpi.latest === null ? "—" : String(kpi.latest))}
                          {kpi.direction === "lower_is_better"
                            ? ` · ${t("strategy.overview.lower_better", "lower is better")}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={`block text-xs font-semibold tabular-nums ${
                            n(kpi.score) >= 90
                              ? "text-emerald-600 dark:text-emerald-400"
                              : n(kpi.score) >= 70
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-destructive"
                          }`}
                        >
                          {kpi.achievement_percent === null
                            ? "—"
                            : `${kpi.achievement_percent.toFixed(1)}%`}
                        </span>
                        {kpi.is_stale ? (
                          <span className="block text-[11px] text-amber-600 dark:text-amber-400">
                            {t("strategy.overview.stale_word", "stale")}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title={t("strategy.overview.initiatives_at_risk", "Initiatives at risk")}
              description={t(
                "strategy.overview.initiatives_at_risk_desc",
                "Late, or burning budget faster than they are delivering. Neither figure is alarming alone; the gap between them is.",
              )}
            >
              {(raw.initiatives?.at_risk ?? []).length === 0 ? (
                <EmptyPanel
                  label={t("strategy.overview.nothing_at_risk", "No initiative is late or overspending.")}
                />
              ) : (
                <div className="space-y-1.5">
                  {raw.initiatives.at_risk.slice(0, 6).map((row) => (
                    <div
                      key={row.initiative_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {row.owner ?? "—"}
                          {row.ends_on ? ` · due ${row.ends_on}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-semibold tabular-nums">
                          {t("strategy.overview.progress_vs_budget", "{p}% done · {b}% spent")
                            .replace("{p}", String(row.progress_percent))
                            .replace(
                              "{b}",
                              row.budget_used_percent === null
                                ? "—"
                                : row.budget_used_percent.toFixed(0),
                            )}
                        </span>
                        <span className="block text-[11px] font-semibold text-destructive">
                          {[
                            row.is_overdue ? t("strategy.overview.late", "late") : null,
                            row.is_overspending
                              ? t("strategy.overview.overspending", "overspending")
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
