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
import type { FleetAssignment, FleetDriver, FleetVehicle } from "@/modules/fleet/types";

const TABS = ["vehicles", "drivers", "assignments"] as const;
type Tab = (typeof TABS)[number];

const VEHICLE_TYPES = ["truck", "van", "pickup", "car", "forklift", "bike", "trailer"] as const;
const VEHICLE_STATUSES = ["active", "in_service", "grounded", "disposed"] as const;

const STATUS_TONE: Record<string, string> = {
  active: "default",
  in_service: "secondary",
  grounded: "destructive",
  disposed: "outline",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function FleetVehiclesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<Tab>("vehicles");
  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [vehicleOpen, setVehicleOpen] = React.useState(false);
  const [driverOpen, setDriverOpen] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);

  const [vehicleForm, setVehicleForm] = React.useState({
    id: undefined as number | undefined,
    code: "",
    registration: "",
    type: "truck",
    make: "",
    model: "",
    fuel_type: "diesel",
    current_odometer_km: "0",
    status: "active",
  });

  const [driverForm, setDriverForm] = React.useState({
    id: undefined as number | undefined,
    name: "",
    phone: "",
    licence_number: "",
    licence_class: "",
    licence_expires_on: "",
    status: "active",
  });

  const [assignForm, setAssignForm] = React.useState({ vehicle_id: "", driver_id: "", starts_on: "" });

  const vehiclesQuery = useQuery({
    queryKey: ["fleet", "vehicles", tableQuery],
    queryFn: () =>
      fleetApi
        .listVehicles({ page: tableQuery.page, limit: tableQuery.pageSize, search: tableQuery.search || undefined })
        .then((res) => res.data),
    enabled: tab === "vehicles",
  });

  const driversQuery = useQuery({
    queryKey: ["fleet", "drivers", tableQuery],
    queryFn: () =>
      fleetApi
        .listDrivers({ page: tableQuery.page, limit: tableQuery.pageSize, search: tableQuery.search || undefined })
        .then((res) => res.data),
    enabled: tab === "drivers",
  });

  const assignmentsQuery = useQuery({
    queryKey: ["fleet", "assignments", tableQuery],
    queryFn: () =>
      fleetApi.listAssignments({ page: tableQuery.page, limit: tableQuery.pageSize }).then((res) => res.data),
    enabled: tab === "assignments",
  });

  const vehicleOptions = useQuery({
    queryKey: ["fleet", "vehicle-options"],
    queryFn: () => fleetApi.listVehicles({ limit: 100 }).then((res) => res.data),
  });

  const driverOptions = useQuery({
    queryKey: ["fleet", "driver-options"],
    queryFn: () => fleetApi.listDrivers({ limit: 100 }).then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["fleet"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveVehicle = useMutation({
    mutationFn: () => {
      const payload = {
        code: vehicleForm.code,
        registration: vehicleForm.registration,
        type: vehicleForm.type,
        make: vehicleForm.make || null,
        model: vehicleForm.model || null,
        fuel_type: vehicleForm.fuel_type,
        current_odometer_km: Number(vehicleForm.current_odometer_km || 0),
        status: vehicleForm.status,
      };

      return vehicleForm.id ? fleetApi.updateVehicle(vehicleForm.id, payload) : fleetApi.createVehicle(payload);
    },
    onSuccess: () => {
      toast.success(t("fleet.vehicles.saved", "Vehicle saved."));
      invalidate();
      setVehicleOpen(false);
    },
    // The API refuses an odometer that goes backwards and says why.
    onError: (error: any) =>
      toast.error(errorText(error, t("fleet.vehicles.save_failed", "Could not save the vehicle."))),
  });

  const saveDriver = useMutation({
    mutationFn: () => {
      const payload = {
        name: driverForm.name,
        phone: driverForm.phone || null,
        licence_number: driverForm.licence_number || null,
        licence_class: driverForm.licence_class || null,
        licence_expires_on: driverForm.licence_expires_on || null,
        status: driverForm.status,
      };

      return driverForm.id ? fleetApi.updateDriver(driverForm.id, payload) : fleetApi.createDriver(payload);
    },
    onSuccess: () => {
      toast.success(t("fleet.drivers.saved", "Driver saved."));
      invalidate();
      setDriverOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("fleet.drivers.save_failed", "Could not save the driver."))),
  });

  const assign = useMutation({
    mutationFn: () =>
      fleetApi.createAssignment({
        vehicle_id: Number(assignForm.vehicle_id),
        driver_id: Number(assignForm.driver_id),
        ...(assignForm.starts_on ? { starts_on: assignForm.starts_on } : {}),
      }),
    onSuccess: () => {
      toast.success(t("fleet.assignments.saved", "Vehicle assigned."));
      invalidate();
      setAssignOpen(false);
    },
    // Refuses an overlapping window or a lapsed licence, by name.
    onError: (error: any) =>
      toast.error(errorText(error, t("fleet.assignments.failed", "Could not assign the vehicle."))),
  });

  const endAssignment = useMutation({
    mutationFn: (id: number) => fleetApi.endAssignment(id),
    onSuccess: () => {
      toast.success(t("fleet.assignments.ended", "Assignment ended."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not end it.")),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const vehicles = (vehicleOptions.data?.data ?? []) as FleetVehicle[];
  const drivers = (driverOptions.data?.data ?? []) as FleetDriver[];

  const vehicleColumns = React.useMemo<ColumnDef<FleetVehicle>[]>(
    () => [
      {
        id: "vehicle",
        header: t("fleet.vehicles.vehicle", "Vehicle"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.registration}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.code} · {row.original.make ?? ""} {row.original.model ?? ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: t("fleet.vehicles.type", "Type"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] capitalize">
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: "current_odometer_km",
        header: t("fleet.vehicles.odometer", "Odometer"),
        cell: ({ row }) => (
          <span className="tabular-nums">{n(row.original.current_odometer_km).toLocaleString()} km</span>
        ),
      },
      {
        id: "driver",
        header: t("fleet.vehicles.driver", "Driver"),
        cell: ({ row }) => (
          <span className="text-xs">{row.original.driver?.name ?? "—"}</span>
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
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setVehicleForm({
                  id: row.original.id,
                  code: row.original.code,
                  registration: row.original.registration,
                  type: row.original.type,
                  make: row.original.make ?? "",
                  model: row.original.model ?? "",
                  fuel_type: row.original.fuel_type,
                  current_odometer_km: String(n(row.original.current_odometer_km)),
                  status: row.original.status,
                });
                setVehicleOpen(true);
              }}
            >
              {t("fleet.common.edit", "Edit")}
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  const driverColumns = React.useMemo<ColumnDef<FleetDriver>[]>(
    () => [
      {
        id: "driver",
        header: t("fleet.drivers.driver", "Driver"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.phone ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "licence",
        header: t("fleet.drivers.licence", "Licence"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.licence_number ?? "—"}</p>
            <p className="text-muted-foreground">{row.original.licence_class ?? ""}</p>
          </div>
        ),
      },
      {
        id: "expiry",
        header: t("fleet.drivers.expires", "Expires"),
        cell: ({ row }) => {
          const days = row.original.days_to_licence_expiry;

          if (row.original.licence_expires_on === null) {
            // Not a lapse — a record to chase.
            return (
              <Badge variant="outline" className="text-[11px]">
                {t("fleet.drivers.no_date", "No date on file")}
              </Badge>
            );
          }

          return (
            <span
              className={`text-xs tabular-nums ${
                row.original.licence_valid ? "" : "font-semibold text-destructive"
              }`}
            >
              {String(row.original.licence_expires_on).slice(0, 10)}
              {days !== null && days !== undefined ? (
                <span className="ml-1 text-muted-foreground">
                  ({days < 0
                    ? t("fleet.drivers.ago", "{n}d ago").replace("{n}", String(Math.abs(days)))
                    : t("fleet.drivers.in", "in {n}d").replace("{n}", String(days))})
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("fleet.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDriverForm({
                  id: row.original.id,
                  name: row.original.name,
                  phone: row.original.phone ?? "",
                  licence_number: row.original.licence_number ?? "",
                  licence_class: row.original.licence_class ?? "",
                  licence_expires_on: row.original.licence_expires_on?.slice(0, 10) ?? "",
                  status: row.original.status,
                });
                setDriverOpen(true);
              }}
            >
              {t("fleet.common.edit", "Edit")}
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  const assignmentColumns = React.useMemo<ColumnDef<FleetAssignment>[]>(
    () => [
      {
        id: "vehicle",
        header: t("fleet.vehicles.vehicle", "Vehicle"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.vehicle?.registration ?? `#${row.original.vehicle_id}`}</span>
        ),
      },
      {
        id: "driver",
        header: t("fleet.vehicles.driver", "Driver"),
        cell: ({ row }) => <span>{row.original.driver?.name ?? `#${row.original.driver_id}`}</span>,
      },
      {
        id: "window",
        header: t("fleet.assignments.window", "From / To"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {String(row.original.starts_on).slice(0, 10)}
            {row.original.ends_on
              ? ` → ${String(row.original.ends_on).slice(0, 10)}`
              : ` → ${t("fleet.assignments.open", "open")}`}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.ends_on === null ? (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-[11px]"
                disabled={endAssignment.isPending}
                onClick={() => endAssignment.mutate(row.original.id)}
              >
                {t("fleet.assignments.end", "End")}
              </Button>
            </div>
          ) : null,
      },
    ],
    [t, endAssignment],
  );

  const activeQuery =
    tab === "vehicles" ? vehiclesQuery : tab === "drivers" ? driversQuery : assignmentsQuery;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("fleet.vehicles.title", "Vehicles and Drivers")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "fleet.vehicles.subtitle",
              "One vehicle cannot be assigned to two drivers over the same dates — otherwise nobody is accountable for the fuel or the damage.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={() => setAssignOpen(true)}>
            {t("fleet.assignments.assign", "Assign Vehicle")}
          </Button>
          <Button
            className="rounded-full px-5"
            onClick={() => {
              if (tab === "drivers") {
                setDriverForm({
                  id: undefined,
                  name: "",
                  phone: "",
                  licence_number: "",
                  licence_class: "",
                  licence_expires_on: "",
                  status: "active",
                });
                setDriverOpen(true);
              } else {
                setVehicleForm({
                  id: undefined,
                  code: "",
                  registration: "",
                  type: "truck",
                  make: "",
                  model: "",
                  fuel_type: "diesel",
                  current_odometer_km: "0",
                  status: "active",
                });
                setVehicleOpen(true);
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {tab === "drivers"
              ? t("fleet.drivers.add", "Add Driver")
              : t("fleet.vehicles.add", "Add Vehicle")}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border/60">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${
              tab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            aria-current={tab === value ? "page" : undefined}
          >
            {value}
          </button>
        ))}
      </div>

      <DataTable
        columns={
          (tab === "vehicles"
            ? vehicleColumns
            : tab === "drivers"
              ? driverColumns
              : assignmentColumns) as ColumnDef<any>[]
        }
        data={(activeQuery.data?.data ?? []) as any[]}
        totalEntries={activeQuery.data?.meta?.total ?? 0}
        loading={activeQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("fleet.vehicles.search", "Search...")}
        resourceName={`fleet-${tab}`}
      />

      {/* Vehicle */}
      <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {vehicleForm.id
                  ? t("fleet.vehicles.edit", "Edit Vehicle")
                  : t("fleet.vehicles.add", "Add Vehicle")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "fleet.vehicles.form_desc",
                  "The odometer only moves forward. Correct a mis-keyed reading with a service record rather than winding it back.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-code">{t("fleet.common.code", "Fleet number")}</Label>
              <Input
                id="v-code"
                value={vehicleForm.code}
                onChange={(event) => setVehicleForm({ ...vehicleForm, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-reg">{t("fleet.vehicles.registration", "Plate")}</Label>
              <Input
                id="v-reg"
                value={vehicleForm.registration}
                onChange={(event) => setVehicleForm({ ...vehicleForm, registration: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-type">{t("fleet.vehicles.type", "Type")}</Label>
              <select
                id="v-type"
                value={vehicleForm.type}
                onChange={(event) => setVehicleForm({ ...vehicleForm, type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-status">{t("fleet.common.status", "Status")}</Label>
              <select
                id="v-status"
                value={vehicleForm.status}
                onChange={(event) => setVehicleForm({ ...vehicleForm, status: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {VEHICLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-make">{t("fleet.vehicles.make", "Make")}</Label>
              <Input
                id="v-make"
                value={vehicleForm.make}
                onChange={(event) => setVehicleForm({ ...vehicleForm, make: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-model">{t("fleet.vehicles.model", "Model")}</Label>
              <Input
                id="v-model"
                value={vehicleForm.model}
                onChange={(event) => setVehicleForm({ ...vehicleForm, model: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-fuel">{t("fleet.vehicles.fuel_type", "Fuel")}</Label>
              <Input
                id="v-fuel"
                value={vehicleForm.fuel_type}
                onChange={(event) => setVehicleForm({ ...vehicleForm, fuel_type: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-odo">{t("fleet.vehicles.odometer", "Odometer (km)")}</Label>
              <Input
                id="v-odo"
                type="number"
                min={0}
                value={vehicleForm.current_odometer_km}
                onChange={(event) =>
                  setVehicleForm({ ...vehicleForm, current_odometer_km: event.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setVehicleOpen(false)}>
              {t("fleet.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveVehicle.mutate()}
              disabled={saveVehicle.isPending || !vehicleForm.code.trim() || !vehicleForm.registration.trim()}
            >
              {t("fleet.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Driver */}
      <Dialog open={driverOpen} onOpenChange={setDriverOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {driverForm.id ? t("fleet.drivers.edit", "Edit Driver") : t("fleet.drivers.add", "Add Driver")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "fleet.drivers.form_desc",
                  "An expired licence stops the driver being assigned a vehicle or sent on a trip.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-name">{t("fleet.common.name", "Name")}</Label>
              <Input
                id="d-name"
                value={driverForm.name}
                onChange={(event) => setDriverForm({ ...driverForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-phone">{t("fleet.drivers.phone", "Phone")}</Label>
              <Input
                id="d-phone"
                value={driverForm.phone}
                onChange={(event) => setDriverForm({ ...driverForm, phone: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-licence">{t("fleet.drivers.licence_number", "Licence number")}</Label>
              <Input
                id="d-licence"
                value={driverForm.licence_number}
                onChange={(event) => setDriverForm({ ...driverForm, licence_number: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-class">{t("fleet.drivers.licence_class", "Class")}</Label>
              <Input
                id="d-class"
                value={driverForm.licence_class}
                onChange={(event) => setDriverForm({ ...driverForm, licence_class: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-expiry">{t("fleet.drivers.expires", "Licence expires")}</Label>
              <Input
                id="d-expiry"
                type="date"
                value={driverForm.licence_expires_on}
                onChange={(event) =>
                  setDriverForm({ ...driverForm, licence_expires_on: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-status">{t("fleet.common.status", "Status")}</Label>
              <select
                id="d-status"
                value={driverForm.status}
                onChange={(event) => setDriverForm({ ...driverForm, status: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {["active", "suspended", "inactive"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDriverOpen(false)}>
              {t("fleet.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveDriver.mutate()}
              disabled={saveDriver.isPending || !driverForm.name.trim()}
            >
              {t("fleet.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("fleet.assignments.assign", "Assign Vehicle")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "fleet.assignments.form_desc",
                  "An open assignment runs until it is ended, so it clashes with anything that has not already finished.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="a-vehicle">{t("fleet.vehicles.vehicle", "Vehicle")}</Label>
              <select
                id="a-vehicle"
                value={assignForm.vehicle_id}
                onChange={(event) => setAssignForm({ ...assignForm, vehicle_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("fleet.common.select", "Select...")}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration} — {vehicle.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-driver">{t("fleet.vehicles.driver", "Driver")}</Label>
              <select
                id="a-driver"
                value={assignForm.driver_id}
                onChange={(event) => setAssignForm({ ...assignForm, driver_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("fleet.common.select", "Select...")}</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                    {driver.licence_valid === false
                      ? ` — ${t("fleet.drivers.expired", "licence expired")}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-start">{t("fleet.assignments.starts", "Starts")}</Label>
              <Input
                id="a-start"
                type="date"
                value={assignForm.starts_on}
                onChange={(event) => setAssignForm({ ...assignForm, starts_on: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              {t("fleet.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => assign.mutate()}
              disabled={assign.isPending || !assignForm.vehicle_id || !assignForm.driver_id}
            >
              {t("fleet.assignments.assign", "Assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
