"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Shield, PlusCircle, Pencil, Trash2, Key, Loader2, ShieldAlert, Calendar, Eye, Search, X, CheckCircle2, Circle, Filter, Users
} from "lucide-react";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type CompanySettingsInfo, type BrandingSettingsInfo } from "@/components/datatable/data-table";
import { fetchRoles, fetchPermissions, createRole, updateRole, deleteRole } from "@/lib/api";
import { logFrontendAction } from "@/modules/core/api";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { syncUserSession } from "@/lib/auth-sync";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/store/use-translation";
import { getErrorMessage } from "@/lib/errors";
import { getTrashChannelName, initEcho } from "@/lib/echo";
import { getAccessToken } from "@/lib/runtime-context";

type PermissionRecord = {
  id: number | string;
  name: string;
  guard_name?: string;
};

type RoleRecord = {
  id: string | number;
  name: string;
  guard_name?: string;
  permissions?: PermissionRecord[];
  permissions_count?: number;
  users_count?: number;
  created_at: string;
  updated_at?: string;
};

type TableQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortCol?: string | null;
  sortDir?: string | null;
};

export function RolesTabClient({
  tenantId,
  tenantName,
  companySettings,
  brandingSettings
}: {
  tenantId?: string | null;
  tenantName?: string | null;
  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
}) {
  const isCentralAdmin = !tenantId;
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canCreate = hasAnyPermission(["manage_roles", "create_roles"]);
  const canEdit = hasAnyPermission(["manage_roles", "edit_roles"]);
  const canDelete = hasAnyPermission(["manage_roles", "delete_roles"]);
  const canExport = hasAnyPermission(["manage_roles", "view_roles", "export_roles"]);

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
  const [pageSize, setPageSize] = useLocalStorage<number>("roles_table_page_size", 10);
  const [search, setSearch] = React.useState("");
  const [tableKey, setTableKey] = React.useState(0);

  // ?? Real-time Reverb listener for Role restoration/deletion
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getAccessToken();
    if (!token) return;
    const echo = initEcho(token);
    if (!echo) return;

    const channelName = getTrashChannelName();
    const channel = echo.private(channelName);

    const handleTrashEvent = (event: any) => {
      if (event?.entity_type === "role" || event?.action === "empty_trash" || event?.action === "bulk_restored" || event?.action === "auto_purged") {
        queryClient.invalidateQueries({ queryKey: ["roles"] });
      }
    };

    channel.listen(".TrashUpdated", handleTrashEvent);
    channel.listen("TrashUpdated", handleTrashEvent);

    return () => {
      channel.stopListening(".TrashUpdated");
      channel.stopListening("TrashUpdated");
    };
  }, [queryClient]);

  const [sortCol, setSortCol] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<string | null>(null);

  // 🚀 ADVANCED FILTERS
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [scopeFilter, setScopeFilter] = React.useState<string>("all");
  const [assignmentFilter, setAssignmentFilter] = React.useState<string>("all");
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false);

  const [editingRole, setEditingRole] = React.useState<RoleRecord | null>(null);
  const [viewRole, setViewRole] = React.useState<RoleRecord | null>(null);

  const [roleName, setRoleName] = React.useState("");
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = React.useState("");

  const [permissionFilter, setPermissionFilter] = React.useState<"all" | "active" | "available">("all");

  const isEdit = !!editingRole;

  const { data: rolesData, isLoading, isFetching } = useQuery({
    queryKey: [
      "roles-table", page, pageSize, search, sortCol, sortDir, tenantId,
      typeFilter, scopeFilter, assignmentFilter, dateFrom, dateTo
    ],
    queryFn: async () => {
      const res = await fetchRoles({
        page,
        pageSize,
        search: search.trim(),
        sort_by: sortCol,
        sort_direction: sortDir,
        tenant_id: tenantId,
        type: typeFilter !== "all" ? typeFilter : undefined,
        scope: scopeFilter !== "all" ? scopeFilter : undefined,
        assignment: assignmentFilter !== "all" ? assignmentFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });

      const payload = res.data ? res.data : res;
      let rawRoles = [];
      if (Array.isArray(payload)) rawRoles = payload;
      else if (payload.data && Array.isArray(payload.data)) rawRoles = payload.data;
      else if (payload.roles && Array.isArray(payload.roles)) rawRoles = payload.roles;

      let total = rawRoles.length;
      if (res.meta?.total !== undefined) total = res.meta.total;
      else if (res.pagination?.total !== undefined) total = res.pagination.total;

      return { rows: rawRoles, total };
    },
    placeholderData: (prev) => prev,
  });

  const { data: permissionsData } = useQuery({
    queryKey: ["permissions", tenantId],
    queryFn: async () => {
      const res = await fetchPermissions();
      return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    },
  });

  const searchedPermissions = React.useMemo(() => {
    if (!permissionsData) return [];
    if (!permissionSearch.trim()) return permissionsData;

    const query = permissionSearch.toLowerCase();
    return permissionsData.filter((p: PermissionRecord) => p.name.toLowerCase().includes(query));
  }, [permissionsData, permissionSearch]);

  const enabledPerms = React.useMemo(() => {
    return searchedPermissions.filter((p: PermissionRecord) => selectedPermissions.includes(p.name));
  }, [searchedPermissions, selectedPermissions]);

  const disabledPerms = React.useMemo(() => {
    return searchedPermissions.filter((p: PermissionRecord) => !selectedPermissions.includes(p.name));
  }, [searchedPermissions, selectedPermissions]);

  const isProtectedRole = React.useCallback((r: RoleRecord) => {
    return r.name === 'Super Admin' || r.name === 'Admin';
  }, []);

  const formatDate = React.useCallback((d?: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    setRoleName("");
    setSelectedPermissions([]);
    setPermissionSearch("");
    setPermissionFilter("all");
    setDialogOpen(true);
    triggerAudit('viewed', 'Accessed Role Provisioning form');
  };

  const openEdit = (role: RoleRecord) => {
    setEditingRole(role);
    setRoleName(role.name);
    setSelectedPermissions(role.permissions ? role.permissions.map((p) => p.name) : []);
    setPermissionSearch("");
    setPermissionFilter("all");
    setDialogOpen(true);
    triggerAudit('viewed', `Accessed Role Reconfiguration form for: ${role.name}`);
  };

  const openView = (role: RoleRecord) => {
    setViewRole(role);
    setViewDialogOpen(true);
    triggerAudit('viewed', `Inspected clearance level: ${role.name}`);
  };

  const togglePermission = (permName: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName]
    );
  };

  const saveMut = useMutation({
    mutationFn: async (payload: { name: string; permissions: string[] }) => {
      if (isEdit && editingRole) {
        return updateRole({ id: editingRole.id, data: payload });
      }
      return createRole(payload);
    },
    onSuccess: (data: any) => {
      toast.success(data.message || (isEdit ? t('roles.role_updated', "Role updated successfully") : t('roles.role_created', "Role created successfully")));
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["roles-table"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      syncUserSession();
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, t('roles.failed_save', "Failed to save role")));
    }
  });

  const deleteMut = useMutation({
    mutationFn: (id: string | number) => deleteRole(id),
    onSuccess: (data: any) => {
      toast.success(data.message || t('roles.role_deleted', "Role deleted successfully"));
      queryClient.invalidateQueries({ queryKey: ["roles-table"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      syncUserSession();
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, t('roles.failed_delete', "Failed to delete role")));
    }
  });

  const handleDeleteRows = React.useCallback(async (selectedRows: RoleRecord[]) => {
    const deletableRows = selectedRows.filter((r) => !isProtectedRole(r));
    if (deletableRows.length === 0) {
      toast.error(t('roles.protected_cannot_delete', "Protected system roles cannot be deleted."));
      return;
    }
    const promises = deletableRows.map((r) => deleteRole(r.id));
    await Promise.all(promises);
    toast.success(t('roles.batch_trashed', "Selected custom roles moved to Trash Bin (auto-purged in 30 days)."));
    queryClient.invalidateQueries({ queryKey: ["roles-table"] });
    queryClient.invalidateQueries({ queryKey: ["roles"] });
    syncUserSession();
  }, [deleteMut, isProtectedRole, queryClient, t]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      toast.error(t('roles.name_required', "Role name is required"));
      return;
    }
    saveMut.mutate({ name: roleName.trim(), permissions: selectedPermissions });
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
    setTypeFilter("all");
    setScopeFilter("all");
    setAssignmentFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setTableKey((prev) => prev + 1);
    triggerAudit('filtered', 'Reset all Access Roles filters');
  }, [triggerAudit]);

  const handleRefresh = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["roles-table"] });
    triggerAudit('viewed', 'Manually refreshed Access Roles Matrix');
  }, [queryClient, triggerAudit]);

  const columns = React.useMemo<ColumnDef<RoleRecord>[]>(() => [
    {
      id: "name", accessorKey: "name", header: t('roles.col_designation', "Clearance Designation"), enableSorting: true,
      cell: ({ row }) => {
        const r = row.original;
        const isSuper = r.name === 'Super Admin';
        const isAdmin = r.name === 'Admin';

        return (
          <div className="flex items-center gap-3">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center border shadow-inner", isSuper ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : isAdmin ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-500" : "bg-primary/10 border-primary/20 text-primary")}>
              <Shield className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-sm flex items-center gap-2">
                {r.name}
                {isSuper && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">Root</Badge>}
                {isAdmin && <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/30">System</Badge>}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {r.guard_name ? `guard: ${r.guard_name}` : "web"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "permissions_count",
      accessorFn: (row) => row.name === 'Super Admin' ? 999 : (row.permissions?.length ?? row.permissions_count ?? 0),
      header: t('roles.col_capabilities', "Bound Capabilities"), enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        const count = r.permissions?.length ?? r.permissions_count ?? 0;
        const isSuper = r.name === 'Super Admin';

        if (isSuper) {
          return (
            <Badge variant="outline" className="font-mono text-xs text-amber-600 border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5">
              {t('roles.god_mode_badge', 'ALL PROTOCOLS (GOD MODE)')}
            </Badge>
          );
        }

        return (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-bold text-foreground">{count}</span>
            <span className="text-muted-foreground text-[11px]">{t('roles.capabilities', "capabilities")}</span>
          </div>
        );
      },
    },
    {
      id: "users_count",
      accessorFn: (row) => row.users_count ?? 0,
      header: t('roles.col_operators', "Active Operators"),
      enableSorting: true,
      cell: ({ row }) => {
        const count = row.original.users_count ?? 0;
        return (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={cn("font-bold", count > 0 ? "text-foreground" : "text-muted-foreground")}>{count}</span>
            <span className="text-muted-foreground text-[11px]">{t('roles.assigned', "assigned")}</span>
          </div>
        );
      }
    },
    {
      id: "created_at", accessorKey: "created_at", header: t('roles.col_established', "Established"), enableSorting: true,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-xs">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(row.original.created_at)}
        </div>
      ),
    },
    {
      id: "actions", header: t('roles.col_actions', "Actions"), enableSorting: false, size: 120,
      cell: ({ row }) => {
        const r = row.original;
        const isCore = isProtectedRole(r);
        const isSuper = r.name === 'Super Admin';

        return (
          <div className="flex items-center justify-end gap-1">
            <span className="tour-roles-action-view flex">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" title={t('global.view', 'View Details')} onClick={() => openView(r)}>
                <Eye className="h-4 w-4" />
              </Button>
            </span>

            {canEdit && (
              <span className="tour-roles-action-edit flex">
                <Button
                  variant="ghost" size="icon"
                  title={t('global.edit', 'Edit')}
                  className={cn("h-8 w-8 transition-all", isSuper ? "opacity-30 cursor-not-allowed" : "text-muted-foreground hover:text-indigo-600")}
                  onClick={() => openEdit(r)} disabled={isSuper}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </span>
            )}

            {canDelete && (
              isCore ? (
                 <div className="w-8 flex justify-center"><Badge variant="outline" className="text-[11px] uppercase tracking-widest text-amber-600 border-amber-200 bg-amber-50/50 px-1">Core</Badge></div>
              ) : (
                <span className="tour-roles-action-purge flex">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title={t('global.delete', 'Purge')}><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2rem] bg-background/95 backdrop-blur-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('roles.purge_title', 'Purge Clearance Level?')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('roles.purge_desc1', 'This will permanently delete the')} <strong>{r.name}</strong> {t('roles.purge_desc2', 'role. Operators assigned to this role may lose network access.')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">{t('global.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction className="rounded-xl bg-destructive hover:bg-destructive/90" onClick={() => deleteMut.mutate(r.id)}>{t('roles.confirm_purge', 'Confirm Purge')}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </span>
              )
            )}
          </div>
        );
      },
    },
  ], [page, pageSize, deleteMut, isProtectedRole, formatDate, canEdit, canDelete, t, locale]);

  const exportUrl = `${isCentralAdmin ? '' : '/tenant'}/roles/export?type=${typeFilter}&scope=${scopeFilter}&assignment=${assignmentFilter}&date_from=${dateFrom}&date_to=${dateTo}&search=${encodeURIComponent(search)}&sortCol=${sortCol || ""}&sortDir=${sortDir || ""}&locale=${locale}`;

  return (
    <div className="space-y-4">
      <div id="tour-roles-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card/40 p-6 rounded-[2rem] border border-border/50 backdrop-blur-md shadow-sm gap-4 mt-2">
        <div>
          <h2 className="text-2xl font-black font-space flex items-center gap-2 tracking-tight">
            <Shield className="h-6 w-6 text-primary" /> {t('roles.title', 'Access Control Matrix')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('roles.subtitle', 'Define clearance levels and cryptographically bind them to network capabilities.')}
          </p>
        </div>

        {canCreate && (
          <div id="tour-roles-provision" className="w-full sm:w-auto flex justify-end">
            <Button onClick={openCreate} className="rounded-xl shadow-lg shadow-primary/20 h-11 px-6 font-bold tracking-wide">
              <PlusCircle className="mr-2 h-5 w-5" /> {t('roles.provision_btn', 'New Clearance Level')}
            </Button>
          </div>
        )}
      </div>

      {/* 🚀 ROLES ADVANCED FILTERS BAR */}
      <div id="tour-roles-filters" className="bg-card border border-border/50 rounded-xl p-3 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-muted-foreground shrink-0 pl-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">{t('roles.filters', 'Filters:')}</span>
        </div>

        {/* Classification Filter */}
        <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); triggerAudit('filtered', `Filtered roles by type: ${val}`); }}>
          <SelectTrigger aria-label={t('roles.filter_type', 'Filter by role type')} className="h-9 w-[150px] bg-background">
            <SelectValue placeholder={t('roles.filter_type', 'Role Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('roles.all_types', 'All Role Types')}</SelectItem>
            <SelectItem value="core">{t('roles.core_roles', 'Core / System')}</SelectItem>
            <SelectItem value="custom">{t('roles.custom_roles', 'Custom Defined')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Capability Scope Filter */}
        <Select value={scopeFilter} onValueChange={(val) => { setScopeFilter(val); setPage(1); triggerAudit('filtered', `Filtered roles by capabilities: ${val}`); }}>
          <SelectTrigger aria-label={t('roles.filter_scope', 'Filter by capability scope')} className="h-9 w-[160px] bg-background">
            <SelectValue placeholder={t('roles.filter_scope', 'Capability Scope')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('roles.all_scopes', 'All Capabilities')}</SelectItem>
            <SelectItem value="assigned">{t('roles.with_caps', 'With Capabilities')}</SelectItem>
            <SelectItem value="empty">{t('roles.no_caps', 'No Capabilities')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Operator Assignment Filter */}
        <Select value={assignmentFilter} onValueChange={(val) => { setAssignmentFilter(val); setPage(1); triggerAudit('filtered', `Filtered roles by assignment: ${val}`); }}>
          <SelectTrigger aria-label={t('roles.filter_assignment', 'Filter by operator count')} className="h-9 w-[150px] bg-background">
            <SelectValue placeholder={t('roles.filter_assignment', 'Operator Count')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('roles.all_assignments', 'All Operators')}</SelectItem>
            <SelectItem value="assigned">{t('roles.has_operators', 'Assigned (≥1)')}</SelectItem>
            <SelectItem value="unassigned">{t('roles.unassigned', 'Unassigned (0)')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Established Date Filter */}
        <div className="flex items-center gap-1.5 bg-background border border-border/50 rounded-lg px-2.5 py-1 text-xs">
          <span className="text-xs text-muted-foreground">{t('roles.created', 'Established:')}</span>
          <label htmlFor="roles-date-from" className="sr-only">Established from date</label>
          <input id="roles-date-from" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); triggerAudit('filtered', `Applied roles date from filter: ${e.target.value}`); }} className="bg-transparent text-sm w-[110px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm" />
          <span className="text-muted-foreground">-</span>
          <label htmlFor="roles-date-to" className="sr-only">Established through date</label>
          <input id="roles-date-to" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); triggerAudit('filtered', `Applied roles date to filter: ${e.target.value}`); }} className="bg-transparent text-sm w-[110px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm" />
        </div>

        {(typeFilter !== "all" || scopeFilter !== "all" || assignmentFilter !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-3 text-destructive hover:bg-destructive/10">
            <X className="mr-1 h-4 w-4" /> {t('global.clear', 'Clear')}
          </Button>
        )}
      </div>

      <DataTable
        key={`${tableKey}-${locale}`}
        columns={columns}
        data={rolesData?.rows || []}
        totalEntries={rolesData?.total || 0}
        loading={isLoading || isFetching}
        exportEndpoint={canExport ? exportUrl : undefined}
        resourceName="roles"
        enableRowSelection={canDelete}
        pageIndex={page}
        pageSize={pageSize}
        onQueryChange={handleQueryChange}
        onRefresh={handleRefresh}
        onResetFilters={resetFilters}
        onCopy={canExport ? () => triggerAudit('copied', 'Copied Access Roles Matrix to system clipboard') : undefined}
        onPrint={canExport ? () => triggerAudit('printed', 'Sent Access Roles Matrix to print / report processor') : undefined}
        onExport={canExport ? (format) => triggerAudit('exported', `Exported Access Roles Matrix in ${format} format`) : undefined}
        syncWithUrl={false}
        onDeleteRows={canDelete ? handleDeleteRows : undefined}
        searchPlaceholder={t('roles.search_placeholder', "Filter clearance levels...")}
        companySettings={companySettings ?? undefined}
        brandingSettings={brandingSettings ?? undefined}
      />

      {/* CREATE/EDIT MODAL */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl flex flex-col max-h-[90vh]">
          <div className="relative px-6 sm:px-8 py-6 border-b border-border/50 bg-gradient-to-br from-primary/10 via-card/90 to-muted/40 overflow-hidden shrink-0">
            <div aria-hidden="true" className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
            <div aria-hidden="true" className="absolute bottom-0 left-16 h-px w-48 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <DialogHeader className="relative text-left">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/25 text-primary flex items-center justify-center shadow-lg shadow-primary/10 ring-4 ring-primary/5 shrink-0">
                  <ShieldAlert className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
                      {isEdit ? t('roles.editing_role', 'Clearance Reconfiguration') : t('roles.new_role', 'New Clearance Level')}
                    </span>
                  </div>
                  <DialogTitle className="text-2xl font-black font-space tracking-tight text-foreground sm:text-3xl">
                    {isEdit ? t('roles.modify_title', "Modify Clearance Level") : t('roles.establish_title', "Establish Clearance Level")}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-0.5">
                    {t('roles.dialog_desc', 'Configure role identity and assign network capabilities.')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <form id="role-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="role-name" className="text-xs font-bold uppercase tracking-wider">{t('roles.designation_name', 'Designation Name')}</Label>
                <Input
                  id="role-name"
                  placeholder={t('roles.placeholder_name', "e.g. Field Supervisor, Regional Auditor")}
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  disabled={editingRole?.name === "Admin" || editingRole?.name === "Super Admin"}
                  className="rounded-xl bg-muted/40 font-semibold"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider">{t('roles.bind_capabilities', 'Bind Capabilities')}</Label>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPermissions(permissionsData ? permissionsData.map((p: PermissionRecord) => p.name) : [])}
                      className="text-[11px] h-7 rounded-lg"
                    >
                      {t('roles.select_all', 'Select All')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPermissions([])}
                      className="text-[11px] h-7 rounded-lg text-muted-foreground"
                    >
                      {t('roles.clear_all', 'Clear All')}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={t('roles.search_caps', "Search capabilities...")}
                      value={permissionSearch}
                      onChange={(e) => setPermissionSearch(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-xl bg-muted/40"
                    />
                  </div>
                  <div className="flex gap-1 w-full sm:w-auto justify-end">
                    <Button type="button" variant={permissionFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setPermissionFilter("all")} className="h-6 text-[11px] px-2.5 rounded-full">
                      {t('roles.all', 'All')} ({searchedPermissions.length})
                    </Button>
                    <Button type="button" variant={permissionFilter === "active" ? "default" : "outline"} size="sm" onClick={() => setPermissionFilter("active")} className="h-6 text-[11px] px-2.5 rounded-full">
                      {t('global.active', 'Active')} ({enabledPerms.length})
                    </Button>
                    <Button type="button" variant={permissionFilter === "available" ? "default" : "outline"} size="sm" onClick={() => setPermissionFilter("available")} className="h-6 text-[11px] px-2.5 rounded-full">
                      {t('roles.available', 'Available')} ({disabledPerms.length})
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/5 border border-border/50 rounded-xl max-h-[350px] overflow-y-auto p-3 scrollbar-thin space-y-5">
                  {!permissionsData ? (
                    <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : searchedPermissions.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground font-mono">
                      {t('roles.no_perms_match', 'No capabilities match')} &quot;{permissionSearch}&quot;
                    </div>
                  ) : (
                    <>
                      {(permissionFilter === "all" || permissionFilter === "active") && enabledPerms.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-[11px] uppercase tracking-widest text-primary font-bold flex items-center gap-1.5 px-1">
                            <CheckCircle2 className="h-3 w-3" /> {t('roles.active_caps', 'Active Capabilities')}
                          </h4>
                          <div className="grid gap-1">
                            {enabledPerms.map((perm: PermissionRecord) => (
                              <Label key={perm.id} className="flex items-center justify-between p-3 rounded-lg border border-primary/40 bg-primary/5 transition-all cursor-pointer hover:bg-primary/10 shadow-sm">
                                <span className="font-mono text-xs font-semibold text-primary">{perm.name}</span>
                                <Switch checked={true} onCheckedChange={() => togglePermission(perm.name)} className="data-[state=checked]:bg-primary" />
                              </Label>
                            ))}
                          </div>
                        </div>
                      )}

                      {(permissionFilter === "all" || permissionFilter === "available") && disabledPerms.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1.5 px-1 mt-2">
                            <Circle className="h-3 w-3" /> {t('roles.available_caps', 'Available Capabilities')}
                          </h4>
                          <div className="grid gap-1">
                            {disabledPerms.map((perm: PermissionRecord) => (
                              <Label key={perm.id} className="flex items-center justify-between p-3 rounded-lg border border-transparent transition-all cursor-pointer hover:bg-muted/50 bg-background">
                                <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">{perm.name}</span>
                                <Switch checked={false} onCheckedChange={() => togglePermission(perm.name)} className="data-[state=checked]:bg-primary" />
                              </Label>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div className="px-6 sm:px-8 py-4 border-t border-border/50 bg-muted/20 backdrop-blur-md flex justify-end gap-3 shrink-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 rounded-xl px-5 border-border/70 hover:bg-muted/80 font-semibold text-xs transition-all">{t('global.cancel', 'Cancel')}</Button>
            <Button type="submit" form="role-form" disabled={saveMut.isPending} className="h-10 rounded-xl px-6 shadow-md shadow-primary/20 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-[0.98]">
              {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? t('roles.update_matrix', "Update Matrix") : t('roles.deploy_clearance', "Deploy Clearance")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW DIALOG */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-2xl shadow-2xl">
          <div className="relative px-6 sm:px-8 py-6 border-b border-border/50 bg-gradient-to-br from-primary/10 via-card/90 to-muted/40 overflow-hidden">
            <div aria-hidden="true" className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
            <div className="flex items-center gap-4 relative">
              <div className={cn("h-13 w-13 rounded-2xl flex items-center justify-center border shadow-md shrink-0 ring-4", viewRole?.name === 'Super Admin' ? "bg-amber-500/15 border-amber-500/30 text-amber-500 ring-amber-500/10" : "bg-primary/15 border-primary/25 text-primary ring-primary/10")}>
                <Shield className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    Clearance Profile
                  </span>
                </div>
                <DialogTitle className="text-2xl font-black font-space tracking-tight text-foreground truncate mt-0.5">{viewRole?.name}</DialogTitle>
                <DialogDescription className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{t('roles.caps_overview', 'Network Capabilities Overview')}</DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 max-h-[400px] overflow-y-auto">
            {viewRole?.name === 'Super Admin' && (
               <div className="mb-6 p-4 border border-amber-500/30 bg-amber-500/10 rounded-xl text-amber-600 flex items-start gap-3 shadow-inner">
                  <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-sm tracking-tight block">{t('roles.god_mode_engaged', '[ GOD MODE ENGAGED ]')}</span>
                    <span className="text-xs font-mono opacity-80 block mt-1 leading-relaxed">
                      {t('roles.god_mode_desc', 'This clearance level inherently bypasses all network security protocols. Even if specific capabilities are unchecked below, this role maintains absolute read/write authority over the entire node.')}
                    </span>
                  </div>
               </div>
            )}

            <div className="space-y-3">
              <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                <Key className="h-3 w-3" /> {t('roles.explicit_caps', 'Explicitly Bound Capabilities')}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {viewRole?.permissions?.length ? (
                  viewRole.permissions.map((p: PermissionRecord) => (
                    <Badge key={p.id} variant="secondary" className="px-3 py-1.5 font-mono text-[11px] bg-muted/50 border border-border/50 text-foreground transition-all hover:bg-muted hover:border-border">
                      {p.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest bg-muted/50 px-3 py-2 rounded-lg border border-dashed border-border/50 w-full text-center">
                    {t('roles.no_caps_assigned', 'No individual capabilities explicitly assigned.')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex justify-end">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="rounded-xl px-8 shadow-sm">
              {t('roles.close_view', 'Close Overview')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
