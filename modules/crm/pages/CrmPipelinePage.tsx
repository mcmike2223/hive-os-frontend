"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { crmApi } from "@/modules/crm/api";
import type {
  CrmAccount,
  CrmBridgeStatus,
  CrmOpportunity,
  CrmPipeline,
} from "@/modules/crm/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const STATUS_TONE: Record<string, string> = {
  open: "secondary",
  won: "default",
  lost: "destructive",
};

export default function CrmPipelinePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [pipelineId, setPipelineId] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [lostFor, setLostFor] = React.useState<{ deal: CrmOpportunity; stageId: number } | null>(null);
  const [lostReason, setLostReason] = React.useState("");

  const [form, setForm] = React.useState({
    name: "",
    account_id: "",
    amount: "",
    expected_close_date: "",
    owner_employee_id: "",
    notes: "",
  });

  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => crmApi.listPipelines({ limit: 50 }).then((res) => res.data),
  });

  const dealsQuery = useQuery({
    queryKey: ["crm", "opportunities", pipelineId],
    queryFn: () =>
      crmApi
        .listOpportunities({ limit: 200, ...(pipelineId ? { pipeline_id: pipelineId } : {}) })
        .then((res) => res.data),
  });

  const accountsQuery = useQuery({
    queryKey: ["crm", "account-options"],
    queryFn: () => crmApi.listAccounts({ limit: 100 }).then((res) => res.data),
  });

  const bridgeQuery = useQuery({
    queryKey: ["crm", "bridge-status"],
    queryFn: () => crmApi.bridgeStatus().then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["crm", "opportunity", detailId],
    queryFn: () => crmApi.getOpportunity(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["crm"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const pipelines = (pipelinesQuery.data?.data ?? []) as CrmPipeline[];
  const activePipeline =
    pipelines.find((p) => p.id === pipelineId) ?? pipelines.find((p) => p.is_default) ?? pipelines[0];
  const stages = activePipeline?.stages ?? [];
  const deals = (dealsQuery.data?.data ?? []) as CrmOpportunity[];
  const accounts = (accountsQuery.data?.data ?? []) as CrmAccount[];
  const bridge: CrmBridgeStatus | undefined = bridgeQuery.data?.data;
  const detail: CrmOpportunity | undefined = detailQuery.data?.data;

  const create = useMutation({
    mutationFn: () =>
      crmApi.createOpportunity({
        name: form.name,
        account_id: form.account_id ? Number(form.account_id) : null,
        pipeline_id: activePipeline?.id,
        amount: Number(form.amount || 0),
        expected_close_date: form.expected_close_date || null,
        owner_employee_id: form.owner_employee_id ? Number(form.owner_employee_id) : null,
        notes: form.notes || null,
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("crm.pipeline.created", "Deal created."));
      invalidate();
      setOpen(false);
      setForm({ name: "", account_id: "", amount: "", expected_close_date: "", owner_employee_id: "", notes: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.create_failed", "Could not create the deal."))),
  });

  const move = useMutation({
    mutationFn: ({ id, stageId, reason }: { id: number; stageId: number; reason?: string }) =>
      crmApi.moveStage(id, stageId, reason),
    onSuccess: () => {
      toast.success(t("crm.pipeline.moved", "Deal moved."));
      invalidate();
      setLostFor(null);
      setLostReason("");
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.move_failed", "That move was refused."))),
  });

  const reopen = useMutation({
    mutationFn: (id: number) => crmApi.reopenOpportunity(id),
    onSuccess: () => {
      toast.success(t("crm.pipeline.reopened", "Deal reopened onto a working stage."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.reopen_failed", "Could not reopen it."))),
  });

  const quote = useMutation({
    mutationFn: (id: number) => crmApi.createQuotation(id),
    onSuccess: (response: any) => {
      const data = response?.data?.data;
      toast[data?.created ? "success" : "info"](
        data?.created
          ? t("crm.pipeline.quoted", "Quotation raised in Sales.")
          : (data?.reason ?? t("crm.pipeline.no_quote", "No quotation was raised.")),
      );
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.pipeline.quote_failed", "Could not raise the quotation."))),
  });

  const workingStages = stages.filter((stage) => !stage.is_won && !stage.is_lost);
  const openDeals = deals.filter((deal) => deal.status === "open");

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
          {pipelines.length > 1 ? (
            <select
              value={pipelineId ?? ""}
              onChange={(event) => setPipelineId(event.target.value ? Number(event.target.value) : null)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label={t("crm.overview.pipeline", "Pipeline")}
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button className="rounded-full px-5" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("crm.pipeline.add", "New Deal")}
          </Button>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t("crm.pipeline.open_deals", "Open deals")}
          value={openDeals.length.toLocaleString()}
        />
        <StatTile
          label={t("crm.pipeline.open_value", "Open value")}
          value={money(openDeals.reduce((total, deal) => total + n(deal.amount), 0))}
        />
        <StatTile
          label={t("crm.pipeline.weighted", "Weighted")}
          value={money(openDeals.reduce((total, deal) => total + n(deal.weighted_amount), 0))}
        />
        <StatTile
          label={t("crm.pipeline.overdue", "Past close date")}
          value={openDeals.filter((deal) => deal.is_overdue).length.toLocaleString()}
          alert={openDeals.some((deal) => deal.is_overdue)}
        />
      </div>

      {/* A board, because a pipeline is a sequence and a table hides that. */}
      {dealsQuery.isLoading ? (
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
                <div key={stage.id} className="w-72 shrink-0 rounded-2xl border border-border/60 bg-card p-3">
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{stage.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {stage.probability_percent}% · {money(value)}
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
                            onClick={() => setDetailId(deal.id)}
                            className="block w-full text-left"
                          >
                            <p className="truncate text-sm font-semibold">{deal.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {deal.account?.name ?? deal.opportunity_number}
                            </p>
                            <p className="mt-1 text-xs font-bold tabular-nums">{money(deal.amount)}</p>
                            {deal.is_overdue ? (
                              <Badge variant="destructive" className="mt-1 text-[10px]">
                                {t("crm.pipeline.overdue_badge", "Overdue")}
                              </Badge>
                            ) : null}
                          </button>

                          <select
                            value=""
                            onChange={(event) => {
                              const target = stages.find((s) => s.id === Number(event.target.value));
                              if (!target) return;
                              if (target.is_lost) {
                                setLostFor({ deal, stageId: target.id });
                              } else {
                                move.mutate({ id: deal.id, stageId: target.id });
                              }
                            }}
                            className="mt-2 h-7 w-full rounded-md border border-input bg-background px-2 text-[11px]"
                            aria-label={t("crm.pipeline.move_to", "Move to stage")}
                          >
                            <option value="">{t("crm.pipeline.move_to", "Move to...")}</option>
                            {stages
                              .filter((s) => s.id !== deal.stage_id)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
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

      {/* Closed deals */}
      <Panel
        title={t("crm.pipeline.closed", "Closed deals")}
        description={t("crm.pipeline.closed_desc", "Won and lost, with the reason where one was given.")}
      >
        {deals.filter((deal) => deal.status !== "open").length === 0 ? (
          <EmptyPanel label={t("crm.pipeline.none_closed", "No deals closed yet.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-semibold">{t("crm.pipeline.deal", "Deal")}</th>
                  <th className="pb-2 font-semibold">{t("crm.pipeline.account", "Account")}</th>
                  {/* Right-aligned money sits directly against the next
                      header, so the pair reads as one word without a gutter. */}
                  <th className="pb-2 pr-6 text-right font-semibold">{t("crm.pipeline.value", "Value")}</th>
                  <th className="pb-2 font-semibold">{t("crm.common.status", "Status")}</th>
                  <th className="pb-2 font-semibold">{t("crm.pipeline.reason", "Reason")}</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {deals
                  .filter((deal) => deal.status !== "open")
                  .map((deal) => (
                    <tr key={deal.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 font-medium">{deal.name}</td>
                      <td className="py-2 text-xs text-muted-foreground">{deal.account?.name ?? "—"}</td>
                      <td className="py-2 pr-6 text-right tabular-nums">{money(deal.amount)}</td>
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
                          {deal.status === "won" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[11px]"
                              disabled={quote.isPending || !bridge?.sales?.available}
                              onClick={() => quote.mutate(deal.id)}
                            >
                              {deal.quotation_id
                                ? t("crm.pipeline.quoted_badge", "Quoted #{id}").replace(
                                    "{id}",
                                    String(deal.quotation_id),
                                  )
                                : t("crm.pipeline.raise_quote", "Raise quote")}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[11px]"
                            disabled={reopen.isPending}
                            onClick={() => reopen.mutate(deal.id)}
                          >
                            {t("crm.pipeline.reopen", "Reopen")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* New deal */}
      <Dialog open={open} onOpenChange={setOpen}>
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

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="deal-name">{t("crm.common.name", "Name")}</Label>
              <Input
                id="deal-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-account">{t("crm.pipeline.account", "Account")}</Label>
              <select
                id="deal-account"
                value={form.account_id}
                onChange={(event) => setForm({ ...form, account_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("crm.common.none", "None")}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-amount">{t("crm.pipeline.value", "Value")}</Label>
              <Input
                id="deal-amount"
                type="number"
                min={0}
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-close">{t("crm.pipeline.expected_close", "Expected close")}</Label>
              <Input
                id="deal-close"
                type="date"
                value={form.expected_close_date}
                onChange={(event) => setForm({ ...form, expected_close_date: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-owner">{t("crm.leads.owner", "Owner employee ID")}</Label>
              <Input
                id="deal-owner"
                type="number"
                value={form.owner_employee_id}
                onChange={(event) => setForm({ ...form, owner_employee_id: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="deal-notes">{t("crm.common.notes", "Notes")}</Label>
              <Textarea
                id="deal-notes"
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

      {/* Loss reason — asked for at the moment the deal is lost, which is the
          only time anyone remembers it. */}
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
                  reason: lostReason || undefined,
                })
              }
              disabled={move.isPending}
            >
              {t("crm.pipeline.mark_lost", "Mark as lost")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal detail */}
      <Dialog open={detailId !== null} onOpenChange={(isOpen) => !isOpen && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail ? detail.name : t("crm.pipeline.deal", "Deal")}
              </DialogTitle>
              <DialogDescription>
                {detail
                  ? `${detail.opportunity_number} — ${money(detail.amount)}`
                  : t("crm.common.loading", "Loading...")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            {detail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile
                    label={t("crm.pipeline.stage", "Stage")}
                    value={detail.stage?.name ?? "—"}
                    meta={`${n(detail.effective_probability)}%`}
                  />
                  <StatTile
                    label={t("crm.pipeline.weighted", "Weighted")}
                    value={money(detail.weighted_amount)}
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
                          <span>
                            {entry.from_stage_id === null
                              ? t("crm.pipeline.created_at_stage", "Created")
                              : t("crm.pipeline.moved_stage", "Moved")}
                          </span>
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
              </>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDetailId(null)}>
              {t("crm.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
