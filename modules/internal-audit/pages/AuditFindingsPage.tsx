"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Repeat } from "lucide-react";
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
  AuditAction,
  AuditEngagement,
  AuditFinding,
  FindingStatus,
  Severity,
} from "@/modules/internal-audit/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const SEVERITIES: Severity[] = ["low", "moderate", "high", "critical"];

/**
 * Mirrors the server's own transitions so the buttons offered are the ones
 * that work. The server stays the authority — anything else comes back 422
 * and surfaces as a toast in the API's own words.
 */
const NEXT_STATUSES: Record<FindingStatus, FindingStatus[]> = {
  open: ["in_progress", "accepted_risk"],
  in_progress: ["resolved", "accepted_risk"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
  accepted_risk: ["in_progress"],
};

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  moderate: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  low: "bg-muted text-muted-foreground",
};

const STATUS_TONE: Record<FindingStatus, string> = {
  open: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
  accepted_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function AuditFindingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [openOnly, setOpenOnly] = React.useState(false);
  const [repeatsOnly, setRepeatsOnly] = React.useState(false);

  const [raiseOpen, setRaiseOpen] = React.useState(false);
  const [agreeing, setAgreeing] = React.useState<AuditFinding | null>(null);
  const [verifying, setVerifying] = React.useState<AuditAction | null>(null);

  const [form, setForm] = React.useState({
    engagement_id: "",
    title: "",
    severity: "moderate",
    condition: "",
    criteria: "",
    cause: "",
    effect: "",
    recommendation: "",
    financial_impact: "0",
  });

  const [actionForm, setActionForm] = React.useState({
    description: "",
    owner_name: "",
    due_on: "",
  });

  const [verifyForm, setVerifyForm] = React.useState({
    verified_by_name: "",
    verification_note: "",
  });

  const findingsQuery = useQuery({
    queryKey: ["internal-audit", "findings", search, status, severity, openOnly, repeatsOnly],
    queryFn: () =>
      internalAuditApi
        .listFindings({
          limit: 25,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(severity ? { severity } : {}),
          ...(openOnly ? { open_only: 1 } : {}),
          ...(repeatsOnly ? { repeats_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const actionsQuery = useQuery({
    queryKey: ["internal-audit", "actions"],
    queryFn: () => internalAuditApi.listActions({ limit: 50 }).then((res) => res.data),
  });

  const engagementsQuery = useQuery({
    queryKey: ["internal-audit", "open-engagements"],
    queryFn: () =>
      internalAuditApi.listEngagements({ limit: 100, open_only: 1 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["internal-audit", "overview-findings"],
    queryFn: () => internalAuditApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["internal-audit"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const raise = useMutation({
    mutationFn: () =>
      internalAuditApi.createFinding({
        engagement_id: Number(form.engagement_id),
        title: form.title,
        severity: form.severity,
        condition: form.condition || null,
        criteria: form.criteria || null,
        cause: form.cause || null,
        effect: form.effect || null,
        recommendation: form.recommendation || null,
        financial_impact: Number(form.financial_impact || 0),
      }),
    onSuccess: (response: any) => {
      // The API says so itself when it detected a repeat, so echo its words.
      toast.success(response?.data?.message ?? t("internal_audit.findings.raised", "Finding raised."));
      invalidate();
      setRaiseOpen(false);
      setForm({
        engagement_id: "",
        title: "",
        severity: "moderate",
        condition: "",
        criteria: "",
        cause: "",
        effect: "",
        recommendation: "",
        financial_impact: "0",
      });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.findings.raise_failed", "Could not raise it."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, next }: { id: number; next: FindingStatus }) =>
      internalAuditApi.transitionFinding(id, next),
    onSuccess: () => {
      toast.success(t("internal_audit.findings.moved", "Finding updated."));
      invalidate();
    },
    // Closing over outstanding actions is refused by the API, with its reason.
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.findings.move_failed", "Could not move it."))),
  });

  const agreeAction = useMutation({
    mutationFn: () =>
      internalAuditApi.agreeAction(agreeing!.id, {
        description: actionForm.description,
        owner_name: actionForm.owner_name,
        due_on: actionForm.due_on,
      }),
    onSuccess: () => {
      toast.success(t("internal_audit.findings.action_agreed", "Action agreed."));
      invalidate();
      setAgreeing(null);
      setActionForm({ description: "", owner_name: "", due_on: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.findings.action_failed", "Could not agree it."))),
  });

  const completeAction = useMutation({
    mutationFn: (id: number) => internalAuditApi.completeAction(id),
    onSuccess: () => {
      toast.success(t("internal_audit.actions.completed", "Action recorded as complete."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not complete it.")),
  });

  const verifyAction = useMutation({
    mutationFn: () =>
      internalAuditApi.verifyAction(verifying!.id, {
        verified_by_name: verifyForm.verified_by_name,
        verification_note: verifyForm.verification_note || null,
      }),
    onSuccess: () => {
      toast.success(t("internal_audit.actions.verified", "Verified."));
      invalidate();
      setVerifying(null);
      setVerifyForm({ verified_by_name: "", verification_note: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("internal_audit.actions.verify_failed", "Could not verify it."))),
  });

  const findings = (findingsQuery.data?.data ?? []) as AuditFinding[];
  const actions = (actionsQuery.data?.data ?? []) as AuditAction[];
  const engagements = (engagementsQuery.data?.data ?? []) as AuditEngagement[];
  const summary = overviewQuery.data?.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("internal_audit.findings.title", "Findings and Actions")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "internal_audit.findings.subtitle",
              "A finding cannot be closed while its agreed actions are still outstanding — closing over them would report remediation that never happened.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setRaiseOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("internal_audit.findings.raise", "Raise Finding")}
        </Button>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("internal_audit.findings.open", "Open findings")}
            value={n(summary.findings?.open).toLocaleString()}
            meta={t("internal_audit.findings.severe_meta", "{n} high or critical").replace(
              "{n}",
              String(n(summary.findings?.severe_open)),
            )}
            alert={n(summary.findings?.severe_open) > 0}
          />
          <StatTile
            label={t("internal_audit.overview.overdue", "Actions overdue")}
            value={n(summary.remediation?.overdue).toLocaleString()}
            alert={n(summary.remediation?.overdue) > 0}
          />
          <StatTile
            label={t("internal_audit.findings.awaiting", "Awaiting verification")}
            value={n(summary.remediation?.awaiting_verification).toLocaleString()}
            meta={t("internal_audit.findings.awaiting_meta", "done, but not yet checked")}
          />
          <StatTile
            label={t("internal_audit.overview.repeats", "Repeats")}
            value={n(summary.findings?.repeats).toLocaleString()}
            meta={t("internal_audit.findings.repeat_meta", "{n}% of all findings").replace(
              "{n}",
              n(summary.findings?.repeat_percent).toFixed(0),
            )}
            alert={n(summary.findings?.repeats) > 0}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="af-search" className="text-xs">
            {t("internal_audit.common.search", "Search")}
          </Label>
          <Input
            id="af-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("internal_audit.findings.search_hint", "Number or title")}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="af-status" className="text-xs">
            {t("internal_audit.common.status", "Status")}
          </Label>
          <select
            id="af-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("internal_audit.common.any", "Any")}</option>
            {(Object.keys(NEXT_STATUSES) as FindingStatus[]).map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="af-severity" className="text-xs">
            {t("internal_audit.common.severity", "Severity")}
          </Label>
          <select
            id="af-severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("internal_audit.common.any", "Any")}</option>
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {value}
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
          {t("internal_audit.findings.open_only", "Open only")}
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={repeatsOnly}
            onChange={(event) => setRepeatsOnly(event.target.checked)}
            className="h-4 w-4"
          />
          {t("internal_audit.findings.repeats_only", "Repeats only")}
        </label>
      </div>

      <Panel
        title={t("internal_audit.findings.register", "Findings")}
        description={t(
          "internal_audit.findings.register_desc",
          "A repeat is detected from an earlier closed finding in the same area, not ticked by whoever writes this one up.",
        )}
      >
        {findingsQuery.isLoading ? (
          <LoadingPanel label={t("internal_audit.common.loading", "Loading findings...")} />
        ) : findings.length === 0 ? (
          <EmptyPanel label={t("internal_audit.findings.none", "No findings match those filters.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.findings.finding", "Finding")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.findings.area", "Area")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.common.severity", "Severity")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.common.status", "Status")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.findings.actions_col", "Actions")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.findings.age", "Age")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("internal_audit.common.actions", "Move")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {findings.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5 font-medium">
                        {row.title}
                        {row.is_repeat ? (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300"
                            title={t(
                              "internal_audit.findings.repeat_title",
                              "Repeats an earlier finding closed in this area",
                            )}
                          >
                            <Repeat className="h-2.5 w-2.5" aria-hidden />
                            {t("internal_audit.findings.repeat", "Repeat")}
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {row.finding_number}
                        {row.engagement ? ` · ${row.engagement.engagement_number}` : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{row.area?.name ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${SEVERITY_TONE[row.severity]}`}
                      >
                        {row.severity}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.status]}`}
                      >
                        {row.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(row.actions_count)}
                      {n(row.outstanding_actions_count) > 0 ? (
                        <span className="block text-[11px] font-semibold text-destructive">
                          {t("internal_audit.findings.outstanding", "{n} outstanding").replace(
                            "{n}",
                            String(n(row.outstanding_actions_count)),
                          )}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {row.age_days !== null && row.age_days !== undefined
                        ? t("internal_audit.findings.days", "{n} days").replace(
                            "{n}",
                            String(row.age_days),
                          )
                        : "—"}
                    </td>
                    <td className="py-2 pr-6 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {/* The API refuses new actions on a closed finding, so
                            the button is not offered there either. */}
                        {row.status !== "closed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => setAgreeing(row)}
                          >
                            {t("internal_audit.findings.agree", "Agree action")}
                          </Button>
                        ) : null}
                        {(NEXT_STATUSES[row.status] ?? []).map((next) => (
                          <Button
                            key={next}
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] capitalize"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ id: row.id, next })}
                          >
                            {next.replace(/_/g, " ")}
                          </Button>
                        ))}
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
        title={t("internal_audit.actions.title", "Agreed actions")}
        description={t(
          "internal_audit.actions.desc",
          "Verification is a separate act by audit: management completing its own action is not evidence the control now works.",
        )}
      >
        {actionsQuery.isLoading ? (
          <LoadingPanel label={t("internal_audit.common.loading", "Loading actions...")} />
        ) : actions.length === 0 ? (
          <EmptyPanel label={t("internal_audit.actions.none", "No actions agreed yet.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.actions.action", "Action")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.actions.owner", "Owner")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.actions.due", "Due")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.common.status", "Status")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("internal_audit.actions.verified", "Verified")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("internal_audit.common.actions", "Move")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => (
                  <tr key={action.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block">{action.description}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {action.finding?.finding_number ?? `#${action.finding_id}`}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{action.owner_name}</td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {String(action.due_on).slice(0, 10)}
                      {action.is_overdue ? (
                        <span className="block text-[11px] font-semibold text-destructive">
                          {t("internal_audit.actions.overdue", "{n} days overdue").replace(
                            "{n}",
                            String(n(action.days_overdue)),
                          )}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {action.status.replace(/_/g, " ")}
                      </Badge>
                      {action.days_late !== null && action.days_late !== undefined ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {action.days_late <= 0
                            ? t("internal_audit.actions.on_time", "on time")
                            : t("internal_audit.actions.late", "{n} days late").replace(
                                "{n}",
                                String(action.days_late),
                              )}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {action.is_verified ? (
                        <>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {t("internal_audit.actions.yes", "Yes")}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {action.verified_by_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("internal_audit.actions.no", "Not yet")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-6 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {action.status !== "completed" && action.status !== "cancelled" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            disabled={completeAction.isPending}
                            onClick={() => completeAction.mutate(action.id)}
                          >
                            {t("internal_audit.actions.complete", "Complete")}
                          </Button>
                        ) : null}
                        {action.status === "completed" && !action.is_verified ? (
                          <Button
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => setVerifying(action)}
                          >
                            {t("internal_audit.actions.verify", "Verify")}
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

      {/* Raise a finding */}
      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.findings.raise", "Raise Finding")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.findings.raise_desc",
                  "Splitting condition, criteria, cause and effect is what stops a finding collapsing into a paragraph nobody can act on. If this repeats one already closed in the same area, it will be flagged automatically.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="f-engagement">
                {t("internal_audit.findings.engagement", "Engagement")}
              </Label>
              <select
                id="f-engagement"
                value={form.engagement_id}
                onChange={(event) => setForm({ ...form, engagement_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("internal_audit.common.select", "Select...")}</option>
                {engagements.map((engagement) => (
                  <option key={engagement.id} value={engagement.id}>
                    {engagement.engagement_number} — {engagement.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="f-title">{t("internal_audit.findings.title_field", "Title")}</Label>
              <Input
                id="f-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={t(
                  "internal_audit.findings.title_hint",
                  "Purchase orders raised after the invoice date",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-severity">{t("internal_audit.common.severity", "Severity")}</Label>
              <select
                id="f-severity"
                value={form.severity}
                onChange={(event) => setForm({ ...form, severity: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {SEVERITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-impact">
                {t("internal_audit.findings.impact", "Financial impact")}
              </Label>
              <Input
                id="f-impact"
                type="number"
                min={0}
                value={form.financial_impact}
                onChange={(event) => setForm({ ...form, financial_impact: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-condition">
                {t("internal_audit.findings.condition", "Condition — what is")}
              </Label>
              <Input
                id="f-condition"
                value={form.condition}
                onChange={(event) => setForm({ ...form, condition: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-criteria">
                {t("internal_audit.findings.criteria", "Criteria — what should be")}
              </Label>
              <Input
                id="f-criteria"
                value={form.criteria}
                onChange={(event) => setForm({ ...form, criteria: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-cause">
                {t("internal_audit.findings.cause", "Cause — why the gap exists")}
              </Label>
              <Input
                id="f-cause"
                value={form.cause}
                onChange={(event) => setForm({ ...form, cause: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-effect">
                {t("internal_audit.findings.effect", "Effect — what it costs")}
              </Label>
              <Input
                id="f-effect"
                value={form.effect}
                onChange={(event) => setForm({ ...form, effect: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="f-recommendation">
                {t("internal_audit.findings.recommendation", "Recommendation")}
              </Label>
              <Input
                id="f-recommendation"
                value={form.recommendation}
                onChange={(event) => setForm({ ...form, recommendation: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRaiseOpen(false)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => raise.mutate()}
              disabled={raise.isPending || !form.engagement_id || !form.title.trim()}
            >
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agree an action */}
      <Dialog open={agreeing !== null} onOpenChange={(open) => !open && setAgreeing(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.findings.agree", "Agree action")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.findings.agree_desc",
                  "The action belongs to management, not to audit. Naming an owner and a date is the difference between an agreed action and a suggestion.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="a-description">
                {t("internal_audit.actions.description", "What will be done")}
              </Label>
              <Input
                id="a-description"
                value={actionForm.description}
                onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="a-owner">{t("internal_audit.actions.owner", "Owner")}</Label>
                <Input
                  id="a-owner"
                  value={actionForm.owner_name}
                  onChange={(event) =>
                    setActionForm({ ...actionForm, owner_name: event.target.value })
                  }
                  placeholder={t("internal_audit.actions.owner_hint", "Procurement Manager")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-due">{t("internal_audit.actions.due", "Due")}</Label>
                <Input
                  id="a-due"
                  type="date"
                  value={actionForm.due_on}
                  onChange={(event) => setActionForm({ ...actionForm, due_on: event.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAgreeing(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => agreeAction.mutate()}
              disabled={
                agreeAction.isPending ||
                !actionForm.description.trim() ||
                !actionForm.owner_name.trim() ||
                !actionForm.due_on
              }
            >
              {t("internal_audit.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify */}
      <Dialog open={verifying !== null} onOpenChange={(open) => !open && setVerifying(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("internal_audit.actions.verify", "Verify")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "internal_audit.actions.verify_desc",
                  "Record who re-tested the control and what they found. This is audit's own act, which is why it is separate from management marking the action complete.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="v-by">{t("internal_audit.actions.verified_by", "Verified by")}</Label>
              <Input
                id="v-by"
                value={verifyForm.verified_by_name}
                onChange={(event) =>
                  setVerifyForm({ ...verifyForm, verified_by_name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-note">{t("internal_audit.actions.note", "What was re-tested")}</Label>
              <Input
                id="v-note"
                value={verifyForm.verification_note}
                onChange={(event) =>
                  setVerifyForm({ ...verifyForm, verification_note: event.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setVerifying(null)}>
              {t("internal_audit.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => verifyAction.mutate()}
              disabled={verifyAction.isPending || !verifyForm.verified_by_name.trim()}
            >
              {t("internal_audit.actions.verify", "Verify")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
