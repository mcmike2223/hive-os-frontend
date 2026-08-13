import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Flag } from "lucide-react";
import { Task } from "../types";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";
import { Bug, Zap, Terminal, Code2, ShieldAlert, Layers, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GitStatusBadge } from "./GitStatusBadge";
import { useTranslation } from "@/store/use-translation";

const ISSUE_TYPE_CONFIG = {
  task: { label: "Task", icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10" },
  bug: { label: "Bug", icon: Bug, color: "text-rose-500", bg: "bg-rose-500/10" },
  feature: { label: "Feature", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
  improvement: { label: "Improvement", icon: Terminal, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  epic: { label: "Epic", icon: Layers, color: "text-purple-500", bg: "bg-purple-500/10" },
  refactor: { label: "Refactor", icon: Code2, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  debt: { label: "Tech Debt", icon: ShieldAlert, color: "text-orange-500", bg: "bg-orange-500/10" },
};

interface KanbanTaskProps {
  task: Task;
  onOpen?: (task: Task) => void;
  isDone?: boolean;
}

const priorityColors: Record<string, string> = {
  low: "text-blue-500",
  medium: "text-green-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

export const KanbanTask: React.FC<KanbanTaskProps> = ({ task, onOpen, isDone }) => {
  const { user } = useUser();
  const { t } = useTranslation();
  const isSoftwareDev = user?.business_type?.toLowerCase()?.replace('-', ' ') === 'software development';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const isOverdue = 
    !isDone && 
    task.due_date && 
    new Date(task.due_date) < new Date();

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 border-2 border-primary rounded-xl h-[120px] mb-3"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group"
      onClick={() => onOpen?.(task)}
    >
      <Card className={`mb-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all duration-200 border-muted-foreground/10 shadow-sm hover:shadow-md ${isOverdue ? 'border-red-500/30' : ''}`}>
        <CardContent className="p-3 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {isSoftwareDev && task.issue_type && (
                <div className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider w-fit",
                  ISSUE_TYPE_CONFIG[task.issue_type as keyof typeof ISSUE_TYPE_CONFIG]?.bg || "bg-muted",
                  ISSUE_TYPE_CONFIG[task.issue_type as keyof typeof ISSUE_TYPE_CONFIG]?.color || "text-muted-foreground"
                )}>
                  {(() => {
                    const Icon = ISSUE_TYPE_CONFIG[task.issue_type as keyof typeof ISSUE_TYPE_CONFIG]?.icon || CheckCircle2;
                    return <Icon className="h-2.5 w-2.5" />;
                  })()}
                  {task.issue_type}
                </div>
              )}
              <h4 className={`text-sm font-semibold leading-tight line-clamp-2 ${isOverdue ? 'text-red-500' : ''}`}>
                {task.title}
              </h4>
            </div>
            <Flag className={`h-3.5 w-3.5 shrink-0 ${priorityColors[task.priority]} ${isOverdue ? 'animate-pulse' : ''}`} />
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description.replace(/<[^>]*>/g, '').trim()}
            </p>
          )}

          {isSoftwareDev && (task.pr_url || task.build_status) && (
            <GitStatusBadge 
              prUrl={task.pr_url} 
              prStatus={task.pr_status} 
              buildStatus={task.build_status} 
            />
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {task.due_date && (
              <div className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${isOverdue ? 'text-red-500 bg-red-500/10 font-bold' : 'text-muted-foreground bg-muted/50'}`}>
                <Calendar className="h-3 w-3" />
                {isOverdue ? t('project_management.overdue_colon', 'Overdue: ') : ''}
                {format(new Date(task.due_date), "MMM d")}
              </div>
            )}

            {isSoftwareDev && task.story_points && (
              <div className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                <Zap className="h-2.5 w-2.5" />
                {task.story_points} {t('project_management.pts', 'pts')}
              </div>
            )}

            {/* Assignee avatar stack */}
            {(task.assignees?.length ?? 0) > 0 && (
              <div className="flex items-center ml-auto">
                <div className="flex -space-x-1.5">
                  {(task.assignees ?? []).slice(0, 3).map((user) => (
                    <Avatar key={user.id} className="h-5 w-5 border border-card">
                      <AvatarImage src={user.avatar_path || undefined} />
                      <AvatarFallback className="text-[11px]">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                {(task.assignees?.length ?? 0) > 3 && (
                  <span className="ml-1 text-[11px] text-muted-foreground font-bold">
                    +{(task.assignees?.length ?? 0) - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
