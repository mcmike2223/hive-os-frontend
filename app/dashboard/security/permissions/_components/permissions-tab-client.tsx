"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Key, BookOpen, Shield, RefreshCw, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/datatable/data-table";
import { fetchPermissions } from "@/lib/api"; 
import api from "@/modules/shared/api/http";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
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
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = useLocalStorage<number>("permissions_table_page_size", 10);
  const [search, setSearch] = React.useState("");
  const [sortCol, setSortCol] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<string | null>(null);
  const [tableKey, setTableKey] = React.useState(0);

  const { data: permissionsData, isLoading } = useQuery({
    queryKey: ["permissions", tenantId],
    queryFn: async () => {
      const res = await fetchPermissions();
      return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    },
  });

  const processedData = React.useMemo(() => {
    let result = [...(permissionsData || [])];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }
    if (sortCol) {
      result.sort((a, b) => {
        const aVal = String(a[sortCol]).toLowerCase();
        const bVal = String(b[sortCol]).toLowerCase();
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [permissionsData, search, sortCol, sortDir]);

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
    setSearch(""); setSortCol(null); setSortDir(null); setPage(1); setTableKey((prev) => prev + 1);
  }, []);

  const seedPermissionsMut = useMutation({
    mutationFn: async () => {
      const endpoint = isCentralAdmin ? '/permissions/seed' : '/tenant/permissions/seed';
      const res = await api.post(endpoint);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      toast.success(data.message || t('permissions.seeded', 'Permissions seeded successfully'));
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
      accessorFn: (row) => `${t('permissions.allows_operator', 'Allows the operator to')} ${generateDescription(row.name)} ${t('permissions.within_env', 'within the active environment.')}`, // 🚀 Export translation enabled
      header: t('permissions.col_desc', "Human-Readable Context"), enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {t('permissions.allows_operator', 'Allows the operator to')} <strong className="text-foreground font-medium">{generateDescription(row.original.name)}</strong> {t('permissions.within_env', 'within the active environment.')}
        </span>
      ),
    },
    {
      id: "guard_name", 
      accessorFn: (row) => row.guard_name === 'tenant' ? t('permissions.tenant_node', 'Tenant Node') : t('permissions.central', 'Central Command'), // 🚀 Export translation
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
  ], [page, pageSize, t]);

  // 🚀 THE FIX: Appended locale to export URL
  const exportUrl = `${isCentralAdmin ? '' : '/tenant'}/permissions/export?search=${search}&sortCol=${sortCol || ""}&sortDir=${sortDir || ""}&locale=${locale}`;

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
          {processedData.length === 0 && !isLoading && (
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

      <DataTable
        key={tableKey}
        columns={columns}
        data={paginatedData}
        totalEntries={processedData.length}
        loading={isLoading}
        exportEndpoint={exportUrl} 
        resourceName="permissions"
        enableRowSelection={false} 
        pageIndex={page}
        pageSize={pageSize}
        onQueryChange={handleQueryChange}
        onResetFilters={resetFilters}
        searchPlaceholder={t('permissions.search_placeholder', "Search capability codes...")}
        syncWithUrl={true}
      />
    </div>
  );
}
