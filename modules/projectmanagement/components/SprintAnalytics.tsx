"use client";

import React, { useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from "recharts";
import { Project, Sprint, Task } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Activity, Target } from "lucide-react";
import { format, eachDayOfInterval, isAfter, isBefore, startOfDay, addDays } from "date-fns";

interface SprintAnalyticsProps {
  project: Project;
  tasks: Task[];
}

export function SprintAnalytics({ project, tasks }: SprintAnalyticsProps) {
  const sprints = project.sprints || [];
  
  // Velocity Data: Story points completed per sprint
  const velocityData = useMemo(() => {
    return sprints
      .filter(s => s.status === 'completed' || s.status === 'active')
      .map(sprint => {
        const sprintTasks = sprint.tasks || [];
        const totalPoints = sprintTasks.reduce((sum, t) => sum + (Number(t.story_points) || 0), 0);
        const completedPoints = sprintTasks
          .filter(t => t.column?.is_done)
          .reduce((sum, t) => sum + (Number(t.story_points) || 0), 0);
        
        return {
          name: sprint.name,
          completed: completedPoints,
          planned: totalPoints
        };
      });
  }, [sprints]);

  // Burndown Data for the active sprint
  const activeSprint = sprints.find(s => s.status === 'active');
  const burndownData = useMemo(() => {
    if (!activeSprint) return [];
    
    const start = new Date(activeSprint.start_date);
    const end = new Date(activeSprint.end_date);
    const days = eachDayOfInterval({ start, end });
    
    const sprintTasks = activeSprint.tasks || [];
    const totalPoints = sprintTasks.reduce((sum, t) => sum + (Number(t.story_points) || 0), 0);
    
    let remainingPoints = totalPoints;
    const data = days.map((day, index) => {
      // Find tasks completed on or before this day
      const completedOnDay = sprintTasks.filter(t => {
        if (!t.column?.is_done || !t.updated_at) return false;
        const completionDate = new Date(t.updated_at);
        return startOfDay(completionDate).getTime() === startOfDay(day).getTime();
      }).reduce((sum, t) => sum + (Number(t.story_points) || 0), 0);
      
      remainingPoints -= completedOnDay;
      
      // Ideal line
      const idealRemaining = totalPoints - (totalPoints / (days.length - 1)) * index;

      return {
        day: format(day, "MMM d"),
        remaining: Math.max(0, remainingPoints),
        ideal: Math.max(0, idealRemaining)
      };
    });
    
    return data;
  }, [activeSprint]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Velocity Chart */}
      <Card className="bg-card border-border/40 shadow-xl shadow-black/5 rounded-[2rem] overflow-hidden group">
        <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20 border-b border-border/40">
          <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Team Velocity</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary opacity-50" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocityData}>
                <defs>
                  <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--foreground))', opacity: 0.8 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--foreground))', opacity: 0.8 }} 
                />
                <RechartsTooltip 
                  cursor={{ fill: 'hsl(var(--primary)/0.05)' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar dataKey="completed" fill="url(#velocityGradient)" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="planned" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} barSize={32} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[11px] font-black uppercase text-muted-foreground/60">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted" />
                <span className="text-[11px] font-black uppercase text-muted-foreground/60">Planned</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Burndown Chart */}
      <Card className="bg-card border-border/40 shadow-xl shadow-black/5 rounded-[2rem] overflow-hidden group">
        <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20 border-b border-border/40">
          <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Sprint Burndown {activeSprint && `(${activeSprint.name})`}
          </CardTitle>
          <Activity className="h-4 w-4 text-emerald-500 opacity-50" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[220px] w-full">
            {activeSprint ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={burndownData}>
                  <defs>
                    <linearGradient id="burndownGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--foreground))', opacity: 0.8 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--foreground))', opacity: 0.8 }} 
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="remaining" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    fill="url(#burndownGradient)" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ideal" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="5 5" 
                    strokeWidth={1}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border/40 rounded-2xl bg-muted/5">
                <Target className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">No Active Sprint</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1">Start a sprint to see burndown analytics here.</p>
              </div>
            )}
          </div>
          {activeSprint && (
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-1 rounded-full bg-primary" />
                <span className="text-[11px] font-black uppercase text-muted-foreground/60">Remaining Points</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-[1px] border-b border-dashed border-muted-foreground" />
                <span className="text-[11px] font-black uppercase text-muted-foreground/60">Ideal Burndown</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
