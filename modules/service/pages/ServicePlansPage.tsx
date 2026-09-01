"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, RefreshCw, Trash2, Wrench } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/use-permissions";
import { serviceApi } from "@/modules/service/api";
import type {
  AvailableTechnician,
  ServiceAsset,
  ServiceMaintenancePlan,
  UpcomingMaintenancePlan,
} from "@/modules/service/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const DEFAULT_FORM = {
  asset_id: "",
  name: "",
  interval_days: "90",
  last_serviced_on: "",
  estimated_hours: "2",
  is_active: true,
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatTechOption = (tech: AvailableTechnician) =>
  `${tech.name} · ${money(tech.hourly_rate)}/hr · ${tech.open_jobs} open`;

function planToForm(plan: ServiceMaintenancePlan) {
  return {
    asset_id: String(plan.asset_id),
    name: plan.name,
    interval_days: String(plan.interval_days),
    last_serviced_on: plan.last_serviced_on ? String(plan.last_serviced_on).slice(0, 10) : "",
    estimated_hours: String(plan.estimated_hours),
    is_active: plan.is_active,
  };
}

function buildPlanPayload(values: typeof DEFAULT_FORM) {
  return {
    asset_id: Number(values.asset_id),
    name: values.name.trim(),
    interval_days: Number(values.interval_days || 0),
    last_serviced_on: values.last_serviced_on || null,
    estimated_hours: Number(values.estimated_hours || 0),
    is_active: values.is_active,
  };
}

export default function ServicePlansPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_service_plans", "manage_service"]);
  const canBook = hasAnyPermission(["manage_service_work_orders", "manage_service"]);

  const initialAssetId = searchParams.get("asset_id") ?? "";

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [assetFilter, setAssetFilter] = React.useState(initialAssetId || "all");
  const [activeOnly, setActiveOnly] = React.useState(true);
  const [dueOnly, setDueOnly] = React.useState(false);

  const [formOpen, setFormOpen] = React.useState(false);
  const [formId, setFormId] = React.useState<number | undefined>();
  const [form, setForm] = React.useState({ ...DEFAULT_FORM });

  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [booking, setBooking] = React.useState<ServiceMaintenancePlan | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<ServiceMaintenancePlan | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [technicianId, setTechnicianId] = React.useState("");
  const [scheduledFor, setScheduledFor] = React.useState("");

  const plansQuery = useQuery({
    queryKey: ["service", "plans", tableQuery, assetFilter, activeOnly, dueOnly],
    queryFn: () =>
      serviceApi
        .listPlans({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          asset_id: assetFilter !== "all" ? Number(assetFilter) : undefined,
          ...(activeOnly ? { is_active: 1 } : {}),
          ...(dueOnly ? { due_only: 1 } : {}),
        })
        .then((res) => res.data),
  });

  const assetsQuery = useQuery({
    queryKey: ["service", "asset-options"],
    queryFn: () => serviceApi.listAssets({ limit: 200 }).then((res) => res.data),
  });

  const techniciansQuery = useQuery({
    queryKey: ["service", "available-technicians"],
    queryFn: () => serviceApi.availableTechnicians().then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["service", "overview-plans"],
    queryFn: () => serviceApi.overview().then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["service", "plan", detailId],
    queryFn: () => serviceApi.getPlan(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["service"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const savePlan = useMutation({
    mutationFn: () =>
      formId
        ? serviceApi.updatePlan(formId, buildPlanPayload(form))
        : serviceApi.createPlan(buildPlanPayload(form)),
    onSuccess: () => {
      toast.success(t("service.plans.saved", "Plan saved."));
      invalidate();
      setFormOpen(false);
      setFormId(undefined);
      setForm({ ...DEFAULT_FORM });
      if (detailId === formId) setDetailId(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.plans.save_failed", "Could not save it."))),
  });

  const removePlan = useMutation({
    mutationFn: (id: number) => {
      setDeletingId(id);
      return serviceApi.deletePlan(id);
    },
    onSuccess: () => {
      toast.success(t("service.plans.removed", "Plan removed."));
      invalidate();
      setDeleteFor(null);
      if (detailId === deleteFor?.id) setDetailId(null);
    },
    onError: (error: any) => toast.error(errorText(error, t("service.plans.remove_failed", "Could not remove it."))),
    onSettled: () => setDeletingId(null),
  });

  const bookVisit = useMutation({
    mutationFn: () =>
      serviceApi.createWorkOrder({
        asset_id: booking!.asset_id,
        plan_id: booking!.id,
        type: "preventive",
        ...(technicianId ? { technician_id: Number(technicianId) } : {}),
        ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
      }),
    onSuccess: () => {
      toast.success(
        t("service.plans.booked", "Preventive visit raised; completing it will reset the plan."),
      );
      invalidate();
      setBooking(null);
      setTechnicianId("");
      setScheduledFor("");
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.plans.book_failed", "Could not raise it."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const plans = (plansQuery.data?.data ?? []) as ServiceMaintenancePlan[];
  const assets = (assetsQuery.data?.data ?? []) as ServiceAsset[];
  const technicians = (techniciansQuery.data?.data ?? []) as AvailableTechnician[];
  const summary = overviewQuery.data?.data?.preventive;
  const upcoming = (summary?.upcoming ?? []) as UpcomingMaintenancePlan[];
  const detail = (detailQuery.data?.data ?? null) as ServiceMaintenancePlan | null;

  const openCreate = () => {
    setFormId(undefined);
    setForm({
      ...DEFAULT_FORM,
      asset_id: assetFilter !== "all" ? assetFilter : "",
    });
    setFormOpen(true);
  };

  const openEdit = (plan: ServiceMaintenancePlan) => {
    setFormId(plan.id);
    setForm(planToForm(plan));
    setFormOpen(true);
  };

  const dueLabel = (plan: ServiceMaintenancePlan) => {
    const due = (plan.days_remaining ?? 1) <= 0;
    if (due) {
      return t("service.plans.overdue", "{n} days overdue").replace(
        "{n}",
        String(Math.abs(n(plan.days_remaining))),
      );
    }
    return t("service.plans.in_days", "in {n} days").replace("{n}", String(n(plan.days_remaining)));
  };

  const columns = React.useMemo<ColumnDef<ServiceMaintenancePlan>[]>(
    () => [
      {
        id: "plan",
        header: t("service.plans.plan", "Plan"),
        cell: ({ row }) => (
          <button type="button" className="space-y-0.5 text-left" onClick={() => setDetailId(row.original.id)}>
            <p className="font-bold hover:underline">{row.original.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("service.plans.estimated", "about {n}h on site").replace("{n}", String(row.original.estimated_hours))}
            </p>
          </button>
        ),
      },
      {
        id: "asset",
        header: t("service.requests.asset", "Asset"),
        cell: ({ row }) => (
          <span className="text-xs">{row.original.asset?.name ?? `#${row.original.asset_id}`}</span>
        ),
      },
      {
        id: "interval",
        header: t("service.plans.interval", "Every"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {t("service.plans.days", "{n} days").replace("{n}", String(row.original.interval_days))}
          </span>
        ),
      },
      {
        id: "last",
        header: t("service.plans.last", "Last done"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.last_serviced_on
              ? String(row.original.last_serviced_on).slice(0, 10)
              : t("service.plans.never", "Never")}
          </span>
        ),
      },
      {
        id: "next",
        header: t("service.plans.next", "Next due"),
        cell: ({ row }) => {
          const due = (row.original.days_remaining ?? 1) <= 0;
          return (
            <div className="text-xs tabular-nums">
              <span>{row.original.next_due_on ?? "—"}</span>
              <span className={`block text-[11px] font-semibold ${due ? "text-destructive" : "text-muted-foreground"}`}>
                {dueLabel(row.original)}
              </span>
            </div>
          );
        },
      },
      {
        id: "status",
        header: t("service.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? "secondary" : "outline"} className="text-[10px]">
            {row.original.is_active ? t("service.plans.active", "Active") : t("service.plans.inactive", "Inactive")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const due = (row.original.days_remaining ?? 1) <= 0;
          const busy = deletingId === row.original.id;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setDetailId(row.original.id)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {canManage ? (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(row.original)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {canBook && row.original.is_active ? (
                <Button
                  size="sm"
                  variant={due ? "default" : "outline"}
                  className="h-7 text-[11px]"
                  onClick={() => setBooking(row.original)}
                >
                  {t("service.plans.book", "Book visit")}
                </Button>
              ) : null}
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  disabled={busy}
                  onClick={() => setDeleteFor(row.original)}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canBook, canManage, deletingId, dueLabel, t],
  );

  const renderForm = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("service.requests.asset", "Asset")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.asset_id || "none"}
            onValueChange={(v) => setForm({ ...form, asset_id: v === "none" ? "" : v })}
            disabled={Boolean(formId)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("service.common.select", "Select...")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("service.common.select", "Select...")}</SelectItem>
              {assets.map((asset) => (
                <SelectItem key={asset.id} value={String(asset.id)}>
                  {asset.name} — {asset.customer_name ?? asset.asset_tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="p-name">{t("service.common.name", "Name")}</Label>
        <Input
          id="p-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
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
          onChange={(e) => setForm({ ...form, interval_days: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-hours">{t("service.plans.hours", "Estimated hours")}</Label>
        <Input
          id="p-hours"
          type="number"
          min={0}
          value={form.estimated_hours}
          onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="p-last">{t("service.plans.last", "Last done")}</Label>
        <Input
          id="p-last"
          type="date"
          value={form.last_serviced_on}
          onChange={(e) => setForm({ ...form, last_serviced_on: e.target.value })}
        />
      </div>
      {formId ? (
        <div className="flex items-center gap-2 sm:col-span-2">
          <Switch
            id="p-active"
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
          <Label htmlFor="p-active">{t("service.plans.active", "Active")}</Label>
        </div>
      ) : null}
    </div>
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
        {canManage ? (
          <Button className="rounded-full px-5" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("service.plans.add", "New Plan")}
          </Button>
        ) : null}
      </div>

      {overviewQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label={t("service.overview.plans", "Active plans")} value={n(summary.plans).toLocaleString()} />
          <StatTile
            label={t("service.plans.due_now", "Due now")}
            value={n(summary.due_now).toLocaleString()}
            alert={n(summary.due_now) > 0}
          />
          <StatTile
            label={t("service.plans.due_soon", "Falling due")}
            value={n(summary.due_soon).toLocaleString()}
            meta={t("service.plans.due_soon_meta", "within 30 days")}
            alert={n(summary.due_soon) > 0}
          />
        </div>
      ) : overviewQuery.isError ? (
        <EmptyPanel label={t("service.plans.summary_failed", "Could not load plan metrics.")} />
      ) : null}

      {upcoming.length > 0 ? (
        <Panel
          title={t("service.plans.upcoming", "Coming due")}
          description={t("service.plans.upcoming_desc", "Plans due within the next 30 days — overdue first.")}
        >
          <div className="space-y-1.5">
            {upcoming.slice(0, 6).map((row) => (
              <button
                key={row.plan_id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                onClick={() => setDetailId(row.plan_id)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{row.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{row.asset}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`block text-xs font-semibold ${
                      row.is_due ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {row.is_due
                      ? t("service.plans.overdue_short", "Overdue")
                      : t("service.plans.due_soon_short", "Due soon")}
                  </span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">
                    {row.next_due_on ? String(row.next_due_on).slice(0, 10) : "—"}
                    {row.days_remaining != null
                      ? ` · ${row.days_remaining <= 0 ? Math.abs(row.days_remaining) : row.days_remaining}d`
                      : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      {assetFilter !== "all" ? (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>{t("service.plans.filtered_asset", "Filtered to asset")} #{assetFilter}</span>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setAssetFilter("all")}>
            {t("service.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("service.requests.asset", "Asset")}</Label>
          <Select value={assetFilter} onValueChange={setAssetFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {assets.map((asset) => (
                <SelectItem key={asset.id} value={String(asset.id)}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="active-only" checked={activeOnly} onCheckedChange={setActiveOnly} />
          <Label htmlFor="active-only" className="text-sm">
            {t("service.plans.active_only", "Active only")}
          </Label>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="due-only" checked={dueOnly} onCheckedChange={setDueOnly} />
          <Label htmlFor="due-only" className="text-sm">
            {t("service.plans.due_only", "Due / overdue only")}
          </Label>
        </div>
      </div>

      {plansQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("service.plans.load_failed", "Could not load plans.")}</p>
          <Button variant="outline" size="sm" onClick={() => plansQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("service.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={plans}
          totalEntries={plansQuery.data?.meta?.total ?? 0}
          loading={plansQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("service.plans.search_hint", "Plan or asset name...")}
          resourceName="service-plans"
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {formId ? t("service.plans.edit", "Edit Plan") : t("service.plans.add", "New Plan")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.plans.add_desc",
                  "Leaving the last visit blank counts the first interval from today. Fill it in when you know when the equipment was genuinely last serviced.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{renderForm()}</div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => savePlan.mutate()}
              disabled={savePlan.isPending || !form.asset_id || !form.name.trim()}
            >
              {savePlan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label>{t("service.work.technician", "Engineer")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select value={technicianId || "none"} onValueChange={(v) => setTechnicianId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("service.work.unassigned", "Unassigned")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("service.work.unassigned", "Unassigned")}</SelectItem>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.technician_id} value={String(tech.technician_id)}>
                        {formatTechOption(tech)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {technicians.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("service.engineers.none_hint", "No engineers yet.")}{" "}
                  <Link href="/dashboard/service/engineers" className="font-medium text-primary underline">
                    {t("service.engineers.add", "Add engineer")}
                  </Link>
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {t("service.plans.least_loaded", "Listed least loaded first.")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-scheduled">{t("service.work.scheduled", "Scheduled for")}</Label>
              <Input
                id="b-scheduled"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setBooking(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => bookVisit.mutate()} disabled={bookVisit.isPending}>
              {bookVisit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.plans.book", "Book visit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteFor !== null} onOpenChange={(open) => !open && setDeleteFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.plans.delete_title", "Remove plan")}
              </DialogTitle>
              <DialogDescription>
                {t("service.plans.delete_desc", "Past work orders raised from this plan are kept on record.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDeleteFor(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={removePlan.isPending}
              onClick={() => deleteFor && removePlan.mutate(deleteFor.id)}
            >
              {removePlan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.common.delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.name ?? t("service.plans.plan", "Plan")}
              </DialogTitle>
              <DialogDescription>{detail?.asset?.name}</DialogDescription>
            </DialogHeader>
          </div>
          {detailQuery.isLoading ? (
            <div className="flex justify-center px-6 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-5 px-6 py-5 text-sm">
              <div className="flex flex-wrap gap-2">
                {canManage ? (
                  <Button size="sm" variant="outline" onClick={() => openEdit(detail)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {t("service.common.edit", "Edit")}
                  </Button>
                ) : null}
                {canBook && detail.is_active ? (
                  <Button size="sm" variant="outline" onClick={() => setBooking(detail)}>
                    <Wrench className="mr-2 h-3.5 w-3.5" />
                    {t("service.plans.book", "Book visit")}
                  </Button>
                ) : null}
                {detail.asset_id ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/service/assets`}>{t("service.requests.view_asset", "View asset")}</Link>
                  </Button>
                ) : null}
              </div>
              <Badge variant={detail.is_active ? "secondary" : "outline"}>
                {detail.is_active ? t("service.plans.active", "Active") : t("service.plans.inactive", "Inactive")}
              </Badge>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t("service.plans.interval", "Every")}: </span>
                  {t("service.plans.days", "{n} days").replace("{n}", String(detail.interval_days))}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("service.plans.hours", "Estimated hours")}: </span>
                  {detail.estimated_hours}h
                </div>
                <div>
                  <span className="text-muted-foreground">{t("service.plans.last", "Last done")}: </span>
                  {detail.last_serviced_on
                    ? String(detail.last_serviced_on).slice(0, 10)
                    : t("service.plans.never", "Never")}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("service.plans.next", "Next due")}: </span>
                  {detail.next_due_on ?? "—"}
                </div>
              </div>
              <p className={`font-semibold ${(detail.days_remaining ?? 1) <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {dueLabel(detail)}
              </p>
            </div>
          ) : detailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("service.plans.detail_failed", "Could not load this plan.")}</p>
              <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("service.common.retry", "Retry")}
              </Button>
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDetailId(null)}>
              {t("service.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
