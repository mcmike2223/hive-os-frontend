export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskIssueType = 'task' | 'bug' | 'feature' | 'improvement' | 'epic' | 'refactor' | 'debt';
export type MemberRole = 'owner' | 'manager' | 'member' | 'viewer';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

export interface User {
  id: string; // UUID
  name: string;
  email: string;
  avatar_path: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  start_date: string | null;
  end_date: string | null;
  project_manager_id: string | null; // UUID
  client_stakeholder: string | null;
  tags: string[] | null;
  created_by: string; // UUID
  created_at: string;
  updated_at: string;
  creator?: User;
  project_manager?: User;
  managers?: User[];
  members?: ProjectMember[];
  boards?: Board[];
  tasks_count?: number;
  completed_tasks_count?: number;
  members_count?: number;
  progress?: number;
  attachments?: ProjectAttachment[] | null;
  comments?: ProjectComment[];
  budget?: number;
  currency?: string;
  hourly_rate?: number;
  estimated_hours?: number;
  estimated_revenue?: number;
  is_template?: boolean;
  template_settings?: JsonRecord | null;
  health?: 'green' | 'yellow' | 'red';
  repository_url?: string | null;
  tech_stack?: string[] | null;
  sprints?: Sprint[];
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'active' | 'completed';
  tasks?: Task[];
}

export interface ProjectAttachment {
  path?: string | null;
  name?: string | null;
  url?: string | null;
  mime_type?: string | null;
  media_details?: JsonRecord | null;
}

export interface ProjectMember {
  id: number;
  project_id: string;
  user_id: string; // UUID
  role: MemberRole;
  user?: User;
}

export interface Board {
  id: string;
  project_id: string;
  name: string;
  order: number;
  columns?: Column[];
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
  order: number;
  is_done: boolean;
  tasks?: Task[];
}

export interface Task {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  parent_task_id?: string | null;
  parent_task?: { id: string; title: string } | null;
  created_by: string; // UUID
  order: number;
  created_at: string;
  updated_at: string;
  assignees?: User[];
  creator?: User;
  progress?: number;
  effort?: string | null;
  tags?: string[] | null;
  project?: { id: string, name: string, project_manager_id: string, created_by: string };
  column?: { id: string, name: string, is_done?: boolean };
  checklists?: TaskChecklist[];
  comments?: TaskComment[];
  attachments?: ProjectAttachment[] | null;
  time_logs?: TaskTimeLog[];
  task_attachments?: TaskAttachment[];
  issue_type?: TaskIssueType;
  story_points?: number | null;
  environment?: string | null;
  pr_url?: string | null;
  pr_status?: 'open' | 'merged' | 'closed' | null;
  build_status?: 'success' | 'failure' | 'running' | 'pending' | null;
  is_backlog?: boolean;
  sprint_id?: string | null;
}

export interface TaskAttachment {
  id: number;
  task_id: string;
  file_entry_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  user?: User;
  reviewer?: User;
  file_entry?: JsonRecord | null;
}

export interface TaskTimeLog {
  id: number;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  note: string | null;
  user?: User;
  task?: Task;
}

export interface TaskChecklist {
  id: number;
  task_id: string;
  item: string;
  is_completed: boolean;
  order: number;
}

export interface TaskComment {
  id: number;
  task_id: string;
  user_id: string; // UUID
  parent_id: number | null;
  content: string;
  attachments: ProjectAttachment[] | null;
  created_at: string;
  user?: User;
}

export interface ProjectComment {
  id: number;
  project_id: string;
  user_id: string; // UUID
  parent_id: number | null;
  content: string;
  attachments: ProjectAttachment[] | null;
  created_at: string;
  updated_at: string;
  user?: User;
  replies?: ProjectComment[];
}

export interface ProjectSummary {
  stats: {
    total: number;
    active: number;
    completed: number;
    planning: number;
  };
  recent: Project[];
  issue_type_distribution?: Array<{
    type: TaskIssueType | string;
    name: string;
    value: number;
  }>;
}

export interface FinancialReport {
  budget: number;
  total_costs: number;
  estimated_revenue: number;
  weekly_trend?: Array<{ week: string; cost: number }>;
  projections?: Array<{ week: string; forecasted_cost: number }>;
  progress_percent: number;
  profitability: number;
  issue_type_breakdown?: Array<{ type: string; cost: number }>;
  roi: number;
  total_hours: number;
  currency: string;
  remaining_budget: number;
  hourly_rate: number;
  member_breakdown?: Array<{ id: string; name: string; cost: number; hours: number }>;
  risk_score: number;
}

export interface GlobalWorkloadUser extends User {
  tasks?: Array<{
    id: string;
    title: string;
    due_date: string | null;
    project?: { id: string; name: string };
  }>;
}


