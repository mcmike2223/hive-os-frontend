"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/store/use-translation";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { agricultureApi } from "@/modules/agriculture/api";
import type { AgricultureHarvest } from "@/modules/agriculture/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const GRADE_TONE: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  B: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  C: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  reject: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export default function HarvestsPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(364));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [grade, setGrade] = React.useState("");

  const harvestsQuery = useQuery({
    queryKey: ["agriculture", "harvests", from, to, grade],
    queryFn: () =>
      agricultureApi
        .listHarvests({ limit: 50, from, to, ...(grade ? { quality_grade: grade } : {}) })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const overviewQuery = useQuery({
    queryKey: ["agriculture", "overview-harvests", from, to],
    queryFn: () => agricultureApi.overview({ from, to }).then((res) => res.data),
  });

  const harvests = (harvestsQuery.data?.data ?? []) as AgricultureHarvest[];
  const production = overviewQuery.data?.data?.production;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("agriculture.harvests.title", "Harvests")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "agriculture.harvests.subtitle",
            "Every pick, with the yield per hectare each one produced against the area its planting occupies. Waste is measured against everything that came off the field, not just the saleable part.",
          )}
        </p>
      </div>

      {production ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("agriculture.harvests.saleable", "Saleable")}
            value={`${n(production.harvested_kg).toLocaleString()} kg`}
            meta={t("agriculture.harvests.events_meta", "across {n} picks").replace(
              "{n}",
              String(n(production.harvest_events)),
            )}
          />
          <StatTile
            label={t("agriculture.harvests.gross", "Gross picked")}
            value={`${n(production.gross_kg).toLocaleString()} kg`}
          />
          <StatTile
            label={t("agriculture.overview.waste", "Waste")}
            value={`${n(production.waste_percent).toFixed(1)}%`}
            meta={`${n(production.waste_kg).toLocaleString()} kg`}
            alert={n(production.waste_percent) > 10}
          />
          <StatTile
            label={t("agriculture.overview.cost_per_kg", "Cost per kilogram")}
            value={
              production.cost_per_kg === null ? "—" : `ETB ${n(production.cost_per_kg).toFixed(2)}`
            }
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="hv-from" className="text-xs">
            {t("agriculture.common.from", "From")}
          </Label>
          <Input
            id="hv-from"
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 w-[9.5rem]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hv-to" className="text-xs">
            {t("agriculture.common.to", "To")}
          </Label>
          <Input
            id="hv-to"
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 w-[9.5rem]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hv-grade" className="text-xs">
            {t("agriculture.plantings.grade", "Grade")}
          </Label>
          <select
            id="hv-grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("agriculture.common.any", "Any")}</option>
            {["A", "B", "C", "reject"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Panel
        title={t("agriculture.harvests.list", "Picks")}
        description={t(
          "agriculture.harvests.list_desc",
          "The yield shown is what that single pick produced. A planting picked repeatedly sums them, which is why one row can look small against the crop as a whole.",
        )}
      >
        {harvestsQuery.isLoading ? (
          <LoadingPanel label={t("agriculture.common.loading", "Loading harvests...")} />
        ) : harvests.length === 0 ? (
          <EmptyPanel label={t("agriculture.harvests.none", "Nothing picked in this window.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.harvests.date", "Date")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.plantings.crop", "Crop")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.harvests.saleable", "Saleable")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.overview.waste", "Waste")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.plantings.yield", "Yield / ha")}</th>
                  <th className="pb-2 pr-6 font-semibold">{t("agriculture.plantings.grade", "Grade")}</th>
                </tr>
              </thead>
              <tbody>
                {harvests.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {String(row.harvested_on).slice(0, 10)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{row.crop}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {row.season ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(row.quantity_kg).toLocaleString()} kg
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(row.waste_kg).toLocaleString()} kg
                      {row.waste_percent !== null && row.waste_percent !== undefined ? (
                        <span
                          className={`block text-[11px] ${
                            row.waste_percent > 10
                              ? "font-semibold text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {row.waste_percent.toFixed(1)}%{" "}
                          {t("agriculture.harvests.of_gross", "of gross")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(row.yield_per_hectare).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="py-2 pr-6">
                      {row.quality_grade ? (
                        <Badge
                          variant="outline"
                          className={`border-transparent text-[10px] font-black uppercase tracking-widest ${
                            GRADE_TONE[row.quality_grade] ?? ""
                          }`}
                        >
                          {row.quality_grade}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
