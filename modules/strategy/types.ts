/**
 * Strategic planning types (proposal §5.15).
 *
 * Organisation-level strategy, distinct from the Performance module which
 * measures individual people. Decimal casts arrive as strings over JSON, so
 * anything numeric is typed `Numeric` and coerced at the render boundary.
 */

export type Numeric = number | string | null;

export type Paginated<T> = {
  status: string;
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export type ScoreBand = "on_track" | "at_risk" | "off_track" | "unmeasured";

export type PlanStatus = "draft" | "active" | "closed" | "archived";

export type StrategyPlan = {
  id: number;
  code: string;
  name: string;
  vision: string | null;
  mission: string | null;
  starts_on: string;
  ends_on: string;
  status: PlanStatus;
  notes: string | null;
  /** How much of the plan's life has gone — the yardstick for any score. */
  elapsed_percent?: number;
  is_current?: boolean;
  /** Negative once the plan period has run out. */
  days_remaining?: number | null;
  objectives_count?: number;
  initiatives_count?: number;
};

export type StrategyPerspective = {
  id: number;
  plan_id: number;
  code: string;
  name: string;
  description: string | null;
  weight: Numeric;
  sort_order: number;
  objectives_count?: number;
};

export type ObjectiveStatus = "active" | "achieved" | "dropped";

export type StrategyObjective = {
  id: number;
  plan_id: number;
  perspective_id: number | null;
  parent_id: number | null;
  code: string;
  title: string;
  description: string | null;
  owner_name: string | null;
  owner_employee_id: number | null;
  department: string | null;
  weight: Numeric;
  status: ObjectiveStatus;
  perspective?: StrategyPerspective | null;
  kpis_count?: number;
  initiatives_count?: number;
  children?: StrategyObjective[];
  initiatives?: StrategyInitiative[];
  kpis?: StrategyKpi[];
};

export type KpiDirection = "higher_is_better" | "lower_is_better";

export type KpiFrequency = "monthly" | "quarterly" | "semiannual" | "annual";

export type StrategyKpi = {
  id: number;
  objective_id: number;
  code: string;
  name: string;
  unit: string | null;
  /** Decides how achievement is computed at all. */
  direction: KpiDirection;
  /** Achievement is the distance from here to target, not the ratio to target. */
  baseline_value: Numeric;
  target_value: Numeric;
  weight: Numeric;
  frequency: KpiFrequency;
  data_source: string | null;
  owner_name: string | null;
  is_active: boolean;
  latest_value?: number | null;
  /** Can exceed 100 or go negative — both are real. */
  achievement_percent?: number | null;
  /** The clamped figure that rolls up. */
  score?: number | null;
  status?: ScoreBand;
  is_stale?: boolean;
  objective?: StrategyObjective | null;
  readings?: StrategyKpiReading[];
};

export type StrategyKpiReading = {
  id: number;
  kpi_id: number;
  period_label: string;
  period_start: string;
  period_end: string;
  actual_value: Numeric;
  note: string | null;
  recorded_by_name: string | null;
  recorded_on: string | null;
};

export type InitiativeStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "cancelled";

export type StrategyInitiative = {
  id: number;
  plan_id: number;
  objective_id: number | null;
  project_id: number | null;
  code: string;
  name: string;
  description: string | null;
  owner_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  budget: Numeric;
  spent: Numeric;
  progress_percent: number;
  status: InitiativeStatus;
  /** Null with no budget: spending against nothing has no percentage. */
  budget_used_percent?: number | null;
  /** Burning budget faster than delivering progress. */
  is_overspending?: boolean;
  is_overdue?: boolean;
  is_open?: boolean;
  objective?: StrategyObjective | null;
};

export type StrategyReview = {
  id: number;
  plan_id: number;
  period_label: string;
  held_on: string;
  chaired_by: string | null;
  attendees: string | null;
  /** A snapshot of what the scorecard said on the day, deliberately frozen. */
  reported_score: Numeric;
  decisions: string | null;
  notes: string | null;
};

export type ScoredKpi = {
  kpi_id: number;
  code: string;
  name: string;
  unit: string | null;
  direction: KpiDirection;
  baseline: number;
  target: number;
  latest: number | null;
  achievement_percent: number | null;
  score: number | null;
  status: ScoreBand;
  is_stale: boolean;
  weight: number;
};

export type ScoredObjective = {
  objective_id: number;
  code: string;
  title: string;
  owner: string | null;
  department: string | null;
  weight: number;
  score: number | null;
  status: ScoreBand;
  kpi_count: number;
  measured_kpi_count: number;
  kpis: ScoredKpi[];
};

export type ScoredPerspective = {
  perspective_id: number | null;
  code: string;
  name: string;
  weight: number;
  score: number | null;
  status: ScoreBand;
  objectives: ScoredObjective[];
};

export type Scorecard = {
  plan: {
    id: number;
    code: string;
    name: string;
    status: PlanStatus;
    starts_on: string | null;
    ends_on: string | null;
    elapsed_percent: number;
    days_remaining: number | null;
  };
  score: number | null;
  status: ScoreBand;
  /** Score minus elapsed: positive is ahead of the plan's own clock. */
  pace: number | null;
  as_of?: string | null;
  measurement: { kpis: number; measured: number; unmeasured: number; stale: number };
  perspectives: ScoredPerspective[];
};

export type StrategyOverview = {
  plan: Scorecard["plan"] | null;
  score: number | null;
  status: ScoreBand;
  pace: number | null;
  measurement: { kpis: number; measured: number; unmeasured: number; stale: number };
  perspectives: ScoredPerspective[];
  objectives: {
    total: number;
    active: number;
    achieved: number;
    dropped: number;
    /** An objective with no KPI cannot be judged at all. */
    without_kpi: number;
    /** One with no initiative is an aspiration rather than a plan. */
    without_initiative: number;
    by_status: Array<{ band: ScoreBand; label: string; count: number }>;
    lagging: Array<{
      objective_id: number;
      code: string;
      title: string;
      owner: string | null;
      score: number | null;
      status: ScoreBand;
    }>;
  };
  kpis: {
    total: number;
    measured: number;
    stale: number;
    by_direction: Array<{ direction: KpiDirection; label: string; count: number }>;
    by_status: Array<{ band: ScoreBand; label: string; count: number }>;
    worst: ScoredKpi[];
  };
  initiatives: {
    total: number;
    open: number;
    completed: number;
    overdue: number;
    overspending: number;
    budget: Numeric;
    spent: Numeric;
    /** Weighted by budget, not a plain mean of progress percentages. */
    weighted_progress_percent: number;
    by_status: Array<{ status: InitiativeStatus; label: string; count: number }>;
    at_risk: Array<{
      initiative_id: number;
      code: string;
      name: string;
      owner: string | null;
      progress_percent: number;
      budget_used_percent: number | null;
      is_overdue: boolean;
      is_overspending: boolean;
      ends_on: string | null;
    }>;
  };
  reviews: Array<{
    review_id: number;
    period_label: string;
    held_on: string | null;
    chaired_by: string | null;
    reported_score: number | null;
  }>;
  plans: Array<{
    id: number;
    code: string;
    name: string;
    status: PlanStatus;
    is_current: boolean;
  }>;
  integrations: {
    human_resources: boolean;
    project_management: boolean;
    finance: boolean;
    performance: boolean;
  };
};
