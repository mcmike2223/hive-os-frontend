import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";

export type AppNotification = {
  id: string;
  type: string;
  category: string;
  title: string;
  body?: string | null;
  url?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  data?: Record<string, unknown>;
};

export type NotificationDestination = {
  href: string;
  label: string;
};

type NotificationCenterResponse = {
  data: {
    unread_count: number;
    notifications: AppNotification[];
  };
};

type NotificationDetailResponse = {
  data: AppNotification;
};

function toText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return toText(value);
}

/** Turn absolute frontend URLs into app-relative paths when possible. */
export function normalizeAppPath(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    if (url.startsWith("/")) {
      return url;
    }

    const parsed = new URL(url);
    if (typeof window !== "undefined" && parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    // Backend sometimes embeds the configured frontend origin.
    if (parsed.pathname.startsWith("/dashboard")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return url.startsWith("/") ? url : null;
  }

  return null;
}

function explicitDestination(notification: AppNotification): string | null {
  const data = notification.data ?? {};
  return normalizeAppPath(
    notification.url
      || toText(data.url)
      || toText(data.target_url)
      || toText(data.review_url)
      || toText(data.action_url)
  );
}

/**
 * Resolve where the user should go from a notification detail page,
 * preferring specific entity links when the payload includes them.
 */
export type NotificationDetailRow = {
  label: string;
  value: string;
};

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toDisplayText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/** User-facing detail rows — never expose raw internal IDs. */
export function buildNotificationDetailRows(
  notification: AppNotification
): NotificationDetailRow[] {
  const data = notification.data ?? {};
  const category = notification.category || toText(data.category) || "system";
  const rows: NotificationDetailRow[] = [];

  const push = (label: string, value: unknown) => {
    const text = toDisplayText(value);
    if (text) {
      rows.push({ label, value: text });
    }
  };

  if (category === "workflow") {
    push("Status", data.status ? formatLabel(String(data.status)) : null);
    push("Subject", data.subject);
    push("Requested by", data.requester_name);
    push("Actioned by", data.actioned_by);
    push("Workflow rule", data.workflow_name);
    push("Role", data.role_name);
    if (data.current_step && data.total_steps) {
      push("Step", `Step ${data.current_step} of ${data.total_steps}`);
    }
    push("Module", data.module_slug ? formatLabel(String(data.module_slug)) : null);
    return rows;
  }

  if (category.startsWith("pm_")) {
    push("Project", data.project_name);
    push("Task", data.task_name);
    push("Status", data.status ? formatLabel(String(data.status)) : null);
    push("Role", data.role);
    push("Automation", data.automation_name);
    return rows;
  }

  if (category === "direct_transfer_review") {
    push("Tenant", data.tenant_name);
    push("Amount", data.amount_etb ? `ETB ${Number(data.amount_etb).toLocaleString()}` : null);
    push("Reference", data.transaction_reference);
    push("Scope", data.scope ? formatLabel(String(data.scope)) : null);
    return rows;
  }

  if (category === "demo") {
    push("Company", data.company);
    push("Contact", data.contact_name);
    return rows;
  }

  if (category === "backup" || category === "backup_failed") {
    push("Status", category === "backup_failed" ? "Failed" : "Completed");
    return rows;
  }

  return rows;
}

export function resolveNotificationDestination(
  notification: AppNotification
): NotificationDestination | null {
  const data = notification.data ?? {};
  const category = notification.category || toText(data.category) || "system";
  const status = toText(data.status);
  const title = notification.title || "";
  const explicit = explicitDestination(notification);
  const projectId = toId(data.project_id);
  const taskId = toId(data.task_id);
  const ruleId = toId(data.workflow_definition_id);
  const approvalId = toId(data.approval_id);

  // Workflow: signer assignment → rules (specific rule when available)
  if (
    category === "workflow"
    && (title === "Workflow Signer Assignment" || ruleId)
    && status !== "pending"
    && status !== "approved"
    && status !== "rejected"
  ) {
    return {
      href: ruleId ? `/dashboard/workflow/rules?rule=${ruleId}` : "/dashboard/workflow/rules",
      label: "Open workflow rules",
    };
  }

  // Workflow: needs your signature / approval → my approvals
  if (
    category === "workflow"
    && (status === "pending" || title === "Signature Required")
  ) {
    const href = approvalId
      ? `/dashboard/workflow/approvals?approval=${approvalId}`
      : "/dashboard/workflow/approvals";
    return {
      href,
      label: "Open my approvals",
    };
  }

  // Workflow: approved / rejected → the thing being approved when possible
  if (category === "workflow" && (status === "approved" || status === "rejected")) {
    if (explicit && !explicit.startsWith("/dashboard/workflow/approvals")) {
      return {
        href: explicit,
        label: status === "approved" ? "View approved item" : "View rejected item",
      };
    }

    return {
      href: explicit || "/dashboard/workflow/approvals?tab=requested",
      label: status === "approved" ? "View request status" : "View rejected request",
    };
  }

  // Project management: task assigned → specific task, else my tasks
  if (category === "pm_task_assigned") {
    if (projectId && taskId) {
      return {
        href: `/dashboard/project-management/projects/${projectId}?taskId=${taskId}`,
        label: "Open task",
      };
    }
    return {
      href: "/dashboard/project-management/my-tasks",
      label: "Open my tasks",
    };
  }

  // Other task-related PM notifications
  if (category.startsWith("pm_task") || (projectId && taskId && category.startsWith("pm_"))) {
    if (projectId && taskId) {
      return {
        href: `/dashboard/project-management/projects/${projectId}?taskId=${taskId}`,
        label: "Open task",
      };
    }
    return {
      href: "/dashboard/project-management/my-tasks",
      label: "Open my tasks",
    };
  }

  // Project assigned / member added / project updates
  if (
    category === "pm_project_assigned"
    || category === "pm_project_member_added"
    || category === "pm_project_created"
    || category === "pm_project_status_changed"
    || category === "pm_project_comment"
    || category === "pm_project_comment_added"
  ) {
    if (projectId) {
      return {
        href: `/dashboard/project-management/projects/${projectId}`,
        label: "Open project",
      };
    }
    return {
      href: "/dashboard/project-management/projects",
      label: "Open projects",
    };
  }

  if (category.startsWith("pm_")) {
    if (projectId) {
      return {
        href: taskId
          ? `/dashboard/project-management/projects/${projectId}?taskId=${taskId}`
          : `/dashboard/project-management/projects/${projectId}`,
        label: taskId ? "Open task" : "Open project",
      };
    }
    return explicit
      ? { href: explicit, label: "Open related item" }
      : { href: "/dashboard/project-management", label: "Open project management" };
  }

  if (category === "chat") {
    return {
      href: explicit || "/dashboard/chat",
      label: "Open chat",
    };
  }

  if (category === "mail") {
    return {
      href: explicit || "/dashboard/mail",
      label: "Open mail",
    };
  }

  if (category === "direct_transfer_review") {
    return {
      href: explicit || "/dashboard/direct-transfer-reviews",
      label: "Open review queue",
    };
  }

  if (category === "demo") {
    return {
      href: explicit || "/dashboard/subscriptions/demo-requests",
      label: "Open demo requests",
    };
  }

  if (category === "backup" || category === "backup_failed") {
    return {
      href: explicit || "/dashboard/storage",
      label: "Open storage",
    };
  }

  if (explicit) {
    return {
      href: explicit,
      label: "Open related page",
    };
  }

  return null;
}

export function notificationDetailPath(id: string): string {
  return `/dashboard/notifications/${id}`;
}

export async function fetchNotificationCenter(
  limit = 8,
  unreadOnly = false
): Promise<NotificationCenterResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (unreadOnly) {
    params.set("unread_only", "1");
  }
  return notificationsApiFetch(`/notifications?${params.toString()}`);
}

export async function fetchNotification(id: string): Promise<AppNotification> {
  const response = await notificationsApiFetch(`/notifications/${id}`) as NotificationDetailResponse;
  return response.data;
}

export async function markNotificationsRead(notificationIds?: string[]): Promise<{ updated: number; unread_count: number }> {
  const response = await notificationsApiFetch("/notifications/read", {
    method: "POST",
    body: JSON.stringify(
      notificationIds?.length ? { notification_ids: notificationIds } : {}
    ),
  }) as { data?: { updated?: number; unread_count?: number } };

  return {
    updated: response.data?.updated ?? 0,
    unread_count: response.data?.unread_count ?? 0,
  };
}

async function notificationsApiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}
  );

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || "Notification request failed.");
  }

  return response.json();
}
