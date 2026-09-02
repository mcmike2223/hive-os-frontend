"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, RefreshCw, X } from "lucide-react";
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
import { usePermissions } from "@/hooks/use-permissions";
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
const RISK_BANDS: RiskBand[] = ["critical", "high", "moderate", "low"];
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

const DEFAULT_RISK_FORM = {
  code: "",
  title: "",
  area_id: "",
  category: "operational" as RiskCategory,
  likelihood: "3",
  impact: "3",
  existing_controls: "",
  residual_likelihood: "2",
  residual_impact: "2",
  treatment: "mitigate" as RiskTreatment,
  owner_name: "",
  reviewed_on: "",
  next_review_on: "",
  is_active: true,
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dateOnly = (value: string | null | undefined) =>
  value ? String(value).slice(0, 10) : "—";

const isImpossibleResidual = (inherent: number, residual: number) => residual > inherent;

export default function AuditRisksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_audit_risks", "manage_internal_audit"]);

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [treatmentFilter, setTreatmentFilter] = React.useState("all");
  const [areaFilter, setAreaFilter] = React.useState(
    () => searchParams.get("area_id") ?? "all",
  );
  const [bandFilter, setBandFilter] = React.useState("all");
  const [activeOnly, setActiveOnly] = React.useState(true);
  const [reviewOverdueOnly, setReviewOverdueOnly] = React.useState(false);
  const [impossibleOnly, setImpossibleOnly] = React.useState(false);

  const [detailId, setDetailId] = React.useState<number | null>(() => {
    const id = searchParams.get("id");
    return id ? Number(id) : null;
  });

  const [riskOpen, setRiskOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AuditRisk | null>(null);
  const [form, setForm] = React.useState({ ...DEFAULT_RISK_FORM });
  const [savingId, setSavingId] = React.useState<number | null>(null);

  const risksQuery = useQuery({
    queryKey: [
      "internal-audit",
      "risks",
      tableQuery,
      categoryFilter,
      treatmentFilter,
      areaFilter,
      bandFilter,
      activeOnly,
      reviewOverdueOnly,
      impossibleOnly,
    ],
    queryFn: () =>
      internalAuditApi
        .listRisks({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          treatment: treatmentFilter !== "all" ? treatmentFilter : undefined,
          area_id: areaFilter !== "all" ? Number(areaFilter) : undefined,
          risk_band: bandFilter !== "all" ? bandFilter : undefined,
          ...(activeOnly ? { active_only: 1 } : {}),
          ...(reviewOverdueOnly ? { review_overdue_only: 1 } : {}),
          ...(impossibleOnly ? { impossible_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const detailQuery = useQuery({
    queryKey: ["internal-audit", "risk", detailId],
    queryFn: () => internalAuditApi.getRisk(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const areasQuery = useQuery({
    queryKey: ["internal-audit", "area-options"],
    queryFn: () => internalAuditApi.listAreas({ limit: 100, active_only: 1 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["internal-audit", "overview-risks"],
    queryFn: () => internalAuditApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["internal-audit"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const resetForm = React.useCallback(() => {
    setForm({ ...DEFAULT_RISK_FORM });
    setEditing(null);
  }, []);

  const openCreate = React.useCallback(() => {
    resetForm();
    if (areaFilter !== "all") {
      setForm((current) => ({ ...current, area_id: areaFilter }));
    }
    setRiskOpen(true);
  }, [areaFilter, resetForm]);

  const openEdit = React.useCallback((risk: AuditRisk) => {
    setEditing(risk);
    setForm({
      code: risk.code,
      title: risk.title,
      area_id: risk.area_id ? String(risk.area_id) : "",
      category: (risk.category ?? "operational") as RiskCategory,
      likelihood: String(risk.likelihood),
      impact: String(risk.impact),
      existing_controls: risk.existing_controls ?? "",
      residual_likelihood: String(risk.residual_likelihood),
      residual_impact: String(risk.residual_impact),
      treatment: risk.treatment,
      owner_name: risk.owner_name ?? "",
      reviewed_on: risk.reviewed_on ? String(risk.reviewed_on).slice(0, 10) : "",
      next_review_on: risk.next_review_on ? String(risk.next_review_on).slice(0, 10) : "",
      is_active: risk.is_active,
    });
    setRiskOpen(true);
  }, []);

  const saveRisk = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code,
        title: form.title,
        ...(form.area_id ? { area_id: Number(form.area_id) } : { area_id: null }),
        category: form.category,
        likelihood: Number(form.likelihood),
        impact: Number(form.impact),
        existing_controls: form.existing_controls || null,
        residual_likelihood: Number(form.residual_likelihood),
        residual_impact: Number(form.residual_impact),
        treatment: form.treatment,
        owner_name: form.owner_name || null,
        ...(form.reviewed_on ? { reviewed_on: form.reviewed_on } : { reviewed_on: null }),
        ...(form.next_review_on ? { next_review_on: form.next_review_on } : { next_review_on: null }),
        is_active: form.is_active,
      };
      if (editing) {
        setSavingId(editing.id);
        return internalAuditApi.updateRisk(editing.id, payload);
      }
      return internalAuditApi.createRisk(payload);
    },
    onSuccess: () => {
      toast.success(
        editing
          ? t("internal_audit.risks.updated", "Risk updated.")
          : t("internal_audit.risks.saved", "Risk added to the register."),
      );
      invalidate();
      setRiskOpen(false);
      resetForm();
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(
        errorText(
          error,
          editing
            ? t("internal_audit.risks.update_failed", "Could not update it.")
            : t("internal_audit.risks.save_failed", "Could not save it."),
        ),
      ),
    onSettled: () => setSavingId(null),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const risks = (risksQuery.data?.data ?? []) as AuditRisk[];
  const areas = (areasQuery.data?.data ?? []) as AuditArea[];
  const summary = overviewQuery.data?.data?.risks;
  const detail = (detailQuery.data?.data ?? null) as AuditRisk | null;
  const filteredArea = areas.find((row) => String(row.id) === areaFilter);

  const inherentPreview = Number(form.likelihood) * Number(form.impact);
  const residualPreview = Number(form.residual_likelihood) * Number(form.residual_impact);
  const residualImpossible = isImpossibleResidual(inherentPreview, residualPreview);

  const columns = React.useMemo<ColumnDef<AuditRisk>[]>(
    () => [
      {
        id: "risk",
        header: t("internal_audit.risks.risk", "Risk"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left"
            onClick={() => setDetailId(row.original.id)}
          >
            <p className="font-medium hover:underline">{row.original.title}</p>
            <p className="text-[11px] capitalize text-muted-foreground">
              {row.original.code}
              {row.original.category ? ` · ${row.original.category}` : ""}
              {row.original.owner_name ? ` · ${row.original.owner_name}` : ""}
            </p>
          </button>
        ),
      },
      {
        id: "area",
        header: t("internal_audit.findings.area", "Area"),
        cell: ({ row }) =>
          row.original.area ? (
            <Link
              href={`/dashboard/internal-audit/universe?id=${row.original.area_id}`}
              className="text-xs hover:underline"
            >
              {row.original.area.name}
            </Link>
          ) : (
            <span className="text-xs">—</span>
          ),
      },
      {
        id: "inherent",
        header: t("internal_audit.risks.inherent", "Inherent"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {n(row.original.inherent_score)}
            <span className="block text-[11px] text-muted-foreground">
              {row.original.likelihood} × {row.original.impact}
            </span>
          </span>
        ),
      },
      {
        id: "residual",
        header: t("internal_audit.risks.residual", "Residual"),
        cell: ({ row }) => (
          <div>
            <Badge
              variant="outline"
              className={`border-transparent text-[10px] font-black uppercase tracking-widest ${BAND_TONE[(row.original.risk_band ?? "low") as RiskBand]}`}
            >
              {row.original.risk_band}
            </Badge>
            <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">
              {n(row.original.residual_score)}
            </span>
          </div>
        ),
      },
      {
        id: "effect",
        header: t("internal_audit.risks.effect", "Controls remove"),
        cell: ({ row }) => {
          const impossible = isImpossibleResidual(
            n(row.original.inherent_score),
            n(row.original.residual_score),
          );
          return (
            <span className="text-xs tabular-nums">
              {row.original.control_effectiveness_percent === null ||
              row.original.control_effectiveness_percent === undefined
                ? "—"
                : `${row.original.control_effectiveness_percent.toFixed(0)}%`}
              {impossible ? (
                <span className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {t("internal_audit.risks.check_scoring", "check scoring")}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "treatment",
        header: t("internal_audit.risks.treatment", "Treatment"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] capitalize">
            {row.original.treatment}
          </Badge>
        ),
      },
      {
        id: "review",
        header: t("internal_audit.risks.review", "Review"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.next_review_on ? dateOnly(row.original.next_review_on) : "—"}
            {row.original.is_review_overdue ? (
              <span className="block text-[11px] font-semibold text-destructive">
                {t("internal_audit.risks.overdue", "Overdue")}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setDetailId(row.original.id)}
              aria-label={t("internal_audit.common.open", "Open")}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {canManage ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={savingId === row.original.id}
                onClick={() => openEdit(row.original)}
              >
                {savingId === row.original.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Pencil className="mr-1 h-3 w-3" />
                    {t("internal_audit.common.edit", "Edit")}
                  </>
                )}
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canManage, openEdit, savingId, t],
  );

  const renderRiskForm = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{t("internal_audit.universe.code", "Code")}</Label>
        <Input
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
          placeholder="R01"
          disabled={Boolean(editing)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.risks.category", "Category")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.category}
            onValueChange={(value) => setForm({ ...form, category: value as RiskCategory })}
          >
            <SelectTrigger className="capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("internal_audit.findings.title_field", "Title")}</Label>
        <Input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder={t(
            "internal_audit.risks.title_hint",
            "Payment to a supplier that was never approved",
          )}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("internal_audit.findings.area", "Area")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.area_id || "none"}
            onValueChange={(value) => setForm({ ...form, area_id: value === "none" ? "" : value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {t("internal_audit.risks.no_area", "Not tied to one area")}
              </SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={String(area.id)}>
                  {area.code} — {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.risks.likelihood", "Likelihood before controls")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.likelihood}
            onValueChange={(value) => setForm({ ...form, likelihood: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALE.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.risks.impact", "Impact before controls")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.impact}
            onValueChange={(value) => setForm({ ...form, impact: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALE.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("internal_audit.risks.controls", "Existing controls")}</Label>
        <Textarea
          rows={3}
          value={form.existing_controls}
          onChange={(event) => setForm({ ...form, existing_controls: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.risks.residual_likelihood", "Likelihood after")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.residual_likelihood}
            onValueChange={(value) => setForm({ ...form, residual_likelihood: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALE.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.risks.residual_impact", "Impact after")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.residual_impact}
            onValueChange={(value) => setForm({ ...form, residual_impact: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALE.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.risks.treatment", "Treatment")}</Label>
        <Select
          value={form.treatment}
          onValueChange={(value) => setForm({ ...form, treatment: value as RiskTreatment })}
        >
          <SelectTrigger className="capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TREATMENTS.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.risks.owner", "Owner")}</Label>
        <Input
          value={form.owner_name}
          onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.risks.reviewed_on", "Last reviewed")}</Label>
        <Input
          type="date"
          value={form.reviewed_on}
          onChange={(event) => setForm({ ...form, reviewed_on: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.risks.next_review", "Next review")}</Label>
        <Input
          type="date"
          value={form.next_review_on}
          onChange={(event) => setForm({ ...form, next_review_on: event.target.value })}
        />
      </div>
      {editing ? (
        <div className="flex items-center gap-2 pb-1 sm:col-span-2">
          <Switch
            id="r-active"
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
          <Label htmlFor="r-active" className="text-sm">
            {t("internal_audit.risks.active", "Active on the register")}
          </Label>
        </div>
      ) : null}
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
          : inherentPreview > 0
            ? ` · ${t("internal_audit.risks.preview_effect", "controls remove {n}%").replace(
                "{n}",
                String(Math.round(((inherentPreview - residualPreview) / inherentPreview) * 100)),
              )}`
            : ""}
      </p>
    </div>
  );

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
        {canManage ? (
          <Button className="rounded-full px-5" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("internal_audit.risks.add", "Add Risk")}
          </Button>
        ) : null}
      </div>

      {overviewQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("internal_audit.overview.unavailable", "Audit metrics are not available right now.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => overviewQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("internal_audit.common.retry", "Retry")}
          </Button>
        </div>
      ) : summary ? (
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

          {(summary.top ?? []).length > 0 ? (
            <Panel
              title={t("internal_audit.risks.top", "Highest residual risks")}
              description={t(
                "internal_audit.risks.top_desc",
                "The risks the board should hear about first — ranked by what is left after controls.",
              )}
            >
              <div className="space-y-1.5">
                {summary.top.slice(0, 8).map((row: any) => (
                  <button
                    key={row.risk_id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                    onClick={() => setDetailId(row.risk_id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.title}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {row.code}
                        {row.category ? ` · ${row.category}` : ""} · {row.treatment}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${BAND_TONE[row.risk_band as RiskBand] ?? BAND_TONE.moderate}`}
                      >
                        {row.risk_band}
                      </Badge>
                      <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">
                        {row.inherent_score} → {row.residual_score}
                        {row.review_overdue
                          ? ` · ${t("internal_audit.risks.overdue", "Overdue")}`
                          : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}
        </>
      ) : overviewQuery.isLoading ? (
        <LoadingPanel label={t("internal_audit.common.loading", "Loading metrics...")} />
      ) : null}

      {areaFilter !== "all" && filteredArea ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-3 text-sm">
          <span>
            {t("internal_audit.risks.area_filter", "Showing risks for area")}{" "}
            <span className="font-semibold">{filteredArea.name}</span>
          </span>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setAreaFilter("all")}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("internal_audit.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.risks.category", "Category")}</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-40 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {CATEGORIES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.risks.treatment", "Treatment")}</Label>
          <Select value={treatmentFilter} onValueChange={setTreatmentFilter}>
            <SelectTrigger className="h-9 w-36 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {TREATMENTS.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.findings.area", "Area")}</Label>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={String(area.id)}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.risks.residual", "Residual band")}</Label>
          <Select value={bandFilter} onValueChange={setBandFilter}>
            <SelectTrigger className="h-9 w-36 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {RISK_BANDS.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="r-active-only" checked={activeOnly} onCheckedChange={setActiveOnly} />
          <Label htmlFor="r-active-only" className="text-sm">
            {t("internal_audit.risks.active_only", "Active only")}
          </Label>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch
            id="r-overdue"
            checked={reviewOverdueOnly}
            onCheckedChange={setReviewOverdueOnly}
          />
          <Label htmlFor="r-overdue" className="text-sm">
            {t("internal_audit.risks.review_overdue_only", "Review overdue only")}
          </Label>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch
            id="r-impossible"
            checked={impossibleOnly}
            onCheckedChange={setImpossibleOnly}
          />
          <Label htmlFor="r-impossible" className="text-sm">
            {t("internal_audit.risks.impossible_only", "Scoring errors only")}
          </Label>
        </div>
      </div>

      {risksQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("internal_audit.risks.load_failed", "Could not load the register.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => risksQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("internal_audit.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={risks}
          totalEntries={risksQuery.data?.meta?.total ?? 0}
          loading={risksQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          title={t("internal_audit.risks.register", "Register")}
          description={t(
            "internal_audit.risks.register_desc",
            "Control effectiveness is the share of inherent risk the controls actually removed.",
          )}
          searchPlaceholder={t("internal_audit.risks.search_hint", "Code, title or owner")}
          resourceName="audit-risks"
        />
      )}

      {/* Detail */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.title ?? t("internal_audit.risks.risk", "Risk")}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">{detail?.code ?? "—"}</DialogDescription>
            </DialogHeader>
          </div>
          {detailQuery.isLoading ? (
            <LoadingPanel label={t("internal_audit.common.loading", "Loading risk...")} />
          ) : detailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("internal_audit.risks.detail_failed", "Could not load this risk.")}
              </p>
              <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("internal_audit.common.retry", "Retry")}
              </Button>
            </div>
          ) : detail ? (
            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${BAND_TONE[(detail.risk_band ?? "low") as RiskBand]}`}
                >
                  {detail.risk_band}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {detail.treatment}
                </Badge>
                {detail.is_active ? (
                  <Badge variant="outline" className="text-[10px]">
                    {t("internal_audit.risks.active", "Active")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {t("internal_audit.universe.inactive", "Inactive")}
                  </Badge>
                )}
                {detail.is_review_overdue ? (
                  <Badge variant="outline" className="border-transparent bg-rose-500/15 text-rose-700">
                    {t("internal_audit.risks.overdue", "Overdue")}
                  </Badge>
                ) : null}
              </div>

              {isImpossibleResidual(n(detail.inherent_score), n(detail.residual_score)) ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
                  {t(
                    "internal_audit.risks.impossible_detail",
                    "Residual score exceeds inherent — controls cannot make a risk worse. Correct the scoring.",
                  )}
                </div>
              ) : null}

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.findings.area", "Area")}
                  </p>
                  {detail.area ? (
                    <Link
                      href={`/dashboard/internal-audit/universe?id=${detail.area_id}`}
                      className="hover:underline"
                    >
                      {detail.area.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.risks.owner", "Owner")}
                  </p>
                  {detail.owner_name ?? "—"}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.risks.inherent", "Inherent")}
                  </p>
                  {n(detail.inherent_score)} ({detail.likelihood} × {detail.impact})
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.risks.residual", "Residual")}
                  </p>
                  {n(detail.residual_score)} ({detail.residual_likelihood} × {detail.residual_impact})
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.risks.effect", "Controls remove")}
                  </p>
                  {detail.control_effectiveness_percent !== null &&
                  detail.control_effectiveness_percent !== undefined
                    ? `${detail.control_effectiveness_percent.toFixed(0)}%`
                    : "—"}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.risks.review", "Review")}
                  </p>
                  {t("internal_audit.risks.reviewed_on", "Last")}: {dateOnly(detail.reviewed_on)}
                  <br />
                  {t("internal_audit.risks.next_review", "Next")}: {dateOnly(detail.next_review_on)}
                </div>
              </div>

              {detail.existing_controls ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.risks.controls", "Existing controls")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{detail.existing_controls}</p>
                </div>
              ) : null}

              {canManage ? (
                <div className="border-t border-border/40 pt-4">
                  <Button
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      openEdit(detail);
                      setDetailId(null);
                    }}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    {t("internal_audit.common.edit", "Edit")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDetailId(null)}>
              {t("internal_audit.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / edit */}
      <Dialog
        open={riskOpen}
        onOpenChange={(open) => {
          setRiskOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editing
                  ? t("internal_audit.risks.edit", "Edit Risk")
                  : t("internal_audit.risks.add", "Add Risk")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.risks.add_desc",
                  "Score the risk before controls, then after them. Residual should not exceed inherent — controls cannot make a risk worse.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{renderRiskForm()}</div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRiskOpen(false)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveRisk.mutate()}
              disabled={saveRisk.isPending || !form.code.trim() || !form.title.trim()}
            >
              {saveRisk.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
