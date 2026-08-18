"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Fuel, Route, Truck, Wrench } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fleetApi } from "@/modules/fleet/api";
import type { FleetOverview } from "@/modules/fleet/types";
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
 * Vehicle status is an ordered condition scale, so it earns the reserved
 * severity ramp: grounded is what stops work today.
 */
const STATUS_SEVERITY: Record<string, string> = {
  active: "good",
  in_service: "caution",
  grounded: "critical",
  disposed: "warning",
};

export default function FleetOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = React.useState(isoDaysAgo(89));
  const [to, setTo] = React.useState(isoDaysAgo(0));
  const [preset, setPreset] = React.useState<number | null>(90);

  const overviewQuery = useQuery({
    queryKey: ["fleet", "overview", from, to],
    queryFn: () => fleetApi.overview({ from, to }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const raw: FleetOverview | undefined = overviewQuery.data?.data;
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
          {t("fleet.overview.title", "Fleet Overview")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "fleet.overview.subtitle",
            "What the fleet costs to run per kilometre, how hard it is working, what is due for service, and which paper expires next.",
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
              {t("fleet.overview.last_days", "Last {n} days").replace("{n}", String(days))}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="fleet-from" className="text-xs">
            {t("fleet.common.from", "From")}
          </Label>
          <Input
            id="fleet-from"
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
          <Label htmlFor="fleet-to" className="text-xs">
            {t("fleet.common.to", "To")}
          </Label>
          <Input
            id="fleet-to"
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
        <LoadingPanel label={t("fleet.common.loading", "Loading fleet performance...")} />
      ) : !raw ? (
        <EmptyPanel label={t("fleet.overview.unavailable", "Fleet metrics are not available right now.")} />
      ) : (
        <>
          {/* One hero figure. Cost per kilometre is what the whole module
              exists to produce, and it is derived from real receipts and real
              distance rather than entered. */}
          <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className={refetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("fleet.overview.cost_per_km", "Cost per kilometre")}
              </p>
              <p className="mt-1 text-5xl font-black leading-none tracking-tight">
                {money(raw.cost?.per_km)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("fleet.overview.cost_meta", "{fuel} fuel + {maintenance} service over {km} km")
                  .replace("{fuel}", money(raw.cost?.fuel_per_km))
                  .replace("{maintenance}", money(raw.cost?.maintenance_per_km))
                  .replace("{km}", n(raw.cost?.distance_km).toLocaleString())}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<Truck className="h-4 w-4" />}
                label={t("fleet.overview.vehicles", "Vehicles")}
                value={n(raw.fleet?.vehicles).toLocaleString()}
                meta={t("fleet.overview.grounded_meta", "{n} grounded").replace(
                  "{n}",
                  String(n(raw.fleet?.grounded)),
                )}
                alert={n(raw.fleet?.grounded) > 0}
              />
              <StatTile
                icon={<Route className="h-4 w-4" />}
                label={t("fleet.overview.distance", "Distance")}
                value={`${n(raw.utilisation?.distance_km).toLocaleString()} km`}
                meta={t("fleet.overview.trips_meta", "{n} completed trips").replace(
                  "{n}",
                  String(n(raw.utilisation?.completed)),
                )}
              />
              <StatTile
                icon={<Fuel className="h-4 w-4" />}
                label={t("fleet.overview.efficiency", "Fuel efficiency")}
                value={`${n(raw.fuel?.average_efficiency_km_per_litre).toFixed(1)} km/L`}
                // The count matters: efficiency is only measurable between two
                // full fills, so this is not an average of every fill.
                meta={t("fleet.overview.measured_meta", "measured across {n} of {total} fills")
                  .replace("{n}", String(n(raw.fuel?.measured_fills)))
                  .replace("{total}", String(n(raw.fuel?.fills)))}
              />
              <StatTile
                icon={<Wrench className="h-4 w-4" />}
                label={t("fleet.overview.due_now", "Service due")}
                value={n(raw.maintenance?.due_now).toLocaleString()}
                meta={t("fleet.overview.due_soon_meta", "{n} falling due soon").replace(
                  "{n}",
                  String(n(raw.maintenance?.due_soon)),
                )}
                alert={n(raw.maintenance?.due_now) > 0}
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <SeverityBands
              title={t("fleet.overview.status_mix", "Vehicles by condition")}
              description={t(
                "fleet.overview.status_mix_desc",
                "What is on the road today and what is not.",
              )}
              bands={(raw.fleet?.by_status ?? []).map((row) => ({
                key: row.status,
                label: row.label,
                severity: STATUS_SEVERITY[row.status] ?? "caution",
                count: n(row.count),
              }))}
              emptyLabel={t("fleet.overview.no_vehicles", "No vehicles on the books.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("fleet.overview.hardest_worked", "Hardest-worked vehicles")}
              description={t(
                "fleet.overview.hardest_worked_desc",
                "Distance covered on completed trips.",
              )}
              rows={(raw.utilisation?.by_vehicle ?? []).map((row) => ({
                key: String(row.vehicle_id),
                label: `#${row.vehicle_id}`,
                value: n(row.distance_km),
                meta: t("fleet.overview.trips_count", "{n} trips").replace(
                  "{n}",
                  String(n(row.trips)),
                ),
              }))}
              valueLabel={t("fleet.overview.km", "Kilometres")}
              emptyLabel={t("fleet.overview.no_trips", "No completed trips in this range.")}
              dimmed={refetching}
            />

            <RankedBarChart
              title={t("fleet.overview.fuel_spend", "Fuel spend by vehicle")}
              description={t(
                "fleet.overview.fuel_spend_desc",
                "Where the fuel budget actually goes, with efficiency where it could be measured.",
              )}
              rows={(raw.fuel?.by_vehicle ?? []).map((row) => ({
                key: String(row.vehicle_id),
                label: `#${row.vehicle_id}`,
                value: n(row.cost),
                meta:
                  row.efficiency === null
                    ? t("fleet.overview.not_measured", "not yet measurable")
                    : `${n(row.efficiency).toFixed(1)} km/L`,
              }))}
              valueLabel={t("fleet.overview.spend", "Spend")}
              emptyLabel={t("fleet.overview.no_fuel", "No fuel recorded in this range.")}
              dimmed={refetching}
            />

            <ColumnChart
              title={t("fleet.overview.service_types", "Service work by type")}
              description={t(
                "fleet.overview.service_types_desc",
                "Preventive against corrective — the balance that says whether the fleet is being looked after or patched up.",
              )}
              rows={(raw.maintenance?.by_type ?? []).map((row) => ({
                key: row.type,
                label: row.label,
                value: n(row.count),
                meta: money(row.cost),
              }))}
              valueLabel={t("fleet.overview.services", "Services")}
              emptyLabel={t("fleet.overview.no_services", "No service work in this range.")}
              dimmed={refetching}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={t("fleet.overview.due_list", "Falling due")}
              description={t(
                "fleet.overview.due_list_desc",
                "Overdue first, then whatever is closest — by distance or by date, whichever bites first.",
              )}
            >
              {(raw.maintenance?.due ?? []).length === 0 ? (
                <EmptyPanel label={t("fleet.overview.nothing_due", "Nothing due in the window.")} />
              ) : (
                <div className="space-y-1.5">
                  {raw.maintenance.due.slice(0, 8).map((row) => (
                    <div
                      key={row.schedule_id}
                      className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{row.vehicle}</span>
                      </span>
                      <span
                        className={`shrink-0 text-xs font-semibold tabular-nums ${
                          row.is_due ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {row.is_due
                          ? t("fleet.overview.overdue", "Overdue")
                          : row.km_remaining !== null
                            ? `${n(row.km_remaining).toLocaleString()} km`
                            : `${row.days_remaining} ${t("fleet.overview.days", "days")}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title={t("fleet.overview.compliance", "Papers and licences")}
              description={t(
                "fleet.overview.compliance_desc",
                "Expiries that ground a vehicle or a driver if nobody acts.",
              )}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label={t("fleet.overview.expired", "Expired")}
                  value={n(raw.compliance?.expired).toLocaleString()}
                  alert={n(raw.compliance?.expired) > 0}
                />
                <StatTile
                  label={t("fleet.overview.expiring", "Within 30 days")}
                  value={n(raw.compliance?.expiring_soon).toLocaleString()}
                  alert={n(raw.compliance?.expiring_soon) > 0}
                />
                <StatTile
                  label={t("fleet.overview.licences", "Lapsed licences")}
                  value={n(raw.compliance?.licences_expired).toLocaleString()}
                  // Unknown dates are a record to chase, not a lapse.
                  meta={t("fleet.overview.unknown_meta", "{n} with no date on file").replace(
                    "{n}",
                    String(n(raw.compliance?.licences_unknown)),
                  )}
                  alert={n(raw.compliance?.licences_expired) > 0}
                />
              </div>

              {(raw.compliance?.upcoming ?? []).length > 0 ? (
                <div className="mt-4 space-y-1.5 border-t border-border/40 pt-4">
                  {raw.compliance.upcoming.slice(0, 6).map((doc) => (
                    <div
                      key={doc.document_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize">
                        {doc.type.replace(/_/g, " ")}
                        <span className="ml-2 text-xs text-muted-foreground">{doc.subject}</span>
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          doc.is_expired ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {doc.is_expired
                          ? t("fleet.overview.expired_days", "{n} days ago").replace(
                              "{n}",
                              String(Math.abs(n(doc.days_to_expiry))),
                            )
                          : t("fleet.overview.in_days", "in {n} days").replace(
                              "{n}",
                              String(n(doc.days_to_expiry)),
                            )}
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
