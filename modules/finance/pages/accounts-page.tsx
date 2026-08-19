"use client";

import { useState, type FormEvent } from "react";
import { Edit, MoreVertical, Plus, Power, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import type { FinanceAccount } from "@/modules/finance/types";
import {
  BusyLabel,
  FinanceError,
  FinanceShell,
  FinanceStatus,
  FinanceTable,
  FinanceTableSkeleton,
  Money,
  useDebouncedValue,
} from "@/modules/finance/pages/components/finance-shell";

export default function FinanceAccountsPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<FinanceAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceAccount | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "manage_chart_of_accounts"]);

  const query = useQuery({
    queryKey: ["finance", "accounts", search, typeFilter, activeFilter],
    queryFn: () => financeApi.accounts({ search: search || undefined, type: typeFilter || undefined, active: activeFilter === "" ? undefined : activeFilter === "true", per_page: 100 }),
  });

  const create = useMutation({
    mutationFn: financeApi.createAccount,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "accounts"] });
      await client.invalidateQueries({ queryKey: ["finance", "accounts", "detail"] });
      setCreateOpen(false);
      toast.success("Account created.");
    },
    onError: () => toast.error("Account could not be created."),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => financeApi.updateAccount(id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "accounts"] });
      await client.invalidateQueries({ queryKey: ["finance", "accounts", "detail"] });
      setEditAccount(null);
      setBusyId(null);
      toast.success("Account updated.");
    },
    onError: (error) => { toast.error(getErrorMessage(error, "Account could not be updated.")); setBusyId(null); },
  });

  const toggle = useMutation({
    mutationFn: ({ account, active }: { account: FinanceAccount; active: boolean }) => financeApi.updateAccount(account.id, { code: account.code, name: account.name, type: account.type, is_active: active }),
    onMutate: ({ account }) => setBusyId(account.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "accounts"] });
      await client.invalidateQueries({ queryKey: ["finance", "accounts", "detail"] });
      toast.success("Account status updated.");
      setBusyId(null);
    },
    onError: () => { toast.error("Account status could not be updated."); setBusyId(null); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => financeApi.deleteAccount(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "accounts"] });
      await client.invalidateQueries({ queryKey: ["finance", "accounts", "detail"] });
      setDeleteTarget(null);
      setBusyId(null);
      toast.success("Account deleted.");
    },
    onError: (error) => { toast.error(getErrorMessage(error, "Account could not be deleted.")); setDeleteTarget(null); setBusyId(null); },
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState<number | null>(null);
  const detailQuery = useQuery({
    queryKey: ["finance", "accounts", "detail", detailAccountId],
    enabled: detailOpen && detailAccountId !== null,
    queryFn: () => financeApi.getAccount(detailAccountId!),
  });

  const anyBusy = busyId !== null;

  return (
    <FinanceShell title="Chart of accounts" description="Maintain the tenant's account hierarchy, opening balances, control accounts, and bank accounts. Posted accounts remain auditable and are deactivated instead of deleted." actions={canManage ? <AccountFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} parentOptions={query.data?.data ?? []} /> : undefined}>
      <Card>
        <CardHeader>
          <CardTitle>Account register</CardTitle>
          <CardDescription>Search by account code or name. All balances use the account's normal debit or credit orientation.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field><FieldLabel htmlFor="account-search">Search accounts</FieldLabel><Input id="account-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Example: 1100 or receivable" /></Field>
            <Field><FieldLabel htmlFor="account-type-filter">Type</FieldLabel><NativeSelect id="account-type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><NativeSelectOption value="">All types</NativeSelectOption><NativeSelectOption value="asset">Asset</NativeSelectOption><NativeSelectOption value="liability">Liability</NativeSelectOption><NativeSelectOption value="equity">Equity</NativeSelectOption><NativeSelectOption value="revenue">Revenue</NativeSelectOption><NativeSelectOption value="expense">Expense</NativeSelectOption></NativeSelect></Field>
            <Field><FieldLabel htmlFor="account-active-filter">Status</FieldLabel><NativeSelect id="account-active-filter" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}><NativeSelectOption value="">All</NativeSelectOption><NativeSelectOption value="true">Active only</NativeSelectOption><NativeSelectOption value="false">Inactive only</NativeSelectOption></NativeSelect></Field>
          </div>
          {query.isPending ? (
            <FinanceTableSkeleton rows={6} cols={7} />
          ) : query.isError ? (
            <FinanceError error={query.error} />
          ) : (
            <FinanceTable<FinanceAccount>
              caption="Tenant chart of accounts ordered by account code."
              rows={query.data.data}
              getKey={(row) => row.id}
              onRowClick={(row) => { setDetailAccountId(row.id); setDetailOpen(true); }}
              columns={[
                { key: "code", label: "Code", render: (row) => <span className="font-mono font-medium">{row.code}</span> },
                { key: "name", label: "Account", render: (row) => <div className="flex flex-col gap-1"><span className="font-medium">{row.name}</span><span className="text-xs text-muted-foreground">{row.normal_balance} normal balance</span></div> },
                { key: "type", label: "Type", render: (row) => <FinanceStatus value={row.type} /> },
                { key: "opening", label: "Opening", align: "right", render: (row) => <Money value={Number(row.opening_debit) - Number(row.opening_credit)} currency={row.currency} /> },
                { key: "controls", label: "Controls", render: (row) => <span>{[row.is_bank ? "Bank" : null, row.is_control ? "Control" : null, row.is_system ? "System" : null].filter(Boolean).join(" · ") || "Standard"}</span> },
                { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.is_active ? "active" : "inactive"} /> },
                { key: "actions", label: "", align: "right", render: (row) => {
                  const isThisRow = busyId === row.id;

                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={anyBusy}>
                          {isThisRow ? <BusyLabel busy={true}>{" "}</BusyLabel> : <MoreVertical className="h-4 w-4" />}
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {canManage && (
                          <>
                            <DropdownMenuItem disabled={anyBusy} onClick={() => setEditAccount(row)}>
                              <Edit className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={anyBusy || row.is_system} onClick={() => toggle.mutate({ account: row, active: !row.is_active })}>
                              <Power className="h-4 w-4" />
                              {row.is_active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            {!row.is_system && (
                              <DropdownMenuItem disabled={anyBusy} onClick={() => setDeleteTarget(row)} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }},
              ]}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <AccountFormDialog
        key={editAccount?.id ?? "none"}
        mode="edit"
        open={editAccount !== null}
        onOpenChange={(open) => { if (!open) setEditAccount(null); }}
        busy={update.isPending}
        account={editAccount}
        parentOptions={query.data?.data ?? []}
        onSubmit={(payload) => editAccount && update.mutate({ id: editAccount.id, payload })}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.code} · {deleteTarget?.name}&rdquo;? This cannot be undone. Accounts that have journal entries or child accounts cannot be deleted — deactivate them instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => { if (deleteTarget) { setBusyId(deleteTarget.id); remove.mutate(deleteTarget.id); } }}>
              <BusyLabel busy={remove.isPending}>Delete</BusyLabel>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account details */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setDetailAccountId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Account details</DialogTitle>
            <DialogDescription>Hierarchy, controls, and related ledger activity.</DialogDescription>
          </DialogHeader>

          {detailQuery.isPending ? (
            <div className="py-4 text-muted-foreground">Loading…</div>
          ) : detailQuery.isError ? (
            <FinanceError error={detailQuery.error} />
          ) : detailQuery.data ? (
            <div className="flex flex-col gap-6 pb-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Code</div>
                    <div className="font-mono text-base">{detailQuery.data.code}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div>
                      <FinanceStatus value={detailQuery.data.is_active ? "active" : "inactive"} />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div className="font-medium">{detailQuery.data.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Type</div>
                  <div>
                    <FinanceStatus value={detailQuery.data.type} />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Normal balance</div>
                  <div className="font-medium">{detailQuery.data.normal_balance}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Opening balance</div>
                  <div className="font-medium">
                    <Money value={Number(detailQuery.data.opening_debit) - Number(detailQuery.data.opening_credit)} currency={detailQuery.data.currency} />
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Controls</div>
                  <div className="font-medium">
                    {[detailQuery.data.is_bank ? "Bank" : null, detailQuery.data.is_control ? "Control" : null, detailQuery.data.is_system ? "System" : null].filter(Boolean).join(" · ") || "Standard"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Ledger lines</div>
                  <div className="font-medium">{detailQuery.data.lines_count ?? 0}</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Parent</div>
                  <div className="font-medium">
                    {detailQuery.data.parent ? `${detailQuery.data.parent.code} · ${detailQuery.data.parent.name}` : "None"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Children</div>
                  <div className="font-medium">
                    {detailQuery.data.children && detailQuery.data.children.length
                      ? detailQuery.data.children.map((c) => `${c.code} · ${c.name}`).join(", ")
                      : "No children"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </FinanceShell>
  );
}

function AccountFormDialog({ mode, open, onOpenChange, busy, onSubmit, account, parentOptions }: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  account?: FinanceAccount | null;
  parentOptions: FinanceAccount[];
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({
      code: values.get("code"),
      name: values.get("name"),
      type: values.get("type"),
      category: values.get("category") || null,
      currency: values.get("currency") || "ETB",
      opening_debit: Number(values.get("opening_debit") || 0),
      opening_credit: Number(values.get("opening_credit") || 0),
      is_bank: values.get("is_bank") === "1",
      is_control: values.get("is_control") === "1",
      parent_id: values.get("parent_id") ? Number(values.get("parent_id")) : null,
      is_active: account ? account.is_active : true,
    });
  }

  const isEdit = mode === "edit";
  const isSystem = account?.is_system ?? false;
  const filteredParentOptions = parentOptions.filter((candidate) => !account || candidate.id !== account.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button><Plus data-icon="inline-start" aria-hidden="true" />New account</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit account" : "Create ledger account"}</DialogTitle>
            <DialogDescription>{isEdit ? "Update account details. System accounts cannot change their code or type." : "Add a tenant-scoped account. Required fields are marked in their labels."}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="account-code">Account code (required)</FieldLabel>
                <Input id="account-code" name="code" required maxLength={40} autoFocus defaultValue={account?.code ?? ""} disabled={isSystem} />
              </Field>
              <Field>
                <FieldLabel htmlFor="account-name">Account name (required)</FieldLabel>
                <Input id="account-name" name="name" required maxLength={255} defaultValue={account?.name ?? ""} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="account-type">Account type (required)</FieldLabel>
                <NativeSelect id="account-type" name="type" required defaultValue={account?.type ?? "asset"} disabled={isSystem}>
                  <NativeSelectOption value="asset">Asset</NativeSelectOption>
                  <NativeSelectOption value="liability">Liability</NativeSelectOption>
                  <NativeSelectOption value="equity">Equity</NativeSelectOption>
                  <NativeSelectOption value="revenue">Revenue</NativeSelectOption>
                  <NativeSelectOption value="expense">Expense</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="account-category">Category</FieldLabel>
                <Input id="account-category" name="category" defaultValue={account?.category ?? ""} />
                <FieldDescription>Optional reporting subgroup.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="account-parent">Parent account</FieldLabel>
                <NativeSelect id="account-parent" name="parent_id" defaultValue={account?.parent?.id ? String(account.parent.id) : ""}>
                  <NativeSelectOption value="">No parent</NativeSelectOption>
                  {filteredParentOptions.map((candidate) => (
                    <NativeSelectOption key={candidate.id} value={String(candidate.id)}>
                      {candidate.code} · {candidate.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>Optional hierarchy parent.</FieldDescription>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="account-currency">Currency (required)</FieldLabel>
                <Input id="account-currency" name="currency" defaultValue={account?.currency ?? "ETB"} required maxLength={3} />
              </Field>
              <Field>
                <FieldLabel htmlFor="opening-debit">Opening debit</FieldLabel>
                <Input id="opening-debit" name="opening_debit" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={account?.opening_debit ?? "0"} />
              </Field>
              <Field>
                <FieldLabel htmlFor="opening-credit">Opening credit</FieldLabel>
                <Input id="opening-credit" name="opening_credit" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={account?.opening_credit ?? "0"} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="account-bank">Bank or cash account</FieldLabel>
                <NativeSelect id="account-bank" name="is_bank" defaultValue={account?.is_bank ? "1" : "0"}>
                  <NativeSelectOption value="0">No</NativeSelectOption>
                  <NativeSelectOption value="1">Yes</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="account-control">Control account</FieldLabel>
                <NativeSelect id="account-control" name="is_control" defaultValue={account?.is_control ? "1" : "0"}>
                  <NativeSelectOption value="0">No</NativeSelectOption>
                  <NativeSelectOption value="1">Yes</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              <BusyLabel busy={busy}>{isEdit ? "Save changes" : "Create account"}</BusyLabel>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
