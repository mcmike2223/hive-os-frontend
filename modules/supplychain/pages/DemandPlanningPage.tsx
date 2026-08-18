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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { DemandForecast, PlanningProfile } from "@/modules/supplychain/types";

const POLICIES = ["reorder_point", "min_max", "periodic_review", "make_to_order", "none"] as const;
const SOURCES = ["manual", "historical", "production_plan", "contract"] as const;

type ProfileForm = {
  id?: number;
  product_id: string;
  warehouse_id: string;
  policy: string;
  safety_stock: string;
  reorder_point: string;
  reorder_quantity: string;
  maximum_level: string;
  minimum_order_quantity: string;
  order_multiple: string;
  lead_time_days: string;
  average_daily_demand: string;
  abc_class: string;
};

const DEFAULT_PROFILE: ProfileForm = {
  product_id: "",
  warehouse_id: "",
  policy: "reorder_point",
  safety_stock: "0",
  reorder_point: "0",
  reorder_quantity: "0",
  maximum_level: "",
  minimum_order_quantity: "0",
  order_multiple: "",
  lead_time_days: "0",
  average_daily_demand: "0",
  abc_class: "",
};

type ForecastForm = {
  id?: number;
  product_id: string;
  warehouse_id: string;
  period_start: string;
  period_end: string;
  forecast_quantity: string;
  actual_quantity: string;
  source: string;
};

const DEFAULT_FORECAST: ForecastForm = {
  product_id: "",
  warehouse_id: "",
  period_start: "",
  period_end: "",
  forecast_quantity: "",
  actual_quantity: "",
  source: "manual",
};

export default function DemandPlanningPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<"profiles" | "forecasts">("profiles");
  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState<ProfileForm>(DEFAULT_PROFILE);
  const [forecastOpen, setForecastOpen] = React.useState(false);
  const [forecastForm, setForecastForm] = React.useState<ForecastForm>(DEFAULT_FORECAST);

  const profilesQuery = useQuery({
    queryKey: ["supply-chain", "profiles", tableQuery],
    queryFn: () =>
      supplyChainApi.listProfiles({ page: tableQuery.page, limit: tableQuery.pageSize }).then((r) => r.data),
    enabled: tab === "profiles",
  });

  const forecastsQuery = useQuery({
    queryKey: ["supply-chain", "forecasts", tableQuery],
    queryFn: () =>
      supplyChainApi.listForecasts({ page: tableQuery.page, limit: tableQuery.pageSize }).then((r) => r.data),
    enabled: tab === "forecasts",
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const saveProfile = useMutation({
    mutationFn: () => {
      const payload = {
        product_id: Number(profileForm.product_id),
        warehouse_id: profileForm.warehouse_id ? Number(profileForm.warehouse_id) : undefined,
        policy: profileForm.policy,
        safety_stock: Number(profileForm.safety_stock || 0),
        reorder_point: Number(profileForm.reorder_point || 0),
        reorder_quantity: Number(profileForm.reorder_quantity || 0),
        maximum_level: profileForm.maximum_level ? Number(profileForm.maximum_level) : null,
        minimum_order_quantity: Number(profileForm.minimum_order_quantity || 0),
        order_multiple: profileForm.order_multiple ? Number(profileForm.order_multiple) : null,
        lead_time_days: Number(profileForm.lead_time_days || 0),
        average_daily_demand: Number(profileForm.average_daily_demand || 0),
        abc_class: profileForm.abc_class || null,
      };

      return profileForm.id
        ? supplyChainApi.updateProfile(profileForm.id, payload)
        : supplyChainApi.createProfile(payload);
    },
    onSuccess: () => {
      toast.success(t("supply_chain.planning.profile_saved", "Planning profile saved."));
      invalidate();
      setProfileOpen(false);
      setProfileForm(DEFAULT_PROFILE);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.planning.profile_failed", "Could not save the profile.")),
  });

  const deleteProfile = useMutation({
    mutationFn: (id: number) => supplyChainApi.deleteProfile(id),
    onSuccess: () => {
      toast.success(t("supply_chain.planning.profile_deleted", "Planning profile deleted."));
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Could not delete it."),
  });

  const saveForecast = useMutation({
    mutationFn: () => {
      const payload = {
        product_id: Number(forecastForm.product_id),
        warehouse_id: forecastForm.warehouse_id ? Number(forecastForm.warehouse_id) : undefined,
        period_start: forecastForm.period_start,
        period_end: forecastForm.period_end,
        forecast_quantity: Number(forecastForm.forecast_quantity || 0),
        actual_quantity: forecastForm.actual_quantity ? Number(forecastForm.actual_quantity) : null,
        source: forecastForm.source,
      };

      return forecastForm.id
        ? supplyChainApi.updateForecast(forecastForm.id, payload)
        : supplyChainApi.createForecast(payload);
    },
    onSuccess: () => {
      toast.success(t("supply_chain.planning.forecast_saved", "Forecast saved."));
      invalidate();
      setForecastOpen(false);
      setForecastForm(DEFAULT_FORECAST);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || t("supply_chain.planning.forecast_failed", "Could not save the forecast.")),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const profileColumns = React.useMemo<ColumnDef<PlanningProfile>[]>(
    () => [
      {
        id: "product",
        header: t("supply_chain.common.product", "Product"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.product?.name ?? `#${row.original.product_id}`}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.warehouse_id
                ? `${t("supply_chain.common.warehouse", "Warehouse")} #${row.original.warehouse_id}`
                : t("supply_chain.replenishment.network_wide", "Network-wide")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "policy",
        header: t("supply_chain.planning.policy", "Policy"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] font-semibold">
            {row.original.policy.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        id: "levels",
        header: t("supply_chain.planning.levels", "Safety / Reorder / Max"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {Number(row.original.safety_stock).toLocaleString()} /{" "}
            {Number(row.original.reorder_point).toLocaleString()} /{" "}
            {row.original.maximum_level ? Number(row.original.maximum_level).toLocaleString() : "—"}
          </span>
        ),
      },
      {
        accessorKey: "lead_time_days",
        header: t("supply_chain.planning.lead_time", "Lead time"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm tabular-nums">{row.original.lead_time_days} {t("supply_chain.common.days", "days")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("supply_chain.planning.lead_demand", "Needs")} {row.original.lead_time_demand.toLocaleString()}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "abc_class",
        header: "ABC",
        cell: ({ row }) => <span className="text-xs font-bold">{row.original.abc_class ?? "—"}</span>,
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
                const p = row.original;
                setProfileForm({
                  id: p.id,
                  product_id: String(p.product_id),
                  warehouse_id: p.warehouse_id ? String(p.warehouse_id) : "",
                  policy: p.policy,
                  safety_stock: String(p.safety_stock),
                  reorder_point: String(p.reorder_point),
                  reorder_quantity: String(p.reorder_quantity),
                  maximum_level: p.maximum_level ? String(p.maximum_level) : "",
                  minimum_order_quantity: String(p.minimum_order_quantity),
                  order_multiple: p.order_multiple ? String(p.order_multiple) : "",
                  lead_time_days: String(p.lead_time_days),
                  average_daily_demand: String(p.average_daily_demand),
                  abc_class: p.abc_class ?? "",
                });
                setProfileOpen(true);
              }}
            >
              {t("supply_chain.common.edit", "Edit")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-destructive"
              onClick={() => deleteProfile.mutate(row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [deleteProfile, t],
  );

  const forecastColumns = React.useMemo<ColumnDef<DemandForecast>[]>(
    () => [
      {
        id: "product",
        header: t("supply_chain.common.product", "Product"),
        cell: ({ row }) => (
          <span className="font-bold">{row.original.product?.name ?? `#${row.original.product_id}`}</span>
        ),
      },
      {
        id: "period",
        header: t("supply_chain.planning.period", "Period"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.period_start} → {row.original.period_end}
          </span>
        ),
      },
      {
        accessorKey: "forecast_quantity",
        header: t("supply_chain.planning.forecast", "Forecast"),
        cell: ({ row }) => (
          <span className="font-bold tabular-nums">{Number(row.original.forecast_quantity).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "actual_quantity",
        header: t("supply_chain.planning.actual", "Actual"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.actual_quantity !== null && row.original.actual_quantity !== undefined
              ? Number(row.original.actual_quantity).toLocaleString()
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "accuracy_percent",
        header: t("supply_chain.planning.accuracy", "Accuracy"),
        cell: ({ row }) => {
          const accuracy = row.original.accuracy_percent;
          if (accuracy === null || accuracy === undefined) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          const tone =
            accuracy >= 90
              ? "text-emerald-600 dark:text-emerald-400"
              : accuracy >= 70
                ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-400";
          return <span className={`font-semibold tabular-nums ${tone}`}>{accuracy.toFixed(1)}%</span>;
        },
      },
      {
        accessorKey: "source",
        header: t("supply_chain.planning.source", "Source"),
        cell: ({ row }) => <span className="text-xs">{row.original.source.replace(/_/g, " ")}</span>,
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("supply_chain.planning.title", "Demand Planning")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.planning.subtitle",
              "The stocking policy behind every replenishment suggestion, and the forecast it nets against.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            if (tab === "profiles") {
              setProfileForm(DEFAULT_PROFILE);
              setProfileOpen(true);
            } else {
              setForecastForm(DEFAULT_FORECAST);
              setForecastOpen(true);
            }
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {tab === "profiles"
            ? t("supply_chain.planning.add_profile", "Add Profile")
            : t("supply_chain.planning.add_forecast", "Add Forecast")}
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border/60">
        {(["profiles", "forecasts"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            aria-current={tab === value ? "page" : undefined}
          >
            {value === "profiles"
              ? t("supply_chain.planning.tab_profiles", "Planning Profiles")
              : t("supply_chain.planning.tab_forecasts", "Forecasts")}
          </button>
        ))}
      </div>

      {tab === "profiles" ? (
        <DataTable
          columns={profileColumns}
          data={(profilesQuery.data?.data ?? []) as PlanningProfile[]}
          totalEntries={profilesQuery.data?.meta?.total ?? 0}
          loading={profilesQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("supply_chain.planning.search_profiles", "Search planning profiles...")}
          resourceName="planning-profiles"
        />
      ) : (
        <DataTable
          columns={forecastColumns}
          data={(forecastsQuery.data?.data ?? []) as DemandForecast[]}
          totalEntries={forecastsQuery.data?.meta?.total ?? 0}
          loading={forecastsQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("supply_chain.planning.search_forecasts", "Search forecasts...")}
          resourceName="demand-forecasts"
        />
      )}

      {/* Planning profile */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {profileForm.id
                  ? t("supply_chain.planning.edit_profile", "Edit Planning Profile")
                  : t("supply_chain.planning.new_profile", "New Planning Profile")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.planning.profile_desc",
                  "A reorder point below lead-time demand plus safety stock guarantees a stockout even when the supplier performs perfectly.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 md:grid-cols-3">
            <Field label={t("supply_chain.common.product_id", "Product ID")} id="pp-product">
              <Input id="pp-product" type="number" value={profileForm.product_id} onChange={(e) => setProfileForm((p) => ({ ...p, product_id: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.common.warehouse_id", "Warehouse ID")} id="pp-warehouse" hint={t("supply_chain.planning.warehouse_hint", "Blank = network-wide")}>
              <Input id="pp-warehouse" type="number" value={profileForm.warehouse_id} onChange={(e) => setProfileForm((p) => ({ ...p, warehouse_id: e.target.value }))} />
            </Field>
            <div className="space-y-2">
              <Label>{t("supply_chain.planning.policy", "Policy")}</Label>
              <Select value={profileForm.policy} onValueChange={(v) => setProfileForm((p) => ({ ...p, policy: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POLICIES.map((policy) => (
                    <SelectItem key={policy} value={policy}>{policy.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Field label={t("supply_chain.planning.safety_stock", "Safety stock")} id="pp-safety">
              <Input id="pp-safety" type="number" value={profileForm.safety_stock} onChange={(e) => setProfileForm((p) => ({ ...p, safety_stock: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.planning.reorder_point", "Reorder point")} id="pp-rop">
              <Input id="pp-rop" type="number" value={profileForm.reorder_point} onChange={(e) => setProfileForm((p) => ({ ...p, reorder_point: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.planning.reorder_quantity", "Reorder quantity")} id="pp-roq">
              <Input id="pp-roq" type="number" value={profileForm.reorder_quantity} onChange={(e) => setProfileForm((p) => ({ ...p, reorder_quantity: e.target.value }))} />
            </Field>

            <Field label={t("supply_chain.planning.maximum_level", "Maximum level")} id="pp-max" hint={t("supply_chain.planning.max_hint", "Used by min/max")}>
              <Input id="pp-max" type="number" value={profileForm.maximum_level} onChange={(e) => setProfileForm((p) => ({ ...p, maximum_level: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.planning.moq", "Supplier MOQ")} id="pp-moq">
              <Input id="pp-moq" type="number" value={profileForm.minimum_order_quantity} onChange={(e) => setProfileForm((p) => ({ ...p, minimum_order_quantity: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.planning.multiple", "Order multiple")} id="pp-multiple" hint={t("supply_chain.planning.multiple_hint", "Pallet or container size")}>
              <Input id="pp-multiple" type="number" value={profileForm.order_multiple} onChange={(e) => setProfileForm((p) => ({ ...p, order_multiple: e.target.value }))} />
            </Field>

            <Field label={t("supply_chain.planning.lead_time_days", "Lead time (days)")} id="pp-lead">
              <Input id="pp-lead" type="number" value={profileForm.lead_time_days} onChange={(e) => setProfileForm((p) => ({ ...p, lead_time_days: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.planning.daily_demand", "Average daily demand")} id="pp-demand">
              <Input id="pp-demand" type="number" value={profileForm.average_daily_demand} onChange={(e) => setProfileForm((p) => ({ ...p, average_daily_demand: e.target.value }))} />
            </Field>
            <div className="space-y-2">
              <Label>{t("supply_chain.planning.abc", "ABC class")}</Label>
              <Select value={profileForm.abc_class || "none"} onValueChange={(v) => setProfileForm((p) => ({ ...p, abc_class: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                  {["A", "B", "C"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setProfileOpen(false)}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={saveProfile.isPending}
              onClick={() => {
                if (!profileForm.product_id) {
                  toast.error(t("supply_chain.planning.product_required", "A product is required."));
                  return;
                }
                saveProfile.mutate();
              }}
            >
              {saveProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forecast */}
      <Dialog open={forecastOpen} onOpenChange={setForecastOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.planning.new_forecast", "Demand Forecast")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.planning.forecast_desc",
                  "Re-forecasting the same period replaces the number rather than stacking a second row the netting would double count.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <Field label={t("supply_chain.common.product_id", "Product ID")} id="fc-product">
              <Input id="fc-product" type="number" value={forecastForm.product_id} onChange={(e) => setForecastForm((f) => ({ ...f, product_id: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.common.warehouse_id", "Warehouse ID")} id="fc-warehouse">
              <Input id="fc-warehouse" type="number" value={forecastForm.warehouse_id} onChange={(e) => setForecastForm((f) => ({ ...f, warehouse_id: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.planning.period_start", "Period start")} id="fc-start">
              <Input id="fc-start" type="date" value={forecastForm.period_start} onChange={(e) => setForecastForm((f) => ({ ...f, period_start: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.planning.period_end", "Period end")} id="fc-end">
              <Input id="fc-end" type="date" value={forecastForm.period_end} onChange={(e) => setForecastForm((f) => ({ ...f, period_end: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.planning.forecast_quantity", "Forecast quantity")} id="fc-qty">
              <Input id="fc-qty" type="number" value={forecastForm.forecast_quantity} onChange={(e) => setForecastForm((f) => ({ ...f, forecast_quantity: e.target.value }))} />
            </Field>
            <Field label={t("supply_chain.planning.actual", "Actual (after the fact)")} id="fc-actual">
              <Input id="fc-actual" type="number" value={forecastForm.actual_quantity} onChange={(e) => setForecastForm((f) => ({ ...f, actual_quantity: e.target.value }))} />
            </Field>
            <div className="space-y-2">
              <Label>{t("supply_chain.planning.source", "Source")}</Label>
              <Select value={forecastForm.source} onValueChange={(v) => setForecastForm((f) => ({ ...f, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setForecastOpen(false)}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={saveForecast.isPending}
              onClick={() => {
                if (!forecastForm.product_id || !forecastForm.period_start || !forecastForm.period_end) {
                  toast.error(t("supply_chain.planning.forecast_required", "Product and period are required."));
                  return;
                }
                saveForecast.mutate();
              }}
            >
              {saveForecast.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
