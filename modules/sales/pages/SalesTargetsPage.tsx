"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { salesApi } from "@/modules/sales/api";
import type { SalesCommission, SalesCommissionRule, SalesTarget } from "@/modules/sales/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { RankedBarChart } from "@/modules/shared/charts/charts";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function SalesTargetsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [targetForm, setTargetForm] = React.useState({
    period: currentPeriod(),
    owner_employee_id: "",
    scope: "employee",
    target_amount: "",
  });

  const [ruleForm, setRuleForm] = React.useState({
    name: "",
    basis: "revenue",
    rate_percent: "",
    minimum_amount: "0",
    segment: "",
    is_active: true,
  });

  const targetsQuery = useQuery({
    queryKey: ["sales", "targets"],
    queryFn: () => salesApi.listTargets({ limit: 100 }).then((res) => res.data),
  });

  const rulesQuery = useQuery({
    queryKey: ["sales", "commission-rules"],
    queryFn: () => salesApi.listCommissionRules({ limit: 100 }).then((res) => res.data),
  });

  const commissionsQuery = useQuery({
    queryKey: ["sales", "commissions"],
    queryFn: () => salesApi.listCommissions({ limit: 50 }).then((res) => res.data),
  });

  const summaryQuery = useQuery({
    queryKey: ["sales", "commission-summary"],
    queryFn: () => salesApi.commissionSummary().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveTarget = useMutation({
    mutationFn: () =>
      salesApi.createTarget({
        period: targetForm.period,
        owner_employee_id: targetForm.owner_employee_id
          ? Number(targetForm.owner_employee_id)
          : null,
        scope: targetForm.scope,
        target_amount: Number(targetForm.target_amount || 0),
      }),
    onSuccess: () => {
      toast.success(t("sales.targets.saved", "Target saved."));
      invalidate();
      setTargetForm({ ...targetForm, target_amount: "", owner_employee_id: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.targets.save_failed", "Could not save the target."))),
  });

  const deleteTarget = useMutation({
    mutationFn: (id: number) => salesApi.deleteTarget(id),
    onSuccess: () => {
      toast.success(t("sales.targets.deleted", "Target removed."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not remove it.")),
  });

  const saveRule = useMutation({
    mutationFn: () =>
      salesApi.createCommissionRule({
        name: ruleForm.name,
        basis: ruleForm.basis,
        rate_percent: Number(ruleForm.rate_percent || 0),
        minimum_amount: Number(ruleForm.minimum_amount || 0),
        segment: ruleForm.segment || null,
        is_active: ruleForm.is_active,
      }),
    onSuccess: () => {
      toast.success(t("sales.targets.rule_saved", "Commission rule saved."));
      invalidate();
      setRuleForm({ ...ruleForm, name: "", rate_percent: "", segment: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.targets.rule_failed", "Could not save the rule."))),
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) => salesApi.deleteCommissionRule(id),
    onSuccess: () => {
      toast.success(t("sales.targets.rule_deleted", "Rule removed."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not remove it.")),
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      salesApi.decideCommission(id, status),
    onSuccess: () => {
      toast.success(t("sales.targets.commission_updated", "Commission updated."));
      invalidate();
    },
    // A paid commission cannot be reopened; the API says so.
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.targets.decide_failed", "Could not update it."))),
  });

  const targets = (targetsQuery.data?.data ?? []) as SalesTarget[];
  const rules = (rulesQuery.data?.data ?? []) as SalesCommissionRule[];
  const commissions = (commissionsQuery.data?.data ?? []) as SalesCommission[];
  const summary = summaryQuery.data?.data;

  return (
    <div className="space-y-6">
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

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label={t("sales.targets.accrued", "Accrued")} value={money(summary.accrued)} />
          <StatTile label={t("sales.targets.approved", "Approved")} value={money(summary.approved)} />
          <StatTile label={t("sales.targets.paid", "Paid")} value={money(summary.paid)} />
          <StatTile
            label={t("sales.targets.earners", "Earning")}
            value={n(summary.earners).toLocaleString()}
            meta={t("sales.targets.earners_meta", "people with commission")}
          />
        </div>
      ) : null}

      {summary && (summary.by_employee ?? []).length > 0 ? (
        <RankedBarChart
          title={t("sales.targets.by_employee", "Commission by seller")}
          description={t(
            "sales.targets.by_employee_desc",
            "Total earned across every order in the period.",
          )}
          rows={summary.by_employee.map((row: any) => ({
            key: String(row.employee_id),
            label: `${t("sales.overview.employee", "Employee")} #${row.employee_id}`,
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
        >
          {targetsQuery.isLoading ? (
            <LoadingPanel label={t("sales.common.loading", "Loading...")} />
          ) : targets.length === 0 ? (
            <EmptyPanel label={t("sales.targets.none", "No targets set.")} />
          ) : (
            <div className="space-y-1.5">
              {targets.map((target) => (
                <div
                  key={target.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-mono text-xs">{target.period}</span>
                    <span className="ml-2 text-muted-foreground">
                      {target.owner_employee_id
                        ? `${t("sales.overview.owner", "Owner")} #${target.owner_employee_id}`
                        : t("sales.overview.company_wide", "Company-wide")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{money(target.target_amount)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => deleteTarget.mutate(target.id)}
                      aria-label={t("sales.common.delete", "Delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border/40 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="target-period">{t("sales.targets.period", "Period")}</Label>
              <Input
                id="target-period"
                type="month"
                value={targetForm.period}
                onChange={(event) => setTargetForm({ ...targetForm, period: event.target.value })}
                className="h-9 w-36"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-owner">{t("sales.targets.owner_id", "Owner ID")}</Label>
              <Input
                id="target-owner"
                type="number"
                value={targetForm.owner_employee_id}
                onChange={(event) =>
                  setTargetForm({ ...targetForm, owner_employee_id: event.target.value })
                }
                placeholder={t("sales.targets.company", "blank = company")}
                className="h-9 w-32"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-amount">{t("sales.targets.amount", "Target")}</Label>
              <Input
                id="target-amount"
                type="number"
                min={0}
                value={targetForm.target_amount}
                onChange={(event) =>
                  setTargetForm({ ...targetForm, target_amount: event.target.value })
                }
                className="h-9 w-36"
              />
            </div>
            <Button
              variant="outline"
              className="h-9"
              disabled={saveTarget.isPending || !targetForm.period || !targetForm.target_amount}
              onClick={() => saveTarget.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("sales.common.save", "Save")}
            </Button>
          </div>
        </Panel>

        <Panel
          title={t("sales.targets.rules", "Commission rules")}
          description={t(
            "sales.targets.rules_desc",
            "The most specific matching rule wins: a segment rule beats a price-list rule, which beats a catch-all.",
          )}
        >
          {rulesQuery.isLoading ? (
            <LoadingPanel label={t("sales.common.loading", "Loading...")} />
          ) : rules.length === 0 ? (
            <EmptyPanel label={t("sales.targets.no_rules", "No commission rules yet.")} />
          ) : (
            <div className="space-y-1.5">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{rule.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {n(rule.rate_percent)}% {t("sales.targets.of", "of")} {rule.basis}
                      {rule.segment ? ` · ${rule.segment}` : ""}
                      {n(rule.minimum_amount) > 0
                        ? ` · ${t("sales.targets.min", "min")} ${money(rule.minimum_amount)}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {!rule.is_active ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {t("sales.common.inactive", "Inactive")}
                      </Badge>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => deleteRule.mutate(rule.id)}
                      aria-label={t("sales.common.delete", "Delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border/40 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">{t("sales.common.name", "Name")}</Label>
              <Input
                id="rule-name"
                value={ruleForm.name}
                onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })}
                className="h-9 w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-basis">{t("sales.targets.basis", "Basis")}</Label>
              <select
                id="rule-basis"
                value={ruleForm.basis}
                onChange={(event) => setRuleForm({ ...ruleForm, basis: event.target.value })}
                className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="revenue">{t("sales.targets.revenue", "Revenue")}</option>
                <option value="margin">{t("sales.targets.margin", "Margin")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-rate">{t("sales.targets.rate", "Rate %")}</Label>
              <Input
                id="rule-rate"
                type="number"
                min={0}
                max={100}
                value={ruleForm.rate_percent}
                onChange={(event) => setRuleForm({ ...ruleForm, rate_percent: event.target.value })}
                className="h-9 w-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-segment">{t("sales.customers.segment", "Segment")}</Label>
              <Input
                id="rule-segment"
                value={ruleForm.segment}
                onChange={(event) => setRuleForm({ ...ruleForm, segment: event.target.value })}
                placeholder={t("sales.targets.any", "any")}
                className="h-9 w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="rule-active"
                checked={ruleForm.is_active}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, is_active: checked })}
              />
              <Label htmlFor="rule-active" className="text-xs">
                {t("sales.common.active", "Active")}
              </Label>
            </div>
            <Button
              variant="outline"
              className="h-9"
              disabled={saveRule.isPending || !ruleForm.name.trim() || !ruleForm.rate_percent}
              onClick={() => saveRule.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("sales.common.save", "Save")}
            </Button>
          </div>
        </Panel>
      </div>

      <Panel
        title={t("sales.targets.earned", "Earned commission")}
        description={t(
          "sales.targets.earned_desc",
          "Approving locks a commission against recalculation; a paid one cannot be reopened.",
        )}
      >
        {commissionsQuery.isLoading ? (
          <LoadingPanel label={t("sales.common.loading", "Loading...")} />
        ) : commissions.length === 0 ? (
          <EmptyPanel label={t("sales.targets.no_commission", "No commission earned yet.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
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
                {commissions.map((commission) => (
                  <tr key={commission.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 font-mono text-xs">{commission.period}</td>
                    <td className="py-2">#{commission.employee_id}</td>
                    <td className="py-2 font-mono text-xs">
                      {commission.order?.order_number ?? `#${commission.order_id}`}
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
                      {commission.status === "accrued" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px]"
                          onClick={() => decide.mutate({ id: commission.id, status: "approved" })}
                        >
                          {t("sales.common.approve", "Approve")}
                        </Button>
                      ) : commission.status === "approved" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px]"
                          onClick={() => decide.mutate({ id: commission.id, status: "paid" })}
                        >
                          {t("sales.targets.mark_paid", "Mark paid")}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
