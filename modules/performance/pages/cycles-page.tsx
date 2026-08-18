"use client";

import { useState, type FormEvent } from "react";
import { Play, Plus, SlidersHorizontal } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { performanceApi } from "@/modules/performance/api";
import type { ReviewCycle } from "@/modules/performance/types";
import { BusyLabel, PerformanceError, PerformanceLoading, PerformanceShell, PerformanceStatus, PerformanceTable } from "@/modules/performance/pages/components/performance-shell";

export default function PerformanceCyclesPage() {
  const [creating, setCreating] = useState(false);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["performance", "cycles"], queryFn: () => performanceApi.cycles({ per_page: 100 }) });
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["performance"] }); };
  const create = useMutation({ mutationFn: performanceApi.createCycle, onSuccess: async () => { await refresh(); setCreating(false); toast.success("Review cycle created."); }, onError: () => toast.error("Review cycle could not be created.") });
  const action = useMutation({ mutationFn: ({ id, action }: { id: number; action: "activate" | "open-calibration" | "complete" | "cancel" }) => performanceApi.cycleAction(id, action), onSuccess: async () => { await refresh(); toast.success("Review cycle updated."); }, onError: () => toast.error("Review cycle action could not be completed.") });
  return <PerformanceShell title="Review cycles" description="Design fair review periods, balance outcomes and behaviors, create employee reviews, calibrate results, and lock completed cycles." actions={<Button type="button" aria-expanded={creating} aria-controls="new-performance-cycle" onClick={() => setCreating((value) => !value)}><Plus aria-hidden="true" data-icon="inline-start" />{creating ? "Close cycle form" : "New review cycle"}</Button>}>
    {creating ? <CycleForm id="new-performance-cycle" busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} /> : null}
    <Card><CardHeader><CardTitle>Cycle register</CardTitle><CardDescription>Activating a cycle creates or retains one review for every selected active employee and assigns the current reporting manager.</CardDescription></CardHeader><CardContent>{query.isLoading ? <PerformanceLoading cards={2} /> : query.error || !query.data ? <PerformanceError error={query.error} /> : <PerformanceTable<ReviewCycle> caption="Performance review cycles, newest period first." rows={query.data.data} getKey={(row) => row.id} columns={[
      { key: "cycle", label: "Cycle", render: (row) => <div><span className="font-medium">{row.name}</span><p className="text-xs text-muted-foreground">{row.code} · {row.cycle_type}</p></div> },
      { key: "period", label: "Period", render: (row) => `${row.period_start} – ${row.period_end}` },
      { key: "weights", label: "Weighting", render: (row) => `${Number(row.goal_weight)}% goals · ${Number(row.competency_weight)}% competencies` },
      { key: "reviews", label: "Completion", align: "right", render: (row) => `${row.completed_reviews_count ?? 0}/${row.reviews_count ?? 0}` },
      { key: "status", label: "Status", render: (row) => <PerformanceStatus value={row.status} /> },
      { key: "action", label: "Next action", align: "right", render: (row) => <CycleActions cycle={row} busy={action.isPending} onAction={(next) => action.mutate({ id: row.id, action: next })} /> },
    ]} />}</CardContent></Card>
  </PerformanceShell>;
}

function CycleForm({ id, busy, onSubmit }: { id: string; busy: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  const year = new Date().getFullYear();
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); onSubmit({ code: values.get("code"), name: values.get("name"), description: values.get("description") || null, cycle_type: values.get("cycle_type"), period_start: values.get("period_start"), period_end: values.get("period_end"), self_review_due_on: values.get("self_review_due_on") || null, manager_review_due_on: values.get("manager_review_due_on") || null, calibration_due_on: values.get("calibration_due_on") || null, goal_weight: Number(values.get("goal_weight")), competency_weight: Number(values.get("competency_weight")), settings: { requires_calibration: values.get("requires_calibration") === "1" } }); }
  return <Card id={id}><CardHeader><CardTitle><h2>Create review cycle</h2></CardTitle><CardDescription>Required fields are identified in each label. Goal and competency weights must total 100%.</CardDescription></CardHeader><CardContent><form className="grid gap-5" onSubmit={submit}><div className="grid gap-4 md:grid-cols-3"><FormField label="Cycle code (required)" id="cycle-code"><Input id="cycle-code" name="code" required maxLength={80} placeholder={`FY${String(year).slice(-2)}`} /></FormField><FormField label="Cycle name (required)" id="cycle-name"><Input id="cycle-name" name="name" required maxLength={180} placeholder={`Annual performance ${year}`} /></FormField><FormField label="Cycle type (required)" id="cycle-type"><NativeSelect id="cycle-type" name="cycle_type" required defaultValue="annual" className="w-full"><NativeSelectOption value="probation">Probation</NativeSelectOption><NativeSelectOption value="quarterly">Quarterly</NativeSelectOption><NativeSelectOption value="biannual">Biannual</NativeSelectOption><NativeSelectOption value="annual">Annual</NativeSelectOption><NativeSelectOption value="project">Project</NativeSelectOption></NativeSelect></FormField></div><div className="grid gap-4 md:grid-cols-3"><DateField id="cycle-start" name="period_start" label="Period starts (required)" /><DateField id="cycle-end" name="period_end" label="Period ends (required)" /><FormField label="Calibration required" id="cycle-calibration"><NativeSelect id="cycle-calibration" name="requires_calibration" defaultValue="1" className="w-full"><NativeSelectOption value="1">Yes</NativeSelectOption><NativeSelectOption value="0">No</NativeSelectOption></NativeSelect></FormField></div><div className="grid gap-4 md:grid-cols-3"><DateField id="cycle-self-due" name="self_review_due_on" label="Self-review due" required={false} /><DateField id="cycle-manager-due" name="manager_review_due_on" label="Manager review due" required={false} /><DateField id="cycle-calibration-due" name="calibration_due_on" label="Calibration due" required={false} /></div><div className="grid gap-4 md:grid-cols-2"><FormField label="Goal weight percent (required)" id="cycle-goal-weight"><Input id="cycle-goal-weight" name="goal_weight" type="number" min="0" max="100" step="0.1" defaultValue="60" required /></FormField><FormField label="Competency weight percent (required)" id="cycle-competency-weight"><Input id="cycle-competency-weight" name="competency_weight" type="number" min="0" max="100" step="0.1" defaultValue="40" required /></FormField></div><Button type="submit" className="w-fit" disabled={busy}><BusyLabel busy={busy}>Create review cycle</BusyLabel></Button></form></CardContent></Card>;
}

function CycleActions({ cycle, busy, onAction }: { cycle: ReviewCycle; busy: boolean; onAction: (action: "activate" | "open-calibration" | "complete" | "cancel") => void }) { if (["completed", "cancelled"].includes(cycle.status)) return <span className="text-sm text-muted-foreground">Locked</span>; const next = cycle.status === "draft" ? "activate" : cycle.status === "active" ? "open-calibration" : "complete"; return <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAction(next)}>{next === "activate" ? <Play aria-hidden="true" data-icon="inline-start" /> : <SlidersHorizontal aria-hidden="true" data-icon="inline-start" />}{next.replace("-", " ")}</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onAction("cancel")}>Cancel</Button></div>; }
function FormField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function DateField({ id, name, label, required = true }: { id: string; name: string; label: string; required?: boolean }) { return <FormField id={id} label={label}><Input id={id} name={name} type="date" required={required} /></FormField>; }

