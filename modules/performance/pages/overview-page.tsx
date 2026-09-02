"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { performanceApi } from "@/modules/performance/api";
import type { Goal, PerformanceReview } from "@/modules/performance/types";
import { PerformanceCharts } from "@/modules/performance/pages/components/performance-charts";
import { MetricCard, PerformanceError, PerformanceLoading, PerformanceShell, PerformanceStatus, PerformanceTable, Score } from "@/modules/performance/pages/components/performance-shell";

export default function PerformanceOverviewPage() {
  const query = useQuery({ queryKey: ["performance", "dashboard"], queryFn: performanceApi.dashboard });
  return <PerformanceShell title="Performance command center" description="Connect employee goals, manager conversations, fair evaluations, calibration, and growth decisions in one measurable operating rhythm." actions={<Button asChild><Link href="/dashboard/performance/reviews">Open reviews<ArrowRight aria-hidden="true" data-icon="inline-end" /></Link></Button>}>
    {query.isLoading ? <PerformanceLoading /> : query.error || !query.data ? <PerformanceError error={query.error} /> : <Dashboard data={query.data} />}
  </PerformanceShell>;
}

function Dashboard({ data }: { data: Awaited<ReturnType<typeof performanceApi.dashboard>> }) {
  const attention = data.metrics.reviews_overdue + data.metrics.goals_at_risk + data.metrics.feedback_pending;
  return <>
    <Alert variant={attention ? "default" : "default"}>{attention ? <CircleAlert aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}<AlertTitle>{attention ? `${attention} item${attention === 1 ? "" : "s"} need attention` : "Performance cycle is on track"}</AlertTitle><AlertDescription>{data.metrics.reviews_overdue} overdue reviews, {data.metrics.goals_at_risk} at-risk goals, and {data.metrics.feedback_pending} pending feedback request(s). Attendance is displayed as supporting evidence only and never changes a performance score automatically.</AlertDescription></Alert>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="Review completion" value={`${data.metrics.completion_rate.toFixed(1)}%`} description={`${data.metrics.reviews_completed} of ${data.metrics.reviews_total} visible reviews complete.`} /><Link href="/dashboard/performance/reports" className="block"><MetricCard title="Average score" value={<Score value={data.metrics.average_score} />} description="Average across completed reviews in your scope." /></Link><Link href="/dashboard/performance/goals" className="block"><MetricCard title="Goal progress" value={`${data.metrics.average_goal_progress.toFixed(1)}%`} description={`${data.metrics.goals_total} goal(s), ${data.metrics.goals_at_risk} need intervention.`} status={data.metrics.goals_at_risk ? "at_risk" : "on_track"} /></Link><Link href="/dashboard/performance/cycles?status=active" className="block"><MetricCard title="Active cycles" value={data.metrics.active_cycles} description="Cycles currently active or in calibration." /></Link></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Link href="/dashboard/performance/reviews?overdue=1" className="block"><MetricCard title="Overdue reviews" value={data.metrics.reviews_overdue} description="Reviews past their due date and not completed." status={data.metrics.reviews_overdue ? "overdue" : "clear"} /></Link><Link href="/dashboard/performance/development?section=feedback&status=requested" className="block"><MetricCard title="Pending feedback" value={data.metrics.feedback_pending} description="Requested feedback awaiting a response." status={data.metrics.feedback_pending ? "requested" : "clear"} /></Link><Link href="/dashboard/performance/development?section=plans&status=active" className="block"><MetricCard title="Improvement plans" value={data.metrics.active_improvement_plans} description="Active, time-bound employee support plans." status="active" /></Link></div>
    <PerformanceCharts data={data} />
    <section aria-label="Recent performance activity" className="grid min-w-0 gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle><h2>Recent reviews</h2></CardTitle><CardDescription>Latest employee and manager review activity.</CardDescription></CardHeader><CardContent><PerformanceTable<PerformanceReview> caption="Recently updated performance reviews." rows={data.recent_reviews} getKey={(row) => row.id} columns={[{ key: "employee", label: "Employee", render: (row) => <Link href={`/dashboard/performance/reviews?review_id=${row.id}`} className="hover:underline">{row.employee?.primary_name ?? `Employee ${row.employee_id}`}</Link> }, { key: "cycle", label: "Cycle", render: (row) => row.cycle?.name ?? "—" }, { key: "status", label: "Status", render: (row) => <PerformanceStatus value={row.status} /> }, { key: "score", label: "Score", align: "right", render: (row) => <Score value={row.overall_score} /> }]} /></CardContent></Card><Card><CardHeader><CardTitle><h2>Priority goals</h2></CardTitle><CardDescription>Blocked, at-risk, and lower-progress commitments appear first.</CardDescription></CardHeader><CardContent><PerformanceTable<Goal> caption="Priority performance goals ordered by risk and progress." rows={data.priority_goals} getKey={(row) => row.id} columns={[{ key: "goal", label: "Goal", render: (row) => <Link href={`/dashboard/performance/goals?goal_id=${row.id}`} className="block hover:underline"><span className="font-medium">{row.title}</span><p className="text-xs text-muted-foreground">{row.employee?.primary_name ?? "Employee goal"}</p></Link> }, { key: "status", label: "Status", render: (row) => <PerformanceStatus value={row.status} /> }, { key: "progress", label: "Progress", align: "right", render: (row) => `${Number(row.progress_percent).toFixed(0)}%` }]} /></CardContent></Card></section>
  </>;
}

