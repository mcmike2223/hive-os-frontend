"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Shield, PlusCircle, Pencil, Trash2, Key, Loader2, ShieldAlert, Calendar, Eye, Search, X, CheckCircle2, Circle, Filter
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
import { DataTable, type CompanySettingsInfo, type BrandingSettingsInfo } from "@/components/datatable/data-table";
import { fetchRoles, fetchPermissions, createRole, updateRole, deleteRole } from "@/lib/api"; 
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { syncUserSession } from "@/lib/auth-sync";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/store/use-translation"; 
import { getErrorMessage } from "@/lib/errors";

type PermissionRecord = {
  id: number | string;
  name: string;
};

type RoleRecord = {
  id: number | string;
  name: string;
  permissions?: PermissionRecord[];
  created_at?: string;
};

type RoleSavePayload = {
  name: string;
  permissions: string[];
};

type TableQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortCol?: string | null;
  sortDir?: string | null;
};

type Props = {
  tenantId: string | null;
  tenantName: string | null;
  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
};

export function RolesTabClient({ tenantId, tenantName, companySettings, brandingSettings }: Props) {
  const isCentralAdmin = !tenantId;
  const queryClient = useQueryClient();
  const { t, locale } = useTranslation(); 

  const { hasAnyPermission } = usePermissions();
  const canCreate = hasAnyPermission(["manage_roles", "create_roles"]);
  const canEdit = hasAnyPermission(["manage_roles", "edit_roles"]);
  const canDelete = hasAnyPermission(["manage_roles", "delete_roles"]);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = useLocalStorage<number>("roles_table_page_size", 10);
  const [search, setSearch] = React.useState("");
  const [tableKey, setTableKey] = React.useState(0);
  
  const [sortCol, setSortCol] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<string | null>(null);

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
    queryKey: ["roles-table", page, pageSize, search, sortCol, sortDir, tenantId],
    queryFn: async () => {
      const res = await fetchRoles({
        page, pageSize, search: search.trim(), sort_by: sortCol, sort_direction: sortDir, tenant_id: tenantId,
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

  const enabledPerms = React.useMemo(() => 
    searchedPermissions.filter((p: PermissionRecord) => selectedPermissions.includes(p.name)), 
  [searchedPermissions, selectedPermissions]);

  const disabledPerms = React.useMemo(() => 
    searchedPermissions.filter((p: PermissionRecord) => !selectedPermissions.includes(p.name)), 
  [searchedPermissions, selectedPermissions]);

  const saveMut = useMutation({
    mutationFn: async (payload: RoleSavePayload) => {
      if (isEdit && editingRole) return updateRole({ id: editingRole.id, data: payload });
      return createRole(payload);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["roles-table"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] }); 
      await syncUserSession();
      toast.success(isEdit ? t('roles.updated', "Clearance level updated") : t('roles.established', "Clearance level established"));
      setDialogOpen(false);
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "Failed to save role")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string | number) => deleteRole(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["roles-table"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      await syncUserSession();
    },
  });

  const isProtectedRole = React.useCallback((name: string) => name === "Super Admin" || name === "Admin", []);

  const handleQueryChange = React.useCallback((q: TableQuery) => {
    if (q.page !== undefined) setPage(q.page);
    if (q.pageSize !== undefined) setPageSize(q.pageSize);
    if (q.search !== undefined) setSearch(q.search);
    if (q.sortCol !== undefined) setSortCol(q.sortCol);
    if (q.sortDir !== undefined) setSortDir(q.sortDir);
  }, [setPageSize]);

  const handleRefresh = React.useCallback(() => queryClient.invalidateQueries({ queryKey: ["roles-table"] }), [queryClient]);

  const resetFilters = React.useCallback(() => {
    setSearch(""); setSortCol(null); setSortDir(null); setPage(1); setTableKey((prev) => prev + 1);
  }, []);

  const handleDeleteRows = React.useCallback(async (rows: RoleRecord[]) => {
    const validRows = rows.filter(r => !isProtectedRole(r.name));
    
    // 🚀 THE FIX: Removed the `return` statement so it returns void instead of string/number
    if (validRows.length === 0) {
        toast.error(t('roles.purge_core_err', "Cannot purge core system roles."));
        return; 
    }
    
    await Promise.all(validRows.map((r) => deleteMut.mutateAsync(r.id)));
    toast.success(`${validRows.length} ${t('roles.levels_purged', 'clearance levels purged.')}`);
  }, [deleteMut, isProtectedRole, t]);

  const openCreate = () => {
    setEditingRole(null); setRoleName(""); setSelectedPermissions([]);
    setPermissionSearch(""); setPermissionFilter("all"); setDialogOpen(true);
  };

  const openEdit = (role: RoleRecord) => {
    // 🚀 THE FIX: Removed `return` statements from toast calls here too just in case
    if (role.name === 'Super Admin') {
        toast.error(t('roles.super_admin_err', "Super Admin cannot be modified."));
        return;
    }
    if (role.name === 'Admin') toast.warning(t('roles.admin_warn', "Core Role: You can modify capabilities, but the designation cannot be changed."));
    
    setEditingRole(role); setRoleName(role.name);
    const currentPerms = role.permissions ? role.permissions.map((p: PermissionRecord) => p.name) : [];
    setSelectedPermissions(currentPerms);
    setPermissionSearch(""); setPermissionFilter("all"); setDialogOpen(true);
  };

  const openView = (role: RoleRecord) => {
    setViewRole(role); setViewDialogOpen(true);
  };

  const togglePermission = (permName: string) => {
    setSelectedPermissions(prev => prev.includes(permName) ? prev.filter(p => p !== permName) : [...prev, permName]);
  };

  const toggleAllFiltered = () => {
    const visibleNames = searchedPermissions.map((p: PermissionRecord) => p.name);
    const allVisibleSelected = visibleNames.every((name: string) => selectedPermissions.includes(name));

    if (allVisibleSelected) {
      setSelectedPermissions(prev => prev.filter(p => !visibleNames.includes(p)));
    } else {
      setSelectedPermissions(prev => {
        const newSet = new Set([...prev, ...visibleNames]);
        return Array.from(newSet);
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 🚀 THE FIX: Removed `return` statement
    if (!roleName.trim()) {
        toast.error(t('roles.name_required', "Clearance level requires a designation."));
        return;
    }
    saveMut.mutate({ name: roleName.trim(), permissions: selectedPermissions });
  };

  const formatDate = React.useCallback((dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Invalid Date";
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  }, []);

  const columns = React.useMemo<ColumnDef<RoleRecord>[]>(() => [
    {
      id: "name", accessorKey: "name", header: t('roles.col_designation', "Clearance Level"), enableSorting: true,
      cell: ({ row }) => {
        const isSuper = row.original.name === "Super Admin";
        return (
          <div className="flex items-center gap-2">
            <Shield className={cn("h-4 w-4", isSuper ? "text-amber-500" : "text-primary")} />
            <span className={cn("font-bold tracking-tight", isSuper && "text-amber-600")}>
              {row.original.name}
            </span>
          </div>
        );
      },
    },
    {
      id: "permissions", 
      accessorFn: (row) => row.name === "Super Admin" ? t('roles.god_mode', 'ALL PROTOCOLS (GOD MODE)') : (row.permissions?.length || 0) > 0 ? row.permissions!.map((p: PermissionRecord) => p.name).join(', ') : t('roles.no_access', 'No Access'), 
      header: t('roles.col_capabilities', "Network Capabilities"), enableSorting: false,
      cell: ({ row }) => {
        const perms = row.original.permissions || [];
        const isSuper = row.original.name === "Super Admin";
        if (isSuper) return <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">{t('roles.god_mode', 'ALL PROTOCOLS (GOD MODE)')}</Badge>;
        return (
          <div className="flex items-center gap-1 flex-wrap max-w-[300px]">
            {perms.slice(0, 3).map((p: PermissionRecord) => (
              <Badge key={p.id} variant="secondary" className="text-[11px] font-mono tracking-tighter bg-muted/50">
                {p.name}
              </Badge>
            ))}
            {perms.length > 3 && (
              <Badge variant="outline" className="text-[11px] font-mono border-dashed text-primary bg-primary/5 border-primary/20">
                +{perms.length - 3} {t('global.more', 'more')}
              </Badge>
            )}
            {perms.length === 0 && <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest bg-muted px-2 py-0.5 rounded">{t('roles.no_access', 'No Access')}</span>}
          </div>
        );
      },
    },
    {
      id: "created_at", accessorKey: "created_at", header: t('roles.col_established', "Established"), enableSorting: true,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-xs">
          <Calendar className="h-3.5 w-3.5" />
          {row.original.created_at ? formatDate(row.original.created_at) : ""}
        </div>
      ),
    },
    {
      id: "actions", header: t('roles.col_actions', "Actions"), size: 140, enableSorting: false, 
      cell: ({ row }) => {
        const r = row.original;
        const isSuper = r.name === "Super Admin";
        const isCore = isProtectedRole(r.name);
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
  ], [page, pageSize, deleteMut, isProtectedRole, formatDate, canEdit, canDelete, t]);

  const exportUrl = `${isCentralAdmin ? '' : '/tenant'}/roles/export?search=${search}&sortCol=${sortCol || ""}&sortDir=${sortDir || ""}&locale=${locale}`;

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

      <DataTable
        key={tableKey}
        columns={columns}
        data={rolesData?.rows || []}
        totalEntries={rolesData?.total || 0}
        loading={isLoading || isFetching}
        exportEndpoint={exportUrl} 
        resourceName="roles"
        enableRowSelection={true}
        pageIndex={page}
        pageSize={pageSize}
        onQueryChange={handleQueryChange}
        onRefresh={handleRefresh}
        onResetFilters={resetFilters}
        onDeleteRows={canDelete ? handleDeleteRows : undefined}
        searchPlaceholder={t('roles.search_placeholder', "Filter clearance levels...")}
        syncWithUrl={true}
        companySettings={companySettings ?? undefined}
        brandingSettings={brandingSettings ?? undefined}
      />

      {/* CREATE/EDIT MODAL */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl flex flex-col max-h-[90vh]">
          <div className="px-6 py-5 border-b border-border/40 bg-muted/20 shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                </div>
                {isEdit ? t('roles.modify_title', "Modify Clearance Level") : t('roles.establish_title', "Establish Clearance Level")}
              </DialogTitle>
              <DialogDescription className="ml-10">{t('roles.dialog_desc', 'Configure role identity and assign network capabilities.')}</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <form id="role-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t('roles.designation', 'Clearance Designation')} <span className="text-destructive">*</span>
                </Label>
                <Input 
                  id="name" 
                  value={roleName} 
                  onChange={(e) => setRoleName(e.target.value)} 
                  required 
                  disabled={isEdit && isProtectedRole(editingRole?.name)}
                  placeholder="e.g. Financial Auditor" 
                  className={cn("bg-muted/30 h-11 font-semibold transition-all focus-visible:ring-primary", isEdit && isProtectedRole(editingRole?.name) && "opacity-60")} 
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Key className="h-3 w-3" /> {t('roles.assign_caps', 'Assign Capabilities')}
                  </Label>
                  <Badge variant="outline" className="font-mono text-[11px] bg-primary/5 text-primary border-primary/20">
                    {selectedPermissions.length} / {permissionsData?.length || 0} {t('global.active', 'Active')}
                  </Badge>
                </div>

                <div className="space-y-3 p-3 bg-muted/20 border border-border/50 rounded-xl">
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder={t('roles.search_perms', "Search permissions (e.g., 'create', 'user')...")} 
                        value={permissionSearch}
                        onChange={(e) => setPermissionSearch(e.target.value)}
                        className="px-9 bg-background h-9 text-sm transition-all focus-visible:ring-primary shadow-sm"
                      />
                      {permissionSearch && (
                        <button 
                          type="button" 
                          onClick={() => setPermissionSearch("")} 
                          className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {searchedPermissions.length > 0 && (
                      <Button type="button" variant="secondary" size="sm" onClick={toggleAllFiltered} className="h-9 text-xs shadow-sm">
                        {t('roles.toggle_all', 'Toggle All Below')}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Button type="button" variant={permissionFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setPermissionFilter("all")} className="h-6 text-[11px] px-2.5 rounded-full">
                      {t('global.all', 'All')}
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
          
          <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex justify-end gap-3 shrink-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t('global.cancel', 'Cancel')}</Button>
            <Button type="submit" form="role-form" disabled={saveMut.isPending} className="rounded-xl px-8 shadow-lg font-bold bg-primary text-primary-foreground">
              {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? t('roles.update_matrix', "Update Matrix") : t('roles.deploy_clearance', "Deploy Clearance")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW DIALOG */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
          <div className="px-6 py-6 border-b border-border/40 bg-muted/20 flex items-center gap-4">
            <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center border shadow-inner shrink-0", viewRole?.name === 'Super Admin' ? "bg-amber-500/10 border-amber-500/30" : "bg-primary/10 border-primary/20")}>
              <Shield className={cn("h-7 w-7", viewRole?.name === 'Super Admin' ? "text-amber-500" : "text-primary")} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black font-space tracking-tight">{viewRole?.name}</DialogTitle>
              <DialogDescription className="font-mono text-[11px] uppercase tracking-widest mt-1">{t('roles.caps_overview', 'Network Capabilities Overview')}</DialogDescription>
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
