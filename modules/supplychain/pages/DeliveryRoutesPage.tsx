"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { fetchUsers } from "@/modules/identity/api";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { DeliveryRoute } from "@/modules/supplychain/types";
import {
  SupplyChainDialogSkeleton,
  SupplyChainListSkeleton,
} from "@/modules/supplychain/pages/components/supply-chain-skeletons";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type RouteForm = {
  id?: number;
  name: string;
  code: string;
  area: string;
  default_vehicle: string;
  default_driver_id: string;
  planned_distance_km: string;
  planned_duration_minutes: string;
  capacity_units: string;
  service_days: string[];
  is_active: boolean;
  notes: string;
};

const DEFAULT_FORM: RouteForm = {
  name: "",
  code: "",
  area: "",
  default_vehicle: "",
  default_driver_id: "",
  planned_distance_km: "",
  planned_duration_minutes: "",
  capacity_units: "",
  service_days: [],
  is_active: true,
  notes: "",
};

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && "data" in payload) {
    const inner = (payload as { data: unknown }).data;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function driverLabel(route: DeliveryRoute): string {
  if (route.driver?.name) return route.driver.name;
  if (route.driver?.email) return route.driver.email;
  if (route.default_driver_id) return `User #${route.default_driver_id}`;
  return "—";
}

function routeToForm(route: DeliveryRoute): RouteForm {
  return {
    id: route.id,
    name: route.name,
    code: route.code,
    area: route.area ?? "",
    default_vehicle: route.default_vehicle ?? "",
    default_driver_id: route.default_driver_id ? String(route.default_driver_id) : "",
    planned_distance_km: route.planned_distance_km ? String(route.planned_distance_km) : "",
    planned_duration_minutes: route.planned_duration_minutes ? String(route.planned_duration_minutes) : "",
    capacity_units: route.capacity_units ? String(route.capacity_units) : "",
    service_days: route.service_days ?? [],
    is_active: route.is_active,
    notes: route.notes ?? "",
  };
}

function RouteStatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={`border-transparent text-[11px] font-black uppercase tracking-widest ${
        active
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {active ? t("supply_chain.common.active", "Active") : t("supply_chain.common.retired", "Retired")}
    </Badge>
  );
}

export default function DeliveryRoutesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");

  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<RouteForm>(DEFAULT_FORM);
  const [loadingEditId, setLoadingEditId] = React.useState<number | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [loadingViewId, setLoadingViewId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<DeliveryRoute | null>(null);

  const pickerOpenRef = React.useRef(false);
  const pickerCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openPickerCount, setOpenPickerCount] = React.useState(0);

  const handlePickerOpenChange = React.useCallback((open: boolean) => {
    if (pickerCloseTimerRef.current) {
      clearTimeout(pickerCloseTimerRef.current);
      pickerCloseTimerRef.current = null;
    }
    if (open) {
      pickerOpenRef.current = true;
      setOpenPickerCount((n) => n + 1);
      return;
    }
    pickerOpenRef.current = true;
    setOpenPickerCount((n) => Math.max(0, n - 1));
    pickerCloseTimerRef.current = setTimeout(() => {
      pickerOpenRef.current = false;
      pickerCloseTimerRef.current = null;
    }, 300);
  }, []);

  const blockOutsideDismiss = React.useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault();
  }, []);

  const allowDialogClose = React.useCallback(
    (open: boolean, close: () => void) => {
      if (!open && (pickerOpenRef.current || openPickerCount > 0)) return;
      if (!open) close();
    },
    [openPickerCount],
  );

  const routesQuery = useQuery({
    queryKey: ["supply-chain", "routes", tableQuery, statusFilter],
    queryFn: () =>
      supplyChainApi
        .listRoutes({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          is_active:
            statusFilter === "all" ? undefined : statusFilter === "active",
        })
        .then((r) => r.data),
  });

  const usersQuery = useQuery({
    queryKey: ["identity", "users", "route-drivers"],
    queryFn: async () => {
      const res = await fetchUsers({ per_page: 100 });
      return unwrapList<{ id: number; name?: string; email?: string }>(res);
    },
  });

  const driverNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const u of usersQuery.data ?? []) {
      map.set(u.id, u.name || u.email || `User #${u.id}`);
    }
    return map;
  }, [usersQuery.data]);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const resetForm = React.useCallback(() => {
    setForm(DEFAULT_FORM);
  }, []);

  const closeForm = React.useCallback(() => {
    setFormOpen(false);
    resetForm();
    setLoadingEditId(null);
  }, [resetForm]);

  const closeDetail = React.useCallback(() => {
    setDetailOpen(false);
    setDetail(null);
    setDetailLoading(false);
    setLoadingViewId(null);
  }, []);

  const openView = React.useCallback(
    async (id: number) => {
      setLoadingViewId(id);
      setDetailOpen(true);
      setDetailLoading(true);
      setDetail(null);
      try {
        const res = await supplyChainApi.getRoute(id);
        setDetail(res.data?.data ?? null);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || t("supply_chain.routes.load_failed", "Could not load the route."));
        closeDetail();
      } finally {
        setDetailLoading(false);
        setLoadingViewId(null);
      }
    },
    [closeDetail, t],
  );

  const openEdit = React.useCallback(
    async (id: number) => {
      setLoadingEditId(id);
      try {
        const res = await supplyChainApi.getRoute(id);
        const route = res.data?.data;
        if (!route) throw new Error("Route not found");
        setForm(routeToForm(route));
        setFormOpen(true);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || t("supply_chain.routes.load_failed", "Could not load the route."));
      } finally {
        setLoadingEditId(null);
      }
    },
    [t],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        area: form.area || undefined,
        default_vehicle: form.default_vehicle || undefined,
        default_driver_id: form.default_driver_id ? Number(form.default_driver_id) : null,
        planned_distance_km: form.planned_distance_km ? Number(form.planned_distance_km) : undefined,
        planned_duration_minutes: form.planned_duration_minutes ? Number(form.planned_duration_minutes) : undefined,
        capacity_units: form.capacity_units ? Number(form.capacity_units) : undefined,
        service_days: form.service_days,
        is_active: form.is_active,
        notes: form.notes || undefined,
      };

      return form.id ? supplyChainApi.updateRoute(form.id, payload) : supplyChainApi.createRoute(payload);
    },
    onSuccess: () => {
      toast.success(t("supply_chain.routes.saved", "Route saved."));
      invalidate();
      closeForm();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.routes.save_failed", "Could not save the route.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      setDeletingId(id);
      return supplyChainApi.deleteRoute(id);
    },
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.routes.deleted", "Route removed."));
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Could not remove it."),
    onSettled: () => setDeletingId(null),
  });

  const handleDelete = React.useCallback(
    (route: DeliveryRoute) => {
      const hasShipments = (route.shipments_count ?? 0) > 0;
      const message = hasShipments
        ? t(
            "supply_chain.routes.delete_retire_confirm",
            "This route has delivery history and will be retired instead of deleted. Continue?",
          )
        : t("supply_chain.routes.delete_confirm", "Remove this route? This cannot be undone.");
      if (!window.confirm(message)) return;
      deleteMutation.mutate(route.id);
    },
    [deleteMutation, t],
  );

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const columns = React.useMemo<ColumnDef<DeliveryRoute>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("supply_chain.common.route", "Route"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      {
        accessorKey: "area",
        header: t("supply_chain.routes.area", "Area"),
        cell: ({ row }) => <span className="text-sm">{row.original.area ?? "—"}</span>,
      },
      {
        id: "days",
        header: t("supply_chain.routes.days", "Service days"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(row.original.service_days ?? []).map((day) => (
              <Badge key={day} variant="secondary" className="text-[10px] font-bold uppercase" title={DAY_LABELS[day] ?? day}>
                {day}
              </Badge>
            ))}
            {(row.original.service_days ?? []).length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "planned_distance_km",
        header: t("supply_chain.routes.distance", "Distance"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.planned_distance_km ? `${Number(row.original.planned_distance_km).toLocaleString()} km` : "—"}
          </span>
        ),
      },
      {
        id: "duration",
        header: t("supply_chain.routes.duration", "Duration"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{formatDuration(row.original.planned_duration_minutes)}</span>
        ),
      },
      {
        accessorKey: "default_vehicle",
        header: t("supply_chain.shipments.vehicle", "Vehicle"),
        cell: ({ row }) => <span className="text-sm">{row.original.default_vehicle ?? "—"}</span>,
      },
      {
        id: "driver",
        header: t("supply_chain.shipments.driver", "Driver"),
        cell: ({ row }) => <span className="text-sm">{driverLabel(row.original)}</span>,
      },
      {
        accessorKey: "capacity_units",
        header: t("supply_chain.routes.capacity", "Capacity"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.capacity_units ? row.original.capacity_units.toLocaleString() : "—"}
          </span>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("supply_chain.common.status", "Status"),
        cell: ({ row }) => <RouteStatusBadge active={row.original.is_active} />,
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => {
          const record = row.original;
          const isViewLoading = loadingViewId === record.id;
          const isEditLoading = loadingEditId === record.id;
          const isDeleting = deletingId === record.id;

          return (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isViewLoading || isEditLoading || isDeleting}
                onClick={() => openView(record.id)}
                aria-label={t("supply_chain.common.view", "View")}
              >
                {isViewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isEditLoading || isViewLoading || isDeleting}
                onClick={() => openEdit(record.id)}
                aria-label={t("supply_chain.common.edit", "Edit")}
              >
                {isEditLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
                disabled={isDeleting || isViewLoading || isEditLoading}
                onClick={() => handleDelete(record)}
                aria-label={t("supply_chain.common.delete", "Delete")}
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, handleDelete, loadingEditId, loadingViewId, openEdit, openView, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("supply_chain.routes.title", "Delivery Routes")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.routes.subtitle",
              "The rounds your trucks run, and the capacity each one can carry in a pass.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("supply_chain.routes.add", "Add Route")}
        </Button>
      </div>

      {routesQuery.isPending ? (
        <SupplyChainListSkeleton filters={1} cols={9} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.common.status", "Status")}</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setTableQuery((p) => ({ ...p, page: 1 }));
                }}
              >
                <SelectTrigger className="h-9 w-[12rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  <SelectItem value="active">{t("supply_chain.common.active", "Active")}</SelectItem>
                  <SelectItem value="retired">{t("supply_chain.common.retired", "Retired")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={(routesQuery.data?.data ?? []) as DeliveryRoute[]}
            totalEntries={routesQuery.data?.meta?.total ?? 0}
            loading={routesQuery.isFetching && !routesQuery.isPending}
            pageIndex={tableQuery.page}
            pageSize={tableQuery.pageSize}
            onQueryChange={handleTableQueryChange}
            searchPlaceholder={t("supply_chain.routes.search", "Search routes, area, vehicle, notes…")}
            resourceName="delivery-routes"
          />
        </>
      )}

      {/* Create / Edit */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => allowDialogClose(open, () => (open ? setFormOpen(true) : closeForm()))}
      >
        <DialogContent
          className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {form.id ? t("supply_chain.routes.edit", "Edit Route") : t("supply_chain.routes.new", "New Route")}
              </DialogTitle>
              <DialogDescription>
                {t("supply_chain.routes.desc", "Route performance on the overview is grouped by these rounds.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rt-name">{t("supply_chain.common.name", "Name")}</Label>
              <Input
                id="rt-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Bole & Kazanchis"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-code">{t("supply_chain.common.code", "Code")}</Label>
              <Input
                id="rt-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="RT-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-area">{t("supply_chain.routes.area", "Area")}</Label>
              <Input id="rt-area" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-vehicle">{t("supply_chain.routes.default_vehicle", "Default vehicle")}</Label>
              <Input
                id="rt-vehicle"
                value={form.default_vehicle}
                onChange={(e) => setForm((f) => ({ ...f, default_vehicle: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("supply_chain.shipments.driver", "Default driver")}</Label>
              <Select
                value={form.default_driver_id || "none"}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setForm((f) => ({ ...f, default_driver_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                  {(usersQuery.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.email || `User #${u.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-distance">{t("supply_chain.routes.distance", "Planned distance (km)")}</Label>
              <Input
                id="rt-distance"
                type="number"
                min={0}
                value={form.planned_distance_km}
                onChange={(e) => setForm((f) => ({ ...f, planned_distance_km: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-duration">{t("supply_chain.routes.duration_minutes", "Planned duration (minutes)")}</Label>
              <Input
                id="rt-duration"
                type="number"
                min={0}
                value={form.planned_duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, planned_duration_minutes: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-capacity">{t("supply_chain.routes.capacity_units", "Capacity (units)")}</Label>
              <Input
                id="rt-capacity"
                type="number"
                min={0}
                value={form.capacity_units}
                onChange={(e) => setForm((f) => ({ ...f, capacity_units: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 md:col-span-2">
              <div>
                <Label htmlFor="rt-active" className="text-sm font-semibold">
                  {t("supply_chain.routes.active_route", "Active route")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("supply_chain.routes.active_hint", "Retired routes stay in history but won't appear on new shipments.")}
                </p>
              </div>
              <Switch
                id="rt-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("supply_chain.routes.days", "Service days")}</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const selected = form.service_days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={selected}
                      title={DAY_LABELS[day]}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          service_days: selected
                            ? f.service_days.filter((d) => d !== day)
                            : [...f.service_days, day],
                        }))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase transition-colors ${
                        selected
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="rt-notes">{t("supply_chain.common.notes", "Notes")}</Label>
              <Textarea
                id="rt-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("supply_chain.routes.notes_placeholder", "Coverage notes, gate codes, timing…")}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={closeForm}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!form.name.trim() || !form.code.trim()) {
                  toast.error(t("supply_chain.routes.required", "Name and code are required."));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={detailOpen} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.name ?? t("supply_chain.routes.detail", "Route")}
              </DialogTitle>
              <DialogDescription>
                {detailLoading ? t("supply_chain.common.loading", "Loading…") : detail?.code ?? ""}
              </DialogDescription>
            </DialogHeader>
          </div>
          {detailLoading ? (
            <SupplyChainDialogSkeleton rows={4} />
          ) : detail ? (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.common.status", "Status")}
                  </p>
                  <RouteStatusBadge active={detail.is_active} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.routes.shipments", "Shipments")}
                  </p>
                  <p className="tabular-nums">{detail.shipments_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.routes.area", "Area")}
                  </p>
                  <p>{detail.area ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.shipments.vehicle", "Vehicle")}
                  </p>
                  <p>{detail.default_vehicle ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.shipments.driver", "Driver")}
                  </p>
                  <p>
                    {detail.default_driver_id
                      ? driverNameById.get(detail.default_driver_id) ?? driverLabel(detail)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.routes.distance", "Planned distance")}
                  </p>
                  <p className="tabular-nums">
                    {detail.planned_distance_km ? `${Number(detail.planned_distance_km).toLocaleString()} km` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.routes.duration", "Planned duration")}
                  </p>
                  <p>{formatDuration(detail.planned_duration_minutes)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.routes.capacity", "Capacity")}
                  </p>
                  <p className="tabular-nums">
                    {detail.capacity_units ? detail.capacity_units.toLocaleString() : "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  {t("supply_chain.routes.days", "Service days")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(detail.service_days ?? []).length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    (detail.service_days ?? []).map((day) => (
                      <Badge key={day} variant="secondary" className="text-[10px] font-bold uppercase">
                        {DAY_LABELS[day] ?? day}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {detail.notes ? (
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("supply_chain.common.notes", "Notes")}
                  </p>
                  <p className="text-muted-foreground">{detail.notes}</p>
                </div>
              ) : null}

              {(detail.shipments_count ?? 0) > 0 ? (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
                  {t(
                    "supply_chain.routes.history_hint",
                    "This route has delivery history. Deleting it will retire the route instead of removing it.",
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={closeDetail}>
              {t("supply_chain.common.close", "Close")}
            </Button>
            {detail ? (
              <Button
                className="rounded-full"
                onClick={() => {
                  closeDetail();
                  openEdit(detail.id);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t("supply_chain.common.edit", "Edit")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
