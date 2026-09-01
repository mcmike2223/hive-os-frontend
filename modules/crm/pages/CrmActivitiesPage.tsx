"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Plus, RefreshCw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { hrFetch, type Employee as HrEmployee, type Paginated as HrPaginated } from "@/modules/humanresources/api";
import { crmApi } from "@/modules/crm/api";
import type {
  CrmAccount,
  CrmActivity,
  CrmContact,
  CrmLead,
  CrmOpportunity,
} from "@/modules/crm/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const TYPES = ["call", "meeting", "email", "task", "note"] as const;
const STATUSES = ["planned", "done", "cancelled"] as const;

type RelationKind = "lead" | "account" | "contact" | "opportunity";
type QuickFilter = "outstanding" | "overdue" | "all";

const STATUS_TONE: Record<string, string> = {
  planned: "secondary",
  done: "default",
  cancelled: "outline",
};

const DEFAULT_FORM = {
  type: "call" as (typeof TYPES)[number],
  subject: "",
  body: "",
  relation: "lead" as RelationKind,
  relation_id: "",
  due_at: "",
  owner_employee_id: "",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function employeeLabel(employees: Map<number, HrEmployee>, id: number | null | undefined) {
  if (id == null) return null;
  const employee = employees.get(id);
  if (employee) return `${employee.primary_name} (${employee.employee_number})`;
  return `#${id}`;
}

function contactLabel(contact: CrmContact) {
  if (contact.full_name) return contact.full_name;
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  if (name) return name;
  if (contact.email) return contact.email;
  return `#${contact.id}`;
}

function relatedRecord(activity: CrmActivity) {
  if (activity.opportunity) {
    return {
      href: "/dashboard/crm/pipeline",
      label: activity.opportunity.name,
      kind: "deal" as const,
    };
  }
  if (activity.lead) {
    return { href: "/dashboard/crm/leads", label: activity.lead.name, kind: "lead" as const };
  }
  if (activity.contact) {
    return {
      href: "/dashboard/crm/accounts",
      label: contactLabel(activity.contact),
      kind: "contact" as const,
    };
  }
  if (activity.account) {
    return {
      href: "/dashboard/crm/accounts",
      label: activity.account.name,
      kind: "account" as const,
    };
  }
  if (activity.opportunity_id) return { href: "/dashboard/crm/pipeline", label: `Deal #${activity.opportunity_id}`, kind: "deal" as const };
  if (activity.lead_id) return { href: "/dashboard/crm/leads", label: `Lead #${activity.lead_id}`, kind: "lead" as const };
  if (activity.contact_id) return { href: "/dashboard/crm/accounts", label: `Contact #${activity.contact_id}`, kind: "contact" as const };
  if (activity.account_id) return { href: "/dashboard/crm/accounts", label: `Account #${activity.account_id}`, kind: "account" as const };
  return null;
}

function relationIdKey(relation: RelationKind) {
  return `${relation}_id` as const;
}

export default function CrmActivitiesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canLog = hasAnyPermission(["log_crm_activities", "manage_crm"]);

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>("outstanding");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [relationKind, setRelationKind] = React.useState<"all" | RelationKind>("all");
  const [relationId, setRelationId] = React.useState("all");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...DEFAULT_FORM });

  const [detail, setDetail] = React.useState<CrmActivity | null>(null);
  const [completeFor, setCompleteFor] = React.useState<CrmActivity | null>(null);
  const [completeOutcome, setCompleteOutcome] = React.useState("");
  const [completeDuration, setCompleteDuration] = React.useState("");
  const [cancelFor, setCancelFor] = React.useState<CrmActivity | null>(null);

  const [completeBusyId, setCompleteBusyId] = React.useState<number | null>(null);
  const [cancelBusyId, setCancelBusyId] = React.useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: [
      "crm",
      "activities",
      tableQuery,
      quickFilter,
      typeFilter,
      statusFilter,
      ownerFilter,
      relationKind,
      relationId,
    ],
    queryFn: () =>
      crmApi
        .listActivities({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          type: typeFilter !== "all" ? typeFilter : undefined,
          status: quickFilter === "all" && statusFilter !== "all" ? statusFilter : undefined,
          owner_employee_id: ownerFilter !== "all" ? Number(ownerFilter) : undefined,
          ...(quickFilter === "outstanding" ? { outstanding_only: 1 } : {}),
          ...(quickFilter === "overdue" ? { overdue_only: 1 } : {}),
          ...(relationKind !== "all" && relationId !== "all"
            ? { [relationIdKey(relationKind)]: Number(relationId) }
            : {}),
        })
        .then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["crm", "overview-activities"],
    queryFn: () => crmApi.overview().then((res) => res.data),
  });

  const leadsQuery = useQuery({
    queryKey: ["crm", "lead-options", "activities"],
    queryFn: () => crmApi.listLeads({ limit: 200, open_only: 1 }).then((res) => res.data),
  });

  const accountsQuery = useQuery({
    queryKey: ["crm", "account-options"],
    queryFn: () => crmApi.listAccounts({ limit: 200 }).then((res) => res.data),
  });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contact-options", "activities"],
    queryFn: () => crmApi.listContacts({ limit: 200 }).then((res) => res.data),
  });

  const dealsQuery = useQuery({
    queryKey: ["crm", "deal-options", "activities"],
    queryFn: () => crmApi.listOpportunities({ limit: 200, open_only: 1 }).then((res) => res.data),
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", "crm-activities"],
    queryFn: () => hrFetch<HrPaginated<HrEmployee>>("/employees?per_page=200"),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["crm"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      crmApi.createActivity({
        type: form.type,
        subject: form.subject,
        body: form.body || null,
        [relationIdKey(form.relation)]: Number(form.relation_id),
        due_at: form.due_at || null,
        owner_employee_id: form.owner_employee_id ? Number(form.owner_employee_id) : null,
      }),
    onSuccess: () => {
      toast.success(t("crm.activities.logged", "Activity logged."));
      invalidate();
      setCreateOpen(false);
      setForm({ ...DEFAULT_FORM });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.activities.log_failed", "Could not log the activity."))),
  });

  const complete = useMutation({
    mutationFn: ({ id, outcome, duration_minutes }: { id: number; outcome?: string; duration_minutes?: number }) => {
      setCompleteBusyId(id);
      return crmApi.completeActivity(id, {
        ...(outcome ? { outcome } : {}),
        ...(duration_minutes != null ? { duration_minutes } : {}),
      });
    },
    onSuccess: () => {
      toast.success(t("crm.activities.completed", "Marked done."));
      invalidate();
      setCompleteFor(null);
      setCompleteOutcome("");
      setCompleteDuration("");
      setDetail(null);
    },
    onError: (error: any) => toast.error(errorText(error, "Could not complete it.")),
    onSettled: () => setCompleteBusyId(null),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => {
      setCancelBusyId(id);
      return crmApi.cancelActivity(id);
    },
    onSuccess: () => {
      toast.success(t("crm.activities.cancelled", "Cancelled."));
      invalidate();
      setCancelFor(null);
      setDetail(null);
    },
    onError: (error: any) => toast.error(errorText(error, "Could not cancel it.")),
    onSettled: () => setCancelBusyId(null),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const summary = overviewQuery.data?.data?.activities;
  const leads = (leadsQuery.data?.data ?? []) as CrmLead[];
  const accounts = (accountsQuery.data?.data ?? []) as CrmAccount[];
  const contacts = (contactsQuery.data?.data ?? []) as CrmContact[];
  const deals = (dealsQuery.data?.data ?? []) as CrmOpportunity[];

  const employeeById = React.useMemo(() => {
    const rows = employeesQuery.data?.data ?? [];
    return new Map(rows.map((employee) => [employee.id, employee]));
  }, [employeesQuery.data]);

  const relationOptions = React.useMemo(() => {
    if (form.relation === "lead") {
      return leads.map((lead) => ({ id: lead.id, label: lead.name }));
    }
    if (form.relation === "account") {
      return accounts.map((account) => ({ id: account.id, label: account.name }));
    }
    if (form.relation === "contact") {
      return contacts.map((contact) => ({ id: contact.id, label: contactLabel(contact) }));
    }
    return deals.map((deal) => ({ id: deal.id, label: deal.name }));
  }, [form.relation, leads, accounts, contacts, deals]);

  const filterRelationOptions = React.useMemo(() => {
    if (relationKind === "lead") return leads.map((l) => ({ id: l.id, label: l.name }));
    if (relationKind === "account") return accounts.map((a) => ({ id: a.id, label: a.name }));
    if (relationKind === "contact") return contacts.map((c) => ({ id: c.id, label: contactLabel(c) }));
    if (relationKind === "opportunity") return deals.map((d) => ({ id: d.id, label: d.name }));
    return [];
  }, [relationKind, leads, accounts, contacts, deals]);

  const columns = React.useMemo<ColumnDef<CrmActivity>[]>(
    () => [
      {
        id: "activity",
        header: t("crm.activities.activity", "Activity"),
        cell: ({ row }) => (
          <button type="button" className="space-y-0.5 text-left" onClick={() => setDetail(row.original)}>
            <p className="font-bold hover:underline">{row.original.subject}</p>
            <p className="text-[11px] capitalize text-muted-foreground">{row.original.type}</p>
          </button>
        ),
      },
      {
        id: "related",
        header: t("crm.activities.related", "Related to"),
        cell: ({ row }) => {
          const related = relatedRecord(row.original);
          if (!related) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <Link href={related.href} className="text-xs text-primary hover:underline">
              {related.label}
            </Link>
          );
        },
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
        accessorKey: "due_at",
        header: t("crm.activities.due", "Due"),
        cell: ({ row }) => (
          <span
            className={`text-xs tabular-nums ${
              row.original.is_overdue ? "font-semibold text-destructive" : ""
            }`}
          >
            {row.original.due_at ? String(row.original.due_at).slice(0, 10) : "—"}
          </span>
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
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setDetail(row.original)}
              aria-label={t("crm.common.open", "Open")}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {canLog && row.original.status === "planned" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[11px]"
                  disabled={completeBusyId === row.original.id}
                  onClick={() => {
                    setCompleteOutcome("");
                    setCompleteDuration("");
                    setCompleteFor(row.original);
                  }}
                >
                  {completeBusyId === row.original.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    t("crm.activities.done", "Done")
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[11px]"
                  disabled={cancelBusyId === row.original.id}
                  onClick={() => setCancelFor(row.original)}
                >
                  {t("crm.activities.cancel", "Cancel")}
                </Button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [canLog, cancelBusyId, completeBusyId, employeeById, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("crm.activities.title", "Activities")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "crm.activities.subtitle",
              "Calls, meetings and follow-ups. Completing one against a lead lifts that lead's score.",
            )}
          </p>
        </div>
        {canLog ? (
          <Button
            className="rounded-full px-5"
            onClick={() => {
              setForm({ ...DEFAULT_FORM });
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("crm.activities.add", "Log Activity")}
          </Button>
        ) : null}
      </div>

      {overviewQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : overviewQuery.isError ? (
        <EmptyPanel label={t("crm.activities.summary_failed", "Could not load activity summary.")} />
      ) : summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("crm.activities.outstanding", "Outstanding")}
              value={n(summary.outstanding).toLocaleString()}
            />
            <StatTile
              label={t("crm.activities.overdue", "Overdue")}
              value={n(summary.overdue).toLocaleString()}
              alert={n(summary.overdue) > 0}
            />
            <StatTile
              label={t("crm.activities.due_today", "Due today")}
              value={n(summary.due_today).toLocaleString()}
            />
            <StatTile
              label={t("crm.activities.completed", "Completed")}
              value={n(summary.completed).toLocaleString()}
            />
          </div>
          {(summary.by_type ?? []).length > 0 ? (
            <Panel title={t("crm.activities.by_type", "By type")}>
              <div className="flex flex-wrap gap-2">
                {summary.by_type.map((row: { type: string; count: number; outstanding: number }) => (
                  <Badge key={row.type} variant="outline" className="capitalize">
                    {row.type}: {row.outstanding}/{row.count}
                  </Badge>
                ))}
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["outstanding", "overdue", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={quickFilter === value}
            onClick={() => {
              setQuickFilter(value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
              quickFilter === value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.activities.type", "Type")}</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
              {TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {quickFilter === "all" ? (
          <div className="space-y-1">
            <Label className="text-xs">{t("crm.common.status", "Status")}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status} className="capitalize">
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
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
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.activities.against", "Against")}</Label>
          <Select
            value={relationKind}
            onValueChange={(v) => {
              setRelationKind(v as "all" | RelationKind);
              setRelationId("all");
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
              <SelectItem value="lead">{t("crm.activities.a_lead", "Lead")}</SelectItem>
              <SelectItem value="account">{t("crm.activities.an_account", "Account")}</SelectItem>
              <SelectItem value="contact">{t("crm.activities.a_contact", "Contact")}</SelectItem>
              <SelectItem value="opportunity">{t("crm.activities.a_deal", "Deal")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {relationKind !== "all" ? (
          <div className="space-y-1">
            <Label className="text-xs">{t("crm.activities.record", "Record")}</Label>
            <Select value={relationId} onValueChange={setRelationId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
                {filterRelationOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {listQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("crm.activities.load_failed", "Could not load activities.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => listQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("crm.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={(listQuery.data?.data ?? []) as CrmActivity[]}
          totalEntries={listQuery.data?.meta?.total ?? 0}
          loading={listQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("crm.activities.search_hint", "Subject, detail, type, outcome...")}
          resourceName="crm-activities"
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.activities.add", "Log Activity")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.activities.form_desc",
                  "A note records something that already happened, so it is filed as done; anything else stays planned until you close it.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("crm.activities.type", "Type")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as (typeof TYPES)[number] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-due">{t("crm.activities.due", "Due")}</Label>
              <Input
                id="act-due"
                type="date"
                value={form.due_at}
                onChange={(event) => setForm({ ...form, due_at: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="act-subject">{t("crm.activities.subject", "Subject")}</Label>
              <Input
                id="act-subject"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.activities.against", "Against")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={form.relation}
                  onValueChange={(v) =>
                    setForm({ ...form, relation: v as RelationKind, relation_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">{t("crm.activities.a_lead", "Lead")}</SelectItem>
                    <SelectItem value="account">{t("crm.activities.an_account", "Account")}</SelectItem>
                    <SelectItem value="contact">{t("crm.activities.a_contact", "Contact")}</SelectItem>
                    <SelectItem value="opportunity">{t("crm.activities.a_deal", "Deal")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.activities.record", "Record")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={form.relation_id || "none"}
                  onValueChange={(v) => setForm({ ...form, relation_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("crm.common.select", "Select...")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("crm.common.select", "Select...")}</SelectItem>
                    {relationOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("crm.leads.owner", "Owner")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select
                  value={form.owner_employee_id || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, owner_employee_id: v === "none" ? "" : v })
                  }
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
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="act-body">{t("crm.activities.body", "Detail")}</Label>
              <Textarea
                id="act-body"
                rows={3}
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.subject.trim() || !form.relation_id}
            >
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.subject ?? t("crm.activities.activity", "Activity")}
              </DialogTitle>
              <DialogDescription className="capitalize">
                {detail ? `${detail.type} · ${detail.status}` : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          {detail ? (
            <div className="space-y-4 px-6 py-5 text-sm">
              {detail.body ? <p className="text-muted-foreground">{detail.body}</p> : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t("crm.activities.due", "Due")}: </span>
                  {detail.due_at ? String(detail.due_at).slice(0, 10) : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("crm.leads.owner", "Owner")}: </span>
                  {employeeLabel(employeeById, detail.owner_employee_id) ?? "—"}
                </div>
                {detail.completed_at ? (
                  <div>
                    <span className="text-muted-foreground">
                      {t("crm.activities.completed_at", "Completed")}:{" "}
                    </span>
                    {String(detail.completed_at).slice(0, 10)}
                  </div>
                ) : null}
                {detail.duration_minutes != null ? (
                  <div>
                    <span className="text-muted-foreground">
                      {t("crm.activities.duration", "Duration")}:{" "}
                    </span>
                    {detail.duration_minutes} min
                  </div>
                ) : null}
                {detail.outcome ? (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">{t("crm.activities.outcome", "Outcome")}: </span>
                    {detail.outcome}
                  </div>
                ) : null}
              </div>
              {relatedRecord(detail) ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={relatedRecord(detail)!.href}>
                    {t("crm.activities.view_related", "View related record")}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            {canLog && detail?.status === "planned" ? (
              <>
                <Button variant="ghost" onClick={() => detail && setCancelFor(detail)}>
                  {t("crm.activities.cancel", "Cancel")}
                </Button>
                <Button
                  onClick={() => {
                    if (!detail) return;
                    setCompleteOutcome("");
                    setCompleteDuration("");
                    setCompleteFor(detail);
                  }}
                >
                  {t("crm.activities.done", "Done")}
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setDetail(null)}>
                {t("crm.common.close", "Close")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeFor !== null} onOpenChange={(open) => !open && setCompleteFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.activities.complete_title", "Complete activity")}
              </DialogTitle>
              <DialogDescription>
                {t("crm.activities.complete_desc", "Optional outcome and time spent.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="complete-outcome">{t("crm.activities.outcome", "Outcome")}</Label>
              <Input
                id="complete-outcome"
                value={completeOutcome}
                onChange={(event) => setCompleteOutcome(event.target.value)}
                placeholder={t("crm.activities.outcome_hint", "Reached, voicemail, next step...")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="complete-duration">{t("crm.activities.duration", "Duration (minutes)")}</Label>
              <Input
                id="complete-duration"
                type="number"
                min={0}
                value={completeDuration}
                onChange={(event) => setCompleteDuration(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCompleteFor(null)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={complete.isPending}
              onClick={() => {
                if (!completeFor) return;
                complete.mutate({
                  id: completeFor.id,
                  outcome: completeOutcome.trim() || undefined,
                  duration_minutes: completeDuration ? Number(completeDuration) : undefined,
                });
              }}
            >
              {complete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.activities.done", "Done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelFor !== null} onOpenChange={(open) => !open && setCancelFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.activities.cancel_title", "Cancel activity")}
              </DialogTitle>
              <DialogDescription>
                {t("crm.activities.cancel_desc", "This follow-up will no longer appear as planned.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCancelFor(null)}>
              {t("crm.common.back", "Back")}
            </Button>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => cancelFor && cancel.mutate(cancelFor.id)}
            >
              {cancel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.activities.cancel", "Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
