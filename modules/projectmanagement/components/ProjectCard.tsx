"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  CalendarDays, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye, 
  Layout,
  ExternalLink,
  Github
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Project } from "../types";
import { CreateProjectModal } from "./CreateProjectModal";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { projectApi } from "../api";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

interface ProjectCardProps {
  project: Project;
}

const priorityColors: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600",
  medium: "bg-sky-500/10 text-sky-600",
  high: "bg-amber-500/10 text-amber-600",
  urgent: "bg-rose-500/10 text-rose-600",
};

const statusColors: Record<string, string> = {
  planning: "bg-sky-500/10 text-sky-600",
  active: "bg-violet-500/10 text-violet-600",
  on_hold: "bg-amber-500/10 text-amber-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  archived: "bg-slate-500/10 text-slate-600",
};

function initials(name?: string | null) {
  return (name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function cleanText(value: string | null | undefined, defaultText: string) {
  return value?.replace(/<[^>]*>/g, "").trim() || defaultText;
}

function formatDate(value: string | null | undefined, defaultText: string) {
  if (!value) return defaultText;
  return format(new Date(value), "dd,MMM yyyy");
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const { t } = useTranslation();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: () => projectApi.deleteProject(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-summary"] });
      toast.success(t('project_management.project_deleted_success', "Project deleted successfully"));
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('project_management.project_delete_failed', "Failed to delete project"));
    },
  });

  const progress = project.progress || 0;
  const totalTasks = project.tasks_count || 0;
  const completedTasks = project.completed_tasks_count ?? Math.round((totalTasks * progress) / 100);
  const visibleMembers = project.members?.slice(0, 4) || [];
  const extraMembers = Math.max((project.members_count || project.members?.length || 0) - visibleMembers.length, 0);

  // Risk Assessment
  const isCompleted = project.status === 'completed';
  const dueDate = project.end_date ? new Date(project.end_date) : null;
  const isOverdue = !isCompleted && dueDate && dueDate < now;
  
  const diffDays = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isAtRisk = !isCompleted && !isOverdue && diffDays !== null && diffDays <= 3 && progress < 80;

  const getStatusConfig = () => {
    if (isOverdue) return { color: "text-rose-500", bg: "bg-rose-500", label: t('project_management.critical', "Critical") };
    if (isAtRisk) return { color: "text-orange-500", bg: "bg-orange-500", label: t('project_management.at_risk', "At Risk") };
    if (isCompleted) return { color: "text-emerald-500", bg: "bg-emerald-500", label: t('project_management.completed', "Completed") };
    return { color: "text-primary", bg: "bg-primary", label: project.status.replace("_", " ") };
  };

  const status = getStatusConfig();

  return (
    <>
      <Card className={cn(
        "group relative overflow-hidden border-border/40 bg-card p-0 shadow-xl shadow-black/5 transition-all duration-500 hover:-translate-y-2 hover:border-primary/40 hover:shadow-primary/5 rounded-[2rem]",
        isOverdue && "border-rose-500/20 shadow-rose-500/5",
        isAtRisk && "border-orange-500/20 shadow-orange-500/5"
      )}>
        {/* Decorative elements */}
        <div className={cn(
          "absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-20 transition-all group-hover:opacity-40",
          isOverdue ? "bg-rose-500" : isAtRisk ? "bg-orange-500" : "bg-primary"
        )} />
        
        <div className="relative p-6">
          {/* Header Section */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3 items-center">
                {project.managers && project.managers.length > 0 ? (
                  project.managers.map((manager, idx) => (
                    <Avatar key={manager.id} className={cn(
                      "h-12 w-12 border-4 border-card ring-2 transition-transform hover:translate-y-[-4px] hover:z-10",
                      isOverdue ? "ring-rose-500/30" : isAtRisk ? "ring-orange-500/30" : "ring-primary/20"
                    )}>
                      <AvatarImage src={manager.avatar_path || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                        {initials(manager.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))
                ) : (
                  <Avatar className={cn(
                    "h-12 w-12 border-4 border-card ring-2 transition-transform group-hover:scale-105",
                    isOverdue ? "ring-rose-500/30" : isAtRisk ? "ring-orange-500/30" : "ring-primary/20"
                  )}>
                    <AvatarImage src={project.project_manager?.avatar_path || project.creator?.avatar_path || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {initials(project.project_manager?.name || project.creator?.name || project.name)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div>
                <Link href={`/dashboard/project-management/projects/${project.id}`} className="block">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-xl tracking-tight leading-tight transition-colors group-hover:text-primary line-clamp-1">
                      {project.name}
                    </h3>
                    {project.is_template && (
                      <Badge className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border-violet-500/20 shrink-0">
                        Template
                      </Badge>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className={cn(
                    "flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    isOverdue ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : 
                    isAtRisk ? "bg-orange-500/10 text-orange-500 border-orange-500/20" : 
                    "bg-primary/5 text-muted-foreground border-border/40"
                  )}>
                    <CalendarDays className="h-2.5 w-2.5" />
                    {isOverdue ? t('project_management.overdue', "Overdue") : isAtRisk ? t('project_management.due_soon', "Due Soon") : t('project_management.deadline', "Deadline")} {formatDate(project.end_date, t('project_management.no_date', 'No date'))}
                  </div>
                </div>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-90">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-2xl border-border/40 shadow-2xl backdrop-blur-xl">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/project-management/projects/${project.id}`} className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Eye className="h-4 w-4" /></div>
                    <span className="font-bold text-sm text-foreground/80">{t('project_management.view_strategy', "View Strategy")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/project-management/projects/${project.id}?view=board`} className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer">
                    <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500"><Layout className="h-4 w-4" /></div>
                    <span className="font-bold text-sm text-foreground/80">{t('project_management.task_matrix', "Task Matrix")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/40" />
                <DropdownMenuItem 
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500"><Edit className="h-4 w-4" /></div>
                  <span className="font-bold text-sm text-foreground/80">{t('project_management.configure', "Configure")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center"><Trash2 className="h-4 w-4" /></div>
                  <span className="font-bold text-sm">{t('project_management.terminate', "Terminate")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground/80 line-clamp-2 min-h-[2.5rem] leading-relaxed font-medium">
              {cleanText(project.description, t('project_management.no_description', "No description provided."))}
            </p>
            {project.tech_stack && project.tech_stack.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {project.tech_stack.slice(0, 3).map((tech, i) => (
                  <Badge key={i} variant="outline" className="text-[11px] font-bold px-1.5 py-0 border-primary/20 bg-primary/5 text-primary/70">
                    {tech}
                  </Badge>
                ))}
                {project.tech_stack.length > 3 && (
                  <span className="text-[11px] font-bold text-muted-foreground/50 ml-1">
                    +{project.tech_stack.length - 3} {t('project_management.more', 'more')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-muted/10 rounded-2xl p-3 border border-white/5 group-hover:bg-muted/20 transition-colors">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 block mb-1">{t('project_management.velocity', 'Velocity')}</span>
              <div className="flex items-end gap-1.5">
                <span className="text-lg font-black leading-none">{completedTasks}</span>
                <span className="text-[11px] text-muted-foreground/50 font-bold mb-0.5">/ {totalTasks} {t('project_management.units', 'units')}</span>
              </div>
            </div>
            <div className="bg-muted/10 rounded-2xl p-3 border border-white/5 group-hover:bg-muted/20 transition-colors flex flex-col justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 block mb-1">
                {project.repository_url ? t('project_management.engineering', "Engineering") : t('project_management.priority_level', "Priority")}
              </span>
              {project.repository_url ? (
                <div className="flex items-center gap-2 text-primary">
                  <Github className="h-4 w-4" />
                  <span className="text-[11px] font-black uppercase truncate max-w-[80px]">{t('project_management.active_repo', 'Active Repo')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", priorityColors[project.priority]?.split(" ")[0])} />
                  <span className={cn("text-xs font-black uppercase tracking-tight", priorityColors[project.priority]?.split(" ")[1])}>
                    {project.priority}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Members & Progress Footer */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2.5">
                {visibleMembers.map((member) => (
                  <Avatar key={member.id} className="h-8 w-8 border-2 border-card ring-1 ring-white/10 hover:scale-110 transition-transform cursor-pointer">
                    <AvatarImage src={member.user?.avatar_path || undefined} />
                    <AvatarFallback className="text-[11px] font-bold">{initials(member.user?.name)}</AvatarFallback>
                  </Avatar>
                ))}
                {extraMembers > 0 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted/80 backdrop-blur-md text-[11px] font-black text-muted-foreground/80 ring-1 ring-white/10">
                    +{extraMembers}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className={cn("text-xs font-black uppercase tracking-wider", status.color)}>
                  {status.label}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{t('project_management.completion', 'Completion')}</span>
                <span className={cn("text-sm font-black italic", status.color)}>{progress}%</span>
              </div>
              <div className="relative h-2 w-full bg-muted/20 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px] group-hover:brightness-125",
                    status.bg,
                    isOverdue ? "shadow-rose-500/50" : isAtRisk ? "shadow-orange-500/50" : "shadow-primary/50"
                  )} 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <CreateProjectModal 
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        project={project}
      />

      <DeleteProjectDialog 
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        projectName={project.name}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
};
