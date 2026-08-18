"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Users, Shield, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchApprovalRoles, createApprovalRole, updateApprovalRole, deleteApprovalRole } from "../api";
import { fetchUsers } from "@/modules/identity/api";
import { usePermissions } from "@/hooks/use-permissions";

type WorkflowRoleUser = {
  id: number;
  name?: string;
  email?: string;
};

type WorkflowApprovalRole = {
  id: number;
  name: string;
  description?: string | null;
  users?: WorkflowRoleUser[];
};

export default function ApprovalRolesPage() {
  const { hasAnyPermission } = usePermissions();
  const canManageRoles = hasAnyPermission(["manage_workflow_roles", "manage_workflow_automation"]);
  const [roles, setRoles] = useState<WorkflowApprovalRole[]>([]);
  const [users, setUsers] = useState<WorkflowRoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<WorkflowApprovalRole | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    user_ids: [] as number[],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesData, usersData] = await Promise.all([
        fetchApprovalRoles(),
        fetchUsers({ per_page: 100 })
      ]);
      setRoles((rolesData.data || []) as WorkflowApprovalRole[]);
      setUsers(((usersData as Record<string, unknown>).data || []) as WorkflowRoleUser[]);
    } catch {
      toast.error("Failed to load roles and users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDialog = (role: WorkflowApprovalRole | null = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || "",
        user_ids: role.users?.map((u) => u.id) || [],
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: "",
        description: "",
        user_ids: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    try {
      if (editingRole) {
        await updateApprovalRole(editingRole.id, formData);
        toast.success("Role updated successfully");
      } else {
        await createApprovalRole(formData);
        toast.success("Role created successfully");
      }
      setIsDialogOpen(false);
      loadData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save role.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    
    try {
      await deleteApprovalRole(id);
      toast.success("Role deleted");
      loadData();
    } catch {
      toast.error("Delete failed");
    }
  };

  const toggleUser = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      user_ids: prev.user_ids.includes(userId)
        ? prev.user_ids.filter(id => id !== userId)
        : [...prev.user_ids, userId]
    }));
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Roles</h1>
          <p className="text-muted-foreground">Manage groups of users who can approve specific requests.</p>
        </div>
        {canManageRoles ? (
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" /> Create Role
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted" />
              <CardContent className="h-32" />
            </Card>
          ))
        ) : roles.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">No roles defined</h3>
            <p className="text-muted-foreground mb-6">Create a role to group approvers for easy assignment.</p>
            {canManageRoles ? (
              <Button variant="outline" onClick={() => handleOpenDialog()}>
                Create first role
              </Button>
            ) : null}
          </div>
        ) : (
          roles.map((role) => (
            <Card key={role.id} className="group relative overflow-hidden transition-all hover:shadow-lg border-primary/10">
              {canManageRoles ? (
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(role)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(role.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{role.name}</CardTitle>
                    <CardDescription className="line-clamp-1">{role.description || "No description"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{role.users?.length || 0} members</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.users?.slice(0, 5).map((user) => (
                      <Badge key={user.id} variant="secondary" className="text-[11px]">
                        {user.name}
                      </Badge>
                    ))}
                    {(role.users && role.users.length > 5) && (
                      <Badge variant="outline" className="text-[11px]">
                        +{role.users.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create Approval Role"}</DialogTitle>
            <DialogDescription>
              Give the role a name and select the users who belong to it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name</Label>
              <Input 
                id="name" 
                placeholder="e.g., Financial Controllers" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input 
                id="description" 
                placeholder="Briefly describe the purpose of this role" 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Members ({formData.user_ids.length} selected)</Label>
                <div className="relative w-40">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search users..." 
                    className="pl-8 h-8 text-xs" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Card className="border-muted">
                <ScrollArea className="h-[200px] p-2">
                  <div className="space-y-1">
                    {filteredUsers.length === 0 ? (
                      <p className="text-center py-4 text-sm text-muted-foreground">No users found</p>
                    ) : (
                      filteredUsers.map((user) => (
                        <div 
                          key={user.id} 
                          className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleUser(user.id)}
                        >
                          <Checkbox 
                            id={`user-${user.id}`} 
                            checked={formData.user_ids.includes(user.id)}
                            onCheckedChange={() => toggleUser(user.id)}
                          />
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium leading-none truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
