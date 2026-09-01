"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { hrFetch, type Employee as HrEmployee, type Paginated as HrPaginated } from "@/modules/humanresources/api";
import { crmApi } from "@/modules/crm/api";
import type {
  CrmAccount,
  CrmActivity,
  CrmBridgeStatus,
  CrmContact,
  CrmOpportunity,
} from "@/modules/crm/types";
import { EmptyPanel, LoadingPanel, Panel } from "@/modules/shared/charts/primitives";

const TABS = ["accounts", "contacts"] as const;
type Tab = (typeof TABS)[number];

const ACTIVITY_TYPES = ["call", "meeting", "email", "task", "note"] as const;

const DEFAULT_ACCOUNT = {
  name: "",
  industry: "",
  segment: "",
  website: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  owner_employee_id: "",
  is_active: true,
  notes: "",
};

const DEFAULT_CONTACT = {
  account_id: "",
  first_name: "",
  last_name: "",
  job_title: "",
  email: "",
  phone: "",
  owner_employee_id: "",
  is_primary: false,
  opted_out: false,
  notes: "",
};

const DEFAULT_ACTIVITY = {
  type: "call" as (typeof ACTIVITY_TYPES)[number],
  subject: "",
  body: "",
  due_at: "",
};

function employeeLabel(employees: Map<number, HrEmployee>, id: number | null | undefined) {
  if (id == null) return null;
  const employee = employees.get(id);
  if (employee) return `${employee.primary_name} (${employee.employee_number})`;
  return `#${id}`;
}

function contactLabel(contact: CrmContact) {
  return (
    contact.full_name ??
    ([contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
      contact.email ||
      `#${contact.id}`)
  );
}

function accountToForm(account: CrmAccount) {
  return {
    name: account.name,
    industry: account.industry ?? "",
    segment: account.segment ?? "",
    website: account.website ?? "",
    phone: account.phone ?? "",
    email: account.email ?? "",
    city: account.city ?? "",
    address: account.address ?? "",
    owner_employee_id: account.owner_employee_id ? String(account.owner_employee_id) : "",
    is_active: account.is_active !== false,
    notes: account.notes ?? "",
  };
}

function contactToForm(contact: CrmContact) {
  return {
    account_id: contact.account_id ? String(contact.account_id) : "",
    first_name: contact.first_name,
    last_name: contact.last_name ?? "",
    job_title: contact.job_title ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    owner_employee_id: contact.owner_employee_id ? String(contact.owner_employee_id) : "",
    is_primary: contact.is_primary,
    opted_out: contact.opted_out,
    notes: contact.notes ?? "",
  };
}

const money = (value: unknown, currency = "ETB") => {
  const parsed = Number(value);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export default function CrmAccountsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canManageAccounts = hasAnyPermission(["manage_crm_accounts", "manage_crm"]);
  const canManageContacts = hasAnyPermission(["manage_crm_contacts", "manage_crm"]);
  const canLinkCustomer = hasAnyPermission(["convert_crm_to_sales", "manage_crm"]);
  const canLogActivities = hasAnyPermission(["log_crm_activities", "manage_crm"]);

  const [tab, setTab] = React.useState<Tab>("accounts");
  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });

  const [segmentFilter, setSegmentFilter] = React.useState("all");
  const [industryFilter, setIndustryFilter] = React.useState("all");
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [customersOnly, setCustomersOnly] = React.useState(false);

  const [contactAccountFilter, setContactAccountFilter] = React.useState("all");
  const [contactableOnly, setContactableOnly] = React.useState(false);

  const [accountFormOpen, setAccountFormOpen] = React.useState(false);
  const [accountFormId, setAccountFormId] = React.useState<number | undefined>();
  const [accountForm, setAccountForm] = React.useState({ ...DEFAULT_ACCOUNT });

  const [contactFormOpen, setContactFormOpen] = React.useState(false);
  const [contactFormId, setContactFormId] = React.useState<number | undefined>();
  const [contactForm, setContactForm] = React.useState({ ...DEFAULT_CONTACT });

  const [detailAccountId, setDetailAccountId] = React.useState<number | null>(null);
  const [detailEditing, setDetailEditing] = React.useState(false);
  const [detailForm, setDetailForm] = React.useState({ ...DEFAULT_ACCOUNT });
  const [activityForm, setActivityForm] = React.useState({ ...DEFAULT_ACTIVITY });

  const [deleteAccountFor, setDeleteAccountFor] = React.useState<CrmAccount | null>(null);
  const [deleteContactFor, setDeleteContactFor] = React.useState<CrmContact | null>(null);
  const [linkingId, setLinkingId] = React.useState<number | null>(null);
  const [activityBusyId, setActivityBusyId] = React.useState<number | null>(null);

  const pickerOpenRef = React.useRef(false);
  const pickerCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const childDialogClosingRef = React.useRef(false);
  const [openPickerCount, setOpenPickerCount] = React.useState(0);

  const handlePickerOpenChange = React.useCallback((open: boolean) => {
    if (pickerCloseTimerRef.current) {
      clearTimeout(pickerCloseTimerRef.current);
      pickerCloseTimerRef.current = null;
    }
    if (open) {
      pickerOpenRef.current = true;
      setOpenPickerCount((count) => count + 1);
      return;
    }
    pickerOpenRef.current = true;
    setOpenPickerCount((count) => Math.max(0, count - 1));
    pickerCloseTimerRef.current = setTimeout(() => {
      pickerOpenRef.current = false;
      pickerCloseTimerRef.current = null;
    }, 300);
  }, []);

  const blockOutsideDismiss = React.useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault();
  }, []);

  const hasBlockingOverlay = React.useCallback(
    () =>
      contactFormOpen ||
      accountFormOpen ||
      deleteAccountFor !== null ||
      deleteContactFor !== null ||
      childDialogClosingRef.current ||
      pickerOpenRef.current ||
      openPickerCount > 0,
    [accountFormOpen, contactFormOpen, deleteAccountFor, deleteContactFor, openPickerCount],
  );

  const allowDialogClose = React.useCallback(
    (open: boolean, close: () => void) => {
      if (!open && hasBlockingOverlay()) return;
      if (!open) close();
    },
    [hasBlockingOverlay],
  );

  const closeChildDialog = React.useCallback((close: () => void) => {
    childDialogClosingRef.current = true;
    close();
    window.setTimeout(() => {
      childDialogClosingRef.current = false;
    }, 300);
  }, []);

  const closeDetail = React.useCallback(() => {
    setDetailAccountId(null);
    setDetailEditing(false);
    setActivityForm({ ...DEFAULT_ACTIVITY });
  }, []);

  const handleDetailOpenChange = React.useCallback(
    (open: boolean) => {
      allowDialogClose(open, closeDetail);
    },
    [allowDialogClose, closeDetail],
  );

  const handleContactFormOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        closeChildDialog(() => setContactFormOpen(false));
        return;
      }
      setContactFormOpen(true);
    },
    [closeChildDialog],
  );

  const handleAccountFormOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        closeChildDialog(() => setAccountFormOpen(false));
        return;
      }
      setAccountFormOpen(true);
    },
    [closeChildDialog],
  );

  const accountsQuery = useQuery({
    queryKey: [
      "crm",
      "accounts",
      tableQuery,
      segmentFilter,
      industryFilter,
      ownerFilter,
      customersOnly,
    ],
    queryFn: () =>
      crmApi
        .listAccounts({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          segment: segmentFilter !== "all" ? segmentFilter : undefined,
          industry: industryFilter !== "all" ? industryFilter : undefined,
          owner_employee_id: ownerFilter !== "all" ? Number(ownerFilter) : undefined,
          customers_only: customersOnly ? 1 : undefined,
        })
        .then((res) => res.data),
    enabled: tab === "accounts",
  });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", tableQuery, contactAccountFilter, contactableOnly],
    queryFn: () =>
      crmApi
        .listContacts({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          account_id: contactAccountFilter !== "all" ? Number(contactAccountFilter) : undefined,
          contactable_only: contactableOnly ? 1 : undefined,
        })
        .then((res) => res.data),
    enabled: tab === "contacts",
  });

  const accountOptionsQuery = useQuery({
    queryKey: ["crm", "account-options"],
    queryFn: () => crmApi.listAccounts({ limit: 200 }).then((res) => res.data),
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", "crm-accounts"],
    queryFn: () => hrFetch<HrPaginated<HrEmployee>>("/employees?per_page=200"),
  });

  const bridgeQuery = useQuery({
    queryKey: ["crm", "bridge-status"],
    queryFn: () => crmApi.bridgeStatus().then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["crm", "account", detailAccountId],
    queryFn: () => crmApi.getAccount(detailAccountId!).then((res) => res.data?.data as CrmAccount),
    enabled: detailAccountId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["crm"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const bridge: CrmBridgeStatus | undefined = bridgeQuery.data?.data;
  const accountOptions = (accountOptionsQuery.data?.data ?? []) as CrmAccount[];
  const detail = detailQuery.data;

  const employeeById = React.useMemo(() => {
    const rows = employeesQuery.data?.data ?? [];
    return new Map(rows.map((employee) => [employee.id, employee]));
  }, [employeesQuery.data]);

  const segmentOptions = React.useMemo(() => {
    const values = accountOptions.map((a) => a.segment).filter(Boolean) as string[];
    return Array.from(new Set(values));
  }, [accountOptions]);

  const industryOptions = React.useMemo(() => {
    const values = accountOptions.map((a) => a.industry).filter(Boolean) as string[];
    return Array.from(new Set(values));
  }, [accountOptions]);

  const buildAccountPayload = (values: typeof DEFAULT_ACCOUNT) => ({
    name: values.name,
    industry: values.industry || null,
    segment: values.segment || null,
    website: values.website || null,
    phone: values.phone || null,
    email: values.email || null,
    city: values.city || null,
    address: values.address || null,
    owner_employee_id: values.owner_employee_id ? Number(values.owner_employee_id) : null,
    is_active: values.is_active,
    notes: values.notes || null,
  });

  const buildContactPayload = (values: typeof DEFAULT_CONTACT) => ({
    account_id: values.account_id ? Number(values.account_id) : null,
    first_name: values.first_name,
    last_name: values.last_name || null,
    job_title: values.job_title || null,
    email: values.email || null,
    phone: values.phone || null,
    owner_employee_id: values.owner_employee_id ? Number(values.owner_employee_id) : null,
    is_primary: values.is_primary,
    opted_out: values.opted_out,
    notes: values.notes || null,
  });

  const saveAccount = useMutation({
    mutationFn: () =>
      accountFormId
        ? crmApi.updateAccount(accountFormId, buildAccountPayload(accountForm))
        : crmApi.createAccount(buildAccountPayload(accountForm)),
    onSuccess: () => {
      toast.success(t("crm.accounts.saved", "Account saved."));
      invalidate();
      handleAccountFormOpenChange(false);
      if (detailAccountId === accountFormId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.accounts.save_failed", "Could not save the account."))),
  });

  const saveDetailAccount = useMutation({
    mutationFn: () => crmApi.updateAccount(detailAccountId!, buildAccountPayload(detailForm)),
    onSuccess: () => {
      toast.success(t("crm.accounts.saved", "Account saved."));
      setDetailEditing(false);
      invalidate();
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.accounts.save_failed", "Could not save the account."))),
  });

  const saveContact = useMutation({
    mutationFn: () =>
      contactFormId
        ? crmApi.updateContact(contactFormId, buildContactPayload(contactForm))
        : crmApi.createContact(buildContactPayload(contactForm)),
    onSuccess: () => {
      toast.success(t("crm.contacts.saved", "Contact saved."));
      invalidate();
      handleContactFormOpenChange(false);
      if (detailAccountId) detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.contacts.save_failed", "Could not save the contact."))),
  });

  const linkCustomer = useMutation({
    mutationFn: (id: number) => {
      setLinkingId(id);
      return crmApi.linkCustomer(id);
    },
    onSuccess: (response: any) => {
      const data = response?.data?.data;
      toast[data?.linked ? "success" : "info"](
        data?.linked
          ? t("crm.accounts.linked", "Account is now a Sales customer.")
          : (data?.reason ?? t("crm.accounts.not_linked", "No customer was created.")),
      );
      invalidate();
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.status === 403
          ? t(
              "crm.accounts.link_forbidden",
              "You need Sales conversion permission to create a customer from an account.",
            )
          : errorText(error, t("crm.accounts.link_failed", "Could not link the account.")),
      ),
    onSettled: () => setLinkingId(null),
  });

  const deleteAccount = useMutation({
    mutationFn: (id: number) => crmApi.deleteAccount(id),
    onSuccess: (_, archivedId) => {
      toast.success(t("crm.accounts.archived", "Account archived."));
      invalidate();
      setDeleteAccountFor(null);
      if (detailAccountId === archivedId) setDetailAccountId(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.accounts.archive_failed", "Could not archive the account."))),
  });

  const deleteContact = useMutation({
    mutationFn: (id: number) => crmApi.deleteContact(id),
    onSuccess: () => {
      toast.success(t("crm.contacts.archived", "Contact archived."));
      invalidate();
      setDeleteContactFor(null);
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.contacts.archive_failed", "Could not archive the contact."))),
  });

  const logActivity = useMutation({
    mutationFn: () =>
      crmApi.createActivity({
        type: activityForm.type,
        subject: activityForm.subject,
        body: activityForm.body || null,
        account_id: detailAccountId,
        due_at: activityForm.due_at || null,
        owner_employee_id: detail?.owner_employee_id ?? null,
      }),
    onSuccess: () => {
      toast.success(t("crm.activities.logged", "Activity logged."));
      setActivityForm({ ...DEFAULT_ACTIVITY });
      detailQuery.refetch();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("crm.activities.log_failed", "Could not log the activity."))),
  });

  const completeActivity = useMutation({
    mutationFn: (id: number) => {
      setActivityBusyId(id);
      return crmApi.completeActivity(id);
    },
    onSuccess: () => {
      toast.success(t("crm.activities.completed", "Marked done."));
      detailQuery.refetch();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not complete it.")),
    onSettled: () => setActivityBusyId(null),
  });

  const openAccountForm = React.useCallback((account?: CrmAccount) => {
    if (account) {
      setAccountFormId(account.id);
      setAccountForm(accountToForm(account));
    } else {
      setAccountFormId(undefined);
      setAccountForm({ ...DEFAULT_ACCOUNT });
    }
    setAccountFormOpen(true);
  }, []);

  const openContactForm = React.useCallback((contact?: CrmContact, accountId?: number) => {
    if (contact) {
      setContactFormId(contact.id);
      setContactForm(contactToForm(contact));
    } else {
      setContactFormId(undefined);
      setContactForm({
        ...DEFAULT_CONTACT,
        account_id: accountId ? String(accountId) : "",
      });
    }
    setContactFormOpen(true);
  }, []);

  const openAccountDetail = React.useCallback((account: CrmAccount) => {
    setDetailAccountId(account.id);
    setDetailEditing(false);
    setActivityForm({ ...DEFAULT_ACTIVITY });
  }, []);

  React.useEffect(() => {
    if (detail && !detailEditing) {
      setDetailForm(accountToForm(detail));
    }
  }, [detail, detailEditing]);

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const renderAccountFields = (
    values: typeof DEFAULT_ACCOUNT,
    onChange: (next: typeof DEFAULT_ACCOUNT) => void,
    idPrefix: string,
  ) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>{t("crm.common.name", "Name")}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-industry`}>{t("crm.accounts.industry", "Industry")}</Label>
        <Input
          id={`${idPrefix}-industry`}
          value={values.industry}
          onChange={(event) => onChange({ ...values, industry: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-segment`}>{t("crm.accounts.segment", "Segment")}</Label>
        <Input
          id={`${idPrefix}-segment`}
          value={values.segment}
          onChange={(event) => onChange({ ...values, segment: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-website`}>{t("crm.accounts.website", "Website")}</Label>
        <Input
          id={`${idPrefix}-website`}
          value={values.website}
          onChange={(event) => onChange({ ...values, website: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>{t("crm.leads.phone", "Phone")}</Label>
        <Input
          id={`${idPrefix}-phone`}
          value={values.phone}
          onChange={(event) => onChange({ ...values, phone: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>{t("crm.leads.email", "Email")}</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={values.email}
          onChange={(event) => onChange({ ...values, email: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-city`}>{t("crm.leads.city", "City")}</Label>
        <Input
          id={`${idPrefix}-city`}
          value={values.city}
          onChange={(event) => onChange({ ...values, city: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("crm.leads.owner", "Owner")}</Label>
        <Select
          value={values.owner_employee_id || "none"}
          onOpenChange={handlePickerOpenChange}
          onValueChange={(v) => onChange({ ...values, owner_employee_id: v === "none" ? "" : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("crm.common.none", "None")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("crm.common.none", "None")}</SelectItem>
            {(employeesQuery.data?.data ?? []).map((employee) => (
              <SelectItem key={employee.id} value={String(employee.id)}>
                {employeeLabel(employeeById, employee.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-address`}>{t("crm.accounts.address", "Address")}</Label>
        <Textarea
          id={`${idPrefix}-address`}
          rows={2}
          value={values.address}
          onChange={(event) => onChange({ ...values, address: event.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-notes`}>{t("crm.common.notes", "Notes")}</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          rows={3}
          value={values.notes}
          onChange={(event) => onChange({ ...values, notes: event.target.value })}
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Switch
          id={`${idPrefix}-active`}
          checked={values.is_active}
          onCheckedChange={(checked) => onChange({ ...values, is_active: checked })}
        />
        <Label htmlFor={`${idPrefix}-active`}>{t("crm.accounts.active", "Active")}</Label>
      </div>
    </div>
  );

  const renderContactFields = (
    values: typeof DEFAULT_CONTACT,
    onChange: (next: typeof DEFAULT_CONTACT) => void,
    idPrefix: string,
  ) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-first`}>{t("crm.contacts.first_name", "First name")}</Label>
        <Input
          id={`${idPrefix}-first`}
          value={values.first_name}
          onChange={(event) => onChange({ ...values, first_name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-last`}>{t("crm.contacts.last_name", "Last name")}</Label>
        <Input
          id={`${idPrefix}-last`}
          value={values.last_name}
          onChange={(event) => onChange({ ...values, last_name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t("crm.accounts.account", "Account")}</Label>
        <Select
          value={values.account_id || "none"}
          onOpenChange={handlePickerOpenChange}
          onValueChange={(v) => onChange({ ...values, account_id: v === "none" ? "" : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("crm.common.none", "None")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("crm.common.none", "None")}</SelectItem>
            {accountOptions.map((account) => (
              <SelectItem key={account.id} value={String(account.id)}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>{t("crm.contacts.job_title", "Job title")}</Label>
        <Input
          id={`${idPrefix}-title`}
          value={values.job_title}
          onChange={(event) => onChange({ ...values, job_title: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("crm.leads.owner", "Owner")}</Label>
        <Select
          value={values.owner_employee_id || "none"}
          onOpenChange={handlePickerOpenChange}
          onValueChange={(v) => onChange({ ...values, owner_employee_id: v === "none" ? "" : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("crm.common.none", "None")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("crm.common.none", "None")}</SelectItem>
            {(employeesQuery.data?.data ?? []).map((employee) => (
              <SelectItem key={employee.id} value={String(employee.id)}>
                {employeeLabel(employeeById, employee.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>{t("crm.leads.phone", "Phone")}</Label>
        <Input
          id={`${idPrefix}-phone`}
          value={values.phone}
          onChange={(event) => onChange({ ...values, phone: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>{t("crm.leads.email", "Email")}</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={values.email}
          onChange={(event) => onChange({ ...values, email: event.target.value })}
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={`${idPrefix}-primary`}
          checked={values.is_primary}
          onCheckedChange={(checked) => onChange({ ...values, is_primary: checked })}
        />
        <Label htmlFor={`${idPrefix}-primary`}>{t("crm.contacts.primary", "Primary")}</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={`${idPrefix}-opted`}
          checked={values.opted_out}
          onCheckedChange={(checked) => onChange({ ...values, opted_out: checked })}
        />
        <Label htmlFor={`${idPrefix}-opted`}>{t("crm.contacts.opted_out", "Opted out")}</Label>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-notes`}>{t("crm.common.notes", "Notes")}</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          rows={3}
          value={values.notes}
          onChange={(event) => onChange({ ...values, notes: event.target.value })}
        />
      </div>
    </div>
  );

  const accountColumns = React.useMemo<ColumnDef<CrmAccount>[]>(
    () => [
      {
        id: "account",
        header: t("crm.accounts.account", "Account"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left"
            onClick={() => openAccountDetail(row.original)}
          >
            <p className="font-bold hover:underline">{row.original.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.industry ?? row.original.city ?? "—"}
            </p>
          </button>
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
        id: "status",
        header: t("crm.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant={row.original.is_active === false ? "destructive" : "secondary"} className="text-[11px]">
            {row.original.is_active === false
              ? t("crm.accounts.inactive", "Inactive")
              : t("crm.accounts.active", "Active")}
          </Badge>
        ),
      },
      {
        id: "customer",
        header: t("crm.accounts.customer", "Customer"),
        cell: ({ row }) =>
          row.original.sales_customer_id ? (
            <Button asChild variant="link" className="h-auto p-0 text-[11px]">
              <Link href="/dashboard/sales/customers">
                {t("crm.accounts.is_customer", "#{id}").replace(
                  "{id}",
                  String(row.original.sales_customer_id),
                )}
              </Link>
            </Button>
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
              className="h-8 w-8 p-0"
              onClick={() => openAccountDetail(row.original)}
              aria-label={t("crm.common.open", "Open")}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {canManageAccounts ? (
              <Button variant="ghost" size="sm" onClick={() => openAccountForm(row.original)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canLinkCustomer && !row.original.sales_customer_id && bridge?.sales?.available ? (
              <Button
                variant="outline"
                size="sm"
                className="text-[11px]"
                disabled={linkingId === row.original.id}
                onClick={() => linkCustomer.mutate(row.original.id)}
              >
                {linkingId === row.original.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  t("crm.accounts.make_customer", "Make customer")
                )}
              </Button>
            ) : null}
            {canManageAccounts ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setDeleteAccountFor(row.original)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [
      bridge,
      canLinkCustomer,
      canManageAccounts,
      linkCustomer,
      linkingId,
      openAccountDetail,
      openAccountForm,
      t,
    ],
  );

  const contactColumns = React.useMemo<ColumnDef<CrmContact>[]>(
    () => [
      {
        id: "contact",
        header: t("crm.contacts.contact", "Contact"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{contactLabel(row.original)}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.job_title ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "account",
        header: t("crm.accounts.account", "Account"),
        cell: ({ row }) =>
          row.original.account ? (
            <button
              type="button"
              className="text-xs hover:underline"
              onClick={() => {
                if (row.original.account) openAccountDetail(row.original.account);
              }}
            >
              {row.original.account.name}
            </button>
          ) : (
            <span className="text-xs">—</span>
          ),
      },
      {
        id: "reach",
        header: t("crm.contacts.reach", "Reach"),
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
          <div className="flex justify-end gap-1">
            {canManageContacts ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => openContactForm(row.original)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setDeleteContactFor(row.original)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [canManageContacts, openAccountDetail, openContactForm, t],
  );

  const activeQuery = tab === "accounts" ? accountsQuery : contactsQuery;
  const canAdd = tab === "accounts" ? canManageAccounts : canManageContacts;

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
        {canAdd ? (
          <Button
            className="rounded-full px-5"
            onClick={() => {
              if (tab === "accounts") openAccountForm();
              else openContactForm();
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {tab === "accounts"
              ? t("crm.accounts.add", "Add Account")
              : t("crm.contacts.add", "Add Contact")}
          </Button>
        ) : null}
      </div>

      {bridge && !bridge.sales?.available ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "crm.accounts.no_sales_banner",
            "Sales is not installed — accounts stay in CRM until Sales is enabled.",
          )}
        </div>
      ) : null}

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

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        {tab === "accounts" ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">{t("crm.accounts.segment", "Segment")}</Label>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
                  {segmentOptions.map((segment) => (
                    <SelectItem key={segment} value={segment}>
                      {segment}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("crm.accounts.industry", "Industry")}</Label>
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
                  {industryOptions.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("crm.leads.owner", "Owner")}</Label>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
                  {(employeesQuery.data?.data ?? []).map((employee) => (
                    <SelectItem key={employee.id} value={String(employee.id)}>
                      {employeeLabel(employeeById, employee.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch id="customers-only" checked={customersOnly} onCheckedChange={setCustomersOnly} />
              <Label htmlFor="customers-only" className="text-xs">
                {t("crm.accounts.customers_only", "Sales customers only")}
              </Label>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-xs">{t("crm.accounts.account", "Account")}</Label>
              <Select value={contactAccountFilter} onValueChange={setContactAccountFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("crm.common.all", "All")}</SelectItem>
                  {accountOptions.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch
                id="contactable-only"
                checked={contactableOnly}
                onCheckedChange={setContactableOnly}
              />
              <Label htmlFor="contactable-only" className="text-xs">
                {t("crm.contacts.contactable_only", "Contactable only")}
              </Label>
            </div>
          </>
        )}
      </div>

      {activeQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("crm.accounts.load_failed", "Could not load this list.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => activeQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("crm.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={(tab === "accounts" ? accountColumns : contactColumns) as ColumnDef<any>[]}
          data={(activeQuery.data?.data ?? []) as any[]}
          totalEntries={activeQuery.data?.meta?.total ?? 0}
          loading={activeQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={
            tab === "accounts"
              ? t("crm.accounts.search_hint", "Name, email, phone, city...")
              : t("crm.contacts.search_hint", "Name, email, phone, account...")
          }
          resourceName={`crm-${tab}`}
        />
      )}

      <Dialog open={accountFormOpen} onOpenChange={handleAccountFormOpenChange}>
        <DialogContent
          className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {accountFormId
                  ? t("crm.accounts.edit", "Edit Account")
                  : t("crm.accounts.add", "Add Account")}
              </DialogTitle>
              <DialogDescription>
                {t("crm.accounts.form_desc", "A company you sell to, or hope to.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {renderAccountFields(accountForm, setAccountForm, "acct")}
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => handleAccountFormOpenChange(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveAccount.mutate()}
              disabled={saveAccount.isPending || !accountForm.name.trim()}
            >
              {saveAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactFormOpen} onOpenChange={handleContactFormOpenChange}>
        <DialogContent
          className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {contactFormId
                  ? t("crm.contacts.edit", "Edit Contact")
                  : t("crm.contacts.add", "Add Contact")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.contacts.form_desc",
                  "Opting a contact out excludes them from marketing regardless of anything else.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {renderContactFields(contactForm, setContactForm, "ct")}
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => handleContactFormOpenChange(false)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveContact.mutate()}
              disabled={saveContact.isPending || !contactForm.first_name.trim()}
            >
              {saveContact.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailAccountId !== null} onOpenChange={handleDetailOpenChange}>
        <DialogContent
          className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={(event) => {
            if (hasBlockingOverlay()) event.preventDefault();
          }}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail?.name ?? t("crm.accounts.account", "Account")}
              </DialogTitle>
              <DialogDescription>
                {detail
                  ? [detail.city, detail.industry].filter(Boolean).join(" · ") || detail.email || "—"
                  : t("crm.common.loading", "Loading...")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">
            {detailQuery.isLoading ? (
              <LoadingPanel label={t("crm.common.loading", "Loading...")} />
            ) : detailQuery.isError ? (
              <EmptyPanel label={t("crm.accounts.detail_failed", "Could not load this account.")} />
            ) : detail ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {canManageAccounts && !detailEditing ? (
                    <Button size="sm" variant="outline" onClick={() => setDetailEditing(true)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      {t("crm.common.edit", "Edit")}
                    </Button>
                  ) : null}
                  {canLinkCustomer && !detail.sales_customer_id && bridge?.sales?.available ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={linkingId === detail.id}
                      onClick={() => linkCustomer.mutate(detail.id)}
                    >
                      {linkingId === detail.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {t("crm.accounts.make_customer", "Make customer")}
                    </Button>
                  ) : null}
                  {detail.sales_customer_id ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href="/dashboard/sales/customers">
                        {t("crm.accounts.view_customer", "View in Sales")}
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/dashboard/crm/pipeline">{t("crm.accounts.view_pipeline", "Pipeline")}</Link>
                  </Button>
                  {canManageContacts ? (
                    <Button size="sm" onClick={() => openContactForm(undefined, detail.id)}>
                      {t("crm.contacts.add", "Add Contact")}
                    </Button>
                  ) : null}
                </div>

                {detailEditing ? (
                  renderAccountFields(detailForm, setDetailForm, "detail")
                ) : (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">{t("crm.leads.phone", "Phone")}: </span>
                      {detail.phone ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("crm.leads.email", "Email")}: </span>
                      {detail.email ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("crm.accounts.website", "Website")}: </span>
                      {detail.website ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("crm.leads.owner", "Owner")}: </span>
                      {employeeLabel(employeeById, detail.owner_employee_id) ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("crm.accounts.segment", "Segment")}: </span>
                      {detail.segment ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("crm.common.status", "Status")}: </span>
                      {detail.is_active === false
                        ? t("crm.accounts.inactive", "Inactive")
                        : t("crm.accounts.active", "Active")}
                    </div>
                    {detail.address ? (
                      <p className="sm:col-span-2 text-muted-foreground">{detail.address}</p>
                    ) : null}
                    {detail.notes ? (
                      <p className="sm:col-span-2 text-muted-foreground">{detail.notes}</p>
                    ) : null}
                  </div>
                )}

                <Panel title={t("crm.contacts.title", "Contacts")}>
                  {(detail.contacts ?? []).length === 0 ? (
                    <EmptyPanel label={t("crm.contacts.none", "No contacts yet.")} />
                  ) : (
                    <div className="space-y-2">
                      {detail.contacts!.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">{contactLabel(contact)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {contact.job_title ?? contact.email ?? "—"}
                            </p>
                          </div>
                          {canManageContacts ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openContactForm(contact)}
                            >
                              {t("crm.common.edit", "Edit")}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title={t("crm.pipeline.deals", "Deals")}>
                  {(detail.opportunities ?? []).length === 0 ? (
                    <EmptyPanel label={t("crm.accounts.no_deals", "No deals linked yet.")} />
                  ) : (
                    <div className="space-y-2">
                      {(detail.opportunities as CrmOpportunity[]).map((deal) => (
                        <div
                          key={deal.id}
                          className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">{deal.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {deal.opportunity_number} · {deal.stage?.name ?? deal.status}
                            </p>
                          </div>
                          <span className="text-xs font-semibold tabular-nums">
                            {money(deal.amount, deal.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                {canLogActivities ? (
                  <Panel title={t("crm.activities.title", "Activities")}>
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t("crm.activities.type", "Type")}</Label>
                        <Select
                          value={activityForm.type}
                          onOpenChange={handlePickerOpenChange}
                          onValueChange={(v) =>
                            setActivityForm({
                              ...activityForm,
                              type: v as (typeof ACTIVITY_TYPES)[number],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTIVITY_TYPES.map((type) => (
                              <SelectItem key={type} value={type} className="capitalize">
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("crm.activities.due", "Due")}</Label>
                        <Input
                          type="date"
                          value={activityForm.due_at}
                          onChange={(event) =>
                            setActivityForm({ ...activityForm, due_at: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>{t("crm.activities.subject", "Subject")}</Label>
                        <Input
                          value={activityForm.subject}
                          onChange={(event) =>
                            setActivityForm({ ...activityForm, subject: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>{t("crm.activities.body", "Detail")}</Label>
                        <Textarea
                          rows={2}
                          value={activityForm.body}
                          onChange={(event) =>
                            setActivityForm({ ...activityForm, body: event.target.value })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Button
                          size="sm"
                          disabled={logActivity.isPending || !activityForm.subject.trim()}
                          onClick={() => logActivity.mutate()}
                        >
                          {logActivity.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          {t("crm.activities.add", "Log Activity")}
                        </Button>
                      </div>
                    </div>

                    {(detail.activities ?? []).length === 0 ? (
                      <p className="text-sm italic text-muted-foreground">
                        {t("crm.leads.no_activities", "No activities logged yet.")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.activities!.map((activity: CrmActivity) => (
                          <div
                            key={activity.id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium">{activity.subject}</p>
                              <p className="text-[11px] capitalize text-muted-foreground">
                                {activity.type} · {activity.status}
                              </p>
                            </div>
                            {activity.status === "planned" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px]"
                                disabled={activityBusyId === activity.id}
                                onClick={() => completeActivity.mutate(activity.id)}
                              >
                                {activityBusyId === activity.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  t("crm.activities.done", "Done")
                                )}
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>
                ) : null}
              </>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            {detailEditing ? (
              <>
                <Button variant="ghost" onClick={() => setDetailEditing(false)}>
                  {t("crm.common.cancel", "Cancel")}
                </Button>
                <Button
                  onClick={() => saveDetailAccount.mutate()}
                  disabled={saveDetailAccount.isPending || !detailForm.name.trim()}
                >
                  {saveDetailAccount.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("crm.common.save", "Save")}
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={closeDetail}>
                {t("crm.common.close", "Close")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAccountFor !== null} onOpenChange={(open) => !open && setDeleteAccountFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.accounts.archive_title", "Archive account")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "crm.accounts.archive_desc",
                  "The account is deactivated and removed from pickers. Deal history is kept.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDeleteAccountFor(null)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteAccount.isPending}
              onClick={() => deleteAccountFor && deleteAccount.mutate(deleteAccountFor.id)}
            >
              {deleteAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.accounts.archive", "Archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteContactFor !== null} onOpenChange={(open) => !open && setDeleteContactFor(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("crm.contacts.archive_title", "Archive contact")}
              </DialogTitle>
              <DialogDescription>
                {t("crm.contacts.archive_desc", "This contact will be removed from active lists.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDeleteContactFor(null)}>
              {t("crm.common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteContact.isPending}
              onClick={() => deleteContactFor && deleteContact.mutate(deleteContactFor.id)}
            >
              {deleteContact.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.contacts.archive", "Archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
