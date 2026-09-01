"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Plus, RefreshCw, Repeat, X } from "lucide-react";
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
  AuditAction,
  AuditArea,
  AuditEngagement,
  AuditFinding,
  AuditProcedure,
  FindingStatus,
  OutstandingAction,
  Severity,
} from "@/modules/internal-audit/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const SEVERITIES: Severity[] = ["low", "moderate", "high", "critical"];
const ALL_STATUSES = Object.keys({
  open: [],
  in_progress: [],
  resolved: [],
  closed: [],
  accepted_risk: [],
}) as FindingStatus[];

const NEXT_STATUSES: Record<FindingStatus, FindingStatus[]> = {
  open: ["in_progress", "accepted_risk"],
  in_progress: ["resolved", "accepted_risk"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
  accepted_risk: ["in_progress"],
};

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  moderate: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  low: "bg-muted text-muted-foreground",
};

const STATUS_TONE: Record<FindingStatus, string> = {
  open: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
  accepted_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const DEFAULT_RAISE_FORM = {
  engagement_id: "",
  procedure_id: "",
  title: "",
  severity: "moderate",
  identified_on: "",
  condition: "",
  criteria: "",
  cause: "",
  effect: "",
  recommendation: "",
  financial_impact: "0",
  management_response: "",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dateOnly = (value: string | null | undefined) =>
  value ? String(value).slice(0, 10) : "—";

const isOutstandingAction = (status: string) =>
  status === "pending" || status === "in_progress";

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function AuditFindingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canManageFindings = hasAnyPermission(["manage_audit_findings", "manage_internal_audit"]);
  const canManageActions = hasAnyPermission(["manage_audit_actions", "manage_internal_audit"]);
  const canVerifyActions = hasAnyPermission(["verify_audit_actions", "manage_internal_audit"]);

  const [findingsTableQuery, setFindingsTableQuery] = React.useState({
    page: 1,
    pageSize: 10,
    search: "",
  });
  const [actionsTableQuery, setActionsTableQuery] = React.useState({
    page: 1,
    pageSize: 10,
    search: "",
  });

  const [statusFilter, setStatusFilter] = React.useState("all");
  const [severityFilter, setSeverityFilter] = React.useState("all");
  const [engagementFilter, setEngagementFilter] = React.useState(
    () => searchParams.get("engagement_id") ?? "all",
  );
  const [areaFilter, setAreaFilter] = React.useState(
    () => searchParams.get("area_id") ?? "all",
  );
  const [openOnly, setOpenOnly] = React.useState(false);
  const [repeatsOnly, setRepeatsOnly] = React.useState(false);
  const [severeOnly, setSevereOnly] = React.useState(false);

  const [actionStatusFilter, setActionStatusFilter] = React.useState("all");
  const [actionOutstandingOnly, setActionOutstandingOnly] = React.useState(true);
  const [actionFindingFilter, setActionFindingFilter] = React.useState(
    () => searchParams.get("finding_id") ?? "all",
  );

  const [detailId, setDetailId] = React.useState<number | null>(() => {
    const id = searchParams.get("id");
    return id ? Number(id) : null;
  });

  const [raiseOpen, setRaiseOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...DEFAULT_RAISE_FORM });

  const [agreeing, setAgreeing] = React.useState<AuditFinding | null>(null);
  const [actionForm, setActionForm] = React.useState({
    description: "",
    owner_name: "",
    due_on: "",
  });

  const [transitioning, setTransitioning] = React.useState<{
    finding: AuditFinding;
    next: FindingStatus;
  } | null>(null);
  const [transitionNote, setTransitionNote] = React.useState("");
  const [transitioningId, setTransitioningId] = React.useState<number | null>(null);

  const [completing, setCompleting] = React.useState<AuditAction | null>(null);
  const [completedOn, setCompletedOn] = React.useState("");
  const [completingId, setCompletingId] = React.useState<number | null>(null);

  const [verifying, setVerifying] = React.useState<AuditAction | null>(null);
  const [verifyForm, setVerifyForm] = React.useState({
    verified_by_name: "",
    verification_note: "",
  });

  const [cancelling, setCancelling] = React.useState<AuditAction | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancellingId, setCancellingId] = React.useState<number | null>(null);
  const actionsSectionRef = React.useRef<HTMLDivElement>(null);

  const findingsQuery = useQuery({
    queryKey: [
      "internal-audit",
      "findings",
      findingsTableQuery,
      statusFilter,
      severityFilter,
      engagementFilter,
      areaFilter,
      openOnly,
      repeatsOnly,
      severeOnly,
    ],
    queryFn: () =>
      internalAuditApi
        .listFindings({
          page: findingsTableQuery.page,
          limit: findingsTableQuery.pageSize,
          search: findingsTableQuery.search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          severity: severityFilter !== "all" ? severityFilter : undefined,
          engagement_id: engagementFilter !== "all" ? Number(engagementFilter) : undefined,
          area_id: areaFilter !== "all" ? Number(areaFilter) : undefined,
          ...(openOnly ? { open_only: 1 } : {}),
          ...(repeatsOnly ? { repeats_only: 1 } : {}),
          ...(severeOnly ? { severe_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const actionsQuery = useQuery({
    queryKey: [
      "internal-audit",
      "actions",
      actionsTableQuery,
      actionStatusFilter,
      actionOutstandingOnly,
      actionFindingFilter,
    ],
    queryFn: () =>
      internalAuditApi
        .listActions({
          page: actionsTableQuery.page,
          limit: actionsTableQuery.pageSize,
          search: actionsTableQuery.search || undefined,
          status: actionStatusFilter !== "all" ? actionStatusFilter : undefined,
          finding_id: actionFindingFilter !== "all" ? Number(actionFindingFilter) : undefined,
          ...(actionOutstandingOnly ? { outstanding_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const detailQuery = useQuery({
    queryKey: ["internal-audit", "finding", detailId],
    queryFn: () => internalAuditApi.getFinding(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const engagementsQuery = useQuery({
    queryKey: ["internal-audit", "engagement-options"],
    queryFn: () => internalAuditApi.listEngagements({ limit: 100 }).then((res) => res.data),
  });

  const openEngagementsQuery = useQuery({
    queryKey: ["internal-audit", "open-engagements"],
    queryFn: () =>
      internalAuditApi.listEngagements({ limit: 100, open_only: 1 }).then((res) => res.data),
  });

  const areasQuery = useQuery({
    queryKey: ["internal-audit", "area-options"],
    queryFn: () => internalAuditApi.listAreas({ limit: 100 }).then((res) => res.data),
  });

  const proceduresQuery = useQuery({
    queryKey: ["internal-audit", "raise-procedures", form.engagement_id],
    queryFn: () =>
      internalAuditApi
        .listProcedures({ engagement_id: Number(form.engagement_id), limit: 100 })
        .then((res) => res.data),
    enabled: Boolean(form.engagement_id),
  });

  const overviewQuery = useQuery({
    queryKey: ["internal-audit", "overview-findings"],
    queryFn: () => internalAuditApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["internal-audit"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const focusActionsSection = React.useCallback(
    (options?: { findingId?: number; outstandingOnly?: boolean; search?: string }) => {
      if (options?.findingId !== undefined) {
        setActionFindingFilter(String(options.findingId));
      }
      if (options?.outstandingOnly !== undefined) {
        setActionOutstandingOnly(options.outstandingOnly);
      }
      setActionsTableQuery((prev) => ({
        ...prev,
        page: 1,
        search: options?.search ?? (options?.findingId !== undefined ? "" : prev.search),
      }));
      setDetailId(null);
      window.setTimeout(() => {
        actionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    },
    [],
  );

  const openAgreeDialog = React.useCallback((finding: AuditFinding) => {
    setAgreeing(finding);
    setActionForm({
      description: finding.recommendation?.trim() ?? "",
      owner_name: "",
      due_on: "",
    });
  }, []);

  const raise = useMutation({
    mutationFn: () =>
      internalAuditApi.createFinding({
        engagement_id: Number(form.engagement_id),
        ...(form.procedure_id ? { procedure_id: Number(form.procedure_id) } : {}),
        title: form.title,
        severity: form.severity,
        ...(form.identified_on ? { identified_on: form.identified_on } : {}),
        condition: form.condition || null,
        criteria: form.criteria || null,
        cause: form.cause || null,
        effect: form.effect || null,
        recommendation: form.recommendation || null,
        financial_impact: Number(form.financial_impact || 0),
        management_response: form.management_response || null,
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("internal_audit.findings.raised", "Finding raised."));
      invalidate();
      setRaiseOpen(false);
      setForm({ ...DEFAULT_RAISE_FORM });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.findings.raise_failed", "Could not raise it."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, next, note }: { id: number; next: FindingStatus; note?: string }) => {
      setTransitioningId(id);
      return internalAuditApi.transitionFinding(id, next, note);
    },
    onSuccess: (_data, variables) => {
      toast.success(t("internal_audit.findings.moved", "Finding updated."));
      invalidate();
      setTransitioning(null);
      setTransitionNote("");
      if (detailId === variables.id) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.findings.move_failed", "Could not move it."))),
    onSettled: () => setTransitioningId(null),
  });

  const agreeAction = useMutation({
    mutationFn: () =>
      internalAuditApi.agreeAction(agreeing!.id, {
        description: actionForm.description,
        owner_name: actionForm.owner_name,
        due_on: actionForm.due_on,
      }),
    onSuccess: () => {
      const findingId = agreeing!.id;
      toast.success(t("internal_audit.findings.action_agreed", "Action agreed."));
      invalidate();
      setAgreeing(null);
      setActionForm({ description: "", owner_name: "", due_on: "" });
      if (detailId === findingId) detailQuery.refetch();
      focusActionsSection({ findingId, outstandingOnly: true });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.findings.action_failed", "Could not agree it."))),
  });

  const completeAction = useMutation({
    mutationFn: ({ id, completed_on }: { id: number; completed_on?: string }) => {
      setCompletingId(id);
      return internalAuditApi.completeAction(id, completed_on);
    },
    onSuccess: () => {
      const findingId = completing?.finding_id;
      toast.success(t("internal_audit.actions.completed", "Action recorded as complete."));
      invalidate();
      setCompleting(null);
      setCompletedOn("");
      setActionOutstandingOnly(true);
      if (detailId) detailQuery.refetch();
      if (findingId) {
        focusActionsSection({ findingId, outstandingOnly: true });
      }
    },
    onError: (error: any) => toast.error(errorText(error, "Could not complete it.")),
    onSettled: () => setCompletingId(null),
  });

  const verifyAction = useMutation({
    mutationFn: () =>
      internalAuditApi.verifyAction(verifying!.id, {
        verified_by_name: verifyForm.verified_by_name,
        verification_note: verifyForm.verification_note || null,
      }),
    onSuccess: () => {
      toast.success(t("internal_audit.actions.verified", "Verified."));
      invalidate();
      setVerifying(null);
      setVerifyForm({ verified_by_name: "", verification_note: "" });
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.actions.verify_failed", "Could not verify it."))),
  });

  const cancelActionMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => {
      setCancellingId(id);
      return internalAuditApi.cancelAction(id, reason);
    },
    onSuccess: () => {
      toast.success(t("internal_audit.actions.cancelled", "Action cancelled."));
      invalidate();
      setCancelling(null);
      setCancelReason("");
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.actions.cancel_failed", "Could not cancel it."))),
    onSettled: () => setCancellingId(null),
  });

  const handleFindingsTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setFindingsTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const handleActionsTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setActionsTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const startTransition = React.useCallback((finding: AuditFinding, next: FindingStatus) => {
    setTransitioning({ finding, next });
    setTransitionNote(finding.management_response ?? "");
  }, []);

  const confirmTransition = React.useCallback(() => {
    if (!transitioning) return;
    transition.mutate({
      id: transitioning.finding.id,
      next: transitioning.next,
      ...(transitionNote.trim() ? { note: transitionNote.trim() } : {}),
    });
  }, [transition, transitionNote, transitioning]);

  const findings = (findingsQuery.data?.data ?? []) as AuditFinding[];
  const actions = (actionsQuery.data?.data ?? []) as AuditAction[];
  const engagements = (engagementsQuery.data?.data ?? []) as AuditEngagement[];
  const openEngagements = (openEngagementsQuery.data?.data ?? []) as AuditEngagement[];
  const areas = (areasQuery.data?.data ?? []) as AuditArea[];
  const procedures = (proceduresQuery.data?.data ?? []) as AuditProcedure[];
  const summary = overviewQuery.data?.data;
  const outstanding = (summary?.outstanding ?? []) as OutstandingAction[];
  const detail = (detailQuery.data?.data ?? null) as AuditFinding | null;

  const filteredEngagement = engagements.find((row) => String(row.id) === engagementFilter);
  const filteredActionFinding =
    findings.find((row) => String(row.id) === actionFindingFilter) ??
    (detail && String(detail.id) === actionFindingFilter ? detail : null);

  const findingColumns = React.useMemo<ColumnDef<AuditFinding>[]>(
    () => [
      {
        id: "finding",
        header: t("internal_audit.findings.finding", "Finding"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left"
            onClick={() => setDetailId(row.original.id)}
          >
            <p className="flex items-center gap-1.5 font-medium hover:underline">
              {row.original.title}
              {row.original.is_repeat ? (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300"
                  title={t(
                    "internal_audit.findings.repeat_title",
                    "Repeats an earlier finding closed in this area",
                  )}
                >
                  <Repeat className="h-2.5 w-2.5" aria-hidden />
                  {t("internal_audit.findings.repeat", "Repeat")}
                </span>
              ) : null}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {row.original.finding_number}
              {row.original.engagement ? (
                <>
                  {" · "}
                  <Link
                    href={`/dashboard/internal-audit/findings?engagement_id=${row.original.engagement_id}`}
                    className="hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.original.engagement.engagement_number}
                  </Link>
                </>
              ) : null}
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
              href="/dashboard/internal-audit/universe"
              className="text-xs hover:underline"
            >
              {row.original.area.name}
            </Link>
          ) : (
            <span className="text-xs">—</span>
          ),
      },
      {
        accessorKey: "severity",
        header: t("internal_audit.common.severity", "Severity"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`border-transparent text-[10px] font-black uppercase tracking-widest ${SEVERITY_TONE[row.original.severity]}`}
          >
            {row.original.severity}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("internal_audit.common.status", "Status"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.original.status]}`}
          >
            {row.original.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        id: "actions_count",
        header: t("internal_audit.findings.actions_col", "Actions"),
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left text-xs tabular-nums hover:underline"
            onClick={() =>
              focusActionsSection({
                findingId: row.original.id,
                outstandingOnly: false,
              })
            }
          >
            {n(row.original.actions_count)}
            {n(row.original.outstanding_actions_count) > 0 ? (
              <span className="block text-[11px] font-semibold text-destructive">
                {t("internal_audit.findings.outstanding", "{n} outstanding").replace(
                  "{n}",
                  String(n(row.original.outstanding_actions_count)),
                )}
              </span>
            ) : null}
          </button>
        ),
      },
      {
        id: "age",
        header: t("internal_audit.findings.age", "Age"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.age_days !== null && row.original.age_days !== undefined
              ? t("internal_audit.findings.days", "{n} days").replace(
                  "{n}",
                  String(row.original.age_days),
                )
              : "—"}
          </span>
        ),
      },
      {
        id: "row_actions",
        header: "",
        cell: ({ row }) => {
          const busy = transitioningId === row.original.id;
          const nextStates = canManageFindings ? (NEXT_STATUSES[row.original.status] ?? []) : [];
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
              {canManageActions && row.original.status !== "closed" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => openAgreeDialog(row.original)}
                >
                  {t("internal_audit.findings.agree", "Agree action")}
                </Button>
              ) : null}
              {nextStates.map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] capitalize"
                  disabled={busy}
                  onClick={() => startTransition(row.original, next)}
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : next.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          );
        },
      },
    ],
    [canManageActions, canManageFindings, focusActionsSection, openAgreeDialog, startTransition, t, transitioningId],
  );

  const actionColumns = React.useMemo<ColumnDef<AuditAction>[]>(
    () => [
      {
        id: "action",
        header: t("internal_audit.actions.action", "Action"),
        cell: ({ row }) => (
          <div>
            <p className="text-sm">{row.original.description}</p>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:underline"
              onClick={() => setDetailId(row.original.finding_id)}
            >
              {row.original.finding?.finding_number ?? `#${row.original.finding_id}`}
            </button>
          </div>
        ),
      },
      {
        accessorKey: "owner_name",
        header: t("internal_audit.actions.owner", "Owner"),
        cell: ({ row }) => <span className="text-xs">{row.original.owner_name}</span>,
      },
      {
        id: "due",
        header: t("internal_audit.actions.due", "Due"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {dateOnly(row.original.due_on)}
            {row.original.is_overdue ? (
              <span className="block text-[11px] font-semibold text-destructive">
                {t("internal_audit.actions.overdue", "{n} days overdue").replace(
                  "{n}",
                  String(n(row.original.days_overdue)),
                )}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("internal_audit.common.status", "Status"),
        cell: ({ row }) => (
          <div>
            <Badge variant="outline" className="text-[11px] capitalize">
              {row.original.status.replace(/_/g, " ")}
            </Badge>
            {row.original.days_late !== null && row.original.days_late !== undefined ? (
              <span className="block text-[11px] text-muted-foreground">
                {row.original.days_late <= 0
                  ? t("internal_audit.actions.on_time", "on time")
                  : t("internal_audit.actions.late", "{n} days late").replace(
                      "{n}",
                      String(row.original.days_late),
                    )}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "verified",
        header: t("internal_audit.actions.verified", "Verified"),
        cell: ({ row }) =>
          row.original.is_verified ? (
            <div className="text-xs">
              <span className="text-emerald-600 dark:text-emerald-400">
                {t("internal_audit.actions.yes", "Yes")}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {row.original.verified_by_name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("internal_audit.actions.no", "Not yet")}
            </span>
          ),
      },
      {
        id: "action_row_actions",
        header: "",
        cell: ({ row }) => {
          const busyComplete = completingId === row.original.id;
          const busyCancel = cancellingId === row.original.id;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {canManageActions &&
              row.original.status !== "completed" &&
              row.original.status !== "cancelled" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={busyComplete}
                    onClick={() => {
                      setCompleting(row.original);
                      setCompletedOn(dateOnly(row.original.completed_on) === "—" ? "" : dateOnly(row.original.completed_on));
                    }}
                  >
                    {busyComplete ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      t("internal_audit.actions.complete", "Complete")
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] text-destructive"
                    disabled={busyCancel}
                    onClick={() => {
                      setCancelling(row.original);
                      setCancelReason("");
                    }}
                  >
                    {busyCancel ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      t("internal_audit.actions.cancel", "Cancel")
                    )}
                  </Button>
                </>
              ) : null}
              {canVerifyActions &&
              row.original.status === "completed" &&
              !row.original.is_verified ? (
                <Button
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setVerifying(row.original)}
                >
                  {t("internal_audit.actions.verify", "Verify")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canManageActions, canVerifyActions, cancellingId, completingId, t],
  );

  const renderFiveElement = (label: string, value: string | null | undefined) =>
    value ? (
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm whitespace-pre-wrap">{value}</p>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("internal_audit.findings.title", "Findings and Actions")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "internal_audit.findings.subtitle",
              "A finding cannot be closed while its agreed actions are still outstanding — closing over them would report remediation that never happened.",
            )}
          </p>
        </div>
        {canManageFindings ? (
          <Button className="rounded-full px-5" onClick={() => setRaiseOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("internal_audit.findings.raise", "Raise Finding")}
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
            label={t("internal_audit.findings.open", "Open findings")}
            value={n(summary.findings?.open).toLocaleString()}
            meta={t("internal_audit.findings.severe_meta", "{n} high or critical").replace(
              "{n}",
              String(n(summary.findings?.severe_open)),
            )}
            alert={n(summary.findings?.severe_open) > 0}
          />
          <StatTile
            label={t("internal_audit.overview.overdue", "Actions overdue")}
            value={n(summary.remediation?.overdue).toLocaleString()}
            alert={n(summary.remediation?.overdue) > 0}
          />
          <StatTile
            label={t("internal_audit.findings.awaiting", "Awaiting verification")}
            value={n(summary.remediation?.awaiting_verification).toLocaleString()}
            meta={t("internal_audit.findings.awaiting_meta", "done, but not yet checked")}
          />
          <StatTile
            label={t("internal_audit.overview.repeats", "Repeats")}
            value={n(summary.findings?.repeats).toLocaleString()}
            meta={t("internal_audit.findings.repeat_meta", "{n}% of all findings").replace(
              "{n}",
              n(summary.findings?.repeat_percent).toFixed(0),
            )}
            alert={n(summary.findings?.repeats) > 0}
          />
        </div>
      ) : overviewQuery.isLoading ? (
        <LoadingPanel label={t("internal_audit.common.loading", "Loading metrics...")} />
      ) : null}

      {outstanding.length > 0 ? (
        <Panel
          title={t("internal_audit.overview.outstanding", "What management still owes")}
          description={t(
            "internal_audit.overview.outstanding_desc",
            "Agreed actions ranked worst first — overdue before due, critical before low.",
          )}
        >
          <div className="space-y-1.5">
            {outstanding.slice(0, 8).map((row) => (
              <div
                key={row.action_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{row.description}</span>
                  <button
                    type="button"
                    className="block text-left text-[11px] text-muted-foreground hover:underline"
                    onClick={() => setDetailId(row.finding_id)}
                  >
                    {row.finding_number}
                    {row.finding_title ? ` · ${row.finding_title}` : ""} · {row.owner}
                  </button>
                </span>
                <div className="shrink-0 text-right">
                  <span
                    className={`block text-xs font-semibold ${
                      row.is_overdue ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {row.is_overdue
                      ? t("internal_audit.overview.days_overdue", "{n} days overdue").replace(
                          "{n}",
                          String(n(row.days_overdue)),
                        )
                      : t("internal_audit.overview.due", "due {d}").replace(
                          "{d}",
                          String(row.due_on ?? "—"),
                        )}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 text-[11px]"
                    onClick={() =>
                      focusActionsSection({
                        findingId: row.finding_id,
                        outstandingOnly: true,
                      })
                    }
                  >
                    {t("internal_audit.findings.filter_actions", "Filter actions")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {engagementFilter !== "all" && filteredEngagement ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-3 text-sm">
          <span>
            {t("internal_audit.findings.engagement_filter", "Showing findings for engagement")}{" "}
            <span className="font-semibold">
              {filteredEngagement.engagement_number} — {filteredEngagement.title}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setEngagementFilter("all")}
          >
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
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.common.severity", "Severity")}</Label>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-9 w-36 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {SEVERITIES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.findings.engagement", "Engagement")}</Label>
          <Select value={engagementFilter} onValueChange={setEngagementFilter}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {engagements.map((engagement) => (
                <SelectItem key={engagement.id} value={String(engagement.id)}>
                  {engagement.engagement_number}
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
          <Switch id="af-open" checked={openOnly} onCheckedChange={setOpenOnly} />
          <Label htmlFor="af-open" className="text-sm">
            {t("internal_audit.findings.open_only", "Open only")}
          </Label>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="af-repeats" checked={repeatsOnly} onCheckedChange={setRepeatsOnly} />
          <Label htmlFor="af-repeats" className="text-sm">
            {t("internal_audit.findings.repeats_only", "Repeats only")}
          </Label>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="af-severe" checked={severeOnly} onCheckedChange={setSevereOnly} />
          <Label htmlFor="af-severe" className="text-sm">
            {t("internal_audit.findings.severe_only", "High or critical only")}
          </Label>
        </div>
      </div>

      {findingsQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("internal_audit.findings.load_failed", "Could not load findings.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => findingsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("internal_audit.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={findingColumns}
          data={findings}
          totalEntries={findingsQuery.data?.meta?.total ?? 0}
          loading={findingsQuery.isLoading}
          pageIndex={findingsTableQuery.page}
          pageSize={findingsTableQuery.pageSize}
          onQueryChange={handleFindingsTableQueryChange}
          title={t("internal_audit.findings.register", "Findings")}
          description={t(
            "internal_audit.findings.register_desc",
            "A repeat is detected from an earlier closed finding in the same area, not ticked by whoever writes this one up.",
          )}
          searchPlaceholder={t("internal_audit.findings.search_hint", "Number or title")}
          resourceName="audit-findings"
        />
      )}

      <div ref={actionsSectionRef} className="scroll-mt-6 space-y-4">
      {actionFindingFilter !== "all" ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-3 text-sm">
          <span>
            {t("internal_audit.findings.actions_for", "Showing actions for finding")}{" "}
            <span className="font-semibold">
              {filteredActionFinding?.finding_number ?? `#${actionFindingFilter}`}
              {filteredActionFinding?.title ? ` — ${filteredActionFinding.title}` : ""}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setActionFindingFilter("all");
              setActionsTableQuery((prev) => ({ ...prev, page: 1, search: "" }));
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {t("internal_audit.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.common.status", "Status")}</Label>
          <Select value={actionStatusFilter} onValueChange={setActionStatusFilter}>
            <SelectTrigger className="h-9 w-40 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {["pending", "in_progress", "completed", "cancelled"].map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("internal_audit.findings.finding", "Finding")}</Label>
          <Select value={actionFindingFilter} onValueChange={setActionFindingFilter}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("internal_audit.common.any", "Any")}</SelectItem>
              {findings.map((finding) => (
                <SelectItem key={finding.id} value={String(finding.id)}>
                  {finding.finding_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch
            id="af-outstanding"
            checked={actionOutstandingOnly}
            onCheckedChange={setActionOutstandingOnly}
          />
          <Label htmlFor="af-outstanding" className="text-sm">
            {t("internal_audit.actions.outstanding_only", "Outstanding only")}
          </Label>
        </div>
        {actionFindingFilter !== "all" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              setActionFindingFilter("all");
              setActionsTableQuery((prev) => ({ ...prev, page: 1, search: "" }));
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {t("internal_audit.common.clear", "Clear finding filter")}
          </Button>
        ) : null}
      </div>

      {actionsQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("internal_audit.actions.load_failed", "Could not load actions.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => actionsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("internal_audit.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={actionColumns}
          data={actions}
          totalEntries={actionsQuery.data?.meta?.total ?? 0}
          loading={actionsQuery.isLoading}
          pageIndex={actionsTableQuery.page}
          pageSize={actionsTableQuery.pageSize}
          onQueryChange={handleActionsTableQueryChange}
          title={t("internal_audit.actions.title", "Agreed actions")}
          description={t(
            "internal_audit.actions.desc",
            "Verification is a separate act by audit: management completing its own action is not evidence the control now works.",
          )}
          searchPlaceholder={t(
            "internal_audit.actions.search_hint",
            "Description, owner or finding number",
          )}
          resourceName="audit-actions"
        />
      )}
      </div>

      {/* Raise finding */}
      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.findings.raise", "Raise Finding")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.findings.raise_desc",
                  "Splitting condition, criteria, cause and effect is what stops a finding collapsing into a paragraph nobody can act on. If this repeats one already closed in the same area, it will be flagged automatically.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.engagement", "Engagement")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={form.engagement_id || "none"}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      engagement_id: value === "none" ? "" : value,
                      procedure_id: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("internal_audit.common.select", "Select...")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("internal_audit.common.select", "Select...")}</SelectItem>
                    {openEngagements.map((engagement) => (
                      <SelectItem key={engagement.id} value={String(engagement.id)}>
                        {engagement.engagement_number} — {engagement.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.engagement_id ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("internal_audit.findings.procedure", "Procedure (optional)")}</Label>
                <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                  <Select
                    value={form.procedure_id || "none"}
                    onValueChange={(value) =>
                      setForm({ ...form, procedure_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("internal_audit.findings.no_procedure", "Not tied to one paper")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t("internal_audit.findings.no_procedure", "Not tied to one paper")}
                      </SelectItem>
                      {procedures.map((procedure) => (
                        <SelectItem key={procedure.id} value={String(procedure.id)}>
                          {procedure.reference} — {procedure.description.slice(0, 60)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.title_field", "Title")}</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={t(
                  "internal_audit.findings.title_hint",
                  "Purchase orders raised after the invoice date",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.common.severity", "Severity")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={form.severity}
                  onValueChange={(value) => setForm({ ...form, severity: value })}
                >
                  <SelectTrigger className="capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((value) => (
                      <SelectItem key={value} value={value} className="capitalize">
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.findings.identified_on", "Identified on")}</Label>
              <Input
                type="date"
                value={form.identified_on}
                onChange={(event) => setForm({ ...form, identified_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.findings.impact", "Financial impact")}</Label>
              <Input
                type="number"
                min={0}
                value={form.financial_impact}
                onChange={(event) => setForm({ ...form, financial_impact: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.condition", "Condition — what is")}</Label>
              <Textarea
                rows={2}
                value={form.condition}
                onChange={(event) => setForm({ ...form, condition: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.criteria", "Criteria — what should be")}</Label>
              <Textarea
                rows={2}
                value={form.criteria}
                onChange={(event) => setForm({ ...form, criteria: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.cause", "Cause — why the gap exists")}</Label>
              <Textarea
                rows={2}
                value={form.cause}
                onChange={(event) => setForm({ ...form, cause: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.effect", "Effect — what it costs")}</Label>
              <Textarea
                rows={2}
                value={form.effect}
                onChange={(event) => setForm({ ...form, effect: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.recommendation", "Recommendation")}</Label>
              <Textarea
                rows={2}
                value={form.recommendation}
                onChange={(event) => setForm({ ...form, recommendation: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("internal_audit.findings.mgmt_response", "Management response (optional)")}</Label>
              <Textarea
                rows={2}
                value={form.management_response}
                onChange={(event) => setForm({ ...form, management_response: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRaiseOpen(false)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => raise.mutate()}
              disabled={raise.isPending || !form.engagement_id || !form.title.trim()}
            >
              {raise.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.title ?? t("internal_audit.findings.finding", "Finding")}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {detail?.finding_number ?? "—"}
              </DialogDescription>
            </DialogHeader>
          </div>
          {detailQuery.isLoading ? (
            <LoadingPanel label={t("internal_audit.common.loading", "Loading finding...")} />
          ) : detailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("internal_audit.findings.detail_failed", "Could not load this finding.")}
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
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${SEVERITY_TONE[detail.severity]}`}
                >
                  {detail.severity}
                </Badge>
                <Badge
                  variant="outline"
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[detail.status]}`}
                >
                  {detail.status.replace(/_/g, " ")}
                </Badge>
                {detail.is_repeat ? (
                  <Badge variant="outline" className="border-transparent bg-rose-500/15 text-rose-700">
                    {t("internal_audit.findings.repeat", "Repeat")}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.findings.engagement", "Engagement")}
                  </p>
                  {detail.engagement ? (
                    <Link
                      href={`/dashboard/internal-audit/findings?engagement_id=${detail.engagement_id}`}
                      className="hover:underline"
                    >
                      {detail.engagement.engagement_number} — {detail.engagement.title}
                    </Link>
                  ) : (
                    "—"
                  )}
                </div>
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
                    {t("internal_audit.findings.identified_on", "Identified on")}
                  </p>
                  {dateOnly(detail.identified_on)}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.findings.impact", "Financial impact")}
                  </p>
                  {money(detail.financial_impact)}
                </div>
              </div>

              {detail.repeat_of ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                  {t("internal_audit.findings.repeat_of", "Repeats")}{" "}
                  <button
                    type="button"
                    className="font-semibold hover:underline"
                    onClick={() => setDetailId(detail.repeat_of!.id)}
                  >
                    {detail.repeat_of.finding_number} — {detail.repeat_of.title}
                  </button>
                </div>
              ) : null}

              {detail.procedure ? (
                <div className="text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("internal_audit.findings.procedure", "Procedure")}
                  </p>
                  {detail.procedure.reference} — {detail.procedure.description}
                </div>
              ) : null}

              {renderFiveElement(
                t("internal_audit.findings.condition", "Condition — what is"),
                detail.condition,
              )}
              {renderFiveElement(
                t("internal_audit.findings.criteria", "Criteria — what should be"),
                detail.criteria,
              )}
              {renderFiveElement(
                t("internal_audit.findings.cause", "Cause — why the gap exists"),
                detail.cause,
              )}
              {renderFiveElement(
                t("internal_audit.findings.effect", "Effect — what it costs"),
                detail.effect,
              )}
              {renderFiveElement(
                t("internal_audit.findings.recommendation", "Recommendation"),
                detail.recommendation,
              )}
              {renderFiveElement(
                t("internal_audit.findings.mgmt_response", "Management response"),
                detail.management_response,
              )}

              {(() => {
                const allActions = detail.actions ?? [];
                const outstandingActions = allActions.filter((action) =>
                  isOutstandingAction(action.status),
                );
                const closedActions = allActions.filter(
                  (action) => !isOutstandingAction(action.status),
                );

                return (
                  <>
                    {outstandingActions.length > 0 ? (
                      <Panel title={t("internal_audit.actions.outstanding_title", "Outstanding actions")}>
                        <ul className="space-y-2">
                          {outstandingActions.map((action) => (
                            <li
                              key={action.id}
                              className="flex items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                            >
                              <div>
                                <p>{action.description}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {action.owner_name} · {t("internal_audit.actions.due", "Due")}{" "}
                                  {dateOnly(action.due_on)} · {action.status.replace(/_/g, " ")}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 shrink-0 text-[11px]"
                                onClick={() =>
                                  focusActionsSection({
                                    findingId: detail.id,
                                    outstandingOnly: true,
                                    search: action.description,
                                  })
                                }
                              >
                                {t("internal_audit.common.open", "Open")}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    ) : null}

                    {closedActions.length > 0 ? (
                      <Panel
                        title={t(
                          "internal_audit.actions.completed_title",
                          "Completed or cancelled",
                        )}
                      >
                        <ul className="space-y-2">
                          {closedActions.map((action) => (
                            <li
                              key={action.id}
                              className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm"
                            >
                              <div>
                                <p>{action.description}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {action.owner_name} · {t("internal_audit.actions.due", "Due")}{" "}
                                  {dateOnly(action.due_on)} · {action.status.replace(/_/g, " ")}
                                  {action.completed_on
                                    ? ` · ${t("internal_audit.actions.done_on", "Done")} ${dateOnly(action.completed_on)}`
                                    : ""}
                                  {action.is_verified
                                    ? ` · ${t("internal_audit.actions.verified", "Verified")}`
                                    : ""}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 shrink-0 text-[11px]"
                                onClick={() =>
                                  focusActionsSection({
                                    findingId: detail.id,
                                    outstandingOnly: false,
                                    search: action.description,
                                  })
                                }
                              >
                                {t("internal_audit.actions.view", "View")}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    ) : null}
                  </>
                );
              })()}

              {canManageFindings ? (
                <div className="flex flex-wrap gap-1 border-t border-border/40 pt-4">
                  {canManageActions && detail.status !== "closed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        openAgreeDialog(detail);
                        setDetailId(null);
                      }}
                    >
                      {t("internal_audit.findings.agree", "Agree action")}
                    </Button>
                  ) : null}
                  {(NEXT_STATUSES[detail.status] ?? []).map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] capitalize"
                      disabled={transitioningId === detail.id}
                      onClick={() => startTransition(detail, next)}
                    >
                      {transitioningId === detail.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        next.replace(/_/g, " ")
                      )}
                    </Button>
                  ))}
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

      {/* Transition */}
      <Dialog open={transitioning !== null} onOpenChange={(open) => !open && setTransitioning(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight capitalize">
                {transitioning?.next.replace(/_/g, " ")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.findings.transition_desc",
                  "Optionally record management's response — this is stored on the finding.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label>{t("internal_audit.findings.mgmt_response", "Management response")}</Label>
              <Textarea
                rows={4}
                value={transitionNote}
                onChange={(event) => setTransitionNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setTransitioning(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button onClick={confirmTransition} disabled={transition.isPending}>
              {transition.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.common.confirm", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agree action */}
      <Dialog
        open={agreeing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAgreeing(null);
            setActionForm({ description: "", owner_name: "", due_on: "" });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.findings.agree", "Agree action")}
              </DialogTitle>
              <DialogDescription>
                {agreeing
                  ? `${agreeing.finding_number} — ${agreeing.title}`
                  : t(
                      "internal_audit.findings.agree_desc",
                      "The action belongs to management, not to audit. Naming an owner and a date is the difference between an agreed action and a suggestion.",
                    )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5">
            {agreeing && n(agreeing.outstanding_actions_count) > 0 ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                {t(
                  "internal_audit.findings.existing_actions",
                  "This finding already has {n} outstanding action(s). Add another only if management agreed to more than one fix.",
                ).replace("{n}", String(n(agreeing.outstanding_actions_count)))}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label>{t("internal_audit.actions.description", "What will be done")}</Label>
              <Textarea
                rows={3}
                value={actionForm.description}
                onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("internal_audit.actions.owner", "Owner")}</Label>
                <Input
                  value={actionForm.owner_name}
                  onChange={(event) =>
                    setActionForm({ ...actionForm, owner_name: event.target.value })
                  }
                  placeholder={t("internal_audit.actions.owner_hint", "Procurement Manager")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("internal_audit.actions.due", "Due")}</Label>
                <Input
                  type="date"
                  value={actionForm.due_on}
                  onChange={(event) => setActionForm({ ...actionForm, due_on: event.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAgreeing(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => agreeAction.mutate()}
              disabled={
                agreeAction.isPending ||
                !actionForm.description.trim() ||
                !actionForm.owner_name.trim() ||
                !actionForm.due_on
              }
            >
              {agreeAction.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete action */}
      <Dialog open={completing !== null} onOpenChange={(open) => !open && setCompleting(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.actions.complete", "Complete")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.actions.complete_desc",
                  "Record when management actually finished — defaults to today if left blank.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label>{t("internal_audit.actions.completed_on", "Completed on")}</Label>
              <Input
                type="date"
                value={completedOn}
                onChange={(event) => setCompletedOn(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCompleting(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() =>
                completing &&
                completeAction.mutate({
                  id: completing.id,
                  ...(completedOn ? { completed_on: completedOn } : {}),
                })
              }
              disabled={completeAction.isPending}
            >
              {completeAction.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.common.confirm", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify */}
      <Dialog open={verifying !== null} onOpenChange={(open) => !open && setVerifying(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.actions.verify", "Verify")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.actions.verify_desc",
                  "Record who re-tested the control and what they found. This is audit's own act, which is why it is separate from management marking the action complete.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label>{t("internal_audit.actions.verified_by", "Verified by")}</Label>
              <Input
                value={verifyForm.verified_by_name}
                onChange={(event) =>
                  setVerifyForm({ ...verifyForm, verified_by_name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("internal_audit.actions.note", "What was re-tested")}</Label>
              <Textarea
                rows={4}
                value={verifyForm.verification_note}
                onChange={(event) =>
                  setVerifyForm({ ...verifyForm, verification_note: event.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setVerifying(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => verifyAction.mutate()}
              disabled={verifyAction.isPending || !verifyForm.verified_by_name.trim()}
            >
              {verifyAction.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("internal_audit.actions.verify", "Verify")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel action */}
      <AlertDialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("internal_audit.actions.cancel", "Cancel action")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "internal_audit.actions.cancel_desc",
                "Explain why this agreed action is no longer required. The reason is kept on record.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              rows={3}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder={t("internal_audit.actions.cancel_reason", "Superseded by process change...")}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("internal_audit.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!cancelReason.trim() || cancelActionMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (cancelling) {
                  cancelActionMutation.mutate({ id: cancelling.id, reason: cancelReason.trim() });
                }
              }}
            >
              {cancelActionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("internal_audit.common.confirm", "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
