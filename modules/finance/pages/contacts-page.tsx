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
import type { FinanceContact } from "@/modules/finance/types";
import { BusyLabel, FinanceError, FinanceLoading, FinanceShell, FinanceStatus, FinanceTable, Money } from "@/modules/finance/pages/components/finance-shell";

export default function FinanceContactsPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "manage_finance_contacts"]);
  const query = useQuery({ queryKey: ["finance", "contacts", search], queryFn: () => financeApi.contacts({ search: search || undefined, per_page: 100 }) });
  const create = useMutation({ mutationFn: financeApi.createContact, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance", "contacts"] }); setOpen(false); toast.success("Contact created."); }, onError: () => toast.error("Contact could not be created.") });
  const toggle = useMutation({ mutationFn: ({ contact, active }: { contact: FinanceContact; active: boolean }) => financeApi.updateContact(contact.id, { ...contact, is_active: active }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance", "contacts"] }); toast.success("Contact status updated."); }, onError: () => toast.error("Contact status could not be updated.") });
  return <FinanceShell title="Customers and vendors" description="Keep shared receivable and payable profiles, payment terms, tax identifiers, credit controls, and contact details in one register." actions={canManage ? <ContactDialog open={open} onOpenChange={setOpen} busy={create.isPending} onSubmit={(payload) => create.mutate(payload)} /> : undefined}>
    <Card><CardHeader><CardTitle>Financial contact register</CardTitle><CardDescription>A contact can be a customer, vendor, or both. Posted history remains attached if the contact is deactivated.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">
      <Field><FieldLabel htmlFor="finance-contact-search">Search contacts</FieldLabel><Input id="finance-contact-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code, or tax ID" /></Field>
      {query.isLoading ? <FinanceLoading cards={2} /> : query.error || !query.data ? <FinanceError error={query.error} /> : <FinanceTable<FinanceContact> caption="Customers and vendors ordered alphabetically." rows={query.data.data} getKey={(row) => row.id} columns={[
        { key: "code", label: "Code", render: (row) => <span className="font-mono font-medium">{row.code}</span> },
        { key: "name", label: "Contact", render: (row) => <div className="flex flex-col gap-1"><span className="font-medium">{row.name}</span><span className="text-xs text-muted-foreground">{row.email || row.phone || "No contact detail"}</span></div> },
        { key: "type", label: "Relationship", render: (row) => <FinanceStatus value={row.type} /> },
        { key: "terms", label: "Terms", render: (row) => `${row.payment_terms_days} day(s)` },
        { key: "limit", label: "Credit limit", align: "right", render: (row) => <Money value={row.credit_limit} currency={row.currency} /> },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.is_active ? "active" : "inactive"} /> },
        { key: "action", label: "Action", align: "right", render: (row) => canManage ? <Button type="button" variant="outline" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate({ contact: row, active: !row.is_active })}><Power data-icon="inline-start" aria-hidden="true" />{row.is_active ? "Deactivate" : "Activate"}</Button> : <span className="text-muted-foreground">View only</span> },
      ]} />}
    </CardContent></Card>
  </FinanceShell>;
}

function ContactDialog({ open, onOpenChange, busy, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; busy: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); onSubmit({ type: values.get("type"), code: values.get("code"), name: values.get("name"), email: values.get("email") || null, phone: values.get("phone") || null, tax_id: values.get("tax_id") || null, business_license_number: values.get("business_license_number") || null, taxpayer_category: values.get("taxpayer_category") || null, is_vat_registered: values.get("is_vat_registered") === "1", currency: values.get("currency") || "ETB", credit_limit: Number(values.get("credit_limit") || 0), payment_terms_days: Number(values.get("payment_terms_days") || 0), address: values.get("address") || null, is_active: true }); }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogTrigger asChild><Button><Plus data-icon="inline-start" aria-hidden="true" />New contact</Button></DialogTrigger><DialogContent><form onSubmit={submit} className="flex flex-col gap-5"><DialogHeader><DialogTitle>Create financial contact</DialogTitle><DialogDescription>Add a customer, vendor, or dual-purpose profile. Required fields are marked in their labels.</DialogDescription></DialogHeader><FieldGroup>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="contact-type">Relationship (required)</FieldLabel><NativeSelect id="contact-type" name="type" required defaultValue="customer"><NativeSelectOption value="customer">Customer</NativeSelectOption><NativeSelectOption value="vendor">Vendor</NativeSelectOption><NativeSelectOption value="both">Customer and vendor</NativeSelectOption></NativeSelect></Field><Field><FieldLabel htmlFor="contact-code">Contact code (required)</FieldLabel><Input id="contact-code" name="code" required maxLength={40} autoFocus /></Field></div>
    <Field><FieldLabel htmlFor="contact-name">Legal or trading name (required)</FieldLabel><Input id="contact-name" name="name" required autoComplete="organization" /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="contact-email">Email</FieldLabel><Input id="contact-email" name="email" type="email" autoComplete="email" /></Field><Field><FieldLabel htmlFor="contact-phone">Phone</FieldLabel><Input id="contact-phone" name="phone" type="tel" autoComplete="tel" /></Field></div>
    <div className="grid gap-4 sm:grid-cols-3"><Field><FieldLabel htmlFor="contact-tax-id">Tax ID / TIN</FieldLabel><Input id="contact-tax-id" name="tax_id" /></Field><Field><FieldLabel htmlFor="contact-business-license">Business licence number</FieldLabel><Input id="contact-business-license" name="business_license_number" /></Field><Field><FieldLabel htmlFor="contact-taxpayer-category">Taxpayer category</FieldLabel><NativeSelect id="contact-taxpayer-category" name="taxpayer_category" defaultValue=""><NativeSelectOption value="">Not classified</NativeSelectOption><NativeSelectOption value="A">Category A</NativeSelectOption><NativeSelectOption value="B">Category B</NativeSelectOption></NativeSelect></Field></div>
    <div className="grid gap-4 sm:grid-cols-3"><Field><FieldLabel htmlFor="contact-vat-registration">VAT registration</FieldLabel><NativeSelect id="contact-vat-registration" name="is_vat_registered" defaultValue="0"><NativeSelectOption value="0">Not VAT registered</NativeSelectOption><NativeSelectOption value="1">VAT registered</NativeSelectOption></NativeSelect></Field><Field><FieldLabel htmlFor="contact-currency">Currency</FieldLabel><Input id="contact-currency" name="currency" defaultValue="ETB" maxLength={3} /></Field><Field><FieldLabel htmlFor="contact-terms">Payment terms (days)</FieldLabel><Input id="contact-terms" name="payment_terms_days" type="number" min="0" max="3650" defaultValue="30" /></Field></div>
    <Field><FieldLabel htmlFor="contact-limit">Credit limit</FieldLabel><Input id="contact-limit" name="credit_limit" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" /><FieldDescription>Use zero for no approved credit.</FieldDescription></Field>
    <Field><FieldLabel htmlFor="contact-address">Address</FieldLabel><Input id="contact-address" name="address" autoComplete="street-address" /></Field>
  </FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy}><BusyLabel busy={busy}>Create contact</BusyLabel></Button></DialogFooter></form></DialogContent></Dialog>;
}
