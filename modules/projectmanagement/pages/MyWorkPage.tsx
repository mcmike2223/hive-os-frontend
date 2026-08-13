"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { projectApi } from "../api";
import { 
  CheckCircle2, 
  Clock, 
  Filter, 
  Layout, 
  Search, 
  Trophy, 
  AlertCircle,
  Calendar,
  ExternalLink,
  HelpCircle,
  ChevronRight,
  MoreVertical,
  Layers
} from "lucide-react";
import { GlobalResourceHeatmap } from "../components/GlobalResourceHeatmap";
import { GitStatusBadge } from "../components/GitStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskDetailSheet } from "../components/TaskDetailSheet";
import { useProjectManagementRealtime } from "../hooks/use-project-management-realtime";
import { format } from "date-fns";
import type { Task, TaskPriority } from "../types";
import { cn } from "@/lib/utils";
import { useTour } from "@/components/providers/tour-provider";
import { useTranslation } from "@/store/use-translation";

export default function MyWorkPage() {
  const { t } = useTranslation();
  const { startTour } = useTour();
  
  const myWorkTourSteps = [
    { target: '#tour-pm-my-work-header', title: t('tour.mywork_header_title', 'Your Command Center'), content: t('tour.mywork_header_desc', 'See everything assigned directly to you.'), placement: 'bottom' as const },
    { target: '#tour-pm-my-work-stats', title: t('tour.mywork_stats_title', 'Personal Metrics'), content: t('tour.mywork_stats_desc', 'Track your throughput and urgent items.'), placement: 'bottom' as const },
    { target: '#tour-pm-my-work-list', title: t('tour.mywork_list_title', 'Task Inbox'), content: t('tour.mywork_list_desc', 'Click any task to slide out the detail panel.'), placement: 'top' as const },
  ];
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"active" | "completed">("active");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  
  useProjectManagementRealtime();

  const { data, isLoading } = useQuery({
    queryKey: ["my-tasks", { status: statusFilter }],
    queryFn: () => projectApi.getMyTasks({ status: statusFilter }),
  });

  const tasks = data?.data || [];

  const stats = React.useMemo(() => {
    const totalPoints = tasks.reduce((sum, task) => sum + (task.story_points || 0), 0);
    const highPriority = tasks.filter(t => t.priority === "high" || t.priority === "urgent").length;
    const dueSoon = tasks.filter(t => {
      if (!t.due_date) return false;
      const diff = new Date(t.due_date).getTime() - new Date().getTime();
      return diff > 0 && diff < 48 * 60 * 60 * 1000;
    }).length;

    return { totalPoints, highPriority, dueSoon, count: tasks.length };
  }, [tasks]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header Section */}
      <div id="tour-pm-my-work-header" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            {t('project_management.my_work', 'My Work')}
          </h1>
          <p className="text-muted-foreground text-lg font-light">
            {t('project_management.my_work_desc', 'Stay focused on your active responsibilities across all projects.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => startTour(myWorkTourSteps)} className="h-10 px-4 bg-background/50 backdrop-blur-md rounded-full border-border/50 hover:bg-muted/50 transition-colors">
            <HelpCircle className="h-4 w-4 mr-2" />
            {t('topbar.system_tour', 'System Tour')}
          </Button>
          <div className="flex -space-x-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-10 rounded-full border-2 border-background bg-muted animate-pulse" />
            ))}
          </div>
          <div className="text-sm font-medium text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-border/50">
            {stats.count} {t('project_management.tasks_assigned', 'Tasks Assigned')}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div id="tour-pm-my-work-stats" className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <WorkStat 
          label={t('project_management.total_effort', 'Total Effort')} 
          value={stats.totalPoints} 
          subtext={t('project_management.story_points', 'Story Points')}
          icon={Trophy} 
          color="primary" 
        />
        <WorkStat 
          label={t('project_management.priority_alert', 'Priority Alert')} 
          value={stats.highPriority} 
          subtext={t('project_management.high_urgent', 'High/Urgent')}
          icon={AlertCircle} 
          color="rose" 
        />
        <WorkStat 
          label={t('project_management.approaching', 'Approaching')} 
          value={stats.dueSoon} 
          subtext={t('project_management.next_48_hours', 'Next 48 hours')}
          icon={Clock} 
          color="amber" 
        />
        <WorkStat 
          label={t('project_management.active_load', 'Active Load')} 
          value={stats.count} 
          subtext={t('project_management.across_projects', 'Across projects')}
          icon={Layout} 
          color="emerald" 
        />
      </div>

      <GlobalResourceHeatmap />

      {/* Main Content Area */}
      <div id="tour-pm-my-work-list" className="flex flex-col gap-6 bg-card/30 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-12 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
        
        {/* Filters Row */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between relative z-10">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input 
              placeholder={t('project_management.search_in_my_work', 'Search in my work...')} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-11 bg-background/50 border-white/10 rounded-xl focus-visible:ring-primary/30"
            />
          </div>
          
          <div className="flex items-center gap-2 p-1 bg-background/40 rounded-xl border border-white/5">
            <Button
              variant={statusFilter === "active" ? "secondary" : "ghost"}
              onClick={() => setStatusFilter("active")}
              className="h-9 rounded-lg px-4 transition-all"
            >
              {t('project_management.active_status', 'Active')}
            </Button>
            <Button
              variant={statusFilter === "completed" ? "secondary" : "ghost"}
              onClick={() => setStatusFilter("completed")}
              className="h-9 rounded-lg px-4 transition-all"
            >
              {t('project_management.completed_status', 'Completed')}
            </Button>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-3 relative z-10">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 w-full bg-white/5 animate-pulse rounded-2xl" />
            ))
          ) : tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskRow 
                key={task.id} 
                task={task} 
                onClick={() => setSelectedTaskId(task.id)} 
                t={t}
              />
            ))
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="inline-flex p-6 bg-primary/5 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-primary/30" />
              </div>
              <div>
                <p className="text-xl font-semibold">{t('project_management.all_caught_up', "You're all caught up!")}</p>
                <p className="text-muted-foreground">{t('project_management.no_tasks_found', 'No tasks matching your filters.')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <TaskDetailSheet 
        taskId={selectedTaskId} 
        columns={[]}
        onOpenChange={(open) => !open && setSelectedTaskId(null)} 
      />
    </div>
  );
}

function WorkStat({ 
  label, 
  value, 
  subtext,
  icon: Icon, 
  color 
}: { 
  label: string; 
  value: number | string; 
  subtext: string;
  icon: any; 
  color: "primary" | "rose" | "amber" | "emerald" 
}) {
  const colors = {
    primary: "text-primary bg-primary/10 border-primary/20",
    rose: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  };

  return (
    <div className={cn("p-5 rounded-2xl border bg-card/50 backdrop-blur-sm group transition-all hover:scale-[1.02]", colors[color])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter">{value}</span>
          </div>
          <p className="text-xs mt-1 opacity-70">{subtext}</p>
        </div>
        <div className="p-3 rounded-xl bg-background/40 border border-white/5">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, onClick, t }: { task: Task; onClick: () => void; t: any }) {
  const priorityColor = {
    urgent: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    medium: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    low: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  };

  return (
    <div 
      onClick={onClick}
      className="group flex flex-col md:flex-row items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer active:scale-[0.99]"
    >
      <div className="flex items-center gap-4 w-full md:w-auto md:flex-1">
        <div className={cn(
          "h-10 w-1 rounded-full",
          task.priority === "urgent" ? "bg-rose-500" : 
          task.priority === "high" ? "bg-orange-500" : "bg-primary/30"
        )} />
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg leading-tight truncate group-hover:text-primary transition-colors">
              {task.title}
            </h3>
            {task.issue_type && (
              <Badge variant="outline" className="text-[11px] uppercase font-black px-1.5 py-0 bg-background/50">
                {task.issue_type}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 font-medium text-primary/70">
              <Layout className="h-3.5 w-3.5" />
              {task.project?.name}
            </span>
            <span className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              {task.column?.name}
            </span>
          </div>
        </div>
      </div>

      {task.pr_url && (
        <div className="flex items-center gap-4 px-4 py-2 bg-background/20 rounded-xl border border-white/5 mx-4">
          <GitStatusBadge 
            prUrl={task.pr_url} 
            prStatus={task.pr_status} 
            buildStatus={task.build_status} 
          />
        </div>
      )}

      <div className="flex items-center justify-between w-full md:w-auto md:gap-8 shrink-0">
        <div className="flex items-center gap-6">
          {task.due_date && (
            <div className="flex flex-col items-center md:items-end">
              <span className="text-[11px] uppercase font-bold opacity-40">{t('project_management.due_date', 'Due Date')}</span>
              <span className={cn(
                "text-sm font-medium flex items-center gap-1.5",
                new Date(task.due_date) < new Date() ? "text-rose-500" : "text-muted-foreground"
              )}>
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(task.due_date), "MMM d, yyyy")}
              </span>
            </div>
          )}

          <div className="flex flex-col items-center md:items-end">
            <span className="text-[11px] uppercase font-bold opacity-40">{t('project_management.priority', 'Priority')}</span>
            <Badge className={cn("mt-1 font-bold", priorityColor[task.priority])}>
              {task.priority}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {task.story_points && (
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-xs">
              {task.story_points}
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
