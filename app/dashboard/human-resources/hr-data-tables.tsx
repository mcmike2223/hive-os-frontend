"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type DataTableQuery,
} from "@/components/datatable/data-table";
import { Label } from "@/components/ui/label";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import {
  Employee,
  OrganizationUnit,
  Paginated,
  Position,
  hrFetch,
} from "@/modules/humanresources/api";

type QueryState = Required<Pick<DataTableQuery, "page" | "search">> & {
  pageSize: number;
  sortCol: string | null;
  sortDir: "asc" | "desc" | null;
};

const initialQuery: QueryState = {
  page: 1,
  pageSize: 25,
  search: "",
  sortCol: null,
  sortDir: null,
};

const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";

function queryString(query: QueryState, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    page: String(query.page),
    per_page: String(query.pageSize),
  });
  if (query.search) params.set("search", query.search);
  if (query.sortCol) params.set("sort", query.sortCol);
  if (query.sortDir) params.set("direction", query.sortDir);
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function useTableQuery() {
  const [query, setQuery] = useState<QueryState>(initialQuery);
  const onQueryChange = useCallback((next: DataTableQuery) => {
    setQuery({
      page: next.page,
      pageSize: next.pageSize ?? 25,
      search: next.search,
      sortCol: next.sortCol ?? null,
      sortDir: next.sortDir ?? null,
    });
  }, []);
  return { query, onQueryChange };
}

function StatusBadge({ status }: { status: string }) {
  const positive = ["active", "approved", "present"].includes(status);
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize",
        positive
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function EmployeeDirectoryDataTable({
  canManage,
  onEdit,
  onViewProfile,
  onTransfer,
  statusOptions,
  units = [],
  positions = [],
}: {
  canManage: boolean;
  onEdit: (employee: Employee) => void;
  onViewProfile?: (employee: Employee) => void;
  onTransfer?: (employee: Employee) => void;
  statusOptions: Array<{ code: string; label: string }>;
  units?: OrganizationUnit[];
  positions?: Position[];
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { query, onQueryChange } = useTableQuery();
  const [status, setStatus] = useState("");
  const [unitId, setUnitId] = useState("");
  const [positionId, setPositionId] = useState("");

  const employees = useQuery({
    queryKey: ["hr-employees-table", scope, query, status, unitId, positionId],
    queryFn: () =>
      hrFetch<Paginated<Employee>>(
        `/employees?${queryString(query, { status, organization_unit_id: unitId, position_id: positionId })}`,
      ),
  });

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        accessorKey: "primary_name",
        header: "Employee",
        cell: ({ row }) => (
          <div>
            <div className="font-bold text-foreground">
              {row.original.primary_name}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {row.original.employee_number}
              {row.original.work_email ? ` · ${row.original.work_email}` : ""}
            </div>
          </div>
        ),
      },
      {
        id: "assignment",
        header: "Assignment",
        enableSorting: false,
        cell: ({ row }) => (
          <div>
            <div>
              {row.original.primary_assignment?.position?.title ?? "Unassigned"}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {row.original.primary_assignment?.organization_unit?.name ??
                "No organization unit"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "employment_status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.employment_status} />
        ),
      },
      {
        accessorKey: "contract_started_on",
        header: "Contract",
        cell: ({ row }) => (
          <div>
            <div className="capitalize">
              {row.original.contract_type.replaceAll("_", " ")}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Started {row.original.contract_started_on}
            </div>
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { align: "right", exportable: false, printable: false },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            {onViewProfile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onViewProfile(row.original)}
                className="h-9 px-2.5 border-slate-400 text-xs font-bold"
              >
                Profile 360
              </Button>
            )}
            {canManage && onTransfer && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onTransfer(row.original)}
                className="h-9 px-2.5 border-slate-400 text-xs font-bold"
              >
                Transfer
              </Button>
            )}
            {canManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(row.original)}
                className="h-9 px-2.5 border-slate-400 text-xs font-bold"
              >
                <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canManage, onEdit, onViewProfile, onTransfer],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="employee-status-filter">Employment Status Filter</Label>
          <select
            id="employee-status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={cn(selectClass, "mt-2")}
          >
            <option value="">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="employee-unit-filter">Organization Unit Filter</Label>
          <select
            id="employee-unit-filter"
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
            className={cn(selectClass, "mt-2")}
          >
            <option value="">All Organization Units</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="employee-position-filter">Job Position Filter</Label>
          <select
            id="employee-position-filter"
            value={positionId}
            onChange={(event) => setPositionId(event.target.value)}
            className={cn(selectClass, "mt-2")}
          >
            <option value="">All Job Positions</option>
            {positions.map((pos) => (
              <option key={pos.id} value={pos.id}>
                {pos.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={employees.data?.data ?? []}
        totalEntries={employees.data?.meta.total ?? 0}
        loading={employees.isLoading || employees.isFetching}
        pageIndex={query.page}
        pageSize={query.pageSize}
        onQueryChange={onQueryChange}
        onRefresh={() =>
          queryClient.invalidateQueries({
            queryKey: ["hr-employees-table", scope],
          })
        }
        caption="Employee directory with assignments, employment status, and contract details."
        searchPlaceholder="Search by name, employee number, or work email"
        resourceName="employees"
        syncWithUrl={false}
        canCopy={false}
        canExport={false}
        canPrint={false}
      />
    </div>
  );
}

export function OrganizationDataTable() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { query, onQueryChange } = useTableQuery();
  const units = useQuery({
    queryKey: ["hr-organization-table", scope, query],
    queryFn: () =>
      hrFetch<Paginated<OrganizationUnit>>(
        `/organization-units?${queryString(query)}`,
      ),
  });
  const columns = useMemo<ColumnDef<OrganizationUnit>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Unit",
        cell: ({ row }) => (
          <div>
            <div className="font-bold">{row.original.name}</div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              {row.original.code}
            </div>
          </div>
        ),
      },
      { accessorKey: "unit_type", header: "Type" },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => row.original.location ?? "—",
      },
      {
        accessorKey: "positions_count",
        header: "Positions",
        cell: ({ row }) => row.original.positions_count ?? 0,
      },
      {
        accessorKey: "active_assignments_count",
        header: "Employees",
        cell: ({ row }) => row.original.active_assignments_count ?? 0,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={units.data?.data ?? []}
      totalEntries={units.data?.meta.total ?? 0}
      loading={units.isLoading || units.isFetching}
      pageIndex={query.page}
      pageSize={query.pageSize}
      onQueryChange={onQueryChange}
      onRefresh={() =>
        queryClient.invalidateQueries({
          queryKey: ["hr-organization-table", scope],
        })
      }
      caption="Organization units and their current workforce footprint."
      searchPlaceholder="Search organization units"
      resourceName="organization units"
      syncWithUrl={false}
      canCopy={false}
      canExport={false}
      canPrint={false}
    />
  );
}

export function PositionDataTable() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { query, onQueryChange } = useTableQuery();
  const positions = useQuery({
    queryKey: ["hr-positions-table", scope, query],
    queryFn: () =>
      hrFetch<Paginated<Position>>(`/positions?${queryString(query)}`),
  });
  const columns = useMemo<ColumnDef<Position>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Position",
        cell: ({ row }) => (
          <div>
            <div className="font-bold">{row.original.title}</div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              {row.original.code}
            </div>
          </div>
        ),
      },
      {
        id: "organization_unit",
        header: "Organization unit",
        enableSorting: false,
        cell: ({ row }) => row.original.organization_unit?.name ?? "—",
      },
      { accessorKey: "authorized_headcount", header: "Authorized" },
      { accessorKey: "occupied_headcount", header: "Occupied" },
      {
        accessorKey: "vacant_headcount",
        header: "Vacant",
        cell: ({ row }) => (
          <span className="font-black">{row.original.vacant_headcount}</span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={positions.data?.data ?? []}
      totalEntries={positions.data?.meta.total ?? 0}
      loading={positions.isLoading || positions.isFetching}
      pageIndex={query.page}
      pageSize={query.pageSize}
      onQueryChange={onQueryChange}
      onRefresh={() =>
        queryClient.invalidateQueries({
          queryKey: ["hr-positions-table", scope],
        })
      }
      caption="Authorized positions, occupied seats, and current vacancies."
      searchPlaceholder="Search positions"
      resourceName="positions"
      syncWithUrl={false}
      canCopy={false}
      canExport={false}
      canPrint={false}
    />
  );
}
