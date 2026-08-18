"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerformanceDashboard } from "@/modules/performance/types";
import { PerformanceTable, Score } from "@/modules/performance/pages/components/performance-shell";

const chartColors = { primary: "hsl(var(--chart-1))", secondary: "hsl(var(--chart-2))", warning: "hsl(var(--chart-3))" };

export function PerformanceCharts({ data }: { data: PerformanceDashboard }) {
  const datasets = data.datasets;
  return <section aria-label="Performance analytics" className="grid min-w-0 gap-6 xl:grid-cols-2">
    <ChartCard title="Review pipeline" description="Reviews by current workflow stage; use this to find hand-off bottlenecks." label="Bar chart of performance reviews grouped by workflow status. A detailed data table follows.">
      <ResponsiveContainer width="100%" height={280}><BarChart data={datasets.review_status} accessibilityLayer margin={{ top: 12, right: 12, left: 0 }}><CartesianGrid vertical={false} strokeDasharray="4 4" /><XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} /><Tooltip /><Bar dataKey="value" name="Reviews" fill={chartColors.primary} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
      <PerformanceTable caption="Review count by workflow status." rows={datasets.review_status} getKey={(row) => row.status} columns={[{ key: "status", label: "Review status", render: (row) => row.label }, { key: "value", label: "Reviews", align: "right", render: (row) => row.value }]} />
    </ChartCard>
    <ChartCard title="Score distribution" description="Completed review outcomes grouped into the configured performance bands." label="Bar chart showing completed review scores by rating band. A detailed data table follows.">
      <ResponsiveContainer width="100%" height={280}><BarChart data={datasets.score_distribution} accessibilityLayer margin={{ top: 12, right: 12, left: 0 }}><CartesianGrid vertical={false} strokeDasharray="4 4" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} /><Tooltip /><Bar dataKey="value" name="Employees" fill={chartColors.secondary} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
      <PerformanceTable caption="Completed employee reviews in each score band." rows={datasets.score_distribution} getKey={(row) => row.key} columns={[{ key: "band", label: "Score band", render: (row) => row.label }, { key: "value", label: "Employees", align: "right", render: (row) => row.value }]} />
    </ChartCard>
    <ChartCard title="Check-in rhythm" description="Planned and completed conversations over the most recent six months." label="Line chart comparing planned and completed performance check-ins by month. A detailed data table follows.">
      <ResponsiveContainer width="100%" height={280}><LineChart data={datasets.checkin_trend} accessibilityLayer margin={{ top: 12, right: 12, left: 0 }}><CartesianGrid vertical={false} strokeDasharray="4 4" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} /><Tooltip /><Legend /><Line type="monotone" dataKey="completed" name="Completed" stroke={chartColors.primary} strokeWidth={3} dot={{ r: 3 }} /><Line type="monotone" dataKey="planned" name="Planned" stroke={chartColors.warning} strokeWidth={3} strokeDasharray="7 4" dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
      <PerformanceTable caption="Planned and completed check-ins by month." rows={datasets.checkin_trend} getKey={(row) => row.period} columns={[{ key: "month", label: "Month", render: (row) => row.label }, { key: "planned", label: "Planned", align: "right", render: (row) => row.planned }, { key: "completed", label: "Completed", align: "right", render: (row) => row.completed }]} />
    </ChartCard>
    <ChartCard title="Team performance" description="Latest average review outcomes for the visible employee scope." label="Bar chart comparing average performance scores for visible employees. A detailed data table follows.">
      <ResponsiveContainer width="100%" height={280}><BarChart data={datasets.team_scores} layout="vertical" accessibilityLayer margin={{ top: 12, right: 16, left: 10 }}><CartesianGrid horizontal={false} strokeDasharray="4 4" /><XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="employee" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="score" name="Average score" fill={chartColors.primary} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer>
      <PerformanceTable caption="Average completed review score by employee." rows={datasets.team_scores} getKey={(row) => row.employee_id} columns={[{ key: "employee", label: "Employee", render: (row) => row.employee }, { key: "reviews", label: "Reviews", align: "right", render: (row) => row.reviews }, { key: "score", label: "Average score", align: "right", render: (row) => <Score value={row.score} /> }]} />
    </ChartCard>
  </section>;
}

function ChartCard({ title, description, label, children }: { title: string; description: string; label: string; children: React.ReactNode }) { return <Card><CardHeader><CardTitle><h2>{title}</h2></CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-4"><div role="img" aria-label={label} className="h-[280px] w-full">{Array.isArray(children) ? children[0] : children}</div><details><summary className="cursor-pointer rounded-md py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">View detailed dataset</summary><div className="pt-2">{Array.isArray(children) ? children[1] : null}</div></details></CardContent></Card>; }

