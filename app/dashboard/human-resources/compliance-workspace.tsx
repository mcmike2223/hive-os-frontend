"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpenCheck,
  Check,
  CircleDot,
  ExternalLink,
  FileClock,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { formatEthiopian } from "@/lib/ethiopian-calendar";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import { attendanceFetch } from "@/modules/attendance/api";
import {
  CompliancePolicyVersion,
  CompliancePolicyWorkspace,
  WorkforceReadiness,
  hrFetch,
} from "@/modules/humanresources/api";

const controlClass =
  "min-h-11 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";

const statusStyles: Record<
  CompliancePolicyVersion["status"],
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100",
  },
  reviewed: {
    label: "Legally reviewed",
    className:
      "border-blue-700 bg-blue-50 text-blue-950 dark:border-blue-300 dark:bg-blue-950 dark:text-blue-100",
  },
  active: {
    label: "Active",
    className:
      "border-emerald-700 bg-emerald-50 text-emerald-950 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100",
  },
  retired: {
    label: "Retired",
    className:
      "border-slate-600 bg-slate-100 text-slate-950 dark:border-slate-400 dark:bg-slate-900 dark:text-slate-100",
  },
};

function parsePolicyDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }

  return new Date(value);
}

function PolicyDate({
  value,
}: {
  value: string | null | undefined;
}) {
  if (!value) return <span>Not recorded</span>;

  const date = parsePolicyDate(value);
  if (Number.isNaN(date.getTime())) return <span>Invalid date</span>;

  const gregorian = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(date);

  return (
    <time dateTime={value} className="inline-flex flex-col gap-0.5">
      <span>
        <span className="font-bold">Gregorian:</span> {gregorian}
      </span>
      <span className="text-xs text-slate-700 dark:text-slate-300">
        <span className="font-bold">Ethiopian:</span> {formatEthiopian(date)}
      </span>
    </time>
  );
}

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function PolicyStageRail({ policy }: { policy: CompliancePolicyVersion }) {
  const reviewed = ["reviewed", "active", "retired"].includes(policy.status);
  const active = policy.status === "active";
  const stages = [
    { label: "Draft created", complete: true, current: policy.status === "draft" },
    {
      label: "HR/legal review",
      complete: reviewed,
      current: policy.status === "reviewed",
    },
    { label: "Production activation", complete: active, current: active },
  ];

  return (
    <ol aria-label="Policy activation progress" className="grid gap-3 sm:grid-cols-3">
      {stages.map((stage, index) => (
        <li
          key={stage.label}
          className="relative rounded-xl border border-slate-500 bg-white p-4 dark:border-slate-400 dark:bg-slate-950"
        >
          <div className="flex items-center gap-2 font-bold">
            {stage.complete ? (
              <Check aria-hidden="true" className="size-5 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <CircleDot aria-hidden="true" className="size-5 text-slate-700 dark:text-slate-300" />
            )}
            <span>{index + 1}. {stage.label}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            {stage.current ? "Current stage" : stage.complete ? "Complete" : "Pending"}
          </p>
        </li>
      ))}
    </ol>
  );
}

function RuleValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-500 bg-white p-4 dark:border-slate-400 dark:bg-slate-950">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
        {label}
      </dt>
      <dd className="mt-2 text-lg font-black text-slate-950 dark:text-white">
        {value}
      </dd>
    </div>
  );
}

export function ComplianceWorkspace() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("manage_hr_compliance");
  const canReview = hasPermission("review_hr_compliance_policies");
  const canActivate = hasPermission("activate_hr_compliance_policies");
  const canAudit = hasPermission("view_workforce_audit");
  const errorRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [retentionYears, setRetentionYears] = useState("7");
  const [attested, setAttested] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ["hr-compliance-policies", scope],
    queryFn: () =>
      hrFetch<{ data: CompliancePolicyWorkspace }>("/compliance-policies"),
  });
  const readinessQuery = useQuery({
    queryKey: ["workforce-readiness", scope],
    queryFn: () =>
      attendanceFetch<{ data: WorkforceReadiness }>("/operations/readiness"),
    enabled: canAudit,
    refetchInterval: 60_000,
  });

  const versions = workspaceQuery.data?.data.versions ?? [];
  const selected = useMemo(
    () =>
      versions.find((version) => version.id === selectedId) ??
      versions.find((version) => version.status === "reviewed") ??
      versions.find((version) => version.is_active) ??
      versions[0] ??
      null,
    [selectedId, versions],
  );
  const validation = selected
    ? workspaceQuery.data?.data.validation[String(selected.id)]
    : undefined;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setReviewerName(selected.legal_reviewer_name ?? "");
    setReviewNote(selected.legal_review_note ?? "");
    setRetentionYears(String(selected.rules.record_retention.years ?? 7));
    setAttested(false);
    setError("");
  }, [selected?.id]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["hr-compliance-policies", scope] }),
      queryClient.invalidateQueries({ queryKey: ["workforce-readiness", scope] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      hrFetch<{ data: CompliancePolicyVersion }>("/compliance-policies/from-preset", {
        method: "POST",
      }),
    onSuccess: async ({ data }) => {
      setSelectedId(data.id);
      await refresh();
      toast.success("Compliance draft created");
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Select a policy version to review.");
      return hrFetch<{ data: CompliancePolicyVersion }>(
        `/compliance-policies/${selected.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            legal_reviewer_name: reviewerName,
            legal_review_note: reviewNote,
            record_retention_years: Number(retentionYears),
            attested,
          }),
        },
      );
    },
    onSuccess: async () => {
      setError("");
      setAttested(false);
      await refresh();
      toast.success("Legal review recorded");
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const activateMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Select a reviewed policy to activate.");
      return hrFetch<{ data: CompliancePolicyVersion }>(
        `/compliance-policies/${selected.id}/activate`,
        {
          method: "POST",
          body: JSON.stringify({ confirmed: true }),
        },
      );
    },
    onSuccess: async () => {
      setError("");
      await refresh();
      toast.success("Compliance policy activated");
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  if (workspaceQuery.isLoading) {
    return (
      <p role="status" className="rounded-xl border border-slate-500 p-5 dark:border-slate-400">
        Loading compliance policy versions…
      </p>
    );
  }
  if (workspaceQuery.isError) {
    return (
      <div role="alert" className="rounded-xl border border-red-700 bg-red-50 p-5 text-red-950 dark:border-red-300 dark:bg-red-950 dark:text-red-100">
        Compliance policies could not be loaded. {workspaceQuery.error.message}
      </div>
    );
  }

  const preset = workspaceQuery.data?.data.preset;
  const readiness = readinessQuery.data?.data;

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-white">
        <div className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-300">
              Legal activation docket
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Ethiopian workforce compliance
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
              Clone the verified preset, record tenant-specific HR/legal review,
              and activate one effective-dated policy version. Calculations retain
              the version and source hash that governed them.
            </p>
          </div>
          {(canManage || canReview) && (
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="min-h-11 bg-teal-300 font-bold text-slate-950 hover:bg-teal-200 focus-visible:ring-white"
            >
              <FileClock aria-hidden="true" />
              {createMutation.isPending ? "Creating draft…" : "Create preset draft"}
            </Button>
          )}
        </div>
      </header>

      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          aria-labelledby="compliance-error-title"
          className="rounded-xl border border-red-700 bg-red-50 p-4 text-red-950 outline-none focus-visible:ring-2 focus-visible:ring-red-800 dark:border-red-300 dark:bg-red-950 dark:text-red-100 dark:focus-visible:ring-red-200"
        >
          <h3 id="compliance-error-title" className="font-black">
            Compliance action needs attention
          </h3>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {selected ? (
        <>
          <Card className="border-slate-500 dark:border-slate-400">
            <CardHeader className="gap-4 border-b border-slate-500 dark:border-slate-400">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    {selected.policy_version}
                  </p>
                  <CardTitle className="mt-2 text-2xl">{selected.name}</CardTitle>
                  <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2 text-sm text-slate-700 dark:text-slate-300">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide">
                        Effective date
                      </p>
                      <PolicyDate value={selected.effective_from} />
                    </div>
                    <p>
                      Preset revision{" "}
                      <span className="font-mono font-bold">{selected.preset_revision}</span>
                    </p>
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-sm font-bold ${statusStyles[selected.status].className}`}>
                  {statusStyles[selected.status].label}
                </span>
              </div>
              <PolicyStageRail policy={selected} />
            </CardHeader>
            <CardContent className="space-y-6 p-5 sm:p-6">
              <section aria-labelledby="working-time-rules">
                <h3 id="working-time-rules" className="text-xl font-black">
                  Working time and overtime
                </h3>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <RuleValue label="Normal day" value={`${selected.rules.working_time.maximum_hours_per_day} hours`} />
                  <RuleValue label="Normal week" value={`${selected.rules.working_time.maximum_hours_per_week} hours`} />
                  <RuleValue label="Weekly rest" value={`${selected.rules.working_time.weekly_rest_minimum_hours} hours`} />
                  <RuleValue label="Overtime ceiling" value={`${selected.rules.working_time.overtime_maximum_hours_per_day}h/day · ${selected.rules.working_time.overtime_maximum_hours_per_week}h/week`} />
                </dl>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(selected.rules.working_time.overtime_multipliers).map(([key, value]) => (
                    <RuleValue key={key} label={`${humanize(key)} overtime`} value={`${value}×`} />
                  ))}
                </dl>
              </section>

              <section aria-labelledby="leave-rule-summary">
                <h3 id="leave-rule-summary" className="text-xl font-black">
                  Leave and protected workers
                </h3>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <RuleValue label="Annual leave, first year" value={`${selected.rules.leave.annual.first_year_working_days} working days`} />
                  <RuleValue label="Maternity leave" value={`${selected.rules.leave.maternity.prenatal_paid_consecutive_days + selected.rules.leave.maternity.postnatal_paid_consecutive_days} paid days`} />
                  <RuleValue label="Paternity leave" value={`${selected.rules.leave.paternity_paid_consecutive_days} paid days`} />
                  <RuleValue label="Young-worker day" value={`${selected.rules.young_workers.maximum_hours_per_day} hours maximum`} />
                </dl>
              </section>

              <section aria-labelledby="policy-source">
                <div className="flex items-center gap-2">
                  <BookOpenCheck aria-hidden="true" className="size-5 text-blue-800 dark:text-blue-200" />
                  <h3 id="policy-source" className="text-xl font-black">
                    Source and validation
                  </h3>
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  {selected.legal_instrument}. Source fingerprint{" "}
                  <span className="font-mono">{selected.legal_source_hash.slice(0, 16)}…</span>
                </p>
                <a
                  href={selected.legal_source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-700 px-4 py-2 font-bold text-blue-900 underline decoration-2 underline-offset-4 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 dark:border-blue-300 dark:text-blue-100 dark:hover:bg-blue-950 dark:focus-visible:ring-blue-200"
                >
                  Open Labour Proclamation source
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {selected.source_metadata.citations.map((citation) => (
                    <li key={`${citation.topic}-${citation.article}`} className="rounded-lg border border-slate-500 p-3 text-sm dark:border-slate-400">
                      <span className="font-bold">{humanize(citation.topic)}</span>
                      <span className="ml-2 text-slate-700 dark:text-slate-300">
                        Article {citation.article}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-2">
                  {(validation?.findings ?? []).map((finding) => (
                    <div
                      key={finding.code}
                      className="flex items-start gap-2 rounded-lg border border-slate-500 p-3 text-sm dark:border-slate-400"
                    >
                      {finding.severity === "ok" ? (
                        <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                      ) : (
                        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-800 dark:text-amber-200" />
                      )}
                      <span>
                        <strong>{finding.severity === "ok" ? "Validated:" : "Action required:"}</strong>{" "}
                        {finding.message}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>

          {(canReview || canActivate) && selected.status !== "retired" && (
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              {canReview && !selected.is_active && (
                <Card className="border-blue-700 dark:border-blue-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Scale aria-hidden="true" />
                      Record HR/legal review
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setError("");
                        reviewMutation.mutate();
                      }}
                    >
                      <div>
                        <Label htmlFor="legal-reviewer-name">Legal reviewer name (required)</Label>
                        <Input
                          id="legal-reviewer-name"
                          value={reviewerName}
                          onChange={(event) => setReviewerName(event.target.value)}
                          required
                          autoComplete="name"
                          aria-describedby="legal-reviewer-name-hint"
                          className={`mt-2 ${controlClass}`}
                        />
                        <p id="legal-reviewer-name-hint" className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Enter the accountable HR or legal reviewer shown in the audit record.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="retention-years">Workforce evidence retention years (required)</Label>
                        <Input
                          id="retention-years"
                          type="number"
                          min={1}
                          max={25}
                          value={retentionYears}
                          onChange={(event) => setRetentionYears(event.target.value)}
                          required
                          aria-describedby="retention-years-hint"
                          className={`mt-2 ${controlClass}`}
                        />
                        <p id="retention-years-hint" className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          The proclamation requires records but does not define one universal duration in this preset. Record the tenant-approved period.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="legal-review-note">Review basis and limitations (required)</Label>
                        <Textarea
                          id="legal-review-note"
                          value={reviewNote}
                          onChange={(event) => setReviewNote(event.target.value)}
                          required
                          minLength={20}
                          aria-describedby="legal-review-note-hint"
                          className={`mt-2 min-h-28 ${controlClass}`}
                        />
                        <p id="legal-review-note-hint" className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Document the legal review, tenant assumptions, collective agreements, and unresolved interpretations.
                        </p>
                      </div>
                      <div className="flex items-start gap-3 rounded-xl border border-slate-500 p-4 dark:border-slate-400">
                        <input
                          id="legal-review-attestation"
                          type="checkbox"
                          checked={attested}
                          onChange={(event) => setAttested(event.target.checked)}
                          required
                          className="mt-1 size-5 rounded border-slate-600 accent-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 dark:border-slate-300 dark:accent-blue-300 dark:focus-visible:ring-blue-200"
                        />
                        <Label htmlFor="legal-review-attestation" className="leading-6">
                          I confirm this version was reviewed for this tenant and is ready for a separate authorized activation decision.
                        </Label>
                      </div>
                      <Button
                        type="submit"
                        disabled={reviewMutation.isPending}
                        className="min-h-11"
                      >
                        <BookOpenCheck aria-hidden="true" />
                        {reviewMutation.isPending ? "Recording review…" : "Record legal review"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card className="border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-950 dark:text-amber-100">
                    <ShieldCheck aria-hidden="true" />
                    Activation decision
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-amber-950 dark:text-amber-100">
                  <p className="text-sm leading-6">
                    Activation retires the previous active policy and makes this
                    immutable version the compliance snapshot for new workforce calculations.
                  </p>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="font-bold">Reviewer</dt>
                      <dd>{selected.legal_reviewer_name ?? "Not reviewed"}</dd>
                    </div>
                    <div>
                      <dt className="font-bold">Review recorded</dt>
                      <dd><PolicyDate value={selected.legal_reviewed_at} /></dd>
                    </div>
                    <div>
                      <dt className="font-bold">Retention</dt>
                      <dd>{selected.rules.record_retention.years ? `${selected.rules.record_retention.years} years` : "Not determined"}</dd>
                    </div>
                  </dl>
                  {canActivate && !selected.is_active && (
                    <Button
                      type="button"
                      onClick={() => {
                        setError("");
                        activateMutation.mutate();
                      }}
                      disabled={!validation?.can_activate || activateMutation.isPending}
                      className="mt-5 min-h-11 bg-amber-800 text-white hover:bg-amber-900 focus-visible:ring-amber-950 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100 dark:focus-visible:ring-white"
                    >
                      <ShieldCheck aria-hidden="true" />
                      {activateMutation.isPending ? "Activating policy…" : "Activate reviewed policy"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : (
        <Card className="border-dashed border-slate-600 dark:border-slate-300">
          <CardContent className="p-8 text-center">
            <Scale aria-hidden="true" className="mx-auto size-9 text-slate-700 dark:text-slate-300" />
            <h3 className="mt-3 text-xl font-black">No tenant policy version yet</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-700 dark:text-slate-300">
              The source preset is available but inactive. Create a draft to begin
              tenant HR/legal review; nothing is activated automatically.
            </p>
            <p className="mt-3 text-xs font-mono text-slate-700 dark:text-slate-300">
              Preset {preset?.preset_revision}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-500 dark:border-slate-400">
        <CardHeader>
          <CardTitle>Policy version history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <caption className="pb-3 text-left text-sm text-slate-700 dark:text-slate-300">
              Tenant compliance versions ordered by effective date and creation order.
            </caption>
            <thead className="bg-slate-100 dark:bg-slate-900">
              <tr>
                {["Version", "Status", "Effective", "Reviewer", "Activated", "Action"].map((heading) => (
                  <th key={heading} scope="col" className="border-b border-slate-500 px-3 py-3 font-black dark:border-slate-400">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versions.length ? versions.map((version) => (
                <tr key={version.id} className="border-b border-slate-400 dark:border-slate-500">
                  <th scope="row" className="px-3 py-3 font-mono text-xs">{version.policy_version}</th>
                  <td className="px-3 py-3">{statusStyles[version.status].label}</td>
                  <td className="px-3 py-3"><PolicyDate value={version.effective_from} /></td>
                  <td className="px-3 py-3">{version.legal_reviewer_name ?? "Not reviewed"}</td>
                  <td className="px-3 py-3"><PolicyDate value={version.activated_at} /></td>
                  <td className="px-3 py-3">
                    <Button type="button" variant="outline" onClick={() => setSelectedId(version.id)} className="min-h-11 border-slate-500 dark:border-slate-400">
                      Inspect version
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-700 dark:text-slate-300">
                    No policy versions have been created.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {canAudit && (
        <Card className="border-slate-500 dark:border-slate-400">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" />
              Production-readiness evidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {readinessQuery.isLoading ? (
              <p role="status">Running tenant-scoped readiness checks…</p>
            ) : readinessQuery.isError ? (
              <p role="alert" className="text-red-800 dark:text-red-200">
                Readiness checks could not be loaded. {readinessQuery.error.message}
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Overall status: <strong>{humanize(readiness?.status ?? "attention")}</strong>.
                  Generated <PolicyDate value={readiness?.generated_at} />.
                </p>
                <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                  {(readiness?.checks ?? []).map((check) => (
                    <li key={check.key} className="rounded-xl border border-slate-500 p-4 dark:border-slate-400">
                      <div className="flex items-center gap-2 font-black">
                        {check.status === "ready" ? (
                          <BadgeCheck aria-hidden="true" className="size-5 text-emerald-700 dark:text-emerald-300" />
                        ) : (
                          <AlertTriangle aria-hidden="true" className="size-5 text-amber-800 dark:text-amber-200" />
                        )}
                        {humanize(check.key)} · {humanize(check.status)}
                      </div>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                        {check.summary}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <p className="rounded-xl border border-slate-500 bg-slate-100 p-4 text-sm text-slate-800 dark:border-slate-400 dark:bg-slate-900 dark:text-slate-200">
        <strong>Important:</strong> {workspaceQuery.data?.data.disclaimer}
      </p>
    </div>
  );
}
