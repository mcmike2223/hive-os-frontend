import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";

export type HrSummary = {
  total: number;
  active: number;
  on_probation: number;
  contracts_expiring_soon: number;
  written_terms_missing: number;
  open_positions: number;
};

export type HrDashboardCategory = {
  key: string;
  label: string;
  value: number;
};

export type HrDashboardPayrollPoint = {
  period: string;
  label: string;
  gross: number;
  net: number;
  tax: number;
};

export type HrDashboardAttendancePoint = {
  date: string;
  label: string;
  present: number;
  exceptions: number;
  incomplete: number;
  absent: number;
};

export type HrDashboardData = {
  generated_at: string;
  timeframe_months: number;
  metrics: {
    total_employees: number;
    active_employees: number;
    on_probation: number;
    on_leave: number;
    assigned_employees: number;
    unassigned_employees: number;
    monthly_gross_payroll: number;
    monthly_net_payroll: number;
    payroll_period_label: string | null;
    payroll_records: number;
    active_applicants: number;
    published_vacancies: number;
    open_positions: number;
    contracts_expiring_soon: number;
    written_terms_missing: number;
    attendance_today: {
      recorded: number;
      present: number;
      exceptions: number;
      late: number;
    };
    pending_leave_requests: number;
  };
  charts: {
    payroll_trend: HrDashboardPayrollPoint[];
    payroll_breakdown: HrDashboardCategory[];
    headcount_by_unit: HrDashboardCategory[];
    recruitment_pipeline: HrDashboardCategory[];
    employment_status: HrDashboardCategory[];
    contract_types: HrDashboardCategory[];
    attendance_outcomes: HrDashboardAttendancePoint[];
    leave_statuses: HrDashboardCategory[];
  };
  sources: {
    employees: number;
    current_primary_assignments: number;
    payslips_in_timeframe: number;
    job_postings: number;
    applicants: number;
    attendance_records_last_7_days: number;
    leave_requests: number;
  };
};

export type OrganizationUnit = {
  id: number;
  code: string;
  name: string;
  unit_type: string;
  parent_id: number | null;
  cost_center_code: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  positions_count?: number;
  active_assignments_count?: number;
};

export type Position = {
  id: number;
  organization_unit_id: number;
  code: string;
  title: string;
  description: string | null;
  employment_type_code: string | null;
  job_grade_code: string | null;
  authorized_headcount: number;
  occupied_headcount: number;
  vacant_headcount: number;
  is_managerial: boolean;
  is_safety_sensitive: boolean;
  is_active: boolean;
  organization_unit?: OrganizationUnit;
};

export type Assignment = {
  id: number;
  organization_unit_id: number;
  position_id: number;
  reports_to_employee_id: number | null;
  assignment_type: string;
  started_on: string;
  ended_on: string | null;
  full_time_equivalent: number;
  hours_per_day: number;
  hours_per_week: number;
  is_primary: boolean;
  organization_unit?: OrganizationUnit;
  position?: Position;
  reports_to?: {
    id: number;
    employee_number: string;
    primary_name: string;
  } | null;
};

export type Employee = {
  id: number;
  user_id: number | null;
  employee_number: string;
  primary_name: string;
  preferred_name: string | null;
  work_email: string | null;
  personal_email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender_code: string | null;
  nationality_code: string | null;
  work_card_number: string | null;
  employment_status: string;
  employment_regime: string;
  hired_on: string;
  terminated_on: string | null;
  contract_type: string;
  contract_reference: string | null;
  contract_started_on: string;
  contract_ends_on: string | null;
  fixed_term_reason: string | null;
  contract_signed_at: string | null;
  written_terms_issued_at: string | null;
  probation_working_days: number;
  probation_ends_on: string | null;
  profile_photo_path?: string | null;
  primary_assignment?: Assignment | null;
};

export type OrganigramPayload = {
  data: Employee[];
  units: OrganizationUnit[];
  positions: Position[];
  meta: {
    total_employees: number;
    assigned_employees: number;
    unassigned_employees: number;
    reporting_roots: number;
    vacant_positions: number;
  };
};

export type LeaveType = {
  id: number;
  code: string;
  name: string;
  day_basis: "working_days" | "calendar_days";
  is_paid: boolean;
  tracks_balance: boolean;
  requires_document: boolean;
  default_entitlement_days: number | null;
  legal_source: string | null;
  is_active: boolean;
};

export type LeaveAccrualRule = {
  id: number;
  frequency:
    | "daily"
    | "monthly"
    | "yearly"
    | "anniversary"
    | "pay_period"
    | "hours_worked";
  amount: number;
  accrual_day: number | null;
  service_tiers: Array<{ minimum_years: number; amount: number }> | null;
  maximum_per_period: number | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
};

export type LeavePlanRule = {
  id: number;
  leave_type_id: number;
  entitlement_days: number | null;
  allocation_method: string;
  unit: "days" | "hours";
  rounding_mode: "nearest" | "up" | "down";
  rounding_precision: number;
  maximum_balance: number | null;
  carry_forward_limit: number | null;
  carry_forward_expiry_days: number | null;
  negative_balance_limit: number;
  waiting_period_days: number;
  prorate_on_hire: boolean;
  prorate_on_termination: boolean;
  encashment_allowed: boolean;
  leave_type: LeaveType;
  accrual_rules: LeaveAccrualRule[];
};

export type LeavePlanVersion = {
  id: number;
  leave_plan_id: number;
  version_number: number;
  status: "draft" | "active" | "retired";
  effective_from: string;
  effective_to: string | null;
  eligibility_rules: Record<string, unknown> | null;
  combination_mode: "exclusive" | "combine";
  legal_reference: string | null;
  change_summary: string | null;
  published_at: string | null;
  rules: LeavePlanRule[];
};

export type LeavePlan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  country_code: string;
  priority: number;
  is_default: boolean;
  status: "draft" | "active" | "retired";
  assignments_count: number;
  versions: LeavePlanVersion[];
};

export type LeavePlanAssignment = {
  id: number;
  leave_plan_id: number;
  employee_id: number | null;
  organization_unit_id: number | null;
  position_id: number | null;
  employment_type_code: string | null;
  job_grade_code: string | null;
  contract_type: string | null;
  is_default: boolean;
  priority: number;
  effective_from: string;
  effective_to: string | null;
  status: "active" | "inactive";
  scope_label: string;
  plan: Pick<LeavePlan, "id" | "code" | "name">;
  employee?: Employee | null;
  organization_unit?: OrganizationUnit | null;
  position?: Position | null;
};

export type LeaveAllocation = {
  id: number;
  source: "manual" | "opening_balance" | "one_time" | "accrual";
  effective_on: string;
  quantity: number;
  unit: "days" | "hours";
  status: string;
  explanation: string | null;
  employee: Employee;
  leave_type: LeaveType;
  plan_version?: LeavePlanVersion & {
    plan?: Pick<LeavePlan, "id" | "code" | "name">;
  };
};

export type LeaveAccrualRun = {
  id: string;
  as_of_date: string;
  status: "queued" | "running" | "completed" | "completed_with_errors";
  idempotency_key: string;
  employees_processed: number;
  transactions_posted: number;
  items_skipped: number;
  errors_count: number;
  transactions_count?: number;
  started_at: string | null;
  completed_at: string | null;
};

export type LeaveLedgerTransaction = {
  id: number;
  transaction_type: string;
  effective_on: string;
  quantity: number;
  unit: "days" | "hours";
  entitlement_delta: number;
  carried_delta: number;
  adjusted_delta: number;
  reserved_delta: number;
  used_delta: number;
  idempotency_key: string;
  posted_at: string;
  note: string | null;
  employee: Employee;
  leave_type: LeaveType;
  allocation?: LeaveAllocation | null;
};

export type LeaveBalance = {
  id: number;
  balance_year: number;
  entitled_days: number;
  carried_days: number;
  adjusted_days: number;
  reserved_days: number;
  used_days: number;
  available_days: number;
  leave_type: LeaveType;
};

export type LeaveRequest = {
  id: number;
  request_number: string | null;
  employee_id: number;
  leave_type_id: number;
  leave_plan_version_id: number | null;
  starts_on: string;
  ends_on: string;
  segment_type:
    | "full_day"
    | "multi_day"
    | "first_half"
    | "second_half"
    | "hourly";
  starts_at: string | null;
  ends_at: string | null;
  requested_days: number;
  requested_hours: number;
  status: string;
  reason?: string | null;
  delegate_employee_id?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  calculation_snapshot?: LeaveRequestPreview | null;
  workflow_run_id?: string | null;
  resubmission_count?: number;
  submitted_at: string | null;
  decided_at?: string | null;
  actual_return_on?: string | null;
  withdrawn_at?: string | null;
  returned_at?: string | null;
  decision_note?: string | null;
  workflow_status?: "pending" | "approved" | "rejected" | null;
  employee?: Employee;
  leave_type: LeaveType;
  delegate?: Employee | null;
  segments?: LeaveRequestSegment[];
  attachments?: LeaveAttachment[];
  lifecycle_events?: LeaveLifecycleEvent[];
  approvals?: LeaveWorkflowApproval[];
  cancellation_requests?: LeaveCancellationRequest[];
  return_requests?: LeaveReturnRequest[];
};

export type LeaveRequestSegment = {
  id: number;
  work_date: string;
  segment_type: LeaveRequest["segment_type"];
  starts_at: string | null;
  ends_at: string | null;
  scheduled_minutes: number;
  requested_minutes: number;
  requested_days: number;
  is_chargeable: boolean;
  exclusion_reason: string | null;
  pay_percentage: number;
  time_code: string | null;
};

export type LeaveAttachment = {
  id: number;
  media_id: number | null;
  original_name: string;
  mime_type: string | null;
  size: number | null;
  category: string;
  download_url: string;
};

export type LeaveLifecycleEvent = {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  workflow_run_id: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

export type LeaveWorkflowApproval = {
  id: number;
  sequence: number;
  status: string;
  notes?: string | null;
  actioned_at?: string | null;
  user?: { id: number; name: string } | null;
  role?: { id: number; name: string } | null;
};

export type LeaveCancellationRequest = {
  id: number;
  status: string;
  reason: string;
  workflow_status: "pending" | "approved" | "rejected" | null;
  submitted_at: string | null;
  decided_at: string | null;
};

export type LeaveReturnRequest = {
  id: number;
  requested_return_on: string;
  quantity_to_restore: number;
  status: string;
  reason: string | null;
  workflow_status: "pending" | "approved" | "rejected" | null;
  submitted_at: string | null;
  decided_at: string | null;
};

export type LeaveRequestPreview = {
  calendar_days: number;
  chargeable_days: number;
  requested_hours: number;
  paid_days: number;
  unpaid_days: number;
  excluded_holidays: Array<{ date: string; name: string }>;
  excluded_rest_days: string[];
  balance_before: number | null;
  balance_after: number | null;
  negative_balance_limit: number;
  requires_document: boolean;
  supporting_documents_received: number;
  segments: Array<{
    work_date: string;
    segment_type: LeaveRequest["segment_type"];
    starts_at: string | null;
    ends_at: string | null;
    requested_days: number;
    requested_minutes: number;
    is_chargeable: boolean;
    exclusion_reason: string | null;
    pay_percentage: number;
  }>;
  leave_plan: {
    id: number;
    version_id: number;
    version_number: number;
    rule_id: number | null;
  } | null;
  schedule: {
    id: number;
    code: string;
    name: string;
    timezone: string;
  } | null;
  attendance_conflicts: number;
  warnings: string[];
  blocking_reasons: string[];
  is_submittable: boolean;
  calculated_at: string;
  workflow: {
    configured: boolean;
    definition_id?: number | null;
    definition_name?: string | null;
    approver_count?: number;
    required_approvals?: number;
    route?: Array<{
      sequence: number;
      type: "user" | "role";
      id: number;
      label: string;
    }>;
    configuration_error?: string | null;
  };
};

export type LocalizedReferenceName = {
  en?: string;
  am?: string;
};

export type ReferenceOption = {
  value: number;
  code: string | null;
  label: LocalizedReferenceName;
  parent_id: number | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type WorkSchedule = {
  id: number;
  code: string;
  name: string;
  timezone: string;
  working_days: number[];
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  grace_minutes: number;
  weekly_hours: number;
  is_night_shift: boolean;
  is_active: boolean;
};

export type AttendanceRecord = {
  id: number;
  attendance_date: string;
  first_in_at: string | null;
  last_out_at: string | null;
  worked_minutes: number;
  late_minutes: number;
  early_departure_minutes: number;
  overtime_minutes: number;
  status: string;
  employee: Employee;
  work_schedule?: WorkSchedule | null;
};

export type AttendanceSummary = {
  date: string;
  scheduled: number;
  recorded: number;
  absent: number;
  present: number;
  exceptions: number;
  late: number;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    from?: number;
    to?: number;
  };
};

export async function hrFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getBackendApiRoot()}/hr${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(
        options.body ? { "Content-Type": "application/json" } : {},
      ),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const validation = payload?.errors
      ? Object.values(payload.errors)
          .flat()
          .find((item) => typeof item === "string")
      : null;
    throw new Error(
      typeof validation === "string"
        ? validation
        : payload?.message ||
            `HR request failed with status ${response.status}.`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function hrReferenceOptions(
  catalog: string,
): Promise<ReferenceOption[]> {
  const response = await fetch(
    `${getBackendApiRoot()}/hr/settings/${encodeURIComponent(catalog)}/options`,
    { headers: getAuthHeaders() },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.message ||
        `HR reference options failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as { data?: ReferenceOption[] };
  return payload.data ?? [];
}

export type HrPolicy = {
  id: number;
  tenant_id: string;
  code: string;
  title: string;
  category: string;
  description: string | null;
  version: string;
  effective_date: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  has_file: boolean;
  download_url: string | null;
  is_active: boolean;
  target_roles: string[];
  target_department_ids: number[];
  created_at: string;
  updated_at: string;
};

export type HrLetterTemplate = {
  id: number;
  tenant_id: string;
  slug: string;
  title: string;
  body_html: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchHrLetterTemplates(): Promise<HrLetterTemplate[]> {
  return hrFetch<HrLetterTemplate[]>("/forms/templates");
}

export async function createHrLetterTemplate(payload: {
  title: string;
  body_html: string;
}): Promise<HrLetterTemplate> {
  return hrFetch<HrLetterTemplate>("/forms/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function hrUploadFetch<T>(
  path: string,
  formData: FormData,
  method: string = "POST",
): Promise<T> {
  const headers = { ...getAuthHeaders() };
  // Let browser auto-set Content-Type header with multipart boundary
  delete (headers as Record<string, string>)["Content-Type"];

  const response = await fetch(`${getBackendApiRoot()}/hr${path}`, {
    method,
    headers,
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const validation = payload?.errors
      ? Object.values(payload.errors)
          .flat()
          .find((item) => typeof item === "string")
      : null;
    throw new Error(
      typeof validation === "string"
        ? validation
        : payload?.message || `HR upload request failed with status ${response.status}.`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export function referenceOptionLabel(option: ReferenceOption): string {
  return (
    option.label.en?.trim() ||
    option.label.am?.trim() ||
    option.code ||
    "Unnamed value"
  );
}
