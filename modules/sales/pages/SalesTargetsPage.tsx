"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { PanelTableSkeleton } from "@/components/ui/loading-states";
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
import { hrFetch, type Employee as HrEmployee, type Paginated as HrPaginated } from "@/modules/humanresources/api";
import { salesApi } from "@/modules/sales/api";
import type {
  SalesCommission,
  SalesCommissionRule,
  SalesOverview,
  SalesPriceList,
  SalesTarget,
} from "@/modules/sales/types";
import { SalesConfirmDialog, useSalesConfirmDialog } from "@/modules/sales/components/sales-confirm-dialog";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { RankedBarChart } from "@/modules/shared/charts/charts";

const SCOPES = ["employee", "team", "company"] as const;
const COMMISSION_STATUSES = ["accrued", "approved", "paid", "cancelled"] as const;

type TargetForm = {
  period: string;
  owner_employee_id: string;
  scope: string;
  target_amount: string;
  target_quantity: string;
  currency: string;
  notes: string;
};

type RuleForm = {
  id?: number;
  name: string;
  basis: "revenue" | "margin";
  rate_percent: string;
  minimum_amount: string;
  price_list_id: string;
  segment: string;
  is_active: boolean;
};

const currentPeriod = () => new Date().toISOString().slice(0, 7);

const DEFAULT_TARGET_FORM: TargetForm = {
  period: currentPeriod(),
  owner_employee_id: "",
  scope: "employee",
  target_amount: "",
  target_quantity: "0",
  currency: "ETB",
  notes: "",
};

const DEFAULT_RULE_FORM: RuleForm = {
  name: "",
  basis: "revenue",
  rate_percent: "",
  minimum_amount: "0",
  price_list_id: "",
  segment: "",
  is_active: true,
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown, currency = "ETB") =>
  `${currency} ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function periodRange(period: string) {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${period}-01`,
    to: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

function employeeLabel(employees: Map<number, HrEmployee>, id: number | null | undefined) {
  if (id == null) return null;
  const employee = employees.get(id);
  if (employee) return `${employee.primary_name} (${employee.employee_number})`;
  return `#${id}`;
}

export default function SalesTargetsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { requestConfirm, closeConfirm, confirmDialogProps } = useSalesConfirmDialog();

  const [periodFilter, setPeriodFilter] = React.useState(currentPeriod());
  const [targetScopeFilter, setTargetScopeFilter] = React.useState("all");
  const [targetOwnerFilter, setTargetOwnerFilter] = React.useState("all");
  const [commissionStatusFilter, setCommissionStatusFilter] = React.useState("all");
  const [commissionEmployeeFilter, setCommissionEmployeeFilter] = React.useState("all");
  const [commissionPage, setCommissionPage] = React.useState(1);
  const [commissionPageSize] = React.useState(25);

  const [targetForm, setTargetForm] = React.useState<TargetForm>(DEFAULT_TARGET_FORM);
  const [editingTargetKey, setEditingTargetKey] = React.useState<string | null>(null);
  const [targetDialogOpen, setTargetDialogOpen] = React.useState(false);

  const [ruleForm, setRuleForm] = React.useState<RuleForm>(DEFAULT_RULE_FORM);
  const [ruleDialogOpen, setRuleDialogOpen] = React.useState(false);

  const [deletingRuleId, setDeletingRuleId] = React.useState<number | null>(null);
  const [decidingId, setDecidingId] = React.useState<number | null>(null);

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
      setOpenPickerCount((c) => c + 1);
      return;
    }
    pickerOpenRef.current = true;
    setOpenPickerCount((c) => Math.max(0, c - 1));
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

  const range = React.useMemo(() => periodRange(periodFilter), [periodFilter]);

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", "sales-targets-picker"],
    queryFn: () => hrFetch<HrPaginated<HrEmployee>>("/employees?per_page=200"),
  });

  const priceListsQuery = useQuery({
    queryKey: ["sales", "price-list-options", "targets-rules"],
    queryFn: () => salesApi.listPriceLists({ limit: 100 }).then((res) => res.data),
  });

  const targetsQuery = useQuery({
    queryKey: ["sales", "targets", periodFilter, targetScopeFilter, targetOwnerFilter],
    queryFn: () =>
      salesApi
        .listTargets({
          limit: 100,
          period: periodFilter,
          scope: targetScopeFilter === "all" ? undefined : targetScopeFilter,
          company_only: targetOwnerFilter === "company" ? 1 : undefined,
          owner_employee_id:
            targetOwnerFilter !== "all" && targetOwnerFilter !== "company"
              ? Number(targetOwnerFilter)
              : undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const rulesQuery = useQuery({
    queryKey: ["sales", "commission-rules"],
    queryFn: () => salesApi.listCommissionRules({ limit: 100 }).then((res) => res.data),
  });

  const commissionsQuery = useQuery({
    queryKey: [
      "sales",
      "commissions",
      periodFilter,
      commissionStatusFilter,
      commissionEmployeeFilter,
      commissionPage,
    ],
    queryFn: () =>
      salesApi
        .listCommissions({
          page: commissionPage,
          limit: commissionPageSize,
          period: periodFilter,
          status: commissionStatusFilter === "all" ? undefined : commissionStatusFilter,
          employee_id:
            commissionEmployeeFilter === "all" ? undefined : Number(commissionEmployeeFilter),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const summaryQuery = useQuery({
    queryKey: ["sales", "commission-summary", periodFilter],
    queryFn: () => salesApi.commissionSummary({ period: periodFilter }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const overviewQuery = useQuery({
    queryKey: ["sales", "overview", "targets-attainment", range.from, range.to],
    queryFn: () => salesApi.overview({ from: range.from, to: range.to }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const employeeById = React.useMemo(() => {
    const map = new Map<number, HrEmployee>();
    for (const e of employeesQuery.data?.data ?? []) {
      map.set(e.id, e);
    }
    return map;
  }, [employeesQuery.data]);

  const priceLists = (priceListsQuery.data?.data ?? []) as SalesPriceList[];

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const resetTargetForm = React.useCallback(() => {
    setTargetForm({ ...DEFAULT_TARGET_FORM, period: periodFilter });
    setEditingTargetKey(null);
    setTargetDialogOpen(false);
  }, [periodFilter]);

  const saveTarget = useMutation({
    mutationFn: () =>
      salesApi.createTarget({
        period: targetForm.period,
        owner_employee_id: targetForm.owner_employee_id ? Number(targetForm.owner_employee_id) : null,
        scope: targetForm.scope,
        target_amount: Number(targetForm.target_amount || 0),
        target_quantity: Number(targetForm.target_quantity || 0),
        currency: targetForm.currency || "ETB",
        notes: targetForm.notes || null,
      }),
    onSuccess: () => {
      toast.success(
        editingTargetKey
          ? t("sales.targets.updated", "Target updated.")
          : t("sales.targets.saved", "Target saved."),
      );
      invalidate();
      resetTargetForm();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.targets.save_failed", "Could not save the target."))),
  });

  const deleteTarget = useMutation({
    mutationFn: (id: number) => salesApi.deleteTarget(id),
    onSuccess: () => {
      toast.success(t("sales.targets.deleted", "Target removed."));
      invalidate();
      closeConfirm();
    },
    onError: (error: any) => toast.error(errorText(error, t("sales.targets.delete_failed", "Could not remove it."))),
  });

  const saveRule = useMutation({
    mutationFn: () => {
      const payload = {
        name: ruleForm.name,
        basis: ruleForm.basis,
        rate_percent: Number(ruleForm.rate_percent || 0),
        minimum_amount: Number(ruleForm.minimum_amount || 0),
        price_list_id: ruleForm.price_list_id ? Number(ruleForm.price_list_id) : null,
        segment: ruleForm.segment || null,
        is_active: ruleForm.is_active,
      };
      return ruleForm.id
        ? salesApi.updateCommissionRule(ruleForm.id, payload)
        : salesApi.createCommissionRule(payload);
    },
    onSuccess: () => {
      toast.success(
        ruleForm.id
          ? t("sales.targets.rule_updated", "Commission rule updated.")
          : t("sales.targets.rule_saved", "Commission rule saved."),
      );
      invalidate();
      setRuleForm(DEFAULT_RULE_FORM);
      setRuleDialogOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.targets.rule_failed", "Could not save the rule."))),
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) => {
      setDeletingRuleId(id);
      return salesApi.deleteCommissionRule(id);
    },
    onSuccess: () => {
      toast.success(t("sales.targets.rule_deleted", "Rule removed."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, t("sales.targets.rule_delete_failed", "Could not remove it."))),
    onSettled: () => setDeletingRuleId(null),
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => {
      setDecidingId(id);
      return salesApi.decideCommission(id, status);
    },
    onSuccess: () => {
      toast.success(t("sales.targets.commission_updated", "Commission updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.targets.decide_failed", "Could not update it."))),
    onSettled: () => setDecidingId(null),
  });

  const startEditTarget = React.useCallback((target: SalesTarget) => {
    setEditingTargetKey(`${target.period}-${target.owner_employee_id ?? "co"}-${target.scope}`);
    setTargetForm({
      period: target.period,
      owner_employee_id: target.owner_employee_id ? String(target.owner_employee_id) : "",
      scope: target.scope,
      target_amount: String(target.target_amount),
      target_quantity: String(target.target_quantity ?? 0),
      currency: target.currency || "ETB",
      notes: target.notes ?? "",
    });
    setTargetDialogOpen(true);
  }, []);

  const openNewTarget = React.useCallback(() => {
    setEditingTargetKey(null);
    setTargetForm({ ...DEFAULT_TARGET_FORM, period: periodFilter });
    setTargetDialogOpen(true);
  }, [periodFilter]);

  const openNewRule = React.useCallback(() => {
    setRuleForm(DEFAULT_RULE_FORM);
    setRuleDialogOpen(true);
  }, []);

  const openEditRule = React.useCallback((rule: SalesCommissionRule) => {
    setRuleForm({
      id: rule.id,
      name: rule.name,
      basis: rule.basis,
      rate_percent: String(rule.rate_percent),
      minimum_amount: String(rule.minimum_amount ?? 0),
      price_list_id: rule.price_list_id ? String(rule.price_list_id) : "",
      segment: rule.segment ?? "",
      is_active: rule.is_active,
    });
    setRuleDialogOpen(true);
  }, []);

  const targets = (targetsQuery.data?.data ?? []) as SalesTarget[];
  const rules = (rulesQuery.data?.data ?? []) as SalesCommissionRule[];
  const commissions = (commissionsQuery.data?.data ?? []) as SalesCommission[];
  const summary = summaryQuery.data?.data;
  const overview: SalesOverview | undefined = overviewQuery.data?.data;
  const attainment = overview?.targets;
  const commissionsTotal = commissionsQuery.data?.meta?.total ?? 0;
  const commissionsLastPage = commissionsQuery.data?.meta?.last_page ?? 1;

  const summaryRefetching = summaryQuery.isFetching && !summaryQuery.isPending;
  const overviewRefetching = overviewQuery.isFetching && !overviewQuery.isPending;
  const targetsLoading =
    targetsQuery.isPending ||
    (targetsQuery.isFetching && !targetsQuery.isPending && !deleteTarget.isPending);
  const commissionsLoading = commissionsQuery.isPending || commissionsQuery.isFetching;

  const attainmentByOwner = React.useMemo(() => {
    const map = new Map<string, { target: number; actual: number; attainment_percent: number }>();
    for (const row of attainment?.by_owner ?? []) {
      const key = row.owner_employee_id == null ? "company" : String(row.owner_employee_id);
      map.set(key, {
        target: n(row.target),
        actual: n(row.actual),
        attainment_percent: n(row.attainment_percent),
      });
    }
    return map;
  }, [attainment?.by_owner]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("sales.targets.title", "Targets and Commission")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "sales.targets.subtitle",
              "What each seller is asked to bring in, and what they earn on it. Commission accrues when an order is confirmed, not when it is drafted.",
            )}
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("sales.targets.period", "Period")}</Label>
          <Input
            type="month"
            value={periodFilter}
            onChange={(e) => {
              setPeriodFilter(e.target.value);
              setCommissionPage(1);
            }}
            className="h-9 w-40"
          />
        </div>
      </div>

      {summaryQuery.isPending ? (
        <LoadingPanel label={t("sales.common.loading", "Loading...")} />
      ) : summaryQuery.isError ? (
        <EmptyPanel label={t("sales.targets.summary_failed", "Could not load commission summary.")} />
      ) : summary ? (
        <div
          className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${summaryRefetching ? "opacity-50 transition-opacity" : "transition-opacity"}`}
        >
          <StatTile
            label={t("sales.targets.accrued", "Accrued")}
            value={money(summary.accrued)}
            meta={periodFilter}
          />
          <StatTile label={t("sales.targets.approved", "Approved")} value={money(summary.approved)} />
          <StatTile label={t("sales.targets.paid", "Paid")} value={money(summary.paid)} />
          <StatTile
            label={t("sales.targets.earners", "Earning")}
            value={n(summary.earners).toLocaleString()}
            meta={t("sales.targets.earners_meta", "people with commission")}
          />
        </div>
      ) : null}

      {overviewQuery.isPending ? (
        <LoadingPanel label={t("sales.targets.loading_attainment", "Loading attainment...")} />
      ) : attainment && n(attainment.target_amount) > 0 ? (
        <div className={overviewRefetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
        <Panel
          title={t("sales.overview.target_attainment", "Target attainment")}
          description={t(
            "sales.targets.attainment_desc",
            "Booked revenue in {period} against targets set for that period.",
          ).replace("{period}", periodFilter)}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatTile
              label={t("sales.targets.target", "Target")}
              value={money(attainment.target_amount)}
            />
            <StatTile
              label={t("sales.targets.actual", "Actual")}
              value={money(attainment.actual_amount)}
            />
            <StatTile
              label={t("sales.overview.attainment", "Attainment")}
              value={`${n(attainment.attainment_percent).toFixed(0)}%`}
            />
          </div>
          {(attainment.by_owner ?? []).length > 0 ? (
            <div className="space-y-2">
              {attainment.by_owner.map((row) => {
                const label =
                  employeeLabel(employeeById, row.owner_employee_id) ??
                  t("sales.overview.company_wide", "Company-wide");
                return (
                  <div
                    key={String(row.owner_employee_id ?? "company")}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <span>{label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {money(row.actual)} / {money(row.target)} ·{" "}
                      <span className="font-semibold text-foreground">
                        {n(row.attainment_percent).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </Panel>
        </div>
      ) : null}

      {summary && (summary.by_employee ?? []).length > 0 ? (
        <RankedBarChart
          title={t("sales.targets.by_employee", "Commission by seller")}
          description={t(
            "sales.targets.by_employee_desc",
            "Total earned across every order in the period.",
          )}
          rows={summary.by_employee.map((row: { employee_id: number; amount: unknown; orders: unknown }) => ({
            key: String(row.employee_id),
            label: employeeLabel(employeeById, row.employee_id) ?? `#${row.employee_id}`,
            value: n(row.amount),
            meta: t("sales.overview.orders_count", "{n} orders").replace("{n}", String(n(row.orders))),
          }))}
          valueLabel={t("sales.targets.commission", "Commission")}
          emptyLabel={t("sales.targets.no_commission", "No commission earned yet.")}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t("sales.targets.targets", "Targets")}
          description={t(
            "sales.targets.targets_desc",
            "Setting a target for a period that already has one revises it rather than adding a second.",
          )}
          action={
            <Button size="sm" variant="outline" onClick={openNewTarget}>
              <Plus className="mr-2 h-4 w-4" />
              {t("sales.targets.add_target", "Add target")}
            </Button>
          }
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <Select value={targetScopeFilter} onValueChange={setTargetScopeFilter}>
              <SelectTrigger className="h-9 w-[10rem]">
                <SelectValue placeholder={t("sales.targets.scope", "Scope")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("sales.common.all", "All scopes")}</SelectItem>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={targetOwnerFilter} onValueChange={setTargetOwnerFilter}>
              <SelectTrigger className="h-9 w-[12rem]">
                <SelectValue placeholder={t("sales.targets.owner", "Owner")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("sales.common.all", "All owners")}</SelectItem>
                <SelectItem value="company">{t("sales.overview.company_wide", "Company-wide")}</SelectItem>
                {(employeesQuery.data?.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {employeeLabel(employeeById, e.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetsLoading ? (
            <div className="space-y-1.5" role="status" aria-label={t("sales.common.loading", "Loading...")}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                >
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-40 animate-pulse rounded bg-muted/60" />
                  </div>
                  <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : targetsQuery.isError ? (
            <EmptyPanel label={t("sales.targets.load_failed", "Could not load targets.")} />
          ) : targets.length === 0 ? (
            <EmptyPanel label={t("sales.targets.none", "No targets set.")} />
          ) : (
            <div className="space-y-1.5">
              {targets.map((target) => {
                const ownerKey = target.owner_employee_id == null ? "company" : String(target.owner_employee_id);
                const rowAttainment = attainmentByOwner.get(ownerKey);
                return (
                  <div
                    key={target.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-mono text-xs">{target.period}</span>
                      <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                        {target.scope}
                      </Badge>
                      <span className="ml-2 block text-muted-foreground">
                        {target.owner_employee_id
                          ? employeeLabel(employeeById, target.owner_employee_id)
                          : t("sales.overview.company_wide", "Company-wide")}
                      </span>
                      {rowAttainment ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {money(rowAttainment.actual, target.currency)} /{" "}
                          {money(rowAttainment.target, target.currency)} ·{" "}
                          {rowAttainment.attainment_percent.toFixed(0)}%
                        </span>
                      ) : null}
                      {n(target.target_quantity) > 0 ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {t("sales.targets.qty_target", "Qty")}: {n(target.target_quantity)}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="font-semibold tabular-nums">
                        {money(target.target_amount, target.currency)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditTarget(target)}
                        aria-label={t("sales.common.edit", "Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          requestConfirm({
                            title: t("sales.targets.delete_title", "Delete Target"),
                            description: t("sales.targets.delete_confirm", "Remove this target?"),
                            confirmLabel: t("sales.common.delete", "Delete"),
                            onConfirm: () => deleteTarget.mutate(target.id),
                          });
                        }}
                        aria-label={t("sales.common.delete", "Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title={t("sales.targets.rules", "Commission rules")}
          description={t(
            "sales.targets.rules_desc",
            "The most specific matching rule wins: a segment rule beats a price-list rule, which beats a catch-all.",
          )}
          action={
            <Button size="sm" variant="outline" onClick={openNewRule}>
              <Plus className="mr-2 h-4 w-4" />
              {t("sales.targets.add_rule", "Add rule")}
            </Button>
          }
        >
          {rulesQuery.isPending ? (
            <LoadingPanel label={t("sales.common.loading", "Loading...")} />
          ) : rulesQuery.isError ? (
            <EmptyPanel label={t("sales.targets.rules_failed", "Could not load rules.")} />
          ) : rules.length === 0 ? (
            <EmptyPanel label={t("sales.targets.no_rules", "No commission rules yet.")} />
          ) : (
            <div className="space-y-1.5">
              {rules.map((rule) => {
                const isDeleting = deletingRuleId === rule.id;
                const list = priceLists.find((l) => l.id === rule.price_list_id);
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{rule.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {n(rule.rate_percent)}% {t("sales.targets.of", "of")} {rule.basis}
                        {rule.segment ? ` · ${rule.segment}` : ""}
                        {list ? ` · ${list.name}` : ""}
                        {n(rule.minimum_amount) > 0
                          ? ` · ${t("sales.targets.min", "min")} ${money(rule.minimum_amount)}`
                          : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {!rule.is_active ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("sales.common.inactive", "Inactive")}
                        </Badge>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting}
                        onClick={() => openEditRule(rule)}
                        aria-label={t("sales.common.edit", "Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={isDeleting}
                        onClick={() => {
                          if (!window.confirm(t("sales.targets.rule_delete_confirm", "Remove this rule?"))) return;
                          deleteRule.mutate(rule.id);
                        }}
                        aria-label={t("sales.common.delete", "Delete")}
                      >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title={t("sales.targets.earned", "Earned commission")}
        description={t(
          "sales.targets.earned_desc",
          "Approving locks a commission against recalculation; a paid one cannot be reopened.",
        )}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Select value={commissionStatusFilter} onValueChange={(v) => { setCommissionStatusFilter(v); setCommissionPage(1); }}>
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue placeholder={t("sales.common.status", "Status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("sales.common.all", "All")}</SelectItem>
              {COMMISSION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={commissionEmployeeFilter}
            onValueChange={(v) => {
              setCommissionEmployeeFilter(v);
              setCommissionPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[12rem]">
              <SelectValue placeholder={t("sales.overview.employee", "Employee")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("sales.common.all", "All")}</SelectItem>
              {(employeesQuery.data?.data ?? []).map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {employeeLabel(employeeById, e.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {commissionsLoading ? (
          <PanelTableSkeleton rows={6} cols={8} />
        ) : commissionsQuery.isError ? (
          <EmptyPanel label={t("sales.targets.commissions_failed", "Could not load commissions.")} />
        ) : commissions.length === 0 ? (
          <EmptyPanel label={t("sales.targets.no_commission", "No commission earned yet.")} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-semibold">{t("sales.targets.period", "Period")}</th>
                    <th className="pb-2 font-semibold">{t("sales.overview.employee", "Employee")}</th>
                    <th className="pb-2 font-semibold">{t("sales.orders.number", "Order")}</th>
                    <th className="pb-2 text-right font-semibold">{t("sales.targets.basis", "Basis")}</th>
                    <th className="pb-2 text-right font-semibold">{t("sales.targets.rate", "Rate")}</th>
                    <th className="pb-2 text-right font-semibold">{t("sales.targets.amount", "Amount")}</th>
                    <th className="pb-2 font-semibold">{t("sales.common.status", "Status")}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((commission) => {
                    const isDeciding = decidingId === commission.id;
                    return (
                      <tr key={commission.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2 font-mono text-xs">{commission.period}</td>
                        <td className="py-2">
                          {employeeLabel(employeeById, commission.employee_id) ?? `#${commission.employee_id}`}
                        </td>
                        <td className="py-2 font-mono text-xs">
                          <Link
                            href="/dashboard/sales/orders"
                            className="text-primary hover:underline"
                          >
                            {commission.order?.order_number ?? `#${commission.order_id}`}
                          </Link>
                        </td>
                        <td className="py-2 text-right tabular-nums">{money(commission.basis_amount)}</td>
                        <td className="py-2 text-right tabular-nums">{n(commission.rate_percent)}%</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {money(commission.amount)}
                        </td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-[11px] capitalize">
                            {commission.status}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {commission.status === "accrued" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px]"
                                disabled={isDeciding}
                                onClick={() => decide.mutate({ id: commission.id, status: "approved" })}
                              >
                                {isDeciding ? <Loader2 className="h-3 w-3 animate-spin" /> : t("sales.common.approve", "Approve")}
                              </Button>
                            ) : null}
                            {commission.status === "approved" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px]"
                                disabled={isDeciding}
                                onClick={() => decide.mutate({ id: commission.id, status: "paid" })}
                              >
                                {isDeciding ? <Loader2 className="h-3 w-3 animate-spin" /> : t("sales.targets.mark_paid", "Mark paid")}
                              </Button>
                            ) : null}
                            {commission.status === "accrued" || commission.status === "approved" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-[11px] text-destructive"
                                disabled={isDeciding}
                                onClick={() => {
                                  if (!window.confirm(t("sales.targets.cancel_confirm", "Cancel this commission?"))) return;
                                  decide.mutate({ id: commission.id, status: "cancelled" });
                                }}
                              >
                                {t("sales.common.cancel", "Cancel")}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {commissionsLastPage > 1 ? (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t("sales.pricing.page_of", "Page {page} of {total}")
                    .replace("{page}", String(commissionPage))
                    .replace("{total}", String(commissionsLastPage))}{" "}
                  · {commissionsTotal} {t("sales.targets.rows", "rows")}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={commissionPage <= 1}
                    onClick={() => setCommissionPage((p) => Math.max(1, p - 1))}
                  >
                    {t("sales.common.prev", "Prev")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={commissionPage >= commissionsLastPage}
                    onClick={() => setCommissionPage((p) => p + 1)}
                  >
                    {t("sales.common.next", "Next")}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Panel>

      <Dialog
        open={targetDialogOpen}
        onOpenChange={(open) =>
          allowDialogClose(open, () => (open ? setTargetDialogOpen(true) : resetTargetForm()))
        }
      >
        <DialogContent
          className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingTargetKey
                  ? t("sales.targets.edit_target", "Edit target")
                  : t("sales.targets.add_target", "Add target")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "sales.targets.target_dialog_desc",
                  "Targets are unique per period, owner, and scope. Saving again updates the existing row.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("sales.targets.period", "Period")}</Label>
              <Input
                type="month"
                value={targetForm.period}
                onChange={(e) => setTargetForm({ ...targetForm, period: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.targets.scope", "Scope")}</Label>
              <Select
                value={targetForm.scope}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setTargetForm({ ...targetForm, scope: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("sales.targets.owner", "Owner")}</Label>
              {employeesQuery.isError ? (
                <Input
                  type="number"
                  value={targetForm.owner_employee_id}
                  onChange={(e) => setTargetForm({ ...targetForm, owner_employee_id: e.target.value })}
                  placeholder={t("sales.targets.company", "blank = company")}
                  className="h-9"
                />
              ) : (
                <Select
                  value={targetForm.owner_employee_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) =>
                    setTargetForm({ ...targetForm, owner_employee_id: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t("sales.targets.company", "Company-wide")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("sales.overview.company_wide", "Company-wide")}</SelectItem>
                    {(employeesQuery.data?.data ?? []).map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {employeeLabel(employeeById, e.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.targets.amount", "Target")}</Label>
              <Input
                type="number"
                min={0}
                value={targetForm.target_amount}
                onChange={(e) => setTargetForm({ ...targetForm, target_amount: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.targets.qty_target", "Qty target")}</Label>
              <Input
                type="number"
                min={0}
                value={targetForm.target_quantity}
                onChange={(e) => setTargetForm({ ...targetForm, target_quantity: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.pricing.currency", "Currency")}</Label>
              <Input
                maxLength={3}
                value={targetForm.currency}
                onChange={(e) =>
                  setTargetForm({ ...targetForm, currency: e.target.value.toUpperCase() })
                }
                className="h-9 uppercase"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("sales.common.notes", "Notes")}</Label>
              <Textarea
                rows={2}
                value={targetForm.notes}
                onChange={(e) => setTargetForm({ ...targetForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={resetTargetForm}>
              {t("sales.common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={saveTarget.isPending || !targetForm.period || !targetForm.target_amount}
              onClick={() => saveTarget.mutate()}
            >
              {saveTarget.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("sales.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ruleDialogOpen}
        onOpenChange={(open) => allowDialogClose(open, () => (open ? setRuleDialogOpen(true) : setRuleDialogOpen(false)))}
      >
        <DialogContent
          className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {ruleForm.id
                  ? t("sales.targets.edit_rule", "Edit commission rule")
                  : t("sales.targets.add_rule", "Add commission rule")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "sales.targets.rule_dialog_desc",
                  "Segment and price-list scoping narrow which orders the rule applies to.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("sales.common.name", "Name")}</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.targets.basis", "Basis")}</Label>
              <Select
                value={ruleForm.basis}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setRuleForm({ ...ruleForm, basis: v as RuleForm["basis"] })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">{t("sales.targets.revenue", "Revenue")}</SelectItem>
                  <SelectItem value="margin">{t("sales.targets.margin", "Margin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.targets.rate", "Rate %")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={ruleForm.rate_percent}
                onChange={(e) => setRuleForm({ ...ruleForm, rate_percent: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.targets.min", "Minimum order")}</Label>
              <Input
                type="number"
                min={0}
                value={ruleForm.minimum_amount}
                onChange={(e) => setRuleForm({ ...ruleForm, minimum_amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sales.customers.price_list", "Price list")}</Label>
              <Select
                value={ruleForm.price_list_id || "none"}
                onOpenChange={handlePickerOpenChange}
                onValueChange={(v) => setRuleForm({ ...ruleForm, price_list_id: v === "none" ? "" : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("sales.common.optional", "Optional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("sales.common.optional", "Optional")}</SelectItem>
                  {priceLists.map((list) => (
                    <SelectItem key={list.id} value={String(list.id)}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("sales.customers.segment", "Segment")}</Label>
              <Input
                value={ruleForm.segment}
                onChange={(e) => setRuleForm({ ...ruleForm, segment: e.target.value })}
                placeholder={t("sales.targets.any", "any")}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="rule-active-dialog"
                checked={ruleForm.is_active}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, is_active: checked })}
              />
              <Label htmlFor="rule-active-dialog">{t("sales.common.active", "Active")}</Label>
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRuleDialogOpen(false)}>
              {t("sales.common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={saveRule.isPending || !ruleForm.name.trim() || !ruleForm.rate_percent}
              onClick={() => saveRule.mutate()}
            >
              {saveRule.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("sales.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SalesConfirmDialog
        {...confirmDialogProps}
        pending={deleteTarget.isPending}
      />
    </div>
  );
}
