"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

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
import type {
  FleetServiceRecord,
  FleetServiceSchedule,
  FleetVehicle,
  MaintenanceDue,
} from "@/modules/fleet/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const SERVICE_TYPES = ["preventive", "corrective", "inspection", "tyre", "accident"] as const;

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function FleetMaintenancePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [serviceOpen, setServiceOpen] = React.useState(false);

  const [scheduleForm, setScheduleForm] = React.useState({
    vehicle_id: "",
    name: "",
    interval_km: "",
    interval_days: "",
  });

  const [serviceForm, setServiceForm] = React.useState({
    vehicle_id: "",
    schedule_id: "",
    type: "preventive",
    description: "",
    parts_cost: "0",
    labour_cost: "0",
    odometer_km: "",
    supplier: "",
    downtime_hours: "0",
  });

  const dueQuery = useQuery({
    queryKey: ["fleet", "maintenance-due"],
    queryFn: () => fleetApi.maintenanceDue().then((res) => res.data),
  });

  const schedulesQuery = useQuery({
    queryKey: ["fleet", "schedules"],
    queryFn: () => fleetApi.listSchedules({ limit: 100 }).then((res) => res.data),
  });

  const servicesQuery = useQuery({
    queryKey: ["fleet", "services"],
    queryFn: () => fleetApi.listServices({ limit: 25 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["fleet", "overview-maintenance"],
    queryFn: () => fleetApi.overview().then((res) => res.data),
  });

  const vehiclesQuery = useQuery({
    queryKey: ["fleet", "vehicle-options"],
    queryFn: () => fleetApi.listVehicles({ limit: 100 }).then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["fleet"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveSchedule = useMutation({
    mutationFn: () =>
      fleetApi.createSchedule({
        vehicle_id: Number(scheduleForm.vehicle_id),
        name: scheduleForm.name,
        ...(scheduleForm.interval_km ? { interval_km: Number(scheduleForm.interval_km) } : {}),
        ...(scheduleForm.interval_days ? { interval_days: Number(scheduleForm.interval_days) } : {}),
      }),
    onSuccess: () => {
      toast.success(t("fleet.maintenance.schedule_saved", "Schedule created."));
      invalidate();
      setScheduleOpen(false);
      setScheduleForm({ vehicle_id: "", name: "", interval_km: "", interval_days: "" });
    },
    // Refused when neither interval is set — the API says so.
    onError: (error: any) =>
      toast.error(errorText(error, t("fleet.maintenance.schedule_failed", "Could not create it."))),
  });

  const deleteSchedule = useMutation({
    mutationFn: (id: number) => fleetApi.deleteSchedule(id),
    onSuccess: () => {
      toast.success(t("fleet.maintenance.schedule_deleted", "Schedule removed."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not remove it.")),
  });

  const saveService = useMutation({
    mutationFn: () =>
      fleetApi.createService({
        vehicle_id: Number(serviceForm.vehicle_id),
        ...(serviceForm.schedule_id ? { schedule_id: Number(serviceForm.schedule_id) } : {}),
        type: serviceForm.type,
        description: serviceForm.description || null,
        parts_cost: Number(serviceForm.parts_cost || 0),
        labour_cost: Number(serviceForm.labour_cost || 0),
        ...(serviceForm.odometer_km ? { odometer_km: Number(serviceForm.odometer_km) } : {}),
        supplier: serviceForm.supplier || null,
        downtime_hours: Number(serviceForm.downtime_hours || 0),
      }),
    onSuccess: () => {
      toast.success(t("fleet.maintenance.service_saved", "Service recorded; the schedule is reset."));
      invalidate();
      setServiceOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("fleet.maintenance.service_failed", "Could not record it."))),
  });

  const due = (dueQuery.data?.data ?? []) as MaintenanceDue[];
  const schedules = (schedulesQuery.data?.data ?? []) as FleetServiceSchedule[];
  const services = (servicesQuery.data?.data ?? []) as FleetServiceRecord[];
  const vehicles = (vehiclesQuery.data?.data ?? []) as FleetVehicle[];
  const summary = overviewQuery.data?.data?.maintenance;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("fleet.maintenance.title", "Maintenance")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "fleet.maintenance.subtitle",
              "A schedule set both by distance and by date falls due as soon as either is reached — that is the point of setting both.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={() => setScheduleOpen(true)}>
            {t("fleet.maintenance.add_schedule", "New Schedule")}
          </Button>
          <Button className="rounded-full px-5" onClick={() => setServiceOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("fleet.maintenance.record", "Record Service")}
          </Button>
        </div>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("fleet.maintenance.due_now", "Due now")}
            value={n(summary.due_now).toLocaleString()}
            alert={n(summary.due_now) > 0}
          />
          <StatTile
            label={t("fleet.maintenance.due_soon", "Falling due")}
            value={n(summary.due_soon).toLocaleString()}
          />
          <StatTile label={t("fleet.maintenance.cost", "Service spend")} value={money(summary.cost)} />
          <StatTile
            label={t("fleet.maintenance.downtime", "Downtime")}
            value={`${n(summary.downtime_hours).toLocaleString()} h`}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t("fleet.maintenance.due", "Falling due")}
          description={t("fleet.maintenance.due_desc", "Overdue first, then whatever is closest.")}
        >
          {dueQuery.isLoading ? (
            <LoadingPanel label={t("fleet.common.loading", "Loading...")} />
          ) : due.length === 0 ? (
            <EmptyPanel label={t("fleet.maintenance.nothing_due", "Nothing due in the window.")} />
          ) : (
            <div className="space-y-1.5">
              {due.map((row) => (
                <div
                  key={row.schedule_id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{row.vehicle}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {row.is_due ? (
                      <Badge variant="destructive" className="text-[10px]">
                        {t("fleet.maintenance.overdue", "Overdue")}
                      </Badge>
                    ) : (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {row.km_remaining !== null
                          ? `${n(row.km_remaining).toLocaleString()} km`
                          : `${row.days_remaining} ${t("fleet.maintenance.days", "days")}`}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t("fleet.maintenance.schedules", "Schedules")}>
          {schedulesQuery.isLoading ? (
            <LoadingPanel label={t("fleet.common.loading", "Loading...")} />
          ) : schedules.length === 0 ? (
            <EmptyPanel label={t("fleet.maintenance.no_schedules", "No schedules set.")} />
          ) : (
            <div className="space-y-1.5">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{schedule.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {schedule.vehicle?.registration ?? `#${schedule.vehicle_id}`}
                      {" · "}
                      {[
                        schedule.interval_km ? `${n(schedule.interval_km).toLocaleString()} km` : null,
                        schedule.interval_days ? `${schedule.interval_days} days` : null,
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive"
                    onClick={() => deleteSchedule.mutate(schedule.id)}
                    aria-label={t("fleet.common.delete", "Delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title={t("fleet.maintenance.history", "Service history")}
        description={t(
          "fleet.maintenance.history_desc",
          "Totals are computed from parts and labour, never taken on trust — a total that disagreed would corrupt cost per km.",
        )}
      >
        {servicesQuery.isLoading ? (
          <LoadingPanel label={t("fleet.common.loading", "Loading...")} />
        ) : services.length === 0 ? (
          <EmptyPanel label={t("fleet.maintenance.no_services", "No service work recorded.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-semibold">{t("fleet.maintenance.date", "Date")}</th>
                  <th className="pb-2 font-semibold">{t("fleet.vehicles.vehicle", "Vehicle")}</th>
                  <th className="pb-2 font-semibold">{t("fleet.maintenance.type", "Type")}</th>
                  <th className="pb-2 text-right font-semibold">{t("fleet.maintenance.parts", "Parts")}</th>
                  <th className="pb-2 text-right font-semibold">{t("fleet.maintenance.labour", "Labour")}</th>
                  <th className="pb-2 text-right font-semibold">{t("fleet.common.total", "Total")}</th>
                  <th className="pb-2 text-right font-semibold">{t("fleet.maintenance.downtime", "Downtime")}</th>
                </tr>
              </thead>
              <tbody>
                {services.map((record) => (
                  <tr key={record.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 text-xs tabular-nums">{String(record.serviced_on).slice(0, 10)}</td>
                    <td className="py-2">{record.vehicle?.registration ?? `#${record.vehicle_id}`}</td>
                    <td className="py-2">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {record.type}
                      </Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums">{money(record.parts_cost)}</td>
                    <td className="py-2 text-right tabular-nums">{money(record.labour_cost)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{money(record.total_cost)}</td>
                    <td className="py-2 text-right tabular-nums">{record.downtime_hours} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Schedule */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("fleet.maintenance.add_schedule", "New Schedule")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "fleet.maintenance.schedule_desc",
                  "Set a distance interval, a time interval, or both. A new schedule counts from where the vehicle is now, not from zero.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-vehicle">{t("fleet.vehicles.vehicle", "Vehicle")}</Label>
              <select
                id="s-vehicle"
                value={scheduleForm.vehicle_id}
                onChange={(event) => setScheduleForm({ ...scheduleForm, vehicle_id: event.target.value })}
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-name">{t("fleet.common.name", "Name")}</Label>
              <Input
                id="s-name"
                value={scheduleForm.name}
                onChange={(event) => setScheduleForm({ ...scheduleForm, name: event.target.value })}
                placeholder={t("fleet.maintenance.name_hint", "Oil change, brake inspection")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-km">{t("fleet.maintenance.every_km", "Every (km)")}</Label>
              <Input
                id="s-km"
                type="number"
                min={0}
                value={scheduleForm.interval_km}
                onChange={(event) => setScheduleForm({ ...scheduleForm, interval_km: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-days">{t("fleet.maintenance.every_days", "Every (days)")}</Label>
              <Input
                id="s-days"
                type="number"
                min={0}
                value={scheduleForm.interval_days}
                onChange={(event) => setScheduleForm({ ...scheduleForm, interval_days: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setScheduleOpen(false)}>
              {t("fleet.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveSchedule.mutate()}
              disabled={
                saveSchedule.isPending ||
                !scheduleForm.vehicle_id ||
                !scheduleForm.name.trim() ||
                (!scheduleForm.interval_km && !scheduleForm.interval_days)
              }
            >
              {t("fleet.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service record */}
      <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("fleet.maintenance.record", "Record Service")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "fleet.maintenance.record_desc",
                  "Linking the work to a schedule resets it, so 'due' is always measured from the last real visit.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-vehicle">{t("fleet.vehicles.vehicle", "Vehicle")}</Label>
              <select
                id="r-vehicle"
                value={serviceForm.vehicle_id}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, vehicle_id: event.target.value, schedule_id: "" })
                }
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
              <Label htmlFor="r-schedule">{t("fleet.maintenance.against", "Against schedule")}</Label>
              <select
                id="r-schedule"
                value={serviceForm.schedule_id}
                onChange={(event) => setServiceForm({ ...serviceForm, schedule_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("fleet.maintenance.unscheduled", "Unscheduled")}</option>
                {schedules
                  .filter((s) => String(s.vehicle_id) === serviceForm.vehicle_id)
                  .map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-type">{t("fleet.maintenance.type", "Type")}</Label>
              <select
                id="r-type"
                value={serviceForm.type}
                onChange={(event) => setServiceForm({ ...serviceForm, type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-odo">{t("fleet.fuel.odometer", "Odometer (km)")}</Label>
              <Input
                id="r-odo"
                type="number"
                min={0}
                value={serviceForm.odometer_km}
                onChange={(event) => setServiceForm({ ...serviceForm, odometer_km: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-parts">{t("fleet.maintenance.parts", "Parts cost")}</Label>
              <Input
                id="r-parts"
                type="number"
                min={0}
                value={serviceForm.parts_cost}
                onChange={(event) => setServiceForm({ ...serviceForm, parts_cost: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-labour">{t("fleet.maintenance.labour", "Labour cost")}</Label>
              <Input
                id="r-labour"
                type="number"
                min={0}
                value={serviceForm.labour_cost}
                onChange={(event) => setServiceForm({ ...serviceForm, labour_cost: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-supplier">{t("fleet.maintenance.supplier", "Supplier")}</Label>
              <Input
                id="r-supplier"
                value={serviceForm.supplier}
                onChange={(event) => setServiceForm({ ...serviceForm, supplier: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-downtime">{t("fleet.maintenance.downtime", "Downtime (hours)")}</Label>
              <Input
                id="r-downtime"
                type="number"
                min={0}
                value={serviceForm.downtime_hours}
                onChange={(event) => setServiceForm({ ...serviceForm, downtime_hours: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="r-desc">{t("fleet.maintenance.description", "What was done")}</Label>
              <Input
                id="r-desc"
                value={serviceForm.description}
                onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setServiceOpen(false)}>
              {t("fleet.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveService.mutate()}
              disabled={saveService.isPending || !serviceForm.vehicle_id}
            >
              {t("fleet.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
