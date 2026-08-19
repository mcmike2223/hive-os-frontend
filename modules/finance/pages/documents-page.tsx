"use client";

import { useState, type FormEvent } from "react";
import { Ban, Check, Download, Edit, MoreVertical, Plus, Send, Trash2, WalletCards } from "lucide-react";
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
import api from "@/modules/shared/api/http";
import { financeApi } from "@/modules/finance/api";
import type { FinanceAccount, FinanceContact, FinanceDocument } from "@/modules/finance/types";
import { BusyLabel, FinanceError, FinanceShell, FinanceStatus, FinanceTable, FinanceTableSkeleton, Money, useDebouncedValue } from "@/modules/finance/pages/components/finance-shell";

const types = {
  sales: [["sales_quote", "Sales quote"], ["sales_order", "Sales order"], ["sales_invoice", "Sales invoice"], ["customer_receipt", "Customer receipt"], ["credit_note", "Credit note"]],
  purchases: [["purchase_order", "Purchase order"], ["purchase_bill", "Purchase bill"], ["vendor_payment", "Vendor payment"], ["expense", "Expense"], ["debit_note", "Debit note"]],
} as const;

export default function FinanceDocumentsPage({ group }: { group: "sales" | "purchases" }) {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<FinanceDocument | null>(null);
  const [detailDocId, setDetailDocId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinanceDocument | null>(null);
  const [paying, setPaying] = useState<FinanceDocument | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", group === "sales" ? "manage_sales" : "manage_purchases"]);
  const canApprove = hasAnyPermission(["manage_finance", group === "sales" ? "approve_sales" : "approve_purchases"]);
  const canPay = hasAnyPermission(["manage_finance", "record_finance_payments"]);

  const query = useQuery({ queryKey: ["finance", "documents", group, search, statusFilter, typeFilter], queryFn: () => financeApi.documents({ group, search: search || undefined, status: statusFilter || undefined, type: typeFilter || undefined, per_page: 100 }) });
  const contacts = useQuery({ queryKey: ["finance", "document-contacts", group], queryFn: () => financeApi.contacts({ type: group === "sales" ? "customer" : "vendor", active: true, per_page: 200 }) });
  const accounts = useQuery({ queryKey: ["finance", "document-accounts"], queryFn: () => financeApi.accounts({ active: true, per_page: 200 }) });
  const detailQuery = useQuery({
    queryKey: ["finance", "documents", "detail", detailDocId],
    enabled: detailOpen && detailDocId !== null,
    queryFn: () => financeApi.getDocument(detailDocId!),
  });

  const create = useMutation({
    mutationFn: financeApi.createDocument,
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance"] }); setCreateOpen(false); toast.success("Financial document created."); },
    onError: (error) => toast.error(getErrorMessage(error, "The document could not be created.")),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => financeApi.updateDocument(id, payload),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance"] }); setEditDoc(null); setBusyId(null); toast.success("Document updated."); },
    onError: (error) => { toast.error(getErrorMessage(error, "The document could not be updated.")); setBusyId(null); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => financeApi.deleteDocument(id),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance"] }); setDeleteTarget(null); setBusyId(null); toast.success("Document deleted."); },
    onError: (error) => { toast.error(getErrorMessage(error, "The document could not be deleted.")); setDeleteTarget(null); setBusyId(null); },
  });

  const action = useMutation({
    mutationFn: ({ document, action, payload = {} }: { document: FinanceDocument; action: "approve" | "post" | "pay" | "void"; payload?: Record<string, unknown> }) => financeApi.documentAction(document.id, action, payload),
    onMutate: ({ document }) => setBusyId(document.id),
    onSuccess: async (_, variables) => { await client.invalidateQueries({ queryKey: ["finance"] }); setPaying(null); setBusyId(null); toast.success(`Document ${variables.action === "pay" ? "payment recorded" : `${variables.action}ed`}.`); },
    onError: (error) => {
      const msg = getErrorMessage(error, "The document action could not be completed.");
      // Backend throws this from the journal/ledger layer during "post".
      if (msg.toLowerCase().includes("non-zero lines") || msg.toLowerCase().includes("non zero lines")) {
        toast.error("Posting a document creates journal entries automatically. This document total is 0, so the system cannot create any non-zero journal lines. Enter non-zero Unit price/Quantity on the lines, then approve and try again.");
      } else {
        toast.error(msg);
      }
      setBusyId(null);
    },
  });

  async function download(doc: FinanceDocument) {
    setBusyId(doc.id);
    try {
      const response = await api.get(`/finance/documents/${doc.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${doc.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("The PDF could not be downloaded.");
    } finally {
      setBusyId(null);
    }
  }

  const anyBusy = busyId !== null;
  const contactList = contacts.data?.data ?? [];
  const accountList = accounts.data?.data ?? [];
  const title = group === "sales" ? "Sales and receivables" : "Purchases and payables";
  const description = group === "sales" ? "Move quotes and orders into tax-ready invoices, receipts, credit notes, and receivable settlements." : "Control purchase orders, supplier bills, expenses, debit notes, and payable settlements.";

  return (
    <FinanceShell title={title} description={description} actions={canManage ? <DocumentFormDialog mode="create" group={group} open={createOpen} onOpenChange={setCreateOpen} contacts={contactList} accounts={accountList} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} /> : undefined}>
      <Card>
        <CardHeader><CardTitle>{group === "sales" ? "Sales document register" : "Purchase document register"}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field><FieldLabel htmlFor="doc-search">Search</FieldLabel><Input id="doc-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Document number or reference" /></Field>
            <Field><FieldLabel htmlFor="doc-status-filter">Status</FieldLabel><NativeSelect id="doc-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><NativeSelectOption value="">All statuses</NativeSelectOption><NativeSelectOption value="draft">Draft</NativeSelectOption><NativeSelectOption value="approved">Approved</NativeSelectOption><NativeSelectOption value="posted">Posted</NativeSelectOption><NativeSelectOption value="partially_paid">Partially paid</NativeSelectOption><NativeSelectOption value="paid">Paid</NativeSelectOption><NativeSelectOption value="voided">Voided</NativeSelectOption></NativeSelect></Field>
            <Field><FieldLabel htmlFor="doc-type-filter">Document type</FieldLabel><NativeSelect id="doc-type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><NativeSelectOption value="">All types</NativeSelectOption>{types[group].map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></Field>
          </div>
          {query.isPending ? <FinanceTableSkeleton rows={6} cols={7} /> : query.isError ? <FinanceError error={query.error} /> : (
            <FinanceTable<FinanceDocument>
              caption={`${title} documents, newest first.`}
              rows={query.data.data}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailDocId(row.id);
                setDetailOpen(true);
              }}
              columns={[
        { key: "number", label: "Document", render: (row) => <div className="flex flex-col gap-1"><span className="font-mono font-medium">{row.number}</span><span className="text-xs text-muted-foreground">{row.type.replaceAll("_", " ")}</span></div> },
        { key: "contact", label: group === "sales" ? "Customer" : "Vendor", render: (row) => row.contact?.name || "Not assigned" },
        { key: "date", label: "Date", render: (row) => row.document_date },
        { key: "total", label: "Total", align: "right", render: (row) => <Money value={row.total} currency={row.currency} /> },
        { key: "balance", label: "Balance", align: "right", render: (row) => <Money value={Number(row.total) - Number(row.paid_amount)} currency={row.currency} /> },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
                { key: "actions", label: "", align: "right", render: (row) => {
                  const isThisRow = busyId === row.id;
                  const items: Array<{ label: string; icon: React.ReactNode; onClick: () => void; variant?: "destructive" }> = [];

                  if (row.status === "draft" && canManage) {
                    items.push({ label: "Edit", icon: <Edit className="h-4 w-4" />, onClick: () => setEditDoc(row) });
                  }
                  if (row.status === "draft" && canApprove) {
                    items.push({ label: "Approve", icon: <Check className="h-4 w-4" />, onClick: () => action.mutate({ document: row, action: "approve" }) });
                  }
                  if (row.status === "approved" && canApprove) {
                    items.push({
                      label: "Post",
                      icon: <Send className="h-4 w-4" />,
                      onClick: () => {
                        const total = Number(row.total);
                        if (!Number.isFinite(total) || total <= 0) {
                          toast.error("Posting requires non-zero line amounts. Check Unit price/Quantity in the document (total is 0), then create a new Draft and post it.");
                          return;
                        }
                        action.mutate({ document: row, action: "post" });
                      },
                    });
                  }
                  if (["posted", "partially_paid"].includes(row.status) && canPay && ["sales_invoice", "purchase_bill"].includes(row.type)) {
                    items.push({ label: "Record payment", icon: <WalletCards className="h-4 w-4" />, onClick: () => setPaying(row) });
                  }
                  items.push({ label: "Download PDF", icon: <Download className="h-4 w-4" />, onClick: () => download(row) });
                  if (!["draft", "voided"].includes(row.status) && canApprove) {
                    items.push({ label: "Void", icon: <Ban className="h-4 w-4" />, onClick: () => action.mutate({ document: row, action: "void" }), variant: "destructive" });
                  }
                  if (row.status === "draft" && canManage) {
                    items.push({ label: "Delete", icon: <Trash2 className="h-4 w-4" />, onClick: () => setDeleteTarget(row), variant: "destructive" });
                  }

                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={anyBusy}>
                          {isThisRow ? <BusyLabel busy={true}>{" "}</BusyLabel> : <MoreVertical className="h-4 w-4" />}
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {items.map((item, i) => {
                          const needsSeparator = item.variant === "destructive" && i > 0;
                          return (
                            <span key={item.label}>
                              {needsSeparator && <DropdownMenuSeparator />}
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

      {/* Edit dialog */}
      <DocumentFormDialog
        key={editDoc?.id ?? "none"}
        mode="edit"
        group={group}
        open={editDoc !== null}
        onOpenChange={(open) => { if (!open) setEditDoc(null); }}
        contacts={contactList}
        accounts={accountList}
        busy={update.isPending}
        document={editDoc}
        onSubmit={(payload) => editDoc && update.mutate({ id: editDoc.id, payload })}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>Are you sure you want to delete &ldquo;{deleteTarget?.number}&rdquo;? Only draft documents can be deleted. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => { if (deleteTarget) { setBusyId(deleteTarget.id); remove.mutate(deleteTarget.id); } }}>
              <BusyLabel busy={remove.isPending}>Delete</BusyLabel>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <PaymentDialog document={paying} accounts={accountList.filter((a) => a.is_bank)} busy={action.isPending} onOpenChange={(next) => { if (!next) setPaying(null); }} onSubmit={(payload) => { if (paying) action.mutate({ document: paying, action: "pay", payload }); }} />

      {/* Details dialog */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setDetailDocId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Document details</DialogTitle>
            <DialogDescription>View posting and settlement context for this document.</DialogDescription>
          </DialogHeader>

          {detailQuery.isPending ? (
            <div className="py-4 text-muted-foreground">Loading…</div>
          ) : detailQuery.isError ? (
            <FinanceError error={detailQuery.error} />
          ) : detailQuery.data ? (
            <div className="flex flex-col gap-6 pb-2">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><div className="text-sm text-muted-foreground">Document</div><div className="font-mono font-medium">{detailQuery.data.number}</div></div>
                <div><div className="text-sm text-muted-foreground">Type</div><div className="font-medium">{detailQuery.data.type.replaceAll("_", " ")}</div></div>
                <div><div className="text-sm text-muted-foreground">Status</div><div><FinanceStatus value={detailQuery.data.status} /></div></div>
                <div><div className="text-sm text-muted-foreground">Date</div><div className="font-medium">{detailQuery.data.document_date}</div></div>
                <div><div className="text-sm text-muted-foreground">Contact</div><div className="font-medium">{detailQuery.data.contact?.name || "Not assigned"}</div></div>
                <div><div className="text-sm text-muted-foreground">Bank account</div><div className="font-medium">{detailQuery.data.bankAccount ? `${detailQuery.data.bankAccount.code} · ${detailQuery.data.bankAccount.name}` : "System default / not set"}</div></div>
                <div><div className="text-sm text-muted-foreground">Total</div><div className="font-medium"><Money value={detailQuery.data.total} currency={detailQuery.data.currency} /></div></div>
                <div><div className="text-sm text-muted-foreground">Paid</div><div className="font-medium"><Money value={detailQuery.data.paid_amount} currency={detailQuery.data.currency} /></div></div>
              </div>

              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">Document lines</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Description</th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-right font-medium">Unit price</th>
                        <th className="px-3 py-2 text-right font-medium">Tax %</th>
                        <th className="px-3 py-2 text-right font-medium">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQuery.data.items.map((line, index) => (
                        <tr key={index} className="border-b last:border-b-0">
                          <td className="px-3 py-2">{line.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{Number(line.unit_price).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{line.tax_rate ?? 0}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{Number(line.line_total ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">Posting journal</div>
                {!detailQuery.data.journal?.lines?.length ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No posted journal lines yet.</div>
                ) : (
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
                        {detailQuery.data.journal.lines.map((line) => (
                          <tr key={line.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2">{line.account ? `${line.account.code} · ${line.account.name}` : line.account_id}</td>
                            <td className="px-3 py-2">{line.description || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{Number(line.debit).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{Number(line.credit).toFixed(2)}</td>
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

function DocumentFormDialog({ mode, group, open, onOpenChange, contacts, accounts, busy, onSubmit, document: doc }: {
  mode: "create" | "edit";
  group: "sales" | "purchases";
  open: boolean;
  onOpenChange: (value: boolean) => void;
  contacts: FinanceContact[];
  accounts: FinanceAccount[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  document?: FinanceDocument | null;
}) {
  const [lineIds, setLineIds] = useState<number[]>(() => doc?.items?.length ? doc.items.map((_, i) => i) : [0]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const items = lineIds.map((id) => ({
      description: values.get(`description_${id}`),
      quantity: Number(values.get(`quantity_${id}`) || 1),
      unit_price: Number(values.get(`unit_price_${id}`) || 0),
      discount: Number(values.get(`discount_${id}`) || 0),
      tax_rate: Number(values.get(`tax_rate_${id}`) || 0),
      account_id: values.get(`account_${id}`) ? Number(values.get(`account_${id}`)) : undefined,
    }));
    onSubmit({
      type: values.get("type"),
      contact_id: values.get("contact_id") ? Number(values.get("contact_id")) : null,
      document_date: values.get("document_date"),
      due_date: values.get("due_date") || null,
      currency: values.get("currency") || "ETB",
      bank_account_id: values.get("bank_account_id") ? Number(values.get("bank_account_id")) : null,
      reference: values.get("reference") || null,
      goods_receipt_reference: values.get("goods_receipt_reference") || null,
      tax_invoice_type: values.get("tax_invoice_type") || "standard",
      supply_category: values.get("supply_category") || "goods",
      payment_method: values.get("payment_method") || null,
      notes: values.get("notes") || null,
      items,
    });
  }

  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v && !isEdit) setLineIds([0]); onOpenChange(v); }}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button><Plus data-icon="inline-start" aria-hidden="true" />New document</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit document" : `Create ${group === "sales" ? "sales" : "purchase"} document`}</DialogTitle>
            <DialogDescription>{isEdit ? "Update draft document details. Only draft documents can be edited." : "Totals and VAT are calculated by the server from the line details. Required fields are marked."}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="document-type">Document type (required)</FieldLabel>
                <NativeSelect id="document-type" name="type" required defaultValue={doc?.type ?? types[group][0][0]}>
                  {types[group].map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="document-contact">{group === "sales" ? "Customer" : "Vendor"}</FieldLabel>
                <NativeSelect id="document-contact" name="contact_id" defaultValue={doc?.contact_id ? String(doc.contact_id) : ""}>
                  <NativeSelectOption value="">Not assigned</NativeSelectOption>
                  {contacts.map((c) => <NativeSelectOption key={c.id} value={String(c.id)}>{c.code} · {c.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="document-date">Document date (required)</FieldLabel>
                <Input id="document-date" name="document_date" type="date" required defaultValue={doc?.document_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="document-due">Due date</FieldLabel>
                <Input id="document-due" name="due_date" type="date" defaultValue={doc?.due_date?.slice(0, 10) ?? ""} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field><FieldLabel htmlFor="document-reference">Reference</FieldLabel><Input id="document-reference" name="reference" defaultValue={doc?.reference ?? ""} /></Field>
              <Field><FieldLabel htmlFor="document-currency">Currency</FieldLabel><Input id="document-currency" name="currency" defaultValue={doc?.currency ?? "ETB"} maxLength={3} /></Field>
              <Field>
                <FieldLabel htmlFor="document-bank">Cash or bank account</FieldLabel>
                <NativeSelect id="document-bank" name="bank_account_id" defaultValue="">
                  <NativeSelectOption value="">Use system default</NativeSelectOption>
                  {accounts.filter((a) => a.is_bank).map((a) => <NativeSelectOption key={a.id} value={String(a.id)}>{a.code} · {a.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="document-tax-invoice-type">Tax invoice type</FieldLabel>
                <NativeSelect id="document-tax-invoice-type" name="tax_invoice_type" defaultValue={doc?.tax_invoice_type ?? "standard"}>
                  <NativeSelectOption value="standard">Standard tax invoice</NativeSelectOption>
                  <NativeSelectOption value="simplified">Simplified cash or retail invoice</NativeSelectOption>
                  <NativeSelectOption value="recipient_created">Recipient-created invoice</NativeSelectOption>
                  <NativeSelectOption value="reverse_charge">Reverse-charge invoice</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="document-supply-category">Supply category</FieldLabel>
                <NativeSelect id="document-supply-category" name="supply_category" defaultValue={doc?.supply_category ?? "goods"}>
                  <NativeSelectOption value="goods">Goods</NativeSelectOption>
                  <NativeSelectOption value="services">Services</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="document-payment-method">Expected payment method</FieldLabel>
                <NativeSelect id="document-payment-method" name="payment_method" defaultValue={doc?.payment_method ?? "bank_transfer"}>
                  <NativeSelectOption value="bank_transfer">Bank transfer</NativeSelectOption>
                  <NativeSelectOption value="account_payee_cheque">Account-payee cheque</NativeSelectOption>
                  <NativeSelectOption value="nbe_authorized">NBE-authorized payment</NativeSelectOption>
                  <NativeSelectOption value="cash">Cash</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="document-goods-receipt">Goods receipt reference</FieldLabel>
                <Input id="document-goods-receipt" name="goods_receipt_reference" />
                <FieldDescription>Required with a purchase-order reference for three-way matching.</FieldDescription>
              </Field>
            </div>
            <FieldSet>
              <FieldLegend>Document lines (required)</FieldLegend>
              <FieldDescription>Add item descriptions, quantities, unit prices, discounts, and VAT rates. Purchase lines can target a specific expense or inventory account.</FieldDescription>
              <div className="flex flex-col gap-4">
                {lineIds.map((id, index) => {
                  const line = doc?.items?.[id];
                  return (
                    <Card key={id}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle>Line {index + 1}</CardTitle>
                          {lineIds.length > 1 ? <Button type="button" variant="ghost" size="sm" onClick={() => setLineIds((cur) => cur.filter((v) => v !== id))}><Trash2 data-icon="inline-start" aria-hidden="true" />Remove</Button> : null}
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                        <Field className="lg:col-span-2"><FieldLabel htmlFor={`document-description-${id}`}>Description (required)</FieldLabel><Input id={`document-description-${id}`} name={`description_${id}`} required defaultValue={line?.description ?? ""} /></Field>
                        <Field><FieldLabel htmlFor={`document-quantity-${id}`}>Quantity</FieldLabel><Input id={`document-quantity-${id}`} name={`quantity_${id}`} type="number" min="0.001" step="0.001" defaultValue={line?.quantity ?? 1} required /></Field>
                        <Field><FieldLabel htmlFor={`document-price-${id}`}>Unit price</FieldLabel><Input id={`document-price-${id}`} name={`unit_price_${id}`} type="number" min="0" step="0.01" defaultValue={line?.unit_price ?? 0} required /></Field>
                        <Field><FieldLabel htmlFor={`document-discount-${id}`}>Discount</FieldLabel><Input id={`document-discount-${id}`} name={`discount_${id}`} type="number" min="0" step="0.01" defaultValue={line?.discount ?? 0} /></Field>
                        <Field><FieldLabel htmlFor={`document-tax-${id}`}>VAT %</FieldLabel><Input id={`document-tax-${id}`} name={`tax_rate_${id}`} type="number" min="0" max="100" step="0.01" defaultValue={line?.tax_rate ?? 0} /></Field>
                        {group === "purchases" ? (
                          <Field className="lg:col-span-3">
                            <FieldLabel htmlFor={`document-account-${id}`}>Posting account</FieldLabel>
                            <NativeSelect id={`document-account-${id}`} name={`account_${id}`} defaultValue={line?.account_id ? String(line.account_id) : ""}>
                              <NativeSelectOption value="">Operating expense default</NativeSelectOption>
                              {accounts.filter((a) => ["asset", "expense"].includes(a.type)).map((a) => <NativeSelectOption key={a.id} value={String(a.id)}>{a.code} · {a.name}</NativeSelectOption>)}
                            </NativeSelect>
                          </Field>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Button type="button" variant="outline" onClick={() => setLineIds((cur) => [...cur, Math.max(...cur) + 1])}>
                <Plus data-icon="inline-start" aria-hidden="true" />Add line
              </Button>
            </FieldSet>
            <Field><FieldLabel htmlFor="document-notes">Notes</FieldLabel><Input id="document-notes" name="notes" defaultValue="" /></Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              <BusyLabel busy={busy}>{isEdit ? "Save changes" : "Create document"}</BusyLabel>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ document, accounts, busy, onOpenChange, onSubmit }: { document: FinanceDocument | null; accounts: FinanceAccount[]; busy: boolean; onOpenChange: (open: boolean) => void; onSubmit: (payload: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({ amount: Number(values.get("amount")), bank_account_id: Number(values.get("bank_account_id")), payment_method: values.get("payment_method") || "bank_transfer" });
  }
  const remaining = document ? Number(document.total) - Number(document.paid_amount) : 0;
  return (
    <Dialog open={Boolean(document)} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>Apply a payment to {document?.number}. The remaining balance is <Money value={remaining} currency={document?.currency} />. Cash above the configured Ethiopian limit is blocked.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field><FieldLabel htmlFor="payment-amount">Payment amount (required)</FieldLabel><Input id="payment-amount" name="amount" type="number" min="0.01" max={remaining} step="0.01" defaultValue={remaining} required autoFocus /></Field>
            <Field>
              <FieldLabel htmlFor="payment-bank">Cash or bank account (required)</FieldLabel>
              <NativeSelect id="payment-bank" name="bank_account_id" required defaultValue="">
                <NativeSelectOption value="" disabled>Select an account</NativeSelectOption>
                {accounts.map((a) => <NativeSelectOption key={a.id} value={String(a.id)}>{a.code} · {a.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-method">Payment method (required)</FieldLabel>
              <NativeSelect id="payment-method" name="payment_method" required defaultValue={document?.payment_method ?? "bank_transfer"}>
                <NativeSelectOption value="bank_transfer">Bank transfer</NativeSelectOption>
                <NativeSelectOption value="account_payee_cheque">Account-payee cheque</NativeSelectOption>
                <NativeSelectOption value="nbe_authorized">NBE-authorized payment</NativeSelectOption>
                <NativeSelectOption value="cash">Cash</NativeSelectOption>
              </NativeSelect>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || accounts.length === 0}><BusyLabel busy={busy}>Record payment</BusyLabel></Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
