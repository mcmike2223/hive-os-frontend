/**
 * Internal audit types (proposal §5.13).
 *
 * Distinct from the system audit *log*, which records who changed what row.
 * Decimal casts arrive as strings over JSON, so anything numeric is typed
 * `Numeric` and coerced at the render boundary.
 */

export type Numeric = number | string | null;

export type Paginated<T> = {
  status: string;
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export type RiskBand = "low" | "moderate" | "high" | "critical";

export type AuditArea = {
  id: number;
  code: string;
  name: string;
  category: string | null;
  owner_name: string | null;
  owner_employee_id: number | null;
  inherent_likelihood: number;
  inherent_impact: number;
  audit_cycle_months: number;
  last_audited_on: string | null;
  is_active: boolean;
  notes: string | null;
  /** Likelihood times impact on a five-point scale, so 1 to 25. */
  risk_score?: number;
  risk_band?: RiskBand;
  /** Null when never audited — which is not "0 months ago". */
  months_since_audit?: number | null;
  is_overdue_for_audit?: boolean;
  engagements_count?: number;
  open_findings_count?: number;
  risks_count?: number;
};

export type CoverageRow = {
  area_id: number;
  code: string;
  name: string;
  risk_score: number;
  risk_band: RiskBand;
  cycle_months: number;
  last_audited_on: string | null;
  months_since_audit: number | null;
  is_overdue_for_audit: boolean;
  has_audit_in_progress: boolean;
};

export type EngagementStatus = "planned" | "fieldwork" | "reporting" | "closed" | "cancelled";

export type EngagementType =
  | "operational"
  | "financial"
  | "compliance"
  | "it"
  | "follow_up"
  | "investigation";

export type AuditOpinion = "satisfactory" | "needs_improvement" | "unsatisfactory";

export type AuditEngagement = {
  id: number;
  engagement_number: string;
  area_id: number | null;
  title: string;
  type: EngagementType;
  status: EngagementStatus;
  lead_auditor_id: number | null;
  lead_auditor_name: string | null;
  /** The period under review, which is not the period of the audit. */
  period_from: string | null;
  period_to: string | null;
  planned_start_on: string | null;
  planned_end_on: string | null;
  actual_start_on: string | null;
  actual_end_on: string | null;
  planned_hours: number;
  actual_hours: number;
  objective: string | null;
  scope: string | null;
  opinion: AuditOpinion | null;
  conclusion: string | null;
  is_open?: boolean;
  is_overrunning?: boolean;
  /** Null until there is something to compare. */
  hours_variance?: number | null;
  area?: AuditArea | null;
  procedures?: AuditProcedure[];
  findings?: AuditFinding[];
  procedures_count?: number;
  findings_count?: number;
  open_findings_count?: number;
};

export type ProcedureConclusion =
  | "effective"
  | "partially_effective"
  | "ineffective"
  | "not_tested";

export type AuditProcedure = {
  id: number;
  engagement_id: number;
  reference: string;
  control_tested: string | null;
  description: string;
  population_size: number;
  sample_size: number;
  exceptions_found: number;
  conclusion: ProcedureConclusion;
  performed_by_id: number | null;
  performed_by_name: string | null;
  performed_on: string | null;
  notes: string | null;
  /** Exceptions over the sample examined, not the population. */
  exception_rate_percent?: number | null;
  coverage_percent?: number | null;
  engagement?: AuditEngagement | null;
};

export type Severity = "low" | "moderate" | "high" | "critical";

export type FindingStatus = "open" | "in_progress" | "resolved" | "closed" | "accepted_risk";

export type AuditFinding = {
  id: number;
  finding_number: string;
  engagement_id: number;
  procedure_id: number | null;
  area_id: number | null;
  title: string;
  /** The five elements. */
  condition: string | null;
  criteria: string | null;
  cause: string | null;
  effect: string | null;
  recommendation: string | null;
  severity: Severity;
  status: FindingStatus;
  identified_on: string;
  closed_on: string | null;
  financial_impact: Numeric;
  /** Detected from history, not asserted by whoever wrote the finding up. */
  is_repeat: boolean;
  repeat_of_id: number | null;
  management_response: string | null;
  is_open?: boolean;
  age_days?: number | null;
  days_to_close?: number | null;
  engagement?: AuditEngagement | null;
  area?: AuditArea | null;
  procedure?: AuditProcedure | null;
  actions?: AuditAction[];
  repeat_of?: AuditFinding | null;
  actions_count?: number;
  outstanding_actions_count?: number;
};

export type ActionStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type AuditAction = {
  id: number;
  finding_id: number;
  description: string;
  owner_name: string;
  owner_employee_id: number | null;
  due_on: string;
  status: ActionStatus;
  completed_on: string | null;
  /** Verification is audit's act, separate from management's completion. */
  verified_on: string | null;
  verified_by_id: number | null;
  verified_by_name: string | null;
  verification_note: string | null;
  /** Derived from the due date every read, never stored. */
  is_overdue?: boolean;
  is_verified?: boolean;
  days_overdue?: number | null;
  /** Negative when the action landed early. */
  days_late?: number | null;
  finding?: AuditFinding | null;
};

export type OutstandingAction = {
  action_id: number;
  finding_id: number;
  finding_number: string | null;
  finding_title: string | null;
  severity: Severity | null;
  description: string;
  owner: string;
  due_on: string | null;
  is_overdue: boolean;
  days_overdue: number | null;
};

export type RiskTreatment = "accept" | "mitigate" | "transfer" | "avoid";

export type RiskCategory =
  | "strategic"
  | "operational"
  | "financial"
  | "compliance"
  | "reputational";

export type AuditRisk = {
  id: number;
  area_id: number | null;
  code: string;
  title: string;
  category: RiskCategory | null;
  likelihood: number;
  impact: number;
  existing_controls: string | null;
  residual_likelihood: number;
  residual_impact: number;
  treatment: RiskTreatment;
  owner_name: string | null;
  reviewed_on: string | null;
  next_review_on: string | null;
  is_active: boolean;
  inherent_score?: number;
  residual_score?: number;
  risk_band?: RiskBand;
  control_effectiveness_percent?: number | null;
  is_review_overdue?: boolean;
  area?: AuditArea | null;
};

export type AuditOverview = {
  range: { from: string | null; to: string | null };
  remediation: {
    total: number;
    completed: number;
    outstanding: number;
    overdue: number;
    /** Always a subset of completed: the gap is work audit has not checked. */
    verified: number;
    awaiting_verification: number;
    on_time_percent: number;
    average_days_late: number;
    worst_overdue_days: number;
    overdue_by_severity: Array<{ severity: Severity; label: string; count: number }>;
  };
  findings: {
    total: number;
    open: number;
    closed: number;
    severe_open: number;
    accepted_risk: number;
    /** The measure that says whether fixes hold. */
    repeats: number;
    repeat_percent: number;
    financial_impact: Numeric;
    average_days_to_close: number;
    oldest_open_days: number;
    by_severity: Array<{ severity: Severity; label: string; count: number }>;
    by_status: Array<{ status: FindingStatus; label: string; count: number }>;
    by_area: Array<{
      area_id: number;
      area: string;
      risk_band: RiskBand;
      open_findings: number;
    }>;
  };
  engagements: {
    total: number;
    open: number;
    closed: number;
    overrunning: number;
    planned_hours: number;
    actual_hours: number;
    average_hours_variance: number;
    by_status: Array<{ status: EngagementStatus; label: string; count: number }>;
    by_opinion: Array<{ opinion: AuditOpinion; label: string; count: number }>;
  };
  coverage: {
    areas: number;
    overdue_for_audit: number;
    never_audited: number;
    high_risk_areas: number;
    high_risk_covered: number;
    high_risk_coverage_percent: number;
    by_band: Array<{ band: RiskBand; label: string; count: number }>;
  };
  risks: {
    total: number;
    review_overdue: number;
    accepted: number;
    average_control_effectiveness: number;
    /** A residual worse than inherent is a register to correct, not a finding. */
    impossible_residuals: number;
    by_band: Array<{ band: RiskBand; label: string; count: number }>;
    top: Array<{
      risk_id: number;
      code: string;
      title: string;
      category: RiskCategory | null;
      inherent_score: number;
      residual_score: number;
      risk_band: RiskBand;
      treatment: RiskTreatment;
      review_overdue: boolean;
    }>;
  };
  outstanding: OutstandingAction[];
  integrations: {
    human_resources: boolean;
    finance: boolean;
    procurement: boolean;
    inventory: boolean;
  };
};
