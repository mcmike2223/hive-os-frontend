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
import { usePermissions } from "@/hooks/use-permissions";
import { hrFetch, type Employee as HrEmployee, type Paginated as HrPaginated } from "@/modules/humanresources/api";
import { crmApi } from "@/modules/crm/api";
import type { CrmActivity, CrmCampaign, CrmLead, CrmPipeline, LeadStatus } from "@/modules/crm/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "disqualified"];

const ACTIVITY_TYPES = ["call", "meeting", "email", "task", "note"] as const;

/** Mirrors CrmLead::TRANSITIONS on the server. Convert uses a separate endpoint. */
const TRANSITIONS: Record<string, LeadStatus[]> = {
  new: ["contacted", "qualified", "disqualified"],
  contacted: ["qualified", "disqualified", "new"],
  qualified: ["disqualified", "contacted"],
  converted: [],
  disqualified: ["new"],
};

const STATUS_TONE: Record<string, string> = {
  new: "outline",
  contacted: "secondary",
  qualified: "default",
  converted: "default",
  disqualified: "destructive",
};

const DEFAULT_LEAD = {
  name: "",
  company: "",
  email: "",
  phone: "",
  city: "",
  source: "",
  campaign_id: "",
  estimated_value: "",
  owner_employee_id: "",
  notes: "",
};

const DEFAULT_ACTIVITY = {
  type: "call" as (typeof ACTIVITY_TYPES)[number],
  subject: "",
  body: "",
  due_at: "",
};

const DEFAULT_CONVERT = {
  account_name: "",
  opportunity_name: "",
  amount: "",
  segment: "",
  pipeline_id: "",
  expected_close_date: "",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown, currency = "ETB") =>
  `${currency} ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function employeeLabel(employees: Map<number, HrEmployee>, id: number | null | undefined) {
  if (id == null) return null;
  const employee = employees.get(id);
  if (employee) return `${employee.primary_name} (${employee.employee_number})`;
  return `#${id}`;
}

function leadToForm(lead: CrmLead) {
  return {
    name: lead.name,
    company: lead.company ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    city: lead.city ?? "",
    source: lead.source ?? "",
    campaign_id: lead.campaign_id ? String(lead.campaign_id) : "",
    estimated_value: lead.estimated_value ? String(lead.estimated_value) : "",
    owner_employee_id: lead.owner_employee_id ? String(lead.owner_employee_id) : "",
    notes: lead.notes ?? "",
  };
}

function scoreBreakdown(lead: CrmLead, doneActivities: number) {
  const parts: Array<{ label: string; points: number; earned: boolean }> = [
    { label: "Phone", points: 25, earned: Boolean(lead.phone) },
    { label: "Email", points: 20, earned: Boolean(lead.email) },
    { label: "Company", points: 15, earned: Boolean(lead.company) },
    { label: "Estimated value", points: 15, earned: n(lead.estimated_value) > 0 },
    { label: "Owner assigned", points: 10, earned: lead.owner_employee_id != null },
    {
      label: "Engagement (done activities)",
      points: Math.min(15, doneActivities * 5),
      earned: doneActivities > 0,
    },
  ];
  return parts;
}

type ConvertResult = {
  account_id: number;
  opportunity_id: number;
  opportunity_number: string;
};

export default function CrmLeadsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const canConvert = hasAnyPermission(["manage_crm_opportunities", "manage_crm"]);

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [campaignFilter, setCampaignFilter] = React.useState(
    () => searchParams.get("campaign_id") ?? "all",
  );
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [openOnly, setOpenOnly] = React.useState(false);

  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...DEFAULT_LEAD });

  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [detailEditing, setDetailEditing] = React.useState(false);
  const [detailForm, setDetailForm] = React.useState({ ...DEFAULT_LEAD });
  const [activityForm, setActivityForm] = React.useState({ ...DEFAULT_ACTIVITY });

  const [convertFor, setConvertFor] = React.useState<CrmLead | null>(null);
  const [convertForm, setConvertForm] = React.useState({ ...DEFAULT_CONVERT });
  const [convertResult, setConvertResult] = React.useState<ConvertResult | null>(null);

  const [disqualifyFor, setDisqualifyFor] = React.useState<CrmLead | null>(null);
  const [lostReason, setLostReason] = React.useState("");

  const [transitioningId, setTransitioningId] = React.useState<number | null>(null);
  const [activityBusyId, setActivityBusyId] = React.useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ["crm", "leads", tableQuery, statusFilter, sourceFilter, campaignFilter, ownerFilter, openOnly],
    queryFn: () =>
      crmApi
        .listLeads({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          source: sourceFilter !== "all" ? sourceFilter : undefined,
          campaign_id: campaignFilter !== "all" ? Number(campaignFilter) : undefined,
          owner_employee_id: ownerFilter !== "all" ? Number(ownerFilter) : undefined,
          open_only: openOnly ? 1 : undefined,
        })
        .then((res) => res.data),
  });

  const summaryQuery = useQuery({
    queryKey: ["crm", "lead-summary"],
    queryFn: () => crmApi.leadSummary().then((res) => res.data),
  });

  const campaignsQuery = useQuery({
    queryKey: ["crm", "campaign-options"],
    queryFn: () => crmApi.listCampaigns({ limit: 100 }).then((res) => res.data),
  });

  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines", "lead-convert"],
    queryFn: () => crmApi.listPipelines({ limit: 50 }).then((res) => res.data),
    enabled: convertFor !== null,
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", "crm-leads"],
    queryFn: () => hrFetch<HrPaginated<HrEmployee>>("/employees?per_page=200"),
    staleTime: 5 * 60 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ["crm", "lead", detailId],
    queryFn: () => crmApi.getLead(detailId!).then((res) => res.data?.data as CrmLead),
    enabled: detailId !== null,
  });

  const employeeById = React.useMemo(() => {
    const map = new Map<number, HrEmployee>();
    for (const employee of employeesQuery.data?.data ?? []) {
      map.set(employee.id, employee);
    }
    return map;
  }, [employeesQuery.data]);

  const campaigns = (campaignsQuery.data?.data ?? []) as CrmCampaign[];
  const pipelines = (pipelinesQuery.data?.data ?? []) as CrmPipeline[];
  const summary = summaryQuery.data?.data;
  const detail = detailQuery.data;
  const sourceOptions = React.useMemo(() => {
    const rows = (summary?.by_source ?? []) as Array<{ source: string }>;
    return Array.from(new Set(rows.map((row) => row.source).filter(Boolean)));
  }, [summary]);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["crm"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const buildLeadPayload = (values: typeof DEFAULT_LEAD) => ({
    name: values.name,
    company: values.company || null,
    email: values.email || null,
    phone: values.phone || null,
    city: values.city || null,
    source: values.source || null,
    campaign_id: values.campaign_id ? Number(values.campaign_id) : null,
    estimated_value: Number(values.estimated_value || 0),
    owner_employee_id: values.owner_employee_id ? Number(values.owner_employee_id) : null,
    notes: values.notes || null,
  });

  const create = useMutation({
    mutationFn: () => crmApi.createLead(buildLeadPayload(form)),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("crm.leads.created", "Lead captured."));
      invalidate();
      setCaptureOpen(false);
      setForm({ ...DEFAULT_LEAD });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.leads.create_failed", "Could not capture the lead."))),
  });

  const updateLead = useMutation({
    mutationFn: () => crmApi.updateLead(detailId!, buildLeadPayload(detailForm)),
    onSuccess: () => {
      toast.success(t("crm.leads.updated", "Lead updated."));
      invalidate();
      setDetailEditing(false);
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.leads.update_failed", "Could not update the lead."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, status, lost_reason }: { id: number; status: string; lost_reason?: string }) => {
      setTransitioningId(id);
      return crmApi.transitionLead(id, status, lost_reason);
    },
    onSuccess: () => {
      toast.success(t("crm.leads.moved", "Lead updated."));
      invalidate();
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.leads.move_failed", "That transition was refused."))),
    onSettled: () => setTransitioningId(null),
  });

  const convert = useMutation({
    mutationFn: () =>
      crmApi.convertLead(convertFor!.id, {
        account_name: convertForm.account_name || undefined,
        opportunity_name: convertForm.opportunity_name || undefined,
        amount: convertForm.amount ? Number(convertForm.amount) : undefined,
        segment: convertForm.segment || undefined,
        pipeline_id: convertForm.pipeline_id ? Number(convertForm.pipeline_id) : undefined,
        expected_close_date: convertForm.expected_close_date || undefined,
      }),
    onSuccess: (response: any) => {
      const data = response?.data?.data;
      toast.success(response?.data?.message ?? t("crm.leads.converted", "Lead converted."));
      invalidate();
      setConvertResult({
        account_id: data?.account?.id,
        opportunity_id: data?.opportunity?.id,
        opportunity_number: data?.opportunity?.opportunity_number,
      });
      if (detailId === convertFor?.id) {
        detailQuery.refetch();
      }
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.status === 403
          ? t(
              "crm.leads.convert_forbidden",
              "You need opportunity management permission to convert leads into deals.",
            )
          : errorText(error, t("crm.leads.convert_failed", "Could not convert the lead.")),
      ),
  });

  const logActivity = useMutation({
    mutationFn: () =>
      crmApi.createActivity({
        type: activityForm.type,
        subject: activityForm.subject,
        body: activityForm.body || null,
        lead_id: detailId,
        due_at: activityForm.due_at || null,
        owner_employee_id: detail?.owner_employee_id ?? null,
      }),
    onSuccess: () => {
      toast.success(t("crm.activities.logged", "Activity logged."));
      setActivityForm({ ...DEFAULT_ACTIVITY });
      invalidate();
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.activities.log_failed", "Could not log the activity."))),
  });

  const completeActivity = useMutation({
    mutationFn: (id: number) => {
      setActivityBusyId(id);
      return crmApi.completeActivity(id);
    },
    onSuccess: () => {
      toast.success(t("crm.activities.completed", "Marked done."));
      invalidate();
      detailQuery.refetch();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not complete it.")),
    onSettled: () => setActivityBusyId(null),
  });

  const openDetail = React.useCallback((lead: CrmLead) => {
    setDetailId(lead.id);
    setDetailEditing(false);
    setDetailForm(leadToForm(lead));
    setActivityForm({ ...DEFAULT_ACTIVITY });
  }, []);

  const closeDetail = React.useCallback(() => {
    setDetailId(null);
    setDetailEditing(false);
  }, []);

  const requestTransition = React.useCallback(
    (lead: CrmLead, status: LeadStatus) => {
      if (status === "disqualified") {
        setDisqualifyFor(lead);
        setLostReason(lead.lost_reason ?? "");
        return;
      }
      transition.mutate({ id: lead.id, status });
    },
    [transition],
  );

  const openConvert = React.useCallback(
    (lead: CrmLead) => {
      const defaultPipeline = pipelines.find((p) => p.is_default) ?? pipelines[0];
      setConvertFor(lead);
      setConvertResult(null);
      setConvertForm({
        account_name: lead.company ?? lead.name,
        opportunity_name: `${lead.company ?? lead.name} opportunity`,
        amount: String(n(lead.estimated_value) || ""),
        segment: "",
        pipeline_id: defaultPipeline ? String(defaultPipeline.id) : "",
        expected_close_date: "",
      });
    },
    [pipelines],
  );

  React.useEffect(() => {
    if (convertFor && pipelines.length > 0 && !convertForm.pipeline_id) {
      const defaultPipeline = pipelines.find((p) => p.is_default) ?? pipelines[0];
      if (defaultPipeline) {
        setConvertForm((prev) => ({ ...prev, pipeline_id: String(defaultPipeline.id) }));
      }
    }
  }, [convertFor, pipelines, convertForm.pipeline_id]);

  React.useEffect(() => {
    if (detail && !detailEditing) {
      setDetailForm(leadToForm(detail));
    }
  }, [detail, detailEditing]);

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const columns = React.useMemo<ColumnDef<CrmLead>[]>(
    () => [
      {
        id: "lead",
        header: t("crm.leads.lead", "Lead"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.lead_number}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.company ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "score",
        header: t("crm.leads.score", "Score"),
        cell: ({ row }) => {
          const score = n(row.original.score);
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
              <span className="text-xs font-semibold tabular-nums">{score}</span>
            </div>
          );
        },
      },
      {
        id: "contact",
        header: t("crm.leads.contact", "Contact"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.phone ?? "—"}</p>
            <p className="text-muted-foreground">{row.original.email ?? row.original.city ?? ""}</p>
          </div>
        ),
      },
      {
        id: "owner",
        header: t("crm.leads.owner", "Owner"),
        cell: ({ row }) => (
          <span className="text-xs">
            {employeeLabel(employeeById, row.original.owner_employee_id) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: t("crm.leads.source", "Source"),
        cell: ({ row }) => (
          <span className="text-xs capitalize">{row.original.source ?? "—"}</span>
        ),
      },
      {
        accessorKey: "estimated_value",
        header: t("crm.leads.value", "Value"),
        cell: ({ row }) => (
          <span className="tabular-nums">{money(row.original.estimated_value)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: t("crm.common.status", "Status"),
        cell: ({ row }) => (
          <Badge
            variant={(STATUS_TONE[row.original.status] ?? "outline") as any}
            className="text-[11px] capitalize"
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: t("crm.common.actions", "Actions"),
        cell: ({ row }) => {
          const record = row.original;
          const next = TRANSITIONS[record.status] ?? [];
          const isBusy = transitioningId === record.id;

          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => openDetail(record)}
                aria-label={t("crm.common.open", "Open")}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {record.status === "qualified" && canConvert ? (
                <Button
                  size="sm"
                  className="text-[11px]"
                  disabled={isBusy || convert.isPending}
                  onClick={() => openConvert(record)}
                >
                  {t("crm.leads.convert", "Convert")}
                </Button>
              ) : null}
              {next.map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  className="text-[11px] capitalize"
                  disabled={isBusy}
                  onClick={() => requestTransition(record, status)}
                >
                  {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : status}
                </Button>
              ))}
            </div>
          );
        },
      },
    ],
    [canConvert, convert.isPending, employeeById, openConvert, openDetail, requestTransition, t, transitioningId],
  );

  const doneActivities =
    detail?.activities?.filter((activity) => activity.status === "done").length ?? 0;
  const scoreParts = detail ? scoreBreakdown(detail, doneActivities) : [];

  const renderLeadFields = (
    values: typeof DEFAULT_LEAD,
    onChange: (next: typeof DEFAULT_LEAD) => void,
    idPrefix: string,
  ) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>{t("crm.common.name", "Name")}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-company`}>{t("crm.leads.company", "Company")}</Label>
        <Input
          id={`${idPrefix}-company`}
          value={values.company}
          onChange={(event) => onChange({ ...values, company: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>{t("crm.leads.phone", "Phone")}</Label>
        <Input
          id={`${idPrefix}-phone`}
          value={values.phone}
          onChange={(event) => onChange({ ...values, phone: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>{t("crm.leads.email", "Email")}</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={values.email}
          onChange={(event) => onChange({ ...values, email: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-city`}>{t("crm.leads.city", "City")}</Label>
        <Input
          id={`${idPrefix}-city`}
          value={values.city}
          onChange={(event) => onChange({ ...values, city: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-source`}>{t("crm.leads.source", "Source")}</Label>
        <Input
          id={`${idPrefix}-source`}
          value={values.source}
          onChange={(event) => onChange({ ...values, source: event.target.value })}
          placeholder={t("crm.leads.source_hint", "referral, walk-in, web")}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("crm.leads.campaign", "Campaign")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={values.campaign_id || "none"}
            onValueChange={(v) => onChange({ ...values, campaign_id: v === "none" ? "" : v })}
          >
            <SelectTrigger id={`${idPrefix}-campaign`}>
              <SelectValue placeholder={t("crm.common.none", "None")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("crm.common.none", "None")}</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={String(campaign.id)}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-value`}>{t("crm.leads.value", "Estimated value")}</Label>
        <Input
          id={`${idPrefix}-value`}
          type="number"
          min={0}
          value={values.estimated_value}
          onChange={(event) => onChange({ ...values, estimated_value: event.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("crm.leads.owner", "Owner")}</Label>
        {employeesQuery.isError ? (
          <Input
            type="number"
            value={values.owner_employee_id}
            onChange={(event) => onChange({ ...values, owner_employee_id: event.target.value })}
            placeholder={t("crm.leads.owner_id", "Employee ID")}
          />
        ) : (
          <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
            <Select
              value={values.owner_employee_id || "none"}
              onValueChange={(v) => onChange({ ...values, owner_employee_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("crm.common.none", "None")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("crm.common.none", "None")}</SelectItem>
                {(employeesQuery.data?.data ?? []).map((employee) => (
                  <SelectItem key={employee.id} value={String(employee.id)}>
                    {employeeLabel(employeeById, employee.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-notes`}>{t("crm.common.notes", "Notes")}</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          rows={3}
          value={values.notes}
          onChange={(event) => onChange({ ...values, notes: event.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("crm.leads.title", "Leads")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "crm.leads.subtitle",
              "Scored on how reachable and complete they are, plus how much they have engaged. Qualify one and it becomes an account, a contact and a deal.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setForm({ ...DEFAULT_LEAD });
            setCaptureOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("crm.leads.add", "Capture Lead")}
        </Button>
      </div>

      {summaryQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <EmptyPanel label={t("crm.leads.summary_failed", "Could not load lead summary.")} />
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("crm.leads.open", "Open leads")}
            value={n(summary.open).toLocaleString()}
            meta={t("crm.leads.total_meta", "{n} captured in total").replace(
              "{n}",
              String(n(summary.total)),
            )}
          />
          <StatTile
            label={t("crm.leads.conversion", "Conversion rate")}
            value={`${n(summary.conversion_rate_percent).toFixed(0)}%`}
            meta={t("crm.leads.converted_meta", "{n} converted").replace(
              "{n}",
              String(n(summary.converted)),
            )}
          />
          <StatTile
            label={t("crm.leads.avg_score", "Average score")}
            value={n(summary.average_score).toFixed(0)}
          />
          <StatTile
            label={t("crm.leads.pipeline_value", "Open lead value")}
            value={money(summary.pipeline_value)}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.common.status", "Status")}</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
              {LEAD_STATUSES.map((status) => (
                <SelectItem key={status} value={status} className="capitalize">
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.leads.source", "Source")}</Label>
          <Select
            value={sourceFilter}
            onValueChange={(v) => {
              setSourceFilter(v);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
              {sourceOptions.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.leads.campaign", "Campaign")}</Label>
          <Select
            value={campaignFilter}
            onValueChange={(v) => {
              setCampaignFilter(v);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="h-9 w-[11rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={String(campaign.id)}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.leads.owner", "Owner")}</Label>
          <Select
            value={ownerFilter}
            onValueChange={(v) => {
              setOwnerFilter(v);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="h-9 w-[12rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
              {(employeesQuery.data?.data ?? []).map((employee) => (
                <SelectItem key={employee.id} value={String(employee.id)}>
                  {employeeLabel(employeeById, employee.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <Switch
            id="crm-open-only"
            checked={openOnly}
            onCheckedChange={(checked) => {
              setOpenOnly(checked);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
          />
          <Label htmlFor="crm-open-only" className="text-xs">
            {t("crm.leads.open_only", "Open only")}
          </Label>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full"
          disabled={listQuery.isFetching}
          onClick={() => listQuery.refetch()}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${listQuery.isFetching ? "animate-spin" : ""}`} />
          {t("crm.common.refresh", "Refresh")}
        </Button>
      </div>

      {listQuery.isPending ? (
        <PanelTableSkeleton rows={8} cols={8} />
      ) : listQuery.isError ? (
        <div className="space-y-3">
          <EmptyPanel
            label={t(
              "crm.leads.load_failed",
              "Could not load leads. Check your connection and try again.",
            )}
          />
          <div className="flex justify-center">
            <Button variant="outline" className="rounded-full" onClick={() => listQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("crm.common.retry", "Retry")}
            </Button>
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={(listQuery.data?.data ?? []) as CrmLead[]}
          totalEntries={listQuery.data?.meta?.total ?? 0}
          loading={listQuery.isFetching && !listQuery.isPending}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("crm.leads.search", "Search leads...")}
          resourceName="crm-leads"
        />
      )}

      {/* Capture */}
      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.leads.add", "Capture Lead")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.leads.form_desc",
                  "A phone number is worth more to the score than anything else: a lead nobody can reach is worth little however large it looks.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {renderLeadFields(form, setForm, "capture")}
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCaptureOpen(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={detailId !== null} onOpenChange={(isOpen) => !isOpen && closeDetail()}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.name ?? t("crm.leads.lead", "Lead")}
              </DialogTitle>
              <DialogDescription>
                {detail
                  ? `${detail.lead_number} · ${detail.status}`
                  : t("crm.common.loading", "Loading...")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {detailQuery.isLoading ? (
              <LoadingPanel label={t("crm.common.loading", "Loading...")} />
            ) : detailQuery.isError ? (
              <EmptyPanel label={t("crm.leads.detail_failed", "Could not load this lead.")} />
            ) : detail ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {!detailEditing && detail.status !== "converted" ? (
                    <Button variant="outline" size="sm" onClick={() => setDetailEditing(true)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      {t("crm.common.edit", "Edit")}
                    </Button>
                  ) : null}
                  {detail.status === "qualified" && canConvert ? (
                    <Button size="sm" onClick={() => openConvert(detail)}>
                      {t("crm.leads.convert", "Convert")}
                    </Button>
                  ) : null}
                  {(TRANSITIONS[detail.status] ?? []).map((status) => (
                    <Button
                      key={status}
                      variant="outline"
                      size="sm"
                      className="capitalize"
                      disabled={transitioningId === detail.id}
                      onClick={() => requestTransition(detail, status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>

                {detailEditing ? (
                  renderLeadFields(detailForm, setDetailForm, "detail")
                ) : (
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">{t("crm.leads.company", "Company")}: </span>
                      {detail.company ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{t("crm.leads.phone", "Phone")}: </span>
                      {detail.phone ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{t("crm.leads.email", "Email")}: </span>
                      {detail.email ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{t("crm.leads.city", "City")}: </span>
                      {detail.city ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{t("crm.leads.source", "Source")}: </span>
                      {detail.source ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{t("crm.leads.value", "Value")}: </span>
                      {money(detail.estimated_value)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{t("crm.leads.owner", "Owner")}: </span>
                      {employeeLabel(employeeById, detail.owner_employee_id) ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{t("crm.leads.campaign", "Campaign")}: </span>
                      {detail.campaign?.name ?? "—"}
                    </p>
                    {detail.converted_account_id ? (
                      <p className="sm:col-span-2">
                        <span className="text-muted-foreground">{t("crm.leads.converted_to", "Converted to")}: </span>
                        <Link href="/dashboard/crm/accounts" className="font-medium text-primary hover:underline">
                          {t("crm.leads.account_link", "Account")} #{detail.converted_account_id}
                        </Link>
                        {detail.converted_opportunity_id ? (
                          <>
                            {" · "}
                            <Link href="/dashboard/crm/pipeline" className="font-medium text-primary hover:underline">
                              {t("crm.leads.deal_link", "Deal")} #{detail.converted_opportunity_id}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                    {detail.lost_reason ? (
                      <p className="sm:col-span-2 text-destructive">
                        {t("crm.leads.lost_reason", "Disqualify reason")}: {detail.lost_reason}
                      </p>
                    ) : null}
                    {detail.notes ? (
                      <p className="sm:col-span-2 text-muted-foreground">{detail.notes}</p>
                    ) : null}
                  </div>
                )}

                <Panel
                  title={t("crm.leads.score_breakdown", "Score breakdown")}
                  description={t(
                    "crm.leads.score_breakdown_desc",
                    "Completing activities against this lead increases engagement points.",
                  )}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, n(detail.score))}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold tabular-nums">{n(detail.score)}/100</span>
                  </div>
                  <div className="space-y-1">
                    {scoreParts.map((part) => (
                      <div key={part.label} className="flex justify-between text-xs">
                        <span className={part.earned ? "" : "text-muted-foreground"}>{part.label}</span>
                        <span className="tabular-nums">
                          {part.earned ? `+${part.points}` : `0 / ${part.points}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>

                {detail.status !== "converted" ? (
                  <Panel title={t("crm.activities.title", "Activities")}>
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t("crm.activities.type", "Type")}</Label>
                        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                          <Select
                            value={activityForm.type}
                            onValueChange={(v) =>
                              setActivityForm({ ...activityForm, type: v as (typeof ACTIVITY_TYPES)[number] })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTIVITY_TYPES.map((type) => (
                                <SelectItem key={type} value={type} className="capitalize">
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("crm.activities.due", "Due")}</Label>
                        <Input
                          type="date"
                          value={activityForm.due_at}
                          onChange={(event) =>
                            setActivityForm({ ...activityForm, due_at: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>{t("crm.activities.subject", "Subject")}</Label>
                        <Input
                          value={activityForm.subject}
                          onChange={(event) =>
                            setActivityForm({ ...activityForm, subject: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>{t("crm.activities.body", "Detail")}</Label>
                        <Textarea
                          rows={2}
                          value={activityForm.body}
                          onChange={(event) =>
                            setActivityForm({ ...activityForm, body: event.target.value })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Button
                          size="sm"
                          disabled={logActivity.isPending || !activityForm.subject.trim()}
                          onClick={() => logActivity.mutate()}
                        >
                          {logActivity.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          {t("crm.activities.add", "Log Activity")}
                        </Button>
                      </div>
                    </div>

                    {(detail.activities ?? []).length === 0 ? (
                      <p className="text-sm italic text-muted-foreground">
                        {t("crm.leads.no_activities", "No activities logged yet.")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.activities!.map((activity: CrmActivity) => (
                          <div
                            key={activity.id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium">{activity.subject}</p>
                              <p className="text-[11px] capitalize text-muted-foreground">
                                {activity.type} · {activity.status}
                                {activity.due_at
                                  ? ` · ${String(activity.due_at).slice(0, 10)}`
                                  : ""}
                              </p>
                            </div>
                            {activity.status === "planned" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px]"
                                disabled={activityBusyId === activity.id}
                                onClick={() => completeActivity.mutate(activity.id)}
                              >
                                {activityBusyId === activity.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  t("crm.activities.done", "Done")
                                )}
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>
                ) : null}
              </>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            {detailEditing ? (
              <>
                <Button variant="ghost" onClick={() => setDetailEditing(false)}>
                  {t("crm.common.cancel", "Cancel")}
                </Button>
                <Button
                  onClick={() => updateLead.mutate()}
                  disabled={updateLead.isPending || !detailForm.name.trim()}
                >
                  {updateLead.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("crm.common.save", "Save")}
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={closeDetail}>
                {t("crm.common.close", "Close")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert */}
      <Dialog
        open={convertFor !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setConvertFor(null);
            setConvertResult(null);
            setConvertForm({ ...DEFAULT_CONVERT });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {convertResult
                  ? t("crm.leads.converted_title", "Lead converted")
                  : t("crm.leads.convert", "Convert Lead")}
              </DialogTitle>
              <DialogDescription>
                {convertResult
                  ? t("crm.leads.converted_desc", "Account, contact and deal were created.")
                  : t(
                      "crm.leads.convert_desc",
                      "Creates an account, a contact and an open deal. An account of the same name is reused rather than duplicated.",
                    )}
              </DialogDescription>
            </DialogHeader>
          </div>

          {convertResult ? (
            <div className="space-y-3 px-6 py-5 text-sm">
              <p>
                {t("crm.leads.deal_created", "Deal")}{" "}
                <span className="font-semibold">{convertResult.opportunity_number}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/crm/accounts">
                    {t("crm.leads.view_account", "View accounts")}
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/dashboard/crm/pipeline">
                    {t("crm.leads.view_pipeline", "View pipeline")}
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("crm.leads.account_name", "Account name")}</Label>
                <Input
                  value={convertForm.account_name}
                  onChange={(event) =>
                    setConvertForm({ ...convertForm, account_name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("crm.leads.opportunity_name", "Deal name")}</Label>
                <Input
                  value={convertForm.opportunity_name}
                  onChange={(event) =>
                    setConvertForm({ ...convertForm, opportunity_name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.leads.deal_value", "Deal value")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={convertForm.amount}
                  onChange={(event) => setConvertForm({ ...convertForm, amount: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.leads.segment", "Segment")}</Label>
                <Input
                  value={convertForm.segment}
                  onChange={(event) => setConvertForm({ ...convertForm, segment: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.pipeline.pipeline", "Pipeline")}</Label>
                <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                  <Select
                    value={convertForm.pipeline_id || "none"}
                    onValueChange={(v) =>
                      setConvertForm({ ...convertForm, pipeline_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("crm.common.select", "Select...")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("crm.common.default", "Default")}</SelectItem>
                      {pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={String(pipeline.id)}>
                          {pipeline.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.pipeline.close_date", "Expected close")}</Label>
                <Input
                  type="date"
                  value={convertForm.expected_close_date}
                  onChange={(event) =>
                    setConvertForm({ ...convertForm, expected_close_date: event.target.value })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            {convertResult ? (
              <Button
                onClick={() => {
                  setConvertFor(null);
                  setConvertResult(null);
                  setConvertForm({ ...DEFAULT_CONVERT });
                }}
              >
                {t("crm.common.close", "Close")}
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setConvertFor(null)}>
                  {t("crm.common.cancel", "Cancel")}
                </Button>
                <Button onClick={() => convert.mutate()} disabled={convert.isPending}>
                  {convert.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("crm.leads.convert", "Convert")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disqualify */}
      <Dialog
        open={disqualifyFor !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDisqualifyFor(null);
            setLostReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.leads.disqualify", "Disqualify lead")}
              </DialogTitle>
              <DialogDescription>
                {t("crm.leads.disqualify_desc", "Record why this lead is not moving forward.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="lost-reason">{t("crm.leads.lost_reason", "Reason")}</Label>
              <Textarea
                id="lost-reason"
                rows={3}
                value={lostReason}
                onChange={(event) => setLostReason(event.target.value)}
                placeholder={t("crm.leads.lost_reason_hint", "No budget, wrong fit, unreachable...")}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDisqualifyFor(null)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={transition.isPending || !lostReason.trim()}
              onClick={() => {
                if (!disqualifyFor) return;
                transition.mutate(
                  { id: disqualifyFor.id, status: "disqualified", lost_reason: lostReason.trim() },
                  {
                    onSuccess: () => {
                      setDisqualifyFor(null);
                      setLostReason("");
                    },
                  },
                );
              }}
            >
              {transition.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.leads.disqualify", "Disqualify")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
