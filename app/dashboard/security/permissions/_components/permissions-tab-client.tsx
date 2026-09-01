"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Key, BookOpen, Shield, RefreshCw, Loader2, Filter, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/datatable/data-table";
import { fetchPermissions } from "@/lib/api";
import { logFrontendAction } from "@/modules/core/api";
import api from "@/modules/shared/api/http";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/store/use-translation";
import { toast } from "sonner";

type PermissionRecord = {
  id: number | string;
  name: string;
  guard_name?: string;
};

type TableQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortCol?: string | null;
  sortDir?: string | null;
};

export function PermissionsTabClient({ tenantId }: { tenantId: string | null }) {
  const isCentralAdmin = !tenantId;
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canSeed = hasAnyPermission(["manage_permissions", "seed_permissions"]);
  const canExport = hasAnyPermission(["view_permissions", "export_permissions", "manage_permissions"]);

  const globalActionLock = React.useRef<Record<string, number>>({});
  const triggerAudit = React.useCallback(async (action: string, description: string) => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    const payloadKey = `${action}_${description}`;
    if (globalActionLock.current[payloadKey] && now - globalActionLock.current[payloadKey] < 800) return;
    globalActionLock.current[payloadKey] = now;
    try {
      await logFrontendAction({ module: 'Roles & Permissions', action, description });
    } catch (e) {}
  }, []);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = useLocalStorage<number>("permissions_table_page_size", 10);
  const [search, setSearch] = React.useState("");
  const [sortCol, setSortCol] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<string | null>(null);
  const [tableKey, setTableKey] = React.useState(0);

  // 🚀 ADVANCED FILTERS
  const [moduleFilter, setModuleFilter] = React.useState<string>("all");
  const [actionFilter, setActionFilter] = React.useState<string>("all");
  const [scopeFilter, setScopeFilter] = React.useState<string>("all");

  const { data: permissionsData, isLoading } = useQuery({
    queryKey: ["permissions", tenantId],
    queryFn: async () => {
      const res = await fetchPermissions();
      return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    },
  });

  const processedData = React.useMemo(() => {
    let result = [...(permissionsData || [])];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }

    // Module / Domain filter
    if (moduleFilter !== "all") {
      result = result.filter(p => {
        const name = p.name.toLowerCase();
        if (moduleFilter === "identity") {
          return name.includes("user") || name.includes("role") || name.includes("permission") || name.includes("clearance") || name.includes("impersonat");
        }
        if (moduleFilter === "tenancy") {
          return name.includes("tenant") || name.includes("subscription") || name.includes("domain") || name.includes("node");
        }
        if (moduleFilter === "hr") {
          return name.includes("employee") || name.includes("department") || name.includes("designation") || name.includes("payroll") || name.includes("attendance") || name.includes("leave") || name.includes("staff");
        }
        if (moduleFilter === "inventory") {
          return name.includes("product") || name.includes("inventory") || name.includes("category") || name.includes("brand") || name.includes("stock") || name.includes("warehouse") || name.includes("shelf") || name.includes("box") || name.includes("supplier");
        }
        if (moduleFilter === "core") {
          return name.includes("setting") || name.includes("activity") || name.includes("audit") || name.includes("backup") || name.includes("log") || name.includes("general");
        }
        return true;
      });
    }

    // Action Type filter
    if (actionFilter !== "all") {
      result = result.filter(p => {
        const name = p.name.toLowerCase();
        if (actionFilter === "view") {
          return name.startsWith("view_") || name.startsWith("read_") || name.startsWith("show_") || name.startsWith("list_");
        }
        if (actionFilter === "manage") {
          return name.startsWith("manage_") || name.startsWith("create_") || name.startsWith("edit_") || name.startsWith("update_");
        }
        if (actionFilter === "delete") {
          return name.startsWith("delete_") || name.startsWith("purge_") || name.startsWith("destroy_") || name.startsWith("remove_");
        }
        if (actionFilter === "admin") {
          return name.startsWith("impersonate_") || name.startsWith("seed_") || name.startsWith("bypass_") || name.startsWith("super_");
        }
        return true;
      });
    }

    // Security Scope filter
    if (scopeFilter !== "all") {
      result = result.filter(p => {
        if (scopeFilter === "tenant") return p.guard_name === "tenant";
        if (scopeFilter === "central") return p.guard_name === "web" || !p.guard_name;
        return true;
      });
    }

    // Sorting
    if (sortCol) {
      result.sort((a, b) => {
        const aVal = String(a[sortCol as keyof PermissionRecord] ?? "").toLowerCase();
        const bVal = String(b[sortCol as keyof PermissionRecord] ?? "").toLowerCase();
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [permissionsData, search, moduleFilter, actionFilter, scopeFilter, sortCol, sortDir]);

  const paginatedData = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return processedData.slice(start, end);
  }, [processedData, page, pageSize]);

  const generateDescription = (name: string) => {
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const handleQueryChange = React.useCallback((q: TableQuery) => {
    if (q.page !== undefined) setPage(q.page);
    if (q.pageSize !== undefined) setPageSize(q.pageSize);
    if (q.search !== undefined) setSearch(q.search);
    if (q.sortCol !== undefined) setSortCol(q.sortCol);
    if (q.sortDir !== undefined) setSortDir(q.sortDir);
  }, [setPageSize]);

  const resetFilters = React.useCallback(() => {
    setSearch("");
    setSortCol(null);
    setSortDir(null);
    setModuleFilter("all");
    setActionFilter("all");
    setScopeFilter("all");
    setPage(1);
    setTableKey((prev) => prev + 1);
    triggerAudit('filtered', 'Reset all Capability Dictionary filters');
  }, [triggerAudit]);

  const seedPermissionsMut = useMutation({
    mutationFn: async () => {
      const endpoint = isCentralAdmin ? '/permissions/seed' : '/tenant/permissions/seed';
      const res = await api.post(endpoint);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      toast.success(data.message || t('permissions.seeded', 'Permissions seeded successfully'));
      triggerAudit('created', 'Triggered automated Capability Dictionary protocol seeding');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || t('permissions.seed_failed', 'Failed to seed permissions'));
    },
  });

  const columns = React.useMemo<ColumnDef<PermissionRecord>[]>(() => [
    {
      id: "name", accessorKey: "name", header: t('permissions.col_code', "Capability Code"), enableSorting: true,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
          <span className="font-mono font-bold tracking-tight text-sm">{row.original.name}</span>
        </div>
      ),
    },
    {
      id: "description",
      accessorFn: (row) => `${t('permissions.allows_operator', 'Allows the operator to')} ${generateDescription(row.name)} ${t('permissions.within_env', 'within the active environment.')}`,
      header: t('permissions.col_desc', "Human-Readable Context"), enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {t('permissions.allows_operator', 'Allows the operator to')} <strong className="text-foreground font-medium">{generateDescription(row.original.name)}</strong> {t('permissions.within_env', 'within the active environment.')}
        </span>
      ),
    },
    {
      id: "guard_name",
      accessorFn: (row) => row.guard_name === 'tenant' ? t('permissions.tenant_node', 'Tenant Node') : t('permissions.central', 'Central Command'),
      header: t('permissions.col_scope', "Security Scope"), enableSorting: true,
      cell: ({ row }) => {
        const isTenant = row.original.guard_name === 'tenant';
        return (
          <Badge variant={isTenant ? "outline" : "secondary"} className={cn("font-mono text-[11px] uppercase tracking-widest", isTenant ? "text-indigo-600 border-indigo-200 bg-indigo-50/50" : "text-amber-600 bg-amber-50/50")}>
            <Shield className="h-3 w-3 mr-1" />
            {isTenant ? t('permissions.tenant_node', "Tenant Node") : t('permissions.central', "Central Command")}
          </Badge>
        );
      },
    },
  ], [page, pageSize, t, locale]);

  const exportUrl = `${isCentralAdmin ? '' : '/tenant'}/permissions/export?module=${moduleFilter}&action=${actionFilter}&scope=${scopeFilter}&search=${encodeURIComponent(search)}&sortCol=${sortCol || ""}&sortDir=${sortDir || ""}&locale=${locale}`;

  return (
    <div className="space-y-4">
      <div id="tour-permissions-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card/40 p-6 rounded-[2rem] border border-border/50 backdrop-blur-md shadow-sm gap-4 mt-2">
        <div>
          <h2 className="text-2xl font-black font-space flex items-center gap-2 tracking-tight">
            <BookOpen className="h-6 w-6 text-primary" /> {t('permissions.title', 'Capability Dictionary')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('permissions.subtitle', 'A read-only glossary of all hardcoded network capabilities available in the system.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canSeed && processedData.length === 0 && !isLoading && (
            <Button
              onClick={() => seedPermissionsMut.mutate()}
              disabled={seedPermissionsMut.isPending}
              className="rounded-xl shadow-lg shadow-primary/20 h-11 px-6 font-bold tracking-wide"
            >
              {seedPermissionsMut.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-5 w-5" />
              )}
              {t('permissions.seed_permissions', 'Seed Permissions')}
            </Button>
          )}
          <Badge variant="outline" className="px-4 py-1.5 text-xs font-mono uppercase tracking-widest border-dashed text-muted-foreground bg-background">
            {processedData.length} {t('permissions.indexed', 'Indexed Protocols')}
          </Badge>
        </div>
      </div>

      {/* 🚀 PERMISSIONS ADVANCED FILTERS BAR */}
      <div id="tour-permissions-filters" className="bg-card border border-border/50 rounded-xl p-3 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-muted-foreground shrink-0 pl-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">{t('permissions.filters', 'Filters:')}</span>
        </div>

        {/* Module / Domain Filter */}
        <Select value={moduleFilter} onValueChange={(val) => { setModuleFilter(val); setPage(1); triggerAudit('filtered', `Filtered permissions by module: ${val}`); }}>
          <SelectTrigger aria-label={t('permissions.filter_module', 'Filter by module')} className="h-9 w-[170px] bg-background">
            <SelectValue placeholder={t('permissions.filter_module', 'Module Domain')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('permissions.all_modules', 'All Module Domains')}</SelectItem>
            <SelectItem value="identity">{t('permissions.module_identity', 'Users & Identity')}</SelectItem>
            <SelectItem value="tenancy">{t('permissions.module_tenancy', 'Tenants & Orgs')}</SelectItem>
            <SelectItem value="hr">{t('permissions.module_hr', 'HR & Payroll')}</SelectItem>
            <SelectItem value="inventory">{t('permissions.module_inventory', 'Inventory & Warehouses')}</SelectItem>
            <SelectItem value="core">{t('permissions.module_core', 'Core & Settings')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Action Type Filter */}
        <Select value={actionFilter} onValueChange={(val) => { setActionFilter(val); setPage(1); triggerAudit('filtered', `Filtered permissions by action type: ${val}`); }}>
          <SelectTrigger aria-label={t('permissions.filter_action', 'Filter by action type')} className="h-9 w-[160px] bg-background">
            <SelectValue placeholder={t('permissions.filter_action', 'Action Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('permissions.all_actions', 'All Actions')}</SelectItem>
            <SelectItem value="view">{t('permissions.action_view', 'View & Read')}</SelectItem>
            <SelectItem value="manage">{t('permissions.action_manage', 'Manage & Write')}</SelectItem>
            <SelectItem value="delete">{t('permissions.action_delete', 'Delete & Purge')}</SelectItem>
            <SelectItem value="admin">{t('permissions.action_admin', 'Administrative')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Scope Filter */}
        <Select value={scopeFilter} onValueChange={(val) => { setScopeFilter(val); setPage(1); triggerAudit('filtered', `Filtered permissions by scope: ${val}`); }}>
          <SelectTrigger aria-label={t('permissions.filter_scope', 'Filter by scope')} className="h-9 w-[160px] bg-background">
            <SelectValue placeholder={t('permissions.filter_scope', 'Security Scope')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('permissions.all_scopes', 'All Scopes')}</SelectItem>
            <SelectItem value="central">{t('permissions.central', 'Central Command')}</SelectItem>
            <SelectItem value="tenant">{t('permissions.tenant_node', 'Tenant Node')}</SelectItem>
          </SelectContent>
        </Select>

        {(moduleFilter !== "all" || actionFilter !== "all" || scopeFilter !== "all" || search) && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-3 text-destructive hover:bg-destructive/10">
            <X className="mr-1 h-4 w-4" /> {t('global.clear', 'Clear')}
          </Button>
        )}
      </div>

      <DataTable
        key={`${tableKey}-${locale}`}
        columns={columns}
        data={paginatedData}
        totalEntries={processedData.length}
        loading={isLoading}
        exportEndpoint={canExport ? exportUrl : undefined}
        resourceName="permissions"
        enableRowSelection={false}
        pageIndex={page}
        pageSize={pageSize}
        onQueryChange={handleQueryChange}
        onResetFilters={resetFilters}
        onCopy={canExport ? () => triggerAudit('copied', 'Copied Capability Dictionary to system clipboard') : undefined}
        onPrint={canExport ? () => triggerAudit('printed', 'Sent Capability Dictionary to print / report processor') : undefined}
        onExport={canExport ? (format) => triggerAudit('exported', `Exported Capability Dictionary in ${format} format`) : undefined}
        searchPlaceholder={t('permissions.search_placeholder', "Search capability codes...")}
        syncWithUrl={false}
      />
    </div>
  );
}
