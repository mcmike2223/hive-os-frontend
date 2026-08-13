"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Project, TaskIssueType, TaskPriority } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ProjectTrendChart } from "./ProjectTrendChart";
import { useUser } from "@/hooks/use-user";
import { Cpu } from "lucide-react";

interface DashboardChartsProps {
  projects: Project[];
  issueTypeDistribution?: Array<{
    type: TaskIssueType | string;
    name: string;
    value: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  planning: "hsl(var(--warning))",
  active: "hsl(var(--success))",
  on_hold: "hsl(var(--destructive))",
  completed: "hsl(var(--primary))",
  archived: "hsl(var(--muted))",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "hsl(var(--destructive))",
  high: "hsl(var(--warning))",
  medium: "hsl(var(--primary))",
  low: "hsl(var(--success))",
};

const ISSUE_TYPE_COLORS: Record<string, string> = {
  task: "hsl(var(--primary))",
  bug: "hsl(var(--destructive))",
  feature: "hsl(var(--success))",
  improvement: "hsl(var(--accent-foreground))",
  epic: "hsl(var(--chart-4))",
  refactor: "hsl(var(--warning))",
  debt: "hsl(var(--muted-foreground))",
};

type TooltipPayload = {
  name?: string;
  value?: number | string;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
};

export function DashboardCharts({ projects, issueTypeDistribution = [] }: DashboardChartsProps) {
  // Data for Project Progress Bar Chart
  const progressData = projects
    .slice(0, 6)
    .map((p) => ({
      name: p.name,
      progress: p.progress || 0,
      fullMark: 100,
    }))
    .sort((a, b) => b.progress - a.progress);

  // Data for Status Distribution Donut Chart
  const statusCounts = projects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.replace("_", " ").toUpperCase(),
    value: count,
    status,
  }));

  // Data for Priority Distribution
  const priorityCounts = projects.reduce((acc, p) => {
    acc[p.priority] = (acc[p.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const priorityData = Object.entries(priorityCounts).map(([priority, count]) => ({
    name: priority.toUpperCase(),
    value: count,
    priority: priority as TaskPriority,
  }));

  // Data for Resource Allocation (Manager Workload)
  const managerCounts = projects.reduce((acc, p) => {
    const managerName = p.project_manager?.name || "Unassigned";
    acc[managerName] = (acc[managerName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const resourceData = Object.entries(managerCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Data for Timeline Health (Risk Assessment)
  const timelineHealth = projects.reduce((acc, p) => {
    if (p.status === 'completed') {
      acc.onTrack++;
      return acc;
    }

    const dueDate = p.end_date ? new Date(p.end_date) : null;
    const now = new Date();
    
    if (dueDate && dueDate < now) {
      acc.overdue++;
    } else if (dueDate) {
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 3 && (p.progress || 0) < 80) {
        acc.atRisk++;
      } else {
        acc.onTrack++;
      }
    } else {
      acc.onTrack++;
    }
    return acc;
  }, { onTrack: 0, atRisk: 0, overdue: 0 });

  const timelineData = [
    { name: "ON TRACK", value: timelineHealth.onTrack, color: "hsl(var(--success))" },
    { name: "AT RISK", value: timelineHealth.atRisk, color: "hsl(var(--warning))" },
    { name: "OVERDUE", value: timelineHealth.overdue, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0);

  const { user } = useUser();
  const isSoftwareDev = user?.business_type?.toLowerCase()?.replace('-', ' ') === 'software development';

  const issueTypeData = issueTypeDistribution
    .filter((item) => item.value > 0)
    .map((item) => ({
      ...item,
      name: item.name || String(item.type).replace("_", " ").toUpperCase(),
      color: ISSUE_TYPE_COLORS[String(item.type)] || "hsl(var(--primary))",
    }));

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/80 backdrop-blur-md border border-border p-3 rounded-xl shadow-xl">
          <p className="text-sm font-bold">{label || payload[0].name}</p>
          <p className="text-xs text-primary font-mono">
            {payload[0].name === "progress" ? `Progress: ${payload[0].value}%` : `Count: ${payload[0].value}`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Primary Analytics Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ProjectTrendChart projects={projects} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="xl:col-span-2"
        >
          <Card className="bg-card/30 backdrop-blur-md border-muted-foreground/10 h-full rounded-[2rem]">
            <CardHeader className="pt-8 px-8">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Manager Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full pb-8 px-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resourceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.05} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: "hsl(var(--foreground))", opacity: 0.8 }} 
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--foreground))", opacity: 0.8 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--primary)/0.05)" }} />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Secondary Distribution Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card/30 backdrop-blur-md border-muted-foreground/10 h-[400px] rounded-[2rem]">
            <CardHeader className="pt-8 px-8">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Timeline Health
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={timelineData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {timelineData.map((entry, index) => (
                      <Cell
                        key={`timeline-cell-${index}`}
                        fill={entry.color}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    layout="horizontal"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-card/30 backdrop-blur-md border-muted-foreground/10 h-[400px] rounded-[2rem]">
            <CardHeader className="pt-8 px-8">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Project Completion (%)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full pb-8 px-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--foreground))", opacity: 0.8 }}
                    width={80}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--primary)/0.05)" }} />
                  <Bar
                    dataKey="progress"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-card/30 backdrop-blur-md border-muted-foreground/10 h-[400px] rounded-[2rem]">
            <CardHeader className="pt-8 px-8">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Status Mix
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {statusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.status] || "hsl(var(--primary))"}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    layout="horizontal"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-card/30 backdrop-blur-md border-muted-foreground/10 h-[400px] rounded-[2rem]">
            <CardHeader className="pt-8 px-8">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Priority Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell
                        key={`priority-cell-${index}`}
                        fill={PRIORITY_COLORS[entry.priority] || "hsl(var(--primary))"}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    layout="horizontal"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {isSoftwareDev && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="xl:col-span-2 lg:col-span-1"
          >
            <Card className="bg-primary/[0.02] backdrop-blur-md border-primary/10 h-[400px] rounded-[2rem] overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Cpu className="w-24 h-24 text-primary" />
              </div>
              <CardHeader className="pt-8 px-8">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-primary/70">
                  Engineering Issue Mix
                </CardTitle>
                <p className="text-[11px] font-bold text-muted-foreground/50 tracking-wider">LIVE TASK ISSUE COUNTS</p>
              </CardHeader>
              <CardContent className="h-[300px] w-full px-8">
                {issueTypeData.length > 0 ? (
                  <div className="flex h-full flex-col md:flex-row items-center justify-between gap-4">
                    <div className="w-full h-full md:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={issueTypeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            animationDuration={1500}
                            stroke="none"
                          >
                            {issueTypeData.map((entry, index) => (
                              <Cell
                                key={`issue-type-cell-${index}`}
                                fill={entry.color}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 grid grid-cols-2 gap-3 pb-8">
                      {issueTypeData.map((item) => (
                        <div key={item.name} className="flex flex-col gap-1 p-3 rounded-2xl bg-background/40 border border-border/50">
                          <span className="text-[11px] font-black tracking-widest text-muted-foreground/60">{item.name}</span>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-black tracking-tighter" style={{ color: item.color }}>{item.value}</span>
                            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Cpu className="mb-4 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-bold text-muted-foreground">No task issue data recorded yet.</p>
                    <p className="mt-2 max-w-xs text-xs text-muted-foreground/70">
                      Create tasks with issue types and this chart will use the saved database counts.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
