"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, Loader2, Plus, RefreshCw, Wrench } from "lucide-react";
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
  BreachingRow,
  Priority,
  RequestStatus,
  ServiceAsset,
  ServiceContract,
  ServiceRequest,
  ServiceWorkOrder,
} from "@/modules/service/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const PRIORITIES: Priority[] = ["low", "normal", "high", "critical"];
const CHANNELS = ["phone", "email", "portal", "field"] as const;
const ALL_STATUSES: RequestStatus[] = [
  "new",
  "acknowledged",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
];

const NEXT_STATUSES: Record<RequestStatus, RequestStatus[]> = {
  new: ["acknowledged", "in_progress", "cancelled"],
  acknowledged: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["resolved", "on_hold", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  resolved: ["in_progress"],
  closed: [],
  cancelled: [],
};

const STATUS_TONE: Record<RequestStatus, string> = {
  new: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  acknowledged: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  on_hold: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const PRIORITY_TONE: Record<Priority, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted text-muted-foreground",
};

const DEFAULT_FORM = {
  asset_id: "",
  contract_id: "",
  subject: "",
  description: "",
  priority: "normal" as Priority,
  channel: "phone",
  customer_name: "",
  reported_at: "",
};

const whenever = (value: string | null | undefined) =>
  value ? String(value).replace("T", " ").slice(0, 16) : "—";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatTechOption = (tech: AvailableTechnician) =>
  `${tech.name} · ${money(tech.hourly_rate)}/hr · ${tech.open_jobs} open`;

const heldFor = (minutes: number) =>
  minutes < 60 ? `${minutes}m` : `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;

function contractLabel(contract: ServiceContract | null | undefined, t: (k: string, f: string) => string) {
  if (!contract) return null;
  return `${contract.name} (${contract.tier}) · ${t("service.contracts.promise", "{r}h / {f}h")
    .replace("{r}", String(contract.response_hours))
    .replace("{f}", String(contract.resolution_hours))}`;
}

function slaLabel(row: ServiceRequest, t: (k: string, f: string) => string) {
  const breached = row.response_breached || row.resolution_breached;
  if (breached) {
    return row.response_breached && row.resolution_breached
      ? t("service.requests.both_late", "Both late")
      : row.response_breached
        ? t("service.requests.response_late", "Response late")
        : t("service.requests.resolution_late", "Resolution late");
  }
  return t("service.requests.on_track", "On track");
}

export default function ServiceRequestsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_service_requests", "manage_service"]);
  const canClose = hasAnyPermission(["close_service_requests", "manage_service"]);
  const canRaiseWork = hasAnyPermission(["manage_service_work_orders", "manage_service"]);

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [assetFilter, setAssetFilter] = React.useState(
    () => searchParams.get("asset_id") ?? "all",
  );
  const [contractFilter, setContractFilter] = React.useState("all");
  const [openOnly, setOpenOnly] = React.useState(false);
  const [breachedOnly, setBreachedOnly] = React.useState(false);

  const [logOpen, setLogOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...DEFAULT_FORM });

  const [detailId, setDetailId] = React.useState<number | null>(() => {
    const id = searchParams.get("id");
    return id ? Number(id) : null;
  });
  const [closing, setClosing] = React.useState<ServiceRequest | null>(null);
  const [rating, setRating] = React.useState("5");
  const [resolving, setResolving] = React.useState<ServiceRequest | null>(null);
  const [resolutionSummary, setResolutionSummary] = React.useState("");
  const [raisingFor, setRaisingFor] = React.useState<ServiceRequest | null>(null);
  const [scheduledFor, setScheduledFor] = React.useState("");
  const [raiseTechnicianId, setRaiseTechnicianId] = React.useState("");
  const [transitioningId, setTransitioningId] = React.useState<number | null>(null);

  const requestsQuery = useQuery({
    queryKey: [
      "service",
      "requests",
      tableQuery,
      statusFilter,
      priorityFilter,
      assetFilter,
      contractFilter,
      openOnly,
      breachedOnly,
    ],
    queryFn: () =>
      serviceApi
        .listRequests({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          priority: priorityFilter !== "all" ? priorityFilter : undefined,
          asset_id: assetFilter !== "all" ? Number(assetFilter) : undefined,
          contract_id: contractFilter !== "all" ? Number(contractFilter) : undefined,
          ...(openOnly ? { open_only: 1 } : {}),
          ...(breachedOnly ? { breached_only: 1 } : {}),
        })
        .then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["service", "overview-requests"],
    queryFn: () => serviceApi.overview().then((res) => res.data),
  });

  const breachingQuery = useQuery({
    queryKey: ["service", "breaching"],
    queryFn: () => serviceApi.breaching().then((res) => res.data),
  });

  const assetsQuery = useQuery({
    queryKey: ["service", "asset-options"],
    queryFn: () => serviceApi.listAssets({ limit: 200 }).then((res) => res.data),
  });

  const contractsQuery = useQuery({
    queryKey: ["service", "contract-options"],
    queryFn: () => serviceApi.listContracts({ limit: 100 }).then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["service", "request", detailId],
    queryFn: () => serviceApi.getRequest(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const techniciansQuery = useQuery({
    queryKey: ["service", "available-technicians"],
    queryFn: () => serviceApi.availableTechnicians().then((res) => res.data),
    enabled: raisingFor !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["service"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const logRequest = useMutation({
    mutationFn: () =>
      serviceApi.createRequest({
        ...(form.asset_id ? { asset_id: Number(form.asset_id) } : {}),
        ...(!form.asset_id && form.contract_id ? { contract_id: Number(form.contract_id) } : {}),
        subject: form.subject.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        channel: form.channel,
        ...(form.customer_name.trim() ? { customer_name: form.customer_name.trim() } : {}),
        ...(form.reported_at ? { reported_at: form.reported_at } : {}),
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("service.requests.logged", "Request logged."));
      invalidate();
      setLogOpen(false);
      setForm({ ...DEFAULT_FORM });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.requests.log_failed", "Could not log it."))),
  });

  const transition = useMutation({
    mutationFn: ({
      id,
      next,
      summary,
    }: {
      id: number;
      next: RequestStatus;
      summary?: string;
    }) => {
      setTransitioningId(id);
      return serviceApi.transitionRequest(id, next, summary);
    },
    onSuccess: () => {
      toast.success(t("service.requests.moved", "Request updated."));
      invalidate();
      setResolving(null);
      setResolutionSummary("");
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.requests.move_failed", "Could not move it."))),
    onSettled: () => setTransitioningId(null),
  });

  const close = useMutation({
    mutationFn: () => serviceApi.closeRequest(closing!.id, Number(rating)),
    onSuccess: () => {
      toast.success(t("service.requests.closed", "Request closed."));
      invalidate();
      setClosing(null);
      if (detailId === closing?.id) setDetailId(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.requests.close_failed", "Could not close it."))),
  });

  const raiseWork = useMutation({
    mutationFn: () =>
      serviceApi.createWorkOrder({
        request_id: raisingFor!.id,
        ...(raisingFor!.asset_id ? { asset_id: raisingFor!.asset_id } : {}),
        type: "corrective",
        ...(raiseTechnicianId ? { technician_id: Number(raiseTechnicianId) } : {}),
        ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("service.work.raised", "Work order raised."));
      invalidate();
      setRaisingFor(null);
      setScheduledFor("");
      setRaiseTechnicianId("");
      if (detailId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.raise_failed", "Could not raise it."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const requests = (requestsQuery.data?.data ?? []) as ServiceRequest[];
  const assets = (assetsQuery.data?.data ?? []) as ServiceAsset[];
  const contracts = (contractsQuery.data?.data ?? []) as ServiceContract[];
  const queue = overviewQuery.data?.data?.queue;
  const breaching = (breachingQuery.data?.data ?? overviewQuery.data?.data?.breaching ?? []) as BreachingRow[];
  const detail = (detailQuery.data?.data ?? null) as ServiceRequest | null;
  const technicians = (techniciansQuery.data?.data ?? []) as AvailableTechnician[];

  const closeRaiseDialog = React.useCallback(() => {
    setRaisingFor(null);
    setScheduledFor("");
    setRaiseTechnicianId("");
  }, []);

  const handleTransition = React.useCallback(
    (row: ServiceRequest, next: RequestStatus) => {
      if (next === "resolved") {
        setResolving(row);
        setResolutionSummary(row.resolution_summary ?? "");
        return;
      }
      transition.mutate({ id: row.id, next });
    },
    [transition],
  );

  const columns = React.useMemo<ColumnDef<ServiceRequest>[]>(
    () => [
      {
        id: "request",
        header: t("service.requests.number", "Request"),
        cell: ({ row }) => (
          <button type="button" className="space-y-0.5 text-left" onClick={() => setDetailId(row.original.id)}>
            <p className="font-bold hover:underline">{row.original.subject}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {row.original.request_number}
              {row.original.customer_name ? ` · ${row.original.customer_name}` : ""}
            </p>
          </button>
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
        accessorKey: "channel",
        header: t("service.requests.channel", "Channel"),
        cell: ({ row }) => (
          <span className="text-xs capitalize">{row.original.channel ?? "—"}</span>
        ),
      },
      {
        accessorKey: "priority",
        header: t("service.common.priority", "Priority"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`border-transparent text-[10px] font-black uppercase tracking-widest ${PRIORITY_TONE[row.original.priority]}`}
          >
            {row.original.priority}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("service.common.status", "Status"),
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
        id: "response_due",
        header: t("service.requests.response_due", "Response due"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.response_due_at
              ? whenever(row.original.response_due_at)
              : t("service.requests.no_contract", "no contract")}
          </span>
        ),
      },
      {
        id: "resolution_due",
        header: t("service.requests.due", "Resolution due"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.resolution_due_at
              ? whenever(row.original.resolution_due_at)
              : t("service.requests.no_contract", "no contract")}
          </span>
        ),
      },
      {
        id: "sla",
        header: t("service.requests.sla", "SLA"),
        cell: ({ row }) => {
          const breached = row.original.response_breached || row.original.resolution_breached;
          return (
            <div className="text-xs">
              <span className={breached ? "font-semibold text-destructive" : "text-muted-foreground"}>
                {slaLabel(row.original, t)}
              </span>
              {row.original.paused_minutes > 0 ? (
                <span className="block text-[11px] text-muted-foreground">
                  {t("service.requests.paused", "{n} on hold").replace(
                    "{n}",
                    heldFor(row.original.paused_minutes),
                  )}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const nextStates = canManage ? (NEXT_STATUSES[row.original.status] ?? []) : [];
          const busy = transitioningId === row.original.id;
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
                  onClick={() => handleTransition(row.original, next)}
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : next.replace(/_/g, " ")}
                </Button>
              ))}
              {canClose && row.original.status === "resolved" ? (
                <Button
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setClosing(row.original);
                    setRating("5");
                  }}
                >
                  {t("service.requests.close", "Close")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canClose, canManage, handleTransition, t, transitioningId],
  );

  const renderLogForm = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("service.requests.asset", "Asset")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.asset_id || "none"}
            onValueChange={(v) =>
              setForm({
                ...form,
                asset_id: v === "none" ? "" : v,
                contract_id: v !== "none" ? "" : form.contract_id,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("service.requests.no_asset", "Not against a known asset")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("service.requests.no_asset", "Not against a known asset")}</SelectItem>
              {assets.map((asset) => (
                <SelectItem key={asset.id} value={String(asset.id)}>
                  {asset.name} — {asset.customer_name ?? asset.asset_tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!form.asset_id ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("service.assets.contract", "Contract")}</Label>
          <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
            <Select
              value={form.contract_id || "none"}
              onValueChange={(v) => setForm({ ...form, contract_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("service.assets.no_contract", "None")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("service.assets.no_contract", "None")}</SelectItem>
                {contracts.map((contract) => (
                  <SelectItem key={contract.id} value={String(contract.id)}>
                    {contract.name} — {contract.customer_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="l-subject">{t("service.requests.subject", "Subject")}</Label>
        <Input
          id="l-subject"
          value={form.subject}
          onChange={(event) => setForm({ ...form, subject: event.target.value })}
          placeholder={t("service.requests.subject_hint", "Filler head 6 dripping")}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("service.common.priority", "Priority")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.priority}
            onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("service.requests.channel", "Reported via")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-reported">{t("service.requests.reported_at", "Reported at")}</Label>
        <Input
          id="l-reported"
          type="datetime-local"
          value={form.reported_at}
          onChange={(event) => setForm({ ...form, reported_at: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-customer">
          {t("service.requests.customer_optional", "Customer (if no asset chosen)")}
        </Label>
        <Input
          id="l-customer"
          value={form.customer_name}
          onChange={(event) => setForm({ ...form, customer_name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="l-desc">{t("service.requests.description", "What is happening")}</Label>
        <Textarea
          id="l-desc"
          rows={3}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("service.requests.title", "Service Requests")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "service.requests.subtitle",
              "Every fault against its contract clock. Deadlines are set once at intake and do not move when a contract is renegotiated later.",
            )}
          </p>
        </div>
        {canManage ? (
          <Button className="rounded-full px-5" onClick={() => setLogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("service.requests.log", "Log Request")}
          </Button>
        ) : null}
      </div>

      {overviewQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : queue ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("service.requests.open", "Open")}
            value={queue.open.toLocaleString()}
            meta={t("service.requests.total_meta", "{n} total").replace("{n}", String(queue.total))}
          />
          <StatTile
            label={t("service.requests.on_hold", "On hold")}
            value={queue.on_hold.toLocaleString()}
          />
          <StatTile
            label={t("service.requests.unacknowledged", "Unacknowledged")}
            value={queue.unacknowledged.toLocaleString()}
            alert={queue.unacknowledged > 0}
          />
          <StatTile
            icon={<AlertTriangle className="h-4 w-4" />}
            label={t("service.overview.at_risk", "At risk")}
            value={breaching.length.toLocaleString()}
            alert={breaching.length > 0}
          />
        </div>
      ) : null}

      {breaching.length > 0 ? (
        <Panel
          title={t("service.overview.breach_queue", "Clock running out")}
          description={t(
            "service.overview.breach_queue_desc",
            "Open requests already past a deadline or within eight hours of one — worst first.",
          )}
        >
          <div className="space-y-1.5">
            {breaching.slice(0, 6).map((row) => {
              const late = row.response_late || row.resolution_late;
              return (
                <button
                  key={row.request_id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                  onClick={() => setDetailId(row.request_id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.subject}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {row.request_number}
                      {row.customer ? ` · ${row.customer}` : ""} ·{" "}
                      <span className="capitalize">{row.priority}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block text-xs font-semibold ${
                        late ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {row.response_late
                        ? t("service.overview.response_late", "Response late")
                        : row.resolution_late
                          ? t("service.overview.resolution_late", "Resolution late")
                          : t("service.overview.due_soon", "Due soon")}
                    </span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">
                      {row.hours_remaining === null
                        ? t("service.overview.no_deadline", "no deadline")
                        : row.hours_remaining < 0
                          ? t("service.overview.hours_over", "{n}h over").replace(
                              "{n}",
                              Math.abs(row.hours_remaining).toFixed(1),
                            )
                          : t("service.overview.hours_left", "{n}h left").replace(
                              "{n}",
                              row.hours_remaining.toFixed(1),
                            )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("service.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
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
          <Label className="text-xs">{t("service.common.priority", "Priority")}</Label>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {PRIORITIES.map((value) => (
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
            <SelectTrigger className="w-[180px]">
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
          <Label className="text-xs">{t("service.assets.contract", "Contract")}</Label>
          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {contracts.map((contract) => (
                <SelectItem key={contract.id} value={String(contract.id)}>
                  {contract.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="sr-open" checked={openOnly} onCheckedChange={setOpenOnly} />
          <Label htmlFor="sr-open" className="text-sm">
            {t("service.requests.open_only", "Open only")}
          </Label>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="sr-breach" checked={breachedOnly} onCheckedChange={setBreachedOnly} />
          <Label htmlFor="sr-breach" className="text-sm">
            {t("service.requests.breached_only", "Breached only")}
          </Label>
        </div>
      </div>

      {requestsQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("service.requests.load_failed", "Could not load requests.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => requestsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("service.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={requests}
          totalEntries={requestsQuery.data?.meta?.total ?? 0}
          loading={requestsQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("service.requests.search_hint", "Number, subject or customer")}
          resourceName="service-requests"
        />
      )}

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.requests.log", "Log Request")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.requests.log_desc",
                  "Naming the asset pulls its contract in, and the response and resolution deadlines are computed from that contract's cover — working hours only, unless it is a 24/7 agreement.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{renderLogForm()}</div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setLogOpen(false)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => logRequest.mutate()}
              disabled={logRequest.isPending || !form.subject.trim()}
            >
              {logRequest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolving !== null} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.requests.resolve_title", "Mark resolved")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.requests.resolve_desc",
                  "What was done to fix it — this stays on the record when the request is closed.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="r-summary">{t("service.requests.resolution_summary", "Resolution summary")}</Label>
              <Textarea
                id="r-summary"
                rows={4}
                value={resolutionSummary}
                onChange={(event) => setResolutionSummary(event.target.value)}
                placeholder={t("service.requests.resolution_hint", "Replaced seal, recalibrated...")}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setResolving(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() =>
                resolving &&
                transition.mutate({
                  id: resolving.id,
                  next: "resolved",
                  summary: resolutionSummary.trim() || undefined,
                })
              }
              disabled={transition.isPending || !resolutionSummary.trim()}
            >
              {transition.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.requests.resolve", "Resolve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closing !== null} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.requests.close_title", "Close Request")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.requests.close_desc",
                  "The rating the customer gives feeds the satisfaction figure on the dashboard, so it is captured here rather than guessed later.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label>{t("service.requests.rating", "Satisfaction (1–5)")}</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setClosing(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => close.mutate()} disabled={close.isPending}>
              {close.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.requests.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={raisingFor !== null} onOpenChange={(open) => !open && closeRaiseDialog()}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.work.raise", "Raise Work Order")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.requests.raise_desc",
                  "Dispatch an engineer visit against this fault. Coverage is taken from the asset. You can assign an engineer now or later from Work Orders.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label>{t("service.work.technician", "Engineer")}</Label>
              <Select
                value={raiseTechnicianId || "none"}
                onValueChange={(v) => setRaiseTechnicianId(v === "none" ? "" : v)}
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
                  {" · "}
                  {t("service.requests.assign_later", "You can also assign later on Work Orders.")}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {t("service.plans.least_loaded", "Listed least loaded first.")}{" "}
                  {t("service.requests.assign_later", "Leave unassigned to assign on Work Orders.")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-scheduled">{t("service.work.scheduled", "Scheduled for")}</Label>
              <Input
                id="wo-scheduled"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={closeRaiseDialog}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => raiseWork.mutate()} disabled={raiseWork.isPending}>
              {raiseWork.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.work.raise", "Raise Work Order")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.subject ?? t("service.requests.number", "Request")}
              </DialogTitle>
              <DialogDescription className="font-mono">{detail?.request_number}</DialogDescription>
            </DialogHeader>
          </div>

          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center px-6 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5 text-sm">
              <div className="flex flex-wrap gap-2">
                {canRaiseWork && detail.is_open !== false && detail.status !== "closed" && detail.status !== "cancelled" ? (
                  <Button size="sm" variant="outline" onClick={() => setRaisingFor(detail)}>
                    <Wrench className="mr-2 h-3.5 w-3.5" />
                    {t("service.work.raise", "Raise Work Order")}
                  </Button>
                ) : null}
                {detail.asset_id ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/dashboard/service/assets">{t("service.requests.view_asset", "View asset")}</Link>
                  </Button>
                ) : null}
                {(detail.work_orders ?? []).length > 0 ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/service/work-orders?request_id=${detail.id}`}>
                      {t("service.requests.view_work", "View work orders")}
                    </Link>
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${PRIORITY_TONE[detail.priority]}`}
                >
                  {detail.priority}
                </Badge>
                <Badge
                  variant="outline"
                  className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[detail.status]}`}
                >
                  {detail.status.replace(/_/g, " ")}
                </Badge>
                {detail.channel ? (
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {detail.channel}
                  </Badge>
                ) : null}
              </div>

              {detail.description ? <p className="text-muted-foreground">{detail.description}</p> : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t("service.requests.customer", "Customer")}: </span>
                  {detail.customer_name ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("service.requests.asset", "Asset")}: </span>
                  {detail.asset?.name ?? "—"}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{t("service.assets.contract", "Contract")}: </span>
                  {contractLabel(detail.contract, t) ?? t("service.requests.no_contract", "no contract")}
                </div>
              </div>

              <Panel title={t("service.requests.timeline", "SLA timeline")}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">{t("service.requests.reported_at", "Reported")}: </span>
                    {whenever(detail.reported_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("service.requests.response_due", "Response due")}: </span>
                    {whenever(detail.response_due_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("service.requests.first_response", "First response")}: </span>
                    {whenever(detail.first_responded_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("service.requests.due", "Resolution due")}: </span>
                    {whenever(detail.resolution_due_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("service.requests.resolved_at", "Resolved")}: </span>
                    {whenever(detail.resolved_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("service.requests.sla", "SLA")}: </span>
                    <span
                      className={
                        detail.response_breached || detail.resolution_breached
                          ? "font-semibold text-destructive"
                          : ""
                      }
                    >
                      {slaLabel(detail, t)}
                    </span>
                    {detail.paused_minutes > 0 ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {heldFor(detail.paused_minutes)} {t("service.requests.on_hold", "on hold")}
                      </span>
                    ) : null}
                  </div>
                  {detail.resolution_hours_taken != null ? (
                    <div>
                      <span className="text-muted-foreground">
                        {t("service.requests.resolution_hours", "Resolution time")}:{" "}
                      </span>
                      {detail.resolution_hours_taken}h
                    </div>
                  ) : null}
                </div>
              </Panel>

              {detail.resolution_summary ? (
                <Panel title={t("service.requests.resolution_summary", "Resolution summary")}>
                  <p>{detail.resolution_summary}</p>
                </Panel>
              ) : null}

              {detail.satisfaction_rating != null ? (
                <div>
                  <span className="text-muted-foreground">{t("service.requests.rating", "Satisfaction")}: </span>
                  {detail.satisfaction_rating}/5
                </div>
              ) : null}

              {(detail.work_orders ?? []).length > 0 ? (
                <Panel title={t("service.work.title", "Work Orders")}>
                  <ul className="space-y-2">
                    {(detail.work_orders as ServiceWorkOrder[]).map((order) => (
                      <li key={order.id} className="flex items-center justify-between gap-2 text-xs">
                        <span>
                          <span className="font-mono font-medium">{order.work_order_number}</span>
                          <span className="ml-2 capitalize text-muted-foreground">{order.status}</span>
                        </span>
                        <Button asChild size="sm" variant="ghost" className="h-7">
                          <Link href={`/dashboard/service/work-orders?request_id=${detail.id}`}>
                            {t("service.common.open", "Open")}
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}

              {canManage ? (
                <div className="flex flex-wrap gap-1 border-t border-border/40 pt-4">
                  {(NEXT_STATUSES[detail.status] ?? []).map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] capitalize"
                      disabled={transitioningId === detail.id}
                      onClick={() => handleTransition(detail, next)}
                    >
                      {transitioningId === detail.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        next.replace(/_/g, " ")
                      )}
                    </Button>
                  ))}
                  {canClose && detail.status === "resolved" ? (
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setClosing(detail);
                        setRating(String(detail.satisfaction_rating ?? 5));
                      }}
                    >
                      {t("service.requests.close", "Close")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : detailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("service.requests.detail_failed", "Could not load this request.")}
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
