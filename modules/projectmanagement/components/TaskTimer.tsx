"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Square, Timer, History, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectApi } from "../api";
import { Task } from "../types";
import { formatDistanceStrict, differenceInSeconds } from "date-fns";
import { toast } from "sonner";

interface TaskTimerProps {
  task: Task;
}

export function TaskTimer({ task }: TaskTimerProps) {
  const queryClient = useQueryClient();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: activeLog, isLoading } = useQuery({
    queryKey: ["active-time-log"],
    queryFn: () => projectApi.getActiveTimeLog(),
  });

  const validActiveLog = activeLog && activeLog.task_id ? activeLog : null;
  const isActiveForThisTask = validActiveLog?.task_id === task.id;

  useEffect(() => {
    if (isActiveForThisTask && validActiveLog?.started_at) {
      const start = new Date(validActiveLog.started_at);
      
      const updateTimer = () => {
        setElapsedSeconds(differenceInSeconds(new Date(), start));
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActiveForThisTask, validActiveLog]);

  const startMutation = useMutation({
    mutationFn: () => projectApi.startTimeLog(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-log"] });
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      toast.success("Timer started");
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => {
      console.log('Stopping timer with log ID:', validActiveLog?.id);
      return projectApi.stopTimeLog(validActiveLog!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-log"] });
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["task-time-logs", task.id] });
      toast.success("Timer stopped and logged");
    },
    onError: (error) => {
      console.error('Failed to stop timer:', error);
      toast.error("Failed to stop timer");
    },
  });

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) return <div className="h-10 w-32 animate-pulse bg-muted rounded-xl" />;

  return (
    <div className={cn(
      "flex items-center gap-4 p-2 pl-4 rounded-2xl border transition-all duration-300",
      isActiveForThisTask ? "bg-primary/5 border-primary/20 shadow-lg shadow-primary/5" : "bg-muted/30 border-border/40"
    )}>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
          <Timer className={cn("h-3 w-3", isActiveForThisTask && "text-primary animate-pulse")} />
          {isActiveForThisTask ? "Running" : "Time Spent"}
        </div>
        <div className={cn(
          "text-lg font-black tabular-nums tracking-tight",
          isActiveForThisTask ? "text-primary" : "text-foreground/70"
        )}>
          {isActiveForThisTask ? formatTime(elapsedSeconds) : "00:00:00"}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {isActiveForThisTask ? (
          <Button 
            size="icon" 
            variant="destructive" 
            className="h-10 w-10 rounded-xl shadow-lg shadow-destructive/20 hover:scale-105 active:scale-95 transition-all"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button 
            size="icon" 
            className="h-10 w-10 rounded-xl bg-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending || (!!validActiveLog && !isActiveForThisTask)}
          >
            <Play className="h-4 w-4 fill-current ml-0.5" />
          </Button>
        )}
      </div>
      
      {!!validActiveLog && !isActiveForThisTask && (
        <div className="absolute -bottom-6 left-0 right-0 text-[9px] text-amber-600 font-bold uppercase text-center animate-bounce">
          Another timer is running
        </div>
      )}
    </div>
  );
}
