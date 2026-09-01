"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, RefreshCw, Settings2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { hrFetch, type Employee as HrEmployee, type Paginated as HrPaginated } from "@/modules/humanresources/api";
import { crmApi } from "@/modules/crm/api";
import type {
  CrmAccount,
  CrmActivity,
  CrmBridgeStatus,
  CrmContact,
  CrmOpportunity,
  CrmPipeline,
  CrmStage,
  CrmStageHistory,
} from "@/modules/crm/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const ACTIVITY_TYPES = ["call", "meeting", "email", "task", "note"] as const;

const DEFAULT_PIPELINE_STAGES = [
  { name: "Qualification", probability_percent: 10, is_won: false, is_lost: false },
  { name: "Needs Analysis", probability_percent: 25, is_won: false, is_lost: false },
  { name: "Proposal", probability_percent: 50, is_won: false, is_lost: false },
  { name: "Negotiation", probability_percent: 75, is_won: false, is_lost: false },
  { name: "Closed Won", probability_percent: 100, is_won: true, is_lost: false },
  { name: "Closed Lost", probability_percent: 0, is_won: false, is_lost: true },
];

const DEFAULT_DEAL = {
  name: "",
  account_id: "",
  contact_id: "",
  amount: "",
  currency: "ETB",
  probability_percent: "",
  expected_close_date: "",
  owner_employee_id: "",
  source: "",
  notes: "",
};

const DEFAULT_ACTIVITY = {
  type: "call" as (typeof ACTIVITY_TYPES)[number],
  subject: "",
  body: "",
  due_at: "",
};

const STATUS_TONE: Record<string, string> = {
  open: "secondary",
  won: "default",
  lost: "destructive",
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

function contactLabel(contact: CrmContact | undefined) {
  if (!contact) return null;
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || `#${contact.id}`;
}

function dealToForm(deal: CrmOpportunity) {
  return {
    name: deal.name,
    account_id: deal.account_id ? String(deal.account_id) : "",
    contact_id: deal.contact_id ? String(deal.contact_id) : "",
    amount: deal.amount != null ? String(deal.amount) : "",
    currency: deal.currency || "ETB",
    probability_percent:
      deal.probability_percent != null ? String(deal.probability_percent) : "",
    expected_close_date: deal.expected_close_date ? String(deal.expected_close_date).slice(0, 10) : "",
    owner_employee_id: deal.owner_employee_id ? String(deal.owner_employee_id) : "",
    source: deal.source ?? "",
    notes: deal.notes ?? "",
  };
}

function stageHistoryLabel(
  entry: CrmStageHistory,
  stageById: Map<number, CrmStage>,
  t: (key: string, fallback: string) => string,
) {
  const toName = entry.to_stage?.name ?? stageById.get(entry.to_stage_id)?.name ?? `#${entry.to_stage_id}`;
  if (entry.from_stage_id === null) {
    return t("crm.pipeline.created_at_stage_named", "Created at {stage}").replace("{stage}", toName);
  }
  const fromName =
    entry.from_stage?.name ?? stageById.get(entry.from_stage_id)?.name ?? `#${entry.from_stage_id}`;
  return t("crm.pipeline.moved_from_to", "{from} → {to}")
    .replace("{from}", fromName)
    .replace("{to}", toName);
}

export default function CrmPipelinePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canManageDeals = hasAnyPermission(["manage_crm_opportunities", "manage_crm"]);
  const canReopen = hasAnyPermission(["reopen_crm_opportunities", "manage_crm"]);
  const canQuote = hasAnyPermission(["convert_crm_to_sales", "manage_crm"]);
  const canManagePipelines = hasAnyPermission(["manage_crm_pipelines", "manage_crm"]);

  const [pipelineId, setPipelineId] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [accountFilter, setAccountFilter] = React.useState("all");
  const [ownerFilter, setOwnerFilter] = React.useState("all");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...DEFAULT_DEAL });

  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [detailEditing, setDetailEditing] = React.useState(false);
  const [detailForm, setDetailForm] = React.useState({ ...DEFAULT_DEAL });
  const [activityForm, setActivityForm] = React.useState({ ...DEFAULT_ACTIVITY });

  const [lostFor, setLostFor] = React.useState<{ deal: CrmOpportunity; stageId: number } | null>(null);
  const [lostReason, setLostReason] = React.useState("");
  const [wonFor, setWonFor] = React.useState<{ deal: CrmOpportunity; stageId: number } | null>(null);

  const [movingId, setMovingId] = React.useState<number | null>(null);
  const [reopeningId, setReopeningId] = React.useState<number | null>(null);
  const [quotingId, setQuotingId] = React.useState<number | null>(null);
  const [activityBusyId, setActivityBusyId] = React.useState<number | null>(null);

  const [pipelineManageOpen, setPipelineManageOpen] = React.useState(false);
  const [stageDraft, setStageDraft] = React.useState(DEFAULT_PIPELINE_STAGES);
  const [newPipeline, setNewPipeline] = React.useState({ code: "", name: "" });

  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => crmApi.listPipelines({ limit: 50 }).then((res) => res.data),
  });

  const pipelines = (pipelinesQuery.data?.data ?? []) as CrmPipeline[];
  const activePipeline =
    pipelines.find((p) => p.id === pipelineId) ?? pipelines.find((p) => p.is_default) ?? pipelines[0];
  const activePipelineId = activePipeline?.id ?? null;
  const stages = activePipeline?.stages ?? [];

  React.useEffect(() => {
    if (pipelines.length > 0 && pipelineId === null) {
      const defaultPipeline = pipelines.find((p) => p.is_default) ?? pipelines[0];
      setPipelineId(defaultPipeline.id);
    }
  }, [pipelines, pipelineId]);

  React.useEffect(() => {
    if (pipelineManageOpen && activePipeline?.stages?.length) {
      setStageDraft(
        activePipeline.stages.map((stage) => ({
          name: stage.name,
          probability_percent: stage.probability_percent,
          is_won: stage.is_won,
          is_lost: stage.is_lost,
        })),
      );
    }
  }, [pipelineManageOpen, activePipeline]);

  const dealsQuery = useQuery({
    queryKey: [
      "crm",
      "opportunities",
      activePipelineId,
      search,
      statusFilter,
      accountFilter,
      ownerFilter,
    ],
    queryFn: () =>
      crmApi
        .listOpportunities({
          limit: 200,
          pipeline_id: activePipelineId ?? undefined,
          search: search || undefined,
          account_id: accountFilter !== "all" ? Number(accountFilter) : undefined,
          owner_employee_id: ownerFilter !== "all" ? Number(ownerFilter) : undefined,
        })
        .then((res) => res.data),
    enabled: activePipelineId !== null,
  });

  const accountsQuery = useQuery({
    queryKey: ["crm", "account-options"],
    queryFn: () => crmApi.listAccounts({ limit: 200 }).then((res) => res.data),
  });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contact-options", form.account_id || detailForm.account_id],
    queryFn: () =>
      crmApi
        .listContacts({
          limit: 200,
          account_id: Number(form.account_id || detailForm.account_id),
        })
        .then((res) => res.data),
    enabled: Boolean(form.account_id || detailForm.account_id),
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", "crm-pipeline"],
    queryFn: () => hrFetch<HrPaginated<HrEmployee>>("/employees?per_page=200"),
  });

  const bridgeQuery = useQuery({
    queryKey: ["crm", "bridge-status"],
    queryFn: () => crmApi.bridgeStatus().then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["crm", "opportunity", detailId],
    queryFn: () => crmApi.getOpportunity(detailId!).then((res) => res.data?.data as CrmOpportunity),
    enabled: detailId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["crm"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const deals = (dealsQuery.data?.data ?? []) as CrmOpportunity[];
  const accounts = (accountsQuery.data?.data ?? []) as CrmAccount[];
  const contacts = (contactsQuery.data?.data ?? []) as CrmContact[];
  const bridge: CrmBridgeStatus | undefined = bridgeQuery.data?.data;
  const detail = detailQuery.data;

  const employeeById = React.useMemo(() => {
    const rows = employeesQuery.data?.data ?? [];
    return new Map(rows.map((employee) => [employee.id, employee]));
  }, [employeesQuery.data]);

  const stageById = React.useMemo(() => {
    const allStages = detail?.pipeline?.stages ?? stages;
    return new Map(allStages.map((stage) => [stage.id, stage]));
  }, [detail?.pipeline?.stages, stages]);

  const buildDealPayload = (values: typeof DEFAULT_DEAL) => ({
    name: values.name,
    account_id: values.account_id ? Number(values.account_id) : null,
    contact_id: values.contact_id ? Number(values.contact_id) : null,
    amount: values.amount ? Number(values.amount) : 0,
    currency: values.currency || "ETB",
    probability_percent: values.probability_percent ? Number(values.probability_percent) : null,
    expected_close_date: values.expected_close_date || null,
    owner_employee_id: values.owner_employee_id ? Number(values.owner_employee_id) : null,
    source: values.source || null,
    notes: values.notes || null,
  });

  const create = useMutation({
    mutationFn: () =>
      crmApi.createOpportunity({
        ...buildDealPayload(form),
        pipeline_id: activePipelineId,
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("crm.pipeline.created", "Deal created."));
      invalidate();
      setCreateOpen(false);
      setForm({ ...DEFAULT_DEAL });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.create_failed", "Could not create the deal."))),
  });

  const updateDeal = useMutation({
    mutationFn: () => crmApi.updateOpportunity(detailId!, buildDealPayload(detailForm)),
    onSuccess: () => {
      toast.success(t("crm.pipeline.updated", "Deal updated."));
      setDetailEditing(false);
      invalidate();
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.update_failed", "Could not update the deal."))),
  });

  const move = useMutation({
    mutationFn: ({ id, stageId, reason }: { id: number; stageId: number; reason?: string }) => {
      setMovingId(id);
      return crmApi.moveStage(id, stageId, reason);
    },
    onSuccess: () => {
      toast.success(t("crm.pipeline.moved", "Deal moved."));
      invalidate();
      setLostFor(null);
      setLostReason("");
      setWonFor(null);
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.move_failed", "That move was refused."))),
    onSettled: () => setMovingId(null),
  });

  const reopen = useMutation({
    mutationFn: (id: number) => {
      setReopeningId(id);
      return crmApi.reopenOpportunity(id);
    },
    onSuccess: () => {
      toast.success(t("crm.pipeline.reopened", "Deal reopened onto a working stage."));
      invalidate();
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.status === 403
          ? t(
              "crm.pipeline.reopen_forbidden",
              "You need reopen permission to reverse a closed deal.",
            )
          : errorText(error, t("crm.pipeline.reopen_failed", "Could not reopen it.")),
      ),
    onSettled: () => setReopeningId(null),
  });

  const quote = useMutation({
    mutationFn: (id: number) => {
      setQuotingId(id);
      return crmApi.createQuotation(id);
    },
    onSuccess: (response: any) => {
      const data = response?.data?.data;
      toast[data?.created ? "success" : "info"](
        data?.created
          ? t("crm.pipeline.quoted", "Quotation raised in Sales.")
          : (data?.reason ?? t("crm.pipeline.no_quote", "No quotation was raised.")),
      );
      invalidate();
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.status === 403
          ? t(
              "crm.pipeline.quote_forbidden",
              "You need Sales conversion permission to raise a quotation.",
            )
          : errorText(error, t("crm.pipeline.quote_failed", "Could not raise the quotation.")),
      ),
    onSettled: () => setQuotingId(null),
  });

  const logActivity = useMutation({
    mutationFn: () =>
      crmApi.createActivity({
        type: activityForm.type,
        subject: activityForm.subject,
        body: activityForm.body || null,
        opportunity_id: detailId,
        due_at: activityForm.due_at || null,
        owner_employee_id: detail?.owner_employee_id ?? null,
      }),
    onSuccess: () => {
      toast.success(t("crm.activities.logged", "Activity logged."));
      setActivityForm({ ...DEFAULT_ACTIVITY });
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
      detailQuery.refetch();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not complete it.")),
    onSettled: () => setActivityBusyId(null),
  });

  const saveStages = useMutation({
    mutationFn: () => crmApi.updateStages(activePipelineId!, stageDraft),
    onSuccess: () => {
      toast.success(t("crm.pipeline.stages_saved", "Pipeline stages updated."));
      invalidate();
      pipelinesQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.stages_failed", "Could not update stages."))),
  });

  const createPipeline = useMutation({
    mutationFn: () =>
      crmApi.createPipeline({
        code: newPipeline.code.trim().toUpperCase(),
        name: newPipeline.name.trim(),
        stages: DEFAULT_PIPELINE_STAGES,
      }),
    onSuccess: () => {
      toast.success(t("crm.pipeline.pipeline_created", "Pipeline created."));
      setNewPipeline({ code: "", name: "" });
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.pipeline_create_failed", "Could not create pipeline."))),
  });

  const makeDefault = useMutation({
    mutationFn: () => crmApi.makeDefaultPipeline(activePipelineId!),
    onSuccess: () => {
      toast.success(t("crm.pipeline.default_set", "Default pipeline updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.default_failed", "Could not set default pipeline."))),
  });

  const requestMove = React.useCallback(
    (deal: CrmOpportunity, target: CrmStage) => {
      if (target.is_lost) {
        setLostReason(deal.lost_reason ?? "");
        setLostFor({ deal, stageId: target.id });
        return;
      }
      if (target.is_won) {
        setWonFor({ deal, stageId: target.id });
        return;
      }
      move.mutate({ id: deal.id, stageId: target.id });
    },
    [move],
  );

  const openDetail = React.useCallback((deal: CrmOpportunity) => {
    setDetailId(deal.id);
    setDetailEditing(false);
  }, []);

  const closeDetail = React.useCallback(() => {
    setDetailId(null);
    setDetailEditing(false);
    setActivityForm({ ...DEFAULT_ACTIVITY });
  }, []);

  React.useEffect(() => {
    if (detail && !detailEditing) {
      setDetailForm(dealToForm(detail));
    }
  }, [detail, detailEditing]);

  const workingStages = stages.filter((stage) => !stage.is_won && !stage.is_lost);
  const openDeals = deals.filter((deal) => deal.status === "open");
  const closedDeals = deals.filter((deal) => {
    if (deal.status === "open") return false;
    if (statusFilter === "won") return deal.status === "won";
    if (statusFilter === "lost") return deal.status === "lost";
    if (statusFilter === "open") return false;
    return true;
  });
  const showBoard = statusFilter === "all" || statusFilter === "open";
  const showClosed = statusFilter === "all" || statusFilter === "won" || statusFilter === "lost";
  const displayCurrency = openDeals[0]?.currency ?? detail?.currency ?? "ETB";

  const renderDealFields = (
    values: typeof DEFAULT_DEAL,
    onChange: (next: typeof DEFAULT_DEAL) => void,
    idPrefix: string,
    accountIdForContacts: string,
  ) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>{t("crm.common.name", "Name")}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("crm.pipeline.account", "Account")}</Label>
        <Select
          value={values.account_id || "none"}
          onValueChange={(v) =>
            onChange({ ...values, account_id: v === "none" ? "" : v, contact_id: "" })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t("crm.common.none", "None")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("crm.common.none", "None")}</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={String(account.id)}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t("crm.pipeline.contact", "Contact")}</Label>
        <Select
          value={values.contact_id || "none"}
          onValueChange={(v) => onChange({ ...values, contact_id: v === "none" ? "" : v })}
          disabled={!accountIdForContacts}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("crm.common.none", "None")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("crm.common.none", "None")}</SelectItem>
            {contacts.map((contact) => (
              <SelectItem key={contact.id} value={String(contact.id)}>
                {contactLabel(contact)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-amount`}>{t("crm.pipeline.value", "Value")}</Label>
        <Input
          id={`${idPrefix}-amount`}
          type="number"
          min={0}
          value={values.amount}
          onChange={(event) => onChange({ ...values, amount: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-currency`}>{t("crm.pipeline.currency", "Currency")}</Label>
        <Input
          id={`${idPrefix}-currency`}
          maxLength={3}
          value={values.currency}
          onChange={(event) =>
            onChange({ ...values, currency: event.target.value.toUpperCase().slice(0, 3) })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-probability`}>
          {t("crm.pipeline.probability_override", "Probability override %")}
        </Label>
        <Input
          id={`${idPrefix}-probability`}
          type="number"
          min={0}
          max={100}
          placeholder={t("crm.pipeline.stage_default", "Use stage default")}
          value={values.probability_percent}
          onChange={(event) => onChange({ ...values, probability_percent: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-close`}>{t("crm.pipeline.expected_close", "Expected close")}</Label>
        <Input
          id={`${idPrefix}-close`}
          type="date"
          value={values.expected_close_date}
          onChange={(event) => onChange({ ...values, expected_close_date: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("crm.leads.owner", "Owner")}</Label>
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
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-source`}>{t("crm.leads.source", "Source")}</Label>
        <Input
          id={`${idPrefix}-source`}
          value={values.source}
          onChange={(event) => onChange({ ...values, source: event.target.value })}
        />
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
          <h1 className="text-3xl font-black tracking-tight">
            {t("crm.pipeline.title", "Deal Pipeline")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "crm.pipeline.subtitle",
              "Every stage change is recorded, which is what makes stage ageing and cycle time answerable after the fact.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pipelines.length > 0 ? (
            <Select
              value={activePipelineId ? String(activePipelineId) : "none"}
              onValueChange={(v) => setPipelineId(Number(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("crm.overview.pipeline", "Pipeline")} />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={String(pipeline.id)}>
                    {pipeline.name}
                    {pipeline.is_default ? ` (${t("crm.pipeline.default", "default")})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {canManagePipelines ? (
            <Button variant="outline" className="rounded-full" onClick={() => setPipelineManageOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              {t("crm.pipeline.manage", "Manage")}
            </Button>
          ) : null}
          {canManageDeals ? (
            <Button
              className="rounded-full px-5"
              onClick={() => {
                setForm({ ...DEFAULT_DEAL });
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("crm.pipeline.add", "New Deal")}
            </Button>
          ) : null}
        </div>
      </div>

      {bridge && !bridge.sales?.available ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "crm.pipeline.no_sales",
            "Sales is not installed, so a won deal closes here rather than becoming a quotation.",
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label className="text-xs">{t("crm.common.search", "Search")}</Label>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("crm.pipeline.search_hint", "Deal name, number or account...")}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
              <SelectItem value="open">{t("crm.pipeline.open", "Open")}</SelectItem>
              <SelectItem value="won">{t("crm.pipeline.won", "Won")}</SelectItem>
              <SelectItem value="lost">{t("crm.pipeline.lost", "Lost")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.pipeline.account", "Account")}</Label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.leads.owner", "Owner")}</Label>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px]">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t("crm.pipeline.open_deals", "Open deals")}
          value={openDeals.length.toLocaleString()}
        />
        <StatTile
          label={t("crm.pipeline.open_value", "Open value")}
          value={money(openDeals.reduce((total, deal) => total + n(deal.amount), 0), displayCurrency)}
        />
        <StatTile
          label={t("crm.pipeline.weighted", "Weighted")}
          value={money(
            openDeals.reduce((total, deal) => total + n(deal.weighted_amount), 0),
            displayCurrency,
          )}
        />
        <StatTile
          label={t("crm.pipeline.overdue", "Past close date")}
          value={openDeals.filter((deal) => deal.is_overdue).length.toLocaleString()}
          alert={openDeals.some((deal) => deal.is_overdue)}
        />
      </div>

      {pipelinesQuery.isError ? (
        <EmptyPanel label={t("crm.pipeline.load_failed", "Could not load pipelines.")} />
      ) : dealsQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("crm.pipeline.deals_failed", "Could not load deals for this pipeline.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => dealsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("crm.common.retry", "Retry")}
          </Button>
        </div>
      ) : !showBoard ? null : dealsQuery.isLoading ? (
        <LoadingPanel label={t("crm.common.loading", "Loading the pipeline...")} />
      ) : workingStages.length === 0 ? (
        <EmptyPanel label={t("crm.pipeline.no_stages", "This pipeline has no working stages.")} />
      ) : (
        <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              {workingStages.map((stage) => {
                const inStage = openDeals.filter((deal) => deal.stage_id === stage.id);
                const value = inStage.reduce((total, deal) => total + n(deal.amount), 0);

                return (
                  <div
                    key={stage.id}
                    className="w-72 shrink-0 rounded-2xl border border-border/60 bg-card p-3"
                  >
                    <div className="mb-3 flex items-baseline justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{stage.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {stage.probability_percent}% · {money(value, displayCurrency)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                        {inStage.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {inStage.length === 0 ? (
                        <p className="py-6 text-center text-xs italic text-muted-foreground">
                          {t("crm.pipeline.empty_stage", "Nothing here")}
                        </p>
                      ) : (
                        inStage.map((deal) => (
                          <div
                            key={deal.id}
                            className="rounded-xl border border-border/50 bg-background p-2.5"
                          >
                            <button
                              type="button"
                              onClick={() => openDetail(deal)}
                              className="block w-full text-left"
                            >
                              <p className="truncate text-sm font-semibold">{deal.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {deal.account?.name ?? deal.opportunity_number}
                              </p>
                              <p className="mt-1 text-xs font-bold tabular-nums">
                                {money(deal.amount, deal.currency)}
                              </p>
                              {deal.is_overdue ? (
                                <Badge variant="destructive" className="mt-1 text-[10px]">
                                  {t("crm.pipeline.overdue_badge", "Overdue")}
                                </Badge>
                              ) : null}
                            </button>

                            {canManageDeals ? (
                              <Select
                                value=""
                                onValueChange={(value) => {
                                  const target = stages.find((s) => s.id === Number(value));
                                  if (!target) return;
                                  requestMove(deal, target);
                                }}
                                disabled={movingId === deal.id}
                              >
                                <SelectTrigger className="mt-2 h-7 text-[11px]">
                                  <SelectValue
                                    placeholder={
                                      movingId === deal.id
                                        ? t("crm.common.working", "Working...")
                                        : t("crm.pipeline.move_to", "Move to...")
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {stages
                                    .filter((s) => s.id !== deal.stage_id)
                                    .map((s) => (
                                      <SelectItem key={s.id} value={String(s.id)}>
                                        {s.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
      )}

      {showClosed ? (
      <Panel
        title={t("crm.pipeline.closed", "Closed deals")}
        description={t("crm.pipeline.closed_desc", "Won and lost, with the reason where one was given.")}
      >
        {closedDeals.length === 0 ? (
          <EmptyPanel label={t("crm.pipeline.none_closed", "No deals closed yet.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-semibold">{t("crm.pipeline.deal", "Deal")}</th>
                  <th className="pb-2 font-semibold">{t("crm.pipeline.account", "Account")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">{t("crm.pipeline.value", "Value")}</th>
                  <th className="pb-2 font-semibold">{t("crm.common.status", "Status")}</th>
                  <th className="pb-2 font-semibold">{t("crm.pipeline.reason", "Reason")}</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {closedDeals.map((deal) => (
                    <tr key={deal.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2">
                        <button
                          type="button"
                          className="font-medium hover:underline"
                          onClick={() => openDetail(deal)}
                        >
                          {deal.name}
                        </button>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{deal.account?.name ?? "—"}</td>
                      <td className="py-2 pr-6 text-right tabular-nums">
                        {money(deal.amount, deal.currency)}
                      </td>
                      <td className="py-2">
                        <Badge
                          variant={(STATUS_TONE[deal.status] ?? "outline") as any}
                          className="text-[11px] capitalize"
                        >
                          {deal.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{deal.lost_reason ?? "—"}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {deal.status === "won" && canQuote && bridge?.sales?.available ? (
                            deal.quotation_id ? (
                              <Button asChild size="sm" variant="outline" className="text-[11px]">
                                <Link href="/dashboard/sales/quotations">
                                  {t("crm.pipeline.view_quote", "Quote #{id}").replace(
                                    "{id}",
                                    String(deal.quotation_id),
                                  )}
                                </Link>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px]"
                                disabled={quotingId === deal.id}
                                onClick={() => quote.mutate(deal.id)}
                              >
                                {quotingId === deal.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  t("crm.pipeline.raise_quote", "Raise quote")
                                )}
                              </Button>
                            )
                          ) : null}
                          {canReopen ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[11px]"
                              disabled={reopeningId === deal.id}
                              onClick={() => reopen.mutate(deal.id)}
                            >
                              {reopeningId === deal.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                t("crm.pipeline.reopen", "Reopen")
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.pipeline.add", "New Deal")}
              </DialogTitle>
              <DialogDescription>
                {t("crm.pipeline.form_desc", "Lands on the first working stage of the pipeline.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {renderDealFields(form, setForm, "create", form.account_id)}
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lostFor !== null} onOpenChange={(isOpen) => !isOpen && setLostFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.pipeline.mark_lost", "Mark as lost")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.pipeline.lost_desc",
                  "Why a deal was lost is the most useful thing this module records.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="lost-reason">{t("crm.pipeline.reason", "Reason")}</Label>
              <Input
                id="lost-reason"
                value={lostReason}
                onChange={(event) => setLostReason(event.target.value)}
                placeholder={t("crm.pipeline.reason_hint", "Price, timing, competitor, no budget")}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setLostFor(null)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() =>
                move.mutate({
                  id: lostFor!.deal.id,
                  stageId: lostFor!.stageId,
                  reason: lostReason.trim() || undefined,
                })
              }
              disabled={move.isPending || !lostReason.trim()}
            >
              {move.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.pipeline.mark_lost", "Mark as lost")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wonFor !== null} onOpenChange={(isOpen) => !isOpen && setWonFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.pipeline.mark_won", "Mark as won")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.pipeline.won_desc",
                  "This closes the deal. You can raise a Sales quotation afterwards if Sales is installed.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setWonFor(null)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() =>
                move.mutate({ id: wonFor!.deal.id, stageId: wonFor!.stageId })
              }
              disabled={move.isPending}
            >
              {move.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.pipeline.mark_won", "Mark as won")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailId !== null} onOpenChange={(isOpen) => !isOpen && closeDetail()}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.name ?? t("crm.pipeline.deal", "Deal")}
              </DialogTitle>
              <DialogDescription>
                {detail
                  ? `${detail.opportunity_number} · ${money(detail.amount, detail.currency)}`
                  : t("crm.common.loading", "Loading...")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            {detailQuery.isLoading ? (
              <LoadingPanel label={t("crm.common.loading", "Loading...")} />
            ) : detailQuery.isError ? (
              <EmptyPanel label={t("crm.pipeline.detail_failed", "Could not load this deal.")} />
            ) : detail ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {canManageDeals && detail.status === "open" && !detailEditing ? (
                    <Button size="sm" variant="outline" onClick={() => setDetailEditing(true)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      {t("crm.common.edit", "Edit")}
                    </Button>
                  ) : null}
                  {canManageDeals && detail.status === "open" ? (
                    <Select
                      value=""
                      onValueChange={(value) => {
                        const target = (detail.pipeline?.stages ?? stages).find(
                          (s) => s.id === Number(value),
                        );
                        if (!target) return;
                        requestMove(detail, target);
                      }}
                      disabled={movingId === detail.id}
                    >
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder={t("crm.pipeline.move_to", "Move to...")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(detail.pipeline?.stages ?? stages)
                          .filter((s) => s.id !== detail.stage_id)
                          .map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {detail.status === "won" && canQuote && bridge?.sales?.available ? (
                    detail.quotation_id ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/sales/quotations">
                          {t("crm.pipeline.view_quote", "Quote #{id}").replace(
                            "{id}",
                            String(detail.quotation_id),
                          )}
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={quotingId === detail.id}
                        onClick={() => quote.mutate(detail.id)}
                      >
                        {t("crm.pipeline.raise_quote", "Raise quote")}
                      </Button>
                    )
                  ) : null}
                  {detail.status !== "open" && canReopen ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={reopeningId === detail.id}
                      onClick={() => reopen.mutate(detail.id)}
                    >
                      {t("crm.pipeline.reopen", "Reopen")}
                    </Button>
                  ) : null}
                </div>

                {detailEditing ? (
                  renderDealFields(detailForm, setDetailForm, "detail", detailForm.account_id)
                ) : (
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">{t("crm.pipeline.account", "Account")}: </span>
                      {detail.account?.name ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("crm.pipeline.contact", "Contact")}: </span>
                      {contactLabel(detail.contact) ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("crm.leads.owner", "Owner")}: </span>
                      {employeeLabel(employeeById, detail.owner_employee_id) ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t("crm.pipeline.expected_close", "Expected close")}:{" "}
                      </span>
                      {detail.expected_close_date
                        ? String(detail.expected_close_date).slice(0, 10)
                        : "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("crm.leads.source", "Source")}: </span>
                      {detail.source ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t("crm.pipeline.probability_override", "Probability")}:{" "}
                      </span>
                      {n(detail.effective_probability)}%
                    </div>
                    {detail.notes ? (
                      <p className="sm:col-span-2 text-muted-foreground">{detail.notes}</p>
                    ) : null}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile
                    label={t("crm.pipeline.stage", "Stage")}
                    value={detail.stage?.name ?? "—"}
                    meta={`${n(detail.effective_probability)}%`}
                  />
                  <StatTile
                    label={t("crm.pipeline.weighted", "Weighted")}
                    value={money(detail.weighted_amount, detail.currency)}
                  />
                  <StatTile
                    label={t("crm.pipeline.age", "Age")}
                    value={t("crm.overview.days", "{n} days").replace("{n}", String(n(detail.age_days)))}
                    alert={detail.is_overdue}
                  />
                </div>

                <Panel title={t("crm.pipeline.history", "Stage history")}>
                  {(detail.stage_history ?? []).length === 0 ? (
                    <EmptyPanel label={t("crm.pipeline.no_history", "No movement recorded.")} />
                  ) : (
                    <div className="space-y-1.5">
                      {detail.stage_history!.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                        >
                          <span>{stageHistoryLabel(entry, stageById, t)}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {String(entry.changed_at).slice(0, 10)}
                            {entry.days_in_previous_stage > 0
                              ? ` · ${t("crm.pipeline.after_days", "after {n} days").replace(
                                  "{n}",
                                  String(entry.days_in_previous_stage),
                                )}`
                              : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                {detail.status === "open" ? (
                  <Panel title={t("crm.activities.title", "Activities")}>
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t("crm.activities.type", "Type")}</Label>
                        <Select
                          value={activityForm.type}
                          onValueChange={(v) =>
                            setActivityForm({
                              ...activityForm,
                              type: v as (typeof ACTIVITY_TYPES)[number],
                            })
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
                                {activity.due_at ? ` · ${String(activity.due_at).slice(0, 10)}` : ""}
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
                  onClick={() => updateDeal.mutate()}
                  disabled={updateDeal.isPending || !detailForm.name.trim()}
                >
                  {updateDeal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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

      <Dialog open={pipelineManageOpen} onOpenChange={setPipelineManageOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.pipeline.manage_title", "Manage pipelines")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.pipeline.manage_desc",
                  "Stages can only be rebuilt when no deals are sitting on them. Each pipeline needs one won and one lost stage.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[65vh] space-y-6 overflow-y-auto px-6 py-5">
            {activePipeline ? (
              <Panel title={activePipeline.name}>
                <div className="mb-4 flex flex-wrap gap-2">
                  {!activePipeline.is_default ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={makeDefault.isPending}
                      onClick={() => makeDefault.mutate()}
                    >
                      {t("crm.pipeline.make_default", "Make default")}
                    </Button>
                  ) : (
                    <Badge variant="secondary">{t("crm.pipeline.default", "default")}</Badge>
                  )}
                </div>

                <div className="space-y-3">
                  {stageDraft.map((stage, index) => (
                    <div key={index} className="grid gap-2 rounded-xl border border-border/50 p-3 sm:grid-cols-4">
                      <Input
                        value={stage.name}
                        onChange={(event) => {
                          const next = [...stageDraft];
                          next[index] = { ...stage, name: event.target.value };
                          setStageDraft(next);
                        }}
                      />
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={stage.probability_percent}
                        onChange={(event) => {
                          const next = [...stageDraft];
                          next[index] = {
                            ...stage,
                            probability_percent: Number(event.target.value),
                          };
                          setStageDraft(next);
                        }}
                      />
                      <div className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={stage.is_won}
                          onCheckedChange={(checked) => {
                            const next = [...stageDraft];
                            next[index] = { ...stage, is_won: checked, is_lost: checked ? false : stage.is_lost };
                            setStageDraft(next);
                          }}
                        />
                        <span>{t("crm.pipeline.won_stage", "Won")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={stage.is_lost}
                          onCheckedChange={(checked) => {
                            const next = [...stageDraft];
                            next[index] = { ...stage, is_lost: checked, is_won: checked ? false : stage.is_won };
                            setStageDraft(next);
                          }}
                        />
                        <span>{t("crm.pipeline.lost_stage", "Lost")}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  className="mt-4"
                  size="sm"
                  disabled={saveStages.isPending}
                  onClick={() => saveStages.mutate()}
                >
                  {saveStages.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("crm.pipeline.save_stages", "Save stages")}
                </Button>
              </Panel>
            ) : null}

            <Panel title={t("crm.pipeline.new_pipeline", "New pipeline")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("crm.pipeline.code", "Code")}</Label>
                  <Input
                    value={newPipeline.code}
                    onChange={(event) => setNewPipeline({ ...newPipeline, code: event.target.value })}
                    placeholder="RETAIL"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("crm.common.name", "Name")}</Label>
                  <Input
                    value={newPipeline.name}
                    onChange={(event) => setNewPipeline({ ...newPipeline, name: event.target.value })}
                  />
                </div>
              </div>
              <Button
                className="mt-4"
                size="sm"
                disabled={
                  createPipeline.isPending || !newPipeline.code.trim() || !newPipeline.name.trim()
                }
                onClick={() => createPipeline.mutate()}
              >
                {createPipeline.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("crm.pipeline.create_pipeline", "Create with default stages")}
              </Button>
            </Panel>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setPipelineManageOpen(false)}>
              {t("crm.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
