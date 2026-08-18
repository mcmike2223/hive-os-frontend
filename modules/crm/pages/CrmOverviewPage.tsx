"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Handshake, Target, UserPlus } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crmApi } from "@/modules/crm/api";
import type { CrmOverview } from "@/modules/crm/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart, SeverityBands } from "@/modules/shared/charts/charts";

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const PRESETS = [30, 90, 365] as const;

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Lead status is an ordered progression, so it earns the reserved severity
 * ramp: converted is the good end, disqualified the one to learn from.
 */
const LEAD_SEVERITY: Record<string, string> = {
  converted: "good",
  qualified: "caution",
  contacted: "caution",
  new: "warning",
  disqualified: "critical",
};

export default function CrmOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(89));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [preset, setPreset] = React.useState<number | null>(90);
  const [pipelineId, setPipelineId] = React.useState<string>("");

  const overviewQuery = useQuery({
    queryKey: ["crm", "overview", from, to, pipelineId],
    queryFn: () =>
      crmApi
        .overview({ from, to, ...(pipelineId ? { pipeline_id: Number(pipelineId) } : {}) })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const raw: CrmOverview | undefined = overviewQuery.data?.data;
  const refetching = overviewQuery.isFetching && !overviewQuery.isLoading;

  const applyPreset = (days: number) => {
    setPreset(days);
    setFrom(isoDaysAgo(days - 1));
    setTo(isoDaysAgo(0));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("crm.overview.title", "CRM Overview")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "crm.overview.subtitle",
            "What is in the funnel, how fast it moves, why deals are lost, and which campaigns actually paid for themselves.",
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
              {t("crm.overview.last_days", "Last {n} days").replace("{n}", String(days))}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="crm-from" className="text-xs">
            {t("crm.common.from", "From")}
          </Label>
          <Input
            id="crm-from"
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
          <Label htmlFor="crm-to" className="text-xs">
            {t("crm.common.to", "To")}
          </Label>
          <Input
            id="crm-to"
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

        {/* The funnel is per pipeline, so the picker sits with the filters it
            belongs to rather than on the chart. */}
        {(raw?.pipelines ?? []).length > 1 ? (
          <div className="space-y-1">
            <Label htmlFor="crm-pipeline" className="text-xs">
              {t("crm.overview.pipeline", "Pipeline")}
            </Label>
            <select
              id="crm-pipeline"
              value={pipelineId}
              onChange={(event) => setPipelineId(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("crm.overview.default_pipeline", "Default")}</option>
              {raw!.pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {overviewQuery.isLoading ? (
        <LoadingPanel label={t("crm.common.loading", "Loading CRM performance...")} />
      ) : !raw ? (
        <EmptyPanel label={t("crm.overview.unavailable", "CRM metrics are not available right now.")} />
      ) : (
        <>
          {/* One hero figure: the weighted forecast is the number a manager can
              actually plan against, not the raw pipeline total. */}
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("crm.overview.weighted", "Weighted forecast")}
              </p>
              <p className="mt-1 text-5xl font-black leading-none tracking-tight">
                {money(raw.pipeline?.weighted_value)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("crm.overview.weighted_meta", "{deals} open deals worth {raw} at full value")
                  .replace("{deals}", String(n(raw.pipeline?.open_deals)))
                  .replace("{raw}", money(raw.pipeline?.open_value))}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<Target className="h-4 w-4" />}
                label={t("crm.overview.win_rate", "Win rate")}
                value={`${n(raw.outcomes?.win_rate_percent).toFixed(0)}%`}
                meta={t("crm.overview.win_meta", "{won} won, {lost} lost")
                  .replace("{won}", String(n(raw.outcomes?.won)))
                  .replace("{lost}", String(n(raw.outcomes?.lost)))}
              />
              <StatTile
                icon={<Handshake className="h-4 w-4" />}
                label={t("crm.overview.cycle", "Average cycle")}
                value={t("crm.overview.days", "{n} days").replace(
                  "{n}",
                  n(raw.outcomes?.average_cycle_days).toFixed(0),
                )}
                meta={t("crm.overview.overdue_meta", "{n} deals past their close date").replace(
                  "{n}",
                  String(n(raw.pipeline?.overdue_deals)),
                )}
                alert={n(raw.pipeline?.overdue_deals) > 0}
              />
              <StatTile
                icon={<UserPlus className="h-4 w-4" />}
                label={t("crm.overview.lead_conversion", "Lead conversion")}
                value={`${n(raw.leads?.conversion_rate_percent).toFixed(0)}%`}
                meta={t("crm.overview.leads_meta", "{open} still open").replace(
                  "{open}",
                  String(n(raw.leads?.open)),
                )}
              />
              <StatTile
                icon={<CalendarClock className="h-4 w-4" />}
                label={t("crm.overview.overdue_activities", "Overdue follow-ups")}
                value={n(raw.activities?.overdue).toLocaleString()}
                meta={t("crm.overview.due_today", "{n} due today").replace(
                  "{n}",
                  String(n(raw.activities?.due_today)),
                )}
                alert={n(raw.activities?.overdue) > 0}
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Funnel in pipeline order — deliberately not sorted by size, or it
                would stop being a funnel. */}
            <ColumnChart
              title={t("crm.overview.funnel", "Deal funnel")}
              description={
                raw.pipeline_name
                  ? t("crm.overview.funnel_desc", "Open deals resting in each stage of {pipeline}.").replace(
                      "{pipeline}",
                      raw.pipeline_name,
                    )
                  : undefined
              }
              rows={(raw.funnel ?? []).map((row) => ({
                key: String(row.stage_id),
                label: row.stage,
                value: n(row.count),
                meta: money(row.value),
              }))}
              valueLabel={t("crm.overview.deals", "Deals")}
              emptyLabel={t("crm.overview.no_deals", "No open deals in this pipeline.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("crm.overview.velocity", "Stage velocity")}
              description={t(
                "crm.overview.velocity_desc",
                "Average days a deal sits in each stage before moving on.",
              )}
              rows={(raw.velocity ?? []).map((row) => ({
                key: String(row.stage_id),
                label: row.stage,
                value: n(row.average_days),
                meta: t("crm.overview.moves", "{n} moves").replace("{n}", String(n(row.moves))),
              }))}
              valueLabel={t("crm.overview.days_label", "Days")}
              emptyLabel={t("crm.overview.no_velocity", "No stage movement recorded yet.")}
              dimmed={refetching}
            />

            <SeverityBands
              title={t("crm.overview.lead_status", "Leads by status")}
              description={t(
                "crm.overview.lead_status_desc",
                "Where captured leads have got to.",
              )}
              bands={(raw.leads?.by_status ?? []).map((row) => ({
                key: row.status,
                label: row.label,
                severity: LEAD_SEVERITY[row.status] ?? "caution",
                count: n(row.count),
              }))}
              emptyLabel={t("crm.overview.no_leads", "No leads captured yet.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("crm.overview.loss_reasons", "Why deals are lost")}
              description={t(
                "crm.overview.loss_reasons_desc",
                "The most actionable thing in a CRM, so it gets its own view.",
              )}
              rows={(raw.outcomes?.loss_reasons ?? []).map((row) => ({
                key: row.reason,
                label: row.reason,
                value: n(row.count),
                meta: money(row.value),
              }))}
              valueLabel={t("crm.overview.deals", "Deals")}
              emptyLabel={t("crm.overview.no_losses", "No deals lost in this range.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("crm.overview.lead_sources", "Where leads come from")}
              description={t(
                "crm.overview.lead_sources_desc",
                "Volume by source, and how many of each actually converted.",
              )}
              rows={(raw.leads?.by_source ?? []).map((row) => ({
                key: row.source,
                label: row.source,
                value: n(row.count),
                meta: t("crm.overview.converted_meta", "{n} converted").replace(
                  "{n}",
                  String(n(row.converted)),
                ),
              }))}
              valueLabel={t("crm.overview.leads_label", "Leads")}
              emptyLabel={t("crm.overview.no_sources", "No lead sources recorded.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("crm.overview.top_accounts", "Top accounts")}
              description={t("crm.overview.top_accounts_desc", "By the value still open with them.")}
              rows={(raw.accounts?.top ?? []).map((row) => ({
                key: String(row.account_id),
                label: row.account,
                value: n(row.open_value),
                meta: t("crm.overview.won_meta", "{amount} won").replace(
                  "{amount}",
                  money(row.won_value),
                ),
              }))}
              valueLabel={t("crm.overview.open_value", "Open value")}
              emptyLabel={t("crm.overview.no_accounts", "No accounts with open deals.")}
              dimmed={refetching}
            />
          </div>

          <Panel
            title={t("crm.overview.campaigns", "Campaign return")}
            description={t(
              "crm.overview.campaigns_desc",
              "Cost per converted lead — what the spend actually bought, not what it reached.",
            )}
          >
            {(raw.campaigns ?? []).length === 0 ? (
              <EmptyPanel label={t("crm.overview.no_campaigns", "No campaigns recorded.")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-semibold">{t("crm.campaigns.campaign", "Campaign")}</th>
                      <th className="pb-2 font-semibold">{t("crm.campaigns.channel", "Channel")}</th>
                      <th className="pb-2 text-right font-semibold">{t("crm.campaigns.spend", "Spend")}</th>
                      <th className="pb-2 text-right font-semibold">{t("crm.overview.leads_label", "Leads")}</th>
                      <th className="pb-2 text-right font-semibold">
                        {t("crm.overview.converted", "Converted")}
                      </th>
                      <th className="pb-2 text-right font-semibold">
                        {t("crm.overview.cost_per", "Cost each")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {raw.campaigns.map((campaign) => (
                      <tr key={campaign.campaign_id} className="border-b border-border/40 last:border-0">
                        <td className="py-2 font-medium">{campaign.name}</td>
                        <td className="py-2 text-xs capitalize text-muted-foreground">
                          {campaign.channel ?? "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums">{money(campaign.actual_cost)}</td>
                        <td className="py-2 text-right tabular-nums">{n(campaign.leads)}</td>
                        <td className="py-2 text-right tabular-nums">{n(campaign.converted)}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {/* Null means nothing converted — reported as such
                              rather than as a division dressed up as a number. */}
                          {campaign.cost_per_conversion === null
                            ? t("crm.overview.none_converted", "—")
                            : money(campaign.cost_per_conversion)}
                        </td>
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
