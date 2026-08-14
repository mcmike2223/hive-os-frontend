"use client";

import { useState, type FormEvent } from "react";
import { Archive, Check, LockKeyhole, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import type { FinanceAccount, FinanceBudget } from "@/modules/finance/types";
import { BusyLabel, FinanceError, FinanceLoading, FinanceShell, FinanceStatus, FinanceTable, Money } from "@/modules/finance/pages/components/finance-shell";

export default function FinanceBudgetsPage() {
  const [open, setOpen] = useState(false); const client = useQueryClient(); const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "manage_budgets"]); const canApprove = hasAnyPermission(["manage_finance", "approve_budgets"]);
  const query = useQuery({ queryKey: ["finance", "budgets"], queryFn: () => financeApi.budgets({ per_page: 100 }) });
  const accounts = useQuery({ queryKey: ["finance", "budget-accounts"], queryFn: () => financeApi.accounts({ active: true, per_page: 200 }) });
  const create = useMutation({ mutationFn: financeApi.createBudget, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance", "budgets"] }); setOpen(false); toast.success("Budget created."); }, onError: () => toast.error("Budget could not be created.") });
  const action = useMutation({ mutationFn: ({ budget, action }: { budget: FinanceBudget; action: "approve" | "lock" | "archive" }) => financeApi.budgetAction(budget.id, action), onSuccess: async (_, variables) => { await client.invalidateQueries({ queryKey: ["finance", "budgets"] }); toast.success(`Budget ${variables.action}d.`); }, onError: () => toast.error("Budget action could not be completed.") });
  return <FinanceShell title="Budgets and variance" description="Set period and departmental budgets against ledger accounts, approve a baseline, lock it, and compare actual financial activity with plan." actions={canManage ? <BudgetDialog open={open} onOpenChange={setOpen} accounts={accounts.data?.data ?? []} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} /> : undefined}>
    <Card><CardHeader><CardTitle>Budget register</CardTitle></CardHeader><CardContent>{query.isLoading ? <FinanceLoading cards={2} /> : query.error || !query.data ? <FinanceError error={query.error} /> : <FinanceTable<FinanceBudget> caption="Approved, locked, archived, and draft budgets." rows={query.data.data} getKey={(row) => row.id} columns={[
      { key: "name", label: "Budget", render: (row) => <div className="flex flex-col gap-1"><span className="font-medium">{row.name}</span><span className="text-xs text-muted-foreground">{row.department || "All departments"}</span></div> },
      { key: "period", label: "Period", render: (row) => `${row.starts_on} – ${row.ends_on}` },
      { key: "lines", label: "Lines", align: "right", render: (row) => row.lines.length },
      { key: "total", label: "Budget", align: "right", render: (row) => <Money value={row.total_amount} currency={row.currency} /> },
      { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
      { key: "action", label: "Action", align: "right", render: (row) => <div className="flex justify-end gap-1">{row.status === "draft" && canApprove ? <Button size="sm" onClick={() => action.mutate({ budget: row, action: "approve" })}><Check data-icon="inline-start" aria-hidden="true" />Approve</Button> : null}{row.status === "approved" && canApprove ? <Button size="sm" onClick={() => action.mutate({ budget: row, action: "lock" })}><LockKeyhole data-icon="inline-start" aria-hidden="true" />Lock</Button> : null}{["approved", "locked"].includes(row.status) && canApprove ? <Button size="icon-sm" variant="ghost" aria-label={`Archive ${row.name}`} onClick={() => action.mutate({ budget: row, action: "archive" })}><Archive aria-hidden="true" /></Button> : null}</div> },
    ]} />}</CardContent></Card>
  </FinanceShell>;
}

function BudgetDialog({ open, onOpenChange, accounts, busy, onSubmit }: { open: boolean; onOpenChange: (value: boolean) => void; accounts: FinanceAccount[]; busy: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  const [lineIds, setLineIds] = useState([0]);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); onSubmit({ name: values.get("name"), starts_on: values.get("starts_on"), ends_on: values.get("ends_on"), department: values.get("department") || null, cost_center: values.get("cost_center") || null, currency: values.get("currency") || "ETB", lines: lineIds.map((id) => ({ account_id: Number(values.get(`account_${id}`)), amount: Number(values.get(`amount_${id}`)), notes: values.get(`notes_${id}`) || null })) }); }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogTrigger asChild><Button><Plus data-icon="inline-start" aria-hidden="true" />New budget</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><form onSubmit={submit} className="flex flex-col gap-5"><DialogHeader><DialogTitle>Create budget</DialogTitle><DialogDescription>Set the approved amount for each account during one fiscal range. Required fields are marked.</DialogDescription></DialogHeader><FieldGroup>
    <Field><FieldLabel htmlFor="budget-name">Budget name (required)</FieldLabel><Input id="budget-name" name="name" required autoFocus /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="budget-start">Start date (required)</FieldLabel><Input id="budget-start" name="starts_on" type="date" required /></Field><Field><FieldLabel htmlFor="budget-end">End date (required)</FieldLabel><Input id="budget-end" name="ends_on" type="date" required /></Field></div>
    <div className="grid gap-4 sm:grid-cols-3"><Field><FieldLabel htmlFor="budget-department">Department</FieldLabel><Input id="budget-department" name="department" /></Field><Field><FieldLabel htmlFor="budget-cost-center">Cost center</FieldLabel><Input id="budget-cost-center" name="cost_center" /></Field><Field><FieldLabel htmlFor="budget-currency">Currency</FieldLabel><Input id="budget-currency" name="currency" defaultValue="ETB" maxLength={3} /></Field></div>
    <FieldSet><FieldLegend>Budget lines (required)</FieldLegend><FieldDescription>Choose a ledger account and assign its planned amount.</FieldDescription><div className="flex flex-col gap-4">{lineIds.map((id, index) => <Card key={id}><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Line {index + 1}</CardTitle>{lineIds.length > 1 ? <Button type="button" variant="ghost" size="sm" onClick={() => setLineIds((current) => current.filter((value) => value !== id))}><Trash2 data-icon="inline-start" aria-hidden="true" />Remove</Button> : null}</div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Field><FieldLabel htmlFor={`budget-account-${id}`}>Account (required)</FieldLabel><NativeSelect id={`budget-account-${id}`} name={`account_${id}`} required defaultValue=""><NativeSelectOption value="" disabled>Select account</NativeSelectOption>{accounts.map((account) => <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor={`budget-amount-${id}`}>Amount (required)</FieldLabel><Input id={`budget-amount-${id}`} name={`amount_${id}`} type="number" min="0" step="0.01" required /></Field><Field><FieldLabel htmlFor={`budget-notes-${id}`}>Notes</FieldLabel><Input id={`budget-notes-${id}`} name={`notes_${id}`} /></Field></CardContent></Card>)}</div><Button type="button" variant="outline" onClick={() => setLineIds((current) => [...current, Math.max(...current) + 1])}><Plus data-icon="inline-start" aria-hidden="true" />Add budget line</Button></FieldSet>
  </FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || accounts.length === 0}><BusyLabel busy={busy}>Create budget</BusyLabel></Button></DialogFooter></form></DialogContent></Dialog>;
}
