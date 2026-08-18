"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
import { crmApi } from "@/modules/crm/api";
import type { CrmCampaign } from "@/modules/crm/types";
import { RankedBarChart } from "@/modules/shared/charts/charts";

const STATUSES = ["planned", "running", "completed", "cancelled"] as const;

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const DEFAULT_CAMPAIGN = {
  id: undefined as number | undefined,
  code: "",
  name: "",
  channel: "",
  starts_on: "",
  ends_on: "",
  budget: "0",
  actual_cost: "0",
  status: "planned",
};

export default function CrmCampaignsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...DEFAULT_CAMPAIGN });

  const listQuery = useQuery({
    queryKey: ["crm", "campaigns", tableQuery],
    queryFn: () =>
      crmApi
        .listCampaigns({ page: tableQuery.page, limit: tableQuery.pageSize })
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

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code,
        name: form.name,
        channel: form.channel || null,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        budget: Number(form.budget || 0),
        actual_cost: Number(form.actual_cost || 0),
        status: form.status,
      };

      return form.id ? crmApi.updateCampaign(form.id, payload) : crmApi.createCampaign(payload);
    },
    onSuccess: () => {
      toast.success(t("crm.campaigns.saved", "Campaign saved."));
      invalidate();
      setOpen(false);
      setForm({ ...DEFAULT_CAMPAIGN });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.campaigns.save_failed", "Could not save the campaign."))),
  });

  const remove = useMutation({
    mutationFn: (id: number) => crmApi.deleteCampaign(id),
    onSuccess: () => {
      toast.success(t("crm.campaigns.deleted", "Campaign deleted."));
      invalidate();
    },
    // Refused when leads were captured against it — deleting would lose where
    // they came from. Relay that reason rather than a generic failure.
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.campaigns.delete_failed", "Could not delete it."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const performance = overviewQuery.data?.data?.campaigns ?? [];

  const columns = React.useMemo<ColumnDef<CrmCampaign>[]>(
    () => [
      {
        id: "campaign",
        header: t("crm.campaigns.campaign", "Campaign"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </div>
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
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.leads_count ?? 0}</span>
        ),
      },
      {
        accessorKey: "status",
        header: t("crm.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] capitalize">
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
              onClick={() => {
                setForm({
                  id: row.original.id,
                  code: row.original.code,
                  name: row.original.name,
                  channel: row.original.channel ?? "",
                  starts_on: row.original.starts_on?.slice(0, 10) ?? "",
                  ends_on: row.original.ends_on?.slice(0, 10) ?? "",
                  budget: String(n(row.original.budget)),
                  actual_cost: String(n(row.original.actual_cost)),
                  status: row.original.status,
                });
                setOpen(true);
              }}
            >
              {t("crm.common.edit", "Edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => remove.mutate(row.original.id)}
              aria-label={t("crm.common.delete", "Delete")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, remove],
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
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setForm({ ...DEFAULT_CAMPAIGN });
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("crm.campaigns.add", "New Campaign")}
        </Button>
      </div>

      {performance.length > 0 ? (
        <RankedBarChart
          title={t("crm.campaigns.conversions", "Conversions by campaign")}
          description={t(
            "crm.campaigns.conversions_desc",
            "Leads that became real deals, per campaign.",
          )}
          rows={performance.map((row: any) => ({
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
      ) : null}

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as CrmCampaign[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("crm.campaigns.search", "Search campaigns...")}
        resourceName="crm-campaigns"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {form.id
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

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="camp-code">{t("crm.common.code", "Code")}</Label>
              <Input
                id="camp-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
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
              <Label htmlFor="camp-status">{t("crm.common.status", "Status")}</Label>
              <select
                id="camp-status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
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
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.code.trim() || !form.name.trim()}
            >
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
