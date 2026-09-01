"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, Loader2, Plus, RefreshCw } from "lucide-react";
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
import { serviceApi } from "@/modules/service/api";
import type {
  AvailableTechnician,
  Coverage,
  ServiceAsset,
  ServiceRequest,
  ServiceTechnician,
  ServiceWorkOrder,
  ServiceWorkOrderPart,
  WorkOrderStatus,
  WorkOrderType,
} from "@/modules/service/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const TYPES: WorkOrderType[] = ["corrective", "preventive", "installation", "inspection"];
const COVERAGES: Coverage[] = ["warranty", "contract", "chargeable"];
const ALL_STATUSES: WorkOrderStatus[] = [
  "scheduled",
  "dispatched",
  "in_progress",
  "completed",
  "cancelled",
];

/** Mirrors ServiceWorkOrder::TRANSITIONS — complete uses a separate endpoint. */
const NEXT_STATUSES: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  scheduled: ["dispatched", "in_progress", "cancelled"],
  dispatched: ["in_progress", "cancelled"],
  in_progress: ["cancelled"],
  completed: [],
  cancelled: [],
};

const STATUS_TONE: Record<WorkOrderStatus, string> = {
  scheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  dispatched: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

const COVERAGE_TONE: Record<Coverage, string> = {
  warranty: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  contract: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  chargeable: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const DEFAULT_RAISE = {
  request_id: "",
  asset_id: "",
  technician_id: "",
  type: "corrective" as WorkOrderType,
  scheduled_for: "",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const whenever = (value: string | null | undefined) =>
  value ? String(value).replace("T", " ").slice(0, 16) : "—";

export default function ServiceWorkOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_service_work_orders", "manage_service"]);
  const canComplete = hasAnyPermission([
    "complete_service_work",
    "manage_service_work_orders",
    "manage_service",
  ]);

  const initialRequestId = searchParams.get("request_id") ?? "";
  const initialTechnicianId = searchParams.get("technician_id") ?? "";

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [coverageFilter, setCoverageFilter] = React.useState("all");
  const [assetFilter, setAssetFilter] = React.useState("all");
  const [technicianFilter, setTechnicianFilter] = React.useState(initialTechnicianId || "all");
  const [requestFilter, setRequestFilter] = React.useState(initialRequestId);
  const [openOnly, setOpenOnly] = React.useState(false);

  const [raiseOpen, setRaiseOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    ...DEFAULT_RAISE,
    request_id: initialRequestId,
  });

  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [completing, setCompleting] = React.useState<ServiceWorkOrder | null>(null);
  const [parting, setParting] = React.useState<ServiceWorkOrder | null>(null);
  const [transitioningId, setTransitioningId] = React.useState<number | null>(null);

  const [completion, setCompletion] = React.useState({
    labour_hours: "1",
    resolved_the_fault: "yes",
    work_performed: "",
  });

  const [part, setPart] = React.useState({ description: "", quantity: "1", unit_cost: "0" });
  const [assignTechnicianId, setAssignTechnicianId] = React.useState("");

  const ordersQuery = useQuery({
    queryKey: [
      "service",
      "work-orders",
      tableQuery,
      statusFilter,
      typeFilter,
      coverageFilter,
      assetFilter,
      technicianFilter,
      requestFilter,
      openOnly,
    ],
    queryFn: () =>
      serviceApi
        .listWorkOrders({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          type: typeFilter !== "all" ? typeFilter : undefined,
          coverage: coverageFilter !== "all" ? coverageFilter : undefined,
          asset_id: assetFilter !== "all" ? Number(assetFilter) : undefined,
          technician_id: technicianFilter !== "all" ? Number(technicianFilter) : undefined,
          request_id: requestFilter ? Number(requestFilter) : undefined,
          ...(openOnly ? { open_only: 1 } : {}),
        })
        .then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["service", "overview-work"],
    queryFn: () => serviceApi.overview().then((res) => res.data),
  });

  const techniciansQuery = useQuery({
    queryKey: ["service", "available-technicians"],
    queryFn: () => serviceApi.availableTechnicians().then((res) => res.data),
  });

  const allTechniciansQuery = useQuery({
    queryKey: ["service", "technicians-filter"],
    queryFn: () => serviceApi.listTechnicians({ limit: 100 }).then((res) => res.data),
  });

  const assetsQuery = useQuery({
    queryKey: ["service", "asset-options"],
    queryFn: () => serviceApi.listAssets({ limit: 200 }).then((res) => res.data),
  });

  const openRequestsQuery = useQuery({
    queryKey: ["service", "open-requests"],
    queryFn: () => serviceApi.listRequests({ limit: 100, open_only: 1 }).then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["service", "work-order", detailId],
    queryFn: () => serviceApi.getWorkOrder(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["service"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const raise = useMutation({
    mutationFn: () =>
      serviceApi.createWorkOrder({
        ...(form.request_id ? { request_id: Number(form.request_id) } : {}),
        ...(form.asset_id ? { asset_id: Number(form.asset_id) } : {}),
        ...(form.technician_id ? { technician_id: Number(form.technician_id) } : {}),
        type: form.type,
        ...(form.scheduled_for ? { scheduled_for: form.scheduled_for } : {}),
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("service.work.raised", "Work order raised."));
      invalidate();
      setRaiseOpen(false);
      setForm({ ...DEFAULT_RAISE });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.raise_failed", "Could not raise it."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, next }: { id: number; next: WorkOrderStatus }) => {
      setTransitioningId(id);
      return serviceApi.transitionWorkOrder(id, next);
    },
    onSuccess: () => {
      toast.success(t("service.work.moved", "Work order updated."));
      invalidate();
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.move_failed", "Could not move it."))),
    onSettled: () => setTransitioningId(null),
  });

  const complete = useMutation({
    mutationFn: () =>
      serviceApi.completeWorkOrder(completing!.id, {
        labour_hours: Number(completion.labour_hours || 0),
        resolved_the_fault: completion.resolved_the_fault === "yes",
        work_performed: completion.work_performed.trim() || null,
      }),
    onSuccess: () => {
      toast.success(t("service.work.completed", "Visit completed and costed."));
      invalidate();
      setCompleting(null);
      setCompletion({ labour_hours: "1", resolved_the_fault: "yes", work_performed: "" });
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.complete_failed", "Could not complete it."))),
  });

  const assignTechnician = useMutation({
    mutationFn: ({ id, technician_id }: { id: number; technician_id: number | null }) =>
      serviceApi.updateWorkOrder(id, { technician_id }),
    onSuccess: () => {
      toast.success(t("service.work.engineer_assigned", "Engineer assigned."));
      invalidate();
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.assign_failed", "Could not assign the engineer."))),
  });

  const addPart = useMutation({
    mutationFn: () =>
      serviceApi.addParts(parting!.id, [
        {
          description: part.description.trim(),
          quantity: Number(part.quantity || 1),
          unit_cost: Number(part.unit_cost || 0),
        },
      ]),
    onSuccess: () => {
      toast.success(t("service.work.part_added", "Part added and the job recosted."));
      invalidate();
      setParting(null);
      setPart({ description: "", quantity: "1", unit_cost: "0" });
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.part_failed", "Could not add it."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const orders = (ordersQuery.data?.data ?? []) as ServiceWorkOrder[];
  const summary = overviewQuery.data?.data?.work;
  const technicians = (techniciansQuery.data?.data ?? []) as AvailableTechnician[];
  const allTechnicians = (allTechniciansQuery.data?.data ?? []) as ServiceTechnician[];
  const assets = (assetsQuery.data?.data ?? []) as ServiceAsset[];
  const openRequests = (openRequestsQuery.data?.data ?? []) as ServiceRequest[];
  const detail = (detailQuery.data?.data ?? null) as ServiceWorkOrder | null;

  const formatTechOption = React.useCallback((tech: AvailableTechnician | ServiceTechnician) => {
    const openJobs = "open_jobs" in tech ? tech.open_jobs : n(tech.work_orders_count);
    return `${tech.name} · ${money(tech.hourly_rate)}/hr · ${openJobs} open`;
  }, []);

  const completionLabourPreview = React.useMemo(() => {
    if (!completing) return null;
    const rate = n(completing.technician?.hourly_rate);
    const hours = n(completion.labour_hours);
    return {
      rate,
      hours,
      total: rate * hours,
      hasEngineer: completing.technician_id != null,
    };
  }, [completing, completion.labour_hours]);

  React.useEffect(() => {
    if (detail) {
      setAssignTechnicianId(detail.technician_id ? String(detail.technician_id) : "");
    }
  }, [detail?.id, detail?.technician_id]);

  const openRaise = React.useCallback(() => {
    setForm({
      ...DEFAULT_RAISE,
      request_id: requestFilter || "",
    });
    setRaiseOpen(true);
  }, [requestFilter]);

  const columns = React.useMemo<ColumnDef<ServiceWorkOrder>[]>(
    () => [
      {
        id: "order",
        header: t("service.work.number", "Work order"),
        cell: ({ row }) => (
          <button type="button" className="space-y-0.5 text-left" onClick={() => setDetailId(row.original.id)}>
            <p className="font-bold tabular-nums hover:underline">{row.original.work_order_number}</p>
            <p className="text-[11px] capitalize text-muted-foreground">
              {row.original.type}
              {row.original.scheduled_for ? ` · ${whenever(row.original.scheduled_for)}` : ""}
            </p>
          </button>
        ),
      },
      {
        id: "request",
        header: t("service.work.against", "Request"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.request?.request_number ?? (row.original.request_id ? `#${row.original.request_id}` : "—")}
          </span>
        ),
      },
      {
        id: "asset",
        header: t("service.requests.asset", "Asset"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.asset?.name ?? (row.original.asset_id ? `#${row.original.asset_id}` : "—")}
          </span>
        ),
      },
      {
        id: "technician",
        header: t("service.work.technician", "Engineer"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.technician?.name ?? t("service.work.unassigned", "Unassigned")}
          </span>
        ),
      },
      {
        accessorKey: "coverage",
        header: t("service.work.coverage", "Coverage"),
        cell: ({ row }) => (
          <div>
            <Badge
              variant="outline"
              className={`border-transparent text-[10px] font-black uppercase tracking-widest ${COVERAGE_TONE[row.original.coverage]}`}
            >
              {row.original.coverage}
            </Badge>
            <span className="ml-1.5 text-[11px] text-muted-foreground">
              {row.original.is_billable
                ? t("service.work.billable", "billable")
                : t("service.work.absorbed", "absorbed")}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("service.common.status", "Status"),
        cell: ({ row }) => (
          <div>
            <Badge
              variant="outline"
              className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.original.status]}`}
            >
              {row.original.status.replace(/_/g, " ")}
            </Badge>
            {row.original.is_overdue ? (
              <span className="mt-0.5 block text-[11px] font-semibold text-destructive">
                {t("service.work.overdue", "Overdue")}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "total",
        header: t("service.common.total", "Total"),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            <p className="font-semibold">{money(row.original.total_cost)}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("service.work.split", "{labour} labour · {parts} parts")
                .replace("{labour}", money(row.original.labour_cost))
                .replace("{parts}", money(row.original.parts_cost))}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const nextStates = canManage ? (NEXT_STATUSES[row.original.status] ?? []) : [];
          const busy = transitioningId === row.original.id;
          const open = row.original.status !== "completed" && row.original.status !== "cancelled";
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setDetailId(row.original.id)}
                aria-label={t("service.common.open", "Open")}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {nextStates.map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] capitalize"
                  disabled={busy}
                  onClick={() => transition.mutate({ id: row.original.id, next })}
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : next.replace(/_/g, " ")}
                </Button>
              ))}
              {canManage && open ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => setParting(row.original)}
                >
                  {t("service.work.add_part", "Add part")}
                </Button>
              ) : null}
              {canComplete && row.original.status === "in_progress" ? (
                <Button
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setCompleting(row.original)}
                >
                  {t("service.work.complete", "Complete")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canComplete, canManage, t, transition, transitioningId],
  );

  const renderRaiseForm = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("service.work.against", "Against request")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.request_id || "none"}
            onValueChange={(v) => setForm({ ...form, request_id: v === "none" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("service.work.no_request", "Planned work, no fault reported")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("service.work.no_request", "Planned work, no fault reported")}</SelectItem>
              {openRequests.map((request) => (
                <SelectItem key={request.id} value={String(request.id)}>
                  {request.request_number} — {request.subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("service.requests.asset", "Asset")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.asset_id || "none"}
            onValueChange={(v) => setForm({ ...form, asset_id: v === "none" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("service.work.from_request", "Take it from the request")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("service.work.from_request", "Take it from the request")}</SelectItem>
              {assets.map((asset) => (
                <SelectItem key={asset.id} value={String(asset.id)}>
                  {asset.name} — {asset.customer_name ?? asset.asset_tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("service.work.technician", "Engineer")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.technician_id || "none"}
            onValueChange={(v) => setForm({ ...form, technician_id: v === "none" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("service.work.unassigned", "Unassigned")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("service.work.unassigned", "Unassigned")}</SelectItem>
              {technicians.map((tech) => (
                <SelectItem key={tech.technician_id} value={String(tech.technician_id)}>
                  {formatTechOption(tech)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {technicians.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {t("service.engineers.none_hint", "No engineers yet.")}{" "}
              <Link href="/dashboard/service/engineers" className="font-medium text-primary underline">
                {t("service.engineers.add", "Add engineer")}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("service.work.type", "Type")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.type}
            onValueChange={(v) => setForm({ ...form, type: v as WorkOrderType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="w-when">{t("service.work.scheduled", "Scheduled for")}</Label>
        <Input
          id="w-when"
          type="datetime-local"
          value={form.scheduled_for}
          onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("service.work.title", "Work Orders")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "service.work.subtitle",
              "The visits that actually fix things. Who pays is decided from warranty and contract when the job is raised, not argued about at invoicing time.",
            )}
          </p>
        </div>
        {canManage ? (
          <Button className="rounded-full px-5" onClick={openRaise}>
            <Plus className="mr-2 h-4 w-4" />
            {t("service.work.raise", "Raise Work Order")}
          </Button>
        ) : null}
      </div>

      {overviewQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("service.work.open", "Open")}
            value={n(summary.open).toLocaleString()}
            meta={t("service.work.overdue_meta", "{n} past their slot").replace(
              "{n}",
              String(n(summary.overdue)),
            )}
            alert={n(summary.overdue) > 0}
          />
          <StatTile
            label={t("service.work.first_time_fix", "First-time fix")}
            value={`${n(summary.first_time_fix_percent).toFixed(1)}%`}
            meta={t("service.work.completed_meta", "{n} completed").replace(
              "{n}",
              String(n(summary.completed)),
            )}
          />
          <StatTile
            label={t("service.overview.billable", "Billable")}
            value={money(summary.billable_cost)}
          />
          <StatTile
            label={t("service.overview.absorbed", "Absorbed")}
            value={money(summary.absorbed_cost)}
          />
        </div>
      ) : overviewQuery.isError ? (
        <EmptyPanel label={t("service.work.summary_failed", "Could not load work metrics.")} />
      ) : null}

      {requestFilter ? (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>
            {t("service.work.filtered_request", "Filtered to request")} #{requestFilter}
          </span>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setRequestFilter("")}>
            {t("service.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      {technicianFilter !== "all" ? (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>
            {t("service.work.filtered_engineer", "Filtered to engineer")}{" "}
            {allTechnicians.find((tech) => String(tech.id) === technicianFilter)?.name ??
              `#${technicianFilter}`}
          </span>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setTechnicianFilter("all")}>
            {t("service.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("service.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {ALL_STATUSES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("service.work.type", "Type")}</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {TYPES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("service.work.coverage", "Coverage")}</Label>
          <Select value={coverageFilter} onValueChange={setCoverageFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {COVERAGES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("service.requests.asset", "Asset")}</Label>
          <Select value={assetFilter} onValueChange={setAssetFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {assets.map((asset) => (
                <SelectItem key={asset.id} value={String(asset.id)}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("service.work.technician", "Engineer")}</Label>
          <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {allTechnicians.map((tech) => (
                <SelectItem key={tech.id} value={String(tech.id)}>
                  {formatTechOption(tech)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="wo-open" checked={openOnly} onCheckedChange={setOpenOnly} />
          <Label htmlFor="wo-open" className="text-sm">
            {t("service.requests.open_only", "Open only")}
          </Label>
        </div>
      </div>

      {ordersQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("service.work.load_failed", "Could not load work orders.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => ordersQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("service.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          totalEntries={ordersQuery.data?.meta?.total ?? 0}
          loading={ordersQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("service.work.search_hint", "Number, asset or request...")}
          resourceName="service-work-orders"
        />
      )}

      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.work.raise", "Raise Work Order")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.work.raise_desc",
                  "Engineers are listed least loaded first. Coverage is taken from the asset — warranty before contract, because a manufacturer claim should not be billed against an agreement the customer also paid for.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{renderRaiseForm()}</div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRaiseOpen(false)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => raise.mutate()}
              disabled={raise.isPending || (!form.request_id && !form.asset_id)}
            >
              {raise.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completing !== null} onOpenChange={(open) => !open && setCompleting(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.work.complete_title", "Complete Visit")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.work.complete_desc",
                  "Whether the visit actually cleared the fault is what first-time-fix rate is built from, so answer it honestly — a return visit is the alternative.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-hours">{t("service.work.labour_hours", "Labour hours")}</Label>
              <Input
                id="c-hours"
                type="number"
                min={0}
                step="0.25"
                value={completion.labour_hours}
                onChange={(event) =>
                  setCompletion({ ...completion, labour_hours: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("service.work.fixed", "Fault cleared?")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={completion.resolved_the_fault}
                  onValueChange={(v) => setCompletion({ ...completion, resolved_the_fault: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">{t("service.work.fixed_yes", "Yes, fixed")}</SelectItem>
                    <SelectItem value="no">{t("service.work.fixed_no", "No, return visit needed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-notes">{t("service.work.notes", "What was done")}</Label>
              <Textarea
                id="c-notes"
                rows={3}
                value={completion.work_performed}
                onChange={(event) =>
                  setCompletion({ ...completion, work_performed: event.target.value })
                }
              />
            </div>
            {completionLabourPreview ? (
              <div className="sm:col-span-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                {!completionLabourPreview.hasEngineer ? (
                  <p className="text-amber-700 dark:text-amber-300">
                  
                  </p>
                ) : (
                  <p>
                    {t("service.work.labour_preview", "Estimated labour: {hours}h × {rate} = {total}")
                      .replace("{hours}", String(completionLabourPreview.hours))
                      .replace("{rate}", money(completionLabourPreview.rate))
                      .replace("{total}", money(completionLabourPreview.total))}
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCompleting(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => complete.mutate()} disabled={complete.isPending}>
              {complete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.work.complete", "Complete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={parting !== null} onOpenChange={(open) => !open && setParting(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.work.add_part", "Add part")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.work.part_desc",
                  "The line cost is computed from quantity and unit cost here, so it can never disagree with itself and distort the job total.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-desc">{t("service.work.part_name", "Part")}</Label>
              <Input
                id="p-desc"
                value={part.description}
                onChange={(event) => setPart({ ...part, description: event.target.value })}
                placeholder={t("service.work.part_hint", "Seal kit, photo-eye sensor")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-qty">{t("service.work.quantity", "Quantity")}</Label>
              <Input
                id="p-qty"
                type="number"
                min={0}
                step="0.001"
                value={part.quantity}
                onChange={(event) => setPart({ ...part, quantity: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cost">{t("service.work.unit_cost", "Unit cost")}</Label>
              <Input
                id="p-cost"
                type="number"
                min={0}
                value={part.unit_cost}
                onChange={(event) => setPart({ ...part, unit_cost: event.target.value })}
              />
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              {t("service.work.line_preview", "Line: {v}").replace(
                "{v}",
                money(n(part.quantity) * n(part.unit_cost)),
              )}
            </p>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setParting(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => addPart.mutate()}
              disabled={addPart.isPending || !part.description.trim()}
            >
              {addPart.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.work_order_number ?? t("service.work.number", "Work order")}
              </DialogTitle>
              <DialogDescription className="capitalize">
                {detail ? `${detail.type} · ${detail.status.replace(/_/g, " ")}` : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center px-6 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5 text-sm">
              <div className="flex flex-wrap gap-2">
                {detail.request_id ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/service/requests?id=${detail.request_id}`}>
                      {t("service.work.view_request", "View request")}
                    </Link>
                  </Button>
                ) : null}
                {detail.asset_id ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/dashboard/service/assets">{t("service.requests.view_asset", "View asset")}</Link>
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[detail.status]}`}
                >
                  {detail.status.replace(/_/g, " ")}
                </Badge>
                <Badge
                  variant="outline"
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${COVERAGE_TONE[detail.coverage]}`}
                >
                  {detail.coverage}
                </Badge>
                {detail.is_overdue ? (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {t("service.work.overdue", "Overdue")}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t("service.requests.asset", "Asset")}: </span>
                  {detail.asset?.name ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("service.work.technician", "Engineer")}: </span>
                  {detail.technician?.name ?? t("service.work.unassigned", "Unassigned")}
                  {detail.technician?.hourly_rate != null ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({money(detail.technician.hourly_rate)}/hr)
                    </span>
                  ) : null}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("service.work.against", "Request")}: </span>
                  {detail.request?.request_number ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("service.work.scheduled", "Scheduled")}: </span>
                  {whenever(detail.scheduled_for)}
                </div>
              </div>

              {canManage && detail.status !== "completed" && detail.status !== "cancelled" ? (
                <Panel title={t("service.work.assign_engineer", "Assign engineer")}>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px] flex-1 space-y-1.5">
                      <Label className="text-xs">{t("service.work.technician", "Engineer")}</Label>
                      {allTechnicians.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("service.engineers.none_hint", "No engineers yet.")}{" "}
                          <Link href="/dashboard/service/engineers" className="font-medium text-primary underline">
                            {t("service.engineers.add", "Add engineer")}
                          </Link>
                        </p>
                      ) : (
                        <Select
                          value={assignTechnicianId || "none"}
                          onValueChange={(v) => setAssignTechnicianId(v === "none" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("service.work.unassigned", "Unassigned")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("service.work.unassigned", "Unassigned")}</SelectItem>
                            {allTechnicians.map((tech) => (
                              <SelectItem key={tech.id} value={String(tech.id)}>
                                {formatTechOption(tech)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Button
                      size="sm"
                      disabled={
                        assignTechnician.isPending ||
                        allTechnicians.length === 0 ||
                        assignTechnicianId === (detail.technician_id ? String(detail.technician_id) : "")
                      }
                      onClick={() =>
                        assignTechnician.mutate({
                          id: detail.id,
                          technician_id: assignTechnicianId ? Number(assignTechnicianId) : null,
                        })
                      }
                    >
                      {assignTechnician.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t("service.work.assign", "Assign")
                      )}
                    </Button>
                  </div>
                </Panel>
              ) : null}

              <Panel title={t("service.work.timeline", "Visit timeline")}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">{t("service.work.started", "Started")}: </span>
                    {whenever(detail.started_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("service.work.completed_at", "Completed")}: </span>
                    {whenever(detail.completed_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("service.work.labour_hours", "Labour hours")}: </span>
                    {n(detail.labour_hours)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("service.work.fixed", "Fault cleared?")}: </span>
                    {detail.status === "completed"
                      ? detail.resolved_the_fault
                        ? t("service.work.fixed_yes", "Yes, fixed")
                        : t("service.work.fixed_no", "No, return visit needed")
                      : "—"}
                  </div>
                </div>
              </Panel>

              <Panel title={t("service.work.costs", "Costs")}>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">{t("service.work.labour", "Labour")}: </span>
                    {money(detail.labour_cost)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("service.work.parts", "Parts")}: </span>
                    {money(detail.parts_cost)}
                  </div>
                  <div className="font-semibold">
                    <span className="text-muted-foreground">{t("service.common.total", "Total")}: </span>
                    {money(detail.total_cost)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({detail.is_billable
                        ? t("service.work.billable", "billable")
                        : t("service.work.absorbed", "absorbed")})
                    </span>
                  </div>
                </div>
              </Panel>

              {detail.work_performed ? (
                <Panel title={t("service.work.notes", "What was done")}>
                  <p>{detail.work_performed}</p>
                </Panel>
              ) : null}

              {(detail.parts ?? []).length > 0 ? (
                <Panel title={t("service.work.parts_list", "Parts used")}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/60 text-left text-muted-foreground">
                          <th className="pb-2 font-semibold">{t("service.work.part_name", "Part")}</th>
                          <th className="pb-2 text-right font-semibold">{t("service.work.quantity", "Qty")}</th>
                          <th className="pb-2 text-right font-semibold">{t("service.work.unit_cost", "Unit")}</th>
                          <th className="pb-2 text-right font-semibold">{t("service.common.total", "Line")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.parts as ServiceWorkOrderPart[]).map((line) => (
                          <tr key={line.id} className="border-b border-border/40 last:border-0">
                            <td className="py-1.5">{line.description}</td>
                            <td className="py-1.5 text-right tabular-nums">{n(line.quantity)}</td>
                            <td className="py-1.5 text-right tabular-nums">{money(line.unit_cost)}</td>
                            <td className="py-1.5 text-right font-medium tabular-nums">{money(line.line_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ) : null}

              {canManage || canComplete ? (
                <div className="flex flex-wrap gap-1 border-t border-border/40 pt-4">
                  {canManage
                    ? (NEXT_STATUSES[detail.status] ?? []).map((next) => (
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
                            next.replace(/_/g, " ")
                          )}
                        </Button>
                      ))
                    : null}
                  {canManage && detail.status !== "completed" && detail.status !== "cancelled" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => setParting(detail)}
                    >
                      {t("service.work.add_part", "Add part")}
                    </Button>
                  ) : null}
                  {canComplete && detail.status === "in_progress" ? (
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setCompleting(detail)}
                    >
                      {t("service.work.complete", "Complete")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : detailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("service.work.detail_failed", "Could not load this work order.")}
              </p>
              <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("service.common.retry", "Retry")}
              </Button>
            </div>
          ) : null}

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDetailId(null)}>
              {t("service.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
