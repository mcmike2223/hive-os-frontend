import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";

export type HrSummary = {
  total: number;
  active: number;
  on_probation: number;
  contracts_expiring_soon: number;
  written_terms_missing: number;
  open_positions: number;
};

export type ComplianceValidationFinding = {
  code: string;
  severity: "ok" | "warning" | "error";
  message: string;
};

export type ComplianceValidation = {
  validated_at: string;
  can_activate: boolean;
  findings: ComplianceValidationFinding[];
};

export type CompliancePolicyVersion = {
  id: number;
  preset_key: string;
  preset_revision: string;
  policy_version: string;
  name: string;
  jurisdiction: string;
  employment_regime: string;
  legal_instrument: string;
  legal_source_url: string;
  legal_source_hash: string;
  effective_from: string;
  effective_to: string | null;
  status: "draft" | "reviewed" | "active" | "retired";
  rules: {
    employment_terms: {
      minimum_working_age: number;
      maximum_probation_working_days: number;
      written_terms_due_days: number;
    };
    working_time: {
      maximum_hours_per_day: number;
      maximum_hours_per_week: number;
      weekly_rest_minimum_hours: number;
      overtime_requires_authorization: boolean;
      overtime_maximum_hours_per_day: number;
      overtime_maximum_hours_per_week: number;
      overtime_multipliers: {
        day: number;
        night: number;
        weekly_rest: number;
        public_holiday: number;
      };
    };
    leave: {
      annual: {
        first_year_working_days: number;
        additional_working_days: number;
        additional_service_year_interval: number;
        carry_forward_maximum_years: number;
      };
      family_event_paid_working_days: number;
      paternity_paid_consecutive_days: number;
      special_unpaid_consecutive_days: number;
      maternity: {
        prenatal_paid_consecutive_days: number;
        postnatal_paid_consecutive_days: number;
      };
      sick: {
        maximum_months_in_twelve_months: number;
        payment_tiers: Array<{
          months: number;
          pay_percentage: number;
        }>;
      };
    };
    young_workers: {
      age_limit: number;
      maximum_hours_per_day: number;
      night_work_prohibited: boolean;
      overtime_prohibited: boolean;
    };
    record_retention: {
      years: number | null;
      requires_legal_determination: boolean;
      note: string;
    };
    localization: {
      timezone: string;
      display_calendars: string[];
      timezone_is_tenant_configurable: boolean;
    };
  };
  source_metadata: {
    verified_on: string;
    legal_advice: boolean;
    requires_hr_legal_review: boolean;
    citations: Array<{
      topic: string;
      article: string;
      source_url: string;
    }>;
  };
  validation_snapshot: ComplianceValidation | null;
  legal_reviewer_name: string | null;
  legal_review_note: string | null;
  legal_reviewed_at: string | null;
  activated_at: string | null;
  retired_at: string | null;
  is_active: boolean;
};

export type CompliancePolicyWorkspace = {
  preset: Omit<
    CompliancePolicyVersion,
    | "id"
    | "policy_version"
    | "effective_from"
    | "effective_to"
    | "status"
    | "validation_snapshot"
    | "legal_reviewer_name"
    | "legal_review_note"
    | "legal_reviewed_at"
    | "activated_at"
    | "retired_at"
    | "is_active"
  >;
  active_policy: CompliancePolicyVersion | null;
  versions: CompliancePolicyVersion[];
  validation: Record<string, ComplianceValidation>;
  disclaimer: string;
};

export type WorkforceReadinessCheck = {
  key: string;
  status: "ready" | "attention" | "blocked";
  summary: string;
  evidence: Record<string, string | number | boolean | null | string[]>;
};

export type WorkforceReadiness = {
  status: "ready" | "attention" | "blocked";
  tenant_id: string;
  generated_at: string;
  checks: WorkforceReadinessCheck[];
  summary: {
    ready: number;
    attention: number;
    blocked: number;
  };
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
  custom_fields?: Record<string, unknown> | null;
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
    "full_day" | "multi_day" | "first_half" | "second_half" | "hourly";
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
  category: string;
  color: string;
  shift_type: string;
  timezone: string;
  working_days: number[];
  starts_at: string;
  ends_at: string;
  intervals: Array<{ starts_at: string; ends_at: string }> | null;
  break_minutes: number;
  grace_minutes: number;
  rules: {
    minimum_rest_minutes?: number;
    maximum_weekly_minutes?: number;
    check_in_window_minutes?: number;
    check_out_window_minutes?: number;
    overtime_eligible?: boolean;
    required_skills?: string[];
  } | null;
  required_headcount: number;
  effective_from: string | null;
  effective_to: string | null;
  version: number;
  weekly_hours: number;
  is_night_shift: boolean;
  is_active: boolean;
};

export type ScheduleTemplateDay = {
  id: number;
  cycle_day: number;
  work_schedule_id: number | null;
  label: string | null;
  is_rest_day: boolean;
  break_minutes_override: number | null;
  work_schedule?: WorkSchedule | null;
};

export type ScheduleTemplate = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  timezone: string;
  cycle_length_days: number;
  rotation_direction: "forward" | "backward";
  anchor_date: string;
  holiday_treatment: "use_shift" | "rest_day" | "alternate_shift";
  effective_from: string;
  effective_to: string | null;
  version: number;
  is_active: boolean;
  days: ScheduleTemplateDay[];
};

export type ScheduleResolution = {
  source_type:
    | "temporary_schedule"
    | "roster_entry"
    | "employee_schedule"
    | "schedule_assignment"
    | "schedule_template";
  source_id: number;
  work_date: string;
  work_schedule_id: number | null;
  is_rest_day: boolean;
  explicit_day: boolean;
  cycle_day: number | null;
  metadata: Record<string, unknown>;
};

export type ScheduleTimelineDay = {
  date: string;
  resolution: ScheduleResolution | null;
  work_schedule: WorkSchedule | null;
};

export type ScheduleEmployeeOption = Pick<
  Employee,
  "id" | "user_id" | "employee_number" | "primary_name" | "preferred_name"
>;

export type TemporarySchedule = {
  id: number;
  request_number: string;
  employee_id: number;
  work_schedule_id: number | null;
  starts_on: string;
  ends_on: string;
  is_rest_day: boolean;
  reason_type: string;
  reason: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "withdrawn";
  workflow_status: "pending" | "approved" | "rejected" | null;
  submitted_at: string | null;
  decided_at: string | null;
  employee?: Employee;
  work_schedule?: WorkSchedule | null;
};

export type ShiftSwapRequest = {
  id: number;
  request_number: string;
  requester_employee_id: number;
  counterparty_employee_id: number;
  requester_work_date: string;
  counterparty_work_date: string;
  requester_work_schedule_id: number;
  counterparty_work_schedule_id: number;
  reason: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "withdrawn";
  workflow_status: "pending" | "approved" | "rejected" | null;
  submitted_at: string | null;
  decided_at: string | null;
  applied_at: string | null;
  requester_employee?: Employee;
  counterparty_employee?: Employee;
  requester_work_schedule?: WorkSchedule;
  counterparty_work_schedule?: WorkSchedule;
};

export type RosterConflict = {
  code: string;
  severity: "error" | "warning" | "info";
  blocking: boolean;
  message: string;
  employee_id: number | null;
  work_date: string;
  work_schedule_id: number | null;
  metadata: Record<string, unknown>;
};

export type RosterEntry = {
  id: number;
  employee_id: number | null;
  work_schedule_id: number | null;
  work_date: string;
  cycle_day: number | null;
  slot_key: string;
  is_rest_day: boolean;
  is_open: boolean;
  status: string;
  employee?: Employee | null;
  work_schedule?: WorkSchedule | null;
};

export type RosterPeriod = {
  id: number;
  code: string;
  name: string;
  schedule_template_id: number;
  organization_unit_id: number | null;
  starts_on: string;
  ends_on: string;
  status: "draft" | "published" | "superseded" | "archived";
  conflict_summary: RosterConflict[] | null;
  published_at: string | null;
  template?: ScheduleTemplate;
  entries: RosterEntry[];
};

export type SchedulingWorkspace = {
  employee: Employee | null;
  swap_candidates: ScheduleEmployeeOption[];
  timeline: ScheduleTimelineDay[];
  work_schedules: WorkSchedule[];
  templates: ScheduleTemplate[];
  assignments: Array<{
    id: number;
    scope_type: string;
    employee_id?: number | null;
    priority: number;
    effective_from: string;
    effective_to: string | null;
    template?: ScheduleTemplate;
    employee?: Employee | null;
    organization_unit?: OrganizationUnit | null;
    position?: Position | null;
  }>;
  temporary_schedules: TemporarySchedule[];
  shift_swaps: ShiftSwapRequest[];
  rosters: RosterPeriod[];
  permissions: {
    can_manage: boolean;
    can_manage_shifts: boolean;
    can_manage_templates: boolean;
    can_manage_rosters: boolean;
    can_request_swap: boolean;
    can_create_temporary: boolean;
  };
};

export type AttendanceRecord = {
  id: number;
  attendance_date: string;
  first_in_at: string | null;
  last_out_at: string | null;
  scheduled_minutes: number;
  expected_work_minutes: number;
  leave_minutes: number;
  holiday_minutes: number;
  worked_minutes: number;
  payable_minutes: number;
  break_minutes: number;
  late_minutes: number;
  early_departure_minutes: number;
  overtime_minutes: number;
  status: string;
  source: string;
  reconciliation_status: string | null;
  reconciled_at: string | null;
  calculation_version: number;
  current_calculation_id: number | null;
  calculated_at: string | null;
  employee: Employee;
  work_schedule?: WorkSchedule | null;
  current_calculation?: AttendanceCalculation | null;
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

export type AttendanceEventType =
  "clock_in" | "clock_out" | "break_start" | "break_end";

export type AttendanceEvent = {
  id: number;
  event_uuid: string;
  employee_id: number;
  attendance_date: string;
  organization_unit_id: number | null;
  work_schedule_id: number | null;
  attendance_record_id: number | null;
  external_employee_identifier: string | null;
  occurred_at: string;
  server_received_at: string;
  source_timezone: string;
  organization_timezone: string;
  event_type: AttendanceEventType;
  attendance_method: "self_service_web" | "manual_web" | string;
  source: "self_service" | "manual" | string;
  location_label: string | null;
  processing_status: "received" | "processing" | "processed" | "failed";
  processed_at: string | null;
  employee?: Employee;
  work_schedule?: WorkSchedule | null;
  attendance_record?: AttendanceRecord | null;
};

export type AttendanceSelfServiceStatus = {
  date: string;
  timezone: string;
  state: "off_duty" | "on_duty" | "on_break";
  next_actions: AttendanceEventType[];
  last_event: AttendanceEvent | null;
  events: AttendanceEvent[];
  record: AttendanceRecord | null;
};

export type AttendanceCaptureMethod =
  "barcode" | "permanent_qr" | "dynamic_qr" | "rfid" | "nfc" | "pin";

export type AttendanceCredential = {
  id: number;
  employee_id: number;
  credential_type: Exclude<AttendanceCaptureMethod, "dynamic_qr">;
  identifier_hint: string;
  label: string | null;
  status: "active" | "revoked";
  effective_from: string;
  effective_to: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  employee?: Pick<Employee, "id" | "employee_number" | "primary_name">;
};

export type KioskStation = {
  id: number;
  organization_unit_id: number | null;
  station_code: string;
  name: string;
  token_hint: string | null;
  allowed_methods: AttendanceCaptureMethod[];
  timezone: string;
  is_active: boolean;
  last_seen_at: string | null;
  credential_rotated_at: string | null;
  organization_unit?: OrganizationUnit | null;
};

export type DynamicQrSession = {
  id: number;
  public_id: string;
  employee_id: number | null;
  kiosk_station_id: number | null;
  mode: "employee" | "workplace";
  expires_at: string;
  maximum_uses: number;
  use_count: number;
  last_used_at: string | null;
  revoked_at: string | null;
  employee?: Pick<Employee, "id" | "employee_number" | "primary_name"> | null;
  kiosk_station?: Pick<KioskStation, "id" | "station_code" | "name"> | null;
};

export type AttendanceScanAttempt = {
  id: number;
  attempt_uuid: string;
  kiosk_station_id: number | null;
  employee_id: number | null;
  attendance_event_id: number | null;
  capture_method: AttendanceCaptureMethod;
  event_type: AttendanceEventType;
  outcome: "accepted" | "rejected";
  reason_code: string | null;
  idempotency_key: string;
  occurred_at: string;
  received_at: string;
  station?: Pick<KioskStation, "id" | "station_code" | "name"> | null;
  employee?: Pick<Employee, "id" | "employee_number" | "primary_name"> | null;
  attendance_event?: Pick<
    AttendanceEvent,
    "id" | "event_uuid" | "processing_status"
  > | null;
};

export type AttendanceCaptureWorkspace = {
  stations: KioskStation[];
  credentials: AttendanceCredential[];
  dynamic_qr_sessions: DynamicQrSession[];
  scan_attempts: AttendanceScanAttempt[];
  permissions: {
    can_view: boolean;
    can_manage_devices: boolean;
    can_manage_credentials: boolean;
    can_operate_kiosk: boolean;
    can_view_audit: boolean;
  };
  capture_methods: Array<{
    value: AttendanceCaptureMethod;
    label: string;
  }>;
};

export type AttendanceDeviceAdapterOption = {
  value: "generic_webhook" | "local_connector" | "suprema_biostar2" | "mock";
  label: string;
  transport: "webhook" | "local_connector" | "polling" | "mock";
  requires_api_credentials: boolean;
};

export type AttendanceDeviceCredential = {
  id: number;
  attendance_device_id: number;
  key_id: string;
  credential_type: "connector_hmac" | "biostar2_api";
  principal_hint: string | null;
  secret_hint: string;
  status: "active" | "revoked";
  expires_at: string | null;
  last_used_at: string | null;
  rotated_at: string;
};

export type AttendanceDevice = {
  id: number;
  device_code: string;
  name: string;
  adapter_type: AttendanceDeviceAdapterOption["value"];
  transport: AttendanceDeviceAdapterOption["transport"];
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  timezone: string;
  status: string;
  health_status: "unknown" | "healthy" | "degraded" | "unhealthy";
  last_seen_at: string | null;
  last_health_at: string | null;
  configuration: {
    base_url?: string;
    biostar_device_id?: string;
    verify_tls?: boolean;
    allow_http?: boolean;
    event_limit?: number;
    tna_key_map?: Record<string, string>;
  } | null;
  credentials?: AttendanceDeviceCredential[];
  employee_mappings_count: number;
  attendance_events_count: number;
};

export type AttendanceDeviceDiscovery = {
  device_code: string;
  adapter_type: "suprema_biostar2";
  source: "BioStar 2 New Local API";
  devices: Array<{
    id: string;
    name: string;
    model: string | null;
    serial_number: string | null;
    status: string | null;
  }>;
  users: Array<{
    user_id: string;
    name: string;
    user_group_id: string;
    user_group_name: string | null;
    disabled: boolean;
  }>;
  device_count: number;
  user_count: number;
  fetched_at: string;
};

export type DeviceEmployeeMapping = {
  id: number;
  attendance_device_id: number;
  employee_id: number;
  external_identifier_hint: string;
  status: "active" | "inactive";
  effective_from: string | null;
  effective_to: string | null;
  device?: Pick<AttendanceDevice, "id" | "device_code" | "name">;
  employee?: Pick<Employee, "id" | "employee_number" | "primary_name">;
};

export type AttendanceImportBatch = {
  id: number;
  batch_uuid: string;
  attendance_device_id: number;
  original_filename: string;
  file_format: string;
  status: "queued" | "processing" | "completed" | "partial" | "failed";
  total_rows: number;
  accepted_rows: number;
  duplicate_rows: number;
  rejected_rows: number;
  error_summary: { message?: string } | null;
  created_at: string;
  device?: Pick<AttendanceDevice, "id" | "device_code" | "name">;
};

export type AttendanceSyncJob = {
  id: number;
  job_uuid: string;
  attendance_device_id: number | null;
  direction: string;
  adapter_type: string;
  status: "queued" | "running" | "completed" | "partial" | "failed";
  received_count: number;
  accepted_count: number;
  duplicate_count: number;
  rejected_count: number;
  error_message: string | null;
  created_at: string;
  device?: Pick<AttendanceDevice, "id" | "device_code" | "name"> | null;
};

export type AttendanceDeviceWorkspace = {
  devices: AttendanceDevice[];
  mappings: DeviceEmployeeMapping[];
  import_batches: AttendanceImportBatch[];
  sync_jobs: AttendanceSyncJob[];
  adapters: AttendanceDeviceAdapterOption[];
  permissions: {
    can_view: boolean;
    can_manage_devices: boolean;
    can_manage_credentials: boolean;
    can_map_employees: boolean;
    can_import_events: boolean;
    can_sync_devices: boolean;
  };
  connector: {
    events_path_template: string;
    configuration_path_template: string;
    signature_algorithm: string;
    canonical_request: string;
  };
};

export type AttendanceException = {
  id: number;
  attendance_calculation_id: number;
  attendance_record_id: number;
  employee_id: number;
  code: string;
  category: string;
  severity: "error" | "warning" | "info";
  minutes: number | null;
  is_blocking: boolean;
  message: string;
  details: { occurrences?: number } | null;
  employee?: Employee;
};

export type AttendanceCalculation = {
  id: number;
  attendance_record_id: number;
  employee_id: number;
  work_schedule_id: number | null;
  attendance_date: string;
  version: number;
  previous_calculation_id: number | null;
  status: "current" | "superseded";
  trigger_reason: string;
  calculation_hash: string;
  source_event_ids: number[];
  applied_adjustment_ids: number[];
  schedule_snapshot: Record<string, unknown> | null;
  result_snapshot: {
    policy_version: string;
    timezone: string;
    status: string;
    effective_events: Array<{
      id: number;
      event_uuid: string;
      event_type: AttendanceEventType;
      occurred_at: string;
      source: string;
      is_adjustment: boolean;
    }>;
    totals: {
      scheduled_minutes: number;
      worked_minutes: number;
      break_minutes: number;
      late_minutes: number;
      early_departure_minutes: number;
      overtime_minutes: number;
    };
    exception_codes: string[];
  };
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  first_in_at: string | null;
  last_out_at: string | null;
  scheduled_minutes: number;
  expected_work_minutes: number;
  leave_minutes: number;
  holiday_minutes: number;
  worked_minutes: number;
  payable_minutes: number;
  break_minutes: number;
  late_minutes: number;
  early_departure_minutes: number;
  overtime_minutes: number;
  reconciliation_snapshot: Record<string, unknown> | null;
  exception_count: number;
  calculated_at: string;
  employee?: Employee;
  attendance_record?: AttendanceRecord;
  exceptions: AttendanceException[];
};

export type AttendanceCorrectionType =
  "add_event" | "replace_event" | "void_event";

export type AttendanceAdjustment = {
  id: number;
  adjustment_type: AttendanceCorrectionType;
  original_event_id: number | null;
  replacement_event_id: number | null;
  applied_at: string;
  replacement_event?: AttendanceEvent | null;
};

export type AttendanceCorrectionRequest = {
  id: number;
  correction_number: string;
  attendance_record_id: number;
  employee_id: number;
  base_calculation_id: number | null;
  target_event_id: number | null;
  correction_type: AttendanceCorrectionType;
  proposed_event_type: AttendanceEventType | null;
  proposed_occurred_at: string | null;
  reason: string;
  before_snapshot: Record<string, unknown>;
  proposed_snapshot: Record<string, unknown>;
  status:
    | "draft"
    | "submitted"
    | "approved"
    | "rejected"
    | "returned_for_correction"
    | "withdrawn";
  workflow_run_id: string | null;
  workflow_status: "pending" | "approved" | "rejected" | null;
  submitted_at: string | null;
  decided_at: string | null;
  applied_at: string | null;
  employee?: Employee;
  attendance_record?: AttendanceRecord;
  base_calculation?: AttendanceCalculation | null;
  target_event?: AttendanceEvent | null;
  adjustment?: AttendanceAdjustment | null;
  current_workflow_approvals?: Array<{
    id: number;
    sequence: number;
    status: "pending" | "approved" | "rejected";
    user?: { id: number; name: string } | null;
    role?: { id: number; name: string } | null;
  }>;
};

export type WorkforceReconciliationStatus =
  | "aligned"
  | "review_required"
  | "payroll_protected"
  | "future_preview"
  | "no_context";

export type WorkforceReconciliationSummary = Record<
  WorkforceReconciliationStatus,
  number
>;

export type WorkforceReconciliationDay = {
  id: number;
  reconciliation_run_id: number;
  employee_id: number;
  work_date: string;
  attendance_record_id: number | null;
  attendance_calculation_id: number | null;
  previous_calculation_id: number | null;
  work_schedule_id: number | null;
  leave_request_id: number | null;
  leave_request_segment_id: number | null;
  holiday_id: number | null;
  scheduled_minutes: number;
  expected_work_minutes: number;
  leave_minutes: number;
  holiday_minutes: number;
  worked_minutes: number;
  payable_minutes: number;
  variance_minutes: number;
  period_locked: boolean;
  is_current: boolean;
  action:
    | "recalculated"
    | "unchanged"
    | "payroll_adjustment_required"
    | "future_preview"
    | "no_context";
  status: WorkforceReconciliationStatus;
  explanation: {
    source_order: string[];
    calculation_version: number | null;
    calculation_status: string | null;
    messages: string[];
    context: {
      classification: string;
      schedule_resolution?: {
        source_type?: string;
        source_id?: number;
      } | null;
      leave_type?: {
        code: string;
        name: string;
        is_paid: boolean;
      } | null;
      holiday?: {
        name: string;
        is_paid: boolean;
        treatment: string;
      } | null;
    };
  };
  adjustment_payload: Record<string, unknown> | null;
  employee: Pick<
    Employee,
    "id" | "employee_number" | "primary_name" | "preferred_name"
  >;
  work_schedule?: Pick<WorkSchedule, "id" | "code" | "name"> | null;
  leave_request?: {
    id: number;
    request_number: string | null;
    status: string;
    leave_type?: Pick<LeaveType, "id" | "code" | "name"> | null;
  } | null;
  holiday?: {
    id: number;
    name: string;
    holiday_date: string;
    is_paid: boolean;
  } | null;
  attendance_calculation?: Pick<
    AttendanceCalculation,
    "id" | "version" | "status" | "result_snapshot"
  > | null;
};

export type WorkforceReconciliationRun = {
  id: number;
  run_uuid: string;
  employee_id: number;
  starts_on: string;
  ends_on: string;
  trigger_type: string;
  status:
    | "running"
    | "completed"
    | "completed_with_exceptions"
    | "completed_with_adjustments"
    | "failed";
  summary: WorkforceReconciliationSummary & {
    days: number;
    calculations_created: number;
    calculations_unchanged: number;
  };
  started_at: string | null;
  completed_at: string | null;
  employee?: Employee;
  days: WorkforceReconciliationDay[];
};

export type WorkforceReconciliationPage =
  Paginated<WorkforceReconciliationDay> & {
    meta: Paginated<WorkforceReconciliationDay>["meta"] & {
      summary: WorkforceReconciliationSummary;
      include_history?: boolean;
    };
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
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${getBackendApiRoot()}/hr${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(
        options.body && !isFormData
          ? { "Content-Type": "application/json" }
          : {},
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
  const payload = await hrFetch<HrLetterTemplate[] | { data?: HrLetterTemplate[] }>(
    "/forms/templates",
  );
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function createHrLetterTemplate(payload: {
  title: string;
  body_html: string;
}): Promise<HrLetterTemplate> {
  const created = await hrFetch<HrLetterTemplate | { data?: HrLetterTemplate }>(
    "/forms/templates",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  if (created && typeof created === "object" && "data" in created && created.data) {
    return created.data;
  }
  return created as HrLetterTemplate;
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
        : payload?.message ||
            `HR upload request failed with status ${response.status}.`,
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

export type EmployeeProfileSectionKey =
  | "address"
  | "bank_accounts"
  | "disability"
  | "higher_education"
  | "school_education"
  | "emergency"
  | "guarantor"
  | "family"
  | "languages"
  | "licenses"
  | "experience"
  | "disasters"
  | "certifications_awards"
  | "files";

export type EmployeeProfileOtherInfo = {
  tin_number?: string | null;
  blood_group?: string | null;
  marital_status_code?: string | null;
  religion_code?: string | null;
  title_code?: string | null;
};

export type EmployeeProfilePayload = {
  employee: Employee & EmployeeProfileOtherInfo;
  other_info: EmployeeProfileOtherInfo;
  sections: Record<string, Array<Record<string, unknown>>>;
};

export async function fetchEmployeeProfile(
  employeeId: number | string,
): Promise<EmployeeProfilePayload> {
  const payload = await hrFetch<{ data: EmployeeProfilePayload }>(
    `/employees/${employeeId}/profile`,
  );
  return payload.data;
}

export async function updateEmployeeOtherInfo(
  employeeId: number | string,
  data: EmployeeProfileOtherInfo,
): Promise<EmployeeProfileOtherInfo> {
  const payload = await hrFetch<{ data: EmployeeProfileOtherInfo }>(
    `/employees/${employeeId}/profile/other-info`,
    { method: "PUT", body: JSON.stringify(data) },
  );
  return payload.data;
}

export async function createEmployeeProfileRecord(
  employeeId: number | string,
  section: EmployeeProfileSectionKey,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const payload = await hrFetch<{ data: Record<string, unknown> }>(
    `/employees/${employeeId}/profile/${section}`,
    { method: "POST", body: JSON.stringify(data) },
  );
  return payload.data;
}

export async function updateEmployeeProfileRecord(
  employeeId: number | string,
  section: EmployeeProfileSectionKey,
  recordId: number | string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const payload = await hrFetch<{ data: Record<string, unknown> }>(
    `/employees/${employeeId}/profile/${section}/${recordId}`,
    { method: "PUT", body: JSON.stringify(data) },
  );
  return payload.data;
}

export async function deleteEmployeeProfileRecord(
  employeeId: number | string,
  section: EmployeeProfileSectionKey,
  recordId: number | string,
): Promise<void> {
  await hrFetch(`/employees/${employeeId}/profile/${section}/${recordId}`, {
    method: "DELETE",
  });
}

export async function uploadEmployeeProfileDocument(
  employeeId: number | string,
  fields: { title: string; category?: string; notes?: string; file: File },
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("title", fields.title);
  if (fields.category) formData.append("category", fields.category);
  if (fields.notes) formData.append("notes", fields.notes);
  formData.append("file", fields.file);

  const payload = await hrUploadFetch<{ data: Record<string, unknown> }>(
    `/employees/${employeeId}/profile/files`,
    formData,
  );
  return payload.data;
}

