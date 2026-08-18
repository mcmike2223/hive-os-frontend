"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

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
import { serviceApi } from "@/modules/service/api";
import type {
  AvailableTechnician,
  ServiceAsset,
  ServiceMaintenancePlan,
} from "@/modules/service/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function ServicePlansPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [planOpen, setPlanOpen] = React.useState(false);
  const [booking, setBooking] = React.useState<ServiceMaintenancePlan | null>(null);
  const [technicianId, setTechnicianId] = React.useState("");

  const [form, setForm] = React.useState({
    asset_id: "",
    name: "",
    interval_days: "90",
    last_serviced_on: "",
    estimated_hours: "2",
  });

  const plansQuery = useQuery({
    queryKey: ["service", "plans"],
    queryFn: () => serviceApi.listPlans({ limit: 100 }).then((res) => res.data),
  });

  const assetsQuery = useQuery({
    queryKey: ["service", "asset-options"],
    queryFn: () => serviceApi.listAssets({ limit: 100 }).then((res) => res.data),
  });

  const techniciansQuery = useQuery({
    queryKey: ["service", "available-technicians"],
    queryFn: () => serviceApi.availableTechnicians().then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["service", "overview-plans"],
    queryFn: () => serviceApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["service"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const savePlan = useMutation({
    mutationFn: () =>
      serviceApi.createPlan({
        asset_id: Number(form.asset_id),
        name: form.name,
        interval_days: Number(form.interval_days || 0),
        ...(form.last_serviced_on ? { last_serviced_on: form.last_serviced_on } : {}),
        estimated_hours: Number(form.estimated_hours || 0),
        is_active: true,
      }),
    onSuccess: () => {
      toast.success(t("service.plans.saved", "Plan created."));
      invalidate();
      setPlanOpen(false);
      setForm({ asset_id: "", name: "", interval_days: "90", last_serviced_on: "", estimated_hours: "2" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.plans.save_failed", "Could not create it."))),
  });

  const removePlan = useMutation({
    mutationFn: (id: number) => serviceApi.deletePlan(id),
    onSuccess: () => {
      toast.success(t("service.plans.removed", "Plan removed."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not remove it.")),
  });

  const bookVisit = useMutation({
    mutationFn: () =>
      serviceApi.createWorkOrder({
        asset_id: booking!.asset_id,
        plan_id: booking!.id,
        type: "preventive",
        ...(technicianId ? { technician_id: Number(technicianId) } : {}),
      }),
    onSuccess: () => {
      toast.success(
        t("service.plans.booked", "Preventive visit raised; completing it will reset the plan."),
      );
      invalidate();
      setBooking(null);
      setTechnicianId("");
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.plans.book_failed", "Could not raise it."))),
  });

  const plans = (plansQuery.data?.data ?? []) as ServiceMaintenancePlan[];
  const assets = (assetsQuery.data?.data ?? []) as ServiceAsset[];
  const technicians = (techniciansQuery.data?.data ?? []) as AvailableTechnician[];
  const summary = overviewQuery.data?.data?.preventive;

  // Overdue first, then whatever is closest — the order a planner works in.
  const sorted = React.useMemo(
    () =>
      [...plans].sort(
        (a, b) => (a.days_remaining ?? Number.MAX_SAFE_INTEGER) - (b.days_remaining ?? Number.MAX_SAFE_INTEGER),
      ),
    [plans],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("service.plans.title", "Preventive Maintenance")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "service.plans.subtitle",
              "Visits booked before something breaks. A plan added to equipment already in the field counts from today, not from zero, so it does not read as years overdue on day one.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setPlanOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("service.plans.add", "New Plan")}
        </Button>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label={t("service.overview.plans", "Active plans")}
            value={n(summary.plans).toLocaleString()}
          />
          <StatTile
            label={t("service.plans.due_now", "Due now")}
            value={n(summary.due_now).toLocaleString()}
            alert={n(summary.due_now) > 0}
          />
          <StatTile
            label={t("service.plans.due_soon", "Falling due")}
            value={n(summary.due_soon).toLocaleString()}
            meta={t("service.plans.due_soon_meta", "within 30 days")}
          />
        </div>
      ) : null}

      <Panel
        title={t("service.plans.schedule", "Plan schedule")}
        description={t(
          "service.plans.schedule_desc",
          "Completing a preventive work order against a plan resets it, so 'due' is always measured from the last real visit rather than from when the plan was written.",
        )}
      >
        {plansQuery.isLoading ? (
          <LoadingPanel label={t("service.common.loading", "Loading plans...")} />
        ) : sorted.length === 0 ? (
          <EmptyPanel label={t("service.plans.none", "No preventive plans set.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("service.plans.plan", "Plan")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.requests.asset", "Asset")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.plans.interval", "Every")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.plans.last", "Last done")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.plans.next", "Next due")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("service.common.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((plan) => {
                  const due = (plan.days_remaining ?? 1) <= 0;
                  return (
                    <tr key={plan.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="block font-medium">{plan.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {t("service.plans.estimated", "about {n}h on site").replace(
                            "{n}",
                            String(plan.estimated_hours),
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {plan.asset?.name ?? `#${plan.asset_id}`}
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {t("service.plans.days", "{n} days").replace("{n}", String(plan.interval_days))}
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {plan.last_serviced_on
                          ? String(plan.last_serviced_on).slice(0, 10)
                          : t("service.plans.never", "Never")}
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {plan.next_due_on ?? "—"}
                        {/* The word carries the state; colour only reinforces it. */}
                        <span
                          className={`block text-[11px] font-semibold ${
                            due ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {due
                            ? t("service.plans.overdue", "{n} days overdue").replace(
                                "{n}",
                                String(Math.abs(n(plan.days_remaining))),
                              )
                            : t("service.plans.in_days", "in {n} days").replace(
                                "{n}",
                                String(n(plan.days_remaining)),
                              )}
                        </span>
                      </td>
                      <td className="py-2 pr-6 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant={due ? "default" : "outline"}
                            className="h-7 text-[11px]"
                            onClick={() => setBooking(plan)}
                          >
                            {t("service.plans.book", "Book visit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive"
                            onClick={() => removePlan.mutate(plan.id)}
                            aria-label={t("service.common.delete", "Delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* New plan */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.plans.add", "New Plan")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.plans.add_desc",
                  "Leaving the last visit blank counts the first interval from today. Fill it in when you know when the equipment was genuinely last serviced.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-asset">{t("service.requests.asset", "Asset")}</Label>
              <select
                id="p-asset"
                value={form.asset_id}
                onChange={(event) => setForm({ ...form, asset_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("service.common.select", "Select...")}</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} — {asset.customer_name ?? asset.asset_tag}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-name">{t("service.common.name", "Name")}</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={t("service.plans.name_hint", "Quarterly strip-down, filter change")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-interval">{t("service.plans.every_days", "Every (days)")}</Label>
              <Input
                id="p-interval"
                type="number"
                min={1}
                value={form.interval_days}
                onChange={(event) => setForm({ ...form, interval_days: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-hours">{t("service.plans.hours", "Estimated hours")}</Label>
              <Input
                id="p-hours"
                type="number"
                min={0}
                value={form.estimated_hours}
                onChange={(event) => setForm({ ...form, estimated_hours: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-last">{t("service.plans.last", "Last done")}</Label>
              <Input
                id="p-last"
                type="date"
                value={form.last_serviced_on}
                onChange={(event) => setForm({ ...form, last_serviced_on: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setPlanOpen(false)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => savePlan.mutate()}
              disabled={savePlan.isPending || !form.asset_id || !form.name.trim()}
            >
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Book the visit */}
      <Dialog open={booking !== null} onOpenChange={(open) => !open && setBooking(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.plans.book", "Book visit")}
              </DialogTitle>
              <DialogDescription>
                {booking
                  ? t("service.plans.book_desc", "Raises a preventive work order for {name}.").replace(
                      "{name}",
                      booking.name,
                    )
                  : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="b-tech">{t("service.work.technician", "Engineer")}</Label>
              <select
                id="b-tech"
                value={technicianId}
                onChange={(event) => setTechnicianId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("service.work.unassigned", "Unassigned")}</option>
                {technicians.map((tech) => (
                  <option key={tech.technician_id} value={tech.technician_id}>
                    {tech.name} ({tech.open_jobs} open)
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {t("service.plans.least_loaded", "Listed least loaded first.")}
              </p>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setBooking(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => bookVisit.mutate()} disabled={bookVisit.isPending}>
              {t("service.plans.book", "Book visit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
