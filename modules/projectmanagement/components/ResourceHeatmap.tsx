"use client";

import React, { useMemo } from "react";
import { format, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, addDays } from "date-fns";
import { Project, Task, User } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/store/use-translation";

interface ResourceHeatmapProps {
  project: Project;
  tasks: Task[];
}

export function ResourceHeatmap({ project, tasks }: ResourceHeatmapProps) {
  const { t } = useTranslation();
  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const endDate = addDays(startDate, 13); // 2 weeks
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const members = project.members?.map(m => m.user).filter((u): u is User => !!u) || [];

  const memberWorkload = useMemo(() => {
    const workload = new Map<string, Record<string, number>>();
    
    members.forEach(member => {
      workload.set(member.id, {});
      days.forEach(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        // Count tasks due on or around this day for this member
        const activeTasks = tasks.filter(task => {
          const isAssigned = task.assignees?.some(a => a.id === member.id);
          if (!isAssigned || !task.due_date) return false;
          
          const dueDate = new Date(task.due_date);
          // Simple heuristic: task takes 3 days before due date
          const taskStart = addDays(dueDate, -3);
          return day >= taskStart && day <= dueDate;
        });
        
        workload.get(member.id)![dateKey] = activeTasks.length;
      });
    });
    
    return workload;
  }, [members, days, tasks]);

  const getIntensityClass = (count: number) => {
    if (count === 0) return "bg-muted/30";
    if (count === 1) return "bg-emerald-200 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300";
    if (count === 2) return "bg-amber-200 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
    return "bg-rose-200 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300";
  };

  return (
    <div id="tour-pm-resource-table" className="bg-card border rounded-2xl p-6 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold">{t('project_management.resource_workload_heatmap', 'Resource Workload Heatmap')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('project_management.allocation_across_days', 'Allocation across the next 14 days')}</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted/30" /> <span>{t('project_management.free', 'Free')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-200" /> <span>{t('project_management.optimal', 'Optimal')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-200" /> <span>{t('project_management.busy', 'Busy')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-rose-200" /> <span>{t('project_management.overloaded', 'Overloaded')}</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground border-b min-w-[200px]">{t('project_management.team_member', 'Team Member')}</th>
              {days.map(day => (
                <th key={day.toISOString()} className="p-3 text-center border-b min-w-[40px]">
                  <p className="text-[11px] font-black text-muted-foreground uppercase">{t(`project_management.${format(day, "EEE").toLowerCase()}`, format(day, "EEE"))}</p>
                  <p className={cn(
                    "text-xs font-bold mt-1",
                    isSameDay(day, new Date()) && "text-primary"
                  )}>
                    {format(day, "d")}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id} className="group hover:bg-muted/5 transition-colors">
                <td className="p-3 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 ring-2 ring-background">
                      <AvatarImage src={member.avatar_path || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold truncate max-w-[120px]">{member.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[120px] font-medium">{t('project_management.developer', 'Developer')}</p>
                    </div>
                  </div>
                </td>
                {days.map(day => {
                  const count = memberWorkload.get(member.id)?.[format(day, "yyyy-MM-dd")] || 0;
                  return (
                    <td key={day.toISOString()} className="p-1 border-b">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={cn(
                              "h-10 rounded-lg flex items-center justify-center text-[11px] font-black transition-all duration-300 hover:scale-110 cursor-help shadow-sm",
                              getIntensityClass(count)
                            )}>
                              {count > 0 && count}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover text-popover-foreground border-border">
                            <p className="font-bold text-xs">{count} {t('project_management.active_tasks', 'active tasks')}</p>
                            <p className="text-[11px] text-muted-foreground">{format(day, "PPP")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
