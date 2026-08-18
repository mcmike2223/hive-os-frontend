"use client";

import React, { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  MoreVertical, 
  Plus, 
  Play, 
  CheckCircle2, 
  Calendar,
  AlertCircle,
  GripVertical
} from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/store/use-translation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

import { projectApi } from "../api";
import { SprintAnalytics } from "./SprintAnalytics";
import type { Project, Task, Sprint } from "../types";

interface BacklogViewProps {
  project: Project;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function BacklogView({ project, tasks, onTaskClick }: BacklogViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [expandedSprints, setExpandedSprints] = useState<Record<string, boolean>>({ backlog: true });

  const toggleExpand = (id: string) => {
    setExpandedSprints(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const createSprintMutation = useMutation({
    mutationFn: () => projectApi.createSprint(project.id, { 
      name: `Sprint ${project.sprints?.length ? project.sprints.length + 1 : 1}`,
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Sprint created");
    },
  });
  
  const startSprintMutation = useMutation({
    mutationFn: (sprintId: string) => projectApi.startSprint(sprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Sprint started");
    },
  });

  const completeSprintMutation = useMutation({
    mutationFn: (sprintId: string) => projectApi.completeSprint(sprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Sprint completed");
    },
  });

  const deleteSprintMutation = useMutation({
    mutationFn: (sprintId: string) => projectApi.deleteSprint(sprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Sprint deleted");
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, sprintId, isBacklog }: { taskId: string, sprintId: string | null, isBacklog: boolean }) => 
      projectApi.updateTask(taskId, { sprint_id: sprintId, is_backlog: isBacklog }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Task moved");
    },
  });

  const backlogTasks = tasks.filter(t => t.is_backlog && !t.sprint_id);
  const sprints = project.sprints || [];

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 custom-scrollbar pb-10 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-primary/[0.03] p-6 rounded-[2rem] border border-primary/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight">{t("project_management.backlog_and_sprints", "Backlog & Sprints")}</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary text-[11px] uppercase tracking-widest px-2">Software Dev</Badge>
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-1">{t("project_management.manage_backlog_desc", "Manage your product backlog and plan upcoming iterative sprints.")}</p>
        </div>
        <Button onClick={() => createSprintMutation.mutate()} className="gap-2 h-10 px-6 rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" />
          Create Sprint
        </Button>
      </div>

      <SprintAnalytics project={project} tasks={tasks} />

      <div className="space-y-6">
        {/* Sprints */}
        {sprints.map(sprint => (
          <SprintSection 
            key={sprint.id} 
            sprint={sprint} 
            expanded={expandedSprints[sprint.id] ?? true}
            onToggle={() => toggleExpand(sprint.id)}
            onTaskClick={onTaskClick}
            onStart={() => startSprintMutation.mutate(sprint.id)}
            onComplete={() => completeSprintMutation.mutate(sprint.id)}
            onDelete={() => deleteSprintMutation.mutate(sprint.id)}
            sprints={sprints}
            onMoveTask={(taskId, sprintId, isBacklog) => moveTaskMutation.mutate({ taskId, sprintId, isBacklog })}
          />
        ))}

        {/* Backlog Section */}
        <div className="rounded-[2rem] border-border/40 bg-card shadow-xl shadow-black/5 overflow-hidden transition-all duration-300">
          <div 
            className="flex items-center justify-between p-5 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/40"
            onClick={() => toggleExpand('backlog')}
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-background border shadow-sm">
                {expandedSprints['backlog'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
              <h3 className="font-black uppercase tracking-widest text-sm">{t("project_management.product_backlog", "Product Backlog")}</h3>
              <Badge variant="outline" className="ml-2 bg-background font-black text-[11px] rounded-lg">
                {backlogTasks.length} {t("project_management.items", "ITEMS")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 gap-2 font-bold text-[11px] uppercase tracking-widest hover:bg-background shadow-sm border border-transparent hover:border-border/40">
                <Plus className="h-3.5 w-3.5" />
                Quick Add
              </Button>
            </div>
          </div>

          {expandedSprints['backlog'] && (
            <div className="p-3 space-y-1 bg-card/50">
              {backlogTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground italic font-medium flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-2">
                    <AlertCircle className="w-6 h-6 opacity-20" />
                  </div>
                  Your backlog is empty. Add tasks to start planning.
                </div>
              ) : (
                backlogTasks.map(task => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    onClick={() => onTaskClick(task)} 
                    sprints={sprints}
                    onMove={(sId, isB) => moveTaskMutation.mutate({ taskId: task.id, sprintId: sId, isBacklog: isB })}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SprintSection({ sprint, expanded, onToggle, onTaskClick, onStart, onComplete, onDelete, sprints, onMoveTask }: { 
  sprint: Sprint; 
  expanded: boolean; 
  onToggle: () => void;
  onTaskClick: (task: Task) => void;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
  sprints: Sprint[];
  onMoveTask: (taskId: string, sprintId: string | null, isBacklog: boolean) => void;
}) {
  const sprintTasks = sprint.tasks || [];
  const completedCount = sprintTasks.filter(t => t.column?.is_done).length;
  const progress = sprintTasks.length > 0 ? (completedCount / sprintTasks.length) * 100 : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div 
        className="flex items-center justify-between p-4 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4 flex-1">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-bold">{sprint.name}</h3>
              <Badge className={cn(
                "text-[11px] h-5",
                sprint.status === 'active' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                sprint.status === 'completed' ? "bg-violet-500/10 text-violet-600 border-violet-500/20" :
                "bg-slate-500/10 text-slate-600 border-slate-500/20"
              )}>
                {sprint.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {format(new Date(sprint.start_date), "MMM d")} - {format(new Date(sprint.end_date), "MMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 mr-4">
          <div className="hidden md:flex flex-col gap-1 w-32">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span>{Math.round(progress)}%</span>
              <span className="text-muted-foreground">{completedCount}/{sprintTasks.length}</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
          <div className="flex items-center gap-2">
            {sprint.status === 'upcoming' && (
              <Button 
                size="sm" 
                className="h-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={(e) => { e.stopPropagation(); onStart(); }}
              >
                <Play className="h-3.5 w-3.5" />
                Start Sprint
              </Button>
            )}
            {sprint.status === 'active' && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit Sprint</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>Delete Sprint</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-2 space-y-1 bg-background/50">
          {sprintTasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground italic bg-muted/5 rounded-lg border border-dashed">
              Drag tasks here to include them in this sprint.
            </div>
          ) : (
            sprintTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onClick={() => onTaskClick(task)} 
                sprints={sprints}
                onMove={(sId, isB) => onMoveTask(task.id, sId, isB)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TaskItem({ task, onClick, sprints, onMove }: { 
  task: Task, 
  onClick: () => void,
  sprints: Sprint[],
  onMove: (sprintId: string | null, isBacklog: boolean) => void
}) {
  const { t } = useTranslation();
  const priorityColors: Record<string, string> = {
    low: "text-emerald-500 bg-emerald-500/10",
    medium: "text-sky-500 bg-sky-500/10",
    high: "text-amber-500 bg-amber-500/10",
    urgent: "text-rose-500 bg-rose-500/10",
  };

  return (
    <div 
      className="group flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-border hover:bg-card hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="cursor-grab active:cursor-grabbing text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4" />
      </div>
      
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Badge variant="outline" className={cn("text-[11px] font-black uppercase px-1.5 h-4 border-none", priorityColors[task.priority || 'medium'])}>
          {task.priority?.charAt(0)}
        </Badge>
        <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{task.title}</span>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          {task.story_points && (
            <Badge variant="secondary" className="rounded-full h-5 px-2 text-[11px] font-bold">
              {task.story_points}
            </Badge>
          )}
          {task.due_date && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), "MMM d")}
            </div>
          )}
        </div>

        <div className="flex -space-x-2">
          {(task.assignees || []).slice(0, 3).map((user) => (
            <Avatar key={user.id} className="h-6 w-6 border-2 border-background ring-offset-background">
              <AvatarImage src={user.avatar_path || undefined} />
              <AvatarFallback className="text-[11px]">{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        
        <Badge className={cn(
          "text-[11px] h-5 capitalize border-none",
          task.column?.is_done ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
        )}>
          {task.column?.name ? t(`project_management.column_${task.column.name.toLowerCase().replace(/\s+/g, '_')}`, task.column.name) : t('project_management.backlog', 'Backlog')}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!task.sprint_id && (
              <>
                {sprints.map(s => (
                  <DropdownMenuItem key={s.id} onClick={() => onMove(s.id, false)}>
                    Move to {s.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {task.sprint_id && (
              <>
                <DropdownMenuItem onClick={() => onMove(null, true)}>
                  Move to Backlog
                </DropdownMenuItem>
                {sprints.filter(s => s.id !== task.sprint_id).map(s => (
                  <DropdownMenuItem key={s.id} onClick={() => onMove(s.id, false)}>
                    Move to {s.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
