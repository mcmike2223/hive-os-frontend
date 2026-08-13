"use client";

import React, { useState, useMemo } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  isToday,
  startOfDay,
  addWeeks,
  subWeeks,
  isSameYear,
} from "date-fns";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Search, 
  Filter, 
  Maximize2, 
  Minimize2,
  Clock,
  LayoutGrid,
  List as ListIcon,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/store/use-translation";
import { toEthiopianDate, formatEthiopian } from "@/lib/ethiopian-calendar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export interface CalendarEvent {
  id: string | number;
  title: string;
  start: Date;
  end?: Date;
  color?: string;
  category?: string;
[key: string]: unknown;
}

interface EventCalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (day: Date) => void;
  className?: string;
}

export function EventCalendar({ events, onEventClick, onDayClick, className }: EventCalendarProps) {
  const { t, locale } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showEthiopian, setShowEthiopian] = useState(true);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    return eachDayOfInterval({
      start: startDate,
      end: endDate,
    });
  }, [currentMonth]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    return events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [events, searchQuery]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter((event) => {
      const eventStart = startOfDay(event.start);
      const eventEnd = event.end ? startOfDay(event.end) : eventStart;
      const targetDay = startOfDay(day);
      return targetDay >= eventStart && targetDay <= eventEnd;
    });
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-card border shadow-2xl transition-all duration-500 ease-in-out",
      isFullScreen ? "fixed inset-0 z-[100] rounded-none" : "rounded-3xl",
      className
    )}>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between px-8 py-6 border-b bg-muted/20 backdrop-blur-md gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t(`project_management.month_${format(currentMonth, "MMMM").toLowerCase()}`, format(currentMonth, "MMMM"))} {format(currentMonth, "yyyy")}
              {showEthiopian && (
                <span className="ml-3 text-sm font-medium text-primary/60 border-l pl-3 border-border/50">
                  {formatEthiopian(currentMonth, locale as 'en' | 'am')}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-bold">{t("project_management.project_timeline", "Project Timeline")}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-48 md:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder={t("project_management.search_tasks", "Search tasks...")} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 bg-background/50 border-border/40 focus:border-primary/40 rounded-xl transition-all"
            />
          </div>

          <div className="flex items-center rounded-xl border bg-background/50 p-1 shadow-sm backdrop-blur-sm">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={goToToday} className="h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-muted transition-colors">
              {t("project_management.today", "Today")}
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setShowEthiopian(!showEthiopian)}
            className={cn(
              "h-10 w-10 rounded-xl border-border/40 transition-all",
              showEthiopian ? "bg-primary/10 text-primary border-primary/30" : "hover:bg-muted"
            )}
            title={t("project_management.toggle_ethiopian_calendar", "Toggle Ethiopian Calendar")}
          >
            <Globe className="h-4 w-4" />
          </Button>

          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="h-10 w-10 rounded-xl border-border/40 hover:bg-muted transition-all"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 border-b bg-muted/10 backdrop-blur-sm">
        {[t("project_management.sun", "Sun"), t("project_management.mon", "Mon"), t("project_management.tue", "Tue"), t("project_management.wed", "Wed"), t("project_management.thu", "Thu"), t("project_management.fri", "Fri"), t("project_management.sat", "Sat")].map((day) => (
          <div key={day} className="py-4 text-center text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/60 border-r border-border/20 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-hidden bg-muted/5">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isDateToday = isToday(day);
          const ethDate = toEthiopianDate(day);

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick?.(day)}
              className={cn(
                "min-h-[100px] border-r border-b border-border/30 p-2 transition-all relative group flex flex-col",
                !isCurrentMonth && "bg-muted/10 opacity-30",
                idx % 7 === 6 && "border-r-0",
                "hover:bg-primary/[0.02] cursor-default"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "flex items-center justify-center rounded-xl transition-all duration-300",
                    isDateToday 
                      ? "h-8 w-8 bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-primary/10" 
                      : "h-7 w-7 text-muted-foreground group-hover:text-foreground"
                  )}>
                    <span className={cn(
                      "text-xs font-black",
                      isDateToday ? "translate-y-0" : ""
                    )}>
                      {format(day, "d")}
                    </span>
                  </div>
                  {showEthiopian && (
                    <span className="text-[11px] font-bold text-primary/50 mt-1">
                      {ethDate.day}
                    </span>
                  )}
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); onDayClick?.(day); }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar-thin max-h-[120px]">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick?.(event); }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-xl text-[11px] font-bold truncate transition-all",
                      "hover:ring-2 hover:ring-primary/20 hover:scale-[1.02] active:scale-[0.98]",
                      "flex items-center gap-2 group/event shadow-sm border border-transparent",
                      event.color || "bg-sky-500/10 text-sky-700 border-sky-200/50"
                    )}
                    title={event.title}
                  >
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0 shadow-sm transition-transform group-hover/event:scale-125", 
                      event.color?.includes("sky") ? "bg-sky-500" : 
                      event.color?.includes("emerald") ? "bg-emerald-500" : 
                      event.color?.includes("amber") ? "bg-amber-500" : 
                      event.color?.includes("rose") ? "bg-rose-500" : "bg-primary"
                    )} />
                    <span className="truncate flex-1">{event.title}</span>
                  </button>
                ))}
              </div>

              {/* Decorative background number on hover */}
              <span className="absolute bottom-2 right-2 text-4xl font-black text-foreground/[0.03] pointer-events-none group-hover:text-primary/[0.06] transition-colors">
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
