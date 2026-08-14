"use client";

import { useState, type FormEvent } from "react";
import { Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import type { FinanceAccount, FinanceJournal } from "@/modules/finance/types";
import { BusyLabel, FinanceError, FinanceLoading, FinanceShell, FinanceStatus, FinanceTable, Money } from "@/modules/finance/pages/components/finance-shell";

export default function FinanceJournalsPage() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canCreate = hasAnyPermission(["manage_finance", "create_journals"]);
  const canPost = hasAnyPermission(["manage_finance", "post_journals"]);
  const canReverse = hasAnyPermission(["manage_finance", "reverse_journals"]);
  const query = useQuery({ queryKey: ["finance", "journals"], queryFn: () => financeApi.journals({ per_page: 100 }) });
  const accounts = useQuery({ queryKey: ["finance", "account-options"], queryFn: () => financeApi.accounts({ active: true, per_page: 200 }) });
  const create = useMutation({ mutationFn: financeApi.createJournal, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance"] }); setOpen(false); toast.success("Journal created."); }, onError: () => toast.error("Journal could not be created. Check that debits equal credits and the period is open.") });
  const action = useMutation({ mutationFn: ({ journal, action }: { journal: FinanceJournal; action: "post" | "reverse" }) => financeApi.journalAction(journal.id, action), onSuccess: async (_, variables) => { await client.invalidateQueries({ queryKey: ["finance"] }); toast.success(variables.action === "post" ? "Journal posted." : "Reversal journal posted."); }, onError: () => toast.error("The journal action could not be completed.") });
  return <FinanceShell title="General journal" description="Create balanced entries, review source-module postings, post them into the immutable ledger, and reverse errors without deleting history." actions={canCreate ? <JournalDialog open={open} onOpenChange={setOpen} accounts={accounts.data?.data ?? []} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} /> : undefined}>
    <Card><CardHeader><CardTitle>Journal register</CardTitle><CardDescription>Draft entries do not affect reports. Posted entries can only be corrected through an equal and opposite reversal.</CardDescription></CardHeader><CardContent>
      {query.isLoading ? <FinanceLoading cards={2} /> : query.error || !query.data ? <FinanceError error={query.error} /> : <FinanceTable<FinanceJournal> caption="Journal register, newest accounting date first." rows={query.data.data} getKey={(row) => row.id} columns={[
        { key: "number", label: "Journal", render: (row) => <div className="flex flex-col gap-1"><span className="font-mono font-medium">{row.number}</span><span className="text-xs text-muted-foreground">{row.memo || row.type}</span></div> },
        { key: "date", label: "Accounting date", render: (row) => row.entry_date },
        { key: "source", label: "Source", render: (row) => row.source_module || "Finance" },
        { key: "lines", label: "Lines", align: "right", render: (row) => row.lines_count ?? row.lines?.length ?? 0 },
        { key: "debit", label: "Debits", align: "right", render: (row) => <Money value={row.debit_total} /> },
        { key: "credit", label: "Credits", align: "right", render: (row) => <Money value={row.credit_total} /> },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
        { key: "action", label: "Action", align: "right", render: (row) => row.status === "draft" && canPost ? <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ journal: row, action: "post" })}><Send data-icon="inline-start" aria-hidden="true" />Post</Button> : row.status === "posted" && canReverse ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ journal: row, action: "reverse" })}><RotateCcw data-icon="inline-start" aria-hidden="true" />Reverse</Button> : <span className="text-muted-foreground">No action</span> },
      ]} />}
    </CardContent></Card>
  </FinanceShell>;
}

function JournalDialog({ open, onOpenChange, accounts, busy, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; accounts: FinanceAccount[]; busy: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  const [lineIds, setLineIds] = useState([0, 1]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const lines = lineIds.map((lineId) => ({ account_id: Number(values.get(`account_${lineId}`)), description: values.get(`description_${lineId}`) || null, debit: Number(values.get(`debit_${lineId}`) || 0), credit: Number(values.get(`credit_${lineId}`) || 0) }));
    onSubmit({ entry_date: values.get("entry_date"), type: values.get("type") || "general", memo: values.get("memo") || null, currency: "ETB", lines, post: values.get("post") === "1" });
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogTrigger asChild><Button><Plus data-icon="inline-start" aria-hidden="true" />New journal</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><form onSubmit={submit} className="flex flex-col gap-5"><DialogHeader><DialogTitle>Create journal entry</DialogTitle><DialogDescription>Every entry needs at least two lines and total debits must equal total credits. Required fields are marked.</DialogDescription></DialogHeader><FieldGroup>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="journal-date">Accounting date (required)</FieldLabel><Input id="journal-date" name="entry_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field><Field><FieldLabel htmlFor="journal-type">Journal type</FieldLabel><Input id="journal-type" name="type" defaultValue="general" /></Field></div>
    <Field><FieldLabel htmlFor="journal-memo">Memo</FieldLabel><Input id="journal-memo" name="memo" /><FieldDescription>Describe the business event and evidence behind this entry.</FieldDescription></Field>
    <FieldSet><FieldLegend>Journal lines (required)</FieldLegend><div className="flex flex-col gap-4">{lineIds.map((lineId, index) => <Card key={lineId}><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Line {index + 1}</CardTitle>{lineIds.length > 2 ? <Button type="button" variant="ghost" size="sm" onClick={() => setLineIds((current) => current.filter((id) => id !== lineId))}><Trash2 data-icon="inline-start" aria-hidden="true" />Remove</Button> : null}</div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <Field><FieldLabel htmlFor={`journal-account-${lineId}`}>Account (required)</FieldLabel><NativeSelect id={`journal-account-${lineId}`} name={`account_${lineId}`} required defaultValue=""><NativeSelectOption value="" disabled>Select an account</NativeSelectOption>{accounts.map((account) => <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>)}</NativeSelect></Field>
      <Field><FieldLabel htmlFor={`journal-description-${lineId}`}>Line description</FieldLabel><Input id={`journal-description-${lineId}`} name={`description_${lineId}`} /></Field>
      <Field><FieldLabel htmlFor={`journal-debit-${lineId}`}>Debit</FieldLabel><Input id={`journal-debit-${lineId}`} name={`debit_${lineId}`} type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" /></Field>
      <Field><FieldLabel htmlFor={`journal-credit-${lineId}`}>Credit</FieldLabel><Input id={`journal-credit-${lineId}`} name={`credit_${lineId}`} type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" /></Field>
    </CardContent></Card>)}</div><Button type="button" variant="outline" onClick={() => setLineIds((current) => [...current, Math.max(...current) + 1])}><Plus data-icon="inline-start" aria-hidden="true" />Add line</Button></FieldSet>
    <Field><FieldLabel htmlFor="journal-post">Posting behavior</FieldLabel><NativeSelect id="journal-post" name="post" defaultValue="0"><NativeSelectOption value="0">Save as draft for review</NativeSelectOption><NativeSelectOption value="1">Post immediately</NativeSelectOption></NativeSelect></Field>
  </FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || accounts.length === 0}><BusyLabel busy={busy}>Create journal</BusyLabel></Button></DialogFooter></form></DialogContent></Dialog>;
}
