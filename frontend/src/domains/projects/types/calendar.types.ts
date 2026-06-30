import { GanttTaskStatus } from "../utils/map-task-to-gantt";

export interface CalendarSharedViewProps {
  onTaskClick?: (taskId: string) => void;
  onAddTask?: (date: Date) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, toStatus: GanttTaskStatus) => void;
  onSetDueDate?: (taskId: string, date: string | null) => void;
  toggleTask?: (taskId: string) => void;
}
