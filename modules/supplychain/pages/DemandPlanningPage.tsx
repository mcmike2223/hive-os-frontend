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
import { Textarea } from "@/components/ui/textarea";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { DemandForecast, PlanningProfile } from "@/modules/supplychain/types";
import { SupplyChainPlanningSkeleton } from "@/modules/supplychain/pages/components/supply-chain-skeletons";
import { fetchInventoryProducts, fetchInventorySuppliers } from "@/modules/inventory/api";
import type { ProductRecord, Supplier } from "@/modules/inventory/types";
import { warehouseApi } from "@/modules/warehouse/api";
import type { Warehouse } from "@/modules/warehouse/types";

const POLICIES = ["reorder_point", "min_max", "periodic_review", "make_to_order", "none"] as const;
const SOURCES = ["manual", "historical", "production_plan", "contract"] as const;

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

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
  review_period_days: string;
  average_daily_demand: string;
  abc_class: string;
  preferred_supplier_id: string;
  is_active: boolean;
  notes: string;
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
  review_period_days: "0",
  average_daily_demand: "0",
  abc_class: "",
  preferred_supplier_id: "",
  is_active: true,
  notes: "",
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
  confidence_percent: string;
  notes: string;
};

const DEFAULT_FORECAST: ForecastForm = {
  product_id: "",
  warehouse_id: "",
  period_start: "",
  period_end: "",
  forecast_quantity: "",
  actual_quantity: "",
  source: "manual",
  confidence_percent: "",
  notes: "",
};

function profileFromRow(p: PlanningProfile): ProfileForm {
  return {
    id: p.id,
    product_id: String(p.product_id),
    warehouse_id: p.warehouse_id ? String(p.warehouse_id) : "",
    policy: p.policy,
    safety_stock: String(p.safety_stock ?? 0),
    reorder_point: String(p.reorder_point ?? 0),
    reorder_quantity: String(p.reorder_quantity ?? 0),
    maximum_level: p.maximum_level != null && p.maximum_level !== "" ? String(p.maximum_level) : "",
    minimum_order_quantity: String(p.minimum_order_quantity ?? 0),
    order_multiple: p.order_multiple != null && p.order_multiple !== "" ? String(p.order_multiple) : "",
    lead_time_days: String(p.lead_time_days ?? 0),
    review_period_days: String(p.review_period_days ?? 0),
    average_daily_demand: String(p.average_daily_demand ?? 0),
    abc_class: p.abc_class ?? "",
    preferred_supplier_id: p.preferred_supplier_id ? String(p.preferred_supplier_id) : "",
    is_active: p.is_active !== false,
    notes: p.notes ?? "",
  };
}

function forecastFromRow(f: DemandForecast): ForecastForm {
  return {
    id: f.id,
    product_id: String(f.product_id),
    warehouse_id: f.warehouse_id ? String(f.warehouse_id) : "",
    period_start: String(f.period_start).slice(0, 10),
    period_end: String(f.period_end).slice(0, 10),
    forecast_quantity: String(f.forecast_quantity ?? ""),
    actual_quantity: f.actual_quantity != null && f.actual_quantity !== "" ? String(f.actual_quantity) : "",
    source: f.source,
    confidence_percent: f.confidence_percent != null && f.confidence_percent !== "" ? String(f.confidence_percent) : "",
    notes: f.notes ?? "",
  };
}

export default function DemandPlanningPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<"profiles" | "forecasts">("profiles");
  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [policyFilter, setPolicyFilter] = React.useState("all");
  const [warehouseFilter, setWarehouseFilter] = React.useState("all");
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");

  const [profileOpen, setProfileOpen] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState<ProfileForm>(DEFAULT_PROFILE);
  const [forecastOpen, setForecastOpen] = React.useState(false);
  const [forecastForm, setForecastForm] = React.useState<ForecastForm>(DEFAULT_FORECAST);
  const pickerOpenRef = React.useRef(false);
  const pickerCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePickerOpenChange = React.useCallback((open: boolean) => {
    if (pickerCloseTimerRef.current) {
      clearTimeout(pickerCloseTimerRef.current);
      pickerCloseTimerRef.current = null;
    }
    if (open) {
      pickerOpenRef.current = true;
      return;
    }
    pickerOpenRef.current = true;
    pickerCloseTimerRef.current = setTimeout(() => {
      pickerOpenRef.current = false;
      pickerCloseTimerRef.current = null;
    }, 150);
  }, []);

  const preventDialogDismissForPicker = React.useCallback(
    (event: { preventDefault: () => void; target: EventTarget | null }) => {
      const target = event.target;
      if (target instanceof Element) {
        if (
          target.closest("[data-radix-select-content]") ||
          target.closest("[data-radix-popper-content-wrapper]") ||
          target.closest("[role='listbox']")
        ) {
          event.preventDefault();
          return;
        }
      }
      if (pickerOpenRef.current) event.preventDefault();
    },
    [],
  );

  const profilesQuery = useQuery({
    queryKey: ["supply-chain", "profiles", tableQuery, policyFilter, warehouseFilter, activeFilter],
    queryFn: () =>
      supplyChainApi
        .listProfiles({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          policy: policyFilter === "all" ? undefined : policyFilter,
          warehouse_id: warehouseFilter === "all" ? undefined : Number(warehouseFilter),
          is_active: activeFilter === "all" ? undefined : activeFilter === "active",
        })
        .then((r) => r.data),
    enabled: tab === "profiles",
  });

  const forecastsQuery = useQuery({
    queryKey: ["supply-chain", "forecasts", tableQuery, warehouseFilter, sourceFilter],
    queryFn: () =>
      supplyChainApi
        .listForecasts({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          warehouse_id: warehouseFilter === "all" ? undefined : Number(warehouseFilter),
          source: sourceFilter === "all" ? undefined : sourceFilter,
        })
        .then((r) => r.data),
    enabled: tab === "forecasts",
  });

  const pickerEnabled = profileOpen || forecastOpen;

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "planning-picker"],
    queryFn: async () => {
      const res = await fetchInventoryProducts({ per_page: 200, limit: 200 });
      return unwrapList<ProductRecord>(res);
    },
    enabled: pickerEnabled,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "warehouses", "planning-picker"],
    queryFn: async () => {
      const res = await warehouseApi.listWarehouses({ limit: 200 }).then((r) => r.data);
      return unwrapList<Warehouse>(res);
    },
  });

  const suppliersQuery = useQuery({
    queryKey: ["inventory", "suppliers", "planning-picker"],
    queryFn: async () => {
      const res = await fetchInventorySuppliers({ per_page: 200, limit: 200 });
      return unwrapList<Supplier>(res);
    },
    enabled: profileOpen,
  });

  const warehouseNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const wh of warehousesQuery.data ?? []) {
      map.set(wh.id, wh.code ? `${wh.name} (${wh.code})` : wh.name);
    }
    return map;
  }, [warehousesQuery.data]);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const suggestedReorderPoint = React.useMemo(() => {
    const demand = Number(profileForm.average_daily_demand || 0);
    const lead = Number(profileForm.lead_time_days || 0);
    const safety = Number(profileForm.safety_stock || 0);
    return Math.round((demand * lead + safety) * 1000) / 1000;
  }, [profileForm.average_daily_demand, profileForm.lead_time_days, profileForm.safety_stock]);

  const reorderPointTooLow =
    Number(profileForm.reorder_point || 0) < suggestedReorderPoint &&
    (Number(profileForm.average_daily_demand) > 0 || Number(profileForm.safety_stock) > 0);

  const saveProfile = useMutation({
    mutationFn: () => {
      const payload = {
        product_id: Number(profileForm.product_id),
        warehouse_id: profileForm.warehouse_id ? Number(profileForm.warehouse_id) : null,
        policy: profileForm.policy,
        safety_stock: Number(profileForm.safety_stock || 0),
        reorder_point: Number(profileForm.reorder_point || 0),
        reorder_quantity: Number(profileForm.reorder_quantity || 0),
        maximum_level: profileForm.maximum_level ? Number(profileForm.maximum_level) : null,
        minimum_order_quantity: Number(profileForm.minimum_order_quantity || 0),
        order_multiple: profileForm.order_multiple ? Number(profileForm.order_multiple) : null,
        lead_time_days: Number(profileForm.lead_time_days || 0),
        review_period_days: Number(profileForm.review_period_days || 0),
        average_daily_demand: Number(profileForm.average_daily_demand || 0),
        abc_class: profileForm.abc_class || null,
        preferred_supplier_id: profileForm.preferred_supplier_id
          ? Number(profileForm.preferred_supplier_id)
          : null,
        is_active: profileForm.is_active,
        notes: profileForm.notes || null,
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
        warehouse_id: forecastForm.warehouse_id ? Number(forecastForm.warehouse_id) : null,
        period_start: forecastForm.period_start,
        period_end: forecastForm.period_end,
        forecast_quantity: Number(forecastForm.forecast_quantity || 0),
        actual_quantity: forecastForm.actual_quantity ? Number(forecastForm.actual_quantity) : null,
        source: forecastForm.source,
        confidence_percent: forecastForm.confidence_percent ? Number(forecastForm.confidence_percent) : null,
        notes: forecastForm.notes || null,
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

  const deleteForecast = useMutation({
    mutationFn: (id: number) => supplyChainApi.deleteForecast(id),
    onSuccess: () => {
      toast.success(t("supply_chain.planning.forecast_deleted", "Forecast deleted."));
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Could not delete it."),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const resetFiltersOnTab = React.useCallback((next: "profiles" | "forecasts") => {
    setTab(next);
    setTableQuery((prev) => ({ ...prev, page: 1, search: "" }));
    setPolicyFilter("all");
    setWarehouseFilter("all");
    setActiveFilter("all");
    setSourceFilter("all");
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
                ? warehouseNameById.get(row.original.warehouse_id) ??
                  `${t("supply_chain.common.warehouse", "Warehouse")} #${row.original.warehouse_id}`
                : t("supply_chain.replenishment.network_wide", "Network-wide")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "policy",
        header: t("supply_chain.planning.policy", "Policy"),
        cell: ({ row }) => (
          <div className="space-y-1">
            <Badge variant="outline" className="text-[11px] font-semibold">
              {row.original.policy.replace(/_/g, " ")}
            </Badge>
            {!row.original.is_active ? (
              <p className="text-[11px] text-muted-foreground">{t("supply_chain.planning.inactive", "Inactive")}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "levels",
        header: t("supply_chain.planning.levels", "Safety / Reorder / Max"),
        cell: ({ row }) => {
          const leadDemand = Number(row.original.lead_time_demand ?? 0);
          const safety = Number(row.original.safety_stock ?? 0);
          const suggested = leadDemand + safety;
          const rop = Number(row.original.reorder_point ?? 0);
          const low = rop < suggested && suggested > 0;
          return (
            <div className="space-y-0.5">
              <span className="text-xs tabular-nums">
                {Number(row.original.safety_stock).toLocaleString()} /{" "}
                {rop.toLocaleString()} /{" "}
                {row.original.maximum_level ? Number(row.original.maximum_level).toLocaleString() : "—"}
              </span>
              {low ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {t("supply_chain.planning.rop_low_short", "ROP below lead+safety ({n})").replace(
                    "{n}",
                    suggested.toLocaleString(),
                  )}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "lead_time_days",
        header: t("supply_chain.planning.lead_time", "Lead time"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm tabular-nums">
              {row.original.lead_time_days} {t("supply_chain.common.days", "days")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("supply_chain.planning.lead_demand", "Needs")} {Number(row.original.lead_time_demand).toLocaleString()}
              {row.original.policy === "periodic_review" && Number(row.original.review_period_days) > 0
                ? ` · ${t("supply_chain.planning.review_short", "Review")} ${row.original.review_period_days}d`
                : ""}
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
                setProfileForm(profileFromRow(row.original));
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
    [deleteProfile, t, warehouseNameById],
  );

  const forecastColumns = React.useMemo<ColumnDef<DemandForecast>[]>(
    () => [
      {
        id: "product",
        header: t("supply_chain.common.product", "Product"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.product?.name ?? `#${row.original.product_id}`}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.warehouse_id
                ? warehouseNameById.get(row.original.warehouse_id) ??
                  `${t("supply_chain.common.warehouse", "Warehouse")} #${row.original.warehouse_id}`
                : t("supply_chain.replenishment.network_wide", "Network-wide")}
            </p>
          </div>
        ),
      },
      {
        id: "period",
        header: t("supply_chain.planning.period", "Period"),
        cell: ({ row }) => (
          <span className="text-xs">
            {String(row.original.period_start).slice(0, 10)} → {String(row.original.period_end).slice(0, 10)}
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
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <span className="text-xs">{row.original.source.replace(/_/g, " ")}</span>
            {row.original.confidence_percent != null ? (
              <p className="text-[11px] text-muted-foreground">
                {Number(row.original.confidence_percent).toLocaleString()}%{" "}
                {t("supply_chain.planning.confidence_short", "confidence")}
              </p>
            ) : null}
          </div>
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
                setForecastForm(forecastFromRow(row.original));
                setForecastOpen(true);
              }}
            >
              {t("supply_chain.common.edit", "Edit")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-destructive"
              onClick={() => deleteForecast.mutate(row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [deleteForecast, t, warehouseNameById],
  );

  const showMaximum = profileForm.policy === "min_max" || profileForm.policy === "periodic_review";
  const showReviewPeriod = profileForm.policy === "periodic_review";
  const showReorderQty = profileForm.policy === "reorder_point" || profileForm.policy === "none";

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
            onClick={() => resetFiltersOnTab(value)}
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("supply_chain.common.warehouse", "Warehouse")}</Label>
          <Select
            value={warehouseFilter}
            onValueChange={(v) => {
              setWarehouseFilter(v);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="h-9 w-[14rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
              {(warehousesQuery.data ?? []).map((wh) => (
                <SelectItem key={wh.id} value={String(wh.id)}>
                  {wh.name}
                  {wh.code ? ` (${wh.code})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tab === "profiles" ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.planning.policy", "Policy")}</Label>
              <Select
                value={policyFilter}
                onValueChange={(v) => {
                  setPolicyFilter(v);
                  setTableQuery((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger className="h-9 w-[12rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  {POLICIES.map((policy) => (
                    <SelectItem key={policy} value={policy}>
                      {policy.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("supply_chain.planning.active_filter", "Active")}</Label>
              <Select
                value={activeFilter}
                onValueChange={(v) => {
                  setActiveFilter(v);
                  setTableQuery((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger className="h-9 w-[10rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                  <SelectItem value="active">{t("supply_chain.planning.active_only", "Active only")}</SelectItem>
                  <SelectItem value="inactive">{t("supply_chain.planning.inactive_only", "Inactive only")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">{t("supply_chain.planning.source", "Source")}</Label>
            <Select
              value={sourceFilter}
              onValueChange={(v) => {
                setSourceFilter(v);
                setTableQuery((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="h-9 w-[12rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {tab === "profiles" ? (
        profilesQuery.isPending ? (
          <SupplyChainPlanningSkeleton />
        ) : (
          <DataTable
            columns={profileColumns}
            data={(profilesQuery.data?.data ?? []) as PlanningProfile[]}
            totalEntries={profilesQuery.data?.meta?.total ?? 0}
            loading={profilesQuery.isFetching && !profilesQuery.isPending}
            pageIndex={tableQuery.page}
            pageSize={tableQuery.pageSize}
            onQueryChange={handleTableQueryChange}
            searchPlaceholder={t("supply_chain.planning.search_profiles", "Search by product, SKU, policy…")}
            resourceName="profiles"
          />
        )
      ) : forecastsQuery.isPending ? (
        <SupplyChainPlanningSkeleton />
      ) : (
        <DataTable
          columns={forecastColumns}
          data={(forecastsQuery.data?.data ?? []) as DemandForecast[]}
          totalEntries={forecastsQuery.data?.meta?.total ?? 0}
          loading={forecastsQuery.isFetching && !forecastsQuery.isPending}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("supply_chain.planning.search_forecasts", "Search by product, SKU, source…")}
          resourceName="forecasts"
        />
      )}

      <Dialog
        open={profileOpen}
        onOpenChange={(open) => {
          if (!open && pickerOpenRef.current) return;
          setProfileOpen(open);
        }}
      >
        <DialogContent
          className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={preventDialogDismissForPicker}
          onInteractOutside={preventDialogDismissForPicker}
          onFocusOutside={preventDialogDismissForPicker}
        >
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="pp-product">{t("supply_chain.common.product", "Product")}</Label>
              <Select
                value={profileForm.product_id || undefined}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setProfileForm((p) => ({ ...p, product_id: v }))}
              >
                <SelectTrigger id="pp-product">
                  <SelectValue
                    placeholder={
                      productsQuery.isLoading
                        ? t("supply_chain.common.loading", "Loading…")
                        : t("supply_chain.planning.pick_product", "Select a product")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(productsQuery.data ?? []).map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                      {product.sku ? ` (${product.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp-warehouse">{t("supply_chain.common.warehouse", "Warehouse")}</Label>
              <Select
                value={profileForm.warehouse_id || "network"}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setProfileForm((p) => ({ ...p, warehouse_id: v === "network" ? "" : v }))}
              >
                <SelectTrigger id="pp-warehouse">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">
                    {t("supply_chain.planning.network_wide", "Network-wide (all warehouses)")}
                  </SelectItem>
                  {(warehousesQuery.data ?? []).map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>
                      {wh.name}
                      {wh.code ? ` (${wh.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("supply_chain.planning.policy", "Policy")}</Label>
              <Select
                value={profileForm.policy}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setProfileForm((p) => ({ ...p, policy: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICIES.map((policy) => (
                    <SelectItem key={policy} value={policy}>
                      {policy.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {profileForm.policy === "min_max"
                  ? t("supply_chain.planning.hint_min_max", "Uses maximum level to size the top-up.")
                  : profileForm.policy === "periodic_review"
                    ? t("supply_chain.planning.hint_periodic", "Review period drives how often the position is checked.")
                    : profileForm.policy === "make_to_order"
                      ? t("supply_chain.planning.hint_mto", "Low stock is intentional — replenishment will skip this profile.")
                      : profileForm.policy === "none"
                        ? t("supply_chain.planning.hint_none", "Excluded from replenishment runs.")
                        : t("supply_chain.planning.hint_rop", "Orders when projected position falls to the reorder point.")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("supply_chain.planning.active", "Status")}</Label>
              <Select
                value={profileForm.is_active ? "active" : "inactive"}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setProfileForm((p) => ({ ...p, is_active: v === "active" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("supply_chain.planning.active_only", "Active")}</SelectItem>
                  <SelectItem value="inactive">{t("supply_chain.planning.inactive", "Inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-1">
              <Label>{t("supply_chain.planning.preferred_supplier", "Preferred supplier")}</Label>
              <Select
                value={profileForm.preferred_supplier_id || "none"}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) =>
                  setProfileForm((p) => ({ ...p, preferred_supplier_id: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      suppliersQuery.isLoading
                        ? t("supply_chain.common.loading", "Loading…")
                        : t("supply_chain.common.none", "None")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                  {(suppliersQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Field label={t("supply_chain.planning.safety_stock", "Safety stock")} id="pp-safety">
              <Input
                id="pp-safety"
                type="number"
                value={profileForm.safety_stock}
                onChange={(e) => setProfileForm((p) => ({ ...p, safety_stock: e.target.value }))}
              />
            </Field>
            <Field label={t("supply_chain.planning.reorder_point", "Reorder point")} id="pp-rop">
              <Input
                id="pp-rop"
                type="number"
                value={profileForm.reorder_point}
                onChange={(e) => setProfileForm((p) => ({ ...p, reorder_point: e.target.value }))}
              />
            </Field>
            {showReorderQty ? (
              <Field label={t("supply_chain.planning.reorder_quantity", "Reorder quantity")} id="pp-roq">
                <Input
                  id="pp-roq"
                  type="number"
                  value={profileForm.reorder_quantity}
                  onChange={(e) => setProfileForm((p) => ({ ...p, reorder_quantity: e.target.value }))}
                />
              </Field>
            ) : (
              <Field
                label={t("supply_chain.planning.reorder_quantity", "Reorder quantity")}
                id="pp-roq"
                hint={t("supply_chain.planning.roq_optional", "Optional fallback if maximum is blank")}
              >
                <Input
                  id="pp-roq"
                  type="number"
                  value={profileForm.reorder_quantity}
                  onChange={(e) => setProfileForm((p) => ({ ...p, reorder_quantity: e.target.value }))}
                />
              </Field>
            )}

            {showMaximum ? (
              <Field
                label={t("supply_chain.planning.maximum_level", "Maximum level")}
                id="pp-max"
                hint={t("supply_chain.planning.max_hint", "Used by min/max")}
              >
                <Input
                  id="pp-max"
                  type="number"
                  value={profileForm.maximum_level}
                  onChange={(e) => setProfileForm((p) => ({ ...p, maximum_level: e.target.value }))}
                />
              </Field>
            ) : (
              <Field
                label={t("supply_chain.planning.maximum_level", "Maximum level")}
                id="pp-max"
                hint={t("supply_chain.planning.max_optional", "Optional; used if set")}
              >
                <Input
                  id="pp-max"
                  type="number"
                  value={profileForm.maximum_level}
                  onChange={(e) => setProfileForm((p) => ({ ...p, maximum_level: e.target.value }))}
                />
              </Field>
            )}

            <Field label={t("supply_chain.planning.moq", "Supplier MOQ")} id="pp-moq">
              <Input
                id="pp-moq"
                type="number"
                value={profileForm.minimum_order_quantity}
                onChange={(e) => setProfileForm((p) => ({ ...p, minimum_order_quantity: e.target.value }))}
              />
            </Field>
            <Field
              label={t("supply_chain.planning.multiple", "Order multiple")}
              id="pp-multiple"
              hint={t("supply_chain.planning.multiple_hint", "Pallet or container size")}
            >
              <Input
                id="pp-multiple"
                type="number"
                value={profileForm.order_multiple}
                onChange={(e) => setProfileForm((p) => ({ ...p, order_multiple: e.target.value }))}
              />
            </Field>

            <Field label={t("supply_chain.planning.lead_time_days", "Lead time (days)")} id="pp-lead">
              <Input
                id="pp-lead"
                type="number"
                value={profileForm.lead_time_days}
                onChange={(e) => setProfileForm((p) => ({ ...p, lead_time_days: e.target.value }))}
              />
            </Field>
            <Field label={t("supply_chain.planning.daily_demand", "Average daily demand")} id="pp-demand">
              <Input
                id="pp-demand"
                type="number"
                value={profileForm.average_daily_demand}
                onChange={(e) => setProfileForm((p) => ({ ...p, average_daily_demand: e.target.value }))}
              />
            </Field>
            {showReviewPeriod ? (
              <Field
                label={t("supply_chain.planning.review_period", "Review period (days)")}
                id="pp-review"
                hint={t("supply_chain.planning.review_hint", "How often this position is reviewed")}
              >
                <Input
                  id="pp-review"
                  type="number"
                  value={profileForm.review_period_days}
                  onChange={(e) => setProfileForm((p) => ({ ...p, review_period_days: e.target.value }))}
                />
              </Field>
            ) : (
              <Field label={t("supply_chain.planning.review_period", "Review period (days)")} id="pp-review">
                <Input
                  id="pp-review"
                  type="number"
                  value={profileForm.review_period_days}
                  onChange={(e) => setProfileForm((p) => ({ ...p, review_period_days: e.target.value }))}
                />
              </Field>
            )}

            <div className="space-y-2">
              <Label>{t("supply_chain.planning.abc", "ABC class")}</Label>
              <Select
                value={profileForm.abc_class || "none"}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setProfileForm((p) => ({ ...p, abc_class: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("supply_chain.common.none", "None")}</SelectItem>
                  {["A", "B", "C"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reorderPointTooLow ? (
              <div className="md:col-span-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
                {t(
                  "supply_chain.planning.rop_warning",
                  "Reorder point ({rop}) is below lead-time demand + safety stock ({suggested}). That guarantees a stockout if the supplier hits lead time exactly.",
                )
                  .replace("{rop}", Number(profileForm.reorder_point || 0).toLocaleString())
                  .replace("{suggested}", suggestedReorderPoint.toLocaleString())}{" "}
                <button
                  type="button"
                  className="font-semibold underline underline-offset-2"
                  onClick={() =>
                    setProfileForm((p) => ({ ...p, reorder_point: String(suggestedReorderPoint) }))
                  }
                >
                  {t("supply_chain.planning.use_suggested_rop", "Use suggested {n}").replace(
                    "{n}",
                    suggestedReorderPoint.toLocaleString(),
                  )}
                </button>
              </div>
            ) : (
              <p className="md:col-span-3 text-[11px] text-muted-foreground">
                {t("supply_chain.planning.suggested_rop", "Suggested reorder point (lead demand + safety)")}:{" "}
                <span className="font-semibold text-foreground">{suggestedReorderPoint.toLocaleString()}</span>
              </p>
            )}

            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="pp-notes">{t("supply_chain.common.notes", "Notes")}</Label>
              <Textarea
                id="pp-notes"
                rows={2}
                value={profileForm.notes}
                onChange={(e) => setProfileForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={t("supply_chain.planning.notes_placeholder", "Optional planner notes…")}
              />
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
                if (profileForm.policy === "min_max" && !profileForm.maximum_level) {
                  toast.error(t("supply_chain.planning.max_required", "Maximum level is required for min/max."));
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

      <Dialog
        open={forecastOpen}
        onOpenChange={(open) => {
          if (!open && pickerOpenRef.current) return;
          setForecastOpen(open);
        }}
      >
        <DialogContent
          className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={preventDialogDismissForPicker}
          onInteractOutside={preventDialogDismissForPicker}
          onFocusOutside={preventDialogDismissForPicker}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {forecastForm.id
                  ? t("supply_chain.planning.edit_forecast", "Edit Demand Forecast")
                  : t("supply_chain.planning.new_forecast", "Demand Forecast")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.planning.forecast_desc",
                  "Re-forecasting the same period replaces the number rather than stacking a second row the netting would double count.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fc-product">{t("supply_chain.common.product", "Product")}</Label>
              <Select
                value={forecastForm.product_id || undefined}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setForecastForm((f) => ({ ...f, product_id: v }))}
              >
                <SelectTrigger id="fc-product">
                  <SelectValue
                    placeholder={
                      productsQuery.isLoading
                        ? t("supply_chain.common.loading", "Loading…")
                        : t("supply_chain.planning.pick_product", "Select a product")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(productsQuery.data ?? []).map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                      {product.sku ? ` (${product.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fc-warehouse">{t("supply_chain.common.warehouse", "Warehouse")}</Label>
              <Select
                value={forecastForm.warehouse_id || "network"}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setForecastForm((f) => ({ ...f, warehouse_id: v === "network" ? "" : v }))}
              >
                <SelectTrigger id="fc-warehouse">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">
                    {t("supply_chain.planning.network_wide", "Network-wide (all warehouses)")}
                  </SelectItem>
                  {(warehousesQuery.data ?? []).map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>
                      {wh.name}
                      {wh.code ? ` (${wh.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label={t("supply_chain.planning.period_start", "Period start")} id="fc-start">
              <Input
                id="fc-start"
                type="date"
                value={forecastForm.period_start}
                onChange={(e) => setForecastForm((f) => ({ ...f, period_start: e.target.value }))}
              />
            </Field>
            <Field label={t("supply_chain.planning.period_end", "Period end")} id="fc-end">
              <Input
                id="fc-end"
                type="date"
                value={forecastForm.period_end}
                onChange={(e) => setForecastForm((f) => ({ ...f, period_end: e.target.value }))}
              />
            </Field>
            <Field label={t("supply_chain.planning.forecast_quantity", "Forecast quantity")} id="fc-qty">
              <Input
                id="fc-qty"
                type="number"
                value={forecastForm.forecast_quantity}
                onChange={(e) => setForecastForm((f) => ({ ...f, forecast_quantity: e.target.value }))}
              />
            </Field>
            <Field label={t("supply_chain.planning.actual", "Actual (after the fact)")} id="fc-actual">
              <Input
                id="fc-actual"
                type="number"
                value={forecastForm.actual_quantity}
                onChange={(e) => setForecastForm((f) => ({ ...f, actual_quantity: e.target.value }))}
              />
            </Field>
            <div className="space-y-2">
              <Label>{t("supply_chain.planning.source", "Source")}</Label>
              <Select
                value={forecastForm.source}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setForecastForm((f) => ({ ...f, source: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label={t("supply_chain.planning.confidence", "Confidence %")}
              id="fc-confidence"
              hint={t("supply_chain.planning.confidence_hint", "Optional 0–100")}
            >
              <Input
                id="fc-confidence"
                type="number"
                min={0}
                max={100}
                value={forecastForm.confidence_percent}
                onChange={(e) => setForecastForm((f) => ({ ...f, confidence_percent: e.target.value }))}
              />
            </Field>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="fc-notes">{t("supply_chain.common.notes", "Notes")}</Label>
              <Textarea
                id="fc-notes"
                rows={2}
                value={forecastForm.notes}
                onChange={(e) => setForecastForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("supply_chain.planning.notes_placeholder", "Optional planner notes…")}
              />
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
