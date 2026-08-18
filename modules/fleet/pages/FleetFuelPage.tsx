"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
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
import { Switch } from "@/components/ui/switch";
import { fleetApi } from "@/modules/fleet/api";
import type { FleetFuelLog, FleetVehicle } from "@/modules/fleet/types";
import { StatTile } from "@/modules/shared/charts/primitives";
import { RankedBarChart } from "@/modules/shared/charts/charts";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function FleetFuelPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    vehicle_id: "",
    litres: "",
    cost_per_litre: "",
    total_cost: "",
    odometer_km: "",
    is_full_tank: true,
    station: "",
  });

  const listQuery = useQuery({
    queryKey: ["fleet", "fuel", tableQuery],
    queryFn: () =>
      fleetApi.listFuel({ page: tableQuery.page, limit: tableQuery.pageSize }).then((res) => res.data),
  });

  const summaryQuery = useQuery({
    queryKey: ["fleet", "fuel-summary"],
    queryFn: () => fleetApi.fuelSummary().then((res) => res.data),
  });

  const vehiclesQuery = useQuery({
    queryKey: ["fleet", "vehicle-options"],
    queryFn: () => fleetApi.listVehicles({ limit: 100 }).then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["fleet"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      fleetApi.createFuel({
        vehicle_id: Number(form.vehicle_id),
        litres: Number(form.litres),
        // Send whichever the operator supplied; the API derives the other.
        ...(form.cost_per_litre ? { cost_per_litre: Number(form.cost_per_litre) } : {}),
        ...(form.total_cost ? { total_cost: Number(form.total_cost) } : {}),
        ...(form.odometer_km ? { odometer_km: Number(form.odometer_km) } : {}),
        is_full_tank: form.is_full_tank,
        station: form.station || null,
      }),
    onSuccess: () => {
      toast.success(t("fleet.fuel.logged", "Fuel logged."));
      invalidate();
      setOpen(false);
      setForm({ ...form, litres: "", cost_per_litre: "", total_cost: "", odometer_km: "", station: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("fleet.fuel.log_failed", "Could not log the fill."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const summary = summaryQuery.data?.data;
  const vehicles = (vehiclesQuery.data?.data ?? []) as FleetVehicle[];

  const columns = React.useMemo<ColumnDef<FleetFuelLog>[]>(
    () => [
      {
        accessorKey: "filled_on",
        header: t("fleet.fuel.date", "Date"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">{String(row.original.filled_on).slice(0, 10)}</span>
        ),
      },
      {
        id: "vehicle",
        header: t("fleet.vehicles.vehicle", "Vehicle"),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.vehicle?.registration ?? `#${row.original.vehicle_id}`}
          </span>
        ),
      },
      {
        accessorKey: "litres",
        header: t("fleet.fuel.litres", "Litres"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {n(row.original.litres).toLocaleString()}
            {!row.original.is_full_tank ? (
              <Badge variant="outline" className="ml-2 text-[10px]">
                {t("fleet.fuel.partial", "Partial")}
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "odometer_km",
        header: t("fleet.fuel.odometer", "Odometer"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.odometer_km !== null ? n(row.original.odometer_km).toLocaleString() : "—"}
          </span>
        ),
      },
      {
        accessorKey: "total_cost",
        header: t("fleet.fuel.cost", "Cost"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs tabular-nums">
            <p className="font-semibold">{money(row.original.total_cost)}</p>
            <p className="text-muted-foreground">
              {money(row.original.cost_per_litre)}/L
            </p>
          </div>
        ),
      },
      {
        id: "efficiency",
        header: t("fleet.fuel.efficiency", "Efficiency"),
        cell: ({ row }) =>
          row.original.efficiency_km_per_litre === null ? (
            // Not measurable rather than zero — a partial fill or the first
            // full fill has nothing to measure against.
            <span className="text-xs italic text-muted-foreground">
              {t("fleet.fuel.not_measurable", "not measurable")}
            </span>
          ) : (
            <span className="font-semibold tabular-nums">
              {n(row.original.efficiency_km_per_litre).toFixed(2)} km/L
            </span>
          ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("fleet.fuel.title", "Fuel")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "fleet.fuel.subtitle",
              "Efficiency is measured between two full fills. A partial fill leaves an unknown amount in the tank, so no figure is claimed for it.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("fleet.fuel.add", "Log Fill")}
        </Button>
      </div>

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label={t("fleet.fuel.spend", "Fuel spend")} value={money(summary.cost)} />
            <StatTile
              label={t("fleet.fuel.litres", "Litres")}
              value={n(summary.litres).toLocaleString()}
              meta={t("fleet.fuel.fills_meta", "across {n} fills").replace("{n}", String(n(summary.fills)))}
            />
            <StatTile
              label={t("fleet.fuel.avg_price", "Average price")}
              value={`${money(summary.average_cost_per_litre)}/L`}
            />
            <StatTile
              label={t("fleet.fuel.efficiency", "Efficiency")}
              value={`${n(summary.average_efficiency_km_per_litre).toFixed(1)} km/L`}
              meta={t("fleet.fuel.measured_meta", "from {n} measurable fills").replace(
                "{n}",
                String(n(summary.measured_fills)),
              )}
            />
          </div>

          <RankedBarChart
            title={t("fleet.fuel.by_vehicle", "Fuel spend by vehicle")}
            description={t("fleet.fuel.by_vehicle_desc", "With efficiency where it could be measured.")}
            rows={(summary.by_vehicle ?? []).map((row: any) => ({
              key: String(row.vehicle_id),
              label: `#${row.vehicle_id}`,
              value: n(row.cost),
              meta:
                row.efficiency === null
                  ? t("fleet.fuel.not_measurable", "not measurable")
                  : `${n(row.efficiency).toFixed(1)} km/L`,
            }))}
            valueLabel={t("fleet.fuel.spend", "Spend")}
            emptyLabel={t("fleet.fuel.no_fuel", "No fuel recorded yet.")}
          />
        </>
      ) : null}

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as FleetFuelLog[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("fleet.fuel.search", "Search fills...")}
        resourceName="fleet-fuel"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("fleet.fuel.add", "Log Fill")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "fleet.fuel.form_desc",
                  "Enter either a price per litre or a total — whichever the receipt shows — and the other is worked out.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="f-vehicle">{t("fleet.vehicles.vehicle", "Vehicle")}</Label>
              <select
                id="f-vehicle"
                value={form.vehicle_id}
                onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("fleet.common.select", "Select...")}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration} — {n(vehicle.current_odometer_km).toLocaleString()} km
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-litres">{t("fleet.fuel.litres", "Litres")}</Label>
              <Input
                id="f-litres"
                type="number"
                min={0}
                step="0.001"
                value={form.litres}
                onChange={(event) => setForm({ ...form, litres: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-odo">{t("fleet.fuel.odometer", "Odometer (km)")}</Label>
              <Input
                id="f-odo"
                type="number"
                min={0}
                value={form.odometer_km}
                onChange={(event) => setForm({ ...form, odometer_km: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-rate">{t("fleet.fuel.per_litre", "Price per litre")}</Label>
              <Input
                id="f-rate"
                type="number"
                min={0}
                value={form.cost_per_litre}
                onChange={(event) => setForm({ ...form, cost_per_litre: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-total">{t("fleet.fuel.total", "Total cost")}</Label>
              <Input
                id="f-total"
                type="number"
                min={0}
                value={form.total_cost}
                onChange={(event) => setForm({ ...form, total_cost: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-station">{t("fleet.fuel.station", "Station")}</Label>
              <Input
                id="f-station"
                value={form.station}
                onChange={(event) => setForm({ ...form, station: event.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="f-full"
                checked={form.is_full_tank}
                onCheckedChange={(checked) => setForm({ ...form, is_full_tank: checked })}
              />
              <Label htmlFor="f-full">{t("fleet.fuel.full_tank", "Filled to full")}</Label>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("fleet.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.vehicle_id || !form.litres}
            >
              {t("fleet.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
