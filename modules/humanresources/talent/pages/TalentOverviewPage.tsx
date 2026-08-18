"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, PlaneTakeoff, UserMinus, Users } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/store/use-translation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { talentApi } from "@/modules/humanresources/talent/api";
import type {
  OffboardingSummary,
  PipelineRole,
  SuccessionPipeline,
  TrainingSummary,
} from "@/modules/humanresources/talent/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart, SeverityBands } from "@/modules/shared/charts/charts";

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const PRESETS = [30, 90, 365] as const;

/** Coerce at the boundary: decimal casts arrive as strings over JSON. */
const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Readiness is an ordered risk scale, so it earns the reserved severity ramp:
 * anything not ready is the thing to act on.
 */
const READINESS_SEVERITY: Record<string, string> = {
  ready_now: "good",
  ready_1_2_years: "caution",
  ready_3_5_years: "warning",
  not_ready: "critical",
};

type TalentOverview = {
  succession: SuccessionPipeline;
  training: TrainingSummary;
  offboarding: OffboardingSummary;
  travel: {
    total_requests: number;
    open_requests: number;
    awaiting_approval: number;
    in_progress: number;
    estimated_cost: number | string;
    actual_cost: number | string;
    advance_outstanding: number | string;
    unreturned_advance: number | string;
    unsettled_trips: number;
    variance_percent: number | string;
    by_trip_type: Array<{ trip_type: string; count: number; cost: number | string }>;
    by_status: Array<{ status: string; label: string; count: number }>;
    upcoming: Array<{
      id: number;
      request_number: string;
      destination: string;
      purpose: string;
      departure_date: string | null;
      status: string;
      estimated_cost: number | string;
    }>;
  };
  competency: {
    active_competencies: number;
    assessments: number;
    employees_assessed: number;
    average_level: number | string;
    by_category: Array<{ category: string; competencies: number; assessments: number }>;
  };
  development: {
    total_plans: number;
    active_plans: number;
    completed_plans: number;
    overdue_plans: number;
    average_progress_percent: number | string;
  };
};

export default function TalentOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(89));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [preset, setPreset] = React.useState<number | null>(90);

  const overviewQuery = useQuery({
    queryKey: ["hr-talent", "overview", from, to],
    queryFn: () => talentApi.overview({ from, to }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const raw: TalentOverview | undefined = overviewQuery.data?.data;
  const refetching = overviewQuery.isFetching && !overviewQuery.isLoading;

  const applyPreset = (days: number) => {
    setPreset(days);
    setFrom(isoDaysAgo(days - 1));
    setTo(isoDaysAgo(0));
  };

  /**
   * Succession coverage: the share of critical roles that have at least one
   * candidate ready to step in today. Computed from the same role rows the
   * table below lists, so the hero figure and the detail can never disagree.
   */
  const coverage = React.useMemo(() => {
    const roles: PipelineRole[] = raw?.succession?.roles ?? [];
    if (roles.length === 0) return { percent: 0, covered: 0, total: 0 };

    const covered = roles.filter((role) => n(role.ready_now) > 0).length;
    return {
      percent: (covered / roles.length) * 100,
      covered,
      total: roles.length,
    };
  }, [raw]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("hr_talent.overview.title", "Talent Management")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "hr_talent.overview.subtitle",
            "Who can step into the roles that matter, what training is closing the gaps, and which exits are still open.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex gap-1.5">
          {PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={preset === days}
              onClick={() => applyPreset(days)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                preset === days
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("hr_talent.overview.last_days", "Last {n} days").replace("{n}", String(days))}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="talent-from" className="text-xs">
            {t("hr_talent.common.from", "From")}
          </Label>
          <Input
            id="talent-from"
            type="date"
            value={from}
            max={to}
            onChange={(event) => {
              setFrom(event.target.value);
              setPreset(null);
            }}
            className="h-9 w-[9.5rem]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="talent-to" className="text-xs">
            {t("hr_talent.common.to", "To")}
          </Label>
          <Input
            id="talent-to"
            type="date"
            value={to}
            min={from}
            onChange={(event) => {
              setTo(event.target.value);
              setPreset(null);
            }}
            className="h-9 w-[9.5rem]"
          />
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <LoadingPanel label={t("hr_talent.common.loading", "Loading talent metrics...")} />
      ) : !raw ? (
        <EmptyPanel
          label={t("hr_talent.overview.unavailable", "Talent metrics are not available right now.")}
        />
      ) : (
        <>
          {/* One hero figure. Succession coverage is the question this module
              exists to answer: if the critical roles emptied tomorrow, who
              could actually fill them. */}
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("hr_talent.overview.coverage", "Succession coverage")}
              </p>
              <p className="mt-1 text-6xl font-black leading-none tracking-tight">
                {coverage.percent.toFixed(0)}
                <span className="ml-1 text-2xl font-bold text-muted-foreground">%</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  "hr_talent.overview.coverage_meta",
                  "{covered} of {total} critical roles have someone ready now",
                )
                  .replace("{covered}", String(coverage.covered))
                  .replace("{total}", String(coverage.total))}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<Users className="h-4 w-4" />}
                label={t("hr_talent.overview.roles_at_risk", "Roles at risk")}
                value={n(raw.succession?.roles_at_risk).toLocaleString()}
                meta={t("hr_talent.overview.roles_at_risk_meta", "{n} with no successor at all").replace(
                  "{n}",
                  String(n(raw.succession?.roles_without_successor)),
                )}
                alert={n(raw.succession?.roles_at_risk) > 0}
              />
              <StatTile
                icon={<GraduationCap className="h-4 w-4" />}
                label={t("hr_talent.overview.training_completion", "Training completion")}
                value={`${n(raw.training?.completion_rate_percent).toFixed(0)}%`}
                meta={t("hr_talent.overview.training_meta", "{hours} hours delivered").replace(
                  "{hours}",
                  n(raw.training?.training_hours).toLocaleString(),
                )}
              />
              <StatTile
                icon={<PlaneTakeoff className="h-4 w-4" />}
                label={t("hr_talent.overview.advance_outstanding", "Advances outstanding")}
                value={money(raw.travel?.advance_outstanding)}
                meta={t("hr_talent.overview.advance_meta", "{n} trips unsettled, {amount} unreturned")
                  .replace("{n}", String(n(raw.travel?.unsettled_trips)))
                  .replace("{amount}", money(raw.travel?.unreturned_advance))}
                alert={n(raw.travel?.unsettled_trips) > 0}
              />
              <StatTile
                icon={<UserMinus className="h-4 w-4" />}
                label={t("hr_talent.overview.open_exits", "Open exits")}
                value={n(raw.offboarding?.open_cases).toLocaleString()}
                meta={t("hr_talent.overview.exits_meta", "{blocked} blocked, {overdue} overdue tasks")
                  .replace("{blocked}", String(n(raw.offboarding?.blocked_cases)))
                  .replace("{overdue}", String(n(raw.offboarding?.overdue_tasks)))}
                alert={n(raw.offboarding?.blocked_cases) > 0}
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <SeverityBands
              title={t("hr_talent.overview.readiness_mix", "Successor readiness")}
              description={t(
                "hr_talent.overview.readiness_desc",
                "Nominated candidates by how soon they could take the role.",
              )}
              bands={(raw.succession?.readiness_mix ?? []).map((band) => ({
                key: band.readiness,
                label: band.label,
                severity: READINESS_SEVERITY[band.readiness] ?? "caution",
                count: n(band.count),
              }))}
              emptyLabel={t("hr_talent.overview.no_candidates", "No successors nominated yet.")}
              dimmed={refetching}
            />

            {/* Bench strength ascending: the weakest bench is the one that
                needs a name against it, so it leads. */}
            <RankedBarChart
              title={t("hr_talent.overview.weakest_benches", "Thinnest benches")}
              description={t(
                "hr_talent.overview.weakest_benches_desc",
                "Critical roles ordered by how far the successor pool falls short of target.",
              )}
              rows={(raw.succession?.roles ?? [])
                .slice(0, 8)
                .map((role) => ({
                  key: String(role.critical_role_id),
                  label: role.position ?? `#${role.position_id}`,
                  value: Math.max(0, n(role.target_successor_count) - n(role.candidates)),
                  meta: t("hr_talent.overview.bench_meta", "{have}/{want} named, {ready} ready now")
                    .replace("{have}", String(n(role.candidates)))
                    .replace("{want}", String(n(role.target_successor_count)))
                    .replace("{ready}", String(n(role.ready_now))),
                }))
                .filter((row) => row.value > 0)}
              valueLabel={t("hr_talent.overview.successors_short", "Successors short")}
              emptyLabel={t("hr_talent.overview.benches_full", "Every critical role has its target bench.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("hr_talent.overview.training_by_category", "Training by category")}
              description={t(
                "hr_talent.overview.training_by_category_desc",
                "Seats filled per subject area over the selected range.",
              )}
              rows={(raw.training?.by_category ?? []).map((row) => ({
                key: row.category,
                label: row.category,
                value: n(row.enrollments),
                meta: `${n(row.sessions)} ${t("hr_talent.overview.sessions", "sessions")} · ${money(row.cost)}`,
              }))}
              valueLabel={t("hr_talent.overview.enrollments", "Enrollments")}
              emptyLabel={t("hr_talent.overview.no_training", "No training ran in this range.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("hr_talent.overview.travel_by_status", "Travel requests by status")}
              description={t(
                "hr_talent.overview.travel_by_status_desc",
                "Where trips are sitting in the approval and settlement flow.",
              )}
              rows={(raw.travel?.by_status ?? []).map((row) => ({
                key: row.status,
                label: row.label,
                value: n(row.count),
              }))}
              valueLabel={t("hr_talent.overview.requests", "Requests")}
              emptyLabel={t("hr_talent.overview.no_travel", "No travel requested in this range.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("hr_talent.overview.exit_workload", "Exit clearance workload")}
              description={t(
                "hr_talent.overview.exit_workload_desc",
                "Outstanding offboarding tasks by the department that owns them.",
              )}
              rows={(raw.offboarding?.outstanding_by_department ?? []).map((row) => ({
                key: row.department,
                label: row.department,
                value: n(row.outstanding),
                meta: t("hr_talent.overview.blocking_meta", "{n} blocking clearance").replace(
                  "{n}",
                  String(n(row.blocking)),
                ),
              }))}
              valueLabel={t("hr_talent.overview.open_tasks", "Open tasks")}
              emptyLabel={t("hr_talent.overview.no_exit_tasks", "No outstanding exit tasks.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("hr_talent.overview.competency_coverage", "Competency framework")}
              description={t(
                "hr_talent.overview.competency_coverage_desc",
                "Defined competencies per category, and how many people have been assessed against them.",
              )}
              rows={(raw.competency?.by_category ?? []).map((row) => ({
                key: row.category,
                label: row.category,
                value: n(row.competencies),
                meta: t("hr_talent.overview.assessments_meta", "{n} assessments").replace(
                  "{n}",
                  String(n(row.assessments)),
                ),
              }))}
              valueLabel={t("hr_talent.overview.competencies", "Competencies")}
              emptyLabel={t("hr_talent.overview.no_competencies", "No competencies defined yet.")}
              dimmed={refetching}
            />
          </div>

          <Panel
            title={t("hr_talent.overview.upcoming_travel", "Upcoming travel")}
            description={t(
              "hr_talent.overview.upcoming_travel_desc",
              "The next trips due to depart, whatever stage of approval they are at.",
            )}
            action={
              <Link
                href="/dashboard/human-resources/talent/travel"
                className="text-xs font-semibold text-primary hover:underline"
              >
                {t("hr_talent.overview.view_all", "View all")}
              </Link>
            }
          >
            {(raw.travel?.upcoming ?? []).length === 0 ? (
              <EmptyPanel label={t("hr_talent.overview.no_upcoming", "No trips are scheduled.")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-semibold">{t("hr_talent.travel.number", "Request")}</th>
                      <th className="pb-2 font-semibold">{t("hr_talent.travel.destination", "Destination")}</th>
                      <th className="pb-2 font-semibold">{t("hr_talent.travel.departs", "Departs")}</th>
                      <th className="pb-2 font-semibold">{t("hr_talent.common.status", "Status")}</th>
                      <th className="pb-2 text-right font-semibold">
                        {t("hr_talent.travel.estimated", "Estimated")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {raw.travel.upcoming.map((trip) => (
                      <tr key={trip.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2 font-mono text-xs">{trip.request_number}</td>
                        <td className="py-2">
                          <span className="font-medium">{trip.destination}</span>
                          <span className="block text-xs text-muted-foreground">{trip.purpose}</span>
                        </td>
                        <td className="py-2 tabular-nums">{trip.departure_date ?? "—"}</td>
                        <td className="py-2 capitalize">{trip.status.replace(/_/g, " ")}</td>
                        <td className="py-2 text-right tabular-nums">{money(trip.estimated_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
