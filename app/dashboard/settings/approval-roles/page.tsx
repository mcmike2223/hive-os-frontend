"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { 
  Shield, 
  Plus, 
  Loader2, 
  Trash2, 
  Users,
  Search,
  Check,
  X,
  Pencil,
  MoreHorizontal,
  RotateCcw,
  Filter,
  AlertCircle,
  Zap,
  LayoutGrid
} from "lucide-react"; 
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/store/use-translation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/datatable/data-table";
import { 
  fetchApprovalRoles, 
  createApprovalRole, 
  updateApprovalRole, 
  deleteApprovalRole 
} from "@/modules/workflow/api";
import { fetchUsers } from "@/modules/identity/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { ApprovalRole } from "@/modules/workflow/types";

type TableQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortCol?: string | null;
  sortDir?: string | null;
};

// --- Dialog Components ---

function RoleFormDialog({ 
  isOpen, 
  onClose, 
  role,
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  role?: ApprovalRole | null;
  onSuccess: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || "");
    } else {
      setName("");
      setDescription("");
    }
  }, [role, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => role 
      ? updateApprovalRole(role.id, data)
      : createApprovalRole(data),
    onSuccess: () => {
      toast.success(role ? "Role updated" : "Role created");
      onSuccess();
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to save"));
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {role ? "Edit Role" : "Create Role"}
          </DialogTitle>
          <DialogDescription>
            {role ? "Update role details." : "Create a new approval role."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Role Name</label>
            <Input
              placeholder="e.g., Finance Approver"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button 
            onClick={() => mutation.mutate({ name, description })} 
            disabled={!name.trim() || mutation.isPending}
            className="rounded-xl"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {role ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageUsersDialog({ 
  isOpen, 
  onClose, 
  role,
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  role: ApprovalRole | null;
  onSuccess: () => void;
}) {
  const [selectedUserIds, setSelectedUserIds] = React.useState<number[]>([]);
  const [search, setSearch] = React.useState("");

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["identity", "users", { search, pageSize: 100 }],
    queryFn: () => fetchUsers({ search, pageSize: 100 }),
    enabled: isOpen,
  });

  React.useEffect(() => {
    if (role?.users) {
      setSelectedUserIds(role.users.map(u => u.id));
    }
  }, [role]);

  React.useEffect(() => {
    if (!isOpen) setSelectedUserIds([]);
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: (userIds: number[]) => updateApprovalRole(role!.id, { user_ids: userIds }),
    onSuccess: () => {
      toast.success("Users updated");
      onSuccess();
      onClose();
    },
    onError: (error: unknown) => {
      console.error("Update users error:", error);
      toast.error(getErrorMessage(error, "Failed to update users"));
    }
  });

  const toggleUser = (userId: number) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const users = ((usersData as Record<string, unknown>)?.data as Array<{ id: number; name: string; email: string; avatar_url?: string }>) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-[2rem] max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Manage Users - {role?.name}
          </DialogTitle>
          <DialogDescription>
            {role?.users?.length || 0} user(s) assigned
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl border p-2 min-h-[200px] max-h-[350px]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-4">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No users found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {users.map((user: { id: number; name: string; email: string; avatar_url?: string }) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleUser(user.id)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-xs">
                        {user.name?.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Checkbox checked={selectedUserIds.includes(user.id)} onCheckedChange={() => toggleUser(user.id)} />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t mt-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={() => mutation.mutate(selectedUserIds)} disabled={mutation.isPending} className="rounded-xl">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Save ({selectedUserIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Page Component ---

export default function ApprovalRolesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [usersOpen, setUsersOpen] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<ApprovalRole | null>(null);
  const { t } = useTranslation();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = useLocalStorage("approval-roles-page-size", 10);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortCol, setSortCol] = React.useState("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [tableKey, setTableKey] = React.useState(0);

  const { data: rolesData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["approval-roles", page, pageSize, search, statusFilter, sortCol, sortDir],
    queryFn: () => fetchApprovalRoles({ 
      page, 
      per_page: pageSize, 
      search, 
      status: statusFilter,
      sort_by: sortCol,
      sort_direction: sortDir
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApprovalRole,
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["approval-roles"] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => 
      updateApprovalRole(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approval-roles"] }),
  });

  const handleQueryChange = React.useCallback((q: TableQuery) => {
    if (q.page !== undefined) setPage(q.page);
    if (q.pageSize !== undefined) setPageSize(q.pageSize);
    if (q.search !== undefined) {
      setSearch(q.search ?? "");
      setPage(1);
    }
    if (q.sortCol !== undefined && q.sortCol) {
      setSortCol(q.sortCol);
      setSortDir(q.sortDir === "desc" ? "desc" : "asc");
    }
  }, [setPageSize]);

  const resetFilters = React.useCallback(() => {
    setStatusFilter("all");
    setSearch("");
    setPage(1);
    setTableKey(prev => prev + 1);
  }, []);

  const allRoles: ApprovalRole[] = rolesData?.data || [];
  const totalEntries = rolesData?.total || 0;

  const columns: ColumnDef<ApprovalRole>[] = [
    {
      accessorKey: "name",
      header: "Role",
      enableSorting: true,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            {row.original.description && (
              <div className="text-xs text-muted-foreground">{row.original.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "users",
      header: "Members",
      cell: ({ row }) => {
        const users = row.original.users || [];
        return (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {users.slice(0, 4).map((user) => (
                <Avatar key={user.id} className="h-7 w-7 border-2 border-background shadow-sm">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-[11px] font-bold">
                    {user.name?.split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
              ))}
              {users.length > 4 && (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold border-2 border-background">
                  +{users.length - 4}
                </div>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{users.length}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      enableSorting: true,
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"} className="rounded-full">
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={() => { setSelectedRole(row.original); setUsersOpen(true); }}>
              <Users className="h-4 w-4 mr-2" /> Manage Users
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedRole(row.original); setEditOpen(true); }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: row.original.id, is_active: !row.original.is_active })}>
              {row.original.is_active ? <><X className="h-4 w-4 mr-2" /> Deactivate</> : <><Check className="h-4 w-4 mr-2" /> Activate</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => { if (confirm(`Delete "${row.original.name}"?`)) deleteMutation.mutate(row.original.id); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card/40 p-6 rounded-[2rem] border border-border/50 backdrop-blur-md shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black font-space flex items-center gap-2 tracking-tight">
            <Shield className="h-6 w-6 text-primary" /> Approval Roles
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage roles for dynamic approval workflows across the network.
          </p>
        </div>
        
        <Button onClick={() => { setSelectedRole(null); setCreateOpen(true); }} className="rounded-xl shadow-lg shadow-primary/20 h-11 px-6 font-bold tracking-wide">
          <Plus className="mr-2 h-5 w-5" /> Create Role
        </Button>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-3 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-muted-foreground shrink-0 pl-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
          <SelectTrigger className="h-9 w-[130px] bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || search) && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-3 text-destructive hover:bg-destructive/10">
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      <DataTable
        key={tableKey}
        columns={columns}
        data={allRoles}
        totalEntries={totalEntries}
        loading={isLoading || isFetching}
        pageSize={pageSize}
        pageIndex={page}
        onQueryChange={handleQueryChange}
        onRefresh={() => refetch()}
        onResetFilters={resetFilters}
        searchPlaceholder="Search roles..."
        syncWithUrl={true}
        enableRowSelection={false}
      />

      <RoleFormDialog 
        isOpen={createOpen} 
        onClose={() => setCreateOpen(false)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["approval-roles"] })}
      />

      <RoleFormDialog 
        isOpen={editOpen} 
        onClose={() => setEditOpen(false)} 
        role={selectedRole}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["approval-roles"] })}
      />

      <ManageUsersDialog 
        isOpen={usersOpen} 
        onClose={() => setUsersOpen(false)} 
        role={selectedRole}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["approval-roles"] })}
      />
    </div>
  );
}