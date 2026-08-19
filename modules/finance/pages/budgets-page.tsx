"use client";

import { useState, type FormEvent } from "react";
import { Archive, Check, Edit, LockKeyhole, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import type { FinanceAccount, FinanceBudget } from "@/modules/finance/types";
import { BusyLabel, FinanceError, FinanceShell, FinanceStatus, FinanceTable, FinanceTableSkeleton, Money, useDebouncedValue } from "@/modules/finance/pages/components/finance-shell";

export default function FinanceBudgetsPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<FinanceBudget | null>(null);
  const [detailBudgetId, setDetailBudgetId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinanceBudget | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "manage_budgets"]);
  const canApprove = hasAnyPermission(["manage_finance", "approve_budgets"]);

  const query = useQuery({ queryKey: ["finance", "budgets", search, statusFilter], queryFn: () => financeApi.budgets({ search: search || undefined, status: statusFilter || undefined, per_page: 100 }) });
  const detailQuery = useQuery({
    queryKey: ["finance", "budgets", "detail", detailBudgetId],
    enabled: detailOpen && detailBudgetId !== null,
    queryFn: () => financeApi.getBudget(detailBudgetId!),
  });
  const accounts = useQuery({ queryKey: ["finance", "budget-accounts"], queryFn: () => financeApi.accounts({ active: true, per_page: 200 }) });

  const create = useMutation({
    mutationFn: financeApi.createBudget,
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance", "budgets"] }); setCreateOpen(false); toast.success("Budget created."); },
    onError: (error) => toast.error(getErrorMessage(error, "Budget could not be created.")),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => financeApi.updateBudget(id, payload),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance", "budgets"] }); setEditBudget(null); toast.success("Budget updated."); },
    onError: (error) => toast.error(getErrorMessage(error, "Budget could not be updated.")),
  });

  const remove = useMutation({
    mutationFn: (id: number) => financeApi.deleteBudget(id),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance", "budgets"] }); setDeleteTarget(null); setBusyId(null); toast.success("Budget deleted."); },
    onError: (error) => { toast.error(getErrorMessage(error, "Budget could not be deleted.")); setDeleteTarget(null); setBusyId(null); },
  });

  const action = useMutation({
    mutationFn: ({ budget, action }: { budget: FinanceBudget; action: "approve" | "lock" | "archive" }) => financeApi.budgetAction(budget.id, action),
    onMutate: ({ budget }) => setBusyId(budget.id),
    onSuccess: async (_, variables) => { await client.invalidateQueries({ queryKey: ["finance", "budgets"] }); setBusyId(null); toast.success(`Budget ${variables.action}d.`); },
    onError: (error) => { toast.error(getErrorMessage(error, "Budget action could not be completed.")); setBusyId(null); },
  });

  const anyBusy = busyId !== null;
  const accountList = accounts.data?.data ?? [];

  return (
    <FinanceShell title="Budgets and variance" description="Set period and departmental budgets against ledger accounts, approve a baseline, lock it, and compare actual financial activity with plan." actions={canManage ? <BudgetFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} accounts={accountList} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} /> : undefined}>
      <Card>
        <CardHeader><CardTitle>Budget register</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="budget-search">Search budgets</FieldLabel><Input id="budget-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Budget name" /></Field>
            <Field><FieldLabel htmlFor="budget-status-filter">Status</FieldLabel><NativeSelect id="budget-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><NativeSelectOption value="">All statuses</NativeSelectOption><NativeSelectOption value="draft">Draft</NativeSelectOption><NativeSelectOption value="approved">Approved</NativeSelectOption><NativeSelectOption value="locked">Locked</NativeSelectOption><NativeSelectOption value="archived">Archived</NativeSelectOption></NativeSelect></Field>
          </div>
          {query.isPending ? <FinanceTableSkeleton rows={6} cols={6} /> : query.isError ? <FinanceError error={query.error} /> : (
            <FinanceTable<FinanceBudget>
              caption="Approved, locked, archived, and draft budgets."
              rows={query.data.data}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailBudgetId(row.id);
                setDetailOpen(true);
              }}
              columns={[
      { key: "name", label: "Budget", render: (row) => <div className="flex flex-col gap-1"><span className="font-medium">{row.name}</span><span className="text-xs text-muted-foreground">{row.department || "All departments"}</span></div> },
      { key: "period", label: "Period", render: (row) => `${row.starts_on} – ${row.ends_on}` },
      { key: "lines", label: "Lines", align: "right", render: (row) => row.lines.length },
      { key: "total", label: "Budget", align: "right", render: (row) => <Money value={row.total_amount} currency={row.currency} /> },
      { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
                { key: "action", label: "", align: "right", render: (row) => {
                  const items: Array<{ label: string; icon: React.ReactNode; onClick: () => void; variant?: "destructive" }> = [];

                  if (row.status === "draft" && canManage) {
                    items.push({ label: "Edit", icon: <Edit className="h-4 w-4" />, onClick: () => setEditBudget(row) });
                  }
                  if (row.status === "draft" && canApprove) {
                    items.push({ label: "Approve", icon: <Check className="h-4 w-4" />, onClick: () => action.mutate({ budget: row, action: "approve" }) });
                  }
                  if (row.status === "approved" && canApprove) {
                    items.push({ label: "Lock", icon: <LockKeyhole className="h-4 w-4" />, onClick: () => action.mutate({ budget: row, action: "lock" }) });
                  }
                  if (["approved", "locked"].includes(row.status) && canApprove) {
                    items.push({ label: "Archive", icon: <Archive className="h-4 w-4" />, onClick: () => action.mutate({ budget: row, action: "archive" }) });
                  }
                  if (row.status === "draft" && canManage) {
                    items.push({ label: "Delete", icon: <Trash2 className="h-4 w-4" />, onClick: () => setDeleteTarget(row), variant: "destructive" });
                  }

                  if (items.length === 0) return null;

                  const isThisRow = busyId === row.id;
                  const isOtherRow = anyBusy && !isThisRow;

                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={anyBusy}>
                          {isThisRow ? <BusyLabel busy={true}>{" "}</BusyLabel> : <MoreVertical className="h-4 w-4" />}
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {items.map((item, i) => {
                          const hasDestructiveSeparator = item.variant === "destructive" && i > 0;
                          return (
                            <span key={item.label}>
                              {hasDestructiveSeparator && <DropdownMenuSeparator />}
                              <DropdownMenuItem disabled={anyBusy} onClick={item.onClick} className={item.variant === "destructive" ? "text-destructive focus:text-destructive" : ""}>
                                {item.icon}
                                {item.label}
                              </DropdownMenuItem>
                            </span>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }},
              ]}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit dialog — key forces remount so form resets with new budget data */}
      <BudgetFormDialog
        key={editBudget?.id ?? "none"}
        mode="edit"
        open={editBudget !== null}
        onOpenChange={(open) => { if (!open) setEditBudget(null); }}
        accounts={accountList}
        busy={update.isPending}
        budget={editBudget}
        onSubmit={(payload) => editBudget && update.mutate({ id: editBudget.id, payload })}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete budget</DialogTitle>
            <DialogDescription>Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => { if (deleteTarget) { setBusyId(deleteTarget.id); remove.mutate(deleteTarget.id); } }}>
              <BusyLabel busy={remove.isPending}>Delete</BusyLabel>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget details */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setDetailBudgetId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Budget details</DialogTitle>
            <DialogDescription>Budget header, lines, and variance report.</DialogDescription>
          </DialogHeader>

          {detailQuery.isPending ? (
            <div className="py-4 text-muted-foreground">Loading…</div>
          ) : detailQuery.isError ? (
            <FinanceError error={detailQuery.error} />
          ) : detailQuery.data ? (
            <div className="flex flex-col gap-6 pb-2">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><div className="text-sm text-muted-foreground">Name</div><div className="font-medium">{detailQuery.data.budget.name}</div></div>
                <div><div className="text-sm text-muted-foreground">Status</div><div><FinanceStatus value={detailQuery.data.budget.status} /></div></div>
                <div><div className="text-sm text-muted-foreground">Period</div><div className="font-medium">{detailQuery.data.budget.starts_on} – {detailQuery.data.budget.ends_on}</div></div>
                <div><div className="text-sm text-muted-foreground">Total budget</div><div className="font-medium"><Money value={detailQuery.data.budget.total_amount} currency={detailQuery.data.budget.currency} /></div></div>
                <div><div className="text-sm text-muted-foreground">Department</div><div className="font-medium">{detailQuery.data.budget.department || "All departments"}</div></div>
              </div>

              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">Budget lines</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Account ID</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                        <th className="px-3 py-2 text-left font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQuery.data.budget.lines.map((line, index) => (
                        <tr key={index} className="border-b last:border-b-0">
                          <td className="px-3 py-2">{line.account_id}</td>
                          <td className="px-3 py-2 text-right tabular-nums"><Money value={line.amount} currency={detailQuery.data.budget.currency} /></td>
                          <td className="px-3 py-2">{line.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">Variance</div>
                {detailQuery.data.variance.rows.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No variance rows available yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {Object.keys(detailQuery.data.variance.rows[0] ?? {}).map((key) => (
                            <th key={key} className="px-3 py-2 text-left font-medium">{key.replaceAll("_", " ")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailQuery.data.variance.rows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b last:border-b-0">
                            {Object.keys(detailQuery.data.variance.rows[0] ?? {}).map((key) => (
                              <td key={key} className="px-3 py-2">{String((row as Record<string, unknown>)[key] ?? "—")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </FinanceShell>
  );
}

function BudgetFormDialog({ mode, open, onOpenChange, accounts, busy, onSubmit, budget }: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (value: boolean) => void;
  accounts: FinanceAccount[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  budget?: FinanceBudget | null;
}) {
  const [lineIds, setLineIds] = useState<number[]>(() => budget ? budget.lines.map((_, i) => i) : [0]);

  const resetLines = (b: FinanceBudget | null | undefined) => {
    setLineIds(b ? b.lines.map((_, i) => i) : [0]);
  };

  const handleOpenChange = (value: boolean) => {
    if (value && mode === "edit" && budget) resetLines(budget);
    if (value && mode === "create") setLineIds([0]);
    onOpenChange(value);
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({
      name: values.get("name"),
      starts_on: values.get("starts_on"),
      ends_on: values.get("ends_on"),
      department: values.get("department") || null,
      cost_center: values.get("cost_center") || null,
      currency: values.get("currency") || "ETB",
      lines: lineIds.map((id) => ({
        account_id: Number(values.get(`account_${id}`)),
        amount: Number(values.get(`amount_${id}`)),
        notes: values.get(`notes_${id}`) || null,
      })),
    });
  }

  const isEdit = mode === "edit";
  const title = isEdit ? "Edit budget" : "Create budget";
  const description = isEdit
    ? "Update the budget details. Only draft budgets can be edited."
    : "Set the approved amount for each account during one fiscal range. Required fields are marked.";

  const trigger = !isEdit ? (
    <DialogTrigger asChild>
      <Button><Plus data-icon="inline-start" aria-hidden="true" />New budget</Button>
    </DialogTrigger>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="budget-name">Budget name (required)</FieldLabel>
              <Input id="budget-name" name="name" required autoFocus defaultValue={budget?.name ?? ""} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="budget-start">Start date (required)</FieldLabel>
                <Input id="budget-start" name="starts_on" type="date" required defaultValue={budget?.starts_on?.slice(0, 10) ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="budget-end">End date (required)</FieldLabel>
                <Input id="budget-end" name="ends_on" type="date" required defaultValue={budget?.ends_on?.slice(0, 10) ?? ""} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="budget-department">Department</FieldLabel>
                <Input id="budget-department" name="department" defaultValue={budget?.department ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="budget-cost-center">Cost center</FieldLabel>
                <Input id="budget-cost-center" name="cost_center" defaultValue={budget?.cost_center ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="budget-currency">Currency</FieldLabel>
                <Input id="budget-currency" name="currency" defaultValue={budget?.currency ?? "ETB"} maxLength={3} />
              </Field>
            </div>
            <FieldSet>
              <FieldLegend>Budget lines (required)</FieldLegend>
              <FieldDescription>Choose a ledger account and assign its planned amount.</FieldDescription>
              <div className="flex flex-col gap-4">
                {lineIds.map((id, index) => {
                  const line = budget?.lines[id];
                  return (
                    <Card key={id}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle>Line {index + 1}</CardTitle>
                          {lineIds.length > 1 ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setLineIds((current) => current.filter((value) => value !== id))}>
                              <Trash2 data-icon="inline-start" aria-hidden="true" />Remove
                            </Button>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-3">
                        <Field>
                          <FieldLabel htmlFor={`budget-account-${id}`}>Account (required)</FieldLabel>
                          <NativeSelect id={`budget-account-${id}`} name={`account_${id}`} required defaultValue={line?.account_id ? String(line.account_id) : ""}>
                            <NativeSelectOption value="" disabled>Select account</NativeSelectOption>
                            {accounts.map((account) => <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>)}
                          </NativeSelect>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`budget-amount-${id}`}>Amount (required)</FieldLabel>
                          <Input id={`budget-amount-${id}`} name={`amount_${id}`} type="number" min="0" step="0.01" required defaultValue={line?.amount ?? ""} />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`budget-notes-${id}`}>Notes</FieldLabel>
                          <Input id={`budget-notes-${id}`} name={`notes_${id}`} defaultValue={line?.notes ?? ""} />
                        </Field>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Button type="button" variant="outline" onClick={() => setLineIds((current) => [...current, Math.max(...current) + 1])}>
                <Plus data-icon="inline-start" aria-hidden="true" />Add budget line
              </Button>
            </FieldSet>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || accounts.length === 0}>
              <BusyLabel busy={busy}>{isEdit ? "Save changes" : "Create budget"}</BusyLabel>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
