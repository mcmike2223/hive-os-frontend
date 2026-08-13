"use client";

import React, { useMemo } from "react";
import { format, eachDayOfInterval, startOfWeek, isSameDay, addDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { projectApi } from "../api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function GlobalResourceHeatmap() {
  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const endDate = addDays(startDate, 13); // 2 weeks
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const { data: users, isLoading } = useQuery({
    queryKey: ["global-workload"],
    queryFn: () => projectApi.getGlobalWorkload(),
  });

  const memberWorkload = useMemo(() => {
    if (!users) return new Map();
    const workload = new Map<string, Record<string, { count: number, tasks: any[] }>>();
    
    users.forEach(user => {
      workload.set(user.id, {});
      days.forEach(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        
        const activeTasks = (user.tasks || []).filter((task: any) => {
          if (!task.due_date) return false;
          const dueDate = new Date(task.due_date);
          const taskStart = addDays(dueDate, -3);
          return day >= taskStart && day <= dueDate;
        });
        
        workload.get(user.id)![dateKey] = {
          count: activeTasks.length,
          tasks: activeTasks
        };
      });
    });
    
    return workload;
  }, [users, days]);

  const getIntensityClass = (count: number) => {
    if (count === 0) return "bg-muted/30";
    if (count === 1) return "bg-emerald-200 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300";
    if (count === 2) return "bg-amber-200 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
    return "bg-rose-200 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300";
  };

  if (isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  return (
    <div className="bg-card/30 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 p-12 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6 relative z-10">
        <div>
          <h3 className="text-2xl font-black tracking-tight">Global Resource Heatmap</h3>
          <p className="text-muted-foreground font-medium mt-1">Cross-project workload distribution for the next 14 days.</p>
        </div>
        <div className="flex items-center gap-6 text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 bg-background/40 p-3 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted/30 shadow-inner" /> <span>Free</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]" /> <span>Optimal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]" /> <span>Busy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(248,113,113,0.3)]" /> <span>Overloaded</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar relative z-10">
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr>
              <th className="p-4 text-left text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 min-w-[240px]">Resource</th>
              {days.map(day => (
                <th key={day.toISOString()} className="p-2 text-center min-w-[48px]">
                  <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-tighter">{format(day, "EEE")}</p>
                  <p className={cn(
                    "text-sm font-black mt-1",
                    isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground/70"
                  )}>
                    {format(day, "d")}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users?.map(user => (
              <tr key={user.id} className="group transition-all">
                <td className="p-4 bg-background/40 rounded-l-2xl border-l border-y border-white/5 group-hover:bg-background/60">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 ring-2 ring-white/10 shadow-lg">
                      <AvatarImage src={user.avatar_path || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                        {user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-black truncate group-hover:text-primary transition-colors">{user.name}</p>
                      <Badge variant="outline" className="text-[11px] uppercase font-black px-1.5 py-0 bg-white/5 border-white/10 opacity-60">
                        Developer
                      </Badge>
                    </div>
                  </div>
                </td>
                {days.map((day, idx) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const data = memberWorkload.get(user.id)?.[dateKey] || { count: 0, tasks: [] };
                  return (
                    <td 
                      key={day.toISOString()} 
                      className={cn(
                        "p-1 border-y border-white/5 group-hover:bg-background/20 transition-all",
                        idx === days.length - 1 && "rounded-r-2xl border-r"
                      )}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={cn(
                              "h-12 rounded-xl flex items-center justify-center text-[11px] font-black transition-all duration-500 hover:scale-110 cursor-help shadow-lg",
                              getIntensityClass(data.count)
                            )}>
                              {data.count > 0 && data.count}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="p-3 bg-popover text-popover-foreground border-border shadow-2xl rounded-xl">
                            <div className="space-y-2">
                              <p className="font-black text-xs border-b border-border/10 pb-1">{data.count} Tasks • {format(day, "PPP")}</p>
                              {data.tasks.map((t: any) => (
                                <div key={t.id} className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                                  <div className="h-1 w-1 rounded-full bg-primary" />
                                  <span className="truncate max-w-[150px]">{t.title}</span>
                                  <span className="text-[11px] opacity-50 ml-auto">({t.project?.name})</span>
                                </div>
                              ))}
                              {data.count === 0 && <p className="text-[11px] text-muted-foreground italic">No tasks assigned</p>}
                            </div>
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
