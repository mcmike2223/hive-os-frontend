"use client";

import { useState, type FormEvent } from "react";
import { Check, Edit, MoreVertical, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import type { FinanceAccount, FinanceBankReconciliation, FinanceBankReconciliationItem } from "@/modules/finance/types";
import { BusyLabel, FinanceError, FinanceShell, FinanceStatus, FinanceTable, FinanceTableSkeleton, Money } from "@/modules/finance/pages/components/finance-shell";

function friendlyReconciliationSaveError(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  const lower = message.toLowerCase();
  if (
    lower.includes("finance_bank_reconciliation_unique") ||
    (lower.includes("duplicate") && lower.includes("account_id") && lower.includes("statement_date"))
  ) {
    return "A reconciliation for this bank account and statement date already exists. Use a different date or edit the existing draft.";
  }
  return message;
}

function netAdjustmentFromItems(items?: FinanceBankReconciliationItem[]) {
  if (!items?.length) return 0;
  return items.reduce((sum, item) => sum + (item.kind === "subtract" ? -item.amount : item.amount), 0);
}

function payloadFromForm(values: FormData) {
  const adjustment = Number(values.get("adjustment") || 0);
  return {
    account_id: Number(values.get("account_id")),
    statement_date: values.get("statement_date"),
    statement_balance: Number(values.get("statement_balance")),
    items:
      adjustment === 0
        ? []
        : [
            {
              kind: adjustment < 0 ? "subtract" : "add",
              description: (values.get("adjustment_description") as string) || "Statement timing adjustment",
              amount: Math.abs(adjustment),
            },
          ],
  };
}

function formatStatementDate(value: string) {
  return value.slice(0, 10);
}

export default function FinanceBankingPage() {
  const [open, setOpen] = useState(false);
  const [editReconciliation, setEditReconciliation] = useState<FinanceBankReconciliation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "reconcile_banks"]);

  const query = useQuery({
    queryKey: ["finance", "reconciliations", statusFilter, accountFilter],
    queryFn: () =>
      financeApi.reconciliations({
        status: statusFilter || undefined,
        account_id: accountFilter ? Number(accountFilter) : undefined,
        per_page: 100,
      }),
  });

  const accounts = useQuery({
    queryKey: ["finance", "bank-accounts"],
    queryFn: () => financeApi.accounts({ bank_only: true, active: true, per_page: 100 }),
  });

  const detailQuery = useQuery({
    queryKey: ["finance", "reconciliations", "detail", detailId],
    enabled: detailOpen && detailId !== null,
    queryFn: () => financeApi.getReconciliation(detailId!),
  });

  const accountList = accounts.data?.data ?? [];

  const create = useMutation({
    mutationFn: financeApi.createReconciliation,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "reconciliations"] });
      setOpen(false);
      toast.success("Bank reconciliation created.");
    },
    onError: (error) => toast.error(friendlyReconciliationSaveError(error, "Reconciliation could not be created.")),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => financeApi.updateReconciliation(id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "reconciliations"] });
      await client.invalidateQueries({ queryKey: ["finance", "reconciliations", "detail"] });
      setEditReconciliation(null);
      toast.success("Bank reconciliation updated.");
    },
    onError: (error) => toast.error(friendlyReconciliationSaveError(error, "Reconciliation could not be updated.")),
  });

  const complete = useMutation({
    mutationFn: (id: number) => financeApi.completeReconciliation(id),
    onMutate: (id) => setBusyId(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "reconciliations"] });
      await client.invalidateQueries({ queryKey: ["finance", "reconciliations", "detail"] });
      setBusyId(null);
      toast.success("Bank reconciliation completed.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Resolve the difference before completing reconciliation."));
      setBusyId(null);
    },
  });

  const anyBusy = busyId !== null || complete.isPending;

  return (
    <FinanceShell
      title="Bank reconciliation"
      description="Compare bank and cash ledger balances with statements, capture timing adjustments, and lock a statement only when the difference is zero."
      actions={
        canManage ? (
          <ReconciliationDialog
            mode="create"
            open={open}
            onOpenChange={setOpen}
            accounts={accountList}
            busy={create.isPending}
            onSubmit={(payload) => create.mutate(payload)}
          />
        ) : undefined
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Statement reconciliation register</CardTitle>
          <CardDescription>Completed statements are immutable evidence of the book-to-bank comparison.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="reconciliation-status-filter">Status</FieldLabel>
              <NativeSelect id="reconciliation-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <NativeSelectOption value="">All statuses</NativeSelectOption>
                <NativeSelectOption value="draft">Draft</NativeSelectOption>
                <NativeSelectOption value="completed">Completed</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="reconciliation-account-filter">Bank account</FieldLabel>
              <NativeSelect id="reconciliation-account-filter" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <NativeSelectOption value="">All accounts</NativeSelectOption>
                {accountList.map((account) => (
                  <NativeSelectOption key={account.id} value={String(account.id)}>
                    {account.code} · {account.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>

          {query.isPending ? (
            <FinanceTableSkeleton rows={6} cols={7} />
          ) : query.isError ? (
            <FinanceError error={query.error} />
          ) : (
            <FinanceTable<FinanceBankReconciliation>
              caption="Bank reconciliation statements, newest first."
              rows={query.data.data}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailId(row.id);
                setDetailOpen(true);
              }}
              columns={[
                {
                  key: "account",
                  label: "Account",
                  render: (row) => (
                    <span className="font-medium">{row.account ? `${row.account.code} · ${row.account.name}` : row.account_id}</span>
                  ),
                },
                { key: "date", label: "Statement date", render: (row) => formatStatementDate(row.statement_date) },
                { key: "book", label: "Book balance", align: "right", render: (row) => <Money value={row.book_balance} /> },
                { key: "statement", label: "Statement balance", align: "right", render: (row) => <Money value={row.statement_balance} /> },
                { key: "difference", label: "Difference", align: "right", render: (row) => <Money value={row.difference} /> },
                { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
                {
                  key: "action",
                  label: "",
                  align: "right",
                  render: (row) => {
                    if (!canManage || row.status !== "draft") return null;

                    const isThisRow = busyId === row.id;
                    const differenceResolved = Math.abs(Number(row.difference)) < 0.01;
                    const items: Array<{ label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }> = [
                      { label: "Edit", icon: <Edit className="h-4 w-4" />, onClick: () => setEditReconciliation(row) },
                      {
                        label: differenceResolved ? "Complete" : "Complete (difference must be 0)",
                        icon: <Check className="h-4 w-4" />,
                        onClick: () => complete.mutate(row.id),
                        disabled: !differenceResolved,
                      },
                    ];

                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={anyBusy}>
                            {isThisRow ? <BusyLabel busy={true}>{" "}</BusyLabel> : <MoreVertical className="h-4 w-4" />}
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {items.map((item) => (
                            <DropdownMenuItem key={item.label} disabled={anyBusy || item.disabled} onClick={item.onClick}>
                              {item.icon}
                              {item.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  },
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <ReconciliationDialog
        key={editReconciliation?.id ?? "none"}
        mode="edit"
        open={editReconciliation !== null}
        onOpenChange={(open) => {
          if (!open) setEditReconciliation(null);
        }}
        accounts={accountList}
        busy={update.isPending}
        reconciliation={editReconciliation}
        onSubmit={(payload) => editReconciliation && update.mutate({ id: editReconciliation.id, payload })}
      />

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setDetailId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reconciliation details</DialogTitle>
            <DialogDescription>Book-to-bank comparison for this statement period.</DialogDescription>
          </DialogHeader>

          {detailQuery.isPending ? (
            <div className="py-4 text-muted-foreground">Loading…</div>
          ) : detailQuery.isError ? (
            <FinanceError error={detailQuery.error} />
          ) : detailQuery.data ? (
            <div className="flex flex-col gap-6 pb-2">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-sm text-muted-foreground">Account</div>
                  <div className="font-medium">
                    {detailQuery.data.account
                      ? `${detailQuery.data.account.code} · ${detailQuery.data.account.name}`
                      : detailQuery.data.account_id}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Statement date</div>
                  <div className="font-medium">{formatStatementDate(detailQuery.data.statement_date)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <FinanceStatus value={detailQuery.data.status} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Difference</div>
                  <div className="font-medium">
                    <Money value={detailQuery.data.difference} />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground">Book balance</div>
                  <div className="font-medium mt-1">
                    <Money value={detailQuery.data.book_balance} />
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Statement balance</div>
                  <div className="font-medium mt-1">
                    <Money value={detailQuery.data.statement_balance} />
                  </div>
                </div>
                {detailQuery.data.completed_at ? (
                  <div>
                    <div className="text-sm text-muted-foreground">Completed at</div>
                    <div className="font-medium mt-1">{formatStatementDate(detailQuery.data.completed_at)}</div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">Timing adjustments</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Kind</th>
                        <th className="px-3 py-2 text-left font-medium">Description</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailQuery.data.items ?? []).length ? (
                        detailQuery.data.items!.map((item, index) => (
                          <tr key={index} className="border-b last:border-b-0">
                            <td className="px-3 py-2 capitalize">{item.kind}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <Money value={item.kind === "subtract" ? -item.amount : item.amount} />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                            No timing adjustments recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {detailQuery.data.status === "draft" && canManage ? (
                <p className="text-sm text-muted-foreground">
                  {Math.abs(Number(detailQuery.data.difference)) < 0.01
                    ? "Difference is zero — you can complete this reconciliation from the row actions menu."
                    : "Edit the statement balance or timing adjustment until the difference is zero, then complete it."}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </FinanceShell>
  );
}

function ReconciliationDialog({
  mode,
  open,
  onOpenChange,
  accounts,
  busy,
  reconciliation,
  onSubmit,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (value: boolean) => void;
  accounts: FinanceAccount[];
  busy: boolean;
  reconciliation?: FinanceBankReconciliation | null;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const netAdjustment = reconciliation ? netAdjustmentFromItems(reconciliation.items) : 0;
  const adjustmentDescription =
    reconciliation?.items?.find((item) => item.description)?.description ?? "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(payloadFromForm(new FormData(event.currentTarget)));
  }

  const form = (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Start bank reconciliation" : "Edit draft reconciliation"}</DialogTitle>
        <DialogDescription>
          Enter the closing statement balance and any one net timing adjustment. The server calculates the book balance and difference.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reconciliation-account">Bank account (required)</FieldLabel>
          <NativeSelect
            id="reconciliation-account"
            name="account_id"
            required
            defaultValue={reconciliation ? String(reconciliation.account_id) : ""}
          >
            <NativeSelectOption value="" disabled>
              Select a bank account
            </NativeSelectOption>
            {accounts.map((account) => (
              <NativeSelectOption key={account.id} value={String(account.id)}>
                {account.code} · {account.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>Only accounts marked as bank or cash in Chart of Accounts appear here.</FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="reconciliation-date">Statement date (required)</FieldLabel>
            <Input
              id="reconciliation-date"
              name="statement_date"
              type="date"
              required
              defaultValue={reconciliation ? formatStatementDate(reconciliation.statement_date) : undefined}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="reconciliation-balance">Statement balance (required)</FieldLabel>
            <Input
              id="reconciliation-balance"
              name="statement_balance"
              type="number"
              step="0.01"
              required
              inputMode="decimal"
              defaultValue={reconciliation?.statement_balance}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="reconciliation-adjustment">Net timing adjustment</FieldLabel>
          <Input
            id="reconciliation-adjustment"
            name="adjustment"
            type="number"
            step="0.01"
            defaultValue={netAdjustment}
            inputMode="decimal"
          />
          <FieldDescription>Use a positive number to add to book balance or a negative number to subtract.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="reconciliation-description">Adjustment description</FieldLabel>
          <Input id="reconciliation-description" name="adjustment_description" defaultValue={adjustmentDescription} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || accounts.length === 0}>
          <BusyLabel busy={busy}>{mode === "create" ? "Create reconciliation" : "Save changes"}</BusyLabel>
        </Button>
      </DialogFooter>
    </form>
  );

  if (mode === "create") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button>
            <Plus data-icon="inline-start" aria-hidden="true" />
            New reconciliation
          </Button>
        </DialogTrigger>
        <DialogContent>{form}</DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{form}</DialogContent>
    </Dialog>
  );
}
