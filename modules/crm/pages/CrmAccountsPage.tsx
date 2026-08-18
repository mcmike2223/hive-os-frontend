"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { crmApi } from "@/modules/crm/api";
import type { CrmAccount, CrmBridgeStatus, CrmContact } from "@/modules/crm/types";

const TABS = ["accounts", "contacts"] as const;
type Tab = (typeof TABS)[number];

export default function CrmAccountsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<Tab>("accounts");
  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);

  const [accountForm, setAccountForm] = React.useState({
    id: undefined as number | undefined,
    name: "",
    industry: "",
    segment: "",
    phone: "",
    email: "",
    city: "",
    owner_employee_id: "",
  });

  const [contactForm, setContactForm] = React.useState({
    id: undefined as number | undefined,
    account_id: "",
    first_name: "",
    last_name: "",
    job_title: "",
    email: "",
    phone: "",
    is_primary: false,
    opted_out: false,
  });

  const accountsQuery = useQuery({
    queryKey: ["crm", "accounts", tableQuery],
    queryFn: () =>
      crmApi
        .listAccounts({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
        })
        .then((res) => res.data),
    enabled: tab === "accounts",
  });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", tableQuery],
    queryFn: () =>
      crmApi
        .listContacts({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
        })
        .then((res) => res.data),
    enabled: tab === "contacts",
  });

  const accountOptionsQuery = useQuery({
    queryKey: ["crm", "account-options"],
    queryFn: () => crmApi.listAccounts({ limit: 100 }).then((res) => res.data),
  });

  const bridgeQuery = useQuery({
    queryKey: ["crm", "bridge-status"],
    queryFn: () => crmApi.bridgeStatus().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["crm"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveAccount = useMutation({
    mutationFn: () => {
      const payload = {
        name: accountForm.name,
        industry: accountForm.industry || null,
        segment: accountForm.segment || null,
        phone: accountForm.phone || null,
        email: accountForm.email || null,
        city: accountForm.city || null,
        owner_employee_id: accountForm.owner_employee_id
          ? Number(accountForm.owner_employee_id)
          : null,
      };

      return accountForm.id
        ? crmApi.updateAccount(accountForm.id, payload)
        : crmApi.createAccount(payload);
    },
    onSuccess: () => {
      toast.success(t("crm.accounts.saved", "Account saved."));
      invalidate();
      setAccountOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.accounts.save_failed", "Could not save the account."))),
  });

  const saveContact = useMutation({
    mutationFn: () => {
      const payload = {
        account_id: contactForm.account_id ? Number(contactForm.account_id) : null,
        first_name: contactForm.first_name,
        last_name: contactForm.last_name || null,
        job_title: contactForm.job_title || null,
        email: contactForm.email || null,
        phone: contactForm.phone || null,
        is_primary: contactForm.is_primary,
        opted_out: contactForm.opted_out,
      };

      return contactForm.id
        ? crmApi.updateContact(contactForm.id, payload)
        : crmApi.createContact(payload);
    },
    onSuccess: () => {
      toast.success(t("crm.contacts.saved", "Contact saved."));
      invalidate();
      setContactOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.contacts.save_failed", "Could not save the contact."))),
  });

  const linkCustomer = useMutation({
    mutationFn: (id: number) => crmApi.linkCustomer(id),
    onSuccess: (response: any) => {
      const data = response?.data?.data;
      toast[data?.linked ? "success" : "info"](
        data?.linked
          ? t("crm.accounts.linked", "Account is now a Sales customer.")
          : (data?.reason ?? t("crm.accounts.not_linked", "No customer was created.")),
      );
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.accounts.link_failed", "Could not link the account."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const bridge: CrmBridgeStatus | undefined = bridgeQuery.data?.data;
  const accountOptions = (accountOptionsQuery.data?.data ?? []) as CrmAccount[];

  const accountColumns = React.useMemo<ColumnDef<CrmAccount>[]>(
    () => [
      {
        id: "account",
        header: t("crm.accounts.account", "Account"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.industry ?? row.original.city ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "segment",
        header: t("crm.accounts.segment", "Segment"),
        cell: ({ row }) =>
          row.original.segment ? (
            <Badge variant="outline" className="text-[11px] capitalize">
              {row.original.segment}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "counts",
        header: t("crm.accounts.counts", "Contacts / Deals"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.contacts_count ?? 0} / {row.original.opportunities_count ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: t("crm.leads.phone", "Phone"),
        cell: ({ row }) => <span className="text-xs">{row.original.phone ?? "—"}</span>,
      },
      {
        id: "customer",
        header: t("crm.accounts.customer", "Customer"),
        cell: ({ row }) =>
          row.original.sales_customer_id ? (
            <Badge className="text-[11px]">
              {t("crm.accounts.is_customer", "#{id}").replace(
                "{id}",
                String(row.original.sales_customer_id),
              )}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAccountForm({
                  id: row.original.id,
                  name: row.original.name,
                  industry: row.original.industry ?? "",
                  segment: row.original.segment ?? "",
                  phone: row.original.phone ?? "",
                  email: row.original.email ?? "",
                  city: row.original.city ?? "",
                  owner_employee_id: row.original.owner_employee_id
                    ? String(row.original.owner_employee_id)
                    : "",
                });
                setAccountOpen(true);
              }}
            >
              {t("crm.common.edit", "Edit")}
            </Button>
            {!row.original.sales_customer_id ? (
              <Button
                variant="outline"
                size="sm"
                className="text-[11px]"
                disabled={linkCustomer.isPending || !bridge?.sales?.available}
                onClick={() => linkCustomer.mutate(row.original.id)}
                title={
                  bridge?.sales?.available
                    ? undefined
                    : t("crm.accounts.no_sales", "Sales is not installed.")
                }
              >
                {t("crm.accounts.make_customer", "Make customer")}
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [t, linkCustomer, bridge],
  );

  const contactColumns = React.useMemo<ColumnDef<CrmContact>[]>(
    () => [
      {
        id: "contact",
        header: t("crm.contacts.contact", "Contact"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">
              {row.original.full_name ?? `${row.original.first_name} ${row.original.last_name ?? ""}`}
            </p>
            <p className="text-[11px] text-muted-foreground">{row.original.job_title ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "account",
        header: t("crm.accounts.account", "Account"),
        cell: ({ row }) => <span className="text-xs">{row.original.account?.name ?? "—"}</span>,
      },
      {
        id: "reach",
        header: t("crm.contacts.reach", "Contact"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.phone ?? "—"}</p>
            <p className="text-muted-foreground">{row.original.email ?? ""}</p>
          </div>
        ),
      },
      {
        id: "flags",
        header: "",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.is_primary ? (
              <Badge className="text-[10px]">{t("crm.contacts.primary", "Primary")}</Badge>
            ) : null}
            {row.original.opted_out ? (
              <Badge variant="destructive" className="text-[10px]">
                {t("crm.contacts.opted_out", "Opted out")}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setContactForm({
                  id: row.original.id,
                  account_id: row.original.account_id ? String(row.original.account_id) : "",
                  first_name: row.original.first_name,
                  last_name: row.original.last_name ?? "",
                  job_title: row.original.job_title ?? "",
                  email: row.original.email ?? "",
                  phone: row.original.phone ?? "",
                  is_primary: row.original.is_primary,
                  opted_out: row.original.opted_out,
                });
                setContactOpen(true);
              }}
            >
              {t("crm.common.edit", "Edit")}
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  const activeQuery = tab === "accounts" ? accountsQuery : contactsQuery;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("crm.accounts.title", "Accounts and Contacts")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "crm.accounts.subtitle",
              "The companies you sell to and the people inside them. An account becomes a Sales customer when you say so.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            if (tab === "accounts") {
              setAccountForm({
                id: undefined,
                name: "",
                industry: "",
                segment: "",
                phone: "",
                email: "",
                city: "",
                owner_employee_id: "",
              });
              setAccountOpen(true);
            } else {
              setContactForm({
                id: undefined,
                account_id: "",
                first_name: "",
                last_name: "",
                job_title: "",
                email: "",
                phone: "",
                is_primary: false,
                opted_out: false,
              });
              setContactOpen(true);
            }
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {tab === "accounts"
            ? t("crm.accounts.add", "Add Account")
            : t("crm.contacts.add", "Add Contact")}
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border/60">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${
              tab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            aria-current={tab === value ? "page" : undefined}
          >
            {value}
          </button>
        ))}
      </div>

      <DataTable
        columns={(tab === "accounts" ? accountColumns : contactColumns) as ColumnDef<any>[]}
        data={(activeQuery.data?.data ?? []) as any[]}
        totalEntries={activeQuery.data?.meta?.total ?? 0}
        loading={activeQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("crm.accounts.search", "Search...")}
        resourceName={`crm-${tab}`}
      />

      {/* Account */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {accountForm.id
                  ? t("crm.accounts.edit", "Edit Account")
                  : t("crm.accounts.add", "Add Account")}
              </DialogTitle>
              <DialogDescription>
                {t("crm.accounts.form_desc", "A company you sell to, or hope to.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="acct-name">{t("crm.common.name", "Name")}</Label>
              <Input
                id="acct-name"
                value={accountForm.name}
                onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-industry">{t("crm.accounts.industry", "Industry")}</Label>
              <Input
                id="acct-industry"
                value={accountForm.industry}
                onChange={(event) => setAccountForm({ ...accountForm, industry: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-segment">{t("crm.accounts.segment", "Segment")}</Label>
              <Input
                id="acct-segment"
                value={accountForm.segment}
                onChange={(event) => setAccountForm({ ...accountForm, segment: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-phone">{t("crm.leads.phone", "Phone")}</Label>
              <Input
                id="acct-phone"
                value={accountForm.phone}
                onChange={(event) => setAccountForm({ ...accountForm, phone: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-email">{t("crm.leads.email", "Email")}</Label>
              <Input
                id="acct-email"
                type="email"
                value={accountForm.email}
                onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-city">{t("crm.leads.city", "City")}</Label>
              <Input
                id="acct-city"
                value={accountForm.city}
                onChange={(event) => setAccountForm({ ...accountForm, city: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-owner">{t("crm.leads.owner", "Owner employee ID")}</Label>
              <Input
                id="acct-owner"
                type="number"
                value={accountForm.owner_employee_id}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, owner_employee_id: event.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAccountOpen(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveAccount.mutate()}
              disabled={saveAccount.isPending || !accountForm.name.trim()}
            >
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {contactForm.id
                  ? t("crm.contacts.edit", "Edit Contact")
                  : t("crm.contacts.add", "Add Contact")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.contacts.form_desc",
                  "Opting a contact out excludes them from marketing regardless of anything else — that is their instruction, not a preference to weigh.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ct-first">{t("crm.contacts.first_name", "First name")}</Label>
              <Input
                id="ct-first"
                value={contactForm.first_name}
                onChange={(event) => setContactForm({ ...contactForm, first_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-last">{t("crm.contacts.last_name", "Last name")}</Label>
              <Input
                id="ct-last"
                value={contactForm.last_name}
                onChange={(event) => setContactForm({ ...contactForm, last_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-account">{t("crm.accounts.account", "Account")}</Label>
              <select
                id="ct-account"
                value={contactForm.account_id}
                onChange={(event) => setContactForm({ ...contactForm, account_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("crm.common.none", "None")}</option>
                {accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-title">{t("crm.contacts.job_title", "Job title")}</Label>
              <Input
                id="ct-title"
                value={contactForm.job_title}
                onChange={(event) => setContactForm({ ...contactForm, job_title: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-phone">{t("crm.leads.phone", "Phone")}</Label>
              <Input
                id="ct-phone"
                value={contactForm.phone}
                onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-email">{t("crm.leads.email", "Email")}</Label>
              <Input
                id="ct-email"
                type="email"
                value={contactForm.email}
                onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="ct-primary"
                checked={contactForm.is_primary}
                onCheckedChange={(checked) => setContactForm({ ...contactForm, is_primary: checked })}
              />
              <Label htmlFor="ct-primary">{t("crm.contacts.primary", "Primary")}</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="ct-opted"
                checked={contactForm.opted_out}
                onCheckedChange={(checked) => setContactForm({ ...contactForm, opted_out: checked })}
              />
              <Label htmlFor="ct-opted">{t("crm.contacts.opted_out", "Opted out")}</Label>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setContactOpen(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveContact.mutate()}
              disabled={saveContact.isPending || !contactForm.first_name.trim()}
            >
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
