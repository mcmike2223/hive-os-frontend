"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { crmApi } from "@/modules/crm/api";
import type { CrmCampaign } from "@/modules/crm/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { RankedBarChart } from "@/modules/shared/charts/charts";

const STATUSES = ["planned", "running", "completed", "cancelled"] as const;

const STATUS_TONE: Record<string, string> = {
  planned: "secondary",
  running: "default",
  completed: "outline",
  cancelled: "destructive",
};

const DEFAULT_CAMPAIGN = {
  code: "",
  name: "",
  channel: "",
  starts_on: "",
  ends_on: "",
  budget: "0",
  actual_cost: "0",
  status: "planned" as (typeof STATUSES)[number],
  notes: "",
};

type CampaignPerformance = {
  campaign_id: number;
  name: string;
  channel: string | null;
  status: string;
  budget: number;
  actual_cost: number;
  leads: number;
  converted: number;
  cost_per_conversion: number | null;
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function campaignToForm(campaign: CrmCampaign) {
  return {
    code: campaign.code,
    name: campaign.name,
    channel: campaign.channel ?? "",
    starts_on: campaign.starts_on ? String(campaign.starts_on).slice(0, 10) : "",
    ends_on: campaign.ends_on ? String(campaign.ends_on).slice(0, 10) : "",
    budget: String(n(campaign.budget)),
    actual_cost: String(n(campaign.actual_cost)),
    status: (STATUSES.includes(campaign.status as (typeof STATUSES)[number])
      ? campaign.status
      : "planned") as (typeof STATUSES)[number],
    notes: campaign.notes ?? "",
  };
}

export default function CrmCampaignsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_crm_campaigns", "manage_crm"]);

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [channelFilter, setChannelFilter] = React.useState("all");

  const [formOpen, setFormOpen] = React.useState(false);
  const [formId, setFormId] = React.useState<number | undefined>();
  const [form, setForm] = React.useState({ ...DEFAULT_CAMPAIGN });

  const [detail, setDetail] = React.useState<CrmCampaign | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<CrmCampaign | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ["crm", "campaigns", tableQuery, statusFilter, channelFilter],
    queryFn: () =>
      crmApi
        .listCampaigns({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          channel: channelFilter !== "all" ? channelFilter : undefined,
        })
        .then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["crm", "overview-campaigns"],
    queryFn: () => crmApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["crm"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const buildPayload = (values: typeof DEFAULT_CAMPAIGN) => ({
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    channel: values.channel || null,
    starts_on: values.starts_on || null,
    ends_on: values.ends_on || null,
    budget: Number(values.budget || 0),
    actual_cost: Number(values.actual_cost || 0),
    status: values.status,
    notes: values.notes || null,
  });

  const save = useMutation({
    mutationFn: () =>
      formId
        ? crmApi.updateCampaign(formId, buildPayload(form))
        : crmApi.createCampaign(buildPayload(form)),
    onSuccess: () => {
      toast.success(t("crm.campaigns.saved", "Campaign saved."));
      invalidate();
      setFormOpen(false);
      setFormId(undefined);
      setForm({ ...DEFAULT_CAMPAIGN });
      if (detail?.id === formId) setDetail(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.campaigns.save_failed", "Could not save the campaign."))),
  });

  const remove = useMutation({
    mutationFn: (id: number) => {
      setDeletingId(id);
      return crmApi.deleteCampaign(id);
    },
    onSuccess: () => {
      toast.success(t("crm.campaigns.deleted", "Campaign deleted."));
      invalidate();
      setDeleteFor(null);
      if (detail?.id === deleteFor?.id) setDetail(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.campaigns.delete_failed", "Could not delete it."))),
    onSettled: () => setDeletingId(null),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const performance = (overviewQuery.data?.data?.campaigns ?? []) as CampaignPerformance[];
  const performanceById = React.useMemo(
    () => new Map(performance.map((row) => [row.campaign_id, row])),
    [performance],
  );

  const campaigns = (listQuery.data?.data ?? []) as CrmCampaign[];

  const channelOptions = React.useMemo(() => {
    const fromList = campaigns.map((c) => c.channel).filter(Boolean) as string[];
    const fromPerf = performance.map((c) => c.channel).filter(Boolean) as string[];
    return Array.from(new Set([...fromList, ...fromPerf]));
  }, [campaigns, performance]);

  const summaryTotals = React.useMemo(() => {
    return performance.reduce(
      (acc, row) => ({
        leads: acc.leads + n(row.leads),
        converted: acc.converted + n(row.converted),
        spend: acc.spend + n(row.actual_cost),
        budget: acc.budget + n(row.budget),
      }),
      { leads: 0, converted: 0, spend: 0, budget: 0 },
    );
  }, [performance]);

  const openCreate = React.useCallback(() => {
    setFormId(undefined);
    setForm({ ...DEFAULT_CAMPAIGN });
    setFormOpen(true);
  }, []);

  const openEdit = React.useCallback((campaign: CrmCampaign) => {
    setFormId(campaign.id);
    setForm(campaignToForm(campaign));
    setFormOpen(true);
  }, []);

  const detailPerf = detail ? performanceById.get(detail.id) : undefined;

  const columns = React.useMemo<ColumnDef<CrmCampaign>[]>(
    () => [
      {
        id: "campaign",
        header: t("crm.campaigns.campaign", "Campaign"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left"
            onClick={() => setDetail(row.original)}
          >
            <p className="font-bold hover:underline">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </button>
        ),
      },
      {
        accessorKey: "channel",
        header: t("crm.campaigns.channel", "Channel"),
        cell: ({ row }) => (
          <span className="text-xs capitalize">{row.original.channel ?? "—"}</span>
        ),
      },
      {
        id: "dates",
        header: t("crm.campaigns.dates", "Runs"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.starts_on ? String(row.original.starts_on).slice(0, 10) : "—"}
            {row.original.ends_on ? ` → ${String(row.original.ends_on).slice(0, 10)}` : ""}
          </span>
        ),
      },
      {
        id: "spend",
        header: t("crm.campaigns.spend", "Budget / Spend"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs tabular-nums">
            <p>{money(row.original.budget)}</p>
            <p
              className={
                n(row.original.actual_cost) > n(row.original.budget)
                  ? "font-semibold text-destructive"
                  : "text-muted-foreground"
              }
            >
              {money(row.original.actual_cost)}
            </p>
          </div>
        ),
      },
      {
        id: "leads",
        header: t("crm.campaigns.leads", "Leads"),
        cell: ({ row }) => {
          const perf = performanceById.get(row.original.id);
          return (
            <span className="text-xs tabular-nums">
              {row.original.leads_count ?? perf?.leads ?? 0}
              {perf && perf.converted > 0 ? (
                <span className="text-muted-foreground"> · {perf.converted} conv.</span>
              ) : null}
            </span>
          );
        },
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
            {canManage ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={deletingId === row.original.id}
                  onClick={() => setDeleteFor(row.original)}
                >
                  {deletingId === row.original.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [canManage, deletingId, openEdit, performanceById, t],
  );

  const renderFormFields = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="camp-code">{t("crm.common.code", "Code")}</Label>
        <Input
          id="camp-code"
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
          disabled={Boolean(formId)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="camp-name">{t("crm.common.name", "Name")}</Label>
        <Input
          id="camp-name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="camp-channel">{t("crm.campaigns.channel", "Channel")}</Label>
        <Input
          id="camp-channel"
          value={form.channel}
          onChange={(event) => setForm({ ...form, channel: event.target.value })}
          placeholder={t("crm.campaigns.channel_hint", "SMS, radio, field, digital")}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("crm.common.status", "Status")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as (typeof STATUSES)[number] })}
          >
            <SelectTrigger id="camp-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status} className="capitalize">
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="camp-start">{t("crm.campaigns.starts", "Starts")}</Label>
        <Input
          id="camp-start"
          type="date"
          value={form.starts_on}
          onChange={(event) => setForm({ ...form, starts_on: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="camp-end">{t("crm.campaigns.ends", "Ends")}</Label>
        <Input
          id="camp-end"
          type="date"
          min={form.starts_on || undefined}
          value={form.ends_on}
          onChange={(event) => setForm({ ...form, ends_on: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="camp-budget">{t("crm.campaigns.budget", "Budget")}</Label>
        <Input
          id="camp-budget"
          type="number"
          min={0}
          value={form.budget}
          onChange={(event) => setForm({ ...form, budget: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="camp-cost">{t("crm.campaigns.actual", "Actual cost")}</Label>
        <Input
          id="camp-cost"
          type="number"
          min={0}
          value={form.actual_cost}
          onChange={(event) => setForm({ ...form, actual_cost: event.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="camp-notes">{t("crm.common.notes", "Notes")}</Label>
        <Textarea
          id="camp-notes"
          rows={3}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("crm.campaigns.title", "Campaigns")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "crm.campaigns.subtitle",
              "Measured by cost per converted lead — what the spend bought, not how many people it reached.",
            )}
          </p>
        </div>
        {canManage ? (
          <Button className="rounded-full px-5" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("crm.campaigns.add", "New Campaign")}
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
        <EmptyPanel label={t("crm.campaigns.summary_failed", "Could not load campaign metrics.")} />
      ) : performance.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("crm.campaigns.total_leads", "Leads captured")}
              value={summaryTotals.leads.toLocaleString()}
            />
            <StatTile
              label={t("crm.overview.converted", "Converted")}
              value={summaryTotals.converted.toLocaleString()}
            />
            <StatTile
              label={t("crm.campaigns.total_spend", "Total spend")}
              value={money(summaryTotals.spend)}
              alert={summaryTotals.spend > summaryTotals.budget && summaryTotals.budget > 0}
            />
            <StatTile
              label={t("crm.campaigns.avg_cpc", "Avg cost / conversion")}
              value={
                summaryTotals.converted > 0
                  ? money(summaryTotals.spend / summaryTotals.converted)
                  : "—"
              }
            />
          </div>

          <RankedBarChart
            title={t("crm.campaigns.conversions", "Conversions by campaign")}
            description={t(
              "crm.campaigns.conversions_desc",
              "Leads that became real deals, per campaign.",
            )}
            rows={performance.map((row) => ({
              key: String(row.campaign_id),
              label: row.name,
              value: n(row.converted),
              meta:
                row.cost_per_conversion === null
                  ? t("crm.campaigns.nothing_converted", "nothing converted")
                  : t("crm.campaigns.each", "{amount} each").replace(
                      "{amount}",
                      money(row.cost_per_conversion),
                    ),
            }))}
            valueLabel={t("crm.overview.converted", "Converted")}
            emptyLabel={t("crm.campaigns.no_conversions", "No campaign has converted a lead yet.")}
          />
        </>
      ) : (
        <EmptyPanel label={t("crm.campaigns.no_data", "No campaigns recorded yet.")} />
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
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
        <div className="space-y-1">
          <Label className="text-xs">{t("crm.campaigns.channel", "Channel")}</Label>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
              {channelOptions.map((channel) => (
                <SelectItem key={channel} value={channel} className="capitalize">
                  {channel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {listQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("crm.campaigns.load_failed", "Could not load campaigns.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => listQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("crm.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={campaigns}
          totalEntries={listQuery.data?.meta?.total ?? 0}
          loading={listQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("crm.campaigns.search_hint", "Name, code or channel...")}
          resourceName="crm-campaigns"
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {formId
                  ? t("crm.campaigns.edit", "Edit Campaign")
                  : t("crm.campaigns.add", "New Campaign")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.campaigns.form_desc",
                  "Capture leads against a campaign and its cost per conversion works itself out.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{renderFormFields()}</div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.code.trim() || !form.name.trim()}
            >
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                {detail?.name ?? t("crm.campaigns.campaign", "Campaign")}
              </DialogTitle>
              <DialogDescription className="font-mono">{detail?.code}</DialogDescription>
            </DialogHeader>
          </div>

          {detail ? (
            <div className="space-y-5 px-6 py-5 text-sm">
              <div className="flex flex-wrap gap-2">
                {canManage ? (
                  <Button size="sm" variant="outline" onClick={() => openEdit(detail)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {t("crm.common.edit", "Edit")}
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/dashboard/crm/leads?campaign_id=${detail.id}`}>
                    {t("crm.campaigns.view_leads", "View leads")}
                  </Link>
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t("crm.campaigns.channel", "Channel")}: </span>
                  {detail.channel ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("crm.common.status", "Status")}: </span>
                  <span className="capitalize">{detail.status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("crm.campaigns.starts", "Starts")}: </span>
                  {detail.starts_on ? String(detail.starts_on).slice(0, 10) : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("crm.campaigns.ends", "Ends")}: </span>
                  {detail.ends_on ? String(detail.ends_on).slice(0, 10) : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("crm.campaigns.budget", "Budget")}: </span>
                  {money(detail.budget)}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("crm.campaigns.actual", "Actual cost")}: </span>
                  {money(detail.actual_cost)}
                </div>
              </div>

              {detailPerf ? (
                <Panel title={t("crm.campaigns.performance", "Performance")}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">{t("crm.campaigns.leads", "Leads")}: </span>
                      {detailPerf.leads}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("crm.overview.converted", "Converted")}: </span>
                      {detailPerf.converted}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">
                        {t("crm.campaigns.cost_per_conversion", "Cost per conversion")}:{" "}
                      </span>
                      {detailPerf.cost_per_conversion === null
                        ? t("crm.campaigns.nothing_converted", "nothing converted")
                        : money(detailPerf.cost_per_conversion)}
                    </div>
                  </div>
                </Panel>
              ) : null}

              {detail.notes ? <p className="text-muted-foreground">{detail.notes}</p> : null}
            </div>
          ) : null}

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDetail(null)}>
              {t("crm.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteFor !== null} onOpenChange={(open) => !open && setDeleteFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.campaigns.delete_title", "Delete campaign")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.campaigns.delete_desc",
                  "Only campaigns with no captured leads can be removed. Otherwise archive by setting status to cancelled.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDeleteFor(null)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleteFor && remove.mutate(deleteFor.id)}
            >
              {remove.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.common.delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
