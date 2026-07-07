"use client";

import React from "react";
import { EventCalendar, CalendarEvent } from "@/components/ui/EventCalendar";
import { Task, Project } from "../types";

interface ProjectCalendarProps {
  project: Project;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDayClick?: (day: Date) => void;
}

export function ProjectCalendar({ project, tasks, onTaskClick, onDayClick }: ProjectCalendarProps) {
  const events = React.useMemo<CalendarEvent[]>(() => {
    return tasks
      .filter((task) => task.due_date)
      .map((task) => {
        const priorityColors: Record<string, string> = {
          low: "bg-emerald-500/10 text-emerald-700 border border-emerald-200/50",
          medium: "bg-sky-500/10 text-sky-700 border border-sky-200/50",
          high: "bg-amber-500/10 text-amber-700 border border-amber-200/50",
          urgent: "bg-rose-500/10 text-rose-700 border border-rose-200/50",
        };

        const startDate = new Date(task.due_date!);
        const endDate = new Date(task.due_date!);

        return {
          id: task.id,
          title: task.title,
          start: startDate,
          end: endDate,
          color: priorityColors[task.priority] || priorityColors.medium,
          task: task, // Keep reference to original task
        };
      });
  }, [tasks]);

 const handleEventClick = (event: CalendarEvent) => {
    onTaskClick(event.task as Task);
  };

  return (
    <div className="h-full min-h-[600px] animate-in fade-in duration-500">
      <EventCalendar events={events} onEventClick={handleEventClick} onDayClick={onDayClick} />
    </div>
  );
}
