"use client";
 
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectApi } from "../api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarIcon, Loader2, TagIcon, UserIcon, BriefcaseIcon, XCircleIcon, X, Github, Cpu, Terminal, Link as LinkIcon, Clock } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { useUser } from "@/hooks/use-user";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { Project, ProjectStatus, TaskPriority, ProjectAttachment } from "../types";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { FileIcon, PaperclipIcon, UploadIcon, Users as UsersGroup, Wallet, Cpu as CpuIcon, Paperclip, Settings, Info, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/store/use-translation";

type ProjectAssetSelection = {
  id?: number | null;
  path?: string | null;
  url?: string | null;
  name?: string | null;
  media_details?: {
    relative_path?: string | null;
    url?: string | null;
    original_name?: string | null;
  };
};

type CreateProjectPayload = {
  name: string;
  description: string | null;
  status: ProjectStatus;
  project_manager_ids: string[]; // UUIDs
  client_stakeholder: string | null;
  start_date: string | null;
  end_date: string | null;
  priority: TaskPriority;
  assigned_to: string[]; // UUIDs
  tags: string[] | null;
  attachments: ProjectAttachment[] | null;
  budget?: number;
  currency?: string;
  hourly_rate?: number;
  estimated_hours?: number;
  estimated_revenue?: number;
  is_template?: boolean;
  repository_url?: string | null;
  tech_stack?: string[] | null;
};

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as ApiError).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
};

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  initialTab?: string;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  open,
  onOpenChange,
  project,
  initialTab = "general",
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status || "planning");
  const [projectManagerIds, setProjectManagerIds] = useState<string[]>(
    project?.members?.filter((member) => member.role === 'manager').map((member) => String(member.user_id)) || 
    (project?.project_manager_id ? [String(project.project_manager_id)] : [])
  );
  const [clientStakeholder, setClientStakeholder] = useState(project?.client_stakeholder || "");
  const [startDate, setStartDate] = useState<Date | undefined>(project?.start_date ? new Date(project.start_date) : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(project?.end_date ? new Date(project.end_date) : undefined);
  const [priority, setPriority] = useState<TaskPriority>(project?.priority || "medium");
  const [assignedTo, setAssignedTo] = useState<string[]>(project?.members?.map((member) => String(member.user_id)) || []);
  const [tags, setTags] = useState<string[]>(project?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [attachments, setAttachments] = useState<ProjectAttachment[]>(project?.attachments || []);
  const [budget, setBudget] = useState<string>(project?.budget?.toString() || "");
  const [currency, setCurrency] = useState<string>(project?.currency || "USD");
  const [hourlyRate, setHourlyRate] = useState<string>(project?.hourly_rate?.toString() || "");
  const [estimatedHours, setEstimatedHours] = useState<string>(project?.estimated_hours?.toString() || "");
  const [estimatedRevenue, setEstimatedRevenue] = useState<string>(project?.estimated_revenue?.toString() || "");
  const [isTemplate, setIsTemplate] = useState<boolean>(project?.is_template || false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [repositoryUrl, setRepositoryUrl] = useState(project?.repository_url || "");
  const [techStack, setTechStack] = useState<string[]>(project?.tech_stack || []);
  const [techInput, setTechInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { user: activeUser } = useUser();
  const isSoftwareDev = activeUser?.business_type?.toLowerCase()?.replace('-', ' ') === "software development";

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Project name is required";
    if (!status) newErrors.status = "Status is required";
    if (!priority) newErrors.priority = "Priority is required";
    if (!startDate) newErrors.start_date = "Start date is required";
    if (!endDate) newErrors.end_date = "End date is required";
    if (startDate && endDate && endDate < startDate) {
      newErrors.end_date = "End date must be after or equal to start date";
    }
    if (projectManagerIds.length === 0) {
      newErrors.project_manager_ids = "At least one project manager is required";
    }

    // Numeric validations
    if (budget && isNaN(parseFloat(budget))) {
      newErrors.budget = "Budget must be a valid number";
    }
    if (hourlyRate && isNaN(parseFloat(hourlyRate))) {
      newErrors.hourly_rate = "Hourly rate must be a valid number";
    }
    if (estimatedHours && isNaN(parseFloat(estimatedHours))) {
      newErrors.estimated_hours = "Estimated hours must be a valid number";
    }
    if (estimatedRevenue && isNaN(parseFloat(estimatedRevenue))) {
      newErrors.estimated_revenue = "Estimated revenue must be a valid number";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Sync state when project changes (for edit mode)
  React.useEffect(() => {
    if (project && open) {
      setName(project.name || "");
      setDescription(project.description || "");
      setStatus(project.status || "planning");
      const managerIds = project.members
        ?.filter((member) => member.role === 'manager' || member.role === 'owner')
        .map((member) => String(member.user_id)) || [];
      const primaryManagerId = project.project_manager_id ? [String(project.project_manager_id)] : [];
      setProjectManagerIds(Array.from(new Set([...managerIds, ...primaryManagerId])));
      setClientStakeholder(project.client_stakeholder || "");
      setStartDate(project.start_date ? new Date(project.start_date) : undefined);
      setEndDate(project.end_date ? new Date(project.end_date) : undefined);
      setPriority(project.priority || "medium");
      setAssignedTo(Array.from(new Set(project.members?.map((member) => String(member.user_id)) || [])));
      setTags(project.tags || []);
      setAttachments(project.attachments || []);
      setBudget(project.budget?.toString() || "");
      setCurrency(project.currency || "USD");
      setHourlyRate(project.hourly_rate?.toString() || "");
      setEstimatedHours(project.estimated_hours?.toString() || "");
      setEstimatedRevenue(project.estimated_revenue?.toString() || "");
      setIsTemplate(project.is_template || false);
      setActiveTab(initialTab);
    } else if (!project && open) {
      resetForm();
      setActiveTab(initialTab);
    }
  }, [project, open, initialTab]);

  const queryClient = useQueryClient();

  // Fetch users for selection
  const { data: users = [] } = useQuery({
    queryKey: ["users-search", ""],
    queryFn: () => projectApi.searchUsers(""),
    enabled: open,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["project-templates"],
    queryFn: () => projectApi.getTemplates(),
    enabled: open && !project,
  });

  const spawnMutation = useMutation({
    mutationFn: (data: { 
      templateId: string, 
      name: string, 
      start_date?: string, 
      project_manager_ids?: string[],
      budget?: number,
      currency?: string,
      hourly_rate?: number,
      estimated_hours?: number,
      estimated_revenue?: number
    }) => 
      projectApi.spawnProject(data.templateId, { 
        name: data.name, 
        start_date: data.start_date,
        project_manager_ids: data.project_manager_ids,
        budget: data.budget,
        currency: data.currency,
        hourly_rate: data.hourly_rate,
        estimated_hours: data.estimated_hours,
        estimated_revenue: data.estimated_revenue
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project spawned from template successfully");
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Failed to spawn project"));
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateProjectPayload) => 
      project ? projectApi.updateProject(project.id, data) : projectApi.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-summary"] });
      if (project) {
        queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      }
      toast.success(project ? "Project updated successfully" : "Project created successfully");
      onOpenChange(false);
      if (!project) resetForm();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, `Failed to ${project ? 'update' : 'create'} project`));
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setStatus("planning");
    setProjectManagerIds([]);
    setClientStakeholder("");
    setStartDate(undefined);
    setEndDate(undefined);
    setPriority("medium");
    setAssignedTo([]);
    setTags([]);
    setAttachments([]);
    setBudget("");
    setCurrency("USD");
    setHourlyRate("");
    setEstimatedHours("");
    setEstimatedRevenue("");
    setIsTemplate(false);
    setSelectedTemplateId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    if (selectedTemplateId && !project) {
      spawnMutation.mutate({
        templateId: selectedTemplateId,
        name: name.trim(),
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
        project_manager_ids: projectManagerIds,
        budget: budget ? parseFloat(budget) : undefined,
        currency: currency,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        estimated_revenue: estimatedRevenue ? parseFloat(estimatedRevenue) : undefined,
      });
      return;
    }

    mutation.mutate({
      name: name.trim(),
      description: description || null,
      status,
      project_manager_ids: projectManagerIds,
      client_stakeholder: clientStakeholder.trim() || null,
      start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
      end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      priority,
      assigned_to: assignedTo,
      tags: tags.length > 0 ? tags : null,
      attachments: attachments.length > 0 ? attachments : null,
      budget: budget !== "" ? parseFloat(budget) : undefined,
      currency,
      hourly_rate: hourlyRate !== "" ? parseFloat(hourlyRate) : undefined,
      estimated_hours: estimatedHours !== "" ? parseFloat(estimatedHours) : undefined,
      estimated_revenue: estimatedRevenue !== "" ? parseFloat(estimatedRevenue) : undefined,
      is_template: isTemplate,
      repository_url: isSoftwareDev ? (repositoryUrl || null) : undefined,
      tech_stack: isSoftwareDev ? (techStack.length > 0 ? techStack : null) : undefined,
    });
  };

  const handleFileSelect = (file: ProjectAssetSelection) => {
    const path = file?.media_details?.relative_path || file?.path;
    const name = file?.media_details?.original_name || file?.name || path?.split("/").pop() || "Unnamed File";
    const url = file?.media_details?.url || file?.url;

    if (!path) {
      toast.error("Could not extract file path");
      return;
    }

    if (attachments.some(a => a.path === path)) {
      toast.error("File already attached");
      return;
    }

    setAttachments([...attachments, { path, name, url }]);
    setIsFileManagerOpen(false);
    toast.success("File attached");
  };

  const removeAttachment = (pathToRemove: string) => {
    setAttachments(attachments.filter(a => a.path !== pathToRemove));
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const nextTag = tagInput.trim();
      if (!tags.includes(nextTag)) {
        setTags([...tags, nextTag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const managerAnchor = useComboboxAnchor();
  const assignedAnchor = useComboboxAnchor();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden rounded-[2rem] border border-border/40 shadow-2xl bg-card">
          <form onSubmit={handleSubmit} className="flex flex-col h-[85vh] bg-card">
            <DialogHeader className="px-8 pt-8 pb-4 bg-muted/20">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-sm border border-primary/20">
                  <BriefcaseIcon className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight text-foreground/90">
                    {project ? t('project_management.update_architecture', 'Update Architecture') : t('project_management.initialize_workspace', 'Initialize Workspace')}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {project ? t('project_management.refining_project_desc', 'Refining project parameters and resource allocation') : t('project_management.configure_project_desc', 'Configure project environment and strategic benchmarks')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-8 border-b border-border/40">
                <TabsList className="bg-transparent h-14 w-full justify-start gap-8 p-0 overflow-x-auto no-scrollbar">
                  <TabsTrigger 
                    value="general" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 px-1 gap-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all"
                  >
                    <Info className="h-4 w-4" /> {t('project_management.general', 'General')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="team" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 px-1 gap-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all"
                  >
                    <UsersGroup className="h-4 w-4" /> {t('project_management.team', 'Team')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="financials" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 px-1 gap-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all"
                  >
                    <Wallet className="h-4 w-4" /> {t('project_management.financials', 'Financials')}
                  </TabsTrigger>
                  {isSoftwareDev && (
                    <TabsTrigger 
                      value="engineering" 
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 px-1 gap-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all"
                    >
                      <CpuIcon className="h-4 w-4" /> {t('project_management.engineering', 'Engineering')}
                    </TabsTrigger>
                  )}
                  <TabsTrigger 
                    value="attachments" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 px-1 gap-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all"
                  >
                    <Paperclip className="h-4 w-4" /> {t('project_management.assets', 'Assets')}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <TabsContent value="general" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">

                  {!project && templates.length > 0 && (
                    <div className="bg-primary/[0.03] border border-primary/10 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <Settings className="h-3.5 w-3.5 text-primary" />
                        <Label className="text-primary font-black text-[9px] uppercase tracking-[0.2em]">{t('project_management.blueprint_selection', 'Blueprint Selection')}</Label>
                      </div>
                      <Select 
                        value={selectedTemplateId || "none"} 
                        onValueChange={(val) => {
                          setSelectedTemplateId(val === "none" ? null : val);
                          if (val !== "none") {
                            const tModel = templates.find(temp => temp.id === val);
                            if (tModel) {
                              setName(tModel.name + " (Copy)");
                              setDescription(tModel.description || "");
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-full bg-background border-primary/10 h-12 rounded-2xl focus:ring-primary/20 shadow-sm">
                          <SelectValue placeholder={t('project_management.initialize_blueprint', 'Initialize from a project blueprint...')} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-primary/10 shadow-2xl">
                          <SelectItem value="none" className="text-xs font-bold">{t('project_management.standard_project', 'Standard Project (Manual Configuration)')}</SelectItem>
                          {templates.map((temp) => (
                            <SelectItem key={temp.id} value={temp.id} className="text-xs font-bold">
                              {temp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.name && "text-destructive")}>
                        {t('project_management.project_identity', 'Project Identity')} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative group">
                        <BriefcaseIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                          }}
                          placeholder={t('project_management.project_name_placeholder', 'Project name...')}
                          className={cn("pl-11 h-14 bg-muted/10 border-border/40 rounded-2xl focus:ring-primary/20 transition-all font-bold text-sm", errors.name && "border-destructive focus-ring-destructive/20")}
                        />
                      </div>
                      {errors.name && <p className="text-[10px] font-bold text-destructive px-1">{errors.name}</p>}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="client" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{t('project_management.stakeholder_client', 'Stakeholder / Client')}</Label>
                      <div className="relative group">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                        <Input
                          id="client"
                          value={clientStakeholder}
                          onChange={(e) => setClientStakeholder(e.target.value)}
                          placeholder={t('project_management.client_identity_placeholder', 'Client identity...')}
                          className="pl-11 h-14 bg-muted/10 border-border/40 rounded-2xl focus:ring-primary/20 transition-all font-bold text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{t('project_management.strategic_intent', 'Strategic Intent (Description)')}</Label>
                    <RichTextEditor 
                      value={description} 
                      onChange={setDescription} 
                      className="min-h-[140px] rounded-3xl border-border/40 bg-muted/5 focus:ring-primary/10 transition-all shadow-inner p-2"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.status && "text-destructive")}>
                        {t('project_management.lifecycle_status', 'Lifecycle Status')} <span className="text-destructive">*</span>
                      </Label>
                      <Select 
                        value={status} 
                        onValueChange={(val) => {
                          setStatus(val as ProjectStatus);
                          if (errors.status) setErrors((prev: Record<string, string>) => ({ ...prev, status: "" }));
                        }}
                      >
                        <SelectTrigger className={cn("h-14 bg-muted/10 border-border/40 rounded-2xl font-bold text-xs", errors.status && "border-destructive")}>
                          <SelectValue placeholder={t('project_management.lifecycle_phase', 'Lifecycle phase')} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                          <SelectItem value="planning" className="text-xs font-bold">{t('project_management.status_planning', 'Planning')}</SelectItem>
                          <SelectItem value="active" className="text-xs font-bold">{t('project_management.status_active_prod', 'Active Production')}</SelectItem>
                          <SelectItem value="on_hold" className="text-xs font-bold">{t('project_management.status_on_hold', 'On Hold')}</SelectItem>
                          <SelectItem value="completed" className="text-xs font-bold">{t('project_management.status_delivered', 'Delivered / Completed')}</SelectItem>
                          <SelectItem value="archived" className="text-xs font-bold text-muted-foreground">{t('project_management.status_archived', 'Archived')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.priority && "text-destructive")}>
                        {t('project_management.priority_vector', 'Priority Vector')} <span className="text-destructive">*</span>
                      </Label>
                      <Select 
                        value={priority} 
                        onValueChange={(val) => {
                          setPriority(val as TaskPriority);
                          if (errors.priority) setErrors((prev: Record<string, string>) => ({ ...prev, priority: "" }));
                        }}
                      >
                        <SelectTrigger className={cn("h-14 bg-muted/10 border-border/40 rounded-2xl font-bold text-xs", errors.priority && "border-destructive")}>
                          <SelectValue placeholder={t('project_management.priority_weight', 'Priority weight')} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                          <SelectItem value="low" className="text-xs font-bold">{t('project_management.priority_low', 'Low Priority')}</SelectItem>
                          <SelectItem value="medium" className="text-xs font-bold">{t('project_management.priority_standard', 'Standard Priority')}</SelectItem>
                          <SelectItem value="high" className="text-xs font-bold">{t('project_management.priority_high', 'High Priority')}</SelectItem>
                          <SelectItem value="urgent" className="text-xs font-black text-destructive">{t('project_management.priority_critical', 'Critical / Urgent')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-6 rounded-3xl bg-primary/[0.02] border border-dashed border-primary/20 flex items-start gap-4 transition-colors hover:bg-primary/[0.04]">
                      <div className="pt-1">
                        <Checkbox 
                          id="is_template" 
                          checked={isTemplate} 
                          onCheckedChange={(checked) => setIsTemplate(!!checked)} 
                          className="rounded-lg border-primary/30 data-[state=checked]:bg-primary h-5 w-5"
                        />
                      </div>
                      <div className="grid gap-1 leading-tight">
                        <Label htmlFor="is_template" className="text-xs font-black uppercase tracking-widest text-foreground/80">{t('project_management.save_as_blueprint', 'Save as Blueprint')}</Label>
                        <p className="text-[10px] text-muted-foreground/60 font-bold">{t('project_management.save_as_blueprint_desc', 'Encapsulate this configuration as a reusable template.')}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="tags" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 flex items-center gap-2">
                        <TagIcon className="h-3.5 w-3.5" /> {t('project_management.project_taxonomies', 'Project Taxonomies (Tags)')}
                      </Label>
                      <div className="flex flex-wrap gap-2 p-3 bg-muted/10 border border-border/40 rounded-2xl min-h-[56px] items-center">
                        {tags.map((tag) => (
                          <Badge 
                            key={tag} 
                            className="bg-primary/5 text-primary border-primary/10 rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest gap-2"
                          >
                            {tag}
                            <button 
                              type="button" 
                              onClick={() => removeTag(tag)}
                              className="hover:text-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                        <input
                          id="tags"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleAddTag}
                          placeholder={t('project_management.add_tag', 'Add tag...')}
                          className="bg-transparent outline-none text-xs font-bold placeholder:text-muted-foreground/30 flex-1 min-w-[80px]"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="team" className="mt-0 space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-500">


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.start_date && "text-destructive")}>
                        {t('project_management.commencement_date', 'Commencement Date')} <span className="text-destructive">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left h-14 rounded-2xl bg-muted/10 border-border/40 font-bold text-sm px-5 transition-all hover:bg-muted/20",
                              !startDate && "text-muted-foreground/40",
                              errors.start_date && "border-destructive"
                            )}
                          >
                            <CalendarIcon className="mr-3 h-4 w-4 text-primary/60" />
                            {startDate ? format(startDate, "PPP") : <span className="text-xs uppercase tracking-widest">{t('project_management.select_date', 'Select Date')}</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl border-border/40 shadow-2xl" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(date) => {
                              setStartDate(date);
                              if (errors.start_date) setErrors((prev: Record<string, string>) => ({ ...prev, start_date: "" }));
                            }}
                            initialFocus
                            className="p-4"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-3">
                      <Label className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.end_date && "text-destructive")}>
                        {t('project_management.conclusion_target', 'Conclusion Target')} <span className="text-destructive">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left h-14 rounded-2xl bg-muted/10 border-border/40 font-bold text-sm px-5 transition-all hover:bg-muted/20",
                              !endDate && "text-muted-foreground/40",
                              errors.end_date && "border-destructive"
                            )}
                          >
                            <CalendarIcon className="mr-3 h-4 w-4 text-primary/60" />
                            {endDate ? format(endDate, "PPP") : <span className="text-xs uppercase tracking-widest">{t('project_management.select_date', 'Select Date')}</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl border-border/40 shadow-2xl" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(date) => {
                              setEndDate(date);
                              if (errors.end_date) setErrors(prev => ({ ...prev, end_date: "" }));
                            }}
                            initialFocus
                            className="p-4"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.project_manager_ids && "text-destructive")}>
                          {t('project_management.project_leadership', 'Project Leadership (Managers)')} <span className="text-destructive">*</span>
                        </Label>
                        <Combobox
                          value={projectManagerIds}
                          onValueChange={(val) => {
                            setProjectManagerIds(val as string[]);
                            if (errors.project_manager_ids) setErrors(prev => ({ ...prev, project_manager_ids: "" }));
                          }}
                          multiple
                        >
                          <div ref={managerAnchor} className="flex min-h-14 w-full rounded-2xl bg-muted/10 border border-border/40 transition-all hover:bg-muted/20 focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden px-2">
                            <ComboboxChips className="border-none bg-transparent shadow-none w-full py-2">
                              {projectManagerIds.map((id) => {
                                const user = users.find((candidate) => String(candidate.id) === id);
                                return (
                                  <ComboboxChip key={id} value={id} className="bg-primary/10 text-primary border-primary/20 rounded-xl">
                                    {user?.name || id}
                                  </ComboboxChip>
                                );
                              })}
                              <ComboboxChipsInput placeholder={t('project_management.assign_leadership', 'Assign leadership...')} className="text-xs font-bold" />
                            </ComboboxChips>
                          </div>
                          <ComboboxContent anchor={managerAnchor} className="rounded-2xl border-border/40 shadow-2xl">
                            <ComboboxList>
                              <ComboboxEmpty>{t('project_management.no_personnel_found', 'No personnel found.')}</ComboboxEmpty>
                              {users.map((user) => (
                                <ComboboxItem key={user.id} value={String(user.id)} className="rounded-xl font-bold text-xs">
                                  {user.name}
                                </ComboboxItem>
                              ))}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                        {errors.project_manager_ids && <p className="text-[10px] font-bold text-destructive px-1">{errors.project_manager_ids}</p>}
                      </div>

                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                          {t('project_management.operational_team', 'Operational Team (Members)')}
                        </Label>
                        <Combobox
                          value={assignedTo}
                          onValueChange={(val) => setAssignedTo(val as string[])}
                          multiple
                        >
                          <div ref={assignedAnchor} className="flex min-h-14 w-full rounded-2xl bg-muted/10 border border-border/40 transition-all hover:bg-muted/20 focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden px-2">
                            <ComboboxChips className="border-none bg-transparent shadow-none w-full py-2">
                              {assignedTo.map((id) => {
                                const user = users.find((candidate) => String(candidate.id) === id);
                                return (
                                  <ComboboxChip key={id} value={id} className="bg-primary/10 text-primary border-primary/20 rounded-xl">
                                    {user?.name || id}
                                  </ComboboxChip>
                                );
                              })}
                              <ComboboxChipsInput placeholder={t('project_management.deploy_team', 'Deploy team members...')} className="text-xs font-bold" />
                            </ComboboxChips>
                          </div>
                          <ComboboxContent anchor={assignedAnchor} className="rounded-2xl border-border/40 shadow-2xl">
                            <ComboboxList>
                              <ComboboxEmpty>{t('project_management.no_personnel_found', 'No personnel found.')}</ComboboxEmpty>
                              {users.map((user) => (
                                <ComboboxItem key={user.id} value={String(user.id)} className="rounded-xl font-bold text-xs">
                                  {user.name}
                                </ComboboxItem>
                              ))}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="financials" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label htmlFor="budget" className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.budget && "text-destructive")}>
                        {t('project_management.project_capital_allocation', 'Project Capital Allocation')} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors flex items-center justify-center font-bold text-lg">$</div>
                        <Input 
                          id="budget"
                          type="number"
                          value={budget}
                          onChange={(e) => {
                            setBudget(e.target.value);
                            if (errors.budget) setErrors(prev => ({ ...prev, budget: "" }));
                          }}
                          placeholder="0.00"
                          className={cn("pl-11 h-14 rounded-2xl bg-muted/10 border-border/40 font-bold text-sm transition-all focus:bg-background", errors.budget && "border-destructive focus-visible:ring-destructive")}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="currency" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                        {t('project_management.operational_currency', 'Operational Currency')}
                      </Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger id="currency" className="h-14 rounded-2xl bg-muted/10 border-border/40 font-bold text-sm px-5">
                          <SelectValue placeholder={t('project_management.select_currency', 'Select currency')} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                          <SelectItem value="USD" className="rounded-xl font-bold">USD - United States Dollar</SelectItem>
                          <SelectItem value="ETB" className="rounded-xl font-bold">ETB - Ethiopian Birr</SelectItem>
                          <SelectItem value="EUR" className="rounded-xl font-bold">EUR - Euro System</SelectItem>
                          <SelectItem value="GBP" className="rounded-xl font-bold">GBP - British Pound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-3">
                      <Label htmlFor="hourlyRate" className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.hourly_rate && "text-destructive")}>
                        {t('project_management.resource_hourly_rate', 'Resource Hourly Rate')}
                      </Label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors flex items-center justify-center font-bold text-lg">$</div>
                        <Input 
                          id="hourlyRate"
                          type="number"
                          value={hourlyRate}
                          onChange={(e) => {
                            setHourlyRate(e.target.value);
                            if (errors.hourly_rate) setErrors(prev => ({ ...prev, hourly_rate: "" }));
                          }}
                          placeholder="0.00"
                          className={cn("pl-11 h-14 rounded-2xl bg-muted/10 border-border/40 font-bold text-sm transition-all focus:bg-background", errors.hourly_rate && "border-destructive focus-visible:ring-destructive")}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="estimatedHours" className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.estimated_hours && "text-destructive")}>
                        {t('project_management.projected_labor_hours', 'Projected Labor Hours')}
                      </Label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                          <Clock className="h-5 w-5" />
                        </div>
                        <Input 
                          id="estimatedHours"
                          type="number"
                          value={estimatedHours}
                          onChange={(e) => {
                            setEstimatedHours(e.target.value);
                            if (errors.estimated_hours) setErrors(prev => ({ ...prev, estimated_hours: "" }));
                          }}
                          placeholder={t('project_management.total_hours_placeholder', 'Total hours...')}
                          className={cn("pl-11 h-14 rounded-2xl bg-muted/10 border-border/40 font-bold text-sm transition-all focus:bg-background", errors.estimated_hours && "border-destructive focus-visible:ring-destructive")}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-8 border-t border-border/40 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-foreground/80">{t('project_management.revenue_intelligence', 'Revenue Intelligence')}</h4>
                        <p className="text-[10px] text-muted-foreground/60 font-bold">{t('project_management.revenue_intelligence_desc', 'Define the projected financial outcome for ROI analysis')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <Label htmlFor="estimatedRevenue" className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70", errors.estimated_revenue && "text-destructive")}>
                          {t('project_management.target_project_revenue', 'Target Project Revenue')}
                        </Label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors flex items-center justify-center font-bold text-lg">$</div>
                          <Input 
                            id="estimatedRevenue"
                            type="number"
                            value={estimatedRevenue}
                            onChange={(e) => {
                              setEstimatedRevenue(e.target.value);
                              if (errors.estimated_revenue) setErrors(prev => ({ ...prev, estimated_revenue: "" }));
                            }}
                            placeholder="0.00"
                            className={cn("pl-11 h-14 rounded-2xl bg-muted/10 border-border/40 font-bold text-sm transition-all focus:bg-background", errors.estimated_revenue && "border-destructive focus-visible:ring-destructive")}
                          />
                        </div>
                        <p className="text-[9px] text-muted-foreground/50 font-bold px-1 uppercase tracking-tight italic">{t('project_management.used_for_roi', 'Used for ROI and Profitability Margin calculations.')}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                  {isSoftwareDev && (
                    <TabsContent value="engineering" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                      <div className="grid grid-cols-1 gap-8">
                        <div className="bg-primary/[0.02] border border-primary/10 rounded-3xl p-6 space-y-6">
                          <div className="flex items-center gap-3 border-b border-primary/10 pb-4">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                              <Github className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-widest text-foreground/80">{t('project_management.source_control', 'Source Control')}</h4>
                              <p className="text-[10px] text-muted-foreground/60 font-bold">{t('project_management.source_control_desc', 'Connect your development repository')}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label htmlFor="repo_url" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{t('project_management.repository_url', 'Repository URL')}</Label>
                            <div className="relative group">
                              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                              <Input 
                                id="repo_url"
                                placeholder="https://github.com/organization/repository" 
                                value={repositoryUrl}
                                onChange={(e) => setRepositoryUrl(e.target.value)}
                                className="bg-background h-14 pl-12 border-border/40 focus:border-primary/50 transition-all rounded-2xl font-bold text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-primary/[0.02] border border-primary/10 rounded-3xl p-6 space-y-6">
                          <div className="flex items-center gap-3 border-b border-primary/10 pb-4">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                              <Cpu className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-widest text-foreground/80">{t('project_management.technology_stack', 'Technology Stack')}</h4>
                              <p className="text-[10px] text-muted-foreground/60 font-bold">{t('project_management.technology_stack_desc', 'Define the core technical parameters')}</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2.5 min-h-[64px] p-4 rounded-2xl bg-background border border-dashed border-border/60">
                              {techStack.length > 0 ? (
                                techStack.map(tech => (
                                  <Badge 
                                    key={tech} 
                                    variant="secondary" 
                                    className="pl-3 pr-1.5 py-1.5 gap-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors rounded-xl border"
                                  >
                                    <span className="text-[10px] font-black tracking-wider uppercase">{tech}</span>
                                    <button 
                                      type="button"
                                      onClick={() => setTechStack(prev => prev.filter(t => t !== tech))}
                                      className="hover:bg-primary/20 rounded-lg p-1 transition-colors"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))
                              ) : (
                                <div className="flex items-center justify-center w-full">
                                  <span className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest italic">{t('project_management.no_technologies', 'No technologies defined yet')}</span>
                                </div>
                              )}
                            </div>
                            <div className="relative group">
                              <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                              <Input 
                                placeholder={t('project_management.type_technology_placeholder', 'Type technology (e.g. Next.js) and press Enter')} 
                                value={techInput}
                                onChange={(e) => setTechInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (techInput.trim() && !techStack.includes(techInput.trim())) {
                                      setTechStack([...techStack, techInput.trim()]);
                                      setTechInput("");
                                    }
                                  }
                                }}
                                className="bg-background h-14 pl-12 border-border/40 focus:border-primary/50 transition-all rounded-2xl font-bold text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  )}

                <TabsContent value="attachments" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{t('project_management.project_documentation', 'Project Documentation')}</Label>
                        <p className="text-[10px] text-muted-foreground/50 font-medium">{t('project_management.project_documentation_desc', 'Attach specifications, contracts, and briefs')}</p>
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsFileManagerOpen(true)}
                        className="h-10 px-4 gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5 transition-all font-bold text-xs"
                      >
                        <PaperclipIcon className="h-3.5 w-3.5" />
                        {t('project_management.access_library', 'Access Library')}
                      </Button>
                    </div>
                    
                    {attachments.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between group bg-muted/5 p-4 rounded-2xl border border-border/40 hover:border-primary/20 transition-all shadow-sm">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <FileIcon className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-xs font-bold truncate">{file.name}</p>
                                <p className="text-[9px] text-muted-foreground/60 truncate font-black uppercase tracking-widest">{file.path}</p>
                              </div>
                            </div>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => file.path && removeAttachment(file.path)}
                              className="h-8 w-8 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all"
                            >
                              <XCircleIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border/40 rounded-3xl bg-muted/5 text-muted-foreground/40 text-center group cursor-pointer hover:border-primary/20 hover:bg-primary/[0.02] transition-all" onClick={() => setIsFileManagerOpen(true)}>
                        <div className="h-14 w-14 rounded-full bg-muted/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <UploadIcon className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest mb-1">{t('project_management.no_assets_deployed', 'No Assets Deployed')}</p>
                        <p className="text-[10px] font-medium">{t('project_management.sync_project_files', 'Click to synchronize project files')}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <div className="px-10 pb-8 pt-4">
              <DialogFooter className="gap-3 sm:justify-end border-t border-border/40 pt-8">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="h-12 px-8 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-muted"
                >
                  {t('project_management.cancel', 'Cancel')}
                </Button>
                <Button 
                  type="submit" 
                  disabled={mutation.isPending || spawnMutation.isPending} 
                  className="h-12 px-10 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all bg-gradient-to-r from-primary to-primary/80"
                >
                  {mutation.isPending || spawnMutation.isPending ? (
                    <>
                      <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                      {t('project_management.processing', 'Processing')}
                    </>
                  ) : (
                    project ? t('project_management.commit_changes', 'Commit Changes') : t('project_management.initialize_project', 'Initialize Project')
                  )}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isFileManagerOpen} onOpenChange={setIsFileManagerOpen}>
        <DialogContent className="sm:max-w-[1000px] h-[80vh] flex flex-col p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <DialogTitle>Media Library</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <FileManagerClient 
              isPickerMode={true}
              onFileSelect={handleFileSelect}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateProjectModal;
