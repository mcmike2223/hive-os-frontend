"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { crmApi } from "@/modules/crm/api";
import type { CrmAccount, CrmActivity, CrmLead, CrmOpportunity } from "@/modules/crm/types";
import { StatTile } from "@/modules/shared/charts/primitives";

const TYPES = ["call", "meeting", "email", "task", "note"] as const;

const STATUS_TONE: Record<string, string> = {
  planned: "secondary",
  done: "default",
  cancelled: "outline",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function CrmActivitiesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [filter, setFilter] = React.useState<"all" | "outstanding" | "overdue">("outstanding");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    type: "call",
    subject: "",
    body: "",
    relation: "lead",
    relation_id: "",
    due_at: "",
    owner_employee_id: "",
  });

  const listQuery = useQuery({
    queryKey: ["crm", "activities", tableQuery, filter],
    queryFn: () =>
      crmApi
        .listActivities({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          ...(filter === "outstanding" ? { outstanding_only: 1 } : {}),
          ...(filter === "overdue" ? { overdue_only: 1 } : {}),
        })
        .then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["crm", "overview-activities"],
    queryFn: () => crmApi.overview().then((res) => res.data),
  });

  const leadsQuery = useQuery({
    queryKey: ["crm", "lead-options"],
    queryFn: () => crmApi.listLeads({ limit: 100, open_only: 1 }).then((res) => res.data),
  });

  const accountsQuery = useQuery({
    queryKey: ["crm", "account-options"],
    queryFn: () => crmApi.listAccounts({ limit: 100 }).then((res) => res.data),
  });

  const dealsQuery = useQuery({
    queryKey: ["crm", "deal-options"],
    queryFn: () => crmApi.listOpportunities({ limit: 100, open_only: 1 }).then((res) => res.data),
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
        // Exactly one relation key is sent; the API refuses an orphan.
        [`${form.relation}_id`]: Number(form.relation_id),
        due_at: form.due_at || null,
        owner_employee_id: form.owner_employee_id ? Number(form.owner_employee_id) : null,
      }),
    onSuccess: () => {
      toast.success(t("crm.activities.logged", "Activity logged."));
      invalidate();
      setOpen(false);
      setForm({ ...form, subject: "", body: "", relation_id: "", due_at: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.activities.log_failed", "Could not log the activity."))),
  });

  const complete = useMutation({
    mutationFn: (id: number) => crmApi.completeActivity(id),
    onSuccess: () => {
      toast.success(t("crm.activities.completed", "Marked done."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not complete it.")),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => crmApi.cancelActivity(id),
    onSuccess: () => {
      toast.success(t("crm.activities.cancelled", "Cancelled."));
      invalidate();
    },
    // A completed activity cannot be cancelled; the API says why.
    onError: (error: any) => toast.error(errorText(error, "Could not cancel it.")),
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
  const deals = (dealsQuery.data?.data ?? []) as CrmOpportunity[];

  const relationOptions =
    form.relation === "lead"
      ? leads.map((lead) => ({ id: lead.id, label: lead.name }))
      : form.relation === "account"
        ? accounts.map((account) => ({ id: account.id, label: account.name }))
        : deals.map((deal) => ({ id: deal.id, label: deal.name }));

  const columns = React.useMemo<ColumnDef<CrmActivity>[]>(
    () => [
      {
        id: "activity",
        header: t("crm.activities.activity", "Activity"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.subject}</p>
            <p className="text-[11px] capitalize text-muted-foreground">{row.original.type}</p>
          </div>
        ),
      },
      {
        id: "related",
        header: t("crm.activities.related", "Related to"),
        cell: ({ row }) => {
          const parts = [
            row.original.opportunity_id ? `Deal #${row.original.opportunity_id}` : null,
            row.original.lead_id ? `Lead #${row.original.lead_id}` : null,
            row.original.contact_id ? `Contact #${row.original.contact_id}` : null,
            row.original.account_id ? `Account #${row.original.account_id}` : null,
          ].filter(Boolean);

          return <span className="text-xs text-muted-foreground">{parts[0] ?? "—"}</span>;
        },
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
        cell: ({ row }) =>
          row.original.status === "planned" ? (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                className="text-[11px]"
                disabled={complete.isPending}
                onClick={() => complete.mutate(row.original.id)}
              >
                {t("crm.activities.done", "Done")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[11px]"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(row.original.id)}
              >
                {t("crm.activities.cancel", "Cancel")}
              </Button>
            </div>
          ) : null,
      },
    ],
    [t, complete, cancel],
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
        <Button className="rounded-full px-5" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("crm.activities.add", "Log Activity")}
        </Button>
      </div>

      {summary ? (
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
      ) : null}

      <div className="flex gap-2">
        {(["outstanding", "overdue", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filter === value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as CrmActivity[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("crm.activities.search", "Search activities...")}
        resourceName="crm-activities"
      />

      <Dialog open={open} onOpenChange={setOpen}>
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

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="act-type">{t("crm.activities.type", "Type")}</Label>
              <select
                id="act-type"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
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
              <Label htmlFor="act-relation">{t("crm.activities.against", "Against")}</Label>
              <select
                id="act-relation"
                value={form.relation}
                onChange={(event) => setForm({ ...form, relation: event.target.value, relation_id: "" })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="lead">{t("crm.activities.a_lead", "Lead")}</option>
                <option value="account">{t("crm.activities.an_account", "Account")}</option>
                <option value="opportunity">{t("crm.activities.a_deal", "Deal")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-relation-id">{t("crm.activities.record", "Record")}</Label>
              <select
                id="act-relation-id"
                value={form.relation_id}
                onChange={(event) => setForm({ ...form, relation_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("crm.common.select", "Select...")}</option>
                {relationOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
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
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.subject.trim() || !form.relation_id}
            >
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
