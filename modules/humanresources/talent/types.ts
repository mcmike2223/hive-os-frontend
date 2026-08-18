/**
 * Talent management types (proposal §5.2.6, §5.2.7, §5.2.9, §5.2.11).
 *
 * These mirror the payloads returned by Modules/HumanResources talent
 * controllers. Numeric fields that Postgres returns through Laravel's
 * `decimal:` casts arrive as strings, so anything money- or score-shaped is
 * typed `number | string` and coerced at the render boundary rather than
 * being trusted to already be a number.
 */

export type Numeric = number | string | null;

export type Paginated<T> = {
  status: string;
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type Envelope<T> = {
  status: string;
  data: T;
  message?: string;
};

// ---------------------------------------------------------------- competency

export type Competency = {
  id: number;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  max_level: number;
  is_active: boolean;
};

export type EmployeeCompetency = {
  id: number;
  employee_id: number;
  competency_id: number;
  proficiency_level: number;
  assessed_on: string | null;
  evidence: string | null;
  notes: string | null;
  competency?: Competency;
};

export type PositionCompetency = {
  id: number;
  position_id: number;
  competency_id: number;
  required_level: number;
  is_critical: boolean;
  competency?: Competency;
};

// ---------------------------------------------------------------- succession

export type Readiness = "ready_now" | "ready_1_2_years" | "ready_3_5_years" | "not_ready";

export type SuccessionCandidate = {
  id: number;
  critical_role_id: number;
  employee_id: number;
  readiness: Readiness;
  status: string;
  assessment_score: number | null;
  assessment_notes: string | null;
  reviewed_on: string | null;
  employee?: { id: number; primary_name: string | null };
};

export type CriticalRole = {
  id: number;
  position_id: number;
  incumbent_employee_id: number | null;
  criticality: "low" | "medium" | "high";
  vacancy_risk: "low" | "medium" | "high";
  target_successor_count: number;
  impact_notes: string | null;
  is_active: boolean;
  bench_strength?: Numeric;
  position?: { id: number; title: string | null };
  incumbent?: { id: number; primary_name: string | null };
  candidates?: SuccessionCandidate[];
};

export type PipelineRole = {
  critical_role_id: number;
  position_id: number;
  position: string | null;
  incumbent: string | null;
  criticality: string;
  vacancy_risk: string;
  target_successor_count: number;
  candidates: number;
  ready_now: number;
  ready_soon: number;
  bench_strength: Numeric;
  at_risk: boolean;
};

export type SuccessionPipeline = {
  critical_roles: number;
  roles_without_successor: number;
  roles_at_risk: number;
  average_bench_strength: Numeric;
  readiness_mix: Array<{ readiness: string; label: string; count: number }>;
  roles: PipelineRole[];
};

export type CompetencyGap = {
  position_id: number;
  employee_id: number;
  requirements: number;
  met: number;
  gaps: Array<{
    competency_id: number;
    competency: string | null;
    required_level: number;
    current_level: number;
    shortfall: number;
    is_critical: boolean;
  }>;
  critical_gaps: number;
  readiness_percent: Numeric;
  suggested_readiness: Readiness;
  /** Present only when the position has no competency profile at all. */
  note?: string;
};

export type CareerAspiration = {
  id: number;
  employee_id: number;
  desired_position_id: number | null;
  desired_role: string | null;
  horizon_years: number | null;
  open_to_relocation: boolean;
  notes: string | null;
  employee?: { id: number; primary_name: string | null };
  desired_position?: { id: number; title: string | null };
};

// ------------------------------------------------------------------ training

export type TrainingCourse = {
  id: number;
  code: string;
  title: string;
  category: string | null;
  delivery_mode: string | null;
  duration_hours: Numeric;
  cost_per_seat: Numeric;
  provider: string | null;
  competency_id: number | null;
  target_level: number | null;
  is_active: boolean;
  competency?: Competency;
};

export type TrainingSession = {
  id: number;
  course_id: number;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  trainer: string | null;
  capacity: number | null;
  budget_amount: Numeric;
  actual_cost: Numeric;
  status: string;
  seats_remaining?: number | null;
  course?: TrainingCourse;
  enrollments?: TrainingEnrollment[];
};

export type TrainingEnrollment = {
  id: number;
  session_id: number;
  employee_id: number;
  status: "registered" | "attended" | "completed" | "failed" | "no_show" | "cancelled";
  score: number | null;
  feedback_rating: number | null;
  feedback_notes: string | null;
  cost: Numeric;
  completed_at: string | null;
  competency_applied: boolean;
  employee?: { id: number; primary_name: string | null };
  session?: TrainingSession;
};

export type DevelopmentPlan = {
  id: number;
  employee_id: number;
  competency_id: number | null;
  objective: string | null;
  target_level: number | null;
  current_level: number | null;
  progress_percent: number;
  status: string;
  due_on: string | null;
  employee?: { id: number; primary_name: string | null };
  competency?: Competency;
};

export type TrainingSummary = {
  sessions: number;
  enrollments: number;
  completed: number;
  completion_rate_percent: Numeric;
  no_show_rate_percent: Numeric;
  budget: Numeric;
  actual_cost: Numeric;
  average_rating: Numeric;
  training_hours: Numeric;
  by_category: Array<{
    category: string;
    sessions: number;
    enrollments: number;
    cost: Numeric;
  }>;
};

// -------------------------------------------------------------------- travel

export type TravelStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "in_progress"
  | "completed"
  | "settled"
  | "cancelled";

export type TravelExpense = {
  id: number;
  travel_request_id: number;
  category: string;
  amount: Numeric;
  incurred_on: string | null;
  receipt_reference: string | null;
  status: string;
  notes: string | null;
};

export type TravelRequest = {
  id: number;
  request_number: string;
  employee_id: number;
  purpose: string;
  destination: string;
  country: string | null;
  trip_type: "domestic" | "international";
  departure_date: string;
  return_date: string | null;
  transport_mode: string | null;
  estimated_cost: Numeric;
  actual_cost: Numeric;
  advance_amount: Numeric;
  currency: string;
  budget_code: string | null;
  status: TravelStatus;
  itinerary: string | null;
  notes: string | null;
  /** Appended: actual − estimated. */
  variance_amount?: Numeric;
  /** Appended: actual − advance. Negative means unspent advance to return. */
  settlement_due?: Numeric;
  employee?: { id: number; primary_name: string | null };
  expenses?: TravelExpense[];
};

// --------------------------------------------------------------- offboarding

export type OffboardingTask = {
  id: number;
  offboarding_case_id: number;
  title: string;
  department: string;
  category: string;
  status: "pending" | "in_progress" | "done" | "waived";
  is_blocking: boolean;
  due_on: string | null;
  completed_at: string | null;
  assignee_id: number | null;
  notes: string | null;
};

export type OffboardingCase = {
  id: number;
  case_number: string;
  employee_id: number;
  exit_type: string;
  status: "open" | "in_progress" | "cleared" | "completed" | "cancelled";
  notified_on: string | null;
  last_working_day: string | null;
  access_revoked_at: string | null;
  final_settlement_amount: Numeric;
  settled_at: string | null;
  completed_at: string | null;
  reason: string | null;
  exit_interview_notes: string | null;
  exit_interview_at: string | null;
  rehire_eligible: boolean | null;
  /** Appended aggregates. */
  completion_percent?: Numeric;
  blocking_tasks_outstanding?: number;
  employee?: { id: number; primary_name: string | null };
  tasks?: OffboardingTask[];
};

export type OffboardingSummary = {
  total_cases: number;
  open_cases: number;
  blocked_cases: number;
  overdue_tasks: number;
  average_completion_percent: Numeric;
  by_exit_type: Array<{ exit_type: string; count: number }>;
  outstanding_by_department: Array<{
    department: string;
    outstanding: number;
    blocking: number;
  }>;
};
