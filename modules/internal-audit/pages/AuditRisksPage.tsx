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
import type {
  AuditArea,
  AuditRisk,
  RiskBand,
  RiskCategory,
  RiskTreatment,
} from "@/modules/internal-audit/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { SeverityBands } from "@/modules/shared/charts/charts";

const CATEGORIES: RiskCategory[] = [
  "strategic",
  "operational",
  "financial",
  "compliance",
  "reputational",
];

const TREATMENTS: RiskTreatment[] = ["accept", "mitigate", "transfer", "avoid"];

const SCALE = [1, 2, 3, 4, 5];

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

export default function AuditRisksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [riskOpen, setRiskOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    code: "",
    title: "",
    area_id: "",
    category: "operational",
    likelihood: "3",
    impact: "3",
    existing_controls: "",
    residual_likelihood: "2",
    residual_impact: "2",
    treatment: "mitigate",
    owner_name: "",
    next_review_on: "",
  });

  const risksQuery = useQuery({
    queryKey: ["internal-audit", "risks", search, category],
    queryFn: () =>
      internalAuditApi
        .listRisks({
          limit: 50,
          ...(search ? { search } : {}),
          ...(category ? { category } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const areasQuery = useQuery({
    queryKey: ["internal-audit", "area-options"],
    queryFn: () => internalAuditApi.listAreas({ limit: 100 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["internal-audit", "overview-risks"],
    queryFn: () => internalAuditApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["internal-audit"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveRisk = useMutation({
    mutationFn: () =>
      internalAuditApi.createRisk({
        code: form.code,
        title: form.title,
        ...(form.area_id ? { area_id: Number(form.area_id) } : {}),
        category: form.category,
        likelihood: Number(form.likelihood),
        impact: Number(form.impact),
        existing_controls: form.existing_controls || null,
        residual_likelihood: Number(form.residual_likelihood),
        residual_impact: Number(form.residual_impact),
        treatment: form.treatment,
        owner_name: form.owner_name || null,
        ...(form.next_review_on ? { next_review_on: form.next_review_on } : {}),
        is_active: true,
      }),
    onSuccess: () => {
      toast.success(t("internal_audit.risks.saved", "Risk added to the register."));
      invalidate();
      setRiskOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.risks.save_failed", "Could not save it."))),
  });

  const risks = (risksQuery.data?.data ?? []) as AuditRisk[];
  const areas = (areasQuery.data?.data ?? []) as AuditArea[];
  const summary = overviewQuery.data?.data?.risks;

  const inherentPreview = Number(form.likelihood) * Number(form.impact);
  const residualPreview = Number(form.residual_likelihood) * Number(form.residual_impact);
  const residualImpossible = residualPreview > inherentPreview;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("internal_audit.risks.title", "Risk Register")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "internal_audit.risks.subtitle",
              "Inherent risk is what exists before controls; residual is what survives them. Bands are set on the residual score, because what is left is what the business actually carries.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setRiskOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("internal_audit.risks.add", "Add Risk")}
        </Button>
      </div>

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("internal_audit.risks.total", "Risks")}
              value={n(summary.total).toLocaleString()}
              meta={t("internal_audit.overview.accepted_meta", "{n} accepted outright").replace(
                "{n}",
                String(n(summary.accepted)),
              )}
            />
            <StatTile
              label={t("internal_audit.overview.review_overdue", "Reviews overdue")}
              value={n(summary.review_overdue).toLocaleString()}
              alert={n(summary.review_overdue) > 0}
            />
            <StatTile
              label={t("internal_audit.overview.control_effect", "Controls remove")}
              value={`${n(summary.average_control_effectiveness).toFixed(0)}%`}
              meta={t("internal_audit.overview.control_meta", "of inherent risk on average")}
            />
            <StatTile
              label={t("internal_audit.risks.impossible", "Scoring errors")}
              value={n(summary.impossible_residuals).toLocaleString()}
              // Surfaced rather than silently clamped — this is a register to
              // correct, not a finding about the business.
              meta={t("internal_audit.risks.impossible_meta", "residual worse than inherent")}
              alert={n(summary.impossible_residuals) > 0}
            />
          </div>

          <SeverityBands
            title={t("internal_audit.risks.by_band", "Register by residual risk")}
            description={t(
              "internal_audit.risks.by_band_desc",
              "What the business is left carrying once its controls are taken into account.",
            )}
            bands={(summary.by_band ?? []).map((row: any) => ({
              key: row.band,
              label: row.label,
              severity: BAND_RAMP[row.band as RiskBand] ?? "caution",
              count: n(row.count),
            }))}
            emptyLabel={t("internal_audit.risks.none", "Nothing on the register.")}
          />
        </>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="r-search" className="text-xs">
            {t("internal_audit.common.search", "Search")}
          </Label>
          <Input
            id="r-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("internal_audit.risks.search_hint", "Code or title")}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-category" className="text-xs">
            {t("internal_audit.risks.category", "Category")}
          </Label>
          <select
            id="r-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("internal_audit.common.any", "Any")}</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Panel
        title={t("internal_audit.risks.register", "Register")}
        description={t(
          "internal_audit.risks.register_desc",
          "Control effectiveness is the share of inherent risk the controls actually removed.",
        )}
      >
        {risksQuery.isLoading ? (
          <LoadingPanel label={t("internal_audit.common.loading", "Loading the register...")} />
        ) : risks.length === 0 ? (
          <EmptyPanel label={t("internal_audit.risks.none", "Nothing on the register.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.risks.risk", "Risk")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.findings.area", "Area")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.risks.inherent", "Inherent")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.risks.residual", "Residual")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.risks.effect", "Controls remove")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.risks.treatment", "Treatment")}</th>
                  <th className="pb-2 pr-6 font-semibold">{t("internal_audit.risks.review", "Review")}</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((risk) => {
                  const impossible = n(risk.residual_score) > n(risk.inherent_score);
                  return (
                    <tr key={risk.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="block font-medium">{risk.title}</span>
                        <span className="block text-[11px] capitalize text-muted-foreground">
                          {risk.code}
                          {risk.category ? ` · ${risk.category}` : ""}
                          {risk.owner_name ? ` · ${risk.owner_name}` : ""}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs">{risk.area?.name ?? "—"}</td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {n(risk.inherent_score)}
                        <span className="block text-[11px] text-muted-foreground">
                          {risk.likelihood} × {risk.impact}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="outline"
                          className={`border-transparent text-[10px] font-black uppercase tracking-widest ${
                            BAND_TONE[(risk.risk_band ?? "low") as RiskBand]
                          }`}
                        >
                          {risk.risk_band}
                        </Badge>
                        <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">
                          {n(risk.residual_score)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {risk.control_effectiveness_percent === null ||
                        risk.control_effectiveness_percent === undefined
                          ? "—"
                          : `${risk.control_effectiveness_percent.toFixed(0)}%`}
                        {impossible ? (
                          <span className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            {t("internal_audit.risks.check_scoring", "check scoring")}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {risk.treatment}
                        </Badge>
                      </td>
                      <td className="py-2 pr-6 text-xs tabular-nums">
                        {/* Date casts serialise as full ISO timestamps; only
                            the day part means anything for a review date. */}
                        {risk.next_review_on ? String(risk.next_review_on).slice(0, 10) : "—"}
                        {risk.is_review_overdue ? (
                          <span className="block text-[11px] font-semibold text-destructive">
                            {t("internal_audit.risks.overdue", "Overdue")}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add a risk */}
      <Dialog open={riskOpen} onOpenChange={setRiskOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.risks.add", "Add Risk")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.risks.add_desc",
                  "Score the risk before controls, then after them. Residual should not exceed inherent — controls cannot make a risk worse.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="k-code">{t("internal_audit.universe.code", "Code")}</Label>
              <Input
                id="k-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="R01"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-category">{t("internal_audit.risks.category", "Category")}</Label>
              <select
                id="k-category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="k-title">{t("internal_audit.findings.title_field", "Title")}</Label>
              <Input
                id="k-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={t(
                  "internal_audit.risks.title_hint",
                  "Payment to a supplier that was never approved",
                )}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="k-area">{t("internal_audit.findings.area", "Area")}</Label>
              <select
                id="k-area"
                value={form.area_id}
                onChange={(event) => setForm({ ...form, area_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("internal_audit.risks.no_area", "Not tied to one area")}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.code} — {area.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="k-likelihood">
                {t("internal_audit.risks.likelihood", "Likelihood before controls")}
              </Label>
              <select
                id="k-likelihood"
                value={form.likelihood}
                onChange={(event) => setForm({ ...form, likelihood: event.target.value })}
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
              <Label htmlFor="k-impact">
                {t("internal_audit.risks.impact", "Impact before controls")}
              </Label>
              <select
                id="k-impact"
                value={form.impact}
                onChange={(event) => setForm({ ...form, impact: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SCALE.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="k-controls">
                {t("internal_audit.risks.controls", "Existing controls")}
              </Label>
              <Input
                id="k-controls"
                value={form.existing_controls}
                onChange={(event) => setForm({ ...form, existing_controls: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-rlikelihood">
                {t("internal_audit.risks.residual_likelihood", "Likelihood after")}
              </Label>
              <select
                id="k-rlikelihood"
                value={form.residual_likelihood}
                onChange={(event) => setForm({ ...form, residual_likelihood: event.target.value })}
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
              <Label htmlFor="k-rimpact">
                {t("internal_audit.risks.residual_impact", "Impact after")}
              </Label>
              <select
                id="k-rimpact"
                value={form.residual_impact}
                onChange={(event) => setForm({ ...form, residual_impact: event.target.value })}
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
              <Label htmlFor="k-treatment">{t("internal_audit.risks.treatment", "Treatment")}</Label>
              <select
                id="k-treatment"
                value={form.treatment}
                onChange={(event) => setForm({ ...form, treatment: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {TREATMENTS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-owner">{t("internal_audit.risks.owner", "Owner")}</Label>
              <Input
                id="k-owner"
                value={form.owner_name}
                onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="k-review">{t("internal_audit.risks.next_review", "Next review")}</Label>
              <Input
                id="k-review"
                type="date"
                value={form.next_review_on}
                onChange={(event) => setForm({ ...form, next_review_on: event.target.value })}
              />
            </div>

            <p
              className={`sm:col-span-2 text-xs ${
                residualImpossible ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              }`}
            >
              {t("internal_audit.risks.preview", "Inherent {i} → residual {r}")
                .replace("{i}", String(inherentPreview))
                .replace("{r}", String(residualPreview))}
              {residualImpossible
                ? ` · ${t("internal_audit.risks.preview_warning", "controls cannot make a risk worse — check the scoring")}`
                : ` · ${t("internal_audit.risks.preview_effect", "controls remove {n}%").replace(
                    "{n}",
                    String(
                      Math.round(((inherentPreview - residualPreview) / inherentPreview) * 100),
                    ),
                  )}`}
            </p>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRiskOpen(false)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveRisk.mutate()}
              disabled={saveRisk.isPending || !form.code.trim() || !form.title.trim()}
            >
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
