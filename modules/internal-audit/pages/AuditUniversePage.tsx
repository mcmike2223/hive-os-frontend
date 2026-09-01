"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
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
import type { AuditArea, CoverageRow, RiskBand } from "@/modules/internal-audit/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { SeverityBands } from "@/modules/shared/charts/charts";

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

const RISK_BANDS: RiskBand[] = ["critical", "high", "moderate", "low"];
const SCALE = [1, 2, 3, 4, 5];

const DEFAULT_AREA_FORM = {
  code: "",
  name: "",
  category: "",
  owner_name: "",
  inherent_likelihood: "3",
  inherent_impact: "3",
  audit_cycle_months: "12",
  last_audited_on: "",
  notes: "",
  is_active: true,
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dateOnly = (value: string | null | undefined) =>
  value ? String(value).slice(0, 10) : "—";

const riskBandFromScore = (score: number): RiskBand => {
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "moderate";
  return "low";
};

export default function AuditUniversePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_audit_universe", "manage_internal_audit"]);

  const [planTableQuery, setPlanTableQuery] = React.useState({
    page: 1,
    pageSize: 10,
    search: "",
  });
  const [registerTableQuery, setRegisterTableQuery] = React.useState({
    page: 1,
    pageSize: 10,
    search: "",
  });

  const [bandFilter, setBandFilter] = React.useState("all");
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [inProgressOnly, setInProgressOnly] = React.useState(false);

  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [activeOnly, setActiveOnly] = React.useState(false);

  const [detailId, setDetailId] = React.useState<number | null>(() => {
    const id = searchParams.get("id");
    return id ? Number(id) : null;
  });

  const [areaOpen, setAreaOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AuditArea | null>(null);
  const [form, setForm] = React.useState({ ...DEFAULT_AREA_FORM });
  const [savingId, setSavingId] = React.useState<number | null>(null);

  const coverageQuery = useQuery({
    queryKey: ["internal-audit", "coverage"],
    queryFn: () => internalAuditApi.coverage().then((res) => res.data),
  });

  const areasQuery = useQuery({
    queryKey: ["internal-audit", "areas", registerTableQuery, categoryFilter, activeOnly],
    queryFn: () =>
      internalAuditApi
        .listAreas({
          page: registerTableQuery.page,
          limit: registerTableQuery.pageSize,
          search: registerTableQuery.search || undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          ...(activeOnly ? { active_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const detailQuery = useQuery({
    queryKey: ["internal-audit", "area", detailId],
    queryFn: () => internalAuditApi.getArea(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const overviewQuery = useQuery({
    queryKey: ["internal-audit", "overview-universe"],
    queryFn: () => internalAuditApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["internal-audit"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const resetForm = React.useCallback(() => {
    setForm({ ...DEFAULT_AREA_FORM });
    setEditing(null);
  }, []);

  const openCreate = React.useCallback(() => {
    resetForm();
    setAreaOpen(true);
  }, [resetForm]);

  const openEdit = React.useCallback((area: AuditArea) => {
    setEditing(area);
    setForm({
      code: area.code,
      name: area.name,
      category: area.category ?? "",
      owner_name: area.owner_name ?? "",
      inherent_likelihood: String(area.inherent_likelihood),
      inherent_impact: String(area.inherent_impact),
      audit_cycle_months: String(area.audit_cycle_months),
      last_audited_on: area.last_audited_on ? String(area.last_audited_on).slice(0, 10) : "",
      notes: area.notes ?? "",
      is_active: area.is_active,
    });
    setAreaOpen(true);
  }, []);

  const saveArea = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code,
        name: form.name,
        category: form.category || null,
        owner_name: form.owner_name || null,
        inherent_likelihood: Number(form.inherent_likelihood),
        inherent_impact: Number(form.inherent_impact),
        audit_cycle_months: Number(form.audit_cycle_months || 12),
        ...(form.last_audited_on ? { last_audited_on: form.last_audited_on } : { last_audited_on: null }),
        notes: form.notes || null,
        is_active: form.is_active,
      };
      if (editing) {
        setSavingId(editing.id);
        return internalAuditApi.updateArea(editing.id, payload);
      }
      return internalAuditApi.createArea(payload);
    },
    onSuccess: () => {
      toast.success(
        editing
          ? t("internal_audit.universe.updated", "Area updated.")
          : t("internal_audit.universe.saved", "Area added to the universe."),
      );
      invalidate();
      setAreaOpen(false);
      resetForm();
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(
        errorText(
          error,
          editing
            ? t("internal_audit.universe.update_failed", "Could not update it.")
            : t("internal_audit.universe.save_failed", "Could not save it."),
        ),
      ),
    onSettled: () => setSavingId(null),
  });

  const handlePlanTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setPlanTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const handleRegisterTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setRegisterTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const coverage = (coverageQuery.data?.data ?? []) as CoverageRow[];
  const areas = (areasQuery.data?.data ?? []) as AuditArea[];
  const summary = overviewQuery.data?.data?.coverage;
  const detail = (detailQuery.data?.data ?? null) as AuditArea | null;

  const categories = React.useMemo(
    () =>
      Array.from(
        new Set(areas.map((area) => area.category).filter((value): value is string => Boolean(value))),
      ).sort(),
    [areas],
  );

  const filteredCoverage = React.useMemo(() => {
    const search = planTableQuery.search.trim().toLowerCase();
    return coverage.filter((row) => {
      if (search) {
        const haystack = `${row.code} ${row.name}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (bandFilter !== "all" && row.risk_band !== bandFilter) return false;
      if (overdueOnly && !row.is_overdue_for_audit) return false;
      if (inProgressOnly && !row.has_audit_in_progress) return false;
      return true;
    });
  }, [bandFilter, coverage, inProgressOnly, overdueOnly, planTableQuery.search]);

  const planPageData = React.useMemo(() => {
    const start = (planTableQuery.page - 1) * planTableQuery.pageSize;
    return filteredCoverage.slice(start, start + planTableQuery.pageSize);
  }, [filteredCoverage, planTableQuery.page, planTableQuery.pageSize]);

  const previewScore = Number(form.inherent_likelihood) * Number(form.inherent_impact);

  const planColumns = React.useMemo<ColumnDef<CoverageRow>[]>(
    () => [
      {
        id: "area",
        header: t("internal_audit.universe.area", "Area"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left"
            onClick={() => setDetailId(row.original.area_id)}
          >
            <p className="font-medium hover:underline">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </button>
        ),
      },
      {
        id: "risk",
        header: t("internal_audit.universe.risk", "Inherent risk"),
        cell: ({ row }) => (
          <div>
            <Badge
              variant="outline"
              className={`border-transparent text-[10px] font-black uppercase tracking-widest ${BAND_TONE[row.original.risk_band]}`}
            >
              {row.original.risk_band}
            </Badge>
            <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">
              {row.original.risk_score} / 25
            </span>
          </div>
        ),
      },
      {
        id: "cycle",
        header: t("internal_audit.universe.cycle", "Cycle"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {t("internal_audit.universe.months", "{n} months").replace(
              "{n}",
              String(row.original.cycle_months),
            )}
          </span>
        ),
      },
      {
        id: "last",
        header: t("internal_audit.universe.last", "Last audited"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.last_audited_on ?? (
              <span className="italic text-muted-foreground">
                {t("internal_audit.universe.never_lower", "never")}
              </span>
            )}
            {row.original.months_since_audit !== null ? (
              <span className="block text-[11px] text-muted-foreground">
                {t("internal_audit.universe.months_ago", "{n} months ago").replace(
                  "{n}",
                  String(row.original.months_since_audit),
                )}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "due",
        header: t("internal_audit.universe.due", "Due"),
        cell: ({ row }) => (
          <div className="text-xs">
            {row.original.is_overdue_for_audit ? (
              <span className="font-semibold text-destructive">
                {t("internal_audit.universe.overdue_word", "Overdue")}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t("internal_audit.universe.current", "Current")}
              </span>
            )}
            {row.original.has_audit_in_progress ? (
              <Link
                href={`/dashboard/internal-audit/engagements?area_id=${row.original.area_id}&open_only=1`}
                className="block text-[11px] hover:underline"
              >
                {t("internal_audit.universe.in_progress", "audit in progress")}
              </Link>
            ) : null}
          </div>
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
              onClick={() => setDetailId(row.original.area_id)}
              aria-label={t("internal_audit.common.open", "Open")}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
              <Link href={`/dashboard/internal-audit/engagements?area_id=${row.original.area_id}`}>
                {t("internal_audit.engagements.plan", "Plan")}
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  const registerColumns = React.useMemo<ColumnDef<AuditArea>[]>(
    () => [
      {
        id: "area",
        header: t("internal_audit.universe.area", "Area"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left"
            onClick={() => setDetailId(row.original.id)}
          >
            <p className="font-medium hover:underline">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </button>
        ),
      },
      {
        accessorKey: "category",
        header: t("internal_audit.universe.category", "Category"),
        cell: ({ row }) => <span className="text-xs">{row.original.category ?? "—"}</span>,
      },
      {
        id: "risk",
        header: t("internal_audit.universe.risk", "Inherent risk"),
        cell: ({ row }) => (
          <div>
            <Badge
              variant="outline"
              className={`border-transparent text-[10px] font-black uppercase tracking-widest ${BAND_TONE[row.original.risk_band ?? "low"]}`}
            >
              {row.original.risk_band ?? "—"}
            </Badge>
            <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">
              {row.original.risk_score ?? "—"} / 25
            </span>
          </div>
        ),
      },
      {
        id: "owner",
        header: t("internal_audit.universe.owner", "Process owner"),
        cell: ({ row }) => <span className="text-xs">{row.original.owner_name ?? "—"}</span>,
      },
      {
        id: "work",
        header: t("internal_audit.universe.work", "Work"),
        cell: ({ row }) => (
          <div className="text-xs tabular-nums">
            <span>
              {t("internal_audit.engagements.papers", "{n} papers").replace(
                "{n}",
                String(n(row.original.engagements_count)),
              )}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {n(row.original.open_findings_count) > 0 ? (
                <Link
                  href={`/dashboard/internal-audit/findings?area_id=${row.original.id}`}
                  className="hover:underline"
                >
                  {t("internal_audit.engagements.open_findings", "{n} open").replace(
                    "{n}",
                    String(n(row.original.open_findings_count)),
                  )}
                </Link>
              ) : (
                t("internal_audit.engagements.findings_count", "{n} findings").replace("{n}", "0")
              )}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: t("internal_audit.common.status", "Status"),
        cell: ({ row }) => (
          <div className="text-xs">
            {row.original.is_active ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                {t("internal_audit.universe.active", "Active")}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t("internal_audit.universe.inactive", "Inactive")}
              </span>
            )}
            {row.original.is_overdue_for_audit ? (
              <span className="block font-semibold text-destructive">
                {t("internal_audit.universe.overdue_word", "Overdue")}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "row_actions",
        header: "",
        cell: ({ row }) => (
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

  const renderAreaForm = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{t("internal_audit.universe.code", "Code")}</Label>
        <Input
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
          disabled={Boolean(editing)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.common.name", "Name")}</Label>
        <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.universe.category", "Category")}</Label>
        <Input
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          placeholder={t("internal_audit.universe.category_hint", "Process, entity, system")}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.universe.owner", "Process owner")}</Label>
        <Input
          value={form.owner_name}
          onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.universe.likelihood", "Likelihood (1–5)")}</Label>
        <Select
          value={form.inherent_likelihood}
          onValueChange={(value) => setForm({ ...form, inherent_likelihood: value })}
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
      <div className="space-y-1.5">
        <Label>{t("internal_audit.universe.impact", "Impact (1–5)")}</Label>
        <Select
          value={form.inherent_impact}
          onValueChange={(value) => setForm({ ...form, inherent_impact: value })}
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
      <div className="space-y-1.5">
        <Label>{t("internal_audit.universe.cycle_months", "Audit every (months)")}</Label>
        <Input
          type="number"
          min={1}
          max={120}
          value={form.audit_cycle_months}
          onChange={(event) => setForm({ ...form, audit_cycle_months: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("internal_audit.universe.last", "Last audited")}</Label>
        <Input
          type="date"
          value={form.last_audited_on}
          onChange={(event) => setForm({ ...form, last_audited_on: event.target.value })}
        />
      </div>
      {editing ? (
        <div className="flex items-center gap-2 pb-1 sm:col-span-2">
          <Switch
            id="u-active"
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
          <Label htmlFor="u-active" className="text-sm">
            {t("internal_audit.universe.active", "Active in the universe")}
          </Label>
        </div>
      ) : null}
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("internal_audit.universe.notes", "Notes")}</Label>
        <Textarea
          rows={3}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </div>
      <p className="sm:col-span-2 text-xs text-muted-foreground">
        {t("internal_audit.universe.score_preview", "Risk score: {n} of 25").replace(
          "{n}",
          String(previewScore),
        )}
        {" · "}
        <span className="capitalize">{riskBandFromScore(previewScore)}</span>
      </p>
    </div>
  );

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
        {canManage ? (
          <Button className="rounded-full px-5" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("internal_audit.universe.add", "Add Area")}
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
      ) : overviewQuery.isLoading ? (
        <LoadingPanel label={t("internal_audit.common.loading", "Loading metrics...")} />
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

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.universe.risk", "Inherent risk")}</Label>
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
          <Switch id="au-overdue" checked={overdueOnly} onCheckedChange={setOverdueOnly} />
          <Label htmlFor="au-overdue" className="text-sm">
            {t("internal_audit.universe.overdue_only", "Overdue only")}
          </Label>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="au-progress" checked={inProgressOnly} onCheckedChange={setInProgressOnly} />
          <Label htmlFor="au-progress" className="text-sm">
            {t("internal_audit.universe.in_progress_only", "Audit in progress only")}
          </Label>
        </div>
      </div>

      {coverageQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("internal_audit.universe.plan_load_failed", "Could not load the audit plan.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => coverageQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("internal_audit.common.retry", "Retry")}
          </Button>
        </div>
      ) : coverageQuery.isLoading ? (
        <LoadingPanel label={t("internal_audit.common.loading", "Loading the plan...")} />
      ) : (
        <DataTable
          columns={planColumns}
          data={planPageData}
          totalEntries={filteredCoverage.length}
          loading={coverageQuery.isFetching && !coverageQuery.isLoading}
          pageIndex={planTableQuery.page}
          pageSize={planTableQuery.pageSize}
          onQueryChange={handlePlanTableQueryChange}
          title={t("internal_audit.universe.plan", "The plan")}
          description={t(
            "internal_audit.universe.plan_desc",
            "Highest risk first, and within that the longest neglected — an overdue critical area matters more than an overdue trivial one.",
          )}
          searchPlaceholder={t("internal_audit.universe.search_hint", "Code or name")}
          resourceName="audit-plan"
        />
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.universe.category", "Category")}</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="au-active" checked={activeOnly} onCheckedChange={setActiveOnly} />
          <Label htmlFor="au-active" className="text-sm">
            {t("internal_audit.universe.active_only", "Active only")}
          </Label>
        </div>
      </div>

      {areasQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("internal_audit.universe.register_load_failed", "Could not load the area register.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => areasQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("internal_audit.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={registerColumns}
          data={areas}
          totalEntries={areasQuery.data?.meta?.total ?? 0}
          loading={areasQuery.isLoading}
          pageIndex={registerTableQuery.page}
          pageSize={registerTableQuery.pageSize}
          onQueryChange={handleRegisterTableQueryChange}
          title={t("internal_audit.universe.register", "Area register")}
          description={t(
            "internal_audit.universe.register_desc",
            "The full universe including inactive areas — the plan above only ranks what is still active.",
          )}
          searchPlaceholder={t(
            "internal_audit.universe.register_search_hint",
            "Code, name, category or owner",
          )}
          resourceName="audit-areas"
        />
      )}

      {/* Detail */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.name ?? t("internal_audit.universe.area", "Area")}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">{detail?.code ?? "—"}</DialogDescription>
            </DialogHeader>
          </div>
          {detailQuery.isLoading ? (
            <LoadingPanel label={t("internal_audit.common.loading", "Loading area...")} />
          ) : detailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("internal_audit.universe.detail_failed", "Could not load this area.")}
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
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${BAND_TONE[detail.risk_band ?? "low"]}`}
                >
                  {detail.risk_band}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {detail.is_active
                    ? t("internal_audit.universe.active", "Active")
                    : t("internal_audit.universe.inactive", "Inactive")}
                </Badge>
                {detail.is_overdue_for_audit ? (
                  <Badge variant="outline" className="border-transparent bg-rose-500/15 text-rose-700">
                    {t("internal_audit.universe.overdue_word", "Overdue")}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.universe.category", "Category")}
                  </p>
                  {detail.category ?? "—"}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.universe.owner", "Process owner")}
                  </p>
                  {detail.owner_name ?? "—"}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.universe.risk", "Inherent risk")}
                  </p>
                  {detail.risk_score ?? "—"} / 25 ({detail.inherent_likelihood} × {detail.inherent_impact})
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.universe.cycle", "Cycle")}
                  </p>
                  {t("internal_audit.universe.months", "{n} months").replace(
                    "{n}",
                    String(detail.audit_cycle_months),
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.universe.last", "Last audited")}
                  </p>
                  {detail.last_audited_on ? dateOnly(detail.last_audited_on) : t("internal_audit.universe.never_lower", "never")}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.universe.work", "Work")}
                  </p>
                  {n(detail.engagements_count)} {t("internal_audit.engagements.title", "Engagements").toLowerCase()}
                  {" · "}
                  {n(detail.open_findings_count)} {t("internal_audit.findings.open", "Open findings").toLowerCase()}
                  {" · "}
                  {n(detail.risks_count)} {t("internal_audit.risks.title", "Risks").toLowerCase()}
                </div>
              </div>

              {detail.notes ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.universe.notes", "Notes")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{detail.notes}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-border/40 pt-4">
                <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                  <Link href={`/dashboard/internal-audit/engagements?area_id=${detail.id}`}>
                    {t("internal_audit.engagements.title", "Engagements")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                  <Link href={`/dashboard/internal-audit/findings?area_id=${detail.id}`}>
                    {t("internal_audit.findings.title", "Findings")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                  <Link href={`/dashboard/internal-audit/risks?area_id=${detail.id}`}>
                    {t("internal_audit.risks.title", "Risks")}
                  </Link>
                </Button>
                {canManage ? (
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
                ) : null}
              </div>
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
        open={areaOpen}
        onOpenChange={(open) => {
          setAreaOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editing
                  ? t("internal_audit.universe.edit", "Edit Area")
                  : t("internal_audit.universe.add", "Add Area")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.universe.add_desc",
                  "Leave the last audit blank if this has never been audited — it will show as overdue, which is the honest reading.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{renderAreaForm()}</div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAreaOpen(false)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveArea.mutate()}
              disabled={saveArea.isPending || !form.code.trim() || !form.name.trim()}
            >
              {saveArea.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
