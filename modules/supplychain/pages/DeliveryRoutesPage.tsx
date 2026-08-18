"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { DeliveryRoute } from "@/modules/supplychain/types";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type RouteForm = {
  id?: number;
  name: string;
  code: string;
  area: string;
  default_vehicle: string;
  planned_distance_km: string;
  capacity_units: string;
  service_days: string[];
};

const DEFAULT_FORM: RouteForm = {
  name: "",
  code: "",
  area: "",
  default_vehicle: "",
  planned_distance_km: "",
  capacity_units: "",
  service_days: [],
};

export default function DeliveryRoutesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<RouteForm>(DEFAULT_FORM);

  const routesQuery = useQuery({
    queryKey: ["supply-chain", "routes", tableQuery],
    queryFn: () =>
      supplyChainApi
        .listRoutes({ page: tableQuery.page, limit: tableQuery.pageSize, search: tableQuery.search || undefined })
        .then((r) => r.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        area: form.area || undefined,
        default_vehicle: form.default_vehicle || undefined,
        planned_distance_km: form.planned_distance_km ? Number(form.planned_distance_km) : undefined,
        capacity_units: form.capacity_units ? Number(form.capacity_units) : undefined,
        service_days: form.service_days,
      };

      return form.id ? supplyChainApi.updateRoute(form.id, payload) : supplyChainApi.createRoute(payload);
    },
    onSuccess: () => {
      toast.success(t("supply_chain.routes.saved", "Route saved."));
      invalidate();
      setOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.routes.save_failed", "Could not save the route.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => supplyChainApi.deleteRoute(id),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.routes.deleted", "Route removed."));
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Could not remove it."),
  });

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
              <Badge key={day} variant="secondary" className="text-[10px] font-bold uppercase">{day}</Badge>
            ))}
            {(row.original.service_days ?? []).length === 0 ? <span className="text-xs text-muted-foreground">—</span> : null}
          </div>
        ),
      },
      {
        accessorKey: "default_vehicle",
        header: t("supply_chain.shipments.vehicle", "Vehicle"),
        cell: ({ row }) => <span className="text-sm">{row.original.default_vehicle ?? "—"}</span>,
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
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`border-transparent text-[11px] font-black uppercase tracking-widest ${
              row.original.is_active
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {row.original.is_active ? t("supply_chain.common.active", "Active") : t("supply_chain.common.retired", "Retired")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const route = row.original;
                setForm({
                  id: route.id,
                  name: route.name,
                  code: route.code,
                  area: route.area ?? "",
                  default_vehicle: route.default_vehicle ?? "",
                  planned_distance_km: route.planned_distance_km ? String(route.planned_distance_km) : "",
                  capacity_units: route.capacity_units ? String(route.capacity_units) : "",
                  service_days: route.service_days ?? [],
                });
                setOpen(true);
              }}
            >
              {t("supply_chain.common.edit", "Edit")}
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteMutation.mutate(row.original.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [deleteMutation, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("supply_chain.routes.title", "Delivery Routes")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("supply_chain.routes.subtitle", "The rounds your trucks run, and the capacity each one can carry in a pass.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => { setForm(DEFAULT_FORM); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("supply_chain.routes.add", "Add Route")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(routesQuery.data?.data ?? []) as DeliveryRoute[]}
        totalEntries={routesQuery.data?.meta?.total ?? 0}
        loading={routesQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("supply_chain.routes.search", "Search routes...")}
        resourceName="delivery-routes"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
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

          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rt-name">{t("supply_chain.common.name", "Name")}</Label>
              <Input id="rt-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Bole & Kazanchis" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-code">{t("supply_chain.common.code", "Code")}</Label>
              <Input id="rt-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="RT-01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-area">{t("supply_chain.routes.area", "Area")}</Label>
              <Input id="rt-area" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-vehicle">{t("supply_chain.routes.default_vehicle", "Default vehicle")}</Label>
              <Input id="rt-vehicle" value={form.default_vehicle} onChange={(e) => setForm((f) => ({ ...f, default_vehicle: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-distance">{t("supply_chain.routes.distance", "Planned distance (km)")}</Label>
              <Input id="rt-distance" type="number" value={form.planned_distance_km} onChange={(e) => setForm((f) => ({ ...f, planned_distance_km: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-capacity">{t("supply_chain.routes.capacity_units", "Capacity (units)")}</Label>
              <Input id="rt-capacity" type="number" value={form.capacity_units} onChange={(e) => setForm((f) => ({ ...f, capacity_units: e.target.value }))} />
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
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
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
    </div>
  );
}
