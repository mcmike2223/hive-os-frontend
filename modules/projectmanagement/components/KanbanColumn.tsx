import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Column, Task } from "../types";
import { KanbanTask } from "./KanbanTask";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  onAddTask: (columnId: string) => void;
  onTaskClick?: (task: Task) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, tasks, onAddTask, onTaskClick }) => {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div id="tour-pm-board-column" className="flex flex-col w-[300px] shrink-0 bg-muted/30 rounded-xl border border-muted-foreground/5 h-full max-h-full">
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: column.color || "#94a3b8" }} 
          />
          <h3 className="font-semibold text-sm">
            {t(`project_management.column_${column.name.toLowerCase().replace(/\s+/g, '_')}`, column.name)}
          </h3>
          <span className="text-[11px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div 
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanTask key={task.id} task={task} onOpen={onTaskClick} isDone={column.is_done} />
          ))}
        </SortableContext>
      </div>

      <div className="p-2">
        <Button 
          id="tour-pm-board-add-task"
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-primary h-9 text-xs"
          onClick={() => onAddTask(column.id)}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('project_management.add_task', 'Add Task')}
        </Button>
      </div>
    </div>
  );
};
