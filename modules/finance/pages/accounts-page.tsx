"use client";

import { useState, type FormEvent } from "react";
import { Plus, Power } from "lucide-react";
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
import type { FinanceAccount } from "@/modules/finance/types";
import { BusyLabel, FinanceError, FinanceLoading, FinanceShell, FinanceStatus, FinanceTable, Money } from "@/modules/finance/pages/components/finance-shell";

export default function FinanceAccountsPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "manage_chart_of_accounts"]);
  const query = useQuery({ queryKey: ["finance", "accounts", search], queryFn: () => financeApi.accounts({ search: search || undefined, per_page: 100 }) });
  const create = useMutation({ mutationFn: financeApi.createAccount, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance", "accounts"] }); setOpen(false); toast.success("Account created."); }, onError: () => toast.error("Account could not be created.") });
  const toggle = useMutation({ mutationFn: ({ account, active }: { account: FinanceAccount; active: boolean }) => financeApi.updateAccount(account.id, { code: account.code, name: account.name, type: account.type, is_active: active }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance", "accounts"] }); toast.success("Account status updated."); }, onError: () => toast.error("Account status could not be updated.") });

  return <FinanceShell title="Chart of accounts" description="Maintain the tenant’s account hierarchy, opening balances, control accounts, and bank accounts. Posted accounts remain auditable and are deactivated instead of deleted." actions={canManage ? <AccountDialog open={open} onOpenChange={setOpen} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} /> : undefined}>
    <Card>
      <CardHeader><CardTitle>Account register</CardTitle><CardDescription>Search by account code or name. All balances use the account’s normal debit or credit orientation.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field><FieldLabel htmlFor="account-search">Search accounts</FieldLabel><Input id="account-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Example: 1100 or receivable" /></Field>
        {query.isLoading ? <FinanceLoading cards={2} /> : query.error || !query.data ? <FinanceError error={query.error} /> : <FinanceTable<FinanceAccount> caption="Tenant chart of accounts ordered by account code." rows={query.data.data} getKey={(row) => row.id} columns={[
          { key: "code", label: "Code", render: (row) => <span className="font-mono font-medium">{row.code}</span> },
          { key: "name", label: "Account", render: (row) => <div className="flex flex-col gap-1"><span className="font-medium">{row.name}</span><span className="text-xs text-muted-foreground">{row.normal_balance} normal balance</span></div> },
          { key: "type", label: "Type", render: (row) => <FinanceStatus value={row.type} /> },
          { key: "opening", label: "Opening", align: "right", render: (row) => <Money value={Number(row.opening_debit) - Number(row.opening_credit)} currency={row.currency} /> },
          { key: "controls", label: "Controls", render: (row) => <span>{[row.is_bank ? "Bank" : null, row.is_control ? "Control" : null, row.is_system ? "System" : null].filter(Boolean).join(" · ") || "Standard"}</span> },
          { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.is_active ? "active" : "inactive"} /> },
          { key: "actions", label: "Action", align: "right", render: (row) => canManage ? <Button type="button" variant="outline" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate({ account: row, active: !row.is_active })}><Power data-icon="inline-start" aria-hidden="true" />{row.is_active ? "Deactivate" : "Activate"}</Button> : <span className="text-muted-foreground">View only</span> },
        ]} />}
      </CardContent>
    </Card>
  </FinanceShell>;
}

function AccountDialog({ open, onOpenChange, busy, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; busy: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({ code: values.get("code"), name: values.get("name"), type: values.get("type"), category: values.get("category") || null, currency: values.get("currency") || "ETB", opening_debit: Number(values.get("opening_debit") || 0), opening_credit: Number(values.get("opening_credit") || 0), is_bank: values.get("is_bank") === "1", is_control: values.get("is_control") === "1", is_active: true });
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogTrigger asChild><Button><Plus data-icon="inline-start" aria-hidden="true" />New account</Button></DialogTrigger><DialogContent><form onSubmit={submit} className="flex flex-col gap-5"><DialogHeader><DialogTitle>Create ledger account</DialogTitle><DialogDescription>Add a tenant-scoped account. Required fields are marked in their labels.</DialogDescription></DialogHeader><FieldGroup>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="account-code">Account code (required)</FieldLabel><Input id="account-code" name="code" required maxLength={40} autoFocus /></Field><Field><FieldLabel htmlFor="account-name">Account name (required)</FieldLabel><Input id="account-name" name="name" required maxLength={255} /></Field></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="account-type">Account type (required)</FieldLabel><NativeSelect id="account-type" name="type" required defaultValue="asset"><NativeSelectOption value="asset">Asset</NativeSelectOption><NativeSelectOption value="liability">Liability</NativeSelectOption><NativeSelectOption value="equity">Equity</NativeSelectOption><NativeSelectOption value="revenue">Revenue</NativeSelectOption><NativeSelectOption value="expense">Expense</NativeSelectOption></NativeSelect></Field><Field><FieldLabel htmlFor="account-category">Category</FieldLabel><Input id="account-category" name="category" /><FieldDescription>Optional reporting subgroup.</FieldDescription></Field></div>
    <div className="grid gap-4 sm:grid-cols-3"><Field><FieldLabel htmlFor="account-currency">Currency (required)</FieldLabel><Input id="account-currency" name="currency" defaultValue="ETB" required maxLength={3} /></Field><Field><FieldLabel htmlFor="opening-debit">Opening debit</FieldLabel><Input id="opening-debit" name="opening_debit" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" /></Field><Field><FieldLabel htmlFor="opening-credit">Opening credit</FieldLabel><Input id="opening-credit" name="opening_credit" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" /></Field></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="account-bank">Bank or cash account</FieldLabel><NativeSelect id="account-bank" name="is_bank" defaultValue="0"><NativeSelectOption value="0">No</NativeSelectOption><NativeSelectOption value="1">Yes</NativeSelectOption></NativeSelect></Field><Field><FieldLabel htmlFor="account-control">Control account</FieldLabel><NativeSelect id="account-control" name="is_control" defaultValue="0"><NativeSelectOption value="0">No</NativeSelectOption><NativeSelectOption value="1">Yes</NativeSelectOption></NativeSelect></Field></div>
  </FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy}><BusyLabel busy={busy}>Create account</BusyLabel></Button></DialogFooter></form></DialogContent></Dialog>;
}
