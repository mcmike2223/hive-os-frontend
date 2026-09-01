"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { PanelTableSkeleton } from "@/components/ui/loading-states";
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
import { hrFetch, type Employee as HrEmployee, type Paginated as HrPaginated } from "@/modules/humanresources/api";
import { SalesConfirmDialog, useSalesConfirmDialog } from "@/modules/sales/components/sales-confirm-dialog";
import { salesApi } from "@/modules/sales/api";
import type { SalesCustomer, SalesPriceList } from "@/modules/sales/types";
import { EmptyPanel } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function employeeLabel(employee: HrEmployee) {
  return `${employee.primary_name} (${employee.employee_number})`;
}

type CustomerForm = {
  id?: number;
  code: string;
  name: string;
  segment: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  tin: string;
  price_list_id: string;
  owner_employee_id: string;
  credit_limit: string;
  payment_terms_days: string;
  is_active: boolean;
  notes: string;
};

const DEFAULT_CUSTOMER: CustomerForm = {
  code: "",
  name: "",
  segment: "",
  email: "",
  phone: "",
  city: "",
  address: "",
  tin: "",
  price_list_id: "",
  owner_employee_id: "",
  credit_limit: "0",
  payment_terms_days: "0",
  is_active: true,
  notes: "",
};

export default function SalesCustomersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { requestConfirm, closeConfirm, confirmDialogProps } = useSalesConfirmDialog();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const [segmentFilter, setSegmentFilter] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<CustomerForm>(DEFAULT_CUSTOMER);
  const [archivingId, setArchivingId] = React.useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ["sales", "customers", tableQuery, statusFilter, segmentFilter, ownerFilter],
    queryFn: () =>
      salesApi
        .listCustomers({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          is_active:
            statusFilter === "all" ? undefined : statusFilter === "active" ? 1 : 0,
          segment: segmentFilter.trim() || undefined,
          owner_employee_id: ownerFilter === "all" ? undefined : Number(ownerFilter),
        })
        .then((res) => res.data),
  });

  const priceListsQuery = useQuery({
    queryKey: ["sales", "price-list-options"],
    queryFn: () => salesApi.listPriceLists({ limit: 100 }).then((res) => res.data),
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", "sales-owner-picker"],
    queryFn: () => hrFetch<HrPaginated<HrEmployee>>("/employees?per_page=200"),
    enabled: true,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code,
        name: form.name,
        segment: form.segment || null,
        email: form.email || null,
        phone: form.phone || null,
        city: form.city || null,
        address: form.address || null,
        tin: form.tin || null,
        price_list_id: form.price_list_id ? Number(form.price_list_id) : null,
        owner_employee_id: form.owner_employee_id ? Number(form.owner_employee_id) : null,
        credit_limit: Number(form.credit_limit || 0),
        payment_terms_days: Number(form.payment_terms_days || 0),
        is_active: form.is_active,
        notes: form.notes || null,
      };

      return form.id ? salesApi.updateCustomer(form.id, payload) : salesApi.createCustomer(payload);
    },
    onSuccess: () => {
      toast.success(t("sales.customers.saved", "Customer saved."));
      invalidate();
      setOpen(false);
      setForm(DEFAULT_CUSTOMER);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.customers.save_failed", "Could not save the customer."))),
  });

  const archive = useMutation({
    mutationFn: (id: number) => {
      setArchivingId(id);
      return salesApi.deleteCustomer(id);
    },
    onSuccess: () => {
      toast.success(t("sales.customers.archived", "Customer archived; their order history is kept."));
      invalidate();
      closeConfirm();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.customers.archive_failed", "Could not archive them."))),
    onSettled: () => setArchivingId(null),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const priceLists = (priceListsQuery.data?.data ?? []) as SalesPriceList[];
  const employees = employeesQuery.data?.data ?? [];

  const columns = React.useMemo<ColumnDef<SalesCustomer>[]>(
    () => [
      {
        id: "customer",
        header: t("sales.customers.customer", "Customer"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      {
        accessorKey: "segment",
        header: t("sales.customers.segment", "Segment"),
        cell: ({ row }) =>
          row.original.segment ? (
            <Badge variant="outline" className="text-[11px] capitalize">
              {row.original.segment.replace(/_/g, " ")}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "contact",
        header: t("sales.customers.contact", "Contact"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.phone ?? "—"}</p>
            <p className="text-muted-foreground">{row.original.city ?? ""}</p>
          </div>
        ),
      },
      {
        id: "price_list",
        header: t("sales.customers.price_list", "Price list"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.price_list?.name ??
              t("sales.customers.default_list", "Tenant default")}
          </span>
        ),
      },
      {
        id: "credit",
        header: t("sales.customers.credit", "Credit"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs tabular-nums">
            <p>
              {n(row.original.credit_limit) > 0
                ? money(row.original.credit_limit)
                : t("sales.customers.no_limit", "No limit")}
            </p>
            <p className="text-muted-foreground">
              {row.original.payment_terms_days} {t("sales.common.days", "days")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("sales.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? "default" : "secondary"} className="text-[11px]">
            {row.original.is_active
              ? t("sales.common.active", "Active")
              : t("sales.common.inactive", "Inactive")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const isArchiving = archivingId === row.original.id;
          return (
            <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={isArchiving}
              onClick={() => {
                setForm({
                  id: row.original.id,
                  code: row.original.code,
                  name: row.original.name,
                  segment: row.original.segment ?? "",
                  email: row.original.email ?? "",
                  phone: row.original.phone ?? "",
                  city: row.original.city ?? "",
                  address: row.original.address ?? "",
                  tin: row.original.tin ?? "",
                  price_list_id: row.original.price_list_id ? String(row.original.price_list_id) : "",
                  owner_employee_id: row.original.owner_employee_id
                    ? String(row.original.owner_employee_id)
                    : "",
                  credit_limit: String(n(row.original.credit_limit)),
                  payment_terms_days: String(row.original.payment_terms_days ?? 0),
                  is_active: row.original.is_active,
                  notes: row.original.notes ?? "",
                });
                setOpen(true);
              }}
            >
              {t("sales.common.edit", "Edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={isArchiving}
              onClick={() => {
                requestConfirm({
                  title: t("sales.customers.archive_title", "Archive Customer"),
                  description: t("sales.customers.archive_confirm", "Archive this customer? Their order history will be kept."),
                  confirmLabel: t("sales.common.archive", "Archive"),
                  onConfirm: () => archive.mutate(row.original.id),
                });
              }}
              aria-label={t("sales.common.archive", "Archive")}
            >
              {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
          );
        },
      },
    ],
    [t, archive, archivingId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("sales.customers.title", "Customer Accounts")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "sales.customers.subtitle",
              "Who buys, on what terms, and against which price list.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setForm(DEFAULT_CUSTOMER);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("sales.customers.add", "Add Customer")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("sales.common.status", "Status")}</Label>
          <Select
            value={statusFilter}
            onValueChange={(value: "all" | "active" | "inactive") => {
              setStatusFilter(value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("sales.common.all", "All")}</SelectItem>
              <SelectItem value="active">{t("sales.common.active", "Active")}</SelectItem>
              <SelectItem value="inactive">{t("sales.common.inactive", "Inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("sales.customers.segment", "Segment")}</Label>
          <Input
            value={segmentFilter}
            onChange={(event) => {
              setSegmentFilter(event.target.value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
            placeholder={t("sales.customers.segment_hint", "wholesale, retail, key account")}
            className="h-9 w-[13rem]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("sales.customers.owner", "Account manager")}</Label>
          <Select
            value={ownerFilter}
            onValueChange={(value) => {
              setOwnerFilter(value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="h-9 w-[14rem]">
              <SelectValue placeholder={t("sales.common.select", "Select...")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("sales.common.all", "All")}</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={String(employee.id)}>
                  {employeeLabel(employee)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {employeesQuery.isError ? (
            <p className="text-[11px] text-muted-foreground">
              {t("sales.customers.owner_picker_unavailable", "Employee directory unavailable.")}
            </p>
          ) : null}
        </div>
      </div>

      {listQuery.isPending ? (
        <PanelTableSkeleton rows={8} cols={6} />
      ) : listQuery.isError ? (
        <EmptyPanel label={t("sales.customers.load_failed", "Could not load customers.")} />
      ) : (
        <DataTable
          columns={columns}
          data={(listQuery.data?.data ?? []) as SalesCustomer[]}
          totalEntries={listQuery.data?.meta?.total ?? 0}
          loading={listQuery.isFetching && !listQuery.isPending}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("sales.customers.search", "Search customers...")}
          resourceName="sales-customers"
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {form.id
                  ? t("sales.customers.edit_title", "Edit Customer")
                  : t("sales.customers.new_title", "New Customer")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "sales.customers.form_desc",
                  "A credit limit of zero means no limit was agreed, not a limit of nothing.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cust-code">{t("sales.common.code", "Code")}</Label>
              <Input
                id="cust-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="CUST-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">{t("sales.common.name", "Name")}</Label>
              <Input
                id="cust-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-segment">{t("sales.customers.segment", "Segment")}</Label>
              <Input
                id="cust-segment"
                value={form.segment}
                onChange={(event) => setForm({ ...form, segment: event.target.value })}
                placeholder={t("sales.customers.segment_hint", "wholesale, retail, key account")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-list">{t("sales.customers.price_list", "Price list")}</Label>
              <Select
                value={form.price_list_id || "none"}
                onValueChange={(value) => setForm({ ...form, price_list_id: value === "none" ? "" : value })}
              >
                <SelectTrigger id="cust-list" className="h-9 w-full">
                  <SelectValue placeholder={t("sales.customers.default_list", "Tenant default")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("sales.customers.default_list", "Tenant default")}</SelectItem>
                {priceLists.map((list) => (
                  <SelectItem key={list.id} value={String(list.id)}>
                    {list.name}
                  </SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone">{t("sales.customers.phone", "Phone")}</Label>
              <Input
                id="cust-phone"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-email">{t("sales.customers.email", "Email")}</Label>
              <Input
                id="cust-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-city">{t("sales.customers.city", "City")}</Label>
              <Input
                id="cust-city"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-tin">{t("sales.customers.tin", "TIN")}</Label>
              <Input
                id="cust-tin"
                value={form.tin}
                onChange={(event) => setForm({ ...form, tin: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-limit">{t("sales.customers.credit_limit", "Credit limit")}</Label>
              <Input
                id="cust-limit"
                type="number"
                min={0}
                value={form.credit_limit}
                onChange={(event) => setForm({ ...form, credit_limit: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-terms">{t("sales.customers.terms", "Payment terms (days)")}</Label>
              <Input
                id="cust-terms"
                type="number"
                min={0}
                max={365}
                value={form.payment_terms_days}
                onChange={(event) => setForm({ ...form, payment_terms_days: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-owner">{t("sales.customers.owner", "Account manager")}</Label>
              {employeesQuery.isError ? (
                <Input
                  id="cust-owner"
                  type="number"
                  value={form.owner_employee_id}
                  onChange={(event) => setForm({ ...form, owner_employee_id: event.target.value })}
                  placeholder={t("sales.customers.owner_id_fallback", "Account manager ID")}
                />
              ) : (
                <Select
                  value={form.owner_employee_id || "none"}
                  onValueChange={(value) => setForm({ ...form, owner_employee_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger id="cust-owner" className="h-9 w-full">
                    <SelectValue placeholder={t("sales.common.select", "Select...")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("sales.common.select", "Select...")}</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={String(employee.id)}>
                        {employeeLabel(employee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="cust-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label htmlFor="cust-active">{t("sales.common.active", "Active")}</Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cust-address">{t("sales.customers.address", "Address")}</Label>
              <Textarea
                id="cust-address"
                rows={2}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cust-notes">{t("sales.common.notes", "Notes")}</Label>
              <Textarea
                id="cust-notes"
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("sales.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.code.trim() || !form.name.trim()}
            >
              {t("sales.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SalesConfirmDialog
        {...confirmDialogProps}
        pending={archive.isPending}
      />
    </div>
  );
}
