"use client";

import { useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import type { FinanceAccount, FinanceBankReconciliation } from "@/modules/finance/types";
import { BusyLabel, FinanceError, FinanceLoading, FinanceShell, FinanceStatus, FinanceTable, Money } from "@/modules/finance/pages/components/finance-shell";

export default function FinanceBankingPage() {
  const [open, setOpen] = useState(false); const client = useQueryClient(); const { hasAnyPermission } = usePermissions(); const canManage = hasAnyPermission(["manage_finance", "reconcile_banks"]);
  const query = useQuery({ queryKey: ["finance", "reconciliations"], queryFn: () => financeApi.reconciliations({ per_page: 100 }) });
  const accounts = useQuery({ queryKey: ["finance", "bank-accounts"], queryFn: () => financeApi.accounts({ bank_only: true, active: true, per_page: 100 }) });
  const create = useMutation({ mutationFn: financeApi.createReconciliation, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance"] }); setOpen(false); toast.success("Bank reconciliation created."); }, onError: () => toast.error("Reconciliation could not be created.") });
  const complete = useMutation({ mutationFn: (id: number) => financeApi.completeReconciliation(id), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance"] }); toast.success("Bank reconciliation completed."); }, onError: () => toast.error("Resolve the difference before completing reconciliation.") });
  return <FinanceShell title="Bank reconciliation" description="Compare bank and cash ledger balances with statements, capture timing adjustments, and lock a statement only when the difference is zero." actions={canManage ? <ReconciliationDialog open={open} onOpenChange={setOpen} accounts={accounts.data?.data ?? []} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} /> : undefined}>
    <Card><CardHeader><CardTitle>Statement reconciliation register</CardTitle><CardDescription>Completed statements are immutable evidence of the book-to-bank comparison.</CardDescription></CardHeader><CardContent>{query.isLoading ? <FinanceLoading cards={2} /> : query.error || !query.data ? <FinanceError error={query.error} /> : <FinanceTable<FinanceBankReconciliation> caption="Bank reconciliation statements, newest first." rows={query.data.data} getKey={(row) => row.id} columns={[
      { key: "account", label: "Account", render: (row) => <span className="font-medium">{row.account ? `${row.account.code} · ${row.account.name}` : row.account_id}</span> },
      { key: "date", label: "Statement date", render: (row) => row.statement_date },
      { key: "book", label: "Book balance", align: "right", render: (row) => <Money value={row.book_balance} /> },
      { key: "statement", label: "Statement balance", align: "right", render: (row) => <Money value={row.statement_balance} /> },
      { key: "difference", label: "Difference", align: "right", render: (row) => <Money value={row.difference} /> },
      { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
      { key: "action", label: "Action", align: "right", render: (row) => row.status === "draft" && canManage ? <Button size="sm" disabled={complete.isPending || Math.abs(Number(row.difference)) >= 0.01} onClick={() => complete.mutate(row.id)}><Check data-icon="inline-start" aria-hidden="true" />Complete</Button> : <span className="text-muted-foreground">No action</span> },
    ]} />}</CardContent></Card>
  </FinanceShell>;
}

function ReconciliationDialog({ open, onOpenChange, accounts, busy, onSubmit }: { open: boolean; onOpenChange: (value: boolean) => void; accounts: FinanceAccount[]; busy: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); const adjustment = Number(values.get("adjustment") || 0); onSubmit({ account_id: Number(values.get("account_id")), statement_date: values.get("statement_date"), statement_balance: Number(values.get("statement_balance")), items: adjustment === 0 ? [] : [{ kind: adjustment < 0 ? "subtract" : "add", description: values.get("adjustment_description") || "Statement timing adjustment", amount: Math.abs(adjustment) }] }); }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogTrigger asChild><Button><Plus data-icon="inline-start" aria-hidden="true" />New reconciliation</Button></DialogTrigger><DialogContent><form onSubmit={submit} className="flex flex-col gap-5"><DialogHeader><DialogTitle>Start bank reconciliation</DialogTitle><DialogDescription>Enter the closing statement balance and any one net timing adjustment. The server calculates the book balance and difference.</DialogDescription></DialogHeader><FieldGroup>
    <Field><FieldLabel htmlFor="reconciliation-account">Bank account (required)</FieldLabel><NativeSelect id="reconciliation-account" name="account_id" required defaultValue=""><NativeSelectOption value="" disabled>Select a bank account</NativeSelectOption>{accounts.map((account) => <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>)}</NativeSelect></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="reconciliation-date">Statement date (required)</FieldLabel><Input id="reconciliation-date" name="statement_date" type="date" required /></Field><Field><FieldLabel htmlFor="reconciliation-balance">Statement balance (required)</FieldLabel><Input id="reconciliation-balance" name="statement_balance" type="number" step="0.01" required inputMode="decimal" /></Field></div>
    <Field><FieldLabel htmlFor="reconciliation-adjustment">Net timing adjustment</FieldLabel><Input id="reconciliation-adjustment" name="adjustment" type="number" step="0.01" defaultValue="0" inputMode="decimal" /><FieldDescription>Use a positive number to add to book balance or a negative number to subtract.</FieldDescription></Field>
    <Field><FieldLabel htmlFor="reconciliation-description">Adjustment description</FieldLabel><Input id="reconciliation-description" name="adjustment_description" /></Field>
  </FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || accounts.length === 0}><BusyLabel busy={busy}>Create reconciliation</BusyLabel></Button></DialogFooter></form></DialogContent></Dialog>;
}
