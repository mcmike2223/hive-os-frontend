import { isTenantSession } from "@/lib/runtime-context";

export const PROFILE_ROUTE_PERMISSIONS = [
  "view_profile",
  "edit_profile",
] as const;
export const SECURITY_ROUTE_PERMISSIONS = [
  "view_users",
  "manage_users",
  "view_roles",
  "manage_roles",
  "view_permissions",
] as const;
export const TENANTS_ROUTE_PERMISSIONS = [
  "view_tenants",
  "manage_tenants",
] as const;
export const LANDING_TEMPLATES_ROUTE_PERMISSIONS = [
  "manage_tenants",
  "provision_tenants",
] as const;
export const SUBSCRIPTIONS_ROUTE_PERMISSIONS = [
  "view_module_subscriptions",
  "manage_module_subscriptions",
] as const;
export const STORAGE_ROUTE_PERMISSIONS = [
  "view_storage",
  "manage_storage",
] as const;
export const CHAT_ROUTE_PERMISSIONS = ["view_chat", "manage_chat"] as const;
export const SETTINGS_ROUTE_PERMISSIONS = [
  "manage_brand_settings",
  "manage_general_settings",
  "manage_localization",
  "manage_payment_settings",
  "manage_tenants",
  "provision_tenants",
  "view_backups",
  "manage_backups",
  "view_hr_settings",
  "manage_hr_settings",
] as const;
export const ALERTS_ROUTE_PERMISSIONS = ["view_alerts"] as const;
export const AUDIT_LOG_ROUTE_PERMISSIONS = ["view_logs"] as const;
export const API_DOCS_ROUTE_PERMISSIONS = ["view_api_docs"] as const;
export const DOCUMENT_CONVERTER_ROUTE_PERMISSIONS = [
  "use_document_converter",
  "manage_storage",
] as const;
export const DIRECT_TRANSFER_REVIEW_ROUTE_PERMISSIONS = [
  "manage_tenants",
  "manage_payment_settings",
  "manage_general_settings",
] as const;
export const HOSPITALITY_ROUTE_PERMISSIONS = [
  "view_hospitality_tables",
  "view_hospitality_reservations",
  "view_hospitality_service_orders",
] as const;
export const B2B_MARKETPLACE_ROUTE_PERMISSIONS = [
  "view_b2b_marketplace",
  "view_b2b_dashboard",
  "manage_b2b_products",
  "manage_b2b_inquiries",
  "manage_b2b_quotes",
  "manage_b2b_marketplace",
] as const;
export const INVENTORY_ROUTE_PERMISSIONS = [
  "view_inventory",
  "manage_inventory",
] as const;
export const WORKFLOW_ROUTE_PERMISSIONS = [
  "view_workflow_automation",
  "manage_workflow_automation",
  "create_workflow_requests",
  "assign_workflow_approvers",
  "approve_workflow_requests",
  "reject_workflow_requests",
] as const;
export const WORKFLOW_RULE_ROUTE_PERMISSIONS = [
  "manage_workflow_automation",
] as const;
export const WORKFLOW_ROLE_ROUTE_PERMISSIONS = [
  "view_workflow_automation",
  "assign_workflow_approvers",
  "manage_workflow_roles",
  "manage_workflow_automation",
] as const;
export const PROJECT_MANAGEMENT_ROUTE_PERMISSIONS = [
  "view_project_management",
  "manage_project_management",
  "view_projects",
  "manage_projects",
] as const;
export const PROJECT_MANAGEMENT_PROJECT_ROUTE_PERMISSIONS = [
  "view_projects",
  "manage_projects",
] as const;
export const PROJECT_MANAGEMENT_TASK_ROUTE_PERMISSIONS = [
  "view_tasks",
  "manage_tasks",
] as const;
export const PROJECT_MANAGEMENT_TEAM_ROUTE_PERMISSIONS = [
  "view_project_team",
  "manage_project_team",
] as const;
export const PROJECT_MANAGEMENT_REPORT_ROUTE_PERMISSIONS = [
  "view_project_reports",
  "manage_project_reports",
] as const;
export const HUMAN_RESOURCES_ROUTE_PERMISSIONS = [
  "view_hr_policies",
  "manage_hr_policies",
  "view_hr_settings",
  "manage_hr_settings",
  "view_employees",
  "manage_employees",
  "view_employee_profile",
  "manage_employee_profile",
  "edit_own_profile",
  "view_employee_transfers",
  "manage_employee_transfers",
  "view_employee_relations",
  "manage_employee_relations",
  "view_hr_forms",
  "generate_hr_forms",
  "manage_hr_forms",
  "view_organigram",
  "manage_organigram",
  "view_hr_organization",
  "manage_hr_organization",
  "view_hr_positions",
  "manage_hr_positions",
  "view_hr_compliance",
  "manage_hr_compliance",
  "request_leave",
  "view_own_leave",
  "view_team_leave",
  "view_leave_requests",
  "manage_leave_requests",
  "approve_leave_requests",
  "view_leave_balances",
  "view_leave_plans",
  "manage_leave_plans",
  "view_attendance",
  "manage_attendance",
  "record_attendance",
  "view_own_time",
  "view_own_schedule",
  "view_own_attendance",
  "record_own_attendance",
  "view_team_time",
  "view_team_attendance",
  "record_team_attendance",
  "manage_work_schedules",
  "view_time_configuration",
  "manage_time_codes",
  "manage_attendance_policies",
  "manage_shifts",
  "manage_schedule_templates",
  "manage_holiday_calendars",
  "view_attendance_devices",
  "manage_attendance_devices",
  "view_payroll",
  "manage_payroll",
  "view_payroll_attendance",
  "manage_payroll_attendance",
  "view_recruitment",
  "manage_recruitment",
  "view_appraisals",
  "manage_appraisals",
  "view_hr_assets",
  "manage_hr_assets",
  "view_hr_expenses",
  "manage_hr_expenses",
  "view_workforce_reports",
  "export_workforce_reports",
] as const;
export const LEARNING_MANAGEMENT_ROUTE_PERMISSIONS = [
  "view_learning_management",
  "manage_learning_management",
  "view_lms_courses",
  "manage_lms_courses",
] as const;
export const LEARNING_MANAGEMENT_COURSE_ROUTE_PERMISSIONS = [
  "view_lms_courses",
  "manage_lms_courses",
] as const;
export const LEARNING_MANAGEMENT_LEARNER_ROUTE_PERMISSIONS = [
  "view_lms_learners",
  "manage_lms_enrollments",
] as const;
export const LEARNING_MANAGEMENT_REPORT_ROUTE_PERMISSIONS = [
  "view_lms_reports",
  "manage_lms_reports",
] as const;

export type RoutePermissionAccess = {
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasModule?: (slug: string) => boolean;
  canBypassModuleSubscriptions?: boolean;
};

const normalizePath = (path: string): string => {
  try {
    return new URL(path, "http://hive.local").pathname;
  } catch {
    return path.split("?")[0]?.split("#")[0] || path;
  }
};

const matchesPrefix = (path: string, prefix: string): boolean => {
  return path === prefix || path.startsWith(`${prefix}/`);
};

const hasSubscribedModule = (
  access: RoutePermissionAccess,
  module: string | string[],
): boolean => {
  if (
    access.canBypassModuleSubscriptions ||
    !isTenantSession() ||
    !access.hasModule
  ) {
    return true;
  }

  const modules = Array.isArray(module) ? module : [module];

  return modules.some((slug) => access.hasModule?.(slug));
};

export function canAccessDashboardRoute(
  rawPath: string,
  access: RoutePermissionAccess,
): boolean {
  const path = normalizePath(rawPath);

  if (path === "/" || path === "/dashboard") {
    return access.hasPermission("view_system_dashboard");
  }

  if (matchesPrefix(path, "/dashboard/profile")) {
    return access.hasAnyPermission([...PROFILE_ROUTE_PERMISSIONS]);
  }

  if (matchesPrefix(path, "/dashboard/security")) {
    return (
      access.hasAnyPermission([...SECURITY_ROUTE_PERMISSIONS]) &&
      hasSubscribedModule(access, "security_management")
    );
  }

  if (matchesPrefix(path, "/dashboard/tenants")) {
    return access.hasAnyPermission([...TENANTS_ROUTE_PERMISSIONS]);
  }

  if (matchesPrefix(path, "/dashboard/landing-templates")) {
    return (
      !isTenantSession() &&
      access.hasAnyPermission([...LANDING_TEMPLATES_ROUTE_PERMISSIONS])
    );
  }

  if (matchesPrefix(path, "/dashboard/subscriptions")) {
    return isTenantSession()
      ? access.hasAnyPermission([...SUBSCRIPTIONS_ROUTE_PERMISSIONS])
      : access.hasAnyPermission(["manage_tenants", "provision_tenants"]);
  }

  if (matchesPrefix(path, "/dashboard/audit-logs")) {
    return (
      access.hasPermission("view_logs") &&
      hasSubscribedModule(access, "audit_logs")
    );
  }

  if (matchesPrefix(path, "/dashboard/alerts")) {
    return (
      access.hasAnyPermission([...ALERTS_ROUTE_PERMISSIONS]) &&
      hasSubscribedModule(access, "alerts_center")
    );
  }

  if (matchesPrefix(path, "/dashboard/storage")) {
    return (
      access.hasAnyPermission([...STORAGE_ROUTE_PERMISSIONS]) &&
      hasSubscribedModule(access, [
        "file_manager",
        "media_library",
        "video_player",
        "audio_player",
      ])
    );
  }

  if (matchesPrefix(path, "/dashboard/chat")) {
    return (
      access.hasAnyPermission([...CHAT_ROUTE_PERMISSIONS]) &&
      hasSubscribedModule(access, "mailbox")
    );
  }

  if (matchesPrefix(path, "/dashboard/settings")) {
    const canAccessCoreSettings = access.hasAnyPermission([
      "manage_brand_settings",
      "manage_general_settings",
      "manage_localization",
      "manage_payment_settings",
      "view_hr_settings",
      "manage_hr_settings",
    ]);
    const canAccessCentralSettings =
      !isTenantSession() &&
      access.hasAnyPermission([
        "manage_tenants",
        "provision_tenants",
        "view_backups",
        "manage_backups",
      ]);

    return canAccessCoreSettings || canAccessCentralSettings;
  }

  if (matchesPrefix(path, "/dashboard/direct-transfer-reviews")) {
    return access.hasAnyPermission([
      ...DIRECT_TRANSFER_REVIEW_ROUTE_PERMISSIONS,
    ]);
  }

  if (matchesPrefix(path, "/dashboard/api-docs")) {
    return (
      access.hasAnyPermission([...API_DOCS_ROUTE_PERMISSIONS]) &&
      hasSubscribedModule(access, "api_docs")
    );
  }

  if (matchesPrefix(path, "/dashboard/hospitality")) {
    return hasSubscribedModule(access, "hospitality");
  }

  if (matchesPrefix(path, "/dashboard/b2b-marketplace")) {
    return (
      access.hasAnyPermission([...B2B_MARKETPLACE_ROUTE_PERMISSIONS]) &&
      hasSubscribedModule(access, "b2b_marketplace")
    );
  }

  if (matchesPrefix(path, "/dashboard/inventory")) {
    return hasSubscribedModule(access, "inventory_control");
  }

  if (matchesPrefix(path, "/dashboard/warehouse")) {
    return hasSubscribedModule(access, "warehouse_management");
  }

  if (matchesPrefix(path, "/dashboard/workflow")) {
    if (!hasSubscribedModule(access, "workflow_automation")) {
      return false;
    }

    if (matchesPrefix(path, "/dashboard/workflow/rules")) {
      return access.hasAnyPermission([...WORKFLOW_RULE_ROUTE_PERMISSIONS]);
    }

    if (matchesPrefix(path, "/dashboard/workflow/roles")) {
      return access.hasAnyPermission([...WORKFLOW_ROLE_ROUTE_PERMISSIONS]);
    }

    return access.hasAnyPermission([...WORKFLOW_ROUTE_PERMISSIONS]);
  }

  if (matchesPrefix(path, "/dashboard/project-management")) {
    if (!hasSubscribedModule(access, "project_management")) {
      return false;
    }

    if (matchesPrefix(path, "/dashboard/project-management/my-tasks")) {
      return access.hasAnyPermission([
        ...PROJECT_MANAGEMENT_TASK_ROUTE_PERMISSIONS,
      ]);
    }

    if (matchesPrefix(path, "/dashboard/project-management/team")) {
      return access.hasAnyPermission([
        ...PROJECT_MANAGEMENT_TEAM_ROUTE_PERMISSIONS,
      ]);
    }

    if (matchesPrefix(path, "/dashboard/project-management/reports")) {
      return access.hasAnyPermission([
        ...PROJECT_MANAGEMENT_REPORT_ROUTE_PERMISSIONS,
      ]);
    }

    if (matchesPrefix(path, "/dashboard/project-management/projects")) {
      return access.hasAnyPermission([
        ...PROJECT_MANAGEMENT_PROJECT_ROUTE_PERMISSIONS,
        ...PROJECT_MANAGEMENT_TASK_ROUTE_PERMISSIONS,
        "view_project_boards",
        "manage_project_boards",
      ]);
    }

    return access.hasAnyPermission([...PROJECT_MANAGEMENT_ROUTE_PERMISSIONS]);
  }

  if (matchesPrefix(path, "/dashboard/human-resources")) {
    return (
      hasSubscribedModule(access, "human_resources") &&
      access.hasAnyPermission([...HUMAN_RESOURCES_ROUTE_PERMISSIONS])
    );
  }

  if (matchesPrefix(path, "/dashboard/learning-management")) {
    if (!hasSubscribedModule(access, "learning_management")) {
      return false;
    }

    if (matchesPrefix(path, "/dashboard/learning-management/courses")) {
      return access.hasAnyPermission([
        ...LEARNING_MANAGEMENT_COURSE_ROUTE_PERMISSIONS,
      ]);
    }

    if (matchesPrefix(path, "/dashboard/learning-management/learners")) {
      return access.hasAnyPermission([
        ...LEARNING_MANAGEMENT_LEARNER_ROUTE_PERMISSIONS,
      ]);
    }

    if (matchesPrefix(path, "/dashboard/learning-management/reports")) {
      return access.hasAnyPermission([
        ...LEARNING_MANAGEMENT_REPORT_ROUTE_PERMISSIONS,
      ]);
    }

    return access.hasAnyPermission([
      ...LEARNING_MANAGEMENT_ROUTE_PERMISSIONS,
      "view_my_learning",
    ]);
  }

  if (
    matchesPrefix(path, "/dashboard/tools/converter") ||
    matchesPrefix(path, "/dashboard/tools/converters")
  ) {
    return (
      access.hasAnyPermission([...DOCUMENT_CONVERTER_ROUTE_PERMISSIONS]) &&
      hasSubscribedModule(access, "document_converter")
    );
  }

  return true;
}
