"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { talentApi } from "@/modules/humanresources/talent/api";
import type {
  CompetencyGap,
  PipelineRole,
  SuccessionPipeline,
} from "@/modules/humanresources/talent/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { SeverityBands } from "@/modules/shared/charts/charts";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const READINESS_SEVERITY: Record<string, string> = {
  ready_now: "good",
  ready_1_2_years: "caution",
  ready_3_5_years: "warning",
  not_ready: "critical",
};

const READINESS_OPTIONS = [
  "ready_now",
  "ready_1_2_years",
  "ready_3_5_years",
  "not_ready",
] as const;

const LEVELS = ["low", "medium", "high"] as const;

type RoleForm = {
  position_id: string;
  incumbent_employee_id: string;
  criticality: string;
  vacancy_risk: string;
  target_successor_count: string;
  impact_notes: string;
  is_active: boolean;
};

const DEFAULT_ROLE: RoleForm = {
  position_id: "",
  incumbent_employee_id: "",
  criticality: "high",
  vacancy_risk: "medium",
  target_successor_count: "2",
  impact_notes: "",
  is_active: true,
};

type CandidateForm = {
  critical_role_id: string;
  employee_id: string;
  readiness: string;
  assessment_score: string;
  assessment_notes: string;
};

export default function SuccessionPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [roleOpen, setRoleOpen] = React.useState(false);
  const [roleForm, setRoleForm] = React.useState<RoleForm>(DEFAULT_ROLE);
  const [candidateOpen, setCandidateOpen] = React.useState(false);
  const [candidateForm, setCandidateForm] = React.useState<CandidateForm>({
    critical_role_id: "",
    employee_id: "",
    readiness: "ready_3_5_years",
    assessment_score: "",
    assessment_notes: "",
  });

  // Gap analyser — a deliberate on-demand lookup rather than a live query, so
  // an empty pair of inputs does not fire a request on every keystroke.
  const [gapEmployee, setGapEmployee] = React.useState("");
  const [gapPosition, setGapPosition] = React.useState("");
  const [gapPair, setGapPair] = React.useState<{ employee: number; position: number } | null>(null);

  const pipelineQuery = useQuery({
    queryKey: ["hr-talent", "succession", "pipeline"],
    queryFn: () => talentApi.pipeline().then((res) => res.data),
  });

  const gapQuery = useQuery({
    queryKey: ["hr-talent", "succession", "gap", gapPair],
    queryFn: () => talentApi.gap(gapPair!.employee, gapPair!.position).then((res) => res.data),
    enabled: gapPair !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["hr-talent"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveRole = useMutation({
    mutationFn: () =>
      talentApi.createCriticalRole({
        position_id: Number(roleForm.position_id),
        incumbent_employee_id: roleForm.incumbent_employee_id
          ? Number(roleForm.incumbent_employee_id)
          : null,
        criticality: roleForm.criticality,
        vacancy_risk: roleForm.vacancy_risk,
        target_successor_count: Number(roleForm.target_successor_count || 1),
        impact_notes: roleForm.impact_notes || null,
        is_active: roleForm.is_active,
      }),
    onSuccess: () => {
      toast.success(t("hr_talent.succession.role_saved", "Critical role saved."));
      invalidate();
      setRoleOpen(false);
      setRoleForm(DEFAULT_ROLE);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.succession.role_failed", "Could not save the role."))),
  });

  const saveCandidate = useMutation({
    mutationFn: () =>
      talentApi.createCandidate({
        critical_role_id: Number(candidateForm.critical_role_id),
        employee_id: Number(candidateForm.employee_id),
        readiness: candidateForm.readiness,
        assessment_score: candidateForm.assessment_score
          ? Number(candidateForm.assessment_score)
          : null,
        assessment_notes: candidateForm.assessment_notes || null,
        reviewed_on: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => {
      toast.success(t("hr_talent.succession.candidate_saved", "Successor nominated."));
      invalidate();
      setCandidateOpen(false);
    },
    onError: (error: any) =>
      toast.error(
        errorText(error, t("hr_talent.succession.candidate_failed", "Could not nominate that successor.")),
      ),
  });

  const pipeline: SuccessionPipeline | undefined = pipelineQuery.data?.data;
  const gap: CompetencyGap | undefined = gapQuery.data?.data;
  const roles: PipelineRole[] = pipeline?.roles ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("hr_talent.succession.title", "Succession Planning")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "hr_talent.succession.subtitle",
              "The roles the business cannot afford to leave empty, and who is actually ready to fill them.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={() => setCandidateOpen(true)}>
            {t("hr_talent.succession.nominate", "Nominate Successor")}
          </Button>
          <Button
            className="rounded-full px-5"
            onClick={() => {
              setRoleForm(DEFAULT_ROLE);
              setRoleOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("hr_talent.succession.flag_role", "Flag Critical Role")}
          </Button>
        </div>
      </div>

      {pipelineQuery.isLoading ? (
        <LoadingPanel label={t("hr_talent.succession.loading", "Loading the succession pipeline...")} />
      ) : !pipeline ? (
        <EmptyPanel label={t("hr_talent.succession.unavailable", "The pipeline is not available right now.")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("hr_talent.succession.critical_roles", "Critical roles")}
              value={n(pipeline.critical_roles).toLocaleString()}
            />
            <StatTile
              label={t("hr_talent.succession.no_successor", "No successor named")}
              value={n(pipeline.roles_without_successor).toLocaleString()}
              alert={n(pipeline.roles_without_successor) > 0}
            />
            <StatTile
              label={t("hr_talent.succession.at_risk", "High risk, uncovered")}
              value={n(pipeline.roles_at_risk).toLocaleString()}
              meta={t("hr_talent.succession.at_risk_meta", "High criticality and high vacancy risk")}
              alert={n(pipeline.roles_at_risk) > 0}
            />
            <StatTile
              label={t("hr_talent.succession.bench", "Average bench strength")}
              value={`${n(pipeline.average_bench_strength).toFixed(0)}%`}
              meta={t(
                "hr_talent.succession.bench_meta",
                "Share of each target bench filled by candidates ready within two years",
              )}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Panel
              title={t("hr_talent.succession.roles", "Critical roles")}
              description={t(
                "hr_talent.succession.roles_desc",
                "Ordered by exposure: the roles at risk with the thinnest bench come first.",
              )}
            >
              {roles.length === 0 ? (
                <EmptyPanel label={t("hr_talent.succession.no_roles", "No critical roles flagged yet.")} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 font-semibold">{t("hr_talent.common.position", "Position")}</th>
                        <th className="pb-2 font-semibold">{t("hr_talent.succession.incumbent", "Incumbent")}</th>
                        <th className="pb-2 font-semibold">{t("hr_talent.succession.risk", "Risk")}</th>
                        <th className="pb-2 text-right font-semibold">
                          {t("hr_talent.succession.candidates", "Named")}
                        </th>
                        <th className="pb-2 text-right font-semibold">
                          {t("hr_talent.succession.ready_now", "Ready now")}
                        </th>
                        <th className="pb-2 text-right font-semibold">
                          {t("hr_talent.succession.bench_short", "Bench")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((role) => (
                        <tr
                          key={role.critical_role_id}
                          className="border-b border-border/40 last:border-0"
                        >
                          <td className="py-2">
                            <span className="font-medium">{role.position ?? `#${role.position_id}`}</span>
                            {role.at_risk ? (
                              <Badge variant="destructive" className="ml-2 text-[10px]">
                                {t("hr_talent.succession.at_risk_badge", "At risk")}
                              </Badge>
                            ) : null}
                          </td>
                          <td className="py-2 text-muted-foreground">{role.incumbent ?? "—"}</td>
                          <td className="py-2">
                            <span className="text-xs capitalize">
                              {role.criticality} / {role.vacancy_risk}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {n(role.candidates)} / {n(role.target_successor_count)}
                          </td>
                          <td className="py-2 text-right tabular-nums">{n(role.ready_now)}</td>
                          <td className="py-2 text-right tabular-nums">
                            {n(role.bench_strength).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <SeverityBands
              title={t("hr_talent.succession.readiness_mix", "Successor readiness")}
              description={t(
                "hr_talent.succession.readiness_desc",
                "Every nominated candidate, by how soon they could take over.",
              )}
              bands={(pipeline.readiness_mix ?? []).map((band) => ({
                key: band.readiness,
                label: band.label,
                severity: READINESS_SEVERITY[band.readiness] ?? "caution",
                count: n(band.count),
              }))}
              emptyLabel={t("hr_talent.succession.no_candidates", "No successors nominated yet.")}
            />
          </div>
        </>
      )}

      {/* Gap analyser */}
      <Panel
        title={t("hr_talent.succession.gap_title", "Readiness check")}
        description={t(
          "hr_talent.succession.gap_desc",
          "Measure a person against a role's competency profile. Readiness is computed from the gap, not typed in.",
        )}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gap-employee">{t("hr_talent.common.employee_id", "Employee ID")}</Label>
            <Input
              id="gap-employee"
              type="number"
              value={gapEmployee}
              onChange={(event) => setGapEmployee(event.target.value)}
              className="h-9 w-36"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gap-position">{t("hr_talent.common.position_id", "Position ID")}</Label>
            <Input
              id="gap-position"
              type="number"
              value={gapPosition}
              onChange={(event) => setGapPosition(event.target.value)}
              className="h-9 w-36"
            />
          </div>
          <Button
            variant="outline"
            className="h-9"
            disabled={!gapEmployee || !gapPosition}
            onClick={() =>
              setGapPair({ employee: Number(gapEmployee), position: Number(gapPosition) })
            }
          >
            <Search className="mr-2 h-4 w-4" />
            {t("hr_talent.succession.measure", "Measure")}
          </Button>
        </div>

        {gapQuery.isLoading ? (
          <div className="mt-4">
            <LoadingPanel label={t("hr_talent.succession.measuring", "Measuring the gap...")} />
          </div>
        ) : gap ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("hr_talent.succession.suggested", "Measured readiness")}
                </p>
                <p className="text-3xl font-black capitalize tracking-tight">
                  {gap.suggested_readiness.replace(/_/g, " ")}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {t("hr_talent.succession.gap_meta", "{met} of {total} requirements met · {critical} critical gap(s)")
                  .replace("{met}", String(n(gap.met)))
                  .replace("{total}", String(n(gap.requirements)))
                  .replace("{critical}", String(n(gap.critical_gaps)))}
              </div>
            </div>

            {gap.note ? (
              <p className="rounded-xl border border-dashed border-border/60 p-3 text-sm italic text-muted-foreground">
                {gap.note}
              </p>
            ) : gap.gaps.length === 0 ? (
              <EmptyPanel
                label={t("hr_talent.succession.no_gaps", "Every requirement for this role is met.")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-semibold">
                        {t("hr_talent.competencies.competency", "Competency")}
                      </th>
                      <th className="pb-2 text-right font-semibold">
                        {t("hr_talent.succession.current", "Current")}
                      </th>
                      <th className="pb-2 text-right font-semibold">
                        {t("hr_talent.competencies.required_level", "Required")}
                      </th>
                      <th className="pb-2 text-right font-semibold">
                        {t("hr_talent.succession.shortfall", "Shortfall")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gap.gaps.map((row) => (
                      <tr key={row.competency_id} className="border-b border-border/40 last:border-0">
                        <td className="py-2">
                          {row.competency ?? `#${row.competency_id}`}
                          {row.is_critical ? (
                            <Badge variant="destructive" className="ml-2 text-[10px]">
                              {t("hr_talent.competencies.critical", "Critical")}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="py-2 text-right tabular-nums">{row.current_level}</td>
                        <td className="py-2 text-right tabular-nums">{row.required_level}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">{row.shortfall}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Panel>

      {/* Critical role */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("hr_talent.succession.flag_role", "Flag Critical Role")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.succession.role_desc",
                  "Flagging a position that already exists updates it rather than creating a duplicate.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-position">{t("hr_talent.common.position_id", "Position ID")}</Label>
              <Input
                id="role-position"
                type="number"
                value={roleForm.position_id}
                onChange={(event) => setRoleForm({ ...roleForm, position_id: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-incumbent">
                {t("hr_talent.succession.incumbent_id", "Incumbent employee ID")}
              </Label>
              <Input
                id="role-incumbent"
                type="number"
                value={roleForm.incumbent_employee_id}
                onChange={(event) =>
                  setRoleForm({ ...roleForm, incumbent_employee_id: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-criticality">{t("hr_talent.succession.criticality", "Criticality")}</Label>
              <select
                id="role-criticality"
                value={roleForm.criticality}
                onChange={(event) => setRoleForm({ ...roleForm, criticality: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-risk">{t("hr_talent.succession.vacancy_risk", "Vacancy risk")}</Label>
              <select
                id="role-risk"
                value={roleForm.vacancy_risk}
                onChange={(event) => setRoleForm({ ...roleForm, vacancy_risk: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-target">
                {t("hr_talent.succession.target_successors", "Target successors")}
              </Label>
              <Input
                id="role-target"
                type="number"
                min={1}
                max={20}
                value={roleForm.target_successor_count}
                onChange={(event) =>
                  setRoleForm({ ...roleForm, target_successor_count: event.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="role-active"
                checked={roleForm.is_active}
                onCheckedChange={(checked) => setRoleForm({ ...roleForm, is_active: checked })}
              />
              <Label htmlFor="role-active">{t("hr_talent.common.active", "Active")}</Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="role-notes">{t("hr_talent.succession.impact", "Impact if vacant")}</Label>
              <Textarea
                id="role-notes"
                rows={3}
                value={roleForm.impact_notes}
                onChange={(event) => setRoleForm({ ...roleForm, impact_notes: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRoleOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => saveRole.mutate()} disabled={saveRole.isPending || !roleForm.position_id}>
              {t("hr_talent.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Candidate */}
      <Dialog open={candidateOpen} onOpenChange={setCandidateOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("hr_talent.succession.nominate", "Nominate Successor")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.succession.candidate_desc",
                  "Use the readiness check above first — the measured gap is a better answer than a guess.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cand-role">{t("hr_talent.succession.role", "Critical role")}</Label>
              <select
                id="cand-role"
                value={candidateForm.critical_role_id}
                onChange={(event) =>
                  setCandidateForm({ ...candidateForm, critical_role_id: event.target.value })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("hr_talent.common.select", "Select...")}</option>
                {roles.map((role) => (
                  <option key={role.critical_role_id} value={role.critical_role_id}>
                    {role.position ?? `#${role.position_id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cand-employee">{t("hr_talent.common.employee_id", "Employee ID")}</Label>
              <Input
                id="cand-employee"
                type="number"
                value={candidateForm.employee_id}
                onChange={(event) =>
                  setCandidateForm({ ...candidateForm, employee_id: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cand-readiness">{t("hr_talent.succession.readiness", "Readiness")}</Label>
              <select
                id="cand-readiness"
                value={candidateForm.readiness}
                onChange={(event) =>
                  setCandidateForm({ ...candidateForm, readiness: event.target.value })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {READINESS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cand-score">{t("hr_talent.succession.score", "Assessment score")}</Label>
              <Input
                id="cand-score"
                type="number"
                min={0}
                max={100}
                value={candidateForm.assessment_score}
                onChange={(event) =>
                  setCandidateForm({ ...candidateForm, assessment_score: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cand-notes">{t("hr_talent.common.notes", "Notes")}</Label>
              <Textarea
                id="cand-notes"
                rows={3}
                value={candidateForm.assessment_notes}
                onChange={(event) =>
                  setCandidateForm({ ...candidateForm, assessment_notes: event.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCandidateOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveCandidate.mutate()}
              disabled={
                saveCandidate.isPending || !candidateForm.critical_role_id || !candidateForm.employee_id
              }
            >
              {t("hr_talent.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
