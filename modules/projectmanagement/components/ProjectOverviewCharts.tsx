import React, { useMemo } from "react";
import { useTranslation } from "@/store/use-translation";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ComposedChart,
  Line,
  Area,
  AreaChart,
  LineChart,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { Project, Task, TaskPriority } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  Zap, 
  Target, 
  Users, 
  AlertCircle, 
  TrendingUp, 
  Activity,
  ShieldCheck,
  Clock,
  GitBranch,
  Cpu,
  CheckCircle2,
  Timer,
  Coins,
  Dna,
  MessageSquare
} from "lucide-react";

interface ProjectOverviewChartsProps {
  project: Project;
  tasks: Task[];
}

interface HealthMetric {
  subject: string;
  A: number;
  fullMark: number;
}

interface RiskMetric {
  name: string;
  value: number;
  color: string;
}

interface QualityMetric {
  date: string;
  created: number;
  resolved: number;
}

interface FinancialTrajectoryMetric {
  date: string;
  cost: number;
  budget: number;
  revenue: number;
}

interface EfficiencyMetric {
  name: string;
  leadTime: number;
  cycleTime: number;
}

interface ROIMetric {
  name: string;
  points: number;
  hours: number;
  roi: number;
}

interface VelocityTrendMetric {
  week: string;
  [key: string]: string | number; 
}

interface ComplexityEfficiencyMetric {
  complexity: number;
  efficiency: number;
  name: string;
  type: string;
}

interface BottleneckMetric {
  status: string;
  avgDays: number;
  count: number;
}

interface TagMetric {
  tag: string;
  points: number;
  count: number;
}

interface ProjectVelocityMetric {
  date: string;
  points: number;
  completed: number;
}

interface MemberRadarMetric {
  subject: string;
  [key: string]: string | number;
}

interface ScopeTrendMetric {
  date: string;
  totalPoints: number;
  totalTasks: number;
}

interface ChecklistVelocityMetric {
  name: string;
  total: number;
  completed: number;
  rate: number;
}

interface EnvironmentStabilityMetric {
  env: string;
  bugs: number;
  stability: number;
}

interface RoleContributionMetric {
  role: string;
  points: number;
  tasks: number;
  efficiency: number;
}

interface StrategicInsight {
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  impact: string;
}

interface BurnUpMetric {
  name: string;
  ideal?: number;
  actual?: number;
  scope: number;
  forecast?: number;
}

interface PredictiveFinancialForecastMetric {
  date: string;
  actual?: number;
  average: number;
  optimistic: number;
  pessimistic: number;
  budget: number;
}

type ChartTooltipPayload = {
  name?: string;
  dataKey?: string;
  value?: number | string;
  color?: string;
  fill?: string;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string | number;
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
  refactor: "hsl(var(--warning))",
  debt: "hsl(var(--muted-foreground))",
};

export function ProjectOverviewCharts({ project, tasks }: ProjectOverviewChartsProps) {
  const { t } = useTranslation();
  // 1. Task Priority Distribution
  const priorityData = useMemo(() => {
    const counts = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([priority, count]) => ({
      name: priority.toUpperCase(),
      value: count,
      priority: priority as TaskPriority,
    })).sort((a, b) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority as TaskPriority] - order[b.priority as TaskPriority];
    });
  }, [tasks]);

  // 2. Issue Type Breakdown (for software projects)
  const issueTypeData = useMemo(() => {
    const counts = tasks.reduce((acc, task) => {
      const type = task.issue_type || 'task';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([type, count]) => ({
      name: type.toUpperCase(),
      value: count,
      type,
    }));
  }, [tasks]);

  // 3. Member Workload (Tasks Assigned)
  const memberWorkload = useMemo(() => {
    const workload: Record<string, { name: string, taskCount: number, completedCount: number, avatar?: string }> = {};
    
    // Initialize with all project members
    (project.members || []).forEach(m => {
      if (m.user) {
        workload[m.user.id] = { 
          name: m.user.name, 
          taskCount: 0, 
          completedCount: 0,
          avatar: m.user.avatar_path || undefined
        };
      }
    });

    // Count tasks per assignee
    tasks.forEach(task => {
      (task.assignees || []).forEach(assignee => {
        if (workload[assignee.id]) {
          workload[assignee.id].taskCount++;
          if (task.column?.is_done) {
            workload[assignee.id].completedCount++;
          }
        }
      });
    });

    return Object.values(workload).sort((a, b) => b.taskCount - a.taskCount);
  }, [project.members, tasks]);

  // 4. Cumulative Flow (Last 14 days)
  const flowData = useMemo(() => {
    const days = 14;
    const data = [];
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const createdUntil = tasks.filter(t => new Date(t.created_at) <= date).length;
      const completedUntil = tasks.filter(t => t.column?.is_done && t.updated_at && new Date(t.updated_at) <= date).length;
      
      data.push({
        date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        created: createdUntil,
        completed: completedUntil,
      });
    }
    return data;
  }, [tasks]);

  // 5. Story Points vs Priority (for software projects)
  const storyPointsData = useMemo(() => {
    const counts = tasks.reduce((acc, task) => {
      const p = task.priority;
      acc[p] = (acc[p] || 0) + (task.story_points || 0);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([priority, points]) => ({
      name: priority.toUpperCase(),
      points,
      priority: priority as TaskPriority,
    })).sort((a, b) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority as TaskPriority] - order[b.priority as TaskPriority];
    });
  }, [tasks]);

  // 6. Project Health Radar
  const healthMetrics = useMemo<HealthMetric[]>(() => {
    const totalTasks = tasks.length || 1;
    const completedTasks = tasks.filter(t => t.column?.is_done).length;
    const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && !t.column?.is_done).length;
    
    const velocity = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const stability = totalTasks > 0 ? Math.max(0, 100 - (overdueTasks / totalTasks * 100)) : 100;
    
    // Calculate Budget Utilization
    let budgetUtilization = 0;
    if (project.budget && project.budget > 0) {
      // If we have hourly rate and time logs, we can estimate cost
      const totalMinutes = tasks.reduce((acc, t) => {
        return acc + (t.time_logs?.reduce((tAcc, log) => tAcc + (log.duration_minutes || 0), 0) || 0);
      }, 0);
      const estimatedCost = (totalMinutes / 60) * (project.hourly_rate || 0);
      budgetUtilization = Math.min(100, (estimatedCost / project.budget) * 100);
    }

    const quality = issueTypeData.find(d => d.type === 'bug') ? Math.max(0, 100 - ((issueTypeData.find(d => d.type === 'bug')?.value || 0) / totalTasks * 100)) : 100;
    const teamScore = memberWorkload.length > 0
      ? memberWorkload.reduce((sum, member) => sum + (member.taskCount > 0 ? (member.completedCount / member.taskCount) * 100 : 0), 0) / memberWorkload.length
      : 0;

    return [
      { subject: 'Velocity', A: Math.round(velocity), fullMark: 100 },
      { subject: 'Stability', A: Math.round(stability), fullMark: 100 },
      { subject: 'Budget', A: Math.round(100 - budgetUtilization), fullMark: 100 },
      { subject: 'Quality', A: Math.round(quality), fullMark: 100 },
      { subject: 'Team', A: Math.round(teamScore), fullMark: 100 },
    ];
  }, [tasks, project, issueTypeData, memberWorkload]);

  // 7. DevOps Pulse Logic
  const devOpsData = useMemo(() => {
    const prCounts = tasks.reduce((acc, t) => {
      const status = t.pr_status || 'none';
      if (status !== 'none') acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const buildCounts = tasks.reduce((acc, t) => {
      const status = t.build_status || 'none';
      if (status !== 'none') acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalBuilds = (buildCounts.success || 0) + (buildCounts.failure || 0);
    const reliabilityRate = totalBuilds > 0 ? Math.round((buildCounts.success / totalBuilds) * 100) : 100;

    return {
      pr: [
        { name: 'Merged', value: prCounts.merged || 0, color: 'hsl(var(--success))' },
        { name: 'Open', value: prCounts.open || 0, color: 'hsl(var(--primary))' },
        { name: 'Closed', value: prCounts.closed || 0, color: 'hsl(var(--destructive))' },
      ],
      builds: {
        success: buildCounts.success || 0,
        failure: buildCounts.failure || 0,
        rate: reliabilityRate
      }
    };
  }, [tasks]);

  // 8. Effort Allocation Logic
  const effortDistributionData = useMemo(() => {
    const distribution = tasks.reduce((acc, t) => {
      const type = t.issue_type || 'task';
      const minutes = t.time_logs?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0;
      acc[type] = (acc[type] || 0) + (minutes / 60);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .map(([type, hours]) => ({
        name: type.toUpperCase(),
        hours: Math.round(hours * 10) / 10,
        type
      }))
      .filter(d => d.hours > 0);
  }, [tasks]);

  // 9. Resource Utilization (assigned task share from saved assignments)
  const resourceUtilizationData = useMemo(() => {
    const assignedTaskTotal = memberWorkload.reduce((sum, member) => sum + member.taskCount, 0);

    return memberWorkload.map(member => {
      return {
        name: member.name,
        load: assignedTaskTotal > 0 ? Math.round((member.taskCount / assignedTaskTotal) * 100) : 0,
        capacity: 100
      };
    });
  }, [memberWorkload]);



  // 11. Sprint Velocity (Points Completed per Sprint)
  const sprintVelocityData = useMemo(() => {
    if (!project.sprints || project.sprints.length === 0) return [];
    
    return project.sprints.map(sprint => {
      // If sprint tasks are not pre-populated, we'full filter from all tasks
      const sprintTasks = sprint.tasks || tasks.filter(t => t.sprint_id === sprint.id);
      const planned = sprintTasks.reduce((acc, t) => acc + (t.story_points || 0), 0);
      const completed = sprintTasks
        .filter(t => t.column?.is_done)
        .reduce((acc, t) => acc + (t.story_points || 0), 0);
      
      return {
        name: sprint.name,
        planned,
        completed,
        efficiency: planned > 0 ? Math.round((completed / planned) * 100) : 0
      };
    });
  }, [project.sprints, tasks]);

  // 12. Financial Intelligence (Budget vs Cost vs Revenue)
  const financialData = useMemo(() => {
    const totalMinutes = tasks.reduce((acc, t) => {
      return acc + (t.time_logs?.reduce((tAcc, log) => tAcc + (log.duration_minutes || 0), 0) || 0);
    }, 0);
    
    const cost = (totalMinutes / 60) * (project.hourly_rate || 0);
    const budget = project.budget || 0;
    const revenue = project.estimated_revenue || 0;
    
    return [
      { name: 'Revenue', value: revenue, fill: 'hsl(var(--primary))' },
      { name: 'Budget', value: budget, fill: 'hsl(var(--success))' },
      { name: 'Cost', value: cost, fill: 'hsl(var(--destructive))' },
    ].filter(d => d.value > 0);
  }, [tasks, project]);

  // 13. Collaboration Pulse (Activity over time)
  const collaborationData = useMemo(() => {
    const days = 14;
    const data = [];
    const now = new Date();
    
    const allComments = [
      ...(project.comments || []),
      ...tasks.flatMap(t => t.comments || [])
    ];

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayComments = allComments.filter(c => c.created_at.startsWith(dateStr)).length;
      const dayTasksUpdated = tasks.filter(t => t.updated_at.startsWith(dateStr)).length;
      
      data.push({
        date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        engagement: dayComments + dayTasksUpdated,
        comments: dayComments,
        updates: dayTasksUpdated,
      });
    }
    return data;
  }, [project.comments, tasks]);

  // 14. Burn-up Data (Scope vs. Completion over time)
  const burnUpData = useMemo<BurnUpMetric[]>(() => {
    if (!project.start_date) return [];
    
    const start = new Date(project.start_date);
    const end = project.end_date ? new Date(project.end_date) : new Date();
    const days = Math.max(14, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const step = Math.ceil(days / 10); // Show ~10 data points
    
    const data: BurnUpMetric[] = [];
    const totalTasks = tasks.length;
    
    for (let i = 0; i <= days; i += step) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      const ideal = Math.round((i / days) * totalTasks);
      const actual = tasks.filter(t => t.column?.is_done && t.updated_at && new Date(t.updated_at) <= date).length;
      
      data.push({
        name: dateStr,
        ideal,
        actual,
        scope: totalTasks
      });
    }
    return data;
  }, [project, tasks]);

  // 12. Cycle Time Distribution (Efficiency)
  const cycleTimeData = useMemo(() => {
    const ranges = [
      { name: '1 Day', count: 0, color: 'hsl(var(--success))' },
      { name: '2-3 Days', count: 0, color: 'hsl(var(--primary))' },
      { name: '4-7 Days', count: 0, color: 'hsl(var(--warning))' },
      { name: '8+ Days', count: 0, color: 'hsl(var(--destructive))' },
    ];
    
    tasks.filter(t => t.column?.is_done).forEach(t => {
      const created = new Date(t.created_at);
      const completed = new Date(t.updated_at);
      const diffDays = Math.floor((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) ranges[0].count++;
      else if (diffDays <= 3) ranges[1].count++;
      else if (diffDays <= 7) ranges[2].count++;
      else ranges[3].count++;
    });
    
    return ranges.filter(r => r.count > 0);
  }, [tasks]);

  // 13. Risk Assessment (Overdue vs Priority)
  const riskAssessmentData = useMemo<RiskMetric[]>(() => {
    const now = new Date();
    const overdue = tasks.filter(t => !t.column?.is_done && t.due_date && new Date(t.due_date) < now).length;
    const highPriorityBlockers = tasks.filter(t => !t.column?.is_done && (t.priority === 'urgent' || t.priority === 'high')).length;
    const unassignedUrgent = tasks.filter(t => !t.column?.is_done && t.priority === 'urgent' && (!t.assignees || t.assignees.length === 0)).length;
    const lowVelocity = tasks.filter(t => !t.column?.is_done && t.updated_at && (now.getTime() - new Date(t.updated_at).getTime()) > (1000 * 60 * 60 * 24 * 5)).length;

    return [
      { name: 'Overdue', value: overdue, color: 'hsl(var(--destructive))' },
      { name: 'Priority Blocker', value: highPriorityBlockers, color: 'hsl(var(--warning))' },
      { name: 'Unassigned Urgent', value: unassignedUrgent, color: 'hsl(var(--primary))' },
      { name: 'Stagnant Tasks', value: lowVelocity, color: 'hsl(var(--muted-foreground))' },
    ];
  }, [tasks]);

  // 14. Lead Time vs Cycle Time Analysis
  const leadCycleData = useMemo<EfficiencyMetric[]>(() => {
    const completedTasks = tasks.filter(t => t.column?.is_done && t.updated_at);
    if (completedTasks.length === 0) return [];

    return completedTasks.map(t => {
      const created = new Date(t.created_at);
      const finished = new Date(t.updated_at);
      const leadTime = Math.max(0, (finished.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      
      // Cycle time heuristic: from first time log or 70% of lead time if no logs
      let cycleTime = leadTime * 0.7;
      if (t.time_logs && t.time_logs.length > 0) {
        const firstLog = new Date(Math.min(...t.time_logs.map(l => new Date(l.started_at).getTime())));
        cycleTime = Math.max(0, (finished.getTime() - firstLog.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        name: t.title.substring(0, 10) + "...",
        leadTime: Math.round(leadTime * 10) / 10,
        cycleTime: Math.round(cycleTime * 10) / 10,
      };
    }).slice(-10); // Last 10 completed tasks
  }, [tasks]);

  // 15. Resource ROI (Points vs Hours)
  const resourceROIData = useMemo<ROIMetric[]>(() => {
    const memberStats: Record<string, { name: string, points: number, hours: number }> = {};
    
    tasks.forEach(t => {
      const points = t.story_points || 0;
      const hours = (t.time_logs?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0) / 60;
      
      (t.assignees || []).forEach(a => {
        if (!memberStats[a.id]) {
          memberStats[a.id] = { name: a.name, points: 0, hours: 0 };
        }
        // Distribute points and hours among assignees (simplified)
        memberStats[a.id].points += points / (t.assignees?.length || 1);
        memberStats[a.id].hours += hours / (t.assignees?.length || 1);
      });
    });

    return Object.values(memberStats).map(s => ({
      ...s,
      roi: s.hours > 0 ? Math.round((s.points / s.hours) * 10) / 10 : 0
    })).filter(s => s.hours > 0 || s.points > 0);
  }, [tasks]);

  // 16. Quality Intelligence (Bugs Created vs Resolved)
  const qualityIntelData = useMemo<QualityMetric[]>(() => {
    const days = 14;
    const data: QualityMetric[] = [];
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const createdBugs = tasks.filter(t => t.issue_type === 'bug' && t.created_at.startsWith(dateStr)).length;
      const resolvedBugs = tasks.filter(t => t.issue_type === 'bug' && t.column?.is_done && t.updated_at?.startsWith(dateStr)).length;
      
      data.push({
        date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        created: createdBugs,
        resolved: resolvedBugs,
      });
    }
    return data;
  }, [tasks]);

  // 17. Cumulative Financial Trajectory
  const cumulativeFinancialData = useMemo<FinancialTrajectoryMetric[]>(() => {
    const days = 30;
    const data: FinancialTrajectoryMetric[] = [];
    const now = new Date();
    const hourlyRate = project.hourly_rate || 0;
    const budget = project.budget || 0;
    const estimatedRevenue = project.estimated_revenue || 0;
    
    let totalCost = 0;
    
    // Get all time logs sorted by date
    const allLogs = tasks.flatMap(t => t.time_logs || [])
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayLogs = allLogs.filter(l => l.started_at.startsWith(dateStr));
      const dayCost = dayLogs.reduce((sum, l) => sum + ((l.duration_minutes || 0) / 60) * hourlyRate, 0);
      totalCost += dayCost;
      
      data.push({
        date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        cost: Math.round(totalCost),
        budget: budget,
        revenue: estimatedRevenue,
      });
    }
    return data;
  }, [tasks, project]);

  // 18. Workload Velocity Trend (Points per member per week)
  const workloadVelocityTrend = useMemo<VelocityTrendMetric[]>(() => {
    const weeks = 6;
    const data: VelocityTrendMetric[] = [];
    const now = new Date();
    
    for (let i = weeks; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - (i * 7 + now.getDay()));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      const weekStr = `W${weeks - i}`;
      const weekData: VelocityTrendMetric = { week: weekStr };
      
      memberWorkload.forEach(member => {
        const memberTasks = tasks.filter(t => 
          t.column?.is_done && 
          t.updated_at && 
          new Date(t.updated_at) >= start && 
          new Date(t.updated_at) <= end &&
          t.assignees?.some(a => a.name === member.name)
        );
        
        const points = memberTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
        weekData[member.name] = points;
      });
      
      data.push(weekData);
    }
    return data;
  }, [tasks, memberWorkload]);

  // 19. Complexity vs Efficiency (Scatter Data)
  const complexityVsEfficiencyData = useMemo<ComplexityEfficiencyMetric[]>(() => {
    return tasks
      .filter(t => t.column?.is_done && t.story_points && t.updated_at)
      .map(t => {
        const created = new Date(t.created_at);
        const finished = new Date(t.updated_at);
        const cycleTime = Math.max(0.5, (finished.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          complexity: t.story_points || 0,
          efficiency: Math.round(cycleTime * 10) / 10,
          name: t.title,
          type: t.issue_type || 'task'
        };
      });
  }, [tasks]);

  // 20. Status Bottleneck Analysis
  const statusBottleneckData = useMemo<BottleneckMetric[]>(() => {
    const board = project.boards?.[0];
    if (!board || !board.columns) return [];
    
    const now = new Date();
    return board.columns.map(col => {
      const colTasks = tasks.filter(t => t.column_id === col.id);
      const avgAge = colTasks.length > 0 
        ? colTasks.reduce((sum, t) => {
            const updated = new Date(t.updated_at || t.created_at);
            return sum + (now.getTime() - updated.getTime());
          }, 0) / colTasks.length / (1000 * 60 * 60 * 24)
        : 0;
        
      return {
        status: col.name,
        avgDays: Math.round(avgAge * 10) / 10,
        count: colTasks.length
      };
    });
  }, [project.boards, tasks]);

  // 21. Skill / Tag Distribution
  const skillDistributionData = useMemo<TagMetric[]>(() => {
    const tagStats: Record<string, { points: number, count: number }> = {};
    
    tasks.forEach(t => {
      (t.tags || []).forEach(tag => {
        if (!tagStats[tag]) tagStats[tag] = { points: 0, count: 0 };
        tagStats[tag].count++;
        tagStats[tag].points += t.story_points || 1;
      });
    });
    
    return Object.entries(tagStats)
      .map(([tag, stats]) => ({
        tag,
        points: stats.points,
        count: stats.count
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 8);
  }, [tasks]);

  // 22. Predictive Burn-up
  const enhancedBurnUpData = useMemo(() => {
    const baseData = burnUpData;
    if (baseData.length < 2) return baseData;
    
    const last3 = baseData.slice(-3);
    const lastElement = last3[last3.length - 1];
    const firstElement = last3[0];
    if (!lastElement || !firstElement) return baseData;

    const lastActual = lastElement.actual ?? 0;
    const firstActual = firstElement.actual ?? 0;
    const avgVelocity = last3.length >= 2 
      ? (lastActual - firstActual) / (last3.length - 1)
      : 0;
      
    const forecastData = [...baseData.map(d => ({ ...d, forecast: d.actual }))];
    let currentActual = lastActual;
    const scope = lastElement.scope;
    
    for (let i = 1; i <= 5; i++) {
      currentActual = Math.min(scope, currentActual + avgVelocity);
      forecastData.push({
        name: `F+${i}`,
        actual: undefined,
        forecast: Math.round(currentActual),
        ideal: undefined,
        scope
      });
    }
    
    return forecastData;
  }, [burnUpData]);

  // 23. Project Velocity Pulse (Weekly Aggregate)
  const projectVelocityPulse = useMemo<ProjectVelocityMetric[]>(() => {
    const weeks = 8;
    const data: ProjectVelocityMetric[] = [];
    const now = new Date();
    
    for (let i = weeks; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - (i * 7 + now.getDay()));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      const dateStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      const weekTasks = tasks.filter(t => 
        t.column?.is_done && 
        t.updated_at && 
        new Date(t.updated_at) >= start && 
        new Date(t.updated_at) <= end
      );
      
      data.push({
        date: dateStr,
        points: weekTasks.reduce((sum, t) => sum + (t.story_points || 0), 0),
        completed: weekTasks.length
      });
    }
    return data;
  }, [tasks]);

  // 24. Multidimensional Member Intelligence
  const memberRadarData = useMemo<MemberRadarMetric[]>(() => {
    const subjects = ['Velocity', 'Quality', 'Efficiency', 'Reliability', 'Complexity'];
    const data: MemberRadarMetric[] = subjects.map(s => ({ subject: s }));
    
    memberWorkload.slice(0, 4).forEach(member => {
      const memberTasks = tasks.filter(t => t.assignees?.some(a => a.name === member.name));
      const completedTasks = memberTasks.filter(t => t.column?.is_done);
      
      // 1. Velocity (Points per task average)
      const totalPoints = completedTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
      const velocity = memberTasks.length > 0 ? (totalPoints / memberTasks.length) * 20 : 0; // Scale to 100
      
      // 2. Quality (Inverse of bugs assigned)
      const bugs = memberTasks.filter(t => t.issue_type === 'bug').length;
      const quality = memberTasks.length > 0 ? Math.max(0, 100 - (bugs / memberTasks.length * 200)) : 100;
      
      // 3. Efficiency (Cycle time)
      const avgCycleTime = completedTasks.length > 0 
        ? completedTasks.reduce((sum, t) => {
            const d = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return sum + d;
          }, 0) / completedTasks.length
        : 10;
      const efficiency = Math.max(0, 100 - (avgCycleTime * 5));
      
      // 4. Reliability (PR Merged rate)
      const prs = memberTasks.filter(t => t.pr_status);
      const merged = prs.filter(t => t.pr_status === 'merged').length;
      const reliability = prs.length > 0 ? (merged / prs.length) * 100 : 80;
      
      // 5. Complexity (Avg Story Points)
      const complexity = completedTasks.length > 0 ? (totalPoints / completedTasks.length) * 15 : 0;

      data[0][member.name] = Math.min(100, Math.round(velocity));
      data[1][member.name] = Math.min(100, Math.round(quality));
      data[2][member.name] = Math.min(100, Math.round(efficiency));
      data[3][member.name] = Math.min(100, Math.round(reliability));
      data[4][member.name] = Math.min(100, Math.round(complexity));
    });
    
    return data;
  }, [tasks, memberWorkload]);

  // 25. Scope Evolution Tracking
  const scopeEvolutionData = useMemo<ScopeTrendMetric[]>(() => {
    const days = 30;
    const data: ScopeTrendMetric[] = [];
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const tasksUntil = tasks.filter(t => new Date(t.created_at) <= date);
      
      data.push({
        date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        totalPoints: tasksUntil.reduce((sum, t) => sum + (t.story_points || 0), 0),
        totalTasks: tasksUntil.length
      });
    }
    return data;
  }, [tasks]);

  // 26. Predictive Intelligence
  const predictiveMetrics = useMemo(() => {
    const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const completedPoints = tasks.filter(t => t.column?.is_done).reduce((sum, t) => sum + (t.story_points || 0), 0);
    const remainingPoints = totalPoints - completedPoints;
    
    const last14Days = new Date();
    last14Days.setDate(last14Days.getDate() - 14);
    const pointsLast14 = tasks
      .filter(t => t.column?.is_done && t.updated_at && new Date(t.updated_at) >= last14Days)
      .reduce((sum, t) => sum + (t.story_points || 0), 0);
    
    const dailyVelocity = pointsLast14 / 14;
    const daysToFinish = dailyVelocity > 0 ? Math.ceil(remainingPoints / dailyVelocity) : Infinity;
    
    const finishDate = new Date();
    if (daysToFinish !== Infinity) {
      finishDate.setDate(finishDate.getDate() + daysToFinish);
    }
    
    return {
      remainingPoints,
      dailyVelocity: Math.round(dailyVelocity * 10) / 10,
      daysToFinish,
      finishDate: daysToFinish !== Infinity ? finishDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown',
      confidence: dailyVelocity > 0 ? 85 : 0
    };
  }, [tasks]);

  // 27. Checklist Velocity Intelligence
  const checklistVelocityData = useMemo<ChecklistVelocityMetric[]>(() => {
    return tasks
      .filter(t => t.checklists && t.checklists.length > 0)
      .map(t => {
        const total = t.checklists?.length || 0;
        const completed = t.checklists?.filter(c => c.is_completed).length || 0;
        return {
          name: t.title.substring(0, 15) + '...',
          total,
          completed,
          rate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      })
      .slice(-10);
  }, [tasks]);

  // 28. Environment Stability Matrix
  const environmentStabilityData = useMemo<EnvironmentStabilityMetric[]>(() => {
    const envs = ['Development', 'Staging', 'Production', 'QA'];
    return envs.map(env => {
      const envTasks = tasks.filter(t => t.environment?.toLowerCase() === env.toLowerCase());
      const bugs = envTasks.filter(t => t.issue_type === 'bug').length;
      const total = envTasks.length || 1;
      return {
        env,
        bugs,
        stability: Math.max(0, 100 - (bugs / total * 100))
      };
    });
  }, [tasks]);

  // 29. Role-Based Contribution Analysis
  const roleContributionData = useMemo<RoleContributionMetric[]>(() => {
    const roles: Record<string, { points: number, tasks: number, completed: number }> = {};
    
    tasks.forEach(t => {
      (t.assignees || []).forEach(a => {
        const member = project.members?.find(m => m.user_id === a.id);
        const role = member?.role || 'member';
        if (!roles[role]) roles[role] = { points: 0, tasks: 0, completed: 0 };
        
        roles[role].tasks++;
        roles[role].points += (t.story_points || 0) / (t.assignees?.length || 1);
        if (t.column?.is_done) roles[role].completed++;
      });
    });

    return Object.entries(roles).map(([role, stats]) => ({
      role: role.toUpperCase(),
      points: Math.round(stats.points),
      tasks: stats.tasks,
      efficiency: stats.tasks > 0 ? Math.round((stats.completed / stats.tasks) * 100) : 0
    }));
  }, [tasks, project.members]);

  // 30. Enhanced Financial Forecasting (Runway & Burn-rate)
  const financialIntelligence = useMemo(() => {
    const totalCost = cumulativeFinancialData[cumulativeFinancialData.length - 1]?.cost || 0;
    const budget = project.budget || 0;
    const remainingBudget = Math.max(0, budget - totalCost);
    
    // Calculate burn rate from last 7 days
    const last7Days = cumulativeFinancialData.slice(-7);
    const burnRate = last7Days.length >= 2 
      ? (last7Days[last7Days.length - 1].cost - last7Days[0].cost) / 7
      : totalCost / 30; // Fallback to avg
      
    const runwayDays = burnRate > 0 ? Math.ceil(remainingBudget / burnRate) : Infinity;
    
    return {
      totalCost,
      budget,
      remainingBudget,
      burnRate: Math.round(burnRate),
      runwayDays,
      utilization: budget > 0 ? Math.round((totalCost / budget) * 100) : 0
    };
  }, [cumulativeFinancialData, project.budget]);

  // 31. AI Strategic Insights Generation
  const strategicInsights = useMemo<StrategicInsight[]>(() => {
    const insights: StrategicInsight[] = [];
    
    // Velocity Insight
    if (predictiveMetrics.dailyVelocity < 2) {
      insights.push({
        type: 'warning',
        title: 'Velocity Stagnation Detected',
        description: 'Current delivery rate has dropped below 2pts/day. This may impact Q3 milestones.',
        impact: 'High Risk'
      });
    }

    // Quality Insight
    const bugRate = tasks.filter(t => t.issue_type === 'bug').length / (tasks.length || 1);
    if (bugRate > 0.3) {
      insights.push({
        type: 'critical',
        title: 'Tech Debt Surge',
        description: 'Bug-to-feature ratio is exceeding 30%. Recommendation: Prioritize stabilization sprint.',
        impact: 'Deployment Blocked'
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Superior Quality Index',
        description: 'Stability metrics are at an all-time high. Opportunity for feature acceleration.',
        impact: 'Positive'
      });
    }

    // Financial Insight
    if (financialIntelligence.runwayDays < 14 && financialIntelligence.utilization > 80) {
      insights.push({
        type: 'critical',
        title: 'Budget Exhaustion Imminent',
        description: `Runway estimated at ${financialIntelligence.runwayDays} days. Immediate review required.`,
        impact: 'Critical'
      });
    }

    // Resource Insight
    const overleaded = resourceUtilizationData.filter(r => r.load > 90).length;
    if (overleaded > 0) {
      insights.push({
        type: 'warning',
        title: 'Resource Burnout Risk',
        description: `${overleaded} core contributors are operating at >90% capacity for 2+ weeks.`,
        impact: 'Medium'
      });
    }

    return insights;
  }, [predictiveMetrics, tasks, financialIntelligence, resourceUtilizationData]);

  // 32. Velocity Consistency Intelligence
  const velocityConsistencyData = useMemo(() => {
    const weeks: Record<string, number> = {};
    const last8Weeks = Array.from({ length: 8 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (i * 7));
      return d.toISOString().split('T')[0];
    }).reverse();

    last8Weeks.forEach(w => weeks[w] = 0);

    tasks.filter(t => t.column?.is_done && t.updated_at).forEach(t => {
      const date = new Date(t.updated_at!).toISOString().split('T')[0];
      const weekStart = last8Weeks.find(w => new Date(date) >= new Date(w));
      if (weekStart) weeks[weekStart] += (t.story_points || 0);
    });

    return Object.entries(weeks).map(([week, pts]) => ({
      week,
      pts,
      avg: Math.round(Object.values(weeks).reduce((a, b) => a + b, 0) / 8)
    }));
  }, [tasks]);

  // 33. Task Aging Analysis
  const taskAgingData = useMemo(() => {
    const buckets = [
      { name: 'Fresh (0-3d)', count: 0, color: 'hsl(var(--success))' },
      { name: 'Active (4-7d)', count: 0, color: 'hsl(var(--primary))' },
      { name: 'Stale (8-14d)', count: 0, color: 'hsl(var(--amber-500))' },
      { name: 'Critical (15d+)', count: 0, color: 'hsl(var(--destructive))' }
    ];

    tasks.filter(t => !t.column?.is_done).forEach(t => {
      const created = new Date(t.created_at);
      const now = new Date();
      const diffDays = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 3) buckets[0].count++;
      else if (diffDays <= 7) buckets[1].count++;
      else if (diffDays <= 14) buckets[2].count++;
      else buckets[3].count++;
    });

    return buckets;
  }, [tasks]);
  
  // 34. Predictive Financial Forecast (Scenario Modeling)
  const predictiveFinancialForecastData = useMemo<PredictiveFinancialForecastMetric[]>(() => {
    const days = 30; // Extended to 30 days for better scenario visualization
    const now = new Date();
    const data: PredictiveFinancialForecastMetric[] = [];
    const hourlyRate = project.hourly_rate || 0;
    const budget = project.budget || 0;

    const totalSpent = tasks.reduce((acc, t) => {
      return acc + (t.time_logs?.reduce((tAcc, log) => tAcc + (log.duration_minutes || 0), 0) || 0);
    }, 0) / 60 * hourlyRate;

    const avgDailyBurn = totalSpent > 0 ? totalSpent / Math.max(1, (now.getTime() - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      
      // Scenarios
      const avgForecast = totalSpent + (avgDailyBurn * i);
      const optimisticForecast = totalSpent + (avgDailyBurn * 0.7 * i);
      const pessimisticForecast = totalSpent + (avgDailyBurn * 1.5 * i);
      
      data.push({
        date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        actual: i === 0 ? Math.round(totalSpent) : undefined,
        average: Math.round(avgForecast),
        optimistic: Math.round(optimisticForecast),
        pessimistic: Math.round(pessimisticForecast),
        budget: budget
      });
    }
    return data;
  }, [project, tasks]);

  // 34. Strategic Project DNA
  const projectDNA = useMemo(() => [
    { subject: 'Velocity', A: Math.min(100, (tasks.filter(t => t.column?.is_done).length / (tasks.length || 1)) * 150), fullMark: 100 },
    { subject: 'Quality', A: Math.max(0, 100 - (tasks.filter(t => t.issue_type === 'bug').length / (tasks.length || 1)) * 200), fullMark: 100 },
    { subject: 'Consistency', A: Math.min(100, (tasks.filter(t => t.due_date).length / (tasks.length || 1)) * 100), fullMark: 100 },
    { subject: 'Coverage', A: Math.min(100, (tasks.filter(t => t.assignees && t.assignees.length > 0).length / (tasks.length || 1)) * 100), fullMark: 100 },
    { subject: 'Focus', A: Math.max(0, 100 - (tasks.filter(t => t.is_backlog).length / (tasks.length || 1)) * 100), fullMark: 100 },
  ], [tasks]);

  const nextMilestoneTask = tasks
    .filter(task => !task.column?.is_done && task.due_date)
    .sort((a, b) => new Date(a.due_date || '').getTime() - new Date(b.due_date || '').getTime())[0];
  const nextMilestoneLabel = nextMilestoneTask?.title || project.name;
  const nextMilestoneEta = nextMilestoneTask?.due_date
    ? `${Math.max(0, Math.ceil((new Date(nextMilestoneTask.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} Days`
    : predictiveMetrics.daysToFinish !== Infinity
      ? `${predictiveMetrics.daysToFinish} Days`
      : 'No ETA';
  const latestVelocity = velocityConsistencyData[velocityConsistencyData.length - 1]?.pts || 0;
  const averageVelocity = velocityConsistencyData[0]?.avg || 0;
  const velocityTrendLabel = latestVelocity >= averageVelocity && latestVelocity > 0 ? 'Above Average' : latestVelocity > 0 ? 'Below Average' : 'No Velocity Yet';
  const velocityTrendDetail = `${latestVelocity} pts this week vs ${averageVelocity} avg`;
  const confidenceLabel = predictiveMetrics.confidence > 0 ? `${predictiveMetrics.confidence}% Measured` : 'Not Enough Data';
  const riskSignalCount = taskAgingData
    .filter(bucket => bucket.name.startsWith('Stale') || bucket.name.startsWith('Critical'))
    .reduce((sum, bucket) => sum + bucket.count, 0);
  const riskMitigationLabel = riskSignalCount > 0 ? 'Attention Needed' : 'Low Current Risk';
  void flowData;
  void storyPointsData;
  void effortDistributionData;
  void financialData;

  const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/90 backdrop-blur-2xl border border-primary/20 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in duration-300">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/70 mb-2">{label || payload[0].name}</p>
          <div className="space-y-2">
            {payload.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{p.name || p.dataKey}</span>
                </div>
                <span className="text-sm font-black text-foreground">
                  {typeof p.value === 'number' && (p.name?.toLowerCase().includes('cost') || p.name?.toLowerCase().includes('budget') || p.name?.toLowerCase().includes('revenue')) 
                    ? `${project.currency || 'USD'} ${p.value.toLocaleString()}` 
                    : p.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-20">
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col xl:flex-row items-stretch justify-between gap-6 bg-primary/[0.03] backdrop-blur-3xl border border-primary/10 p-8 rounded-[3.5rem] overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
          <Cpu className="h-32 w-32 text-primary" />
        </div>
        
        <div className="flex-1 space-y-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
               <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/70">{t('project_management.predictive_intelligence_engine', 'Predictive Intelligence Engine')}</span>
            </div>
            <h2 className="text-4xl font-black tracking-tighter text-foreground">
              {t('project_management.estimated_completion', 'Estimated Completion:')} <span className="text-primary">{predictiveMetrics.finishDate}</span>
            </h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              {t('project_management.based_on_current_velocity', 'Based on current velocity of {velocity} pts/day • {confidence}% Confidence Index', { velocity: predictiveMetrics.dailyVelocity, confidence: predictiveMetrics.confidence })}
            </p>
          </div>

          {/* AI Roadmap Forecast */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['Inception', 'Development', 'Stabilization', 'Deployment'].map((phase, i) => {
              const progress = Math.round((tasks.filter(t => t.column?.is_done).length / (tasks.length || 1)) * 100);
              const phaseThreshold = (i + 1) * 25;
              const isActive = progress >= phaseThreshold - 25;
              const isCompleted = progress >= phaseThreshold;

              return (
                <div key={phase} className="flex items-center gap-2 shrink-0">
                  <div className={cn(
                    "px-4 py-2 rounded-2xl border flex items-center gap-2 transition-all duration-500",
                    isCompleted ? "bg-success/10 border-success/20 text-success" : 
                    isActive ? "bg-primary/10 border-primary/20 text-primary animate-pulse" : 
                    "bg-muted/10 border-border/40 text-muted-foreground opacity-50"
                  )}>
                    {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                    <span className="text-[11px] font-black uppercase tracking-widest">{phase}</span>
                  </div>
                  {i < 3 && <div className="h-[1px] w-4 bg-border/40" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-row xl:flex-col gap-4 relative z-10 justify-end">
          <div className="px-8 py-6 rounded-[2rem] bg-background/50 border border-border/40 flex flex-col items-center justify-center min-w-[140px] hover:border-primary/40 transition-colors">
            <span className="text-3xl font-black text-foreground">{predictiveMetrics.remainingPoints}</span>
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">Remaining Pts</span>
          </div>
          <div className="px-8 py-6 rounded-[2rem] bg-background/50 border border-border/40 flex flex-col items-center justify-center min-w-[140px] hover:border-primary/40 transition-colors">
            <span className="text-3xl font-black text-primary">{predictiveMetrics.daysToFinish === Infinity ? '∞' : predictiveMetrics.daysToFinish}</span>
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">Days to Go</span>
          </div>
        </div>
      </motion.div>

      {/* AI Strategic Insights Pulse */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {strategicInsights.map((insight, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className={cn(
              "relative overflow-hidden border-none rounded-[2.5rem] p-6 h-full backdrop-blur-3xl transition-transform hover:scale-[1.02] duration-500",
              insight.type === 'critical' ? "bg-rose-500/10 border border-rose-500/20" : 
              insight.type === 'warning' ? "bg-amber-500/10 border border-amber-500/20" : 
              insight.type === 'success' ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-primary/10 border border-primary/20"
            )}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      insight.type === 'critical' ? "bg-rose-500 animate-pulse" : 
                      insight.type === 'warning' ? "bg-amber-500" : 
                      insight.type === 'success' ? "bg-emerald-500" : "bg-primary"
                    )} />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] opacity-70">{insight.type} Signal</span>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-black uppercase tracking-tighter rounded-full border-foreground/10 px-2 py-0">
                    {insight.impact}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-foreground leading-tight">{insight.title}</h4>
                  <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Top Level Intelligence: 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* 1. Project Health & Velocity */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <Card className="relative overflow-hidden bg-card/40 backdrop-blur-xl border-border/40 hover:border-primary/30 transition-all duration-500 group rounded-[2.5rem] h-[220px]">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-700 group-hover:rotate-12">
              <Activity className="h-24 w-24 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <span className="text-4xl font-black tracking-tighter text-foreground group-hover:scale-105 transition-transform duration-500 origin-left">
                  {Math.round(healthMetrics.reduce((acc, m) => acc + m.A, 0) / healthMetrics.length)}%
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t('project_management.efficiency_index', 'Efficiency Index')}</span>
              </div>
              <div className="mt-6 flex items-center gap-2">
                <Badge className={cn(
                  "border-none px-3 py-1 text-[11px] font-black uppercase tracking-tighter",
                  project.health === 'green' ? "bg-emerald-500/10 text-emerald-500" : 
                  project.health === 'yellow' ? "bg-amber-500/10 text-amber-500" : 
                  "bg-rose-500/10 text-rose-500"
                )}>
                  {t('project_management.project_phase', '{phase} PHASE', { phase: (project.health || 'STABLE').toUpperCase() })}
                </Badge>
                <div className="h-1 flex-1 bg-muted/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(healthMetrics.reduce((acc, m) => acc + m.A, 0) / healthMetrics.length)}%` }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="h-full bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2. Resource Load */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}>
          <Card className="relative overflow-hidden bg-card/40 backdrop-blur-xl border-border/40 hover:border-primary/30 transition-all duration-500 group rounded-[2.5rem] h-[220px]">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-700 group-hover:-rotate-12">
              <Users className="h-24 w-24 text-sky-500" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                Team Load
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <span className="text-4xl font-black tracking-tighter text-foreground">
                  {Math.round(resourceUtilizationData.reduce((acc, r) => acc + r.load, 0) / (resourceUtilizationData.length || 1))}%
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t('project_management.average_utilization', 'Average Utilization')}</span>
              </div>
              <div className="mt-6 flex -space-x-3 overflow-hidden">
                {project.members?.slice(0, 6).map((m, i) => (
                  <div key={m.id} className="inline-block h-8 w-8 rounded-2xl ring-4 ring-card bg-muted overflow-hidden transition-transform hover:-translate-y-2 duration-300" style={{ zIndex: 10 - i }}>
                    { }
                    <img src={m.user?.avatar_path || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user?.name}`} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
                {(project.members?.length || 0) > 6 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-muted text-[11px] font-black ring-4 ring-card z-0">
                    +{project.members!.length - 6}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3. Task Throughput */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <Card className="relative overflow-hidden bg-card/40 backdrop-blur-xl border-border/40 hover:border-primary/30 transition-all duration-500 group rounded-[2.5rem] h-[220px]">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-700 scale-110">
              <Zap className="h-24 w-24 text-amber-500" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Throughput
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <span className="text-4xl font-black tracking-tighter text-foreground">
                  {tasks.filter(t => t.column?.is_done).length}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t('project_management.tasks_completed', 'Tasks Completed')}</span>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-xl font-black text-amber-500">{Math.round((tasks.filter(t => t.column?.is_done).length / (tasks.length || 1)) * 100)}%</span>
                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">{t('project_management.overall_completion', 'Overall Completion')}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 4. Risk Radar */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
          <Card className="relative overflow-hidden bg-card/40 backdrop-blur-xl border-border/40 hover:border-primary/30 transition-all duration-500 group rounded-[2.5rem] h-[220px]">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-700">
              <ShieldCheck className="h-24 w-24 text-rose-500" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Risk Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <span className="text-4xl font-black tracking-tighter text-foreground">
                  {riskAssessmentData.find(d => d.name === 'Overdue')?.value || 0}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t('project_management.critical_blockers', 'Critical Blockers')}</span>
              </div>
              <div className="mt-6 flex gap-1">
                {riskAssessmentData.map((d, i) => (
                  <div 
                    key={i} 
                    className="h-2 rounded-full transition-all duration-500 hover:scale-y-150 cursor-pointer" 
                    style={{ 
                      width: `${(d.value / (tasks.length || 1)) * 100}%`, 
                      backgroundColor: d.color,
                      minWidth: d.value > 0 ? '4px' : '0'
                    }} 
                    title={`${d.name}: ${d.value}`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Second Row: Advanced Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Sprint Performance / Velocity */}
        {sprintVelocityData.length > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
            <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
              <CardHeader className="p-8">
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  Sprint Velocity Engine
                </CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">{t('project_management.points_planned_vs_delivered', 'Points planned vs. actually delivered')}</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] p-8 pt-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sprintVelocityData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.2)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" />
                    <Bar dataKey="planned" fill="hsl(var(--muted)/0.5)" radius={[6, 6, 0, 0]} name={t('project_management.planned_points', 'Planned Points')} />
                    <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name={t('project_management.delivered_points', 'Delivered Points')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Financial Trajectory Analysis */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4 text-emerald-500" />
                    Financial Intelligence
                  </CardTitle>
                  <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">{t('project_management.budget_utilization_runway_analysis', 'Budget utilization & runway analysis')}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-foreground">{financialIntelligence.runwayDays === Infinity ? '∞' : financialIntelligence.runwayDays} Days</p>
                  <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{t('project_management.estimated_runway', 'Estimated Runway')}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeFinancialData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} strokeDasharray="5 5" name="Projected Revenue" />
                  <Area type="monotone" dataKey="cost" stroke="hsl(var(--destructive))" fillOpacity={1} fill="url(#colorCost)" strokeWidth={3} name="Cumulative Cost" />
                  <Line type="monotone" dataKey="budget" stroke="hsl(var(--success))" strokeWidth={2} strokeDasharray="10 10" dot={false} name="Total Budget" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-3xl bg-background/20 border border-border/20">
                   <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{t('project_management.daily_burn_rate', 'Daily Burn Rate')}</p>
                   <p className="text-lg font-black text-foreground">{project.currency || 'USD'} {financialIntelligence.burnRate.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-3xl bg-background/20 border border-border/20">
                   <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{t('project_management.utilization_label', 'Utilization')}</p>
                   <p className="text-lg font-black text-primary">{financialIntelligence.utilization}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Collaboration Pulse */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="lg:col-span-2">
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-sky-500" />
                Team Collaboration Pulse
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Daily engagement & interaction volume</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={collaborationData}>
                  <defs>
                    <linearGradient id="colorEngage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="engagement" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorEngage)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* NEW: Checklist & Environment Analytics */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.3 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Checklist Velocity
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Granular progress per critical task</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={checklistVelocityData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={15} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.4 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Environment Matrix
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Stability across deployment zones</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={environmentStabilityData}>
                  <PolarGrid stroke="hsl(var(--foreground))" opacity={0.1} />
                  <PolarAngleAxis dataKey="env" tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Radar name="Stability" dataKey="stability" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.4} strokeWidth={3} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Productivity & Quality Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quality Intelligence */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-rose-500" />
                Quality Intelligence
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Bug trends & resolution velocity</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={qualityIntelData}>
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="created" stroke="hsl(var(--destructive))" fillOpacity={1} fill="url(#colorCreated)" strokeWidth={3} name="Bugs Created" />
                  <Area type="monotone" dataKey="resolved" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorResolved)" strokeWidth={3} name="Bugs Resolved" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Role-Based Contribution Analysis */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-500" />
                Role Contribution Matrix
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Points delivered vs efficiency per role</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleContributionData}>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="role" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Points" />
                  <Bar dataKey="efficiency" fill="hsl(var(--success)/0.5)" radius={[4, 4, 0, 0]} name="Efficiency %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Efficiency Analytics */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                Efficiency Intelligence
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Lead Time vs Cycle Time analysis</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadCycleData}>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" />
                  <Bar dataKey="leadTime" fill="hsl(var(--primary)/0.4)" radius={[4, 4, 0, 0]} name="Lead Time" />
                  <Bar dataKey="cycleTime" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Cycle Time" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Resource ROI */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" />
                Resource ROI
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Points delivered per logged hour</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={resourceROIData}>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Story Points" />
                  <Line yAxisId="right" type="monotone" dataKey="roi" stroke="hsl(var(--warning))" strokeWidth={3} name="ROI Index" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Velocity & Trends (Span 2) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Burn-up: Scope vs Progress */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
              <CardHeader className="p-8 pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      Project Trajectory
                    </CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1 opacity-50">Burn-up analysis & forecast</CardDescription>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Actual</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full border border-primary/40 bg-transparent" />
                      <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Ideal</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[350px] p-8">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={enhancedBurnUpData}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.3)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: "hsl(var(--muted-foreground))" }} dx={-10} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '5 5' }} />
                    <Area type="monotone" dataKey="actual" fill="url(#colorActual)" stroke="hsl(var(--primary))" strokeWidth={4} animationDuration={2000} name="Completed" />
                    <Line type="monotone" dataKey="forecast" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Forecast" />
                    <Line type="monotone" dataKey="ideal" stroke="hsl(var(--primary)/0.4)" strokeWidth={2} strokeDasharray="10 10" dot={false} animationDuration={2000} name="Ideal Path" />
                    <Line type="monotone" dataKey="scope" stroke="hsl(var(--muted-foreground))" strokeWidth={1} dot={false} opacity={0.3} name="Project Scope" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Efficiency & Intelligence Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Cycle Time Distribution */}
            <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden h-[400px]">
              <CardHeader className="p-8 pb-2">
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                  <Timer className="h-3.5 w-3.5 text-success" />
                  Efficiency Flow
                </CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Task completion speed</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cycleTimeData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} dy={10} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[12, 12, 4, 4]} barSize={40} animationDuration={1500}>
                      {cycleTimeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 flex items-center justify-center">
                   <span className="px-4 py-2 rounded-2xl bg-success/10 text-success text-[11px] font-black uppercase tracking-widest border border-success/20">
                     Peak Performance: 1-Day Cycle
                   </span>
                </div>
              </CardContent>
            </Card>

            {/* Issue Type Mix */}
            <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden h-[400px]">
              <CardHeader className="p-8 pb-2">
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  Complexity Mix
                </CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Workload categorization</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] p-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={issueTypeData}
                      cx="50%"
                      cy="45%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={8}
                      dataKey="value"
                      animationDuration={1500}
                    >
                      {issueTypeData.map((entry, index) => (
                        <Cell key={`issue-cell-${index}`} fill={ISSUE_TYPE_COLORS[entry.type] || "hsl(var(--primary))"} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      align="center" 
                      iconType="circle" 
                      iconSize={6}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-2xl font-black tracking-tighter text-foreground">{tasks.length}</p>
                  <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Total Entities</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Health & Quality (Span 1) */}
        <div className="space-y-8">
          
          {/* Health Radar */}
          <Card className="bg-primary/[0.03] backdrop-blur-2xl border-primary/20 rounded-[3rem] overflow-hidden h-[450px] relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary-rgb),transparent_70%)] opacity-5" />
            <CardHeader className="p-8 pb-0">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/80 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 animate-pulse" />
                Structural Integrity
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] p-0 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={healthMetrics}>
                  <PolarGrid stroke="hsl(var(--primary))" opacity={0.1} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 900, opacity: 0.6 }} />
                  <Radar 
                    name="Metrics" 
                    dataKey="A" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.4} 
                    strokeWidth={3}
                    animationDuration={2000} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="px-8 mt-4 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-3xl bg-background/50 border border-primary/20 shadow-xl">
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">Sustainability Score</p>
                    <p className="text-2xl font-black text-primary">A+</p>
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DevOps Intelligence */}
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5" />
                Pipeline Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-3xl font-black tracking-tighter text-foreground">{devOpsData.builds.rate}%</p>
                  <p className="text-[11px] font-black text-success uppercase tracking-widest">Build Reliability</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-success" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-3xl bg-background/40 border border-border/40">
                  <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">Merged PRs</p>
                  <p className="text-xl font-black text-foreground">{devOpsData.pr.find(d => d.name === 'Merged')?.value || 0}</p>
                </div>
                <div className="p-4 rounded-3xl bg-background/40 border border-border/40">
                  <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">Failures</p>
                  <p className="text-xl font-black text-destructive">{devOpsData.builds.failure}</p>
                </div>
              </div>
            </CardContent>
          </Card>

         {/* Priority Distribution */}
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8 pb-2">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Priority Mix
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[200px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`priority-cell-${index}`} fill={PRIORITY_COLORS[entry.priority as TaskPriority]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div> {/* <--- ADD THIS CLOSING DIV HERE */}

      {/* NEW: Deep Intelligence & Strategic Scenarios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Strategic Financial Runway Scenarios */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="lg:col-span-2">
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Financial Scenario Modeling
                  </CardTitle>
                  <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Predictive cost trajectories based on performance variables</CardDescription>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Optimistic</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Average</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Pessimistic</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[350px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={predictiveFinancialForecastData}>
                  <defs>
                    <linearGradient id="colorOpt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="optimistic" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorOpt)" strokeWidth={2} name="Optimistic" />
                  <Area type="monotone" dataKey="pessimistic" stroke="hsl(var(--destructive))" fillOpacity={1} fill="url(#colorPess)" strokeWidth={2} name="Pessimistic" />
                  <Area type="monotone" dataKey="average" stroke="hsl(var(--primary))" fillOpacity={0} strokeWidth={4} name="Average Baseline" />
                  <Line type="monotone" dataKey="budget" stroke="hsl(var(--foreground))" strokeWidth={1} strokeDasharray="10 10" dot={false} opacity={0.3} name="Total Budget Limit" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Strategic DNA Radar */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <Card className="bg-primary/[0.03] backdrop-blur-2xl border-primary/20 rounded-[3rem] overflow-hidden h-full relative">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/80 flex items-center gap-2">
                <Dna className="h-4 w-4" />
                Project Strategic DNA
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] p-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={projectDNA}>
                  <PolarGrid stroke="hsl(var(--primary))" opacity={0.1} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 900, opacity: 0.6 }} />
                  <Radar 
                    name="DNA Profile" 
                    dataKey="A" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.5} 
                    strokeWidth={3}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="px-8 pb-8">
                <div className="p-4 rounded-3xl bg-background/40 border border-primary/10 text-center">
                  <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Overall Maturity Index</p>
                  <p className="text-xl font-black text-primary">LVL {Math.round(projectDNA.reduce((acc, d) => acc + d.A, 0) / 50)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Task Aging Matrix */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8 pb-2">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Task Aging Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskAgingData}>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                    {taskAgingData.map((entry, index) => (
                      <Cell key={`aging-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Bottleneck Heatmap */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8 pb-2">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                Flow Bottleneck Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={statusBottleneckData} layout="vertical">
                  <CartesianGrid strokeDasharray="5 5" horizontal={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="status" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgDays" fill="hsl(var(--destructive)/0.8)" radius={[0, 10, 10, 0]} barSize={20} name="Avg. Days in Status" />
                  <Line dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} name="Task Count" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expertise Distribution */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden">
            <CardHeader className="p-8 pb-2">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Expertise Matrix (Tags)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillDistributionData}>
                  <PolarGrid stroke="hsl(var(--primary))" opacity={0.1} />
                  <PolarAngleAxis dataKey="tag" tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Radar name="Expertise" dataKey="points" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

      </div>

      {/* Resource Allocation View (Full Width) */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
        <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3.5rem] overflow-hidden">
          <CardHeader className="p-10 pb-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <CardTitle className="text-[12px] font-black uppercase tracking-[0.4em] text-muted-foreground flex items-center gap-3">
                  <Users className="h-4 w-4 text-primary" />
                  Resource Allocation Intelligence
                </CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">Team capacity vs. ongoing load analytics</CardDescription>
              </div>
              <div className="flex gap-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest">
                  Live Sync Active
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {resourceUtilizationData.map((member, i) => (
                <div key={i} className="group relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                       <div className="h-10 w-10 rounded-2xl bg-muted border border-border/50 overflow-hidden group-hover:scale-110 transition-transform duration-500">
                          { }
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`} alt="" className="h-full w-full" />
                       </div>
                       <div className="min-w-0">
                          <p className="text-sm font-black tracking-tight text-foreground truncate">{member.name}</p>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Active Member</p>
                       </div>
                    </div>
                    <span className={cn(
                      "text-sm font-black",
                      member.load > 90 ? "text-destructive" : member.load > 70 ? "text-amber-500" : "text-emerald-500"
                    )}>{member.load}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted/20 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${member.load}%` }}
                      transition={{ duration: 1.5, delay: 1 + (i * 0.1), ease: "circOut" }}
                      className={cn(
                        "h-full rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]",
                        member.load > 90 ? "bg-destructive" : member.load > 70 ? "bg-amber-500" : "bg-primary"
                      )}
                    />
                  </div>
                </div>
              ))}
              {resourceUtilizationData.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No team resources detected in this sector.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
      {/* High-Octane Intelligence Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Workload Velocity Trend */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden h-[450px]">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Contributor Velocity Trend
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Weekly story points delivery per member</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={workloadVelocityTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" />
                  {memberWorkload.slice(0, 5).map((member, i) => (
                    <Line 
                      key={member.name} 
                      type="monotone" 
                      dataKey={member.name} 
                      stroke={`hsl(var(--primary) / ${1 - (i * 0.15)})`} 
                      strokeWidth={3} 
                      dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      animationDuration={2000 + (i * 200)}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Complexity vs Efficiency Scatter */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden h-[450px]">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" />
                Complexity vs. Efficiency
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Story Points (X) vs. Cycle Time in Days (Y)</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis type="number" dataKey="complexity" name="Complexity" unit="pts" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis type="number" dataKey="efficiency" name="Cycle Time" unit="d" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <ZAxis type="category" dataKey="name" name="Task" />
                  <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Tasks" data={complexityVsEfficiencyData} fill="hsl(var(--primary))">
                    {complexityVsEfficiencyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={ISSUE_TYPE_COLORS[entry.type] || "hsl(var(--primary))"} fillOpacity={0.6} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottleneck Analysis */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden h-[450px]">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Timer className="h-4 w-4 text-emerald-500" />
                Stage Bottleneck Analysis
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Average residence time per status column</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBottleneckData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis dataKey="status" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgDays" fill="hsl(var(--primary))" radius={[0, 10, 10, 0]} name="Avg Days" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Skill Matrix */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3rem] overflow-hidden h-[450px]">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Cpu className="h-4 w-4 text-sky-500" />
                Workload Skill Balance
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Point distribution by task tags</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={skillDistributionData}>
                  <PolarGrid stroke="hsl(var(--border))" opacity={0.2} />
                  <PolarAngleAxis dataKey="tag" tick={{ fontSize: 11, fontWeight: 900, fill: 'hsl(var(--muted-foreground))' }} />
                  <Radar
                    name="Skill Points"
                    dataKey="points"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.5}
                    strokeWidth={2}
                    animationDuration={2000}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Advanced Predictive Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Contributor Intelligence Radar */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3.5rem] overflow-hidden min-h-[500px]">
            <CardHeader className="p-10">
              <CardTitle className="text-[12px] font-black uppercase tracking-[0.4em] text-muted-foreground flex items-center gap-3">
                <Users className="h-4 w-4 text-primary" />
                Contributor Intelligence Radar
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">Multidimensional talent performance matrix</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] p-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={memberRadarData}>
                  <PolarGrid stroke="hsl(var(--border))" opacity={0.3} />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 900, fill: 'hsl(var(--foreground))' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" />
                  {memberWorkload.slice(0, 4).map((member, i) => (
                    <Radar
                      key={member.name}
                      name={member.name}
                      dataKey={member.name}
                      stroke={`hsl(var(--primary) / ${1 - (i * 0.2)})`}
                      fill={`hsl(var(--primary) / ${1 - (i * 0.2)})`}
                      fillOpacity={0.3}
                      strokeWidth={3}
                      animationDuration={2500 + (i * 300)}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Project Velocity Pulse */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.1 }}>
          <Card className="bg-card/30 backdrop-blur-2xl border-border/40 rounded-[3.5rem] overflow-hidden min-h-[500px]">
            <CardHeader className="p-10">
              <CardTitle className="text-[12px] font-black uppercase tracking-[0.4em] text-muted-foreground flex items-center gap-3">
                <Zap className="h-4 w-4 text-amber-500" />
                Project Velocity Pulse
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">Weekly delivery volume & point aggregation</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] p-10 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={projectVelocityPulse}>
                  <defs>
                    <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="points" fill="url(#colorPoints)" stroke="hsl(var(--primary))" strokeWidth={3} name="Total Points" />
                  <Bar dataKey="completed" barSize={20} fill="hsl(var(--primary)/0.2)" radius={[5, 5, 0, 0]} name="Tasks Completed" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Scope Evolution Intelligence (Full Width) */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2 }} className="lg:col-span-2">
          <Card className="bg-primary/[0.02] backdrop-blur-3xl border-primary/10 rounded-[4rem] overflow-hidden">
            <CardHeader className="p-12">
              <CardTitle className="text-[14px] font-black uppercase tracking-[0.5em] text-primary/80 flex items-center gap-4">
                <GitBranch className="h-5 w-5 animate-bounce" />
                Scope Evolution Tracking
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-[0.2em] mt-3 opacity-60">Real-time mapping of project complexity and requirement growth</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] p-12 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scopeEvolutionData}>
                  <defs>
                    <linearGradient id="colorScopePoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorScopeTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--sky-500))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(var(--sky-500))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="stepAfter" dataKey="totalPoints" stroke="hsl(var(--primary))" fill="url(#colorScopePoints)" strokeWidth={4} name="Total Complexity (Pts)" />
                  <Area type="stepAfter" dataKey="totalTasks" stroke="hsl(var(--sky-500))" fill="url(#colorScopeTasks)" strokeWidth={4} name="Total Entities (Tasks)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Strategic Intelligence Deep-Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Velocity Consistency Pulse */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <Card className="bg-card/30 backdrop-blur-3xl border-border/40 rounded-[3rem] overflow-hidden h-[400px]">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Velocity Consistency
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Historical stability index</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={velocityConsistencyData}>
                  <defs>
                    <linearGradient id="colorConsistency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.2)" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="pts" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorConsistency)" strokeWidth={3} name="Weekly Pts" />
                  <Line type="monotone" dataKey="avg" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} name="Average" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Task Aging Analysis */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}>
          <Card className="bg-card/30 backdrop-blur-3xl border-border/40 rounded-[3rem] overflow-hidden h-[400px]">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Task Aging Profile
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Days in backlog distribution</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskAgingData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {taskAgingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex items-center justify-center">
                 <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                    Target: {Math.round(taskAgingData[0]?.count / (tasks.length || 1) * 100)}% Fresh Rate
                 </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Strategic Project DNA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <Card className="bg-card/30 backdrop-blur-3xl border-border/40 rounded-[3rem] overflow-hidden h-[400px]">
            <CardHeader className="p-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                <Dna className="h-4 w-4 text-emerald-500" />
                Strategic DNA
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-widest mt-1 opacity-50">Project health balance matrix</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] p-8 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={projectDNA}>
                  <PolarGrid stroke="hsl(var(--border))" opacity={0.3} />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 900, fill: 'hsl(var(--foreground))' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Radar
                    name="Project DNA"
                    dataKey="A"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Predictive Intelligence Forecast Section */}
      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
        <div className="bg-gradient-to-br from-primary/10 via-background to-background border border-primary/20 p-12 rounded-[5rem] overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-20 opacity-5 group-hover:opacity-10 transition-opacity duration-1000">
            <Cpu className="h-64 w-64 text-primary animate-pulse" />
          </div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
            <div className="lg:col-span-1 space-y-6">
               <div className="flex items-center gap-4">
                  <div className="h-3 w-3 rounded-full bg-primary animate-ping" />
                  <span className="text-[12px] font-black uppercase tracking-[0.5em] text-primary">Strategic Forecast</span>
               </div>
               <h3 className="text-5xl font-black tracking-tighter text-foreground leading-[0.9]">
                 {t('project_management.roadmap', 'Roadmap')} <br /><span className="text-primary">{t('project_management.intelligence', 'Intelligence')}</span>
               </h3>
               <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest max-w-xs leading-relaxed">
                 Using saved tasks, due dates, story points, and time logs to project delivery health from real project activity.
               </p>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="p-8 rounded-[3rem] bg-background/40 backdrop-blur-xl border border-border/40 hover:border-primary/40 transition-all duration-500">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                       <Target className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Next Milestone</span>
                  </div>
                  <p className="text-2xl font-black text-foreground mb-2">{nextMilestoneLabel}</p>
                  <p className="text-[11px] font-black text-primary uppercase tracking-widest">ETA: {nextMilestoneEta}</p>
               </div>
               <div className="p-8 rounded-[3rem] bg-background/40 backdrop-blur-xl border border-border/40 hover:border-primary/40 transition-all duration-500">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                       <Zap className="h-6 w-6 text-amber-500" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Efficiency Trend</span>
                  </div>
                  <p className="text-2xl font-black text-foreground mb-2">{velocityTrendLabel}</p>
                  <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest">{velocityTrendDetail}</p>
               </div>
               <div className="p-8 rounded-[3rem] bg-background/40 backdrop-blur-xl border border-border/40 hover:border-primary/40 transition-all duration-500">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                       <ShieldCheck className="h-6 w-6 text-emerald-500" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Confidence Index</span>
                  </div>
                  <p className="text-2xl font-black text-foreground mb-2">{confidenceLabel}</p>
                  <p className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">Based on {tasks.length} saved tasks</p>
               </div>
               <div className="p-8 rounded-[3rem] bg-background/40 backdrop-blur-xl border border-border/40 hover:border-primary/40 transition-all duration-500">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-2xl bg-sky-500/10 flex items-center justify-center">
                       <Activity className="h-6 w-6 text-sky-500" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Risk Mitigation</span>
                  </div>
                  <p className="text-2xl font-black text-foreground mb-2">{riskMitigationLabel}</p>
                  <p className="text-[11px] font-black text-sky-500 uppercase tracking-widest">{riskSignalCount} stale or critical tasks</p>
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
