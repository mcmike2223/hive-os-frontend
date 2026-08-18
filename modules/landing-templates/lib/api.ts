import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";

export type TemplateFramework = "static-html" | "html-css-js" | "react" | "nextjs";

export type TemplateAssignment = {
  type: "tenant" | "business_type";
  id: string;
};

export type TemplatePreviewTheme = {
  accent?: string;
  accent_soft?: string;
  surface?: string;
  canvas?: string;
  panel?: string;
  text?: string;
  muted?: string;
};

export type TemplatePreview = {
  meta?: {
    business_type?: string;
    business_label?: string;
    template_key?: string;
    template_label?: string;
    template_description?: string;
    is_custom?: boolean;
  };
  theme?: TemplatePreviewTheme;
  hero?: {
    eyebrow?: string;
    title?: string;
    description?: string;
    primary_label?: string;
    primary_href?: string;
    secondary_label?: string;
    secondary_href?: string;
  };
  stats?: { value: string; label: string }[];
  highlights?: { kicker?: string; title?: string; description?: string; image?: string }[];
  spotlight?: { heading?: string; description?: string; items?: { title: string; description: string }[] };
  testimonials?: { quote?: string; author?: string; role?: string }[];
  final_cta?: {
    title?: string;
    description?: string;
    primary_label?: string;
    primary_href?: string;
    secondary_label?: string;
    secondary_href?: string;
  };
  rendering?: {
    mode?: "structured" | "custom_code" | "raw_package";
    html?: string;
    css?: string;
    js?: string;
    asset_base_url?: string;
  };
};

export type TemplateLibraryCard = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  business_types: string[];
  categories: string[];
  tags: string[];
  thumbnail: string | null;
  screenshots: string[];
  source_framework: TemplateFramework;
  runtime_framework: string;
  import_status: string;
  conversion_status: string;
  compatibility_status: string;
  compatibility_score: number;
  current_version: string;
  is_premium: boolean;
  is_published: boolean;
  is_archived: boolean;
  assignments: TemplateAssignment[];
  preview: TemplatePreview | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ConversionFinding = {
  file: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  type: string;
  message: string;
};

export type DependencyEntry = {
  name: string;
  version: string;
  status: "compatible" | "review" | "blocked";
  note: string;
};

export type ConversionReport = {
  framework: TemplateFramework | null;
  flags: Record<string, boolean>;
  package_json: Record<string, unknown> | null;
  entry_html: string | null;
  dependencies: DependencyEntry[];
  findings: ConversionFinding[];
  warnings: string[];
  errors: string[];
  summary: {
    components_generated?: number;
    images_imported?: number;
    css_processed?: number;
    js_processed?: number;
  };
};

export type TemplateImport = {
  id: number;
  status: string;
  source_framework: TemplateFramework | null;
  files_analyzed: number;
  components_generated: number;
  images_imported: number;
  css_processed: number;
  js_processed: number;
  compatibility_score: number;
  report: ConversionReport;
  template_id: number | null;
  created_at: string | null;
};

const parseError = async (response: Response): Promise<Error> => {
  try {
    const body = await response.json();
    const message =
      (body as { message?: string }).message ??
      (body as { data?: { message?: string } }).data?.message ??
      `Request failed (${response.status})`;
    return new Error(message);
  } catch {
    return new Error(`Request failed (${response.status})`);
  }
};

export const fetchLibrary = async (params: {
  q?: string;
  business_type?: string;
  framework?: string;
  status?: string;
  archived?: boolean;
  page?: number;
} = {}): Promise<{ data: TemplateLibraryCard[]; meta: { total: number; current_page: number; last_page: number } }> => {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.business_type) query.set("business_type", params.business_type);
  if (params.framework) query.set("framework", params.framework);
  if (params.status) query.set("status", params.status);
  if (params.archived) query.set("archived", "1");
  if (params.page) query.set("page", String(params.page));

  const response = await fetch(`${getBackendApiRoot()}/landing-templates?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const fetchCategories = async (): Promise<{
  data: {
    business_types: { key: string; label: string; description: string; icon: string }[];
    frameworks: TemplateFramework[];
    import_statuses: string[];
  };
}> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/categories`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const fetchTemplate = async (id: number): Promise<{ data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const createTemplate = async (payload: {
  name: string;
  slug?: string;
  description?: string;
  business_types?: string[];
  categories?: string[];
  tags?: string[];
  is_premium?: boolean;
  body: Record<string, unknown>;
  schema?: Record<string, unknown> | null;
}): Promise<{ data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const importTemplateArchive = async (file: File): Promise<{ data: TemplateImport }> => {
  const form = new FormData();
  form.append("archive", file);
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/import`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const approveImport = async (importId: number): Promise<{ message: string; data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/import/${importId}/approve`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const togglePublish = async (id: number, publish: boolean): Promise<{ data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/publish`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ publish }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const toggleArchive = async (id: number, archive: boolean): Promise<{ data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/archive`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ archive }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const createTemplateVersion = async (
  id: number,
  payload: {
    body: Record<string, unknown>;
    label?: string;
    changelog?: string;
  },
): Promise<{ message: string; data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/versions`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

/**
 * Delete a template. Without `force` the API refuses (409) when a tenant is
 * live on it, and the error names the affected tenants.
 */
export const deleteTemplate = async (
  id: number,
  force = false,
): Promise<{ message: string; detached_tenants?: string[] }> => {
  const response = await fetch(
    `${getBackendApiRoot()}/landing-templates/${id}${force ? "?force=1" : ""}`,
    { method: "DELETE", headers: getAuthHeaders() },
  );
  if (!response.ok) throw await parseError(response);
  return response.json();
};

/**
 * Snapshot a structured template's design into editable HTML/CSS as a NEW
 * version. Additive — the structured version stays in history to roll back to.
 */
export const ejectTemplate = async (id: number): Promise<{ message: string; data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/eject`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const duplicateTemplate = async (id: number): Promise<{ data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/duplicate`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const assignTemplate = async (
  id: number,
  payload: { assignable_type: "tenant" | "business_type"; assignable_id: string },
): Promise<{ message: string; data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/assign`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const unassignTemplate = async (
  id: number,
  payload: { assignable_type: "tenant" | "business_type"; assignable_id: string },
): Promise<{ message: string; data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/unassign`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export type AvailableTemplatesResponse = {
  data: {
    business_type: string;
    business_type_meta: { label: string; description: string; icon: string };
    recommended_template_id: number | null;
    templates: TemplateLibraryCard[];
    current: { id: number; template_id: number | null; status: string; published_at: string | null } | null;
  };
};

export const fetchAvailableTemplates = async (): Promise<AvailableTemplatesResponse> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/available`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const selectTemplate = async (templateId: number, versionId?: number): Promise<{ message: string; data: unknown }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/select`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ template_id: templateId, version_id: versionId ?? null }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const fetchMyLanding = async (): Promise<{ data: { instance: unknown; landing_page_template: unknown } }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/my`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const publishMyLanding = async (): Promise<{ message: string; data: unknown }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/my/publish`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};
