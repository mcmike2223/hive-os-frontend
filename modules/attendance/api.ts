import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";
import { hrFetch } from "@/modules/humanresources/api";

export type * from "@/modules/humanresources/api";

const hrOwnedPrefixes = ["/employees", "/leave", "/settings"];

export async function attendanceFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (hrOwnedPrefixes.some((prefix) => path.startsWith(prefix))) {
    return hrFetch<T>(path, options);
  }

  const canonicalPath = path.startsWith("/attendance/")
    ? path.slice("/attendance".length)
    : path === "/attendance"
      ? ""
      : path;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(
    `${getBackendApiRoot().replace(/\/$/, "")}/attendance${canonicalPath}`,
    {
      ...options,
      headers: {
        ...getAuthHeaders(
          options.body && !isFormData
            ? { "Content-Type": "application/json" }
            : {},
        ),
        ...options.headers,
      },
    },
  );

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
            `Attendance request failed with status ${response.status}.`,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function attendanceDownload(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const canonicalPath = path.startsWith("/attendance/")
    ? path.slice("/attendance".length)
    : path;
  const response = await fetch(
    `${getBackendApiRoot().replace(/\/$/, "")}/attendance${canonicalPath}`,
    {
      headers: getAuthHeaders({
        Accept:
          "text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf",
      }),
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.message ||
        `Attendance export failed with status ${response.status}.`,
    );
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quoted = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const filename = decodeURIComponent(encoded ?? quoted ?? fallbackFilename);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function formatEmployeeNumber(employeeNumber?: string | null): string {
  if (!employeeNumber) return "";
  const trimmed = employeeNumber.trim();
  if (/^\d+$/.test(trimmed)) {
    return `MDE - ${trimmed.padStart(4, "0")}`;
  }
  if (trimmed.startsWith("EMP-")) {
    return trimmed.replace(/^EMP-\s*/i, "MDE - ");
  }
  return trimmed;
}

export type UserLinkingSummary = {
  total_users: number;
  total_employees: number;
  already_linked: number;
  will_link: number;
  ambiguous: number;
  conflicts: number;
  unlinked_users: number;
  unlinked_employees: number;
  employees_missing_enrolment: number;
};

export type UserLinkingRecord = {
  id: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  employee_id: number | null;
  employee_number: string | null;
  employee_name: string | null;
  link_status: "linked" | "unlinked" | "ambiguous" | "employee_only";
  enrolment_status: "enrolled" | "pending_enrolment" | "unlinked";
  match_method: string;
  conflict_reason: string | null;
};

export type UserLinkingPreview = {
  summary: UserLinkingSummary;
  already_linked: unknown[];
  will_link: unknown[];
  ambiguous: unknown[];
  conflicts: unknown[];
  unlinked_users: unknown[];
  unlinked_employees: unknown[];
  missing_enrolment: unknown[];
};

export async function fetchUserLinkingSummary(): Promise<UserLinkingSummary> {
  try {
    const res = await attendanceFetch<{ data: UserLinkingSummary }>("/attendance/user-linking/summary");
    return res.data;
  } catch {
    const res = await hrFetch<{ data: UserLinkingSummary }>("/attendance/user-linking/summary");
    return res.data;
  }
}

export async function fetchUserLinkingRecords(
  page = 1,
  perPage = 25,
  search = "",
  status = "all",
): Promise<{ data: UserLinkingRecord[]; meta: { current_page: number; last_page: number; total: number } }> {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    search,
    status,
  });
  try {
    return await attendanceFetch<{ data: UserLinkingRecord[]; meta: { current_page: number; last_page: number; total: number } }>(
      `/attendance/user-linking/records?${query.toString()}`,
    );
  } catch {
    return await hrFetch<{ data: UserLinkingRecord[]; meta: { current_page: number; last_page: number; total: number } }>(
      `/attendance/user-linking/records?${query.toString()}`,
    );
  }
}

export async function previewUserLinking(): Promise<UserLinkingPreview> {
  const previewOptions: RequestInit = {
    method: "POST",
    headers: {
      "x-skip-offline-queue": "1",
    },
  };

  try {
    const res = await attendanceFetch<{ data: UserLinkingPreview }>(
      "/attendance/user-linking/preview",
      previewOptions,
    );
    return res.data;
  } catch {
    const res = await hrFetch<{ data: UserLinkingPreview }>(
      "/attendance/user-linking/preview",
      previewOptions,
    );
    return res.data;
  }
}

export async function executeUserLinking(): Promise<{ message: string; data: unknown }> {
  try {
    return await attendanceFetch<{ message: string; data: unknown }>("/attendance/user-linking/execute", {
      method: "POST",
    });
  } catch {
    return await hrFetch<{ message: string; data: unknown }>("/attendance/user-linking/execute", {
      method: "POST",
    });
  }
}

export async function resolveUserLinking(userId: number, employeeId: number): Promise<{ message: string }> {
  try {
    return await attendanceFetch<{ message: string }>("/attendance/user-linking/resolve", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, employee_id: employeeId }),
    });
  } catch {
    return await hrFetch<{ message: string }>("/attendance/user-linking/resolve", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, employee_id: employeeId }),
    });
  }
}

export async function unlinkUserAccount(employeeId: number): Promise<{ message: string }> {
  try {
    return await attendanceFetch<{ message: string }>("/attendance/user-linking/unlink", {
      method: "POST",
      body: JSON.stringify({ employee_id: employeeId }),
    });
  } catch {
    return await hrFetch<{ message: string }>("/attendance/user-linking/unlink", {
      method: "POST",
      body: JSON.stringify({ employee_id: employeeId }),
    });
  }
}

export async function enrolAllEmployees(): Promise<{ message: string }> {
  try {
    return await attendanceFetch<{ message: string }>("/attendance/employee-enrolment/execute", {
      method: "POST",
    });
  } catch {
    return await hrFetch<{ message: string }>("/attendance/employee-enrolment/execute", {
      method: "POST",
    });
  }
}
