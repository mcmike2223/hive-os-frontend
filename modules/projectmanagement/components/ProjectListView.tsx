import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Task } from "../types";
import { format } from "date-fns";
import { MoreHorizontal, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GitStatusBadge } from "./GitStatusBadge";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/store/use-translation";

interface ProjectListViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

const priorityColors: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-500",
  medium: "bg-amber-500/10 text-amber-500",
  high: "bg-orange-500/10 text-orange-500",
  urgent: "bg-red-500/10 text-red-500",
};

export const ProjectListView: React.FC<ProjectListViewProps> = ({ tasks, onTaskClick }) => {
  const { user } = useUser();
  const { t } = useTranslation();
  const isSoftwareDev = user?.business_type?.toLowerCase()?.replace('-', ' ') === 'software development';

  return (
    <div className="bg-card border border-border/40 rounded-[2rem] shadow-xl shadow-black/5 overflow-hidden animate-in fade-in duration-500">
      <Table>
        <TableHeader id="tour-pm-list-header" className="bg-muted/20 border-b border-border/40">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="w-[40%] font-black uppercase tracking-widest text-[11px] h-14 px-6">{t('project_management.task_identity', 'Task Identity')}</TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[11px] h-14 px-6">{t('project_management.status', 'Status')}</TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[11px] h-14 px-6">{t('project_management.priority', 'Priority')}</TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[11px] h-14 px-6">{t('project_management.assigned_team', 'Assigned Team')}</TableHead>
            {isSoftwareDev && <TableHead className="font-black uppercase tracking-widest text-[11px] h-14 px-6 text-center">{t('project_management.score', 'Score')}</TableHead>}
            <TableHead className="font-black uppercase tracking-widest text-[11px] h-14 px-6">{t('project_management.target_date', 'Target Date')}</TableHead>
            <TableHead className="text-right h-14 px-6"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isSoftwareDev ? 7 : 6} className="h-32 text-center text-muted-foreground">
                {t('project_management.no_tasks_found', 'No tasks found in this project.')}
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((task) => (
              <TableRow 
                key={task.id} 
                className="group cursor-pointer hover:bg-primary/[0.02] transition-colors border-border/20"
                onClick={() => onTaskClick?.(task)}
              >
                <TableCell className="px-6 py-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {task.title}
                      </span>
                      {isSoftwareDev && (
                        <GitStatusBadge 
                          prUrl={task.pr_url} 
                          prStatus={task.pr_status} 
                          buildStatus={task.build_status} 
                        />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {task.description ? task.description.replace(/<[^>]*>/g, '').trim() : t('project_management.no_description_short', 'No description')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <Badge variant="outline" className="font-bold text-[11px] uppercase tracking-widest bg-muted/50 border-border/40 text-muted-foreground">
                    {task.column?.name || t('project_management.unknown', 'Unknown')}
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <Badge className={cn("text-[11px] font-black uppercase tracking-widest px-2 py-0.5 border-none", priorityColors[task.priority])}>
                    {task.priority}
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4">
                  {(task.assignees?.length ?? 0) > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {(task.assignees ?? []).slice(0, 3).map((user) => (
                          <Avatar key={user.id} className="h-7 w-7 border-2 border-card ring-1 ring-border/40">
                            <AvatarImage src={user.avatar_path || undefined} />
                            <AvatarFallback className="text-[11px] font-bold">
                              {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      {(task.assignees?.length ?? 0) === 1 ? (
                        <span className="text-xs font-bold truncate max-w-[100px] text-muted-foreground">{task.assignees![0].name}</span>
                      ) : (task.assignees?.length ?? 0) > 3 ? (
                        <span className="text-[11px] font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded-md border border-primary/10">+{(task.assignees?.length ?? 0) - 3}</span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">{t('project_management.open_task', 'Open')}</span>
                  )}
                </TableCell>
                {isSoftwareDev && (
                  <TableCell className="text-center">
                    {task.story_points ? (
                      <Badge variant="secondary" className="rounded-full h-5 px-2 text-[11px] font-bold">
                        {task.story_points}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="px-6 py-4">
                  <div className="flex items-center gap-2 text-muted-foreground font-bold">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-[11px] uppercase tracking-widest">
                      {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : t('project_management.no_date', 'No date')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
