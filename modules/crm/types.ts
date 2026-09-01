/**
 * CRM types (proposal §5.6).
 *
 * Decimal casts arrive as strings over JSON, so anything money-shaped is typed
 * `Numeric` and coerced at the render boundary.
 */

export type Numeric = number | string | null;

export type Paginated<T> = {
  status: string;
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export type CrmStage = {
  id: number;
  pipeline_id: number;
  name: string;
  position: number;
  probability_percent: number;
  is_won: boolean;
  is_lost: boolean;
};

export type CrmPipeline = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  stages?: CrmStage[];
};

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "disqualified";

export type CrmLead = {
  id: number;
  lead_number: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string | null;
  campaign_id: number | null;
  status: LeadStatus;
  score: number;
  estimated_value: Numeric;
  owner_employee_id: number | null;
  lost_reason: string | null;
  converted_account_id: number | null;
  converted_contact_id: number | null;
  converted_opportunity_id: number | null;
  converted_at: string | null;
  notes: string | null;
  is_open?: boolean;
  campaign?: CrmCampaign;
  activities?: CrmActivity[];
};

export type CrmAccount = {
  id: number;
  name: string;
  industry: string | null;
  segment: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  owner_employee_id: number | null;
  sales_customer_id: number | null;
  is_active: boolean;
  notes: string | null;
  contacts_count?: number;
  opportunities_count?: number;
  contacts?: CrmContact[];
  opportunities?: CrmOpportunity[];
};

export type CrmContact = {
  id: number;
  account_id: number | null;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  opted_out: boolean;
  owner_employee_id: number | null;
  notes: string | null;
  full_name?: string;
  account?: CrmAccount;
};

export type OpportunityStatus = "open" | "won" | "lost";

export type CrmStageHistory = {
  id: number;
  opportunity_id: number;
  from_stage_id: number | null;
  to_stage_id: number;
  days_in_previous_stage: number;
  changed_at: string;
  from_stage?: CrmStage | null;
  to_stage?: CrmStage;
};

export type CrmOpportunity = {
  id: number;
  opportunity_number: string;
  name: string;
  account_id: number | null;
  contact_id: number | null;
  pipeline_id: number;
  stage_id: number;
  owner_employee_id: number | null;
  lead_id: number | null;
  amount: Numeric;
  currency: string;
  probability_percent: number | null;
  expected_close_date: string | null;
  closed_on: string | null;
  status: OpportunityStatus;
  lost_reason: string | null;
  source: string | null;
  quotation_id: number | null;
  sales_order_id: number | null;
  notes: string | null;
  weighted_amount?: Numeric;
  effective_probability?: number;
  is_overdue?: boolean;
  age_days?: number;
  stage?: CrmStage;
  pipeline?: CrmPipeline;
  account?: CrmAccount;
  contact?: CrmContact;
  activities?: CrmActivity[];
  stage_history?: CrmStageHistory[];
};

export type ActivityType = "call" | "meeting" | "email" | "task" | "note";

export type CrmActivity = {
  id: number;
  type: ActivityType;
  subject: string;
  body: string | null;
  lead_id: number | null;
  account_id: number | null;
  contact_id: number | null;
  opportunity_id: number | null;
  owner_employee_id: number | null;
  status: "planned" | "done" | "cancelled";
  due_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  outcome: string | null;
  is_overdue?: boolean;
  lead?: CrmLead;
  account?: CrmAccount;
  contact?: CrmContact;
  opportunity?: CrmOpportunity;
};

export type CrmCampaign = {
  id: number;
  code: string;
  name: string;
  channel: string | null;
  starts_on: string | null;
  ends_on: string | null;
  budget: Numeric;
  actual_cost: Numeric;
  status: string;
  notes: string | null;
  leads_count?: number;
};

export type CrmBridgeStatus = {
  sales: { available: boolean; module: string };
};

export type CrmOverview = {
  range: { from: string | null; to: string | null };
  pipeline_id: number | null;
  pipeline_name: string | null;
  pipelines: Array<{ id: number; name: string; is_default: boolean }>;
  pipeline: {
    open_deals: number;
    open_value: Numeric;
    weighted_value: Numeric;
    average_deal_size: Numeric;
    overdue_deals: number;
    closing_this_month: number;
  };
  funnel: Array<{
    stage_id: number;
    stage: string;
    position: number;
    probability_percent: number;
    count: number;
    value: Numeric;
  }>;
  outcomes: {
    won: number;
    won_value: Numeric;
    lost: number;
    lost_value: Numeric;
    win_rate_percent: Numeric;
    average_cycle_days: Numeric;
    loss_reasons: Array<{ reason: string; count: number; value: Numeric }>;
  };
  velocity: Array<{ stage_id: number; stage: string; moves: number; average_days: Numeric }>;
  leads: {
    total: number;
    open: number;
    converted: number;
    disqualified: number;
    conversion_rate_percent: Numeric;
    average_score: Numeric;
    pipeline_value: Numeric;
    by_status: Array<{ status: string; label: string; count: number }>;
    by_source: Array<{ source: string; count: number; converted: number; value: Numeric }>;
  };
  activities: {
    total: number;
    outstanding: number;
    overdue: number;
    due_today: number;
    completed: number;
    by_type: Array<{ type: string; label: string; count: number; outstanding: number }>;
  };
  accounts: {
    total: number;
    contacts: number;
    converted_to_customers: number;
    top: Array<{
      account_id: number;
      account: string;
      deals: number;
      open_value: Numeric;
      won_value: Numeric;
    }>;
  };
  campaigns: Array<{
    campaign_id: number;
    name: string;
    channel: string | null;
    status: string;
    budget: Numeric;
    actual_cost: Numeric;
    leads: number;
    converted: number;
    cost_per_conversion: Numeric;
  }>;
};
