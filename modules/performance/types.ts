export type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

export type EmployeeRef = {
  id: number; employee_number: string; primary_name: string; preferred_name?: string | null; work_email?: string | null; employment_status: string;
  primary_assignment?: { organization_unit?: { id: number; name: string } | null; position?: { id: number; title: string } | null; reports_to?: { id: number; primary_name: string } | null } | null;
};

export type ReviewCycle = {
  id: number; code: string; name: string; description?: string | null; cycle_type: string; period_start: string; period_end: string;
  self_review_due_on?: string | null; manager_review_due_on?: string | null; calibration_due_on?: string | null;
  goal_weight: string | number; competency_weight: string | number; status: string; reviews_count?: number; completed_reviews_count?: number;
};

export type Competency = {
  id: number; code: string; name: string; description?: string | null; category: string; max_score: string | number;
  default_weight: string | number; behavioral_indicators?: string[] | null; is_active: boolean; sort_order: number;
};

export type Goal = {
  id: number; cycle_id: number; employee_id: number; parent_goal_id?: number | null; title: string; description?: string | null;
  goal_type: string; metric_type: string; unit?: string | null; baseline_value: string | number; target_value: string | number;
  current_value: string | number; weight: string | number; progress_percent: string | number; starts_on?: string | null; due_on?: string | null;
  status: string; owner_notes?: string | null; manager_notes?: string | null; employee?: EmployeeRef; cycle?: Pick<ReviewCycle, "id" | "name" | "status">;
};

export type ReviewScore = { id: number; source: string; score: string | number; comments?: string | null; competency?: Competency | null; goal?: Goal | null };
export type PerformanceReview = {
  id: number; cycle_id: number; employee_id: number; manager_employee_id?: number | null; status: string; due_on?: string | null;
  goal_score?: string | null; competency_score?: string | null; self_score?: string | null; manager_score?: string | null;
  calibrated_score?: string | null; overall_score?: string | null; rating_label?: string | null; self_summary?: string | null;
  manager_summary?: string | null; strengths?: string | null; development_areas?: string | null; career_aspirations?: string | null;
  potential_rating?: string | null; recommendation?: string | null; evidence_snapshot?: Record<string, unknown> | null;
  calibration_notes?: string | null; employee_comments?: string | null; workflow_status?: string | null; acknowledged_at?: string | null;
  employee?: EmployeeRef; manager?: EmployeeRef | null; cycle?: ReviewCycle; scores?: ReviewScore[];
};

export type Feedback = { id: number; subject_employee_id: number; author_employee_id?: number | null; relationship: string; visibility: string; status: string; strengths?: string | null; feedback?: string | null; growth_suggestion?: string | null; due_on?: string | null; subject?: EmployeeRef; author?: EmployeeRef | null };
export type Checkin = { id: number; employee_id: number; manager_employee_id?: number | null; goal_id?: number | null; checkin_on: string; progress_percent?: string | number | null; wins?: string | null; blockers?: string | null; support_needed?: string | null; next_steps?: string | null; status: string; employee?: EmployeeRef; manager?: EmployeeRef | null; goal?: Goal | null };
export type ImprovementPlan = { id: number; employee_id: number; manager_employee_id?: number | null; review_id?: number | null; title: string; reason: string; objectives: string[]; support_resources?: string[] | null; success_measures: string[]; starts_on: string; ends_on: string; checkin_frequency: string; status: string; outcome_notes?: string | null; employee?: EmployeeRef; manager?: EmployeeRef | null; review?: PerformanceReview | null };

export type PerformanceDashboard = {
  generated_at: string; scope: string;
  metrics: { active_cycles: number; reviews_total: number; reviews_completed: number; completion_rate: number; reviews_overdue: number; average_score: number; goals_total: number; goals_at_risk: number; average_goal_progress: number; feedback_pending: number; active_improvement_plans: number };
  datasets: {
    review_status: Array<{ status: string; label: string; value: number }>;
    goal_status: Array<{ status: string; label: string; value: number }>;
    score_distribution: Array<{ key: string; label: string; value: number }>;
    checkin_trend: Array<{ period: string; label: string; completed: number; planned: number }>;
    team_scores: Array<{ employee_id: number; employee: string; score: number; reviews: number }>;
  };
  recent_reviews: PerformanceReview[]; priority_goals: Goal[];
};

export type PerformanceReferences = { employees: EmployeeRef[]; cycles: ReviewCycle[]; competencies: Competency[]; current_employee_id?: number | null };

