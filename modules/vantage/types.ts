/**
 * Vantage — business intelligence types (proposal §5.16).
 *
 * The type that matters most here is the availability shape: a widget is
 * either available with a value, or unavailable with a reason. There is no
 * third state where it quietly shows zero.
 */

export type Numeric = number | string | null;

export type Paginated<T> = {
  status: string;
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export type Aggregation = "count" | "count_distinct" | "sum" | "avg" | "min" | "max";

export type MetricFormat = "number" | "currency" | "percent" | "duration";

export type MetricDirection = "higher_is_better" | "lower_is_better";

export type WidgetVisual = "stat" | "bar" | "column" | "trend" | "table";

export type VantageDataset = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  /** Which module owns the table, so an unavailable source can say what to buy. */
  module_slug: string | null;
  source_table: string;
  date_column: string | null;
  measure_columns: string | null;
  dimension_columns: string | null;
  is_active: boolean;
  /** Checked live against the schema, never cached on the row. */
  is_available?: boolean;
  /** The allowlists, parsed. Nothing outside these may be aggregated or grouped. */
  measures?: string[];
  dimensions?: string[];
  metrics_count?: number;
};

export type VantageMetric = {
  id: number;
  dataset_id: number;
  code: string;
  name: string;
  description: string | null;
  aggregation: Aggregation;
  measure_column: string | null;
  /** Equality filters only, as `column=value` pairs. */
  filters: string | null;
  unit: string | null;
  format: MetricFormat;
  direction: MetricDirection;
  target_value: Numeric;
  is_active: boolean;
  filter_pairs?: Record<string, string>;
  dataset?: VantageDataset | null;
};

export type VantageDashboard = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  owner_name: string | null;
  is_shared: boolean;
  is_default: boolean;
  widgets_count?: number;
};

export type RenderedWidget = {
  widget_id: number;
  title: string;
  visual: WidgetVisual;
  width: number;
  range_days: number;
  metric: {
    id: number;
    code: string;
    name: string;
    unit: string | null;
    format: MetricFormat;
    direction: MetricDirection;
    target: number | null;
    dataset: string | null;
    module_slug: string | null;
  } | null;
  /** False means the source could not be read; `value` is then null, not zero. */
  available: boolean;
  reason: string | null;
  value: number | null;
  previous_value?: number | null;
  /** Null whenever a like-for-like change cannot honestly be computed. */
  change_percent?: number | null;
  rows: Array<{ label: string; value: number }>;
  points: Array<{ label: string; value: number | null }>;
  /** What was reported at the time, alongside the live series. */
  reported?: Array<{ label: string; value: number | null; captured_on: string | null }>;
  breakdown_column?: string | null;
};

export type VantageAlertRow = {
  alert_id: number;
  name: string;
  metric: string | null;
  comparison: "above" | "below";
  threshold: number;
  /** Null when the metric could not be read — which is not a breach. */
  last_value: number | null;
  is_triggered: boolean;
  last_evaluated_at: string | null;
};

export type VantageAlert = {
  id: number;
  metric_id: number;
  name: string;
  comparison: "above" | "below";
  threshold: Numeric;
  range_days: number;
  is_active: boolean;
  last_evaluated_at: string | null;
  last_triggered_at: string | null;
  last_value: Numeric;
  is_triggered?: boolean;
  metric?: VantageMetric | null;
};

export type VantageOverview = {
  dashboard: { id: number; code: string; name: string; description: string | null } | null;
  widgets: RenderedWidget[];
  coverage: {
    datasets: number;
    available: number;
    unavailable: number;
    metrics: number;
    sources: Array<{
      dataset_id: number;
      code: string;
      name: string;
      module_slug: string | null;
      source_table: string;
      is_available: boolean;
      metric_count: number;
    }>;
  };
  alerts: {
    total: number;
    active: number;
    triggered: number;
    /** Never evaluated is how you tell the scheduler is not running. */
    never_evaluated: number;
    rows: VantageAlertRow[];
  };
  dashboards: Array<{ id: number; code: string; name: string; is_default: boolean }>;
};

export type MetricEvaluation = {
  metric: RenderedWidget["metric"];
  range_days: number;
  available: boolean;
  reason: string | null;
  value: number | null;
  matched_rows: number;
  previous_value: number | null;
  series: { available: boolean; reason: string | null; points: Array<{ label: string; value: number | null }> };
  reported: Array<{ label: string; value: number | null; captured_on: string | null }>;
  breakdown?: {
    available: boolean;
    reason: string | null;
    rows: Array<{ label: string; value: number }>;
  };
};
