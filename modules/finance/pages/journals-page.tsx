"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Edit, MoreVertical, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import type { FinanceAccount, FinanceJournal } from "@/modules/finance/types";
import {
  BusyLabel,
  FinanceError,
  FinanceShell,
  FinanceStatus,
  FinanceTable,
  FinanceTableSkeleton,
  financeJournalTypes,
  Money,
  useDebouncedValue,
} from "@/modules/finance/pages/components/finance-shell";

export default function FinanceJournalsPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editJournalId, setEditJournalId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canCreate = hasAnyPermission(["manage_finance", "create_journals"]);
  const canPost = hasAnyPermission(["manage_finance", "post_journals"]);
  const canReverse = hasAnyPermission(["manage_finance", "reverse_journals"]);
  const query = useQuery({
    queryKey: ["finance", "journals", search, statusFilter, typeFilter],
    queryFn: () => financeApi.journals({ search: search || undefined, status: statusFilter || undefined, type: typeFilter || undefined, per_page: 100 }),
  });
  const accounts = useQuery({ queryKey: ["finance", "account-options"], queryFn: () => financeApi.accounts({ active: true, per_page: 200 }) });
  const create = useMutation({
    mutationFn: financeApi.createJournal,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance"] });
      setOpen(false);
      toast.success("Journal created.");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Journal could not be created.")),
  });

  const editQuery = useQuery({
    queryKey: ["finance", "journals", "edit", editJournalId],
    enabled: editOpen && editJournalId !== null,
    queryFn: () => financeApi.getJournal(editJournalId!),
  });

  const edit = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      financeApi.updateJournal(id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance"] });
      setEditOpen(false);
      setEditJournalId(null);
      setBusyId(null);
      toast.success("Draft journal updated.");
    },
    onError: (error) => { toast.error(getErrorMessage(error, "Draft journal could not be updated.")); setBusyId(null); },
  });

  const action = useMutation({
    mutationFn: ({ journal, action }: { journal: FinanceJournal; action: "post" | "reverse" }) => financeApi.journalAction(journal.id, action),
    onMutate: ({ journal }) => setBusyId(journal.id),
    onSuccess: async (_, variables) => {
      await client.invalidateQueries({ queryKey: ["finance"] });
      toast.success(variables.action === "post" ? "Journal posted." : "Reversal journal posted.");
      setBusyId(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "The journal action could not be completed."));
      setBusyId(null);
    },
  });

  const anyBusy = busyId !== null;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailJournalId, setDetailJournalId] = useState<number | null>(null);
  const detailQuery = useQuery({
    queryKey: ["finance", "journals", "detail", detailJournalId],
    enabled: detailOpen && detailJournalId !== null,
    queryFn: () => financeApi.getJournal(detailJournalId!),
  });

  return (
    <FinanceShell
      title="General journal"
      description="Create balanced entries, review source-module postings, post them into the immutable ledger, and reverse errors without deleting history."
      actions={
        canCreate ? (
          <>
            <JournalDialog open={open} onOpenChange={setOpen} accounts={accounts.data?.data ?? []} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} />
            <JournalEditDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              journal={editQuery.data}
              accounts={accounts.data?.data ?? []}
              busy={edit.isPending}
              onSubmit={(payload) => edit.mutate({ id: editJournalId!, payload })}
            />
          </>
        ) : undefined
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Journal register</CardTitle>
          <CardDescription>Draft entries do not affect reports. Posted entries can only be corrected through an equal and opposite reversal.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="journal-search">Search journals</FieldLabel>
              <Input
                id="journal-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Journal number or memo"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="journal-status-filter">Status</FieldLabel>
              <NativeSelect id="journal-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <NativeSelectOption value="">All statuses</NativeSelectOption>
                <NativeSelectOption value="draft">Draft</NativeSelectOption>
                <NativeSelectOption value="posted">Posted</NativeSelectOption>
                <NativeSelectOption value="reversed">Reversed</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="journal-type-filter">Type</FieldLabel>
              <NativeSelect id="journal-type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <NativeSelectOption value="">All types</NativeSelectOption>
                {financeJournalTypes.map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {query.isPending ? (
            <FinanceTableSkeleton rows={6} cols={8} />
          ) : query.isError ? (
            <FinanceError error={query.error} />
          ) : (
            <FinanceTable<FinanceJournal>
              caption="Journal register, newest accounting date first."
              rows={query.data.data}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailJournalId(row.id);
                setDetailOpen(true);
              }}
              columns={[
                { key: "number", label: "Journal", render: (row) => <div className="flex flex-col gap-1"><span className="font-mono font-medium">{row.number}</span><span className="text-xs text-muted-foreground">{row.memo || row.type}</span></div> },
                { key: "date", label: "Accounting date", render: (row) => row.entry_date },
                { key: "source", label: "Source", render: (row) => row.source_module || "Finance" },
                { key: "lines", label: "Lines", align: "right", render: (row) => row.lines_count ?? row.lines?.length ?? 0 },
                { key: "debit", label: "Debits", align: "right", render: (row) => <Money value={row.debit_total} /> },
                { key: "credit", label: "Credits", align: "right", render: (row) => <Money value={row.credit_total} /> },
                { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
                {
                  key: "action",
                  label: "",
                  align: "right",
                  render: (row) => {
                    const isThisRow = busyId === row.id;
                    const items: Array<{ label: string; icon: React.ReactNode; onClick: () => void }> = [];

                    if (row.status === "draft" && canCreate) {
                      items.push({ label: "Edit", icon: <Edit className="h-4 w-4" />, onClick: () => { setEditJournalId(row.id); setEditOpen(true); } });
                    }
                    if (row.status === "draft" && canPost) {
                      items.push({ label: "Post", icon: <Send className="h-4 w-4" />, onClick: () => action.mutate({ journal: row, action: "post" }) });
                    }
                    if (row.status === "posted" && canReverse) {
                      items.push({ label: "Reverse", icon: <RotateCcw className="h-4 w-4" />, onClick: () => action.mutate({ journal: row, action: "reverse" }) });
                    }

                    if (items.length === 0) return null;

                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={anyBusy}>
                            {isThisRow ? <BusyLabel busy={true}>{" "}</BusyLabel> : <MoreVertical className="h-4 w-4" />}
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {items.map((item) => (
                            <DropdownMenuItem key={item.label} disabled={anyBusy} onClick={item.onClick}>
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

      {/* Journal details (opened by row click) */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setDetailJournalId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Journal details</DialogTitle>
            <DialogDescription>Header + line-level view for this journal.</DialogDescription>
          </DialogHeader>

          {detailQuery.isPending ? (
            <div className="py-4 text-muted-foreground">Loading…</div>
          ) : detailQuery.isError ? (
            <FinanceError error={detailQuery.error} />
          ) : detailQuery.data ? (
            <div className="flex flex-col gap-6 pb-2">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-sm text-muted-foreground">Journal</div>
                  <div className="font-mono font-medium">{detailQuery.data.number}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Accounting date</div>
                  <div className="font-medium">{detailQuery.data.entry_date}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Type</div>
                  <div className="font-medium">{detailQuery.data.type}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <FinanceStatus value={detailQuery.data.status} />
                </div>
              </div>

              {detailQuery.data.memo ? (
                <div>
                  <div className="text-sm text-muted-foreground">Memo</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm">{detailQuery.data.memo}</div>
                </div>
              ) : null}

              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">Line items</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Account</th>
                        <th className="px-3 py-2 text-left font-medium">Description</th>
                        <th className="px-3 py-2 text-right font-medium">Debit</th>
                        <th className="px-3 py-2 text-right font-medium">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailQuery.data.lines ?? []).length ? (
                        detailQuery.data.lines!.map((line) => (
                          <tr key={line.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2">
                              {line.account ? `${line.account.code} · ${line.account.name}` : `#${line.account_id}`}
                            </td>
                            <td className="px-3 py-2">{line.description || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{Number(line.debit) ? <Money value={line.debit} /> : "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{Number(line.credit) ? <Money value={line.credit} /> : "—"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-3 text-muted-foreground" colSpan={4}>
                            No line details available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Debits total</div>
                  <div className="font-medium mt-1">
                    <Money value={detailQuery.data.debit_total} />
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Credits total</div>
                  <div className="font-medium mt-1">
                    <Money value={detailQuery.data.credit_total} />
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

function JournalDialog({ open, onOpenChange, accounts, busy, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; accounts: FinanceAccount[]; busy: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  const [lineIds, setLineIds] = useState([0, 1]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const lines = lineIds.map((lineId) => ({
      account_id: Number(values.get(`account_${lineId}`)),
      description: values.get(`description_${lineId}`) || null,
      debit: Number(values.get(`debit_${lineId}`) || 0),
      credit: Number(values.get(`credit_${lineId}`) || 0),
    }));
    onSubmit({
      entry_date: values.get("entry_date"),
      type: values.get("type") || "general",
      memo: values.get("memo") || null,
      currency: "ETB",
      lines,
      post: values.get("post") === "1",
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button><Plus data-icon="inline-start" aria-hidden="true" />New journal</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Create journal entry</DialogTitle>
            <DialogDescription>Every entry needs at least two lines with non-zero amounts, and total debits must equal total credits. Required fields are marked.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="journal-date">Accounting date (required)</FieldLabel>
                <Input id="journal-date" name="entry_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="journal-type">Journal type</FieldLabel>
                <NativeSelect id="journal-type" name="type" defaultValue="general" className="bg-background">
                  {financeJournalTypes.map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="journal-memo">Memo</FieldLabel>
              <Input id="journal-memo" name="memo" />
              <FieldDescription>Describe the business event and evidence behind this entry.</FieldDescription>
            </Field>
            <FieldSet>
              <FieldLegend>Journal lines (required)</FieldLegend>
              <div className="flex flex-col gap-4">
                {lineIds.map((lineId, index) => (
                  <Card key={lineId}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle>Line {index + 1}</CardTitle>
                        {lineIds.length > 2 ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setLineIds((current) => current.filter((id) => id !== lineId))}>
                            <Trash2 data-icon="inline-start" aria-hidden="true" />Remove
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor={`journal-account-${lineId}`}>Account (required)</FieldLabel>
                        <NativeSelect id={`journal-account-${lineId}`} name={`account_${lineId}`} required defaultValue="" className="bg-background">
                          <NativeSelectOption value="" disabled>Select an account</NativeSelectOption>
                          {accounts.map((account) => <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>)}
                        </NativeSelect>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`journal-description-${lineId}`}>Line description</FieldLabel>
                        <Input id={`journal-description-${lineId}`} name={`description_${lineId}`} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`journal-debit-${lineId}`}>Debit</FieldLabel>
                        <Input id={`journal-debit-${lineId}`} name={`debit_${lineId}`} type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`journal-credit-${lineId}`}>Credit</FieldLabel>
                        <Input id={`journal-credit-${lineId}`} name={`credit_${lineId}`} type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" />
                      </Field>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={() => setLineIds((current) => [...current, Math.max(...current) + 1])}>
                <Plus data-icon="inline-start" aria-hidden="true" />Add line
              </Button>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="journal-post">Posting behavior</FieldLabel>
              <NativeSelect id="journal-post" name="post" defaultValue="0" className="bg-background">
                <NativeSelectOption value="0">Save as draft for review</NativeSelectOption>
                <NativeSelectOption value="1">Post immediately</NativeSelectOption>
              </NativeSelect>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || accounts.length === 0}><BusyLabel busy={busy}>Create journal</BusyLabel></Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type EditableJournalLine = {
  id: string;
  account_id: number | "";
  description: string;
  debit: string;
  credit: string;
};

function JournalEditDialog({
  open,
  onOpenChange,
  journal,
  accounts,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journal?: FinanceJournal;
  accounts: FinanceAccount[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [entryDate, setEntryDate] = useState<string>("");
  const [type, setType] = useState<string>("general");
  const [memo, setMemo] = useState<string>("");
  const [lines, setLines] = useState<EditableJournalLine[]>([]);

  useEffect(() => {
    if (!open || !journal) return;

    const raw = journal.entry_date;
    // Backend returns `Y-m-d` most of the time, but normalize defensively so
    // `<input type="date">` always gets `YYYY-MM-DD`.
    setEntryDate(typeof raw === "string" ? raw.slice(0, 10) : "");
    setType(journal.type ?? "general");
    setMemo(journal.memo ?? "");

    const nextLines =
      (journal.lines ?? []).map((line) => ({
        id: String(line.id),
        account_id: line.account_id,
        description: line.description ?? "",
        debit: String(line.debit ?? "0"),
        credit: String(line.credit ?? "0"),
      })) ?? [];

    setLines(nextLines.length >= 2 ? nextLines : nextLines.length ? nextLines : [
      { id: "0", account_id: "", description: "", debit: "0", credit: "0" },
      { id: "1", account_id: "", description: "", debit: "0", credit: "0" },
    ]);
  }, [open, journal]);

  const canSave = lines.length >= 2 && lines.every((l) => l.account_id !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {!journal ? (
          <div className="p-4">
            <FinanceTableSkeleton rows={6} cols={7} />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSave) return;

              onSubmit({
                entry_date: entryDate,
                type,
                memo: memo || null,
                lines: lines.map((l) => ({
                  account_id: Number(l.account_id),
                  description: l.description || null,
                  debit: Number(l.debit || 0),
                  credit: Number(l.credit || 0),
                })),
              });
            }}
            className="flex flex-col gap-5"
          >
            <DialogHeader>
              <DialogTitle>Edit draft journal</DialogTitle>
              <DialogDescription>
                Adjust line amounts and details, then click <b>Post</b> again.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="edit-journal-date">Accounting date (required)</FieldLabel>
                  <Input id="edit-journal-date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} type="date" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-journal-type">Journal type</FieldLabel>
                  <NativeSelect id="edit-journal-type" value={type} onChange={(e) => setType(e.target.value)} className="bg-background">
                    {financeJournalTypes.map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="edit-journal-memo">Memo</FieldLabel>
                <Input id="edit-journal-memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
              </Field>

              <FieldSet>
                <FieldLegend>Journal lines (required)</FieldLegend>

                <div className="flex flex-col gap-4">
                  {lines.map((line, index) => (
                    <Card key={line.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle>Line {index + 1}</CardTitle>
                          {lines.length > 2 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setLines((current) => current.filter((l) => l.id !== line.id))}
                            >
                              <Trash2 data-icon="inline-start" aria-hidden="true" />
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </CardHeader>

                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor={`edit-journal-account-${line.id}`}>Account (required)</FieldLabel>
                          <NativeSelect
                            id={`edit-journal-account-${line.id}`}
                            value={line.account_id === "" ? "" : String(line.account_id)}
                            onChange={(e) => setLines((current) => current.map((l) => (l.id === line.id ? { ...l, account_id: e.target.value ? Number(e.target.value) : "" } : l)))}
                            className="bg-background"
                          >
                            <NativeSelectOption value="" disabled>Select an account</NativeSelectOption>
                            {accounts.map((account) => (
                              <NativeSelectOption key={account.id} value={String(account.id)}>
                                {account.code} · {account.name}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </Field>

                        <Field>
                          <FieldLabel htmlFor={`edit-journal-description-${line.id}`}>Line description</FieldLabel>
                          <Input
                            id={`edit-journal-description-${line.id}`}
                            value={line.description}
                            onChange={(e) => setLines((current) => current.map((l) => (l.id === line.id ? { ...l, description: e.target.value } : l)))}
                          />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor={`edit-journal-debit-${line.id}`}>Debit</FieldLabel>
                          <Input
                            id={`edit-journal-debit-${line.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={line.debit}
                            onChange={(e) => setLines((current) => current.map((l) => (l.id === line.id ? { ...l, debit: e.target.value } : l)))}
                          />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor={`edit-journal-credit-${line.id}`}>Credit</FieldLabel>
                          <Input
                            id={`edit-journal-credit-${line.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={line.credit}
                            onChange={(e) => setLines((current) => current.map((l) => (l.id === line.id ? { ...l, credit: e.target.value } : l)))}
                          />
                        </Field>
                      </CardContent>
                    </Card>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setLines((current) => [
                        ...current,
                        {
                          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                          account_id: "",
                          description: "",
                          debit: "0",
                          credit: "0",
                        },
                      ])
                    }
                  >
                    <Plus data-icon="inline-start" aria-hidden="true" />
                    Add line
                  </Button>
                </div>
              </FieldSet>
            </FieldGroup>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !canSave}>
                <BusyLabel busy={busy}>Save draft</BusyLabel>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
