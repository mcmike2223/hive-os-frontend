"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Egg, MapPinned, Wheat } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { agricultureApi } from "@/modules/agriculture/api";
import type { AgricultureOverview } from "@/modules/agriculture/types";
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

const kg = (value: unknown) =>
  `${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Planting state is an ordered condition scale, so it earns the reserved
 * severity ramp: a failed crop is what costs the season.
 */
const STATUS_SEVERITY: Record<string, string> = {
  failed: "critical",
  planned: "warning",
  planted: "caution",
  growing: "caution",
  harvesting: "good",
  harvested: "good",
};

export default function FarmOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(364));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [preset, setPreset] = React.useState<number | null>(365);

  const overviewQuery = useQuery({
    queryKey: ["agriculture", "overview", from, to],
    queryFn: () => agricultureApi.overview({ from, to }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const raw: AgricultureOverview | undefined = overviewQuery.data?.data;
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
          {t("agriculture.overview.title", "Farm Overview")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "agriculture.overview.subtitle",
            "What the land actually produced against what it was expected to, what that cost per kilogram, and what is still waiting to be picked.",
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
              {t("agriculture.overview.last_days", "Last {n} days").replace("{n}", String(days))}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="ag-from" className="text-xs">
            {t("agriculture.common.from", "From")}
          </Label>
          <Input
            id="ag-from"
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
          <Label htmlFor="ag-to" className="text-xs">
            {t("agriculture.common.to", "To")}
          </Label>
          <Input
            id="ag-to"
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
        <LoadingPanel label={t("agriculture.common.loading", "Loading the farm...")} />
      ) : !raw ? (
        <EmptyPanel
          label={t("agriculture.overview.unavailable", "Farm metrics are not available right now.")}
        />
      ) : (
        <>
          {/* One hero figure. Tonnage alone says nothing about whether the
              season went well; against expectation, it says everything. */}
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("agriculture.overview.achievement", "Yield against expectation")}
              </p>
              <p className="mt-1 text-5xl font-black leading-none tracking-tight">
                {raw.production?.yield_achievement_percent === null
                  ? "—"
                  : `${n(raw.production?.yield_achievement_percent).toFixed(1)}`}
                {raw.production?.yield_achievement_percent !== null ? (
                  <span className="ml-1 text-2xl font-bold text-muted-foreground">%</span>
                ) : null}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("agriculture.overview.achievement_meta", "{kg} harvested across {n} plantings")
                  .replace("{kg}", kg(raw.production?.harvested_kg))
                  .replace("{n}", String(n(raw.production?.scored_plantings)))}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {/* Crops still in the ground are excluded rather than scored
                    zero, which would drag the figure down with unfinished work. */}
                {t(
                  "agriculture.overview.achievement_note",
                  "Crops still growing are not scored yet.",
                )}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<Wheat className="h-4 w-4" />}
                label={t("agriculture.overview.cost_per_kg", "Cost per kilogram")}
                value={
                  raw.production?.cost_per_kg === null
                    ? "—"
                    : `ETB ${n(raw.production?.cost_per_kg).toFixed(2)}`
                }
                meta={t("agriculture.overview.cost_meta", "{v} of field work").replace(
                  "{v}",
                  money(raw.production?.production_cost),
                )}
              />
              <StatTile
                icon={<AlertTriangle className="h-4 w-4" />}
                label={t("agriculture.overview.waste", "Waste")}
                value={`${n(raw.production?.waste_percent).toFixed(1)}%`}
                // Measured against everything picked, not the saleable part.
                meta={t("agriculture.overview.waste_meta", "{w} of {g} picked")
                  .replace("{w}", kg(raw.production?.waste_kg))
                  .replace("{g}", kg(raw.production?.gross_kg))}
                alert={n(raw.production?.waste_percent) > 10}
              />
              <StatTile
                icon={<MapPinned className="h-4 w-4" />}
                label={t("agriculture.overview.land", "Land in use")}
                value={`${n(raw.land?.utilisation_percent).toFixed(0)}%`}
                meta={t("agriculture.overview.land_meta", "{idle} ha idle of {total} ha")
                  .replace("{idle}", n(raw.land?.idle_hectares).toLocaleString())
                  .replace("{total}", n(raw.land?.total_hectares).toLocaleString())}
                alert={n(raw.land?.over_planted) > 0}
              />
              <StatTile
                icon={<Egg className="h-4 w-4" />}
                label={t("agriculture.overview.livestock", "Livestock")}
                value={n(raw.livestock?.head).toLocaleString()}
                meta={t("agriculture.overview.livestock_meta", "across {n} groups").replace(
                  "{n}",
                  String(n(raw.livestock?.groups)),
                )}
              />
            </div>
          </section>

          {n(raw.land?.over_planted) > 0 ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">
              {/* Surfaced rather than clamped: it means an area was mistyped,
                  and every yield built on it is wrong. */}
              {t(
                "agriculture.overview.over_planted",
                "{n} field(s) have more land planted than they have. Check the areas — every yield computed from them is wrong until it is fixed.",
              ).replace("{n}", String(n(raw.land?.over_planted)))}
            </div>
          ) : null}

          <Panel
            title={t("agriculture.overview.overdue", "Still in the ground")}
            description={t(
              "agriculture.overview.overdue_desc",
              "Past the harvest date worked out from the crop when it was planted, longest overdue first.",
            )}
          >
            {(raw.overdue ?? []).length === 0 ? (
              <EmptyPanel
                label={t("agriculture.overview.nothing_overdue", "Nothing is overdue for harvest.")}
              />
            ) : (
              <div className="space-y-1.5">
                {raw.overdue.slice(0, 8).map((row) => (
                  <div
                    key={row.planting_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {row.crop ?? "—"} · {row.field ?? "—"}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {row.reference} · {row.area_hectares} ha
                        {row.harvested_kg > 0
                          ? ` · ${kg(row.harvested_kg)} ${t("agriculture.overview.picked_so_far", "picked so far")}`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-semibold text-destructive">
                        {t("agriculture.overview.days_overdue", "{n} days overdue").replace(
                          "{n}",
                          String(row.days_overdue),
                        )}
                      </span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {row.expected_harvest_on ?? "—"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <RankedBarChart
              title={t("agriculture.overview.by_crop", "Yield by crop")}
              description={t(
                "agriculture.overview.by_crop_desc",
                "Kilograms per hectare across the whole crop, weighted by area — a good half-hectare must not cancel out ten bad ones.",
              )}
              rows={(raw.crops ?? [])
                // A crop still in the ground has picked nothing yet, and a
                // zero bar beside real yields reads as a failure rather than
                // as work in progress.
                .filter((row) => row.yield_per_hectare !== null && row.harvested_kg > 0)
                .map((row) => ({
                  key: row.crop,
                  label: row.crop,
                  value: n(row.yield_per_hectare),
                  meta:
                    row.achievement_percent === null
                      ? undefined
                      : t("agriculture.overview.of_expected", "{n}% of expected").replace(
                          "{n}",
                          row.achievement_percent.toFixed(0),
                        ),
                }))}
              valueLabel={t("agriculture.overview.kg_per_ha", "kg per hectare")}
              emptyLabel={t("agriculture.overview.no_crops", "Nothing harvested yet.")}
              dimmed={refetching}
            />

            <SeverityBands
              title={t("agriculture.overview.planting_states", "Plantings by state")}
              description={t(
                "agriculture.overview.planting_states_desc",
                "What is in the ground, what came off it, and what was lost.",
              )}
              bands={(raw.plantings?.by_status ?? []).map((row) => ({
                key: row.status,
                label: row.label,
                severity: STATUS_SEVERITY[row.status] ?? "caution",
                count: n(row.count),
              }))}
              emptyLabel={t("agriculture.overview.no_plantings", "Nothing planted yet.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("agriculture.overview.by_grade", "Harvest by grade")}
              description={t(
                "agriculture.overview.by_grade_desc",
                "Saleable weight only — waste is counted separately rather than folded in.",
              )}
              rows={(raw.production?.by_grade ?? []).map((row) => ({
                key: row.grade,
                label: row.label,
                value: n(row.kg),
              }))}
              valueLabel={t("agriculture.overview.kilograms", "Kilograms")}
              emptyLabel={t("agriculture.overview.no_crops", "Nothing harvested yet.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("agriculture.overview.land_by_field", "Land committed by field")}
              description={t(
                "agriculture.overview.land_by_field_desc",
                "Hectares under a live crop. Harvested land is free again and drops out.",
              )}
              rows={(raw.land?.by_field ?? []).map((row) => ({
                key: String(row.field_id),
                label: row.name,
                value: n(row.planted_hectares),
                meta: t("agriculture.overview.of_hectares", "of {n} ha").replace(
                  "{n}",
                  String(row.hectares),
                ),
              }))}
              valueLabel={t("agriculture.overview.hectares", "Hectares")}
              emptyLabel={t("agriculture.overview.no_fields", "No fields registered.")}
              dimmed={refetching}
            />
          </div>

          {(raw.livestock?.production ?? []).length > 0 ? (
            <Panel
              title={t("agriculture.overview.herds", "Livestock")}
              description={t(
                "agriculture.overview.herds_desc",
                "Production per head, and mortality measured against the herd including the animals already lost.",
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-3 font-semibold">{t("agriculture.overview.group", "Group")}</th>
                      <th className="pb-2 pr-3 font-semibold">{t("agriculture.overview.head", "Head")}</th>
                      <th className="pb-2 pr-3 font-semibold">
                        {t("agriculture.overview.per_head", "Per head")}
                      </th>
                      <th className="pb-2 pr-6 font-semibold">
                        {t("agriculture.overview.mortality", "Mortality")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {raw.livestock.production.map((group) => (
                      <tr key={group.group_id} className="border-b border-border/40 last:border-0">
                        <td className="py-2 pr-3">
                          <span className="block font-medium">{group.name}</span>
                          <span className="block text-[11px] capitalize text-muted-foreground">
                            {group.species} · {group.purpose}
                          </span>
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{group.head.toLocaleString()}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {/* Null with no animals: there is no per-head figure
                              for a group that has been sold off. */}
                          {group.per_head === null
                            ? "—"
                            : group.per_head.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              })}
                        </td>
                        <td className="py-2 pr-6 tabular-nums">
                          {group.mortality_percent === null ? (
                            "—"
                          ) : (
                            <span
                              className={
                                group.mortality_percent > 5
                                  ? "font-semibold text-destructive"
                                  : "text-muted-foreground"
                              }
                            >
                              {group.mortality_percent.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
