"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/store/use-translation";

import { Badge } from "@/components/ui/badge";
import { vantageApi } from "@/modules/vantage/api";
import type { VantageDataset } from "@/modules/vantage/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function VantageSourcesPage() {
  const { t } = useTranslation();

  const datasetsQuery = useQuery({
    queryKey: ["vantage", "datasets", "full"],
    queryFn: () => vantageApi.listDatasets({ limit: 100 }).then((res) => res.data),
  });

  const datasets = (datasetsQuery.data?.data ?? []) as VantageDataset[];
  const available = datasets.filter((dataset) => dataset.is_available);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("vantage.sources.title", "Data Sources")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "vantage.sources.subtitle",
            "Every table Vantage is allowed to read, and exactly which of their columns may be aggregated or grouped by. The column lists are an allowlist, not documentation — nothing outside them can ever reach a query.",
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label={t("vantage.sources.total", "Registered sources")}
          value={datasets.length.toLocaleString()}
        />
        <StatTile
          label={t("vantage.sources.readable", "Readable now")}
          value={available.length.toLocaleString()}
        />
        <StatTile
          label={t("vantage.sources.missing", "Needing a module")}
          value={(datasets.length - available.length).toLocaleString()}
          meta={t("vantage.sources.missing_meta", "reported as unavailable, never as zero")}
          alert={datasets.length - available.length > 0}
        />
      </div>

      <Panel
        title={t("vantage.sources.registry", "Registry")}
        description={t(
          "vantage.sources.registry_desc",
          "Availability is re-checked against the live schema on every read, so subscribing to a module makes its source usable immediately.",
        )}
      >
        {datasetsQuery.isLoading ? (
          <LoadingPanel label={t("vantage.common.loading", "Loading sources...")} />
        ) : datasets.length === 0 ? (
          <EmptyPanel label={t("vantage.sources.none", "No sources registered.")} />
        ) : (
          <div className="space-y-2">
            {datasets.map((dataset) => (
              <div key={dataset.id} className="rounded-lg border border-border/50 px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{dataset.name}</span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">
                      {dataset.source_table}
                      {dataset.module_slug ? ` · ${dataset.module_slug}` : ""}
                      {dataset.date_column ? ` · dated by ${dataset.date_column}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Badge
                      variant="outline"
                      className={`border-transparent text-[10px] font-black uppercase tracking-widest ${
                        dataset.is_available
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {dataset.is_available
                        ? t("vantage.overview.readable", "Readable")
                        : t("vantage.overview.not_installed", "Not installed")}
                    </Badge>
                    <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">
                      {t("vantage.overview.metric_count", "{n} metrics").replace(
                        "{n}",
                        String(n(dataset.metrics_count)),
                      )}
                    </span>
                  </span>
                </div>

                <div className="mt-2 grid gap-2 border-t border-border/30 pt-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("vantage.sources.measures", "Measurable")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(dataset.measures ?? []).length === 0
                        ? t("vantage.sources.none_declared", "none declared")
                        : (dataset.measures ?? []).join(", ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("vantage.sources.dimensions", "Groupable")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(dataset.dimensions ?? []).length === 0
                        ? t("vantage.sources.none_declared", "none declared")
                        : (dataset.dimensions ?? []).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
