"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
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
import { usePermissions } from "@/hooks/use-permissions";
import { hrFetch, type Employee as HrEmployee, type Paginated as HrPaginated } from "@/modules/humanresources/api";
import { serviceApi } from "@/modules/service/api";
import type { ServiceTechnician } from "@/modules/service/types";
import { EmptyPanel } from "@/modules/shared/charts/primitives";

const DEFAULT_FORM = {
  employee_id: "",
  name: "",
  phone: "",
  skills: "",
  hourly_rate: "",
  status: "active",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function employeeLabel(employee: HrEmployee) {
  return `${employee.primary_name} (${employee.employee_number})`;
}

function technicianToForm(technician: ServiceTechnician) {
  return {
    employee_id: technician.employee_id ? String(technician.employee_id) : "",
    name: technician.name,
    phone: technician.phone ?? "",
    skills: technician.skills ?? "",
    hourly_rate: String(n(technician.hourly_rate)),
    status: technician.status || "active",
  };
}

function buildPayload(values: typeof DEFAULT_FORM) {
  return {
    employee_id: values.employee_id ? Number(values.employee_id) : null,
    name: values.name.trim(),
    phone: values.phone.trim() || null,
    skills: values.skills.trim() || null,
    hourly_rate: Number(values.hourly_rate || 0),
    status: values.status,
  };
}

export default function ServiceEngineersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_service_technicians", "manage_service"]);

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [formId, setFormId] = React.useState<number | undefined>();
  const [form, setForm] = React.useState({ ...DEFAULT_FORM });

  const listQuery = useQuery({
    queryKey: ["service", "technicians", tableQuery, statusFilter],
    queryFn: () =>
      serviceApi
        .listTechnicians({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        })
        .then((res) => res.data),
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", "service-engineers"],
    queryFn: () => hrFetch<HrPaginated<HrEmployee>>("/employees?per_page=200"),
  });

  const employeeById = React.useMemo(() => {
    const map = new Map<number, HrEmployee>();
    for (const employee of employeesQuery.data?.data ?? []) {
      map.set(employee.id, employee);
    }
    return map;
  }, [employeesQuery.data]);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["service"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const save = useMutation({
    mutationFn: () =>
      formId
        ? serviceApi.updateTechnician(formId, buildPayload(form))
        : serviceApi.createTechnician(buildPayload(form)),
    onSuccess: () => {
      toast.success(
        formId
          ? t("service.engineers.updated", "Engineer updated.")
          : t("service.engineers.saved", "Engineer saved."),
      );
      invalidate();
      setFormOpen(false);
      setFormId(undefined);
      setForm({ ...DEFAULT_FORM });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.engineers.save_failed", "Could not save the engineer."))),
  });

  const openCreate = React.useCallback(() => {
    setFormId(undefined);
    setForm({ ...DEFAULT_FORM });
    setFormOpen(true);
  }, []);

  const openEdit = React.useCallback((technician: ServiceTechnician) => {
    setFormId(technician.id);
    setForm(technicianToForm(technician));
    setFormOpen(true);
  }, []);

  const handleEmployeeChange = React.useCallback(
    (employeeId: string) => {
      if (!employeeId || employeeId === "none") {
        setForm((prev) => ({ ...prev, employee_id: "" }));
        return;
      }
      const employee = employeeById.get(Number(employeeId));
      setForm((prev) => ({
        ...prev,
        employee_id: employeeId,
        name: employee?.primary_name ?? prev.name,
        phone: employee?.phone ?? prev.phone,
      }));
    },
    [employeeById],
  );

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const columns = React.useMemo<ColumnDef<ServiceTechnician>[]>(
    () => [
      {
        id: "name",
        header: t("service.engineers.name", "Name"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            {row.original.employee_id ? (
              <p className="text-[11px] text-muted-foreground">
                {employeeById.get(row.original.employee_id)
                  ? employeeLabel(employeeById.get(row.original.employee_id)!)
                  : t("service.engineers.linked_employee", "HR employee #{id}").replace(
                      "{id}",
                      String(row.original.employee_id),
                    )}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("service.engineers.external", "External / contractor")}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "skills",
        header: t("service.engineers.skills", "Skills"),
        cell: ({ row }) => row.original.skills ?? "—",
      },
      {
        id: "rate",
        header: t("service.engineers.hourly_rate", "Hourly rate"),
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.hourly_rate)}/hr</span>,
      },
      {
        id: "jobs",
        header: t("service.engineers.open_jobs", "Open jobs"),
        cell: ({ row }) => n(row.original.work_orders_count).toLocaleString(),
      },
      {
        id: "status",
        header: t("service.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant={row.original.status === "active" ? "outline" : "secondary"} className="capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/dashboard/service/work-orders?technician_id=${row.original.id}`}>
                {t("service.engineers.view_jobs", "Jobs")}
              </Link>
            </Button>
            {canManage ? (
              <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)} aria-label={t("service.common.edit", "Edit")}>
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canManage, employeeById, openEdit, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("service.engineers.title", "Engineers")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "service.engineers.subtitle",
              "Field engineers who get assigned to visits. Labour cost on a completed job is hours × hourly rate.",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => invalidate()} disabled={listQuery.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            {t("service.common.refresh", "Refresh")}
          </Button>
          {canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("service.engineers.add", "Add engineer")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("service.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setTableQuery((p) => ({ ...p, page: 1 })); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.all", "All")}</SelectItem>
              <SelectItem value="active">{t("service.engineers.active", "Active")}</SelectItem>
              <SelectItem value="inactive">{t("service.engineers.inactive", "Inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {listQuery.isPending ? (
        <EmptyPanel label={t("service.common.loading", "Loading...")} />
      ) : listQuery.isError ? (
        <EmptyPanel label={t("service.engineers.load_failed", "Could not load engineers.")} />
      ) : (
        <DataTable
          columns={columns}
          data={(listQuery.data?.data ?? []) as ServiceTechnician[]}
          totalEntries={listQuery.data?.meta?.total ?? 0}
          loading={listQuery.isFetching && !listQuery.isPending}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("service.engineers.search", "Search engineers...")}
          resourceName="service-engineers"
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {formId
                  ? t("service.engineers.edit", "Edit engineer")
                  : t("service.engineers.add", "Add engineer")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.engineers.form_desc",
                  "Link an HR employee when you have one, or leave blank for an external contractor.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("service.engineers.employee", "HR employee")}</Label>
              {employeesQuery.isError ? (
                <Input
                  type="number"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  placeholder={t("service.engineers.employee_optional", "Optional")}
                />
              ) : (
                <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                  <Select value={form.employee_id || "none"} onValueChange={handleEmployeeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("service.engineers.employee_optional", "Optional")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("service.engineers.external", "External / contractor")}</SelectItem>
                      {(employeesQuery.data?.data ?? []).map((employee) => (
                        <SelectItem key={employee.id} value={String(employee.id)}>
                          {employeeLabel(employee)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="eng-name">{t("service.engineers.name", "Name")}</Label>
              <Input
                id="eng-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eng-phone">{t("service.engineers.phone", "Phone")}</Label>
              <Input
                id="eng-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eng-rate">{t("service.engineers.hourly_rate", "Hourly rate")}</Label>
              <Input
                id="eng-rate"
                type="number"
                min={0}
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="eng-skills">{t("service.engineers.skills", "Skills")}</Label>
              <Input
                id="eng-skills"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder={t("service.engineers.skills_hint", "mechanical, electrical")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("service.common.status", "Status")}</Label>
              <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("service.engineers.active", "Active")}</SelectItem>
                    <SelectItem value="inactive">{t("service.engineers.inactive", "Inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button disabled={save.isPending || !form.name.trim()} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
