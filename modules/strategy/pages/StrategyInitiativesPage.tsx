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
import { strategyApi } from "@/modules/strategy/api";
import type {
  InitiativeStatus,
  StrategyInitiative,
  StrategyObjective,
} from "@/modules/strategy/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const STATUSES: InitiativeStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "on_hold",
  "cancelled",
];

const STATUS_TONE: Record<InitiativeStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  on_hold: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cancelled: "bg-muted text-muted-foreground",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function StrategyInitiativesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [status, setStatus] = React.useState("");
  const [openOnly, setOpenOnly] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StrategyInitiative | null>(null);

  const [form, setForm] = React.useState({
    objective_id: "",
    code: "",
    name: "",
    owner_name: "",
    starts_on: "",
    ends_on: "",
    budget: "0",
    spent: "0",
    progress_percent: "0",
    status: "not_started",
  });

  const [progressForm, setProgressForm] = React.useState({
    progress_percent: "0",
    spent: "0",
    status: "in_progress",
  });

  const overviewQuery = useQuery({
    queryKey: ["strategy", "overview-initiatives"],
    queryFn: () => strategyApi.overview().then((res) => res.data),
  });

  const planId = overviewQuery.data?.data?.plan?.id;

  const initiativesQuery = useQuery({
    queryKey: ["strategy", "initiatives", status, openOnly],
    queryFn: () =>
      strategyApi
        .listInitiatives({
          limit: 50,
          ...(status ? { status } : {}),
          ...(openOnly ? { open_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const objectivesQuery = useQuery({
    queryKey: ["strategy", "objective-options"],
    queryFn: () => strategyApi.listObjectives({ limit: 100 }).then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["strategy"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      strategyApi.createInitiative({
        plan_id: planId,
        ...(form.objective_id ? { objective_id: Number(form.objective_id) } : {}),
        code: form.code,
        name: form.name,
        owner_name: form.owner_name || null,
        ...(form.starts_on ? { starts_on: form.starts_on } : {}),
        ...(form.ends_on ? { ends_on: form.ends_on } : {}),
        budget: Number(form.budget || 0),
        spent: Number(form.spent || 0),
        progress_percent: Number(form.progress_percent || 0),
        status: form.status,
      }),
    onSuccess: () => {
      toast.success(t("strategy.initiatives.saved", "Initiative added."));
      invalidate();
      setCreateOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.initiatives.save_failed", "Could not add it."))),
  });

  const update = useMutation({
    mutationFn: () =>
      strategyApi.updateInitiative(editing!.id, {
        progress_percent: Number(progressForm.progress_percent || 0),
        spent: Number(progressForm.spent || 0),
        status: progressForm.status,
      }),
    onSuccess: () => {
      toast.success(t("strategy.initiatives.updated", "Initiative updated."));
      invalidate();
      setEditing(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.initiatives.update_failed", "Could not update it."))),
  });

  const initiatives = (initiativesQuery.data?.data ?? []) as StrategyInitiative[];
  const objectives = (objectivesQuery.data?.data ?? []) as StrategyObjective[];
  const summary = overviewQuery.data?.data?.initiatives;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("strategy.initiatives.title", "Initiatives")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "strategy.initiatives.subtitle",
              "The work meant to move the objectives. Progress and spend are compared, not read separately — 30% delivered on 80% of the budget is the thing worth catching.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)} disabled={!planId}>
          <Plus className="mr-2 h-4 w-4" />
          {t("strategy.initiatives.add", "Add Initiative")}
        </Button>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("strategy.overview.delivery", "Delivery")}
            value={`${n(summary.weighted_progress_percent).toFixed(0)}%`}
            meta={t("strategy.initiatives.weighted_meta", "weighted by budget")}
          />
          <StatTile
            label={t("strategy.initiatives.open", "Open")}
            value={n(summary.open).toLocaleString()}
            meta={t("strategy.initiatives.completed_meta", "{n} completed").replace(
              "{n}",
              String(n(summary.completed)),
            )}
          />
          <StatTile
            label={t("strategy.initiatives.overdue", "Late")}
            value={n(summary.overdue).toLocaleString()}
            alert={n(summary.overdue) > 0}
          />
          <StatTile
            label={t("strategy.overview.overspending", "Overspending")}
            value={n(summary.overspending).toLocaleString()}
            meta={t("strategy.initiatives.spend_meta", "{spent} of {budget}")
              .replace("{spent}", money(summary.spent))
              .replace("{budget}", money(summary.budget))}
            alert={n(summary.overspending) > 0}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="i-status" className="text-xs">
            {t("strategy.common.status", "Status")}
          </Label>
          <select
            id="i-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("strategy.common.any", "Any")}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
            className="h-4 w-4"
          />
          {t("strategy.initiatives.open_only", "Open only")}
        </label>
      </div>

      <Panel
        title={t("strategy.initiatives.list", "Initiatives")}
        description={t(
          "strategy.initiatives.list_desc",
          "Burn is only judged while the work is open — a finished initiative is judged on its final cost, not its rate of spend.",
        )}
      >
        {initiativesQuery.isLoading ? (
          <LoadingPanel label={t("strategy.common.loading", "Loading initiatives...")} />
        ) : initiatives.length === 0 ? (
          <EmptyPanel label={t("strategy.initiatives.none", "No initiatives match those filters.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.initiatives.initiative", "Initiative")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.kpis.objective", "Objective")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.common.status", "Status")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.initiatives.progress", "Progress")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.initiatives.budget", "Budget")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.initiatives.due", "Due")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("strategy.common.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {initiatives.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{row.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {row.code}
                        {row.owner_name ? ` · ${row.owner_name}` : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{row.objective?.title ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.status]}`}
                      >
                        {row.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {row.progress_percent}%
                      <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-indigo-500"
                          style={{ width: `${Math.max(0, Math.min(100, row.progress_percent))}%` }}
                        />
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {money(row.spent)} / {money(row.budget)}
                      {row.budget_used_percent !== null && row.budget_used_percent !== undefined ? (
                        <span
                          className={`block text-[11px] ${
                            row.is_overspending
                              ? "font-semibold text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {t("strategy.initiatives.used", "{n}% used").replace(
                            "{n}",
                            row.budget_used_percent.toFixed(0),
                          )}
                          {row.is_overspending
                            ? ` · ${t("strategy.overview.overspending", "overspending")}`
                            : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {row.ends_on ?? "—"}
                      {row.is_overdue ? (
                        <span className="block text-[11px] font-semibold text-destructive">
                          {t("strategy.overview.late", "late")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          setEditing(row);
                          setProgressForm({
                            progress_percent: String(row.progress_percent),
                            spent: String(n(row.spent)),
                            status: row.status,
                          });
                        }}
                      >
                        {t("strategy.initiatives.update", "Update")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.initiatives.add", "Add Initiative")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "strategy.initiatives.add_desc",
                  "Attaching it to an objective is what turns that objective from an aspiration into a plan.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ni-objective">{t("strategy.kpis.objective", "Objective")}</Label>
              <select
                id="ni-objective"
                value={form.objective_id}
                onChange={(event) => setForm({ ...form, objective_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("strategy.initiatives.no_objective", "Not tied to one objective")}</option>
                {objectives.map((objective) => (
                  <option key={objective.id} value={objective.id}>
                    {objective.code} — {objective.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-code">{t("strategy.common.code", "Code")}</Label>
              <Input
                id="ni-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-owner">{t("strategy.common.owner", "Owner")}</Label>
              <Input
                id="ni-owner"
                value={form.owner_name}
                onChange={(event) => setForm({ ...form, owner_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ni-name">{t("strategy.common.name", "Name")}</Label>
              <Input
                id="ni-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-start">{t("strategy.initiatives.starts", "Starts")}</Label>
              <Input
                id="ni-start"
                type="date"
                value={form.starts_on}
                onChange={(event) => setForm({ ...form, starts_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-end">{t("strategy.initiatives.ends", "Ends")}</Label>
              <Input
                id="ni-end"
                type="date"
                min={form.starts_on}
                value={form.ends_on}
                onChange={(event) => setForm({ ...form, ends_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-budget">{t("strategy.initiatives.budget", "Budget")}</Label>
              <Input
                id="ni-budget"
                type="number"
                min={0}
                value={form.budget}
                onChange={(event) => setForm({ ...form, budget: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-status">{t("strategy.common.status", "Status")}</Label>
              <select
                id="ni-status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.code.trim() || !form.name.trim()}
            >
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update progress */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.initiatives.update", "Update")}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? t(
                      "strategy.initiatives.update_desc",
                      "{name} — progress is reported, spend is recorded, and the gap between them is what the dashboard watches.",
                    ).replace("{name}", editing.name)
                  : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="u-progress">{t("strategy.initiatives.progress", "Progress %")}</Label>
              <Input
                id="u-progress"
                type="number"
                min={0}
                max={100}
                value={progressForm.progress_percent}
                onChange={(event) =>
                  setProgressForm({ ...progressForm, progress_percent: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-spent">{t("strategy.initiatives.spent", "Spent")}</Label>
              <Input
                id="u-spent"
                type="number"
                min={0}
                value={progressForm.spent}
                onChange={(event) => setProgressForm({ ...progressForm, spent: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-status">{t("strategy.common.status", "Status")}</Label>
              <select
                id="u-status"
                value={progressForm.status}
                onChange={(event) => setProgressForm({ ...progressForm, status: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            {editing && n(editing.budget) > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("strategy.initiatives.burn_preview", "{b}% of budget against {p}% delivered.")
                  .replace(
                    "{b}",
                    ((Number(progressForm.spent || 0) / n(editing.budget)) * 100).toFixed(0),
                  )
                  .replace("{p}", String(Number(progressForm.progress_percent || 0)))}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => update.mutate()} disabled={update.isPending}>
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
