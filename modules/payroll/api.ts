import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";

export async function payrollFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const canonicalPath = path.startsWith("/payroll/")
    ? path.slice("/payroll".length)
    : path === "/payroll"
      ? ""
      : path;
  const response = await fetch(
    `${getBackendApiRoot().replace(/\/$/, "")}/payroll${canonicalPath}`,
    {
      ...options,
      headers: {
        ...getAuthHeaders(
          options.body ? { "Content-Type": "application/json" } : {},
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
            `Payroll request failed with status ${response.status}.`,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function payrollDownload(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const canonicalPath = path.startsWith("/payroll/")
    ? path.slice("/payroll".length)
    : path;
  const response = await fetch(
    `${getBackendApiRoot().replace(/\/$/, "")}/payroll${canonicalPath}`,
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
      payload?.message || `Payroll export failed with status ${response.status}.`,
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
