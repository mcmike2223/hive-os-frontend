"use client";

import React, { useMemo, useState } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  AlertCircle,
  Settings,
  Activity,
  ShieldCheck,
  Target,
  Zap,
  TrendingDown,
  LineChart as LineChartIcon,
  Layers,
  Sparkles
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Line,
  ComposedChart
} from "recharts";

import { projectApi } from "../api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/store/use-translation";

interface FinancialReportViewProps {
  projectId: string;
  onConfigureBudget?: () => void;
}

type Scenario = "Standard" | "Aggressive" | "Lean" | "Optimal";

export function FinancialReportView({ projectId, onConfigureBudget }: FinancialReportViewProps) {
  const { t } = useTranslation();
  const [selectedScenario, setSelectedScenario] = useState<Scenario>("Standard");

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["project-financials", projectId],
    queryFn: () => projectApi.getFinancialReport(projectId),
    retry: 1,
  });

  const budget = report?.budget || 0;
  const totalCosts = report?.total_costs || 0;
  const estimatedRevenue = report?.estimated_revenue || 0;
  const budgetUsedPercent = budget > 0 ? (totalCosts / budget) * 100 : 0;
  const isOverBudget = budgetUsedPercent > 100;

const cumulativeData = useMemo(() => {
    if (!report?.weekly_trend?.length) return [];

    let sum = 0;
    const history = report.weekly_trend.map((d: any) => {
      sum += d.cost;
      return { 
        week: d.week, 
        actual: sum, 
        budget: report.budget || 0,
        type: 'history' 
      };
    });

    const projectionsList = report.projections;
    if (!projectionsList?.length) return history;

    const scenarioMultiplier = 
      selectedScenario === "Aggressive" ? 1.4 : 
      selectedScenario === "Lean" ? 0.7 : 
      selectedScenario === "Optimal" ? 1.1 : 1;

    let lastSum = sum;
    const projections = projectionsList.map((p: any, i: number) => {
      const prevForecasted = i === 0 ? sum : projectionsList[i-1].forecasted_cost;
      const incrementalCost = (p.forecasted_cost - prevForecasted) * scenarioMultiplier;
      lastSum += incrementalCost;
      return {
        week: p.week,
        forecast: lastSum,
        budget: report.budget || 0,
        type: 'projection'
      };
    });

    // Merge history and projections - guard against empty history
    const lastHistoryPoint = history.length > 0 ? history[history.length - 1] : { actual: 0 };
    return [...history, { ...lastHistoryPoint, forecast: lastHistoryPoint.actual }, ...projections];
  }, [report, selectedScenario]);

  const profitabilityData = useMemo(() => {
    const weeklyTrend = report?.weekly_trend;
    if (!weeklyTrend) return [];
    
    // Calculate "Earned Revenue" trend based on progress
    const progressPerWeek = (report.progress_percent || 0) / weeklyTrend.length;
    let cumulativeProgress = 0;

    return weeklyTrend.map((d: any) => {
      cumulativeProgress += progressPerWeek;
      const earnedRevenue = (estimatedRevenue * (cumulativeProgress / 100));
      return {
        week: d.week,
        cost: d.cost,
        revenue: earnedRevenue / weeklyTrend.length, // Distributed roughly
        margin: report.profitability
      };
    });
  }, [report, estimatedRevenue]);

  const radarData = useMemo(() => {
    if (!report) return [];
    
    const bugCost = report.issue_type_breakdown?.find((item: any) => item.type === 'Bug')?.cost || 0;
    const qualityScore = Math.max(0, 100 - (bugCost / (report.total_costs || 1) * 100));
    
    // Efficiency: cost vs progress
    const efficiencyScore = report.progress_percent > 0 
      ? Math.min(100, (report.progress_percent / Math.max(1, budgetUsedPercent)) * 100)
      : 100 - budgetUsedPercent;
    
    const base = [
      { subject: 'Velocity', A: report.total_hours > 0 ? 85 : 0, fullMark: 100 },
      { subject: 'Efficiency', A: Math.round(efficiencyScore), fullMark: 100 },
      { subject: 'Quality', A: Math.round(qualityScore), fullMark: 100 },
      { subject: 'ROI Yield', A: Math.min(100, report.roi || 0), fullMark: 100 },
      { subject: 'Economy', A: Math.max(0, 100 - Math.round(budgetUsedPercent)), fullMark: 100 },
    ];
    
    return base;
  }, [report, budgetUsedPercent]);

  const roiData = useMemo(() => {
    const weeklyTrend = report?.weekly_trend;
    if (!weeklyTrend) return [];
    let cumulativeCost = 0;
    const progressPercent = report.progress_percent;
    const roiVal = report.roi;
    return weeklyTrend.map((d: any) => {
      cumulativeCost += d.cost;
      const currentROI = cumulativeCost > 0 ? ((estimatedRevenue * (progressPercent / 100) - cumulativeCost) / cumulativeCost) * 100 : 0;
      return {
        week: d.week,
        roi: Math.max(0, currentROI),
        yield: roiVal
      };
    });
  }, [report, estimatedRevenue]);

  const riskData = useMemo(() => {
    if (!report) return [];
    const resourceRisk = report.member_breakdown?.some((m: any) => (m.cost / (report.total_costs || 1)) > 0.6) ? 75 : 25;
    const timelineRisk = (budgetUsedPercent > (report.progress_percent + 10)) ? 80 : 30;

    return [
      { category: 'Burn Rate', risk: report.risk_score, color: '#ef4444' },
      { category: 'Budget', risk: Math.min(100, Math.round(budgetUsedPercent)), color: '#f59e0b' },
      { category: 'Resource', risk: resourceRisk, color: '#3b82f6' },
      { category: 'Timeline', risk: timelineRisk, color: '#8b5cf6' },
    ];
  }, [report, budgetUsedPercent]);

  const burnRateData = useMemo(() => {
    if (!report?.issue_type_breakdown) return [];
    return report.issue_type_breakdown.map((item: any) => ({
      name: item.type,
      cost: item.cost,
    }));
  }, [report]);

  const runwayDays = useMemo(() => {
    if (!report || report.remaining_budget <= 0) return 0;
    const weeklyTrend = report.weekly_trend;
    const weeklyVelocity = weeklyTrend && weeklyTrend.length > 0 
      ? report.total_costs / weeklyTrend.length 
      : report.hourly_rate * 40; // Default to 40h/week if no trend
    
    if (weeklyVelocity <= 0) return 365; // Basically forever

    const multiplier = 
      selectedScenario === "Aggressive" ? 1.4 : 
      selectedScenario === "Lean" ? 0.7 : 
      selectedScenario === "Optimal" ? 1.1 : 1;

    const weeksLeft = report.remaining_budget / (weeklyVelocity * multiplier);
    return Math.round(weeksLeft * 7);
  }, [report, selectedScenario]);

  if (isLoading) return <FinancialReportLoading />;
  
  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-[2rem] border border-dashed border-destructive/20 h-full">
        <div className="p-4 rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-bold mb-2">Financial Data Unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          We couldn't retrieve the financial report for this project. Please ensure the project has budget settings configured.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>Retry Connection</Button>
          {onConfigureBudget && (
            <Button className="rounded-xl px-6 bg-primary shadow-lg shadow-primary/20" onClick={onConfigureBudget}>
              Configure Budget
            </Button>
          )}
        </div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6 h-full overflow-y-auto pr-2 custom-scrollbar pb-10"
    >
      {/* SVG Gradients & Patterns */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
          </linearGradient>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.2}/>
          </linearGradient>
          <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1"/>
          </pattern>
        </defs>
      </svg>

      {/* Enterprise Header with Scenario Switcher */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-center justify-between bg-card p-6 rounded-[2rem] border border-border/40 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl transition-opacity group-hover:opacity-100 opacity-50" />
        <div className="relative z-10 mb-4 lg:mb-0">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            {t('project_management.financial_intelligence', 'Financial Intelligence')}
            <Badge variant="secondary" className="bg-primary/10 text-primary text-[11px] uppercase tracking-widest px-2">{t('project_management.enterprise_v2', 'ENTERPRISE v2.0')}</Badge>
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-1 uppercase tracking-wider opacity-70 flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-primary" />
            {t('project_management.predictive_ai_active', 'Predictive AI Engine Active')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <div className="flex bg-muted/50 p-1 rounded-xl border border-border/40">
            {(["Standard", "Aggressive", "Lean", "Optimal"] as Scenario[]).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedScenario(s)}
                className={cn(
                  "px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all",
                  selectedScenario === s 
                    ? "bg-card text-primary shadow-sm border border-border/40" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('project_management.' + (s === 'Optimal' ? 'optimal_status' : s.toLowerCase()), s)}
              </button>
            ))}
          </div>
          <div className="h-8 w-[1px] bg-border/40 mx-1 hidden lg:block" />
          {onConfigureBudget && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 px-4 gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all" 
              onClick={onConfigureBudget}
            >
              <Settings className="h-3.5 w-3.5" />
              {t('project_management.configure', 'Configure')}
            </Button>
          )}
          <Badge 
            className={cn(
              "h-9 px-5 text-xs font-black uppercase tracking-widest rounded-xl border-none",
              isOverBudget 
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" 
                : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
            )}
          >
            {isOverBudget ? t('project_management.critical_status', 'Critical') : t('project_management.stable_status', 'Stable')}
          </Badge>
        </div>
      </motion.div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title={t('project_management.total_accrued', 'Total Accrued')} 
          value={`${report.currency} ${(report.total_costs || 0).toLocaleString()}`} 
          subValue={`${report.total_hours || 0} Total Hours`}
          icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
          delay={0.1}
        />
        <StatsCard 
          title={t('project_management.net_available', 'Net Available')} 
          value={`${report.currency} ${(report.remaining_budget || 0).toLocaleString()}`} 
          subValue={`${Math.max(0, Math.round(100 - budgetUsedPercent))}% of Total`}
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          trend={isOverBudget ? "down" : "up"}
          delay={0.2}
        />
        <StatsCard 
          title={t('project_management.project_velocity_title', 'Project Velocity')} 
          value={`${report.currency} ${report.hourly_rate || 0}`} 
          subValue="Current Hourly Baseline"
          icon={<Activity className="h-5 w-5 text-amber-500" />}
          delay={0.3}
        />
        <StatsCard 
          title={t('project_management.roi_estimate', 'ROI Estimate')} 
          value={`${(report.roi || 0).toFixed(1)}%`} 
          subValue="Projected Yield"
          icon={<Zap className="h-5 w-5 text-violet-500" />}
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forecast Analysis - UPGRADED SCENARIO */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <LineChartIcon className="h-4 w-4 text-primary" />
                    {t('project_management.budget_forecasting', 'Budget Forecasting')}
                  </CardTitle>
                  <CardDescription className="text-xs">Predictive trajectory based on {selectedScenario} scenario.</CardDescription>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 rounded-lg border border-primary/10">
                  <Activity className="h-3 w-3 text-primary animate-pulse" />
                  <span className="text-[11px] font-black text-primary uppercase tracking-tighter">AI ENGINE ACTIVE</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.05} />
                    <XAxis 
                      dataKey="week" 
                      fontSize={11} 
                      fontWeight={900}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--foreground))', opacity: 0.9 }}
                      className="text-foreground"
                      dy={10}
                    />
                    <YAxis 
                      fontSize={11} 
                      fontWeight={900}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--foreground))', opacity: 0.9 }}
                      className="text-foreground"
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        backdropFilter: 'blur(24px)',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '16px', 
                        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
                        fontSize: '12px',
                        fontWeight: '800',
                        color: 'hsl(var(--foreground))',
                        border: '1px solid hsl(var(--border))'
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px', fontWeight: '900' }}
                    />
                    {/* Budget Line */}
                    <Line 
                      type="stepAfter" 
                      dataKey="budget" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={1} 
                      strokeDasharray="5 5" 
                      dot={false}
                    />
                    {/* Actual Area */}
                    <Area 
                      type="monotone" 
                      dataKey="actual" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={4}
                      fill="url(#areaGradient)" 
                      animationDuration={1500}
                    />
                    {/* Forecast Area */}
                    <Area 
                      type="monotone" 
                      dataKey="forecast" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      fill="url(#forecastGradient)" 
                      animationDuration={2000}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex-1 p-4 rounded-2xl bg-muted/30 border border-border/40">
                  <p className="text-[11px] font-black uppercase text-muted-foreground mb-1">Estimated Exhaustion</p>
                  <p className="text-lg font-black text-rose-500">
                    ~{(runwayDays / 7).toFixed(1)} Weeks
                  </p>
                </div>
                <div className="flex-1 p-4 rounded-2xl bg-muted/30 border border-border/40">
                  <p className="text-[11px] font-black uppercase text-muted-foreground mb-1">Burn Rate Confidence</p>
                  <p className="text-lg font-black text-primary">{Math.min(99.9, 100 - (report.risk_score * 0.5)).toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Profitability Index - NEW CHART */}
        <motion.div variants={itemVariants}>
          <Card className="h-full rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                {t('project_management.profitability_index', 'Profitability Index')}
              </CardTitle>
              <CardDescription className="text-xs">Weekly gross margin vs. operational cost.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitabilityData}>
                    <XAxis dataKey="week" hide />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--primary)/0.05)' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        backdropFilter: 'blur(24px)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '800',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))'
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '2px', fontWeight: '900' }}
                    />
                    <Bar dataKey="cost" fill="url(#barGradient)" radius={[6, 6, 0, 0]} stackId="a" />
                    <Bar dataKey="revenue" fill="url(#revenueGradient)" radius={[6, 6, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-muted-foreground">Cumulative Margin</span>
                  <span className={cn(report.profitability >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {report.profitability >= 0 ? "+" : ""}{report.profitability}%
                  </span>
                </div>
                <Progress value={Math.max(0, Math.min(100, report.profitability))} className={cn("h-1.5", report.profitability >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10")} />
                <p className="text-[11px] text-muted-foreground leading-tight italic">
                  Projected revenue of {report.currency} {estimatedRevenue.toLocaleString()} {report.profitability >= 20 ? "shows strong profitability" : "requires careful cost management"} for the given scope.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ROI Yield Curve - NEW */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-500" />
                {t('project_management.projected_roi_yield', 'Projected ROI Yield')}
              </CardTitle>
              <CardDescription className="text-xs">Cumulative value generation over time.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={roiData}>
                    <defs>
                      <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
                    <XAxis dataKey="week" hide />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        backdropFilter: 'blur(24px)',
                        borderRadius: '16px',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px', fontWeight: '900' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="roi" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      fill="url(#roiGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 flex justify-between items-center bg-muted/30 p-4 rounded-2xl border border-border/40">
                <div>
                  <p className="text-[11px] font-black uppercase text-muted-foreground mb-1">Total Expected ROI</p>
                  <p className="text-xl font-black text-primary">
                    {report.currency} {(roiData[roiData.length-1]?.roi || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-black uppercase text-muted-foreground mb-1">Yield Factor</p>
                  <p className="text-xl font-black text-emerald-500">
                    {(roiData[roiData.length-1]?.yield || 0).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Risk Assessment Matrix - NEW */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-rose-500" />
                {t('project_management.risk_intelligence_matrix', 'Risk Intelligence Matrix')}
              </CardTitle>
              <CardDescription className="text-xs">Financial vulnerability scoring by category.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                {riskData.map((risk: any, idx: number) => (
                  <div key={risk.category} className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                      <span className="text-foreground">{risk.category}</span>
                      <span style={{ color: risk.color }} className="drop-shadow-md">{risk.risk}% Risk</span>
                    </div>
                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${risk.risk}%` }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: risk.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-bold text-rose-500 uppercase mr-1">Financial Status:</span> 
                  {report.risk_score > 70 
                    ? `Critical risk detected. High burn rate and timeline pressure in ${selectedScenario} mode.`
                    : report.risk_score > 40
                    ? `Moderate risk alert. Monitoring ${selectedScenario} trajectory for potential budget overrun.`
                    : `Financial health is stable. ${selectedScenario} scenario is tracking within acceptable limits.`
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Member Breakdown */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest">{t('project_management.resource_costing', 'Resource Costing')}</CardTitle>
              <CardDescription className="text-xs">Individual contribution and expense ratio.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[220px] w-full mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report.member_breakdown || []}
                      innerRadius={70}
                      outerRadius={95}
                      paddingAngle={8}
                      dataKey="cost"
                      animationBegin={200}
                    >
                      {(report.member_breakdown || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        backdropFilter: 'blur(24px)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '800',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))'
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '2px', fontWeight: '900' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-4 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                {(report.member_breakdown || []).map((member: any, index: number) => (
                  <div key={member.id} className="flex items-center justify-between group py-1">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs font-black group-hover:text-primary transition-colors text-foreground/90">{member.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black">{report.currency} {(member.cost || 0).toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">{member.hours || 0}h logged</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Priority Matrix */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card overflow-hidden h-full">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest">{t('project_management.intelligence_matrix', 'Intelligence Matrix')}</CardTitle>
              <CardDescription className="text-xs">Balanced project performance across core metrics.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 flex items-center justify-center">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" opacity={0.3} />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 900, opacity: 0.9 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} hide />
                    <Radar
                      name="Performance"
                      dataKey="A"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.4}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        backdropFilter: 'blur(24px)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        fontWeight: '800'
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '2px', fontWeight: '900' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        {/* Burn Rate by Category - NEW */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                {t('project_management.burn_rate_distribution', 'Burn Rate Distribution')}
              </CardTitle>
              <CardDescription className="text-xs">Operational cost breakdown by department.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={burnRateData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
                    <XAxis 
                      dataKey="name" 
                      fontSize={10} 
                      fontWeight={900} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--foreground))', opacity: 0.8 }} 
                    />
                    <YAxis 
                      fontSize={10} 
                      fontWeight={900} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--foreground))', opacity: 0.8 }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--primary)/0.03)' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        backdropFilter: 'blur(24px)',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: '800',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))'
                      }}
                    />
                    {burnRateData.map((item: any, index: number) => (
                      <Bar 
                        key={item.name} 
                        dataKey="cost" 
                        name={item.name}
                        stackId="a" 
                        fill={COLORS[index % COLORS.length]} 
                        radius={index === burnRateData.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Projected Runway - NEW */}
        <motion.div variants={itemVariants}>
          <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card overflow-hidden relative h-full flex flex-col">
            <div className="absolute top-0 right-0 p-8">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest">{t('project_management.project_runway', 'Project Runway')}</CardTitle>
              <CardDescription className="text-xs">Predicted budget depletion timeline.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 flex-1 flex flex-col justify-center">
              <div className="space-y-8">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-5xl font-black text-foreground mb-2">
                      {runwayDays}
                      <span className="text-xl text-muted-foreground ml-2 font-black">DAYS</span>
                    </p>
                    <Badge variant="outline" className={cn(
                      "font-black uppercase tracking-tighter",
                      runwayDays > 30 ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/5" : "border-rose-500/20 text-rose-500 bg-rose-500/5"
                    )}>
                      {runwayDays > 30 ? "STABLE RUNWAY" : "CRITICAL RUNWAY"}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">Burn Velocity</p>
                    <p className="text-xl font-black text-primary">
                      {report.currency} {Math.round(totalCosts / (report.weekly_trend?.length || 1)).toLocaleString()}/wk
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                    <span className="text-muted-foreground">Exhaustion Probability</span>
                    <span className="text-foreground">{Math.round(report.risk_score * 0.8)}% at Week 4</span>
                  </div>
                  <div className="h-3 w-full bg-muted/50 rounded-full overflow-hidden p-0.5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(report.risk_score * 0.8)}%` }}
                      className="h-full bg-gradient-to-right from-emerald-500 to-primary rounded-full"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-[11px] font-bold text-foreground leading-snug">
                      AI RECOMMENDATION: {report.risk_score > 60 
                        ? `Transition to LEAN scenario to extend runway by ${Math.round(runwayDays * 0.4)} days and mitigate overspending.`
                        : `Current velocity is stable. Maintaining OPTIMAL scenario will maximize ROI yield for the next milestone.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatsCard({ 
  title, 
  value, 
  subValue, 
  icon, 
  trend, 
  delay = 0 
}: { 
  title: string, 
  value: string, 
  subValue: string, 
  icon: React.ReactNode, 
  trend?: 'up' | 'down',
  delay?: number
}) {
  return (
    <motion.div
      variants={{
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { delay } }
      }}
    >
      <Card className="bg-card/40 backdrop-blur-md border-border/40 shadow-lg shadow-black/5 rounded-[1.5rem] hover:scale-[1.02] transition-all duration-300 overflow-hidden relative group h-full">
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/[0.05] transition-colors" />
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="p-2.5 bg-muted/50 rounded-2xl border border-border/40 shadow-inner group-hover:bg-primary/10 transition-colors">
              {icon}
            </div>
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full shadow-sm",
                trend === 'up' ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10"
              )}>
                {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {trend === 'up' ? "OPTIMAL" : "STABLE"}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">{title}</p>
            <p className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground font-bold opacity-70">{subValue}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FinancialReportLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center bg-muted/20 p-6 rounded-[2rem] border border-border/40">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="bg-card border-border/40 rounded-[1.5rem] p-6 h-40">
            <Skeleton className="h-10 w-10 rounded-2xl mb-4" />
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="h-[400px] lg:col-span-2 rounded-[2rem] p-8">
           <Skeleton className="h-6 w-32 mb-8" />
           <Skeleton className="h-[250px] w-full rounded-2xl" />
        </Card>
        <Card className="h-[400px] rounded-[2rem] p-8">
           <Skeleton className="h-6 w-32 mb-8" />
           <Skeleton className="h-[200px] w-full rounded-full" />
        </Card>
      </div>
    </div>
  );
}

