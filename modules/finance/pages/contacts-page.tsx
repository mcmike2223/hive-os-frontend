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
import type { FinanceContact } from "@/modules/finance/types";
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

export default function FinanceContactsPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editContact, setEditContact] = useState<FinanceContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceContact | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<number | null>(null);

  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "manage_finance_contacts"]);

  const query = useQuery({
    queryKey: ["finance", "contacts", search, typeFilter, activeFilter],
    queryFn: () => financeApi.contacts({ search: search || undefined, type: typeFilter || undefined, active: activeFilter === "" ? undefined : activeFilter === "true", per_page: 100 }),
  });

  const detailQuery = useQuery({
    queryKey: ["finance", "contacts", "detail", detailContactId],
    enabled: detailOpen && detailContactId !== null,
    queryFn: () => financeApi.getContact(detailContactId!),
  });

  const create = useMutation({
    mutationFn: financeApi.createContact,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "contacts"] });
      await client.invalidateQueries({ queryKey: ["finance", "contacts", "detail"] });
      setCreateOpen(false);
      toast.success("Contact created.");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Contact could not be created.")),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => financeApi.updateContact(id, payload),
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "contacts"] });
      await client.invalidateQueries({ queryKey: ["finance", "contacts", "detail"] });
      setEditContact(null);
      setBusyId(null);
      toast.success("Contact updated.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Contact could not be updated."));
      setBusyId(null);
    },
  });

  const toggle = useMutation({
    mutationFn: ({ contact, active }: { contact: FinanceContact; active: boolean }) => financeApi.updateContact(contact.id, { ...contact, is_active: active }),
    onMutate: ({ contact }) => setBusyId(contact.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "contacts"] });
      await client.invalidateQueries({ queryKey: ["finance", "contacts", "detail"] });
      toast.success("Contact status updated.");
      setBusyId(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Contact status could not be updated."));
      setBusyId(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => financeApi.deleteContact(id),
    onMutate: (id) => setBusyId(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "contacts"] });
      await client.invalidateQueries({ queryKey: ["finance", "contacts", "detail"] });
      setDeleteTarget(null);
      setBusyId(null);
      toast.success("Contact deleted.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Contact could not be deleted."));
      setDeleteTarget(null);
      setBusyId(null);
    },
  });

  const anyBusy = busyId !== null;

  return (
    <FinanceShell
      title="Customers and vendors"
      description="Keep shared receivable and payable profiles, payment terms, tax identifiers, credit controls, and contact details in one register."
      actions={
        canManage ? (
          <ContactFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} />
        ) : undefined
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Financial contact register</CardTitle>
          <CardDescription>A contact can be a customer, vendor, or both. Posted history remains attached if the contact is deactivated.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="finance-contact-search">Search contacts</FieldLabel>
              <Input id="finance-contact-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name, code, or tax ID" />
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-type-filter">Relationship</FieldLabel>
              <NativeSelect id="contact-type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <NativeSelectOption value="">All</NativeSelectOption>
                <NativeSelectOption value="customer">Customer</NativeSelectOption>
                <NativeSelectOption value="vendor">Vendor</NativeSelectOption>
                <NativeSelectOption value="both">Customer and vendor</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-active-filter">Status</FieldLabel>
              <NativeSelect id="contact-active-filter" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <NativeSelectOption value="">All</NativeSelectOption>
                <NativeSelectOption value="true">Active only</NativeSelectOption>
                <NativeSelectOption value="false">Inactive only</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>
          {query.isPending ? (
            <FinanceTableSkeleton rows={6} cols={7} />
          ) : query.isError ? (
            <FinanceError error={query.error} />
          ) : (
            <FinanceTable<FinanceContact>
              caption="Customers and vendors ordered alphabetically."
              rows={query.data.data}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailContactId(row.id);
                setDetailOpen(true);
              }}
              columns={[
                { key: "code", label: "Code", render: (row) => <span className="font-mono font-medium">{row.code}</span> },
                {
                  key: "name",
                  label: "Contact",
                  render: (row) => (
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-xs text-muted-foreground">{row.email || row.phone || "No contact detail"}</span>
                    </div>
                  ),
                },
                { key: "type", label: "Relationship", render: (row) => <FinanceStatus value={row.type} /> },
                { key: "terms", label: "Terms", render: (row) => `${row.payment_terms_days} day(s)` },
                { key: "limit", label: "Credit limit", align: "right", render: (row) => <Money value={row.credit_limit} currency={row.currency} /> },
                { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.is_active ? "active" : "inactive"} /> },
                {
                  key: "action",
                  label: "Action",
                  align: "right",
                  render: (row) => {
                    if (!canManage) return <span className="text-muted-foreground">View only</span>;
                    const isThisRow = busyId === row.id;

                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={anyBusy}>
                            {isThisRow ? <BusyLabel busy={true}>{""}</BusyLabel> : <MoreVertical className="h-4 w-4" />}
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem disabled={anyBusy} onClick={() => setEditContact(row)}>
                            <Edit className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={anyBusy} onClick={() => toggle.mutate({ contact: row, active: !row.is_active })}>
                            <Power className="h-4 w-4" />
                            {row.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={anyBusy}
                            onClick={() => setDeleteTarget(row)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
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

      {/* Edit dialog */}
      <ContactFormDialog
        key={editContact?.id ?? "none"}
        mode="edit"
        open={editContact !== null}
        onOpenChange={(open) => {
          if (!open) setEditContact(null);
        }}
        busy={update.isPending}
        contact={editContact}
        onSubmit={(payload) => editContact && update.mutate({ id: editContact.id, payload })}
      />

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.code} &middot; {deleteTarget?.name}&rdquo;? This cannot be undone. If the contact has documents, it can&apos;t be deleted. In that case, you can deactivate the contact instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
            >
              <BusyLabel busy={remove.isPending}>Delete</BusyLabel>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact details (opened by row click) */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setDetailContactId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Contact details</DialogTitle>
            <DialogDescription>Receivable/payable mapping and recent document activity.</DialogDescription>
          </DialogHeader>

          {detailQuery.isPending ? (
            <div className="py-4 text-muted-foreground">Loading…</div>
          ) : detailQuery.isError ? (
            <FinanceError error={detailQuery.error} />
          ) : detailQuery.data ? (
            <div className="flex flex-col gap-6 pb-2">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground">Code</div>
                  <div className="font-mono font-medium">{detailQuery.data.code}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div className="font-medium">{detailQuery.data.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Relationship</div>
                  <FinanceStatus value={detailQuery.data.type} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <FinanceStatus value={detailQuery.data.is_active ? "active" : "inactive"} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Receivable account</div>
                  <div className="font-medium">
                    {detailQuery.data.receivableAccount ? `${detailQuery.data.receivableAccount.code} · ${detailQuery.data.receivableAccount.name}` : "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Payable account</div>
                  <div className="font-medium">
                    {detailQuery.data.payableAccount ? `${detailQuery.data.payableAccount.code} · ${detailQuery.data.payableAccount.name}` : "Not set"}
                  </div>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">Recent documents</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Document</th>
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQuery.data.documents && detailQuery.data.documents.length > 0 ? (
                        detailQuery.data.documents.map((doc) => (
                          <tr key={doc.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2">
                              <div className="font-mono">{doc.number}</div>
                              <div className="text-xs text-muted-foreground">{doc.type?.replaceAll("_", " ")}</div>
                            </td>
                            <td className="px-3 py-2">{doc.document_date}</td>
                            <td className="px-3 py-2">
                              <FinanceStatus value={doc.status} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <Money value={doc.total} currency={doc.currency} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <Money value={Number(doc.total) - Number(doc.paid_amount)} currency={doc.currency} />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                            No recent documents.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </FinanceShell>
  );
}

function ContactFormDialog({
  mode,
  open,
  onOpenChange,
  busy,
  onSubmit,
  contact,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (value: boolean) => void;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  contact?: FinanceContact | null;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);

    const basePayload = {
      type: values.get("type"),
      code: values.get("code"),
      name: values.get("name"),
      email: values.get("email") || null,
      phone: values.get("phone") || null,
      tax_id: values.get("tax_id") || null,
      business_license_number: values.get("business_license_number") || null,
      taxpayer_category: values.get("taxpayer_category") || null,
      is_vat_registered: values.get("is_vat_registered") === "1",
      currency: values.get("currency") || "ETB",
      credit_limit: Number(values.get("credit_limit") || 0),
      payment_terms_days: Number(values.get("payment_terms_days") || 0),
      address: values.get("address") || null,
    };

    onSubmit(mode === "create" ? { ...basePayload, is_active: true } : basePayload);
  }

  const isEdit = mode === "edit";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button>
            <Plus data-icon="inline-start" aria-hidden="true" />
            New contact
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit financial contact" : "Create financial contact"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update contact details. Status is managed separately." : "Add a customer, vendor, or dual-purpose profile. Required fields are marked in their labels."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contact-type">Relationship (required)</FieldLabel>
                <NativeSelect id="contact-type" name="type" required defaultValue={contact?.type ?? "customer"}>
                  <NativeSelectOption value="customer">Customer</NativeSelectOption>
                  <NativeSelectOption value="vendor">Vendor</NativeSelectOption>
                  <NativeSelectOption value="both">Customer and vendor</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-code">Contact code (required)</FieldLabel>
                <Input id="contact-code" name="code" required maxLength={40} autoFocus defaultValue={contact?.code ?? ""} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="contact-name">Legal or trading name (required)</FieldLabel>
              <Input id="contact-name" name="name" required autoComplete="organization" defaultValue={contact?.name ?? ""} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contact-email">Email</FieldLabel>
                <Input id="contact-email" name="email" type="email" autoComplete="email" defaultValue={contact?.email ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-phone">Phone</FieldLabel>
                <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" defaultValue={contact?.phone ?? ""} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="contact-tax-id">Tax ID / TIN</FieldLabel>
                <Input id="contact-tax-id" name="tax_id" defaultValue={contact?.tax_id ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-business-license">Business licence number</FieldLabel>
                <Input id="contact-business-license" name="business_license_number" defaultValue={contact?.business_license_number ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-taxpayer-category">Taxpayer category</FieldLabel>
                <NativeSelect
                  id="contact-taxpayer-category"
                  name="taxpayer_category"
                  defaultValue={contact?.taxpayer_category ?? ""}
                >
                  <NativeSelectOption value="">Not classified</NativeSelectOption>
                  <NativeSelectOption value="A">Category A</NativeSelectOption>
                  <NativeSelectOption value="B">Category B</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="contact-vat-registration">VAT registration</FieldLabel>
                <NativeSelect
                  id="contact-vat-registration"
                  name="is_vat_registered"
                  defaultValue={contact?.is_vat_registered ? "1" : "0"}
                >
                  <NativeSelectOption value="0">Not VAT registered</NativeSelectOption>
                  <NativeSelectOption value="1">VAT registered</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-currency">Currency</FieldLabel>
                <Input id="contact-currency" name="currency" defaultValue={contact?.currency ?? "ETB"} maxLength={3} />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-terms">Payment terms (days)</FieldLabel>
                <Input
                  id="contact-terms"
                  name="payment_terms_days"
                  type="number"
                  min="0"
                  max="3650"
                  defaultValue={contact?.payment_terms_days ?? 30}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="contact-limit">Credit limit</FieldLabel>
              <Input
                id="contact-limit"
                name="credit_limit"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                defaultValue={contact?.credit_limit ?? "0"}
              />
              <FieldDescription>Use zero for no approved credit.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="contact-address">Address</FieldLabel>
              <Input id="contact-address" name="address" autoComplete="street-address" defaultValue={contact?.address ?? ""} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <BusyLabel busy={busy}>{isEdit ? "Save changes" : "Create contact"}</BusyLabel>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
