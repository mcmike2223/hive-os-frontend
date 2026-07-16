import api from "@/modules/shared/api/http";
import type { 
  Project, 
  ProjectSummary, 
  Task, 
  Board, 
  Column, 
  ProjectMember, 
  User,
  ProjectStatus,
  TaskPriority,
  MemberRole,
  ProjectComment,
  ProjectAttachment,
  Sprint,
  TaskTimeLog,
  TaskIssueType,
  FinancialReport,
  GlobalWorkloadUser,
} from "../types";

const PM_PREFIX = "/project-management";

type ProjectQueryParams = {
  search?: string;
  status?: ProjectStatus;
  per_page?: number;
};

type TaskQueryParams = {
  project_id?: string;
  assigned_to?: string; // UUID
  status?: string;
  per_page?: number;
};

type ProjectPayload = Partial<Pick<Project, "name" | "description" | "status" | "priority" | "start_date" | "end_date" | "project_manager_id" | "client_stakeholder" | "tags" | "attachments" | "budget" | "currency" | "hourly_rate" | "estimated_hours" | "estimated_revenue" | "is_template">> & {
  assigned_to?: string[]; // UUIDs
  project_manager_ids?: string[]; // UUIDs
};

type ProjectAutomation = Record<string, unknown>;
type ProjectGoal = Record<string, unknown>;
type ProjectCommentCollection = { 
  data: ProjectComment[]; 
  current_page: number; 
  last_page: number; 
  per_page?: number; 
  total?: number; 
  meta?: Record<string, unknown>; 
};
type SprintPayload = Partial<Pick<Sprint, "name" | "start_date" | "end_date" | "goal">>;

export type TaskPayload = Partial<{
  project_id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  assignees: string[] | null; // Array of UUID strings
  parent_task_id?: string | null;
  order: number;
  attachments: ProjectAttachment[] | null;
  tags?: string[] | null;
  is_backlog?: boolean;
  sprint_id?: string | null;
  issue_type?: TaskIssueType;
  story_points?: number | null;
  environment?: string | null;
  pr_url?: string | null;
}>;

type BoardPayload = Partial<Pick<Board, "project_id" | "name" | "order">>;
type ColumnPayload = Partial<Pick<Column, "name" | "color" | "order" | "is_done">>;
type ChecklistPayload = Partial<{ item: string; is_completed: boolean; order: number }>;

export const projectApi = {
  // Projects
  getSummary: () => api.get<ProjectSummary>(`${PM_PREFIX}/summary`).then(res => res.data),
  getProjects: (params?: ProjectQueryParams) => api.get<{ data: Project[] }>(`${PM_PREFIX}/projects`, { params }).then(res => res.data),
  getProject: (id: string) => api.get<Project>(`${PM_PREFIX}/projects/${id}`).then(res => res.data),
  createProject: (data: ProjectPayload) => api.post<Project>(`${PM_PREFIX}/projects`, data).then(res => res.data),
  updateProject: (id: string, data: ProjectPayload) => api.put<Project>(`${PM_PREFIX}/projects/${id}`, data).then(res => res.data),
  deleteProject: (id: string) => api.delete(`${PM_PREFIX}/projects/${id}`),
  getTemplates: () => api.get<Project[]>(`${PM_PREFIX}/templates`).then(res => res.data),
  spawnProject: (templateId: string, data: {
    name: string,
    start_date?: string,
    project_manager_ids?: string[],
    assigned_to?: string[],
    budget?: number,
    currency?: string,
    hourly_rate?: number,
    estimated_hours?: number,
    estimated_revenue?: number,
    description?: string | null,
    status?: string,
    priority?: string,
    end_date?: string | null,
    client_stakeholder?: string | null,
    tags?: string[] | null,
    attachments?: any[] | null,
    repository_url?: string | null | undefined,
    tech_stack?: string[] | null | undefined
  }) =>
    api.post<Project>(`${PM_PREFIX}/projects/${templateId}/spawn`, data).then(res => res.data),

  // Members
  searchUsers: (search: string) => api.get<User[]>(`${PM_PREFIX}/users/search`, { params: { search } }).then(res => res.data),
  addMember: (projectId: string, data: { user_id: string, role: MemberRole }) => 
    api.post<ProjectMember>(`${PM_PREFIX}/projects/${projectId}/members`, data).then(res => res.data),
  removeMember: (projectId: string, userId: string) => 
    api.delete(`${PM_PREFIX}/projects/${projectId}/members/${userId}`),
  getGlobalWorkload: () => api.get<GlobalWorkloadUser[]>(`${PM_PREFIX}/members/global-workload`).then(res => res.data),

  // Boards
  createBoard: (data: BoardPayload) => api.post<Board>(`${PM_PREFIX}/boards`, data).then(res => res.data),
  createColumn: (boardId: string, data: ColumnPayload) => api.post<Column>(`${PM_PREFIX}/boards/${boardId}/columns`, data).then(res => res.data),
  updateColumn: (columnId: string, data: ColumnPayload) => api.put<Column>(`${PM_PREFIX}/columns/${columnId}`, data).then(res => res.data),

  // Tasks
  getTasks: (params?: TaskQueryParams) => api.get<{ data: Task[] }>(`${PM_PREFIX}/tasks`, { params }).then(res => res.data),
  getMyTasks: (params?: { status?: 'active' | 'completed', priority?: string, per_page?: number }) => 
    api.get<{ data: Task[], meta: Record<string, unknown> }>(`${PM_PREFIX}/my-tasks`, { params }).then(res => res.data),
  getTask: (id: string) => api.get<Task>(`${PM_PREFIX}/tasks/${id}`).then(res => res.data),
  createTask: (data: TaskPayload) => api.post<Task>(`${PM_PREFIX}/tasks`, data).then(res => res.data),
  updateTask: (id: string, data: TaskPayload) => api.put<Task>(`${PM_PREFIX}/tasks/${id}`, data).then(res => res.data),
  moveTask: (id: string, data: { column_id: string, order: number }) => 
    api.post(`${PM_PREFIX}/tasks/${id}/move`, data).then(res => res.data),
  deleteTask: (id: string) => api.delete(`${PM_PREFIX}/tasks/${id}`),

  // Task Details
  addChecklist: (taskId: string, data: ChecklistPayload) => api.post(`${PM_PREFIX}/tasks/${taskId}/checklists`, data).then(res => res.data),
  updateChecklist: (id: number, data: ChecklistPayload) => api.put(`${PM_PREFIX}/checklists/${id}`, data).then(res => res.data),
  deleteChecklist: (id: number) => api.delete(`${PM_PREFIX}/checklists/${id}`),
  addComment: (taskId: string, data: { content: string, parent_id?: number | null, attachments?: ProjectAttachment[] | null }) => 
    api.post(`${PM_PREFIX}/tasks/${taskId}/comments`, data).then(res => res.data),
  updateTaskComment: (commentId: number, data: { content: string, attachments?: ProjectAttachment[] | null }) =>
    api.put(`${PM_PREFIX}/task-comments/${commentId}`, data).then(res => res.data),
  deleteTaskComment: (commentId: number, type: 'me' | 'everyone' = 'everyone') => api.delete(`${PM_PREFIX}/task-comments/${commentId}?type=${type}`),
  bulkDeleteTaskComments: (ids: number[], type: 'me' | 'everyone' = 'everyone') => 
    api.post(`${PM_PREFIX}/task-comments/bulk-delete`, { ids, type }).then(res => res.data),
  reviewAttachment: (attachmentId: number, data: { status: 'approved' | 'rejected', review_note?: string }) =>
    api.post(`${PM_PREFIX}/attachments/${attachmentId}/review`, data).then(res => res.data),

  // Project Discussions
  getProjectComments: (projectId: string, params?: { page?: number; per_page?: number }) =>
    api.get<ProjectCommentCollection>(`${PM_PREFIX}/projects/${projectId}/comments`, { params })
      .then(res => res.data),
  addProjectComment: (projectId: string, data: { content: string, parent_id?: number | null, attachments?: ProjectAttachment[] | null }) => 
    api.post(`${PM_PREFIX}/projects/${projectId}/comments`, data).then(res => res.data),
  updateProjectComment: (commentId: number, data: { content: string, attachments?: ProjectAttachment[] | null }) =>
    api.put<ProjectComment>(`${PM_PREFIX}/comments/${commentId}`, data).then(res => res.data),
  deleteProjectComment: (commentId: number, type: 'me' | 'everyone' = 'everyone') => api.delete(`${PM_PREFIX}/comments/${commentId}?type=${type}`),
  bulkDeleteProjectComments: (ids: number[], type: 'me' | 'everyone' = 'everyone') => 
    api.post(`${PM_PREFIX}/comments/bulk-delete`, { ids, type }).then(res => res.data),

  // Automations
  getAutomations: (projectId: string) => api.get<ProjectAutomation[]>(`${PM_PREFIX}/projects/${projectId}/automations`).then(res => res.data),
  createAutomation: (projectId: string, data: ProjectAutomation) => api.post(`${PM_PREFIX}/projects/${projectId}/automations`, data).then(res => res.data),
  updateAutomation: (id: number, data: ProjectAutomation) => api.put(`${PM_PREFIX}/automations/${id}`, data).then(res => res.data),
  deleteAutomation: (id: number) => api.delete(`${PM_PREFIX}/automations/${id}`),

  // Project Goals
  getProjectGoals: (projectId: string) => 
    api.get<ProjectGoal[]>(`${PM_PREFIX}/projects/${projectId}/goals`).then(res => res.data),
  addProjectGoal: (projectId: string, data: { title: string }) => 
    api.post<ProjectGoal>(`${PM_PREFIX}/projects/${projectId}/goals`, data).then(res => res.data),
  updateProjectGoal: (goalId: number, data: { title?: string, is_completed?: boolean, order?: number }) => 
    api.put<ProjectGoal>(`${PM_PREFIX}/goals/${goalId}`, data).then(res => res.data),
  deleteProjectGoal: (goalId: number) => 
    api.delete(`${PM_PREFIX}/goals/${goalId}`),

  // Time Logs
  getTimeLogs: (taskId: string) => api.get<TaskTimeLog[]>(`${PM_PREFIX}/tasks/${taskId}/time-logs`).then(res => res.data),
  addTimeLog: (taskId: string, data: { duration_minutes: number, started_at: string, note?: string }) => 
    api.post<TaskTimeLog>(`${PM_PREFIX}/tasks/${taskId}/time-logs`, data).then(res => res.data),
  startTimeLog: (taskId: string, data?: { note?: string }) => 
    api.post<TaskTimeLog>(`${PM_PREFIX}/tasks/${taskId}/time-logs/start`, data).then(res => res.data),
  stopTimeLog: (timeLogId: number) => 
    api.post<TaskTimeLog>(`${PM_PREFIX}/time-logs/${timeLogId}/stop`).then(res => res.data),
  deleteTimeLog: (timeLogId: number) => 
    api.delete(`${PM_PREFIX}/time-logs/${timeLogId}`),
  getActiveTimeLog: () => api.get<TaskTimeLog>(`${PM_PREFIX}/time-logs/active`).then(res => res.data),

  // Sprints
  createSprint: (projectId: string, data: SprintPayload & { name: string }) => 
    api.post<Sprint>(`${PM_PREFIX}/projects/${projectId}/sprints`, data).then(res => res.data),
  updateSprint: (sprintId: string, data: SprintPayload) => 
    api.put<Sprint>(`${PM_PREFIX}/sprints/${sprintId}`, data).then(res => res.data),
  deleteSprint: (sprintId: string) => api.delete(`${PM_PREFIX}/sprints/${sprintId}`),
  startSprint: (sprintId: string) => api.post(`${PM_PREFIX}/sprints/${sprintId}/start`).then(res => res.data),
  completeSprint: (sprintId: string) => api.post(`${PM_PREFIX}/sprints/${sprintId}/complete`).then(res => res.data),

  // Financials
  getFinancialReport: (projectId: string) => 
    api.get<FinancialReport>(`${PM_PREFIX}/projects/${projectId}/financial-report`).then(res => res.data),
};
