"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Layers, Repeat, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { internalAuditApi } from "@/modules/internal-audit/api";
import type { AuditOverview } from "@/modules/internal-audit/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart, SeverityBands } from "@/modules/shared/charts/charts";

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const PRESETS = [90, 365, 730] as const;

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Finding severity and risk band are both ordered risk scales, so they earn
 * the reserved severity ramp. Critical is what the board hears about.
 */
const SEVERITY_RAMP: Record<string, string> = {
  critical: "critical",
  high: "warning",
  moderate: "caution",
  low: "good",
};

export default function AuditOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(364));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [preset, setPreset] = React.useState<number | null>(365);

  const overviewQuery = useQuery({
    queryKey: ["internal-audit", "overview", from, to],
    queryFn: () => internalAuditApi.overview({ from, to }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const raw: AuditOverview | undefined = overviewQuery.data?.data;
  const refetching = overviewQuery.isFetching && !overviewQuery.isLoading;

  const applyPreset = (days: number) => {
    setPreset(days);
    setFrom(isoDaysAgo(days - 1));
    setTo(isoDaysAgo(0));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("internal_audit.overview.title", "Internal Audit")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "internal_audit.overview.subtitle",
            "Whether the actions management agreed to were actually done by the date they agreed — which is the only evidence that auditing changed anything.",
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
              {t("internal_audit.overview.last_days", "Last {n} days").replace("{n}", String(days))}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="ia-from" className="text-xs">
            {t("internal_audit.common.from", "From")}
          </Label>
          <Input
            id="ia-from"
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
          <Label htmlFor="ia-to" className="text-xs">
            {t("internal_audit.common.to", "To")}
          </Label>
          <Input
            id="ia-to"
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
        <LoadingPanel label={t("internal_audit.common.loading", "Loading audit position...")} />
      ) : !raw ? (
        <EmptyPanel
          label={t("internal_audit.overview.unavailable", "Audit metrics are not available right now.")}
        />
      ) : (
        <>
          {/* One hero figure. Findings are easy to write; the only thing that
              proves the function works is remediation landing on time. */}
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("internal_audit.overview.on_time", "Remediation on time")}
              </p>
              <p className="mt-1 text-5xl font-black leading-none tracking-tight">
                {n(raw.remediation?.on_time_percent).toFixed(1)}
                <span className="ml-1 text-2xl font-bold text-muted-foreground">%</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  "internal_audit.overview.on_time_meta",
                  "{completed} completed · average {days} days late",
                )
                  .replace("{completed}", String(n(raw.remediation?.completed)))
                  .replace("{days}", n(raw.remediation?.average_days_late).toFixed(1))}
              </p>
              {n(raw.remediation?.awaiting_verification) > 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {/* Management saying it is done is not audit checking it is. */}
                  {t(
                    "internal_audit.overview.awaiting_meta",
                    "{n} completed but not yet verified by audit",
                  ).replace("{n}", String(n(raw.remediation?.awaiting_verification)))}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<AlertTriangle className="h-4 w-4" />}
                label={t("internal_audit.overview.overdue", "Actions overdue")}
                value={n(raw.remediation?.overdue).toLocaleString()}
                meta={t("internal_audit.overview.worst_meta", "worst is {n} days past due").replace(
                  "{n}",
                  String(n(raw.remediation?.worst_overdue_days)),
                )}
                alert={n(raw.remediation?.overdue) > 0}
              />
              <StatTile
                icon={<ShieldCheck className="h-4 w-4" />}
                label={t("internal_audit.overview.severe_open", "Severe findings open")}
                value={n(raw.findings?.severe_open).toLocaleString()}
                meta={t("internal_audit.overview.open_meta", "of {n} open in total").replace(
                  "{n}",
                  String(n(raw.findings?.open)),
                )}
                alert={n(raw.findings?.severe_open) > 0}
              />
              <StatTile
                icon={<Repeat className="h-4 w-4" />}
                label={t("internal_audit.overview.repeats", "Repeat findings")}
                value={`${n(raw.findings?.repeat_percent).toFixed(1)}%`}
                // The measure that says whether remediation closes causes or
                // just closes tickets.
                meta={t("internal_audit.overview.repeat_meta", "{n} repeated an earlier fix").replace(
                  "{n}",
                  String(n(raw.findings?.repeats)),
                )}
                alert={n(raw.findings?.repeats) > 0}
              />
              <StatTile
                icon={<Layers className="h-4 w-4" />}
                label={t("internal_audit.overview.coverage", "High-risk coverage")}
                value={`${n(raw.coverage?.high_risk_coverage_percent).toFixed(0)}%`}
                meta={t("internal_audit.overview.coverage_meta", "{covered} of {total} current").
                  replace("{covered}", String(n(raw.coverage?.high_risk_covered))).
                  replace("{total}", String(n(raw.coverage?.high_risk_areas)))}
                alert={
                  n(raw.coverage?.high_risk_covered) < n(raw.coverage?.high_risk_areas)
                }
              />
            </div>
          </section>

          <Panel
            title={t("internal_audit.overview.outstanding", "What management still owes")}
            description={t(
              "internal_audit.overview.outstanding_desc",
              "Agreed actions not yet completed, most overdue first. Overdue is worked out from the due date on every read, so nothing here can go quietly stale.",
            )}
          >
            {(raw.outstanding ?? []).length === 0 ? (
              <EmptyPanel
                label={t("internal_audit.overview.nothing_outstanding", "Nothing outstanding.")}
              />
            ) : (
              <div className="space-y-1.5">
                {raw.outstanding.slice(0, 8).map((row) => (
                  <Link
                    key={row.action_id}
                    href={`/dashboard/internal-audit/findings?id=${row.finding_id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.description}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {row.finding_number}
                        {row.finding_title ? ` · ${row.finding_title}` : ""} · {row.owner}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={`block text-xs font-semibold ${
                          row.is_overdue ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {row.is_overdue
                          ? t("internal_audit.overview.days_overdue", "{n} days overdue").replace(
                              "{n}",
                              String(n(row.days_overdue)),
                            )
                          : t("internal_audit.overview.due", "due {d}").replace(
                              "{d}",
                              String(row.due_on ?? "—"),
                            )}
                      </span>
                      <span className="block text-[11px] capitalize text-muted-foreground">
                        {row.severity ?? "—"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <SeverityBands
              title={t("internal_audit.overview.open_by_severity", "Open findings by severity")}
              description={t(
                "internal_audit.overview.open_by_severity_desc",
                "Accepted risk counts as open — the gap is still there, somebody has just decided to carry it.",
              )}
              bands={(raw.findings?.by_severity ?? []).map((row) => ({
                key: row.severity,
                label: row.label,
                severity: SEVERITY_RAMP[row.severity] ?? "caution",
                count: n(row.count),
              }))}
              emptyLabel={t("internal_audit.overview.no_findings", "No findings open.")}
              dimmed={refetching}
            />

            <SeverityBands
              title={t("internal_audit.overview.overdue_by_severity", "Overdue actions by severity")}
              description={t(
                "internal_audit.overview.overdue_by_severity_desc",
                "Ten late low-severity actions are not the same problem as one late critical one.",
              )}
              bands={(raw.remediation?.overdue_by_severity ?? []).map((row) => ({
                key: row.severity,
                label: row.label,
                severity: SEVERITY_RAMP[row.severity] ?? "caution",
                count: n(row.count),
              }))}
              emptyLabel={t("internal_audit.overview.nothing_overdue", "Nothing overdue.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("internal_audit.overview.by_area", "Where the findings come from")}
              description={t(
                "internal_audit.overview.by_area_desc",
                "Open findings per area of the audit universe.",
              )}
              rows={(raw.findings?.by_area ?? []).map((row) => ({
                key: String(row.area_id),
                label: row.area,
                value: n(row.open_findings),
                meta: t("internal_audit.overview.risk_band", "{band} risk").replace(
                  "{band}",
                  row.risk_band,
                ),
              }))}
              valueLabel={t("internal_audit.overview.findings", "Findings")}
              emptyLabel={t("internal_audit.overview.no_area_findings", "No findings raised yet.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("internal_audit.overview.opinions", "Opinions issued")}
              description={t(
                "internal_audit.overview.opinions_desc",
                "Closed engagements only — an opinion is the product of finished work, so it cannot be issued before then.",
              )}
              rows={(raw.engagements?.by_opinion ?? []).map((row) => ({
                key: row.opinion,
                label: row.label,
                value: n(row.count),
              }))}
              valueLabel={t("internal_audit.overview.engagements", "Engagements")}
              emptyLabel={t("internal_audit.overview.no_opinions", "No engagements closed yet.")}
              dimmed={refetching}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={t("internal_audit.overview.plan", "The plan and the universe")}
              description={t(
                "internal_audit.overview.plan_desc",
                "An area that has never been audited counts as overdue from the day it enters the universe — treating it as fresh would hide exactly the places nobody has looked.",
              )}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <StatTile
                  label={t("internal_audit.overview.areas", "Areas")}
                  value={n(raw.coverage?.areas).toLocaleString()}
                  meta={t("internal_audit.overview.high_risk_meta", "{n} high or critical").replace(
                    "{n}",
                    String(n(raw.coverage?.high_risk_areas)),
                  )}
                />
                <StatTile
                  label={t("internal_audit.overview.overdue_audit", "Overdue for audit")}
                  value={n(raw.coverage?.overdue_for_audit).toLocaleString()}
                  meta={t("internal_audit.overview.never_meta", "{n} never audited at all").replace(
                    "{n}",
                    String(n(raw.coverage?.never_audited)),
                  )}
                  alert={n(raw.coverage?.overdue_for_audit) > 0}
                />
                <StatTile
                  label={t("internal_audit.overview.engagements_open", "Engagements open")}
                  value={n(raw.engagements?.open).toLocaleString()}
                  meta={t("internal_audit.overview.overrunning_meta", "{n} past their planned end").replace(
                    "{n}",
                    String(n(raw.engagements?.overrunning)),
                  )}
                  alert={n(raw.engagements?.overrunning) > 0}
                />
                <StatTile
                  label={t("internal_audit.overview.hours", "Audit hours")}
                  value={n(raw.engagements?.actual_hours).toLocaleString()}
                  meta={t("internal_audit.overview.hours_meta", "against {n} planned").replace(
                    "{n}",
                    String(n(raw.engagements?.planned_hours)),
                  )}
                />
              </div>

              <div className="mt-4 border-t border-border/40 pt-4">
                <p className="text-xs text-muted-foreground">
                  {t("internal_audit.overview.impact", "Financial impact quantified: {v}").replace(
                    "{v}",
                    money(raw.findings?.financial_impact),
                  )}
                  {" · "}
                  {t("internal_audit.overview.close_time", "average {n} days to close").replace(
                    "{n}",
                    n(raw.findings?.average_days_to_close).toFixed(0),
                  )}
                </p>
              </div>
            </Panel>

            <Panel
              title={t("internal_audit.overview.risk_register", "Risk register")}
              description={t(
                "internal_audit.overview.risk_register_desc",
                "Banded on residual score — what is left after controls is what the business actually carries.",
              )}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label={t("internal_audit.overview.risks", "Risks")}
                  value={n(raw.risks?.total).toLocaleString()}
                  meta={t("internal_audit.overview.accepted_meta", "{n} accepted outright").replace(
                    "{n}",
                    String(n(raw.risks?.accepted)),
                  )}
                />
                <StatTile
                  label={t("internal_audit.overview.review_overdue", "Reviews overdue")}
                  value={n(raw.risks?.review_overdue).toLocaleString()}
                  alert={n(raw.risks?.review_overdue) > 0}
                />
                <StatTile
                  label={t("internal_audit.overview.control_effect", "Controls remove")}
                  value={`${n(raw.risks?.average_control_effectiveness).toFixed(0)}%`}
                  meta={t("internal_audit.overview.control_meta", "of inherent risk on average")}
                />
              </div>

              {n(raw.risks?.impossible_residuals) > 0 ? (
                <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
                  {/* Surfaced rather than silently clamped: this is a register
                      that needs correcting, not a finding about the business. */}
                  {t(
                    "internal_audit.overview.impossible",
                    "{n} risk(s) score worse after controls than before — the register needs correcting.",
                  ).replace("{n}", String(n(raw.risks?.impossible_residuals)))}
                </p>
              ) : null}

              {(raw.risks?.top ?? []).length > 0 ? (
                <div className="mt-4 space-y-1.5 border-t border-border/40 pt-4">
                  {raw.risks.top.slice(0, 6).map((risk) => (
                    <div key={risk.risk_id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{risk.title}</span>
                        <span className="block text-[11px] capitalize text-muted-foreground">
                          {risk.code} · {risk.treatment}
                          {risk.review_overdue
                            ? ` · ${t("internal_audit.overview.review_late", "review overdue")}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-semibold tabular-nums">
                          {risk.residual_score}
                          <span className="text-muted-foreground"> / {risk.inherent_score}</span>
                        </span>
                        <span className="block text-[11px] capitalize text-muted-foreground">
                          {risk.risk_band}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
