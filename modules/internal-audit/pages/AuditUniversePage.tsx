"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { internalAuditApi } from "@/modules/internal-audit/api";
import type { CoverageRow, RiskBand } from "@/modules/internal-audit/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { SeverityBands } from "@/modules/shared/charts/charts";

/** Risk band is an ordered scale, so it earns the reserved severity ramp. */
const BAND_RAMP: Record<RiskBand, string> = {
  critical: "critical",
  high: "warning",
  moderate: "caution",
  low: "good",
};

const BAND_TONE: Record<RiskBand, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  moderate: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  low: "bg-muted text-muted-foreground",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const SCALE = [1, 2, 3, 4, 5];

export default function AuditUniversePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [areaOpen, setAreaOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    category: "",
    owner_name: "",
    inherent_likelihood: "3",
    inherent_impact: "3",
    audit_cycle_months: "12",
    last_audited_on: "",
  });

  const coverageQuery = useQuery({
    queryKey: ["internal-audit", "coverage"],
    queryFn: () => internalAuditApi.coverage().then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["internal-audit", "overview-universe"],
    queryFn: () => internalAuditApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["internal-audit"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveArea = useMutation({
    mutationFn: () =>
      internalAuditApi.createArea({
        code: form.code,
        name: form.name,
        category: form.category || null,
        owner_name: form.owner_name || null,
        inherent_likelihood: Number(form.inherent_likelihood),
        inherent_impact: Number(form.inherent_impact),
        audit_cycle_months: Number(form.audit_cycle_months || 12),
        ...(form.last_audited_on ? { last_audited_on: form.last_audited_on } : {}),
        is_active: true,
      }),
    onSuccess: () => {
      toast.success(t("internal_audit.universe.saved", "Area added to the universe."));
      invalidate();
      setAreaOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.universe.save_failed", "Could not save it."))),
  });

  const coverage = (coverageQuery.data?.data ?? []) as CoverageRow[];
  const summary = overviewQuery.data?.data?.coverage;

  const previewScore = Number(form.inherent_likelihood) * Number(form.inherent_impact);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("internal_audit.universe.title", "Audit Universe")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "internal_audit.universe.subtitle",
              "Everything that can be audited, ranked by the risk that decides how often it should be. An area nobody has ever audited counts as overdue from the day it enters the register.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setAreaOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("internal_audit.universe.add", "Add Area")}
        </Button>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("internal_audit.universe.areas", "Areas")}
            value={n(summary.areas).toLocaleString()}
          />
          <StatTile
            label={t("internal_audit.universe.overdue", "Overdue for audit")}
            value={n(summary.overdue_for_audit).toLocaleString()}
            alert={n(summary.overdue_for_audit) > 0}
          />
          <StatTile
            label={t("internal_audit.universe.never", "Never audited")}
            value={n(summary.never_audited).toLocaleString()}
            meta={t("internal_audit.universe.never_meta", "the places nobody has looked")}
            alert={n(summary.never_audited) > 0}
          />
          <StatTile
            label={t("internal_audit.overview.coverage", "High-risk coverage")}
            value={`${n(summary.high_risk_coverage_percent).toFixed(0)}%`}
            meta={t("internal_audit.overview.coverage_meta", "{covered} of {total} current")
              .replace("{covered}", String(n(summary.high_risk_covered)))
              .replace("{total}", String(n(summary.high_risk_areas)))}
            alert={n(summary.high_risk_covered) < n(summary.high_risk_areas)}
          />
        </div>
      ) : null}

      {summary ? (
        <SeverityBands
          title={t("internal_audit.universe.by_band", "Universe by inherent risk")}
          description={t(
            "internal_audit.universe.by_band_desc",
            "Likelihood times impact on a five-point scale, banded at the conventional cuts for a 5x5 matrix.",
          )}
          bands={(summary.by_band ?? []).map((row: any) => ({
            key: row.band,
            label: row.label,
            severity: BAND_RAMP[row.band as RiskBand] ?? "caution",
            count: n(row.count),
          }))}
          emptyLabel={t("internal_audit.universe.no_areas", "Nothing in the universe yet.")}
        />
      ) : null}

      <Panel
        title={t("internal_audit.universe.plan", "The plan")}
        description={t(
          "internal_audit.universe.plan_desc",
          "Highest risk first, and within that the longest neglected — an overdue critical area matters more than an overdue trivial one.",
        )}
      >
        {coverageQuery.isLoading ? (
          <LoadingPanel label={t("internal_audit.common.loading", "Loading the plan...")} />
        ) : coverage.length === 0 ? (
          <EmptyPanel label={t("internal_audit.universe.no_areas", "Nothing in the universe yet.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.universe.area", "Area")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.universe.risk", "Inherent risk")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.universe.cycle", "Cycle")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.universe.last", "Last audited")}</th>
                  <th className="pb-2 pr-6 font-semibold">{t("internal_audit.universe.due", "Due")}</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((row) => (
                  <tr key={row.area_id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{row.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{row.code}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${BAND_TONE[row.risk_band]}`}
                      >
                        {row.risk_band}
                      </Badge>
                      <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">
                        {row.risk_score} / 25
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {t("internal_audit.universe.months", "{n} months").replace(
                        "{n}",
                        String(row.cycle_months),
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {/* Never audited is not "0 months ago". */}
                      {row.last_audited_on ?? (
                        <span className="italic text-muted-foreground">
                          {t("internal_audit.universe.never_lower", "never")}
                        </span>
                      )}
                      {row.months_since_audit !== null ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {t("internal_audit.universe.months_ago", "{n} months ago").replace(
                            "{n}",
                            String(row.months_since_audit),
                          )}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-6 text-xs">
                      {row.is_overdue_for_audit ? (
                        <span className="font-semibold text-destructive">
                          {t("internal_audit.universe.overdue_word", "Overdue")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("internal_audit.universe.current", "Current")}
                        </span>
                      )}
                      {row.has_audit_in_progress ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {t("internal_audit.universe.in_progress", "audit in progress")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add an area */}
      <Dialog open={areaOpen} onOpenChange={setAreaOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.universe.add", "Add Area")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.universe.add_desc",
                  "Leave the last audit blank if this has never been audited — it will show as overdue, which is the honest reading.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="u-code">{t("internal_audit.universe.code", "Code")}</Label>
              <Input
                id="u-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-name">{t("internal_audit.common.name", "Name")}</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-category">{t("internal_audit.universe.category", "Category")}</Label>
              <Input
                id="u-category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder={t("internal_audit.universe.category_hint", "Process, entity, system")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-owner">{t("internal_audit.universe.owner", "Process owner")}</Label>
              <Input
                id="u-owner"
                value={form.owner_name}
                onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-likelihood">
                {t("internal_audit.universe.likelihood", "Likelihood (1–5)")}
              </Label>
              <select
                id="u-likelihood"
                value={form.inherent_likelihood}
                onChange={(event) => setForm({ ...form, inherent_likelihood: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SCALE.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-impact">{t("internal_audit.universe.impact", "Impact (1–5)")}</Label>
              <select
                id="u-impact"
                value={form.inherent_impact}
                onChange={(event) => setForm({ ...form, inherent_impact: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SCALE.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-cycle">
                {t("internal_audit.universe.cycle_months", "Audit every (months)")}
              </Label>
              <Input
                id="u-cycle"
                type="number"
                min={1}
                max={120}
                value={form.audit_cycle_months}
                onChange={(event) => setForm({ ...form, audit_cycle_months: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-last">{t("internal_audit.universe.last", "Last audited")}</Label>
              <Input
                id="u-last"
                type="date"
                value={form.last_audited_on}
                onChange={(event) => setForm({ ...form, last_audited_on: event.target.value })}
              />
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              {t("internal_audit.universe.score_preview", "Risk score: {n} of 25").replace(
                "{n}",
                String(previewScore),
              )}
              {" · "}
              <span className="capitalize">
                {previewScore >= 15
                  ? "critical"
                  : previewScore >= 10
                    ? "high"
                    : previewScore >= 5
                      ? "moderate"
                      : "low"}
              </span>
            </p>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAreaOpen(false)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveArea.mutate()}
              disabled={saveArea.isPending || !form.code.trim() || !form.name.trim()}
            >
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
