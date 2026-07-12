"use client";

import React, { useState, useEffect } from "react";
import { GitBranch, Send, Trash2, Settings, Users, Shield, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  createWorkflowApproval,
  fetchWorkflowDefinitions,
  createWorkflowDefinition,
  deleteWorkflowDefinition,
  fetchApprovalRoles,
  fetchWorkflowTargets,
  type WorkflowTarget,
} from "../api";
import { fetchUsers } from "@/modules/identity/api";

const PRODUCT_MODEL_TYPE = "Modules\\Inventory\\Models\\Product";

const APPROVABLE_MODELS = [
  { label: "Inventory → Product", value: "Modules\\Inventory\\Models\\Product" },
  { label: "Inventory → InventoryItem", value: "Modules\\Inventory\\Models\\InventoryItem" },
  { label: "Inventory → InventoryDocument", value: "Modules\\Inventory\\Models\\InventoryDocument" },
  { label: "Inventory → QA Batch / Record", value: "Modules\\Inventory\\Models\\InventoryEntityRecord" },
  { label: "Inventory → ProductCategory", value: "Modules\\Inventory\\Models\\ProductCategory" },
  { label: "Inventory → Supplier", value: "Modules\\Inventory\\Models\\Supplier" },
  { label: "Warehouse → StockMovement", value: "Modules\\Warehouse\\Models\\StockMovement" },
  { label: "Identity → User", value: "Modules\\Identity\\Models\\User" },
];

const WORKFLOW_TARGET_PATHS: Record<string, string> = {
  "Modules\\Inventory\\Models\\Product": "/dashboard/inventory/products",
  "Modules\\Inventory\\Models\\InventoryItem": "/dashboard/inventory/inventory",
  "Modules\\Inventory\\Models\\InventoryDocument": "/dashboard/inventory/documents",
  "Modules\\Inventory\\Models\\InventoryEntityRecord": "/dashboard/inventory/qa",
  "Modules\\Inventory\\Models\\ProductCategory": "/dashboard/inventory/catalog/categories",
  "Modules\\Inventory\\Models\\Supplier": "/dashboard/inventory/suppliers",
  "Modules\\Warehouse\\Models\\StockMovement": "/dashboard/warehouse/stock-movements",
  "Modules\\Identity\\Models\\User": "/dashboard/security/users",
};

interface WorkflowUser {
  id: number;
  name: string;
}

interface WorkflowRole {
  id: number;
  name: string;
}

interface WorkflowDefinitionRow {
  id: number;
  name: string;
  model_type: string;
  approver_ids?: number[] | null;
  approval_role_ids?: number[] | null;
  required_approvals: number;
  trigger_event: string;
  actions?: {
    product_quality_gate?: {
      enabled?: boolean;
      approve_when?: string;
      reject_when?: string;
    };
  } | null;
  signature_required?: boolean;
  is_active: boolean;
}

type CompactApproverMultiSelectProps<T extends { id: number; name: string }> = {
  label: string;
  options: T[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
  chipClassName: string;
  emptyText: string;
};

function getWorkflowTargetPath(modelType: string): string {
  return WORKFLOW_TARGET_PATHS[modelType] ?? "/dashboard/workflow/approvals";
}

function CompactApproverMultiSelect<T extends { id: number; name: string }>({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  icon: Icon,
  chipClassName,
  emptyText,
}: CompactApproverMultiSelectProps<T>) {
  const anchor = useComboboxAnchor();
  const selectedValues = selectedIds.map(String);

  return (
    <div className="space-y-3">
      <Label className="text-xs font-semibold uppercase text-muted-foreground">{label}</Label>
      <Combobox
        value={selectedValues}
        onValueChange={(value) => onChange((value as string[]).map((id) => Number(id)).filter(Boolean))}
        multiple
      >
        <div ref={anchor} className="flex min-h-12 w-full overflow-hidden rounded-2xl border border-border/50 bg-background/70 px-2 transition-all hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
          <ComboboxChips className="w-full border-none bg-transparent py-2 shadow-none">
            {selectedValues.map((id) => {
              const option = options.find((item) => String(item.id) === id);

              return (
                <ComboboxChip key={id} value={id} className={chipClassName}>
                  <Icon className="h-3 w-3" />
                  {option?.name || `#${id}`}
                </ComboboxChip>
              );
            })}
            <ComboboxChipsInput placeholder={selectedIds.length ? "Add more..." : placeholder} className="text-xs font-semibold" />
          </ComboboxChips>
        </div>
        <ComboboxContent anchor={anchor} className="rounded-2xl border-border/50 shadow-2xl">
          <ComboboxList>
            <ComboboxEmpty>{emptyText}</ComboboxEmpty>
            {options.map((option) => (
              <ComboboxItem key={option.id} value={String(option.id)} className="rounded-xl text-xs font-bold">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {option.name}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

export default function WorkflowRulesPage() {
  const [definitions, setDefinitions] = useState<WorkflowDefinitionRow[]>([]);
  const [targets, setTargets] = useState<WorkflowTarget[]>(APPROVABLE_MODELS.map((model) => ({
    ...model,
    model_type: model.value,
    events: ["manual", "on_create", "on_update", "on_status_change", "submit_for_approval"],
  })));
  const [users, setUsers] = useState<WorkflowUser[]>([]);
  const [roles, setRoles] = useState<WorkflowRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    model_type: "",
    approver_ids: [] as number[],
    approval_role_ids: [] as number[],
    required_approvals: 1,
    trigger_event: "manual",
    product_quality_gate: false,
    signature_required: true,
    prevent_duplicate_pending: true,
    is_active: true,
  });
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [manualAssignment, setManualAssignment] = useState({
    model_type: "",
    approvable_id: "",
    trigger_event: "manual",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [defsData, usersData, rolesData, targetsData] = await Promise.all([
        fetchWorkflowDefinitions(),
        fetchUsers({ per_page: 100 }),
        fetchApprovalRoles({ per_page: 100 }),
        fetchWorkflowTargets(),
      ]);
      setDefinitions((defsData || []) as WorkflowDefinitionRow[]);
      setUsers((usersData.data || []) as WorkflowUser[]);
      setRoles((rolesData.data || []) as WorkflowRole[]);
      if (targetsData?.length) {
        setTargets(targetsData);
      }
    } catch {
      toast.error("Failed to load workflow data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDialog = () => {
    setFormData({
      name: "",
      model_type: "",
      approver_ids: [],
      approval_role_ids: [],
      required_approvals: 1,
      trigger_event: "manual",
      product_quality_gate: false,
      signature_required: true,
      prevent_duplicate_pending: true,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenAssignDialog = () => {
    setManualAssignment({
      model_type: "",
      approvable_id: "",
      trigger_event: "manual",
    });
    setIsAssignDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.model_type) {
      toast.error("Name and Model Type are required");
      return;
    }

    if (formData.approver_ids.length === 0 && formData.approval_role_ids.length === 0) {
      toast.error("At least one approver or role is required");
      return;
    }

    try {
      const { product_quality_gate, ...baseFormData } = formData;
      const productQualityGate = formData.model_type === PRODUCT_MODEL_TYPE && product_quality_gate;

      await createWorkflowDefinition({
        ...baseFormData,
        actions: productQualityGate
          ? {
              product_quality_gate: {
                enabled: true,
                source: "latest_product_batch",
                approve_when: "qa_passed",
                reject_when: "qa_failed",
              },
            }
          : undefined,
      });
      toast.success("Workflow rule created");
      setIsDialogOpen(false);
      loadData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save rule.");
    }
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    setRuleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!ruleToDelete) return;
    try {
      await deleteWorkflowDefinition(ruleToDelete);
      toast.success("Rule deleted");
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
      loadData();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleManualAssign = async () => {
    const recordId = Number(manualAssignment.approvable_id);
    if (!manualAssignment.model_type || !recordId) {
      toast.error("Select a model and enter the record ID to assign.");
      return;
    }

    const selectedTarget = targets.find((target) => target.value === manualAssignment.model_type);

    try {
      const response = await createWorkflowApproval({
        approvable_type: manualAssignment.model_type,
        approvable_id: recordId,
        trigger_event: manualAssignment.trigger_event,
        module_slug: selectedTarget?.module_slug,
        submodule_slug: selectedTarget?.submodule_slug,
        functionality: manualAssignment.trigger_event,
        target_url: getWorkflowTargetPath(manualAssignment.model_type),
      });

      if (!response) return;

      toast.success(`Workflow started for ${response.count ?? 0} signer(s).`);
      setIsAssignDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign workflow.");
    }
  };

  const selectedRuleTarget = targets.find((target) => target.value === formData.model_type);
  const selectedAssignmentTarget = targets.find((target) => target.value === manualAssignment.model_type);
  const ruleEvents = selectedRuleTarget?.events?.length
    ? selectedRuleTarget.events
    : ["manual", "on_create", "on_update", "on_status_change", "submit_for_approval"];
  const assignmentEvents = selectedAssignmentTarget?.events?.length
    ? selectedAssignmentTarget.events
    : ["manual", "on_create", "on_update", "on_status_change", "submit_for_approval"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Rules</h1>
          <p className="text-muted-foreground">Automate approvals by defining who must approve specific actions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleOpenAssignDialog} className="gap-2">
            <Send className="h-4 w-4" /> Assign Workflow
          </Button>
          <Button onClick={handleOpenDialog} className="gap-2 bg-primary hover:bg-primary/90">
            <Zap className="h-4 w-4" /> Create Rule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          Array(2).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))
        ) : definitions.length === 0 ? (
          <div className="text-center py-24 bg-muted/10 rounded-2xl border-2 border-dashed border-muted">
            <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-xl font-semibold">No rules found</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Rules allow you to automatically assign approvers when a request is made for a specific module.
            </p>
            <Button variant="outline" size="lg" onClick={handleOpenDialog}>
              Set up your first rule
            </Button>
          </div>
        ) : (
          definitions.map((def) => (
            <Card key={def.id} className="overflow-hidden border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{def.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">
                      Target: {targets.find(m => m.value === def.model_type)?.label || def.model_type}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={def.is_active ? "default" : "outline"} className={def.is_active ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20" : ""}>
                    {def.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <AlertDialog open={deleteDialogOpen && ruleToDelete === def.id} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setRuleToDelete(null); } }}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(def.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2rem] bg-background/95 backdrop-blur-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Workflow Rule?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the workflow rule <strong>"{def.name}"</strong>. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="rounded-xl bg-destructive hover:bg-destructive/90">
                          Delete Rule
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent className="bg-muted/30 py-6 border-y border-muted">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Trigger Event</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{def.trigger_event.replace("_", " ")}</Badge>
                      {def.signature_required && <Badge variant="secondary">Signature</Badge>}
                      {def.actions?.product_quality_gate?.enabled && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Product QA Gate</Badge>}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[200px] space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Approvers Sequence</span>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
  {def.approver_ids?.map((approver: number | {id: number, sequence: number}) => {
    const uid = typeof approver === 'number' ? approver : approver.id;
    const user = users.find(u => u.id === uid);
    return (
      <Badge key={uid} variant="secondary" className="gap-1 px-2 py-1">
        <Users className="h-3 w-3" /> {user?.name || `User #${uid}`}
      </Badge>
    );
  })}
  {def.approval_role_ids?.map((rid: number) => {
    const role = roles.find(r => r.id === rid);
    return (
      <Badge key={rid} variant="default" className="gap-1 px-2 py-1 bg-indigo-500">
        <Shield className="h-3 w-3" /> {role?.name || `Role #${rid}`}
      </Badge>
    );
  })}
</div>
                  </div>
                  <div className="space-y-1 text-center pr-4">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Required</span>
                    <div className="text-2xl font-black text-primary">{def.required_approvals}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <GitBranch className="h-5 w-5 text-primary" />
              Assign Workflow
            </DialogTitle>
            <DialogDescription>
              Start the active rule for an existing record. Approvers come from the workflow rule.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label>Target Model</Label>
              <Select
                value={manualAssignment.model_type}
                onValueChange={(model_type) => {
                  const target = targets.find((item) => item.value === model_type);
                  const nextEvents = target?.events?.length ? target.events : ["manual"];
                  setManualAssignment({
                    ...manualAssignment,
                    model_type,
                    trigger_event: nextEvents.includes(manualAssignment.trigger_event) ? manualAssignment.trigger_event : nextEvents[0] ?? "manual",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((model) => (
                    <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Record ID</Label>
                <Input
                  inputMode="numeric"
                  placeholder="Example: 42"
                  value={manualAssignment.approvable_id}
                  onChange={(event) => setManualAssignment({ ...manualAssignment, approvable_id: event.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Workflow Event</Label>
                <Select
                  value={manualAssignment.trigger_event}
                  onValueChange={(trigger_event) => setManualAssignment({ ...manualAssignment, trigger_event })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentEvents.map((event) => (
                      <SelectItem key={event} value={event}>{event.replaceAll("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleManualAssign} className="gap-2 px-8">
              <Send className="h-4 w-4" />
              Start Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Create Workflow Rule</DialogTitle>
            <DialogDescription>
              Define the conditions and approvers for this automated workflow.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input 
                id="name" 
                placeholder="e.g., High-Value Stock Movement Approval" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Approvable Module</Label>
                <Select 
                  value={formData.model_type} 
                  onValueChange={(v) => {
                    const target = targets.find((item) => item.value === v);
                    const nextEvents = target?.events?.length ? target.events : ["manual"];
                    setFormData({
                      ...formData,
                      model_type: v,
                      trigger_event: nextEvents.includes(formData.trigger_event) ? formData.trigger_event : nextEvents[0] ?? "manual",
                      product_quality_gate: v === PRODUCT_MODEL_TYPE,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map(model => (
                      <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Trigger Event</Label>
                <Select 
                  value={formData.trigger_event} 
                  onValueChange={(v) => setFormData({ ...formData, trigger_event: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {ruleEvents.map((event) => (
                      <SelectItem key={event} value={event}>{event.replaceAll("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-muted">
              <Label className="text-base">Approvers Configuration</Label>
              
              <CompactApproverMultiSelect
                label="Individual Users"
                options={users}
                selectedIds={formData.approver_ids}
                onChange={(approver_ids) => setFormData({ ...formData, approver_ids })}
                placeholder="Select one or more users..."
                icon={Users}
                chipClassName="rounded-xl border-primary/20 bg-primary/10 text-primary"
                emptyText="No users found."
              />

              <CompactApproverMultiSelect
                label="Approval Roles"
                options={roles}
                selectedIds={formData.approval_role_ids}
                onChange={(approval_role_ids) => setFormData({ ...formData, approval_role_ids })}
                placeholder="Select one or more roles..."
                icon={Shield}
                chipClassName="rounded-xl border-indigo-500/20 bg-indigo-500/10 text-indigo-600"
                emptyText="No approval roles found."
              />
            </div>

            {formData.model_type === PRODUCT_MODEL_TYPE && (
              <div className="grid gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Product Quality Assurance Gate</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Product approvals use the latest real QA batch status. QA passed unlocks approval; QA failed routes the approver to rejection with signature and notes.
                    </p>
                  </div>
                  <Switch
                    checked={formData.product_quality_gate}
                    onCheckedChange={(checked) => setFormData({ ...formData, product_quality_gate: checked })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Approve when qa_passed</Badge>
                  <Badge className="bg-rose-500/10 text-rose-700 border-rose-500/20">Reject when qa_failed</Badge>
                  <Badge variant="outline">Signature and comment required</Badge>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-4 border rounded-xl">
              <div className="space-y-0.5">
                <Label>Minimum Required Approvals</Label>
                <p className="text-[10px] text-muted-foreground">Number of approvals needed to complete the process.</p>
              </div>
              <Input
                type="number"
                className="w-24 text-center font-bold"
                value={formData.required_approvals}
                min={1}
                onChange={(e) => setFormData({ ...formData, required_approvals: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div className="grid gap-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Signature</Label>
                  <p className="text-[10px] text-muted-foreground">Approvers must sign before approving or rejecting.</p>
                </div>
                <Switch
                  checked={formData.signature_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, signature_required: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Prevent Duplicate Pending Requests</Label>
                  <p className="text-[10px] text-muted-foreground">Re-use the active pending workflow instead of creating duplicates.</p>
                </div>
                <Switch
                  checked={formData.prevent_duplicate_pending}
                  onCheckedChange={(checked) => setFormData({ ...formData, prevent_duplicate_pending: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="px-8 bg-primary hover:bg-primary/90">Create Workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
