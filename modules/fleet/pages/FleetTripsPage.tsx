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
import { fleetApi } from "@/modules/fleet/api";
import type { FleetDriver, FleetTrip, FleetVehicle } from "@/modules/fleet/types";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const STATUS_TONE: Record<string, string> = {
  planned: "outline",
  in_progress: "secondary",
  completed: "default",
  cancelled: "outline",
};

export default function FleetTripsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ vehicle_id: "", driver_id: "", purpose: "", origin: "", destination: "" });
  const [odometerFor, setOdometerFor] = React.useState<{ trip: FleetTrip; action: "start" | "complete" } | null>(null);
  const [odometer, setOdometer] = React.useState("");

  const listQuery = useQuery({
    queryKey: ["fleet", "trips", tableQuery],
    queryFn: () =>
      fleetApi
        .listTrips({ page: tableQuery.page, limit: tableQuery.pageSize, search: tableQuery.search || undefined })
        .then((res) => res.data),
  });

  const vehiclesQuery = useQuery({
    queryKey: ["fleet", "vehicle-options"],
    queryFn: () => fleetApi.listVehicles({ limit: 100, available_only: 1 }).then((res) => res.data),
  });

  const driversQuery = useQuery({
    queryKey: ["fleet", "driver-options"],
    queryFn: () => fleetApi.listDrivers({ limit: 100 }).then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["fleet"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      fleetApi.createTrip({
        vehicle_id: Number(form.vehicle_id),
        driver_id: form.driver_id ? Number(form.driver_id) : null,
        purpose: form.purpose || null,
        origin: form.origin || null,
        destination: form.destination || null,
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("fleet.trips.created", "Trip created."));
      invalidate();
      setOpen(false);
      setForm({ vehicle_id: "", driver_id: "", purpose: "", origin: "", destination: "" });
    },
    // Refuses a disposed vehicle or a lapsed licence, by name.
    onError: (error: any) =>
      toast.error(errorText(error, t("fleet.trips.create_failed", "Could not create the trip."))),
  });

  const move = useMutation({
    mutationFn: () => {
      const value = odometer ? Number(odometer) : undefined;

      return odometerFor!.action === "start"
        ? fleetApi.startTrip(odometerFor!.trip.id, value)
        : fleetApi.completeTrip(odometerFor!.trip.id, Number(odometer));
    },
    onSuccess: () => {
      toast.success(t("fleet.trips.updated", "Trip updated."));
      invalidate();
      setOdometerFor(null);
      setOdometer("");
    },
    // The odometer is forward-only; the API explains the refusal.
    onError: (error: any) =>
      toast.error(errorText(error, t("fleet.trips.move_failed", "That reading was refused."))),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => fleetApi.cancelTrip(id),
    onSuccess: () => {
      toast.success(t("fleet.trips.cancelled", "Trip cancelled."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not cancel it.")),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const vehicles = (vehiclesQuery.data?.data ?? []) as FleetVehicle[];
  const drivers = (driversQuery.data?.data ?? []) as FleetDriver[];

  const columns = React.useMemo<ColumnDef<FleetTrip>[]>(
    () => [
      {
        id: "trip",
        header: t("fleet.trips.trip", "Trip"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-bold">{row.original.trip_number}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.purpose ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "vehicle",
        header: t("fleet.vehicles.vehicle", "Vehicle"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.vehicle?.registration ?? `#${row.original.vehicle_id}`}</p>
            <p className="text-muted-foreground">{row.original.driver?.name ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "route",
        header: t("fleet.trips.route", "Route"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.origin ?? "—"} → {row.original.destination ?? "—"}
          </span>
        ),
      },
      {
        id: "odometer",
        header: t("fleet.trips.odometer", "Odometer"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.start_odometer_km !== null
              ? n(row.original.start_odometer_km).toLocaleString()
              : "—"}
            {row.original.end_odometer_km !== null
              ? ` → ${n(row.original.end_odometer_km).toLocaleString()}`
              : ""}
          </span>
        ),
      },
      {
        accessorKey: "distance_km",
        header: t("fleet.trips.distance", "Distance"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {n(row.original.distance_km) > 0 ? `${n(row.original.distance_km).toLocaleString()} km` : "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("fleet.common.status", "Status"),
        cell: ({ row }) => (
          <Badge
            variant={(STATUS_TONE[row.original.status] ?? "outline") as any}
            className="text-[11px] capitalize"
          >
            {row.original.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-1">
            {row.original.status === "planned" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[11px]"
                  onClick={() => {
                    setOdometerFor({ trip: row.original, action: "start" });
                    setOdometer(String(n(row.original.vehicle?.current_odometer_km) || ""));
                  }}
                >
                  {t("fleet.trips.start", "Start")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[11px]"
                  onClick={() => cancel.mutate(row.original.id)}
                >
                  {t("fleet.trips.cancel", "Cancel")}
                </Button>
              </>
            ) : row.original.status === "in_progress" ? (
              <Button
                size="sm"
                className="text-[11px]"
                onClick={() => {
                  setOdometerFor({ trip: row.original, action: "complete" });
                  setOdometer(String(n(row.original.start_odometer_km) || ""));
                }}
              >
                {t("fleet.trips.complete", "Complete")}
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [t, cancel],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("fleet.trips.title", "Trips")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "fleet.trips.subtitle",
              "Distance is derived from the odometer at both ends, never typed — which is what makes cost per kilometre trustworthy.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("fleet.trips.add", "New Trip")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as FleetTrip[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("fleet.trips.search", "Search trips...")}
        resourceName="fleet-trips"
      />

      {/* New trip */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("fleet.trips.add", "New Trip")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "fleet.trips.form_desc",
                  "Leave the driver blank and whoever currently holds the keys is used.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-vehicle">{t("fleet.vehicles.vehicle", "Vehicle")}</Label>
              <select
                id="t-vehicle"
                value={form.vehicle_id}
                onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("fleet.common.select", "Select...")}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-driver">{t("fleet.vehicles.driver", "Driver")}</Label>
              <select
                id="t-driver"
                value={form.driver_id}
                onChange={(event) => setForm({ ...form, driver_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("fleet.trips.assigned_driver", "Whoever is assigned")}</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t-purpose">{t("fleet.trips.purpose", "Purpose")}</Label>
              <Input
                id="t-purpose"
                value={form.purpose}
                onChange={(event) => setForm({ ...form, purpose: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-origin">{t("fleet.trips.origin", "From")}</Label>
              <Input
                id="t-origin"
                value={form.origin}
                onChange={(event) => setForm({ ...form, origin: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-destination">{t("fleet.trips.destination", "To")}</Label>
              <Input
                id="t-destination"
                value={form.destination}
                onChange={(event) => setForm({ ...form, destination: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("fleet.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.vehicle_id}>
              {t("fleet.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Odometer reading */}
      <Dialog open={odometerFor !== null} onOpenChange={(isOpen) => !isOpen && setOdometerFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {odometerFor?.action === "start"
                  ? t("fleet.trips.start", "Start Trip")
                  : t("fleet.trips.complete", "Complete Trip")}
              </DialogTitle>
              <DialogDescription>
                {odometerFor?.action === "start"
                  ? t("fleet.trips.start_desc", "The reading must be at or above the vehicle's current odometer.")
                  : t("fleet.trips.complete_desc", "The closing reading must be at or above the opening one.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="odo-reading">{t("fleet.trips.reading", "Odometer (km)")}</Label>
              <Input
                id="odo-reading"
                type="number"
                min={0}
                value={odometer}
                onChange={(event) => setOdometer(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setOdometerFor(null)}>
              {t("fleet.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => move.mutate()}
              disabled={move.isPending || (odometerFor?.action === "complete" && !odometer)}
            >
              {t("fleet.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
