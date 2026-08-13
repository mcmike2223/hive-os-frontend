"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  UserPlus, 
  Search, 
  Loader2, 
  ShieldAlert,
  UserCheck,
  Users,
  Shield,
  ChevronRight
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchUsers } from "@/modules/identity/api";
import { assignApprovers, fetchApprovalRoles } from "../api";
import { toast } from "sonner";

interface AssignApproversDialogProps {
  isOpen: boolean;
  onClose: () => void;
  approvableType: string;
  approvableId: number;
  approvableName?: string;
  onSuccess?: () => void;
}

type AssignableUser = {
  id: number;
  name: string;
  email?: string;
  avatar_url?: string;
};

type ApprovalRoleOption = {
  id: number;
  name: string;
  users?: Array<{ id: number }>;
};

type ApprovalAssignee = {
  id: number;
  type: 'user' | 'role';
  name: string;
  avatar?: string;
  sequence: number;
};

export function AssignApproversDialog({
  isOpen,
  onClose,
  approvableType,
  approvableId,
  approvableName,
  onSuccess,
}: AssignApproversDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [approversList, setApproversList] = React.useState<ApprovalAssignee[]>([]);

  const mutation = useMutation({
    mutationFn: (approvers: ApprovalAssignee[]) => {
      return assignApprovers({
        approvable_type: approvableType,
        approvable_id: approvableId,
        approvers: approvers.map(a => ({
          user_id: a.type === 'user' ? a.id : undefined,
          role_id: a.type === 'role' ? a.id : undefined,
          sequence: a.sequence,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Approvers assigned successfully");
      queryClient.invalidateQueries({ queryKey: ["workflow"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", "inline-approval", approvableType, approvableId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", "approvals"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-dashboard"] });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to assign approvers");
    }
  });

  const [activeTab, setActiveTab] = React.useState("users");

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["identity", "users", { search, pageSize: 50 }],
    queryFn: () => fetchUsers({ search, pageSize: 50 }),
    enabled: isOpen,
  });

  const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["approval-roles"],
    queryFn: async () => {
      const result = await fetchApprovalRoles({ per_page: 100 });
      if (!result) return [];
      return Array.isArray(result) ? result : (result.data || []);
    },
    enabled: isOpen,
  });

  const toggleUser = (user: Pick<AssignableUser, "id"> & Partial<AssignableUser>) => {
    setApproversList(prev => {
      const exists = prev.find(a => a.id === user.id && a.type === 'user');
      if (exists) {
        return prev.filter(a => !(a.id === user.id && a.type === 'user'));
      }
      return [...prev, {
        id: user.id,
        type: 'user',
        name: user.name || `User #${user.id}`,
        avatar: user.avatar_url,
        sequence: prev.length + 1
      }];
    });
  };

  const toggleRole = (role: Pick<ApprovalRoleOption, "id"> & Partial<ApprovalRoleOption>) => {
    setApproversList(prev => {
      const exists = prev.find(a => a.id === role.id && a.type === 'role');
      if (exists) {
        return prev.filter(a => !(a.id === role.id && a.type === 'role'));
      }
      return [...prev, {
        id: role.id,
        type: 'role',
        name: role.name || `Role #${role.id}`,
        sequence: prev.length + 1
      }];
    });
  };

  const updateSequence = (id: number, type: 'user' | 'role', seq: number) => {
    setApproversList(prev => prev.map(a => 
      (a.id === id && a.type === type) ? { ...a, sequence: seq } : a
    ));
  };

  const handleConfirm = () => {
    mutation.mutate(approversList);
  };

  const users = ((usersData as Record<string, unknown>)?.data || []) as AssignableUser[];
  const roles = (Array.isArray(rolesData) ? rolesData : []) as ApprovalRoleOption[];
  
  if (roles.length === 0) {
    console.log("Roles debug - rolesData:", rolesData);
  }
  
  const totalSelected = approversList.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] rounded-[2rem] overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl flex flex-col h-[85vh]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <UserPlus className="h-6 w-6 text-primary" />
            Approval Flow
          </DialogTitle>
          <DialogDescription className="font-medium">
            {approvableName ? (
              <>Set the approval sequence for <span className="font-bold text-foreground underline decoration-primary/30">{approvableName}</span></>
            ) : (
              <>Define who needs to authorize this {approvableType.split('\\').pop()}.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/50 p-1 mb-4">
              <TabsTrigger value="users" className="rounded-lg gap-2 text-xs">
                <Users className="h-3.5 w-3.5" />
                Individual Users
              </TabsTrigger>
              <TabsTrigger value="roles" className="rounded-lg gap-2 text-xs">
                <Shield className="h-3.5 w-3.5" />
                Approval Roles
              </TabsTrigger>
              <TabsTrigger value="review" className="rounded-lg gap-2 text-xs relative">
                <ShieldAlert className="h-3.5 w-3.5" />
                Order & Review
                {totalSelected > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[11px] text-white font-bold">
                    {totalSelected}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="users" className="h-full m-0 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search team members..."
                    className="pl-9 rounded-xl bg-muted/50 border-none h-11"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <ScrollArea className="h-[calc(85vh-350px)] rounded-[1.5rem] border border-border/40 p-2 bg-muted/20">
                  {isLoadingUsers ? (
                    <div className="flex h-full items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center p-8">
                      <ShieldAlert className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">No team members found</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {users.map((user) => {
                        const isSelected = approversList.some(a => a.id === user.id && a.type === 'user');
                        return (
                          <div
                            key={user.id}
                            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                              isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-background/80 border border-transparent'
                            }`}
                            onClick={() => toggleUser(user)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border border-border/20 shadow-sm">
                                <AvatarImage src={user.avatar_url} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-black">
                                  {user.name.split(' ').map((n) => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-black tracking-tight">{user.name}</span>
                                <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-tighter">{user.email}</span>
                              </div>
                            </div>
                            <Checkbox 
                              checked={isSelected}
                              className="rounded-full h-5 w-5 border-2"
                              onCheckedChange={() => toggleUser(user)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="roles" className="h-full m-0 space-y-4">
                <ScrollArea className="h-[calc(85vh-300px)] rounded-[1.5rem] border border-border/40 p-2 bg-muted/20">
                  {isLoadingRoles ? (
                    <div className="flex h-full items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : roles.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center p-8">
                      <ShieldAlert className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">No approval roles created</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {roles.map((role) => {
                        const isSelected = approversList.some(a => a.id === role.id && a.type === 'role');
                        return (
                          <div
                            key={role.id}
                            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                              isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-background/80 border border-transparent'
                            }`}
                            onClick={() => toggleRole(role)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Shield className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-black tracking-tight">{role.name}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {role.users?.length || 0} member{role.users?.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                            <Checkbox 
                              checked={isSelected}
                              className="rounded-full h-5 w-5 border-2"
                              onCheckedChange={() => toggleRole(role)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="review" className="h-full m-0 space-y-4">
                {approversList.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center p-8 opacity-50">
                    <UserPlus className="h-12 w-12 mb-4" />
                    <p className="font-bold">No approvers selected</p>
                    <p className="text-sm">Go back to Users or Roles to pick your team.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(85vh-300px)] rounded-[1.5rem] border border-border/40 p-2 bg-muted/20">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary">Approval Order</h3>
                        <Badge variant="secondary" className="rounded-full text-[11px]">Sequential Flow</Badge>
                      </div>
                      <div className="space-y-3">
                        {approversList
                          .sort((a, b) => a.sequence - b.sequence)
                          .map((approver, index) => (
                            <div key={`${approver.type}-${approver.id}`} className="group flex items-center gap-4 bg-background p-3 rounded-2xl border border-border/40 shadow-sm relative overflow-hidden">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors" />
                              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-black text-xs">
                                {index + 1}
                              </div>
                              <div className="flex-1 flex items-center gap-3">
                                {approver.type === 'user' ? (
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={approver.avatar} />
                                    <AvatarFallback className="text-[11px]">{approver.name[0]}</AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                                    <Shield className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold tracking-tight">{approver.name}</span>
                                  <span className="text-[11px] text-muted-foreground italic capitalize">{approver.type}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input 
                                  type="number" 
                                  className="w-16 h-8 text-center rounded-lg bg-muted/50 border-none font-bold text-sm"
                                  value={approver.sequence}
                                  onChange={(e) => updateSequence(approver.id, approver.type, parseInt(e.target.value) || 1)}
                                />
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => approver.type === 'user' ? toggleUser({id: approver.id}) : toggleRole({id: approver.id})}
                                >
                                  ×
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground text-center px-4">
                        Approvers will be notified in the order defined above. Sequence 2 only sees the request after Sequence 1 approves.
                      </p>
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border/40 gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl h-11 px-6">
            Cancel
          </Button>
          {activeTab !== 'review' && totalSelected > 0 ? (
            <Button 
              onClick={() => setActiveTab('review')}
              className="rounded-xl px-8 h-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
            >
              Review Flow ({totalSelected})
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleConfirm}
              disabled={totalSelected === 0 || mutation.isPending}
              className="rounded-xl px-8 h-11 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
              Send for Approval
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
