"use client";

import React, { useMemo, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  format,
  isAfter,
  isBefore,
  isValid,
  startOfDay,
} from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Filter,
  Flag,
  Layers3,
  Search,
  TimerReset,
  UserRound,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project, Task, TaskPriority } from "../types";

interface ProjectGanttChartProps {
  project: Project;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

type GroupMode = "status" | "assignee" | "priority";
type StatusFilter = "all" | "scheduled" | "unscheduled" | "overdue" | "completed";
type ZoomLevel = "compact" | "comfortable" | "wide";

type TimelineTask = Task & {
  inferred_start: Date | null;
  inferred_end: Date | null;
  durationDays: number;
  isDone: boolean;
  isOverdue: boolean;
  isUnscheduled: boolean;
  health: "complete" | "overdue" | "at-risk" | "scheduled" | "unscheduled";
  parent_task_id?: string | null;
};

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-emerald-500",
  medium: "bg-sky-500",
  high: "bg-amber-500",
  urgent: "bg-rose-500",
};

const healthColors: Record<TimelineTask["health"], string> = {
  complete: "border-emerald-200 bg-emerald-50 text-emerald-700",
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
  "at-risk": "border-amber-200 bg-amber-50 text-amber-700",
  scheduled: "border-sky-200 bg-sky-50 text-sky-700",
  unscheduled: "border-slate-200 bg-slate-50 text-slate-700",
};

const zoomConfig: Record<ZoomLevel, { dayWidth: number; rowHeight: number; label: string }> = {
  compact: { dayWidth: 28, rowHeight: 56, label: "Compact" },
  comfortable: { dayWidth: 42, rowHeight: 68, label: "Comfortable" },
  wide: { dayWidth: 64, rowHeight: 78, label: "Wide" },
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? startOfDay(date) : null;
}

function initials(name?: string | null) {
  return (name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isTaskDone(task: Task) {
  return task.column?.name?.toLowerCase() === "done";
}

function inferDuration(priority: TaskPriority) {
  if (priority === "urgent") return 2;
  if (priority === "high") return 4;
  if (priority === "medium") return 5;
  return 7;
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export const ProjectGanttChart: React.FC<ProjectGanttChartProps> = ({ project, tasks, onTaskClick }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("status");
  const [zoom, setZoom] = useState<ZoomLevel>("comfortable");

  const today = startOfDay(new Date());
  const projectStart = parseDate(project.start_date);
  const projectEnd = parseDate(project.end_date);

  const timelineTasks = useMemo<TimelineTask[]>(() => {
    return tasks.map((task) => {
      const dueDate = parseDate(task.due_date);
      const durationDays = inferDuration(task.priority);
      const startDate = dueDate ? addDays(dueDate, -durationDays) : null;
      const done = isTaskDone(task);
      const overdue = !!dueDate && isBefore(dueDate, today) && !done;
      const atRisk = !!dueDate && !done && !overdue && differenceInCalendarDays(dueDate, today) <= 3;

      return {
        ...task,
        inferred_start: startDate,
        inferred_end: dueDate,
        durationDays,
        isDone: done,
        isOverdue: overdue,
        isUnscheduled: !dueDate,
        health: done ? "complete" : overdue ? "overdue" : atRisk ? "at-risk" : dueDate ? "scheduled" : "unscheduled",
        parent_task_id: task.parent_task_id,
      };
    });
  }, [tasks, today]);

  const scheduledTasks = timelineTasks.filter((task) => task.inferred_start && task.inferred_end);
  const earliestTaskDate = scheduledTasks.reduce<Date | null>((earliest, task) => {
    if (!task.inferred_start) return earliest;
    return !earliest || isBefore(task.inferred_start, earliest) ? task.inferred_start : earliest;
  }, null);
  const latestTaskDate = scheduledTasks.reduce<Date | null>((latest, task) => {
    if (!task.inferred_end) return latest;
    return !latest || isAfter(task.inferred_end, latest) ? task.inferred_end : latest;
  }, null);

  const rangeStart = projectStart || earliestTaskDate || today;
  const rangeEnd = projectEnd || latestTaskDate || addDays(rangeStart, 30);
  const paddedStart = addDays(rangeStart, -2);
  const paddedEnd = addDays(rangeEnd, 2);
  const totalDays = Math.max(differenceInCalendarDays(paddedEnd, paddedStart), 1);
  const days = eachDayOfInterval({ start: paddedStart, end: paddedEnd });
  const months = eachMonthOfInterval({ start: paddedStart, end: paddedEnd });
  const chartWidth = Math.max(days.length * zoomConfig[zoom].dayWidth, 720);
  const todayOffset = differenceInCalendarDays(today, paddedStart);
  const todayLeft = (todayOffset / totalDays) * chartWidth;

  const filteredTasks = timelineTasks.filter((task) => {
    const assigneeNames = (task.assignees ?? []).map((a) => a.name).join(" ");
    const matchesSearch = `${task.title} ${task.description || ""} ${assigneeNames} ${task.column?.name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "scheduled" && !task.isUnscheduled) ||
      (statusFilter === "unscheduled" && task.isUnscheduled) ||
      (statusFilter === "overdue" && task.isOverdue) ||
      (statusFilter === "completed" && task.isDone);

    return matchesSearch && matchesPriority && matchesStatus;
  });

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, TimelineTask[]>();
    for (const task of filteredTasks) {
      const key =
        groupMode === "assignee"
          ? (task.assignees?.[0]?.name || "Unassigned")
          : groupMode === "priority"
            ? `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`
            : task.column?.name || "No status";
      groups.set(key, [...(groups.get(key) || []), task]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTasks, groupMode]);

  const completedCount = timelineTasks.filter((task) => task.isDone).length;
  const overdueCount = timelineTasks.filter((task) => task.isOverdue).length;
  const unscheduledCount = timelineTasks.filter((task) => task.isUnscheduled).length;
  const atRiskCount = timelineTasks.filter((task) => task.health === "at-risk").length;
  const completionRate = timelineTasks.length > 0 ? Math.round((completedCount / timelineTasks.length) * 100) : 0;
  const scheduledRate = timelineTasks.length > 0 ? Math.round(((timelineTasks.length - unscheduledCount) / timelineTasks.length) * 100) : 0;

  const exportCsv = () => {
    const rows = [
      ["Task", "Status", "Priority", "Assignee", "Start", "Due", "Health"],
      ...filteredTasks.map((task) => [
        task.title,
        task.column?.name || "",
        task.priority,
        (task.assignees ?? []).map((a) => a.name).join(", ") || "Unassigned",
        task.inferred_start ? format(task.inferred_start, "yyyy-MM-dd") : "",
        task.inferred_end ? format(task.inferred_end, "yyyy-MM-dd") : "",
        task.health,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-gantt.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-[500px] sm:min-h-[620px] flex-col overflow-hidden rounded-xl border bg-card shadow-sm relative">
      <div id="tour-pm-gantt-toolbar" className="border-b bg-muted/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">{t('project_management.project_schedule', 'Project Schedule')}</h2>
              <Badge className="border-none bg-violet-500/10 text-violet-600">{t('project_management.percent_complete', '{percent}% complete').replace('{percent}', completionRate.toString())}</Badge>
              {overdueCount > 0 && <Badge className="border-none bg-rose-500/10 text-rose-600">{t('project_management.count_overdue', '{count} overdue').replace('{count}', overdueCount.toString())}</Badge>}
              {atRiskCount > 0 && <Badge className="border-none bg-amber-500/10 text-amber-600">{t('project_management.count_at_risk', '{count} at risk').replace('{count}', atRiskCount.toString())}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(rangeStart, "MMM d, yyyy")} - {format(rangeEnd, "MMM d, yyyy")} · {t('project_management.task_count', '{count} tasks').replace('{count}', timelineTasks.length.toString())}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button variant="outline" size="sm" className="h-9 gap-2 shrink-0 bg-background" onClick={exportCsv} disabled={filteredTasks.length === 0}>
              <Download className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">{t('project_management.export_csv', 'Export CSV')}</span>
              <span className="sm:hidden">{t('project_management.export', 'Export')}</span>
            </Button>
            <div className="flex items-center rounded-lg border bg-background p-1 gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom("compact")} aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom("comfortable")} aria-label="Default zoom">
                <TimerReset className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom("wide")} aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 grid-cols-2 xl:grid-cols-4">
          <Metric icon={CheckCircle2} label={t('project_management.completion', 'Completion')} value={`${completionRate}%`} progress={completionRate} />
          <Metric icon={CalendarClock} label={t('project_management.scheduled', 'Scheduled')} value={`${scheduledRate}%`} progress={scheduledRate} />
          <Metric icon={AlertTriangle} label={t('project_management.overdue', 'Overdue')} value={overdueCount} tone={overdueCount > 0 ? "danger" : "good"} />
          <Metric icon={TimerReset} label={t('project_management.unscheduled', 'Unscheduled')} value={unscheduledCount} tone={unscheduledCount > 0 ? "warning" : "good"} />
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3 overflow-x-auto pb-1">
          <div className="relative group min-w-[200px] flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('project_management.search_tasks_assignees', 'Search tasks, assignees...')} className="pl-9 bg-background border-border/50 focus:border-primary/50" />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="min-w-[180px]">
              <Filter className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('project_management.all_tasks', 'All tasks')}</SelectItem>
              <SelectItem value="scheduled">{t('project_management.scheduled', 'Scheduled')}</SelectItem>
              <SelectItem value="unscheduled">{t('project_management.unscheduled', 'Unscheduled')}</SelectItem>
              <SelectItem value="overdue">{t('project_management.overdue', 'Overdue')}</SelectItem>
              <SelectItem value="completed">{t('project_management.completed', 'Completed')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as TaskPriority | "all")}>
            <SelectTrigger className="min-w-[180px]">
              <Flag className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('project_management.all_priority', 'All priority')}</SelectItem>
              <SelectItem value="low">{t('project_management.priority_low', 'Low')}</SelectItem>
              <SelectItem value="medium">{t('project_management.priority_medium', 'Medium')}</SelectItem>
              <SelectItem value="high">{t('project_management.priority_high', 'High')}</SelectItem>
              <SelectItem value="urgent">{t('project_management.priority_urgent', 'Urgent')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupMode} onValueChange={(value) => setGroupMode(value as GroupMode)}>
            <SelectTrigger className="min-w-[180px]">
              <Layers3 className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">{t('project_management.group_status', 'Group status')}</SelectItem>
              <SelectItem value="assignee">{t('project_management.group_assignee', 'Group assignee')}</SelectItem>
              <SelectItem value="priority">{t('project_management.group_priority', 'Group priority')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {timelineTasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <CalendarClock className="h-10 w-10" />
          <div>
            <p className="font-semibold text-foreground">{t('project_management.no_tasks_to_schedule', 'No tasks to schedule yet')}</p>
            <p className="mt-1 text-sm">{t('project_management.create_tasks_with_due_dates', 'Create tasks with due dates to build a delivery plan.')}</p>
          </div>
        </div>
      ) : (
        <div id="tour-pm-gantt-chart" className="flex-1 overflow-auto relative custom-scrollbar">
          <div className="min-w-[980px] relative">
            {/* Dependency Lines Layer */}
            <svg 
              className="absolute top-0 left-[320px] pointer-events-none z-10" 
              style={{ width: chartWidth, height: '100%', minHeight: '1000px' }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" opacity="0.5" />
                </marker>
              </defs>
              {(() => {
                let currentY = 80; // Start after header
                const positions = new Map<string, { x: number, y: number }>();
                
                // First pass: calculate positions
                groupedTasks.forEach(([_, groupTasks]) => {
                  currentY += 33; // Group header
                  groupTasks.forEach(task => {
                    if (task.inferred_end) {
                      const startOffset = Math.max(0, differenceInCalendarDays(task.inferred_start!, paddedStart));
                      const endOffset = Math.max(startOffset + 1, differenceInCalendarDays(endOfDay(task.inferred_end), paddedStart));
                      const x = (endOffset + 1) * zoomConfig[zoom].dayWidth;
                      positions.set(task.id, { x, y: currentY + (zoomConfig[zoom].rowHeight / 2) });
                    }
                    currentY += zoomConfig[zoom].rowHeight;
                  });
                });

                // Second pass: draw lines
                const lines: React.ReactNode[] = [];
                groupedTasks.forEach(([_, groupTasks]) => {
                  groupTasks.forEach(task => {
                    if (task.parent_task_id && positions.has(task.parent_task_id) && positions.has(task.id)) {
                      const parentPos = positions.get(task.parent_task_id)!;
                      const childPos = positions.get(task.id)!;
                      
                      // Calculate child start X
                      const childStartOffset = Math.max(0, differenceInCalendarDays(task.inferred_start!, paddedStart));
                      const childX = childStartOffset * zoomConfig[zoom].dayWidth;

                      const d = `M ${parentPos.x} ${parentPos.y} L ${parentPos.x + 10} ${parentPos.y} L ${parentPos.x + 10} ${childPos.y} L ${childX} ${childPos.y}`;
                      
                      lines.push(
                        <path 
                          key={`dep-${task.parent_task_id}-${task.id}`}
                          d={d}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="1.5"
                          strokeDasharray="4 2"
                          opacity="0.3"
                          markerEnd="url(#arrowhead)"
                        />
                      );
                    }
                  });
                });
                return lines;
              })()}
            </svg>
            <div className="sticky top-0 z-20 grid grid-cols-[320px_1fr] border-b bg-card">
              <div className="border-r p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('project_management.work_item', 'Work item')}</p>
                <p className="text-xs text-muted-foreground">{t('project_management.count_visible', '{count} visible').replace('{count}', filteredTasks.length.toString())} · {zoomConfig[zoom].label}</p>
              </div>
              <div className="overflow-hidden">
                <div className="relative h-16" style={{ width: chartWidth }}>
                  {months.map((month) => {
                    const left = Math.max(0, differenceInCalendarDays(month, paddedStart) * zoomConfig[zoom].dayWidth);
                    return (
                      <div key={month.toISOString()} className="absolute top-2 text-xs font-semibold text-muted-foreground" style={{ left }}>
                        {format(month, "MMM yyyy")}
                      </div>
                    );
                  })}
                  <div className="absolute bottom-0 left-0 grid h-8" style={{ width: chartWidth, gridTemplateColumns: `repeat(${days.length}, ${zoomConfig[zoom].dayWidth}px)` }}>
                    {days.map((day) => (
                      <div key={day.toISOString()} className="border-l px-1 text-[10px] text-muted-foreground">
                        {format(day, "d")}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {groupedTasks.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                {t('project_management.no_tasks_match_filters', 'No tasks match the current filters.')}
              </div>
            ) : (
              groupedTasks.map(([group, groupTasks]) => (
                <div key={group}>
                  <div className="sticky top-16 z-10 grid grid-cols-[320px_1fr] border-b bg-muted/40">
                    <div className="border-r px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{group}</div>
                    <div className="px-4 py-2 text-xs text-muted-foreground">{t('project_management.task_count', '{count} tasks').replace('{count}', groupTasks.length.toString())}</div>
                  </div>
                  {groupTasks.map((task) => (
                    <TimelineRow
                      key={task.id}
                      task={task}
                      chartWidth={chartWidth}
                      dayWidth={zoomConfig[zoom].dayWidth}
                      rowHeight={zoomConfig[zoom].rowHeight}
                      paddedStart={paddedStart}
                      onTaskClick={onTaskClick}
                      t={t}
                    />
                  ))}
                </div>
              ))
            )}

            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                className="pointer-events-none sticky bottom-0 z-30 ml-[320px] h-0"
                aria-hidden="true"
              >
                <div className="relative" style={{ width: chartWidth }}>
                  <div className="absolute bottom-0 top-[-9999px] w-px bg-rose-500" style={{ left: todayLeft }} />
                  <div className="absolute -top-6 rounded-sm bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white" style={{ left: Math.max(0, todayLeft - 18) }}>
                    {t('project_management.today', 'Today')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function Metric({
  icon: Icon,
  label,
  value,
  progress,
  tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  progress?: number;
  tone?: "neutral" | "good" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "text-sky-600 bg-sky-500/10",
    good: "text-emerald-600 bg-emerald-500/10",
    warning: "text-amber-600 bg-amber-500/10",
    danger: "text-rose-600 bg-rose-500/10",
  }[tone];

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
        </div>
        <div className={`rounded-md p-2 shrink-0 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {typeof progress === "number" && <Progress value={progress} className="mt-3 h-1.5" />}
    </div>
  );
}

function TimelineRow({
  task,
  chartWidth,
  dayWidth,
  rowHeight,
  paddedStart,
  onTaskClick,
  t,
}: {
  task: TimelineTask;
  chartWidth: number;
  dayWidth: number;
  rowHeight: number;
  paddedStart: Date;
  onTaskClick?: (task: Task) => void;
  t: (key: string, defaultValue: string) => string;
}) {
  const startOffset = task.inferred_start ? Math.max(0, differenceInCalendarDays(task.inferred_start, paddedStart)) : 0;
  const endOffset = task.inferred_end ? Math.max(startOffset + 1, differenceInCalendarDays(endOfDay(task.inferred_end), paddedStart)) : startOffset + 1;
  const left = startOffset * dayWidth;
  const width = task.isUnscheduled ? 120 : Math.max((endOffset - startOffset + 1) * dayWidth, 80);

  return (
    <button
      type="button"
      onClick={() => onTaskClick?.(task)}
      className="grid w-full grid-cols-[320px_1fr] border-b text-left transition-colors hover:bg-muted/20"
      style={{ minHeight: rowHeight }}
    >
      <div className="border-r p-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex -space-x-2 shrink-0">
            {(task.assignees ?? []).slice(0, 2).map((user) => (
              <Avatar key={user.id} className="h-8 w-8 bg-muted border-2 border-card">
                <AvatarImage src={user.avatar_path || undefined} />
                <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
              </Avatar>
            ))}
            {(task.assignees?.length ?? 0) === 0 && (
              <Avatar className="h-8 w-8 bg-muted">
                <AvatarFallback className="text-[10px]">?</AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-semibold">{task.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="rounded-sm capitalize">{task.column?.name || "No status"}</Badge>
              <Badge className={`${healthColors[task.health]} rounded-sm border capitalize`}>{task.health.replace("-", " ")}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <UserRound className="h-3 w-3" />
              {(task.assignees ?? []).length > 0
                ? (task.assignees ?? []).map((a) => a.name.split(' ')[0]).join(', ')
                : t('project_management.unassigned', 'Unassigned')}
            </p>
          </div>
        </div>
      </div>
      <div
        className="relative"
        style={{
          width: chartWidth,
          backgroundImage: "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: `${dayWidth}px 100%`,
        }}
      >
        {task.isUnscheduled ? (
          <div className="absolute top-1/2 ml-4 flex h-8 -translate-y-1/2 items-center rounded-md border border-dashed bg-background px-3 text-xs font-semibold text-muted-foreground">
            {t('project_management.needs_due_date', 'Needs due date')}
          </div>
        ) : (
          <div
            className={`${priorityColors[task.priority]} absolute top-1/2 flex h-8 -translate-y-1/2 items-center rounded-md px-3 shadow-sm`}
            style={{ left, width: Math.min(width, Math.max(80, chartWidth - left)) }}
          >
            <span className="truncate text-xs font-semibold text-white">
              {task.title}
            </span>
            <span className="ml-auto shrink-0 pl-2 text-[10px] font-bold text-white/90">
              {task.inferred_end ? format(task.inferred_end, "MMM d") : ""}
            </span>
          </div>
        )}
        {task.isOverdue && task.inferred_end && (
          <div className="absolute top-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700" style={{ left: Math.min(chartWidth - 72, left + width + 8) }}>
            {t('project_management.late', 'Late')}
          </div>
        )}
      </div>
    </button>
  );
}
