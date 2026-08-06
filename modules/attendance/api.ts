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
    const reasonCode =
      typeof payload?.data?.reason_code === "string"
        ? payload.data.reason_code
        : null;
    const reasonMessage = reasonCode
      ? `Scan rejected: ${reasonCode.replaceAll("_", " ")}.`
      : null;
    throw new Error(
      typeof validation === "string"
        ? validation
        : payload?.message ||
            reasonMessage ||
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
