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
import { internalAuditApi } from "@/modules/internal-audit/api";
import type {
  AuditArea,
  AuditEngagement,
  AuditProcedure,
  EngagementStatus,
  EngagementType,
} from "@/modules/internal-audit/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const TYPES: EngagementType[] = [
  "operational",
  "financial",
  "compliance",
  "it",
  "follow_up",
  "investigation",
];

const OPINIONS = ["satisfactory", "needs_improvement", "unsatisfactory"] as const;

const NEXT_STATUSES: Record<EngagementStatus, EngagementStatus[]> = {
  planned: ["fieldwork", "cancelled"],
  fieldwork: ["reporting", "cancelled"],
  // Evidence gaps surface while drafting, so reporting can fall back.
  reporting: ["closed", "fieldwork"],
  closed: [],
  cancelled: [],
};

const STATUS_TONE: Record<EngagementStatus, string> = {
  planned: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  fieldwork: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  reporting: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  closed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function AuditEngagementsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [status, setStatus] = React.useState("");
  const [planOpen, setPlanOpen] = React.useState(false);
  const [closing, setClosing] = React.useState<AuditEngagement | null>(null);
  const [testing, setTesting] = React.useState<AuditEngagement | null>(null);

  const [form, setForm] = React.useState({
    area_id: "",
    title: "",
    type: "operational",
    lead_auditor_name: "",
    period_from: "",
    period_to: "",
    planned_start_on: "",
    planned_end_on: "",
    planned_hours: "80",
    objective: "",
  });

  const [closeForm, setCloseForm] = React.useState({
    opinion: "satisfactory",
    actual_hours: "0",
    conclusion: "",
  });

  const [procedureForm, setProcedureForm] = React.useState({
    reference: "",
    control_tested: "",
    description: "",
    population_size: "0",
    sample_size: "0",
    exceptions_found: "0",
    performed_by_name: "",
  });

  const engagementsQuery = useQuery({
    queryKey: ["internal-audit", "engagements", status],
    queryFn: () =>
      internalAuditApi
        .listEngagements({ limit: 25, ...(status ? { status } : {}) })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const proceduresQuery = useQuery({
    queryKey: ["internal-audit", "procedures"],
    queryFn: () => internalAuditApi.listProcedures({ limit: 50 }).then((res) => res.data),
  });

  const areasQuery = useQuery({
    queryKey: ["internal-audit", "area-options"],
    queryFn: () => internalAuditApi.listAreas({ limit: 100 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["internal-audit", "overview-engagements"],
    queryFn: () => internalAuditApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["internal-audit"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const plan = useMutation({
    mutationFn: () =>
      internalAuditApi.createEngagement({
        ...(form.area_id ? { area_id: Number(form.area_id) } : {}),
        title: form.title,
        type: form.type,
        lead_auditor_name: form.lead_auditor_name || null,
        ...(form.period_from ? { period_from: form.period_from } : {}),
        ...(form.period_to ? { period_to: form.period_to } : {}),
        ...(form.planned_start_on ? { planned_start_on: form.planned_start_on } : {}),
        ...(form.planned_end_on ? { planned_end_on: form.planned_end_on } : {}),
        planned_hours: Number(form.planned_hours || 0),
        objective: form.objective || null,
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("internal_audit.engagements.planned", "Engagement planned."));
      invalidate();
      setPlanOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.engagements.plan_failed", "Could not plan it."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, next }: { id: number; next: EngagementStatus }) =>
      internalAuditApi.transitionEngagement(id, { status: next }),
    onSuccess: () => {
      toast.success(t("internal_audit.engagements.moved", "Engagement updated."));
      invalidate();
    },
    // Closing without an opinion is refused by the API, in its own words.
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.engagements.move_failed", "Could not move it."))),
  });

  const close = useMutation({
    mutationFn: () =>
      internalAuditApi.transitionEngagement(closing!.id, {
        status: "closed",
        opinion: closeForm.opinion,
        actual_hours: Number(closeForm.actual_hours || 0),
        conclusion: closeForm.conclusion || null,
      }),
    onSuccess: () => {
      toast.success(
        t("internal_audit.engagements.closed", "Closed, and its area is now current on the plan."),
      );
      invalidate();
      setClosing(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.engagements.close_failed", "Could not close it."))),
  });

  const addProcedure = useMutation({
    mutationFn: () =>
      internalAuditApi.addProcedure(testing!.id, {
        reference: procedureForm.reference,
        control_tested: procedureForm.control_tested || null,
        description: procedureForm.description,
        population_size: Number(procedureForm.population_size || 0),
        sample_size: Number(procedureForm.sample_size || 0),
        exceptions_found: Number(procedureForm.exceptions_found || 0),
        performed_by_name: procedureForm.performed_by_name || null,
      }),
    onSuccess: () => {
      toast.success(t("internal_audit.procedures.saved", "Working paper recorded."));
      invalidate();
      setTesting(null);
      setProcedureForm({
        reference: "",
        control_tested: "",
        description: "",
        population_size: "0",
        sample_size: "0",
        exceptions_found: "0",
        performed_by_name: "",
      });
    },
    // Impossible samples are refused by the API with an explanation.
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.procedures.save_failed", "Could not record it."))),
  });

  const engagements = (engagementsQuery.data?.data ?? []) as AuditEngagement[];
  const procedures = (proceduresQuery.data?.data ?? []) as AuditProcedure[];
  const areas = (areasQuery.data?.data ?? []) as AuditArea[];
  const summary = overviewQuery.data?.data?.engagements;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("internal_audit.engagements.title", "Engagements")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "internal_audit.engagements.subtitle",
              "An engagement cannot be closed without an opinion, and closing one is what marks its area current on the audit plan.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setPlanOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("internal_audit.engagements.plan", "Plan Engagement")}
        </Button>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("internal_audit.engagements.open", "Open")}
            value={n(summary.open).toLocaleString()}
            meta={t("internal_audit.engagements.overrunning_meta", "{n} past their planned end").replace(
              "{n}",
              String(n(summary.overrunning)),
            )}
            alert={n(summary.overrunning) > 0}
          />
          <StatTile
            label={t("internal_audit.engagements.closed_stat", "Closed")}
            value={n(summary.closed).toLocaleString()}
          />
          <StatTile
            label={t("internal_audit.engagements.hours", "Hours spent")}
            value={n(summary.actual_hours).toLocaleString()}
            meta={t("internal_audit.engagements.hours_meta", "against {n} planned").replace(
              "{n}",
              String(n(summary.planned_hours)),
            )}
          />
          <StatTile
            label={t("internal_audit.engagements.variance", "Average variance")}
            value={`${n(summary.average_hours_variance) >= 0 ? "+" : ""}${n(summary.average_hours_variance).toFixed(0)} h`}
            meta={t("internal_audit.engagements.variance_meta", "on closed engagements")}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="ae-status" className="text-xs">
            {t("internal_audit.common.status", "Status")}
          </Label>
          <select
            id="ae-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("internal_audit.common.any", "Any")}</option>
            {(Object.keys(NEXT_STATUSES) as EngagementStatus[]).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Panel
        title={t("internal_audit.engagements.list", "Audit plan")}
        description={t(
          "internal_audit.engagements.list_desc",
          "The period under review is not the period of the audit — both are kept, because a finding is about the former.",
        )}
      >
        {engagementsQuery.isLoading ? (
          <LoadingPanel label={t("internal_audit.common.loading", "Loading engagements...")} />
        ) : engagements.length === 0 ? (
          <EmptyPanel label={t("internal_audit.engagements.none", "No engagements planned.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">
                    {t("internal_audit.engagements.engagement", "Engagement")}
                  </th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.findings.area", "Area")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.common.status", "Status")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.engagements.opinion", "Opinion")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.engagements.hours_col", "Hours")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.engagements.work", "Work")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("internal_audit.common.actions", "Move")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {engagements.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{row.title}</span>
                      <span className="block text-[11px] capitalize tabular-nums text-muted-foreground">
                        {row.engagement_number} · {row.type.replace(/_/g, " ")}
                        {row.lead_auditor_name ? ` · ${row.lead_auditor_name}` : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{row.area?.name ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.status]}`}
                      >
                        {row.status}
                      </Badge>
                      {row.is_overrunning ? (
                        <span className="block text-[11px] font-semibold text-destructive">
                          {t("internal_audit.engagements.overrunning", "Overrunning")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs capitalize">
                      {row.opinion ? row.opinion.replace(/_/g, " ") : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(row.actual_hours)} / {n(row.planned_hours)}
                      {row.hours_variance !== null && row.hours_variance !== undefined ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {row.hours_variance >= 0 ? "+" : ""}
                          {row.hours_variance} h
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {t("internal_audit.engagements.papers", "{n} papers").replace(
                        "{n}",
                        String(n(row.procedures_count)),
                      )}
                      <span className="block text-[11px] text-muted-foreground">
                        {t("internal_audit.engagements.findings_count", "{n} findings").replace(
                          "{n}",
                          String(n(row.findings_count)),
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-6 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {row.is_open ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => setTesting(row)}
                          >
                            {t("internal_audit.procedures.add", "Add paper")}
                          </Button>
                        ) : null}
                        {(NEXT_STATUSES[row.status] ?? []).map((next) =>
                          next === "closed" ? (
                            <Button
                              key={next}
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => {
                                setClosing(row);
                                setCloseForm({
                                  opinion: "satisfactory",
                                  actual_hours: String(n(row.actual_hours) || n(row.planned_hours)),
                                  conclusion: "",
                                });
                              }}
                            >
                              {t("internal_audit.engagements.close", "Close")}
                            </Button>
                          ) : (
                            <Button
                              key={next}
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] capitalize"
                              disabled={transition.isPending}
                              onClick={() => transition.mutate({ id: row.id, next })}
                            >
                              {next}
                            </Button>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={t("internal_audit.procedures.title", "Working papers")}
        description={t(
          "internal_audit.procedures.desc",
          "The exception rate is computed from the sample actually examined, not the population — dividing by the population would flatter a failing test badly.",
        )}
      >
        {proceduresQuery.isLoading ? (
          <LoadingPanel label={t("internal_audit.common.loading", "Loading working papers...")} />
        ) : procedures.length === 0 ? (
          <EmptyPanel label={t("internal_audit.procedures.none", "No working papers recorded.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.procedures.ref", "Ref")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.procedures.control", "Control tested")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.procedures.sample", "Sample")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.procedures.exceptions", "Exceptions")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.procedures.rate", "Rate")}</th>
                  <th className="pb-2 pr-6 font-semibold">{t("internal_audit.procedures.conclusion", "Conclusion")}</th>
                </tr>
              </thead>
              <tbody>
                {procedures.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3 font-medium tabular-nums">{row.reference}</td>
                    <td className="py-2 pr-3">
                      <span className="block text-xs">{row.control_tested ?? row.description}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {row.engagement?.engagement_number ?? `#${row.engagement_id}`}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(row.sample_size).toLocaleString()}
                      {n(row.population_size) > 0 ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {t("internal_audit.procedures.of_population", "of {n}").replace(
                            "{n}",
                            n(row.population_size).toLocaleString(),
                          )}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">{n(row.exceptions_found)}</td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {/* Null, not zero: a test that examined nothing has no
                          rate, and zero would read as a clean result. */}
                      {row.exception_rate_percent === null || row.exception_rate_percent === undefined
                        ? t("internal_audit.procedures.not_tested", "not tested")
                        : `${row.exception_rate_percent.toFixed(1)}%`}
                    </td>
                    <td className="py-2 pr-6">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {row.conclusion.replace(/_/g, " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Plan */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.engagements.plan", "Plan Engagement")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.engagements.plan_desc",
                  "The period under review is what the audit looks at; the planned dates are when the team does the looking.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="e-area">{t("internal_audit.findings.area", "Area")}</Label>
              <select
                id="e-area"
                value={form.area_id}
                onChange={(event) => setForm({ ...form, area_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("internal_audit.engagements.no_area", "Not against a single area")}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.code} — {area.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="e-title">{t("internal_audit.findings.title_field", "Title")}</Label>
              <Input
                id="e-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-type">{t("internal_audit.engagements.type", "Type")}</Label>
              <select
                id="e-type"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-lead">{t("internal_audit.engagements.lead", "Lead auditor")}</Label>
              <Input
                id="e-lead"
                value={form.lead_auditor_name}
                onChange={(event) => setForm({ ...form, lead_auditor_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-pfrom">{t("internal_audit.engagements.period_from", "Period from")}</Label>
              <Input
                id="e-pfrom"
                type="date"
                value={form.period_from}
                onChange={(event) => setForm({ ...form, period_from: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-pto">{t("internal_audit.engagements.period_to", "Period to")}</Label>
              <Input
                id="e-pto"
                type="date"
                min={form.period_from}
                value={form.period_to}
                onChange={(event) => setForm({ ...form, period_to: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-start">{t("internal_audit.engagements.start", "Planned start")}</Label>
              <Input
                id="e-start"
                type="date"
                value={form.planned_start_on}
                onChange={(event) => setForm({ ...form, planned_start_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-end">{t("internal_audit.engagements.end", "Planned end")}</Label>
              <Input
                id="e-end"
                type="date"
                min={form.planned_start_on}
                value={form.planned_end_on}
                onChange={(event) => setForm({ ...form, planned_end_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-hours">{t("internal_audit.engagements.planned_hours", "Planned hours")}</Label>
              <Input
                id="e-hours"
                type="number"
                min={0}
                value={form.planned_hours}
                onChange={(event) => setForm({ ...form, planned_hours: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="e-objective">{t("internal_audit.engagements.objective", "Objective")}</Label>
              <Input
                id="e-objective"
                value={form.objective}
                onChange={(event) => setForm({ ...form, objective: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setPlanOpen(false)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => plan.mutate()} disabled={plan.isPending || !form.title.trim()}>
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close with an opinion */}
      <Dialog open={closing !== null} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.engagements.close", "Close Engagement")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.engagements.close_desc",
                  "An opinion is the product of the audit, so it is required here. Closing also stamps the area as audited, which is what keeps the plan's 'overdue' honest.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="c-opinion">{t("internal_audit.engagements.opinion", "Opinion")}</Label>
              <select
                id="c-opinion"
                value={closeForm.opinion}
                onChange={(event) => setCloseForm({ ...closeForm, opinion: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {OPINIONS.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-hours">{t("internal_audit.engagements.actual_hours", "Actual hours")}</Label>
              <Input
                id="c-hours"
                type="number"
                min={0}
                value={closeForm.actual_hours}
                onChange={(event) => setCloseForm({ ...closeForm, actual_hours: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-conclusion">{t("internal_audit.engagements.conclusion", "Conclusion")}</Label>
              <Input
                id="c-conclusion"
                value={closeForm.conclusion}
                onChange={(event) => setCloseForm({ ...closeForm, conclusion: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setClosing(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => close.mutate()} disabled={close.isPending}>
              {t("internal_audit.engagements.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Working paper */}
      <Dialog open={testing !== null} onOpenChange={(open) => !open && setTesting(null)}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.procedures.add", "Record working paper")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.procedures.add_desc",
                  "A test cannot find more exceptions than the sample it examined, and a sample cannot exceed its population — both are refused rather than explained away later.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-ref">{t("internal_audit.procedures.ref", "Reference")}</Label>
              <Input
                id="p-ref"
                value={procedureForm.reference}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, reference: event.target.value })
                }
                placeholder="P-01"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-by">{t("internal_audit.procedures.performed_by", "Performed by")}</Label>
              <Input
                id="p-by"
                value={procedureForm.performed_by_name}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, performed_by_name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-control">{t("internal_audit.procedures.control", "Control tested")}</Label>
              <Input
                id="p-control"
                value={procedureForm.control_tested}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, control_tested: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-desc">{t("internal_audit.procedures.description", "What was done")}</Label>
              <Input
                id="p-desc"
                value={procedureForm.description}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, description: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-pop">{t("internal_audit.procedures.population", "Population")}</Label>
              <Input
                id="p-pop"
                type="number"
                min={0}
                value={procedureForm.population_size}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, population_size: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sample">{t("internal_audit.procedures.sample_size", "Sample")}</Label>
              <Input
                id="p-sample"
                type="number"
                min={0}
                value={procedureForm.sample_size}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, sample_size: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-exceptions">
                {t("internal_audit.procedures.exceptions", "Exceptions")}
              </Label>
              <Input
                id="p-exceptions"
                type="number"
                min={0}
                value={procedureForm.exceptions_found}
                onChange={(event) =>
                  setProcedureForm({ ...procedureForm, exceptions_found: event.target.value })
                }
              />
            </div>
            <p className="self-end pb-2 text-xs text-muted-foreground">
              {Number(procedureForm.sample_size) > 0
                ? t("internal_audit.procedures.rate_preview", "Rate: {n}%").replace(
                    "{n}",
                    (
                      (Number(procedureForm.exceptions_found || 0) /
                        Number(procedureForm.sample_size)) *
                      100
                    ).toFixed(1),
                  )
                : t("internal_audit.procedures.not_tested", "not tested")}
            </p>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setTesting(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => addProcedure.mutate()}
              disabled={
                addProcedure.isPending ||
                !procedureForm.reference.trim() ||
                !procedureForm.description.trim()
              }
            >
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
