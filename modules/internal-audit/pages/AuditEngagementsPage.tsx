"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  AuditEngagement,
  AuditFinding,
  AuditProcedure,
  EngagementStatus,
  EngagementType,
  ProcedureConclusion,
} from "@/modules/internal-audit/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const TYPES: EngagementType[] = [
  "operational",
  "financial",
  "compliance",
  "it",
  "follow_up",
  "investigation",
];

const OPINIONS = ["satisfactory", "needs_improvement", "unsatisfactory"] as const;
const CONCLUSIONS: ProcedureConclusion[] = [
  "effective",
  "partially_effective",
  "ineffective",
  "not_tested",
];

const ALL_STATUSES = Object.keys({
  planned: [],
  fieldwork: [],
  reporting: [],
  closed: [],
  cancelled: [],
}) as EngagementStatus[];

const NEXT_STATUSES: Record<EngagementStatus, EngagementStatus[]> = {
  planned: ["fieldwork", "cancelled"],
  fieldwork: ["reporting", "cancelled"],
  reporting: ["closed", "fieldwork"],
  closed: [],
  cancelled: [],
};

const STATUS_TONE: Record<EngagementStatus, string> = {
  planned: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  fieldwork: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  reporting: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  closed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

const DEFAULT_PLAN_FORM = {
  area_id: "",
  title: "",
  type: "operational" as EngagementType,
  lead_auditor_name: "",
  period_from: "",
  period_to: "",
  planned_start_on: "",
  planned_end_on: "",
  planned_hours: "80",
  objective: "",
  scope: "",
};

const DEFAULT_PROCEDURE_FORM = {
  reference: "",
  control_tested: "",
  description: "",
  population_size: "0",
  sample_size: "0",
  exceptions_found: "0",
  conclusion: "not_tested" as ProcedureConclusion,
  performed_by_name: "",
  performed_on: "",
  notes: "",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dateOnly = (value: string | null | undefined) =>
  value ? String(value).slice(0, 10) : "—";

export default function AuditEngagementsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canManageEngagements = hasAnyPermission([
    "manage_audit_engagements",
    "manage_internal_audit",
  ]);
  const canManageProcedures = hasAnyPermission([
    "manage_audit_procedures",
    "manage_internal_audit",
  ]);

  const [engagementsTableQuery, setEngagementsTableQuery] = React.useState({
    page: 1,
    pageSize: 10,
    search: "",
  });
  const [proceduresTableQuery, setProceduresTableQuery] = React.useState({
    page: 1,
    pageSize: 10,
    search: "",
  });

  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [areaFilter, setAreaFilter] = React.useState(
    () => searchParams.get("area_id") ?? "all",
  );
  const [openOnly, setOpenOnly] = React.useState(() => searchParams.get("open_only") === "1");

  const [procedureEngagementFilter, setProcedureEngagementFilter] = React.useState(
    () => searchParams.get("engagement_id") ?? "all",
  );
  const [procedureConclusionFilter, setProcedureConclusionFilter] = React.useState("all");

  const [detailId, setDetailId] = React.useState<number | null>(() => {
    const id = searchParams.get("id");
    return id ? Number(id) : null;
  });

  const [planOpen, setPlanOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...DEFAULT_PLAN_FORM });

  const [closing, setClosing] = React.useState<AuditEngagement | null>(null);
  const [closeForm, setCloseForm] = React.useState({
    opinion: "satisfactory",
    actual_hours: "0",
    conclusion: "",
  });

  const [cancelling, setCancelling] = React.useState<AuditEngagement | null>(null);
  const [testing, setTesting] = React.useState<AuditEngagement | null>(null);
  const [procedureForm, setProcedureForm] = React.useState({ ...DEFAULT_PROCEDURE_FORM });
  const [transitioningId, setTransitioningId] = React.useState<number | null>(null);
  const [addingProcedureId, setAddingProcedureId] = React.useState<number | null>(null);
  const papersSectionRef = React.useRef<HTMLDivElement>(null);

  const engagementsQuery = useQuery({
    queryKey: [
      "internal-audit",
      "engagements",
      engagementsTableQuery,
      statusFilter,
      typeFilter,
      areaFilter,
      openOnly,
    ],
    queryFn: () =>
      internalAuditApi
        .listEngagements({
          page: engagementsTableQuery.page,
          limit: engagementsTableQuery.pageSize,
          search: engagementsTableQuery.search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          type: typeFilter !== "all" ? typeFilter : undefined,
          area_id: areaFilter !== "all" ? Number(areaFilter) : undefined,
          ...(openOnly ? { open_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const proceduresQuery = useQuery({
    queryKey: [
      "internal-audit",
      "procedures",
      proceduresTableQuery,
      procedureEngagementFilter,
      procedureConclusionFilter,
    ],
    queryFn: () =>
      internalAuditApi
        .listProcedures({
          page: proceduresTableQuery.page,
          limit: proceduresTableQuery.pageSize,
          search: proceduresTableQuery.search || undefined,
          engagement_id:
            procedureEngagementFilter !== "all" ? Number(procedureEngagementFilter) : undefined,
          conclusion: procedureConclusionFilter !== "all" ? procedureConclusionFilter : undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const detailQuery = useQuery({
    queryKey: ["internal-audit", "engagement", detailId],
    queryFn: () => internalAuditApi.getEngagement(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const areasQuery = useQuery({
    queryKey: ["internal-audit", "area-options"],
    queryFn: () => internalAuditApi.listAreas({ limit: 100 }).then((res) => res.data),
  });

  const engagementOptionsQuery = useQuery({
    queryKey: ["internal-audit", "engagement-options"],
    queryFn: () => internalAuditApi.listEngagements({ limit: 100 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["internal-audit", "overview-engagements"],
    queryFn: () => internalAuditApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["internal-audit"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const plan = useMutation({
    mutationFn: () =>
      internalAuditApi.createEngagement({
        ...(form.area_id ? { area_id: Number(form.area_id) } : {}),
        title: form.title,
        type: form.type,
        lead_auditor_name: form.lead_auditor_name || null,
        ...(form.period_from ? { period_from: form.period_from } : {}),
        ...(form.period_to ? { period_to: form.period_to } : {}),
        ...(form.planned_start_on ? { planned_start_on: form.planned_start_on } : {}),
        ...(form.planned_end_on ? { planned_end_on: form.planned_end_on } : {}),
        planned_hours: Number(form.planned_hours || 0),
        objective: form.objective || null,
        scope: form.scope || null,
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("internal_audit.engagements.planned", "Engagement planned."));
      invalidate();
      setPlanOpen(false);
      setForm({ ...DEFAULT_PLAN_FORM });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.engagements.plan_failed", "Could not plan it."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, next }: { id: number; next: EngagementStatus }) => {
      setTransitioningId(id);
      return internalAuditApi.transitionEngagement(id, { status: next });
    },
    onSuccess: () => {
      toast.success(t("internal_audit.engagements.moved", "Engagement updated."));
      invalidate();
      setCancelling(null);
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.engagements.move_failed", "Could not move it."))),
    onSettled: () => setTransitioningId(null),
  });

  const close = useMutation({
    mutationFn: () =>
      internalAuditApi.transitionEngagement(closing!.id, {
        status: "closed",
        opinion: closeForm.opinion,
        actual_hours: Number(closeForm.actual_hours || 0),
        conclusion: closeForm.conclusion || null,
      }),
    onSuccess: () => {
      toast.success(
        t("internal_audit.engagements.closed", "Closed, and its area is now current on the plan."),
      );
      invalidate();
      setClosing(null);
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.engagements.close_failed", "Could not close it."))),
  });

  const addProcedure = useMutation({
    mutationFn: () => {
      setAddingProcedureId(testing!.id);
      return internalAuditApi.addProcedure(testing!.id, {
        reference: procedureForm.reference,
        control_tested: procedureForm.control_tested || null,
        description: procedureForm.description,
        population_size: Number(procedureForm.population_size || 0),
        sample_size: Number(procedureForm.sample_size || 0),
        exceptions_found: Number(procedureForm.exceptions_found || 0),
        conclusion: procedureForm.conclusion,
        performed_by_name: procedureForm.performed_by_name || null,
        ...(procedureForm.performed_on ? { performed_on: procedureForm.performed_on } : {}),
        notes: procedureForm.notes || null,
      });
    },
    onSuccess: () => {
      toast.success(t("internal_audit.procedures.saved", "Working paper recorded."));
      invalidate();
      setTesting(null);
      setProcedureForm({ ...DEFAULT_PROCEDURE_FORM });
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.procedures.save_failed", "Could not record it."))),
    onSettled: () => setAddingProcedureId(null),
  });

  const handleEngagementsTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setEngagementsTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const handleProceduresTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setProceduresTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const engagements = (engagementsQuery.data?.data ?? []) as AuditEngagement[];
  const engagementOptions = (engagementOptionsQuery.data?.data ?? []) as AuditEngagement[];
  const procedures = (proceduresQuery.data?.data ?? []) as AuditProcedure[];
  const areas = (areasQuery.data?.data ?? []) as AuditArea[];
  const summary = overviewQuery.data?.data?.engagements;
  const detail = (detailQuery.data?.data ?? null) as AuditEngagement | null;
  const filteredArea = areas.find((row) => String(row.id) === areaFilter);
  const filteredProcedureEngagement =
    engagementOptions.find((row) => String(row.id) === procedureEngagementFilter) ??
    engagements.find((row) => String(row.id) === procedureEngagementFilter);

  const focusWorkingPapers = React.useCallback(
    (engagementId: number, paperReference?: string) => {
      setProcedureEngagementFilter(String(engagementId));
      setProcedureConclusionFilter("all");
      setProceduresTableQuery((prev) => ({
        ...prev,
        page: 1,
        search: paperReference ?? "",
      }));
      setDetailId(null);
      window.setTimeout(() => {
        papersSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    },
    [],
  );

  const openCloseDialog = React.useCallback((row: AuditEngagement) => {
    setClosing(row);
    setCloseForm({
      opinion: row.opinion ?? "satisfactory",
      actual_hours: String(n(row.actual_hours) || n(row.planned_hours)),
      conclusion: row.conclusion ?? "",
    });
  }, []);

  const engagementColumns = React.useMemo<ColumnDef<AuditEngagement>[]>(
    () => [
      {
        id: "engagement",
        header: t("internal_audit.engagements.engagement", "Engagement"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left"
            onClick={() => setDetailId(row.original.id)}
          >
            <p className="font-medium hover:underline">{row.original.title}</p>
            <p className="font-mono text-[11px] capitalize text-muted-foreground">
              {row.original.engagement_number} · {row.original.type.replace(/_/g, " ")}
              {row.original.lead_auditor_name ? ` · ${row.original.lead_auditor_name}` : ""}
            </p>
          </button>
        ),
      },
      {
        id: "area",
        header: t("internal_audit.findings.area", "Area"),
        cell: ({ row }) =>
          row.original.area ? (
            <Link href="/dashboard/internal-audit/universe" className="text-xs hover:underline">
              {row.original.area.name}
            </Link>
          ) : (
            <span className="text-xs">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: t("internal_audit.common.status", "Status"),
        cell: ({ row }) => (
          <div>
            <Badge
              variant="outline"
              className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.original.status]}`}
            >
              {row.original.status}
            </Badge>
            {row.original.is_overrunning ? (
              <span className="block text-[11px] font-semibold text-destructive">
                {t("internal_audit.engagements.overrunning", "Overrunning")}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "opinion",
        header: t("internal_audit.engagements.opinion", "Opinion"),
        cell: ({ row }) => (
          <span className="text-xs capitalize">
            {row.original.opinion ? row.original.opinion.replace(/_/g, " ") : "—"}
          </span>
        ),
      },
      {
        id: "hours",
        header: t("internal_audit.engagements.hours_col", "Hours"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {n(row.original.actual_hours)} / {n(row.original.planned_hours)}
            {row.original.hours_variance !== null && row.original.hours_variance !== undefined ? (
              <span className="block text-[11px] text-muted-foreground">
                {row.original.hours_variance >= 0 ? "+" : ""}
                {row.original.hours_variance} h
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "work",
        header: t("internal_audit.engagements.work", "Work"),
        cell: ({ row }) => (
          <div className="text-xs tabular-nums">
            <button
              type="button"
              className="hover:underline"
              onClick={() => focusWorkingPapers(row.original.id)}
            >
              {t("internal_audit.engagements.papers", "{n} papers").replace(
                "{n}",
                String(n(row.original.procedures_count)),
              )}
            </button>
            <span className="block text-[11px] text-muted-foreground">
              {n(row.original.findings_count) > 0 ? (
                <Link
                  href={`/dashboard/internal-audit/findings?engagement_id=${row.original.id}`}
                  className="hover:underline"
                >
                  {t("internal_audit.engagements.findings_count", "{n} findings").replace(
                    "{n}",
                    String(n(row.original.findings_count)),
                  )}
                </Link>
              ) : (
                t("internal_audit.engagements.findings_count", "{n} findings").replace(
                  "{n}",
                  String(n(row.original.findings_count)),
                )
              )}
              {n(row.original.open_findings_count) > 0 ? (
                <span className="text-destructive">
                  {" · "}
                  {t("internal_audit.engagements.open_findings", "{n} open").replace(
                    "{n}",
                    String(n(row.original.open_findings_count)),
                  )}
                </span>
              ) : null}
            </span>
          </div>
        ),
      },
      {
        id: "row_actions",
        header: "",
        cell: ({ row }) => {
          const busy = transitioningId === row.original.id;
          const nextStates = canManageEngagements ? (NEXT_STATUSES[row.original.status] ?? []) : [];
          return (
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
              {canManageProcedures && row.original.is_open ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => setTesting(row.original)}
                >
                  {t("internal_audit.procedures.add", "Add paper")}
                </Button>
              ) : null}
              {nextStates.map((next) =>
                next === "closed" ? (
                  <Button
                    key={next}
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={busy}
                    onClick={() => openCloseDialog(row.original)}
                  >
                    {t("internal_audit.engagements.close", "Close")}
                  </Button>
                ) : next === "cancelled" ? (
                  <Button
                    key={next}
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] text-destructive"
                    disabled={busy}
                    onClick={() => setCancelling(row.original)}
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : next}
                  </Button>
                ) : (
                  <Button
                    key={next}
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] capitalize"
                    disabled={busy}
                    onClick={() => transition.mutate({ id: row.original.id, next })}
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : next}
                  </Button>
                ),
              )}
            </div>
          );
        },
      },
    ],
    [canManageEngagements, canManageProcedures, focusWorkingPapers, openCloseDialog, t, transition, transitioningId],
  );

  const procedureColumns = React.useMemo<ColumnDef<AuditProcedure>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("internal_audit.procedures.ref", "Ref"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{row.original.reference}</span>
        ),
      },
      {
        id: "control",
        header: t("internal_audit.procedures.control", "Control tested"),
        cell: ({ row }) => (
          <div>
            <p className="text-xs">{row.original.control_tested ?? row.original.description}</p>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:underline"
              onClick={() => setDetailId(row.original.engagement_id)}
            >
              {row.original.engagement?.engagement_number ?? `#${row.original.engagement_id}`}
            </button>
          </div>
        ),
      },
      {
        id: "sample",
        header: t("internal_audit.procedures.sample", "Sample"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {n(row.original.sample_size).toLocaleString()}
            {n(row.original.population_size) > 0 ? (
              <span className="block text-[11px] text-muted-foreground">
                {t("internal_audit.procedures.of_population", "of {n}").replace(
                  "{n}",
                  n(row.original.population_size).toLocaleString(),
                )}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "exceptions_found",
        header: t("internal_audit.procedures.exceptions", "Exceptions"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">{n(row.original.exceptions_found)}</span>
        ),
      },
      {
        id: "rate",
        header: t("internal_audit.procedures.rate", "Rate"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.exception_rate_percent === null ||
            row.original.exception_rate_percent === undefined
              ? t("internal_audit.procedures.not_tested", "not tested")
              : `${row.original.exception_rate_percent.toFixed(1)}%`}
          </span>
        ),
      },
      {
        accessorKey: "conclusion",
        header: t("internal_audit.procedures.conclusion", "Conclusion"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] capitalize">
            {row.original.conclusion.replace(/_/g, " ")}
          </Badge>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("internal_audit.engagements.title", "Engagements")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "internal_audit.engagements.subtitle",
              "An engagement cannot be closed without an opinion, and closing one is what marks its area current on the audit plan.",
            )}
          </p>
        </div>
        {canManageEngagements ? (
          <Button className="rounded-full px-5" onClick={() => setPlanOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("internal_audit.engagements.plan", "Plan Engagement")}
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
            label={t("internal_audit.engagements.open", "Open")}
            value={n(summary.open).toLocaleString()}
            meta={t("internal_audit.engagements.overrunning_meta", "{n} past their planned end").replace(
              "{n}",
              String(n(summary.overrunning)),
            )}
            alert={n(summary.overrunning) > 0}
          />
          <StatTile
            label={t("internal_audit.engagements.closed_stat", "Closed")}
            value={n(summary.closed).toLocaleString()}
          />
          <StatTile
            label={t("internal_audit.engagements.hours", "Hours spent")}
            value={n(summary.actual_hours).toLocaleString()}
            meta={t("internal_audit.engagements.hours_meta", "against {n} planned").replace(
              "{n}",
              String(n(summary.planned_hours)),
            )}
          />
          <StatTile
            label={t("internal_audit.engagements.variance", "Average variance")}
            value={`${n(summary.average_hours_variance) >= 0 ? "+" : ""}${n(summary.average_hours_variance).toFixed(0)} h`}
            meta={t("internal_audit.engagements.variance_meta", "on closed engagements")}
          />
        </div>
      ) : overviewQuery.isLoading ? (
        <LoadingPanel label={t("internal_audit.common.loading", "Loading metrics...")} />
      ) : null}

      {areaFilter !== "all" && filteredArea ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-3 text-sm">
          <span>
            {t("internal_audit.engagements.area_filter", "Showing engagements for area")}{" "}
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
          <Label className="text-xs">{t("internal_audit.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {ALL_STATUSES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.engagements.type", "Type")}</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-40 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {TYPES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value.replace(/_/g, " ")}
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
        <div className="flex items-center gap-2 pb-1">
          <Switch id="ae-open" checked={openOnly} onCheckedChange={setOpenOnly} />
          <Label htmlFor="ae-open" className="text-sm">
            {t("internal_audit.engagements.open_only", "Open only")}
          </Label>
        </div>
      </div>

      {engagementsQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("internal_audit.engagements.load_failed", "Could not load engagements.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => engagementsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("internal_audit.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={engagementColumns}
          data={engagements}
          totalEntries={engagementsQuery.data?.meta?.total ?? 0}
          loading={engagementsQuery.isLoading}
          pageIndex={engagementsTableQuery.page}
          pageSize={engagementsTableQuery.pageSize}
          onQueryChange={handleEngagementsTableQueryChange}
          title={t("internal_audit.engagements.list", "Audit plan")}
          description={t(
            "internal_audit.engagements.list_desc",
            "The period under review is not the period of the audit — both are kept, because a finding is about the former.",
          )}
          searchPlaceholder={t(
            "internal_audit.engagements.search_hint",
            "Number, title or lead auditor",
          )}
          resourceName="audit-engagements"
        />
      )}

      <div ref={papersSectionRef} className="scroll-mt-6 space-y-4">
      {procedureEngagementFilter !== "all" ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-3 text-sm">
          <span>
            {t("internal_audit.procedures.engagement_filter", "Showing papers for")}{" "}
            <span className="font-semibold">
              {filteredProcedureEngagement
                ? `${filteredProcedureEngagement.engagement_number} — ${filteredProcedureEngagement.title}`
                : `#${procedureEngagementFilter}`}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setProcedureEngagementFilter("all");
              setProceduresTableQuery((prev) => ({ ...prev, page: 1, search: "" }));
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {t("internal_audit.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.engagements.engagement", "Engagement")}</Label>
          <Select value={procedureEngagementFilter} onValueChange={setProcedureEngagementFilter}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {engagementOptions.map((engagement) => (
                <SelectItem key={engagement.id} value={String(engagement.id)}>
                  {engagement.engagement_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.procedures.conclusion", "Conclusion")}</Label>
          <Select value={procedureConclusionFilter} onValueChange={setProcedureConclusionFilter}>
            <SelectTrigger className="h-9 w-44 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {CONCLUSIONS.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {proceduresQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("internal_audit.procedures.load_failed", "Could not load working papers.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => proceduresQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("internal_audit.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={procedureColumns}
          data={procedures}
          totalEntries={proceduresQuery.data?.meta?.total ?? 0}
          loading={proceduresQuery.isLoading}
          pageIndex={proceduresTableQuery.page}
          pageSize={proceduresTableQuery.pageSize}
          onQueryChange={handleProceduresTableQueryChange}
          title={t("internal_audit.procedures.title", "Working papers")}
          description={t(
            "internal_audit.procedures.desc",
            "The exception rate is computed from the sample actually examined, not the population — dividing by the population would flatter a failing test badly.",
          )}
          searchPlaceholder={t(
            "internal_audit.procedures.search_hint",
            "Reference, control or engagement",
          )}
          resourceName="audit-procedures"
        />
      )}
      </div>

      {/* Detail modal */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.title ?? t("internal_audit.engagements.engagement", "Engagement")}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {detail?.engagement_number ?? "—"}
              </DialogDescription>
            </DialogHeader>
          </div>
          {detailQuery.isLoading ? (
            <LoadingPanel label={t("internal_audit.common.loading", "Loading engagement...")} />
          ) : detailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("internal_audit.engagements.detail_failed", "Could not load this engagement.")}
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
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[detail.status]}`}
                >
                  {detail.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {detail.type.replace(/_/g, " ")}
                </Badge>
                {detail.is_overrunning ? (
                  <Badge variant="outline" className="border-transparent bg-rose-500/15 text-rose-700">
                    {t("internal_audit.engagements.overrunning", "Overrunning")}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.findings.area", "Area")}
                  </p>
                  {detail.area ? (
                    <Link href="/dashboard/internal-audit/universe" className="hover:underline">
                      {detail.area.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.engagements.lead", "Lead auditor")}
                  </p>
                  {detail.lead_auditor_name ?? "—"}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.engagements.period", "Period under review")}
                  </p>
                  {dateOnly(detail.period_from)} — {dateOnly(detail.period_to)}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.engagements.planned_dates", "Planned dates")}
                  </p>
                  {dateOnly(detail.planned_start_on)} — {dateOnly(detail.planned_end_on)}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.engagements.hours_col", "Hours")}
                  </p>
                  {n(detail.actual_hours)} / {n(detail.planned_hours)}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.engagements.opinion", "Opinion")}
                  </p>
                  {detail.opinion ? detail.opinion.replace(/_/g, " ") : "—"}
                </div>
              </div>

              {detail.objective ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.engagements.objective", "Objective")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{detail.objective}</p>
                </div>
              ) : null}
              {detail.scope ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.engagements.scope", "Scope")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{detail.scope}</p>
                </div>
              ) : null}
              {detail.conclusion ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.engagements.conclusion", "Conclusion")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{detail.conclusion}</p>
                </div>
              ) : null}

              {(detail.procedures ?? []).length > 0 ? (
                <Panel title={t("internal_audit.procedures.title", "Working papers")}>
                  <ul className="space-y-2">
                    {(detail.procedures as AuditProcedure[]).map((paper) => (
                      <li
                        key={paper.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono font-medium">{paper.reference}</p>
                          {paper.description ? (
                            <p className="truncate text-muted-foreground">{paper.description}</p>
                          ) : null}
                          {paper.control_tested ? (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {t("internal_audit.procedures.control", "Control tested")}: {paper.control_tested}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0"
                          onClick={() => focusWorkingPapers(detail.id, paper.reference)}
                        >
                          {t("internal_audit.common.open", "Open")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}

              {(detail.findings ?? []).length > 0 ? (
                <Panel title={t("internal_audit.findings.register", "Findings")}>
                  <ul className="space-y-2">
                    {(detail.findings as AuditFinding[]).map((finding) => (
                      <li
                        key={finding.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-xs"
                      >
                        <span>
                          <span className="font-mono font-medium">{finding.finding_number}</span>
                          <span className="ml-2">{finding.title}</span>
                        </span>
                        <Button asChild size="sm" variant="ghost" className="h-7 shrink-0">
                          <Link href={`/dashboard/internal-audit/findings?id=${finding.id}`}>
                            {t("internal_audit.common.open", "Open")}
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}

              {canManageEngagements ? (
                <div className="flex flex-wrap gap-1 border-t border-border/40 pt-4">
                  {canManageProcedures && detail.is_open ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setTesting(detail);
                        setDetailId(null);
                      }}
                    >
                      {t("internal_audit.procedures.add", "Add paper")}
                    </Button>
                  ) : null}
                  {(NEXT_STATUSES[detail.status] ?? []).map((next) =>
                    next === "closed" ? (
                      <Button
                        key={next}
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => openCloseDialog(detail)}
                      >
                        {t("internal_audit.engagements.close", "Close")}
                      </Button>
                    ) : next === "cancelled" ? (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] text-destructive"
                        onClick={() => setCancelling(detail)}
                      >
                        {next}
                      </Button>
                    ) : (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] capitalize"
                        disabled={transitioningId === detail.id}
                        onClick={() => transition.mutate({ id: detail.id, next })}
                      >
                        {transitioningId === detail.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          next
                        )}
                      </Button>
                    ),
                  )}
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

      {/* Plan */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.engagements.plan", "Plan Engagement")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.engagements.plan_desc",
                  "The period under review is what the audit looks at; the planned dates are when the team does the looking.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.area", "Area")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={form.area_id || "none"}
                  onValueChange={(value) =>
                    setForm({ ...form, area_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("internal_audit.engagements.no_area", "Not against a single area")}
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.title_field", "Title")}</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.type", "Type")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm({ ...form, type: value as EngagementType })}
                >
                  <SelectTrigger className="capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((value) => (
                      <SelectItem key={value} value={value} className="capitalize">
                        {value.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.lead", "Lead auditor")}</Label>
              <Input
                value={form.lead_auditor_name}
                onChange={(event) => setForm({ ...form, lead_auditor_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.period_from", "Period from")}</Label>
              <Input
                type="date"
                value={form.period_from}
                onChange={(event) => setForm({ ...form, period_from: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.period_to", "Period to")}</Label>
              <Input
                type="date"
                min={form.period_from}
                value={form.period_to}
                onChange={(event) => setForm({ ...form, period_to: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.start", "Planned start")}</Label>
              <Input
                type="date"
                value={form.planned_start_on}
                onChange={(event) => setForm({ ...form, planned_start_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.end", "Planned end")}</Label>
              <Input
                type="date"
                min={form.planned_start_on}
                value={form.planned_end_on}
                onChange={(event) => setForm({ ...form, planned_end_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.planned_hours", "Planned hours")}</Label>
              <Input
                type="number"
                min={0}
                value={form.planned_hours}
                onChange={(event) => setForm({ ...form, planned_hours: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.engagements.objective", "Objective")}</Label>
              <Textarea
                rows={2}
                value={form.objective}
                onChange={(event) => setForm({ ...form, objective: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.engagements.scope", "Scope")}</Label>
              <Textarea
                rows={2}
                value={form.scope}
                onChange={(event) => setForm({ ...form, scope: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setPlanOpen(false)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => plan.mutate()} disabled={plan.isPending || !form.title.trim()}>
              {plan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close */}
      <Dialog open={closing !== null} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.engagements.close", "Close Engagement")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.engagements.close_desc",
                  "An opinion is the product of the audit, so it is required here. Closing also stamps the area as audited, which is what keeps the plan's 'overdue' honest.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.opinion", "Opinion")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={closeForm.opinion}
                  onValueChange={(value) => setCloseForm({ ...closeForm, opinion: value })}
                >
                  <SelectTrigger className="capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPINIONS.map((value) => (
                      <SelectItem key={value} value={value} className="capitalize">
                        {value.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.actual_hours", "Actual hours")}</Label>
              <Input
                type="number"
                min={0}
                value={closeForm.actual_hours}
                onChange={(event) => setCloseForm({ ...closeForm, actual_hours: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.engagements.conclusion", "Conclusion")}</Label>
              <Textarea
                rows={4}
                value={closeForm.conclusion}
                onChange={(event) => setCloseForm({ ...closeForm, conclusion: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setClosing(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => close.mutate()} disabled={close.isPending}>
              {close.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.engagements.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("internal_audit.engagements.cancel_title", "Cancel engagement?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "internal_audit.engagements.cancel_desc",
                "This engagement will be marked cancelled. Any working papers already recorded stay on file.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("internal_audit.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={transition.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (cancelling) {
                  transition.mutate({ id: cancelling.id, next: "cancelled" });
                }
              }}
            >
              {transition.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.common.confirm", "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Working paper */}
      <Dialog open={testing !== null} onOpenChange={(open) => !open && setTesting(null)}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.procedures.add", "Record working paper")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.procedures.add_desc",
                  "A test cannot find more exceptions than the sample it examined, and a sample cannot exceed its population — both are refused rather than explained away later.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("internal_audit.procedures.ref", "Reference")}</Label>
              <Input
                value={procedureForm.reference}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, reference: event.target.value })
                }
                placeholder="P-01"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.procedures.performed_by", "Performed by")}</Label>
              <Input
                value={procedureForm.performed_by_name}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, performed_by_name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.procedures.performed_on", "Performed on")}</Label>
              <Input
                type="date"
                value={procedureForm.performed_on}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, performed_on: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.procedures.conclusion", "Conclusion")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={procedureForm.conclusion}
                  onValueChange={(value) =>
                    setProcedureForm({ ...procedureForm, conclusion: value as ProcedureConclusion })
                  }
                >
                  <SelectTrigger className="capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONCLUSIONS.map((value) => (
                      <SelectItem key={value} value={value} className="capitalize">
                        {value.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.procedures.control", "Control tested")}</Label>
              <Input
                value={procedureForm.control_tested}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, control_tested: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.procedures.description", "What was done")}</Label>
              <Textarea
                rows={3}
                value={procedureForm.description}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, description: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.procedures.population", "Population")}</Label>
              <Input
                type="number"
                min={0}
                value={procedureForm.population_size}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, population_size: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.procedures.sample_size", "Sample")}</Label>
              <Input
                type="number"
                min={0}
                value={procedureForm.sample_size}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, sample_size: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.procedures.exceptions", "Exceptions")}</Label>
              <Input
                type="number"
                min={0}
                value={procedureForm.exceptions_found}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, exceptions_found: event.target.value })
                }
              />
            </div>
            <p className="self-end pb-2 text-xs text-muted-foreground">
              {Number(procedureForm.sample_size) > 0
                ? t("internal_audit.procedures.rate_preview", "Rate: {n}%").replace(
                    "{n}",
                    (
                      (Number(procedureForm.exceptions_found || 0) /
                        Number(procedureForm.sample_size)) *
                      100
                    ).toFixed(1),
                  )
                : t("internal_audit.procedures.not_tested", "not tested")}
            </p>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.procedures.notes", "Notes")}</Label>
              <Textarea
                rows={2}
                value={procedureForm.notes}
                onChange={(event) => setProcedureForm({ ...procedureForm, notes: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setTesting(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => addProcedure.mutate()}
              disabled={
                addProcedure.isPending ||
                !procedureForm.reference.trim() ||
                !procedureForm.description.trim()
              }
            >
              {addProcedure.isPending || addingProcedureId !== null ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
