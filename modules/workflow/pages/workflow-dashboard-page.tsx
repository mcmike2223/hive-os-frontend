"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Inbox, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createWorkflowDefinition,
  fetchApprovalRoles,
  fetchWorkflowDashboard,
  fetchWorkflowDefinitions,
  fetchWorkflowTargets,
  type WorkflowDashboardData,
  type WorkflowTarget,
} from "../api";
import { fetchUsers } from "@/modules/identity/api";

type Option = { id: number; name?: string; full_name?: string; title?: string };
type Definition = { id: number; name: string; model_type: string; trigger_event: string; is_active?: boolean };

export function WorkflowDashboardPage() {
  const [targets, setTargets] = useState<WorkflowTarget[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [dashboard, setDashboard] = useState<WorkflowDashboardData | null>(null);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [event, setEvent] = useState("");
  const [name, setName] = useState("");
  const [approver, setApprover] = useState("role:");
  const [required, setRequired] = useState(1);
  const [signature, setSignature] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchWorkflowTargets(), fetchApprovalRoles({ per_page: 100 }), fetchUsers({ per_page: 100 }), fetchWorkflowDefinitions(), fetchWorkflowDashboard()])
      .then(([targetData, roleData, userData, definitionData, dashboardData]) => {
        setTargets(targetData || []);
        setRoles(((roleData as { data?: Option[] })?.data || []) as Option[]);
        setUsers(((userData as { data?: Option[] })?.data || []) as Option[]);
        setDefinitions((definitionData || []) as Definition[]);
        setDashboard(dashboardData);
      })
      .catch(() => setError("Workflow options could not be loaded. Check your connection and try again."))
      .finally(() => setBusy(false));
  }, []);

  const target = useMemo(() => targets.find((item) => item.value === selectedTarget), [targets, selectedTarget]);
  const groupedTargets = useMemo(() => targets.reduce<Record<string, WorkflowTarget[]>>((groups, item) => {
    const key = item.module_slug || item.label.split(" → ")[0] || "ERP";
    (groups[key] ||= []).push(item);
    return groups;
  }, {}), [targets]);

  function chooseTarget(value: string) {
    const next = targets.find((item) => item.value === value);
    setSelectedTarget(value);
    setEvent(next?.events[0] || "");
    setName(next ? `${next.label} approval` : "");
  }

  async function submit(eventObject: FormEvent) {
    eventObject.preventDefault(); setError(""); setMessage("");
    if (!target || !event || !name.trim() || approver === "role:" || (required < 1)) {
      setError("Choose a module action, name, approver, and approval count before activating."); return;
    }
    const [kind, rawId] = approver.split(":");
    setSaving(true);
    try {
      await createWorkflowDefinition({ name: name.trim(), model_type: target.model_type, trigger_event: event, required_approvals: required, approval_role_ids: kind === "role" ? [Number(rawId)] : [], approver_ids: kind === "user" ? [Number(rawId)] : [], signature_required: signature, prevent_duplicate_pending: true, is_active: true });
      setMessage("Workflow activated. New matching requests will now follow it.");
      setDefinitions((current) => [{ id: Date.now(), name: name.trim(), model_type: target.model_type, trigger_event: event, is_active: true }, ...current]);
    } catch { setError("This workflow could not be activated. Please try again."); } finally { setSaving(false); }
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Operations control</p><h1 className="text-3xl font-semibold tracking-tight">Workflow Center</h1><p className="mt-2 max-w-2xl text-muted-foreground">Create one clear approval path for any ERP module, then review requests from the same place.</p></div>
      <Link href="/dashboard/workflow/approvals"><Button variant="outline"><Inbox className="mr-2 h-4 w-4" />Review requests{dashboard?.totals.pending ? ` (${dashboard.totals.pending})` : ""}</Button></Link>
    </header>
    <div aria-label="Workflow setup steps" className="grid gap-2 sm:grid-cols-3">{["Choose what needs approval", "Choose who approves", "Review and activate"].map((step, index) => <div key={step} className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">{index + 1}</span><span className="font-medium">{step}</span>{index < 2 && <ChevronRight className="ml-auto hidden h-4 w-4 text-muted-foreground sm:block" />}</div>)}</div>
    <Card><CardHeader><CardTitle>Set up an approval path</CardTitle><CardDescription>Everything is on this page. The module list comes from the ERP workflow registry.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-6">
      <fieldset className="grid gap-4 md:grid-cols-2"><legend className="mb-3 text-sm font-semibold">1. What should start approval?</legend><div><label htmlFor="workflow-target" className="text-sm font-medium">ERP module and record</label><select id="workflow-target" value={selectedTarget} onChange={(e) => chooseTarget(e.target.value)} disabled={busy} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select a module...</option>{Object.entries(groupedTargets).map(([group, items]) => <optgroup key={group} label={group}>{items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}</select></div><div><label htmlFor="workflow-event" className="text-sm font-medium">When should it run?</label><select id="workflow-event" value={event} onChange={(e) => setEvent(e.target.value)} disabled={!target} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select an action...</option>{target?.events.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></div></fieldset>
      <fieldset className="grid gap-4 md:grid-cols-2"><legend className="mb-3 text-sm font-semibold">2. Who should approve?</legend><div><label htmlFor="workflow-approver" className="text-sm font-medium">Approver</label><select id="workflow-approver" value={approver} onChange={(e) => setApprover(e.target.value)} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="role:">Select a role or person...</option>{roles.map((item) => <option key={`role-${item.id}`} value={`role:${item.id}`}>Role · {item.name || item.title || `#${item.id}`}</option>)}{users.map((item) => <option key={`user-${item.id}`} value={`user:${item.id}`}>Person · {item.full_name || item.name || item.title || `#${item.id}`}</option>)}</select></div><div><label htmlFor="workflow-count" className="text-sm font-medium">Approvals required</label><select id="workflow-count" value={required} onChange={(e) => setRequired(Number(e.target.value))} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm">{[1,2,3,4,5].map((count) => <option key={count} value={count}>{count} {count === 1 ? "approval" : "approvals"}</option>)}</select></div></fieldset>
      <fieldset className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end"><legend className="mb-3 text-sm font-semibold">3. Name and activate</legend><div><label htmlFor="workflow-name" className="text-sm font-medium">Workflow name</label><input id="workflow-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Purchase order review" className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm" /></div><label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><input type="checkbox" checked={signature} onChange={(e) => setSignature(e.target.checked)} /> Require signed approval</label></fieldset>
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}{message && <p role="status" className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</p>}<Button type="submit" disabled={saving || busy || !targets.length}><Workflow className="mr-2 h-4 w-4" />{saving ? "Activating..." : "Activate workflow"}</Button>
    </form></CardContent></Card>
    <section aria-labelledby="active-workflows"><div className="mb-3 flex items-center justify-between"><h2 id="active-workflows" className="text-xl font-semibold">Active workflows</h2><span className="text-sm text-muted-foreground">{definitions.length} configured</span></div>{definitions.length ? <div className="grid gap-3 md:grid-cols-2">{definitions.slice(0, 6).map((item) => <Card key={item.id}><CardContent className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.trigger_event.replaceAll("_", " ")}</p></div><span className="text-xs font-medium text-emerald-700">{item.is_active === false ? "Paused" : "Active"}</span></CardContent></Card>)}</div> : <Card><CardContent className="p-6 text-sm text-muted-foreground">No workflows yet. Use the form above to create your first approval path.</CardContent></Card>}</section>
  </main>;
}

export default WorkflowDashboardPage;
