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
import type { CrmCampaign, CrmLead, LeadStatus } from "@/modules/crm/types";
import { StatTile } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** Mirrors CrmLead::TRANSITIONS; the backend stays the authority. */
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

export default function CrmLeadsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...DEFAULT_LEAD });
  const [convertFor, setConvertFor] = React.useState<CrmLead | null>(null);
  const [convertAmount, setConvertAmount] = React.useState("");

  const listQuery = useQuery({
    queryKey: ["crm", "leads", tableQuery],
    queryFn: () =>
      crmApi
        .listLeads({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
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

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["crm"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      crmApi.createLead({
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        city: form.city || null,
        source: form.source || null,
        campaign_id: form.campaign_id ? Number(form.campaign_id) : null,
        estimated_value: Number(form.estimated_value || 0),
        owner_employee_id: form.owner_employee_id ? Number(form.owner_employee_id) : null,
        notes: form.notes || null,
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("crm.leads.created", "Lead captured."));
      invalidate();
      setOpen(false);
      setForm({ ...DEFAULT_LEAD });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.leads.create_failed", "Could not capture the lead."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => crmApi.transitionLead(id, status),
    onSuccess: () => {
      toast.success(t("crm.leads.moved", "Lead updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.leads.move_failed", "That transition was refused."))),
  });

  const convert = useMutation({
    mutationFn: () =>
      crmApi.convertLead(convertFor!.id, {
        ...(convertAmount ? { amount: Number(convertAmount) } : {}),
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("crm.leads.converted", "Lead converted."));
      invalidate();
      setConvertFor(null);
      setConvertAmount("");
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.leads.convert_failed", "Could not convert the lead."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const summary = summaryQuery.data?.data;
  const campaigns = (campaignsQuery.data?.data ?? []) as CrmCampaign[];

  const columns = React.useMemo<ColumnDef<CrmLead>[]>(
    () => [
      {
        id: "lead",
        header: t("crm.leads.lead", "Lead"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.company ?? row.original.lead_number}
            </p>
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
            <p className="text-muted-foreground">{row.original.city ?? ""}</p>
          </div>
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
        header: "",
        cell: ({ row }) => {
          const next = TRANSITIONS[row.original.status] ?? [];
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {row.original.status === "qualified" ? (
                <Button
                  size="sm"
                  className="text-[11px]"
                  onClick={() => {
                    setConvertFor(row.original);
                    setConvertAmount(String(n(row.original.estimated_value) || ""));
                  }}
                >
                  {t("crm.leads.convert", "Convert")}
                </Button>
              ) : null}
              {next.slice(0, 2).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  className="text-[11px] capitalize"
                  disabled={transition.isPending}
                  onClick={() => transition.mutate({ id: row.original.id, status })}
                >
                  {status}
                </Button>
              ))}
            </div>
          );
        },
      },
    ],
    [t, transition],
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
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("crm.leads.add", "Capture Lead")}
        </Button>
      </div>

      {summary ? (
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

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as CrmLead[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("crm.leads.search", "Search leads...")}
        resourceName="crm-leads"
      />

      {/* Capture */}
      <Dialog open={open} onOpenChange={setOpen}>
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

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">{t("crm.common.name", "Name")}</Label>
              <Input
                id="lead-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-company">{t("crm.leads.company", "Company")}</Label>
              <Input
                id="lead-company"
                value={form.company}
                onChange={(event) => setForm({ ...form, company: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">{t("crm.leads.phone", "Phone")}</Label>
              <Input
                id="lead-phone"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">{t("crm.leads.email", "Email")}</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-city">{t("crm.leads.city", "City")}</Label>
              <Input
                id="lead-city"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">{t("crm.leads.source", "Source")}</Label>
              <Input
                id="lead-source"
                value={form.source}
                onChange={(event) => setForm({ ...form, source: event.target.value })}
                placeholder={t("crm.leads.source_hint", "referral, walk-in, web")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-campaign">{t("crm.leads.campaign", "Campaign")}</Label>
              <select
                id="lead-campaign"
                value={form.campaign_id}
                onChange={(event) => setForm({ ...form, campaign_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("crm.common.none", "None")}</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-value">{t("crm.leads.value", "Estimated value")}</Label>
              <Input
                id="lead-value"
                type="number"
                min={0}
                value={form.estimated_value}
                onChange={(event) => setForm({ ...form, estimated_value: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-owner">{t("crm.leads.owner", "Owner employee ID")}</Label>
              <Input
                id="lead-owner"
                type="number"
                value={form.owner_employee_id}
                onChange={(event) => setForm({ ...form, owner_employee_id: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lead-notes">{t("crm.common.notes", "Notes")}</Label>
              <Textarea
                id="lead-notes"
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()}>
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert */}
      <Dialog open={convertFor !== null} onOpenChange={(isOpen) => !isOpen && setConvertFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.leads.convert", "Convert Lead")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.leads.convert_desc",
                  "Creates an account, a contact and an open deal. An account of the same name is reused rather than duplicated.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="convert-amount">{t("crm.leads.deal_value", "Deal value")}</Label>
              <Input
                id="convert-amount"
                type="number"
                min={0}
                value={convertAmount}
                onChange={(event) => setConvertAmount(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setConvertFor(null)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => convert.mutate()} disabled={convert.isPending}>
              {t("crm.leads.convert", "Convert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
