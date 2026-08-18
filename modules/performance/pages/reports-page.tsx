"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { performanceApi } from "@/modules/performance/api";
import { PerformanceCharts } from "@/modules/performance/pages/components/performance-charts";
import { BusyLabel, MetricCard, PerformanceError, PerformanceLoading, PerformanceShell, Score } from "@/modules/performance/pages/components/performance-shell";

export default function PerformanceReportsPage() { const [exporting, setExporting] = useState(false); const query = useQuery({ queryKey: ["performance", "reports"], queryFn: performanceApi.report }); async function exportCsv() { setExporting(true); try { const blob = await performanceApi.exportReport(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `performance-reviews-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); toast.success("Performance report exported."); } catch { toast.error("Performance report could not be exported."); } finally { setExporting(false); } } return <PerformanceShell title="Performance reports" description="Review completion, outcome distribution, goal health, check-in rhythm, and employee-level results with an auditable CSV export." actions={<Button type="button" onClick={exportCsv} disabled={exporting}><Download aria-hidden="true" data-icon="inline-start" /><BusyLabel busy={exporting}>Export reviews CSV</BusyLabel></Button>}>
  {query.isLoading ? <PerformanceLoading /> : query.error || !query.data ? <PerformanceError error={query.error} /> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="Completed reviews" value={query.data.metrics.reviews_completed} description={`${query.data.metrics.completion_rate.toFixed(1)}% completion rate.`} /><MetricCard title="Organization average" value={<Score value={query.data.metrics.average_score} />} description="Average of completed review outcomes." /><MetricCard title="Average goal progress" value={`${query.data.metrics.average_goal_progress.toFixed(1)}%`} description={`${query.data.metrics.goals_total} goals included.`} /><MetricCard title="Active support plans" value={query.data.metrics.active_improvement_plans} description="Active employee improvement plans." /></div><PerformanceCharts data={query.data} /></>}
  </PerformanceShell>; }

