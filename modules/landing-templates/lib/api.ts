import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";

export type TemplateFramework = "static-html" | "html-css-js" | "react" | "nextjs" | "visual";
export type TemplateType = "visual" | "static" | "react" | "nextjs";

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
  parent_template_id?: number | null;
  source_template_id?: number | null;
  name: string;
  slug: string;
  description: string | null;
  business_types: string[];
  categories: string[];
  tags: string[];
  thumbnail: string | null;
  screenshots: string[];
  source_framework: TemplateFramework;
  template_type?: TemplateType;
  runtime_framework: string;
  import_status: string;
  conversion_status: string;
  compatibility_status: string;
  compatibility_score: number;
  current_version: string;
  current_version_id?: number | null;
  pages_count?: number;
  has_draft?: boolean;
  is_premium: boolean;
  is_published: boolean;
  is_archived: boolean;
  assignments: TemplateAssignment[];
  preview: TemplatePreview | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TemplatePageItem = {
  id: string;
  name: string;
  slug: string;
  title?: string;
  seo_title?: string;
  seo_description?: string;
  is_homepage?: boolean;
  sort_order?: number;
};

export type TemplateCodeFile = {
  name: string;
  path: string;
  language: "html" | "css" | "javascript" | "json" | "typescript";
  content: string;
};

export type TemplateAsset = {
  id: number;
  landing_template_id?: number | null;
  tenant_id?: string | null;
  filename: string;
  path: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  alt_text?: string | null;
  created_at: string | null;
};

export type TemplateVersionItem = {
  id: number;
  version: string;
  label?: string | null;
  changelog?: string | null;
  is_snapshot: boolean;
  created_at: string | null;
};

export type TemplateBuilderData = {
  template: TemplateLibraryCard;
  project_data: Record<string, unknown> | null;
  pages: TemplatePageItem[];
  code_files: TemplateCodeFile[];
  has_draft?: boolean;
  draft_saved_at: string | null;
  versions: TemplateVersionItem[];
  assets: TemplateAsset[];
};

export type VersionDiffFile = {
  filename: string;
  from_content: string;
  to_content: string;
  language: string;
};

export type VersionDiffPayload = {
  from_version: string;
  to_version: string;
  files: VersionDiffFile[];
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
  source_archive: string | null;
  files_analyzed: number;
  components_generated: number;
  images_imported: number;
  css_processed: number;
  js_processed: number;
  compatibility_score: number;
  report: ConversionReport;
  created_at: string | null;
};

const parseError = async (res: Response): Promise<Error> => {
  try {
    const json = await res.json();
    if (json?.message) return new Error(json.message);
  } catch {
    // ignore
  }
  return new Error(`Request failed with status ${res.status}`);
};

export const fetchLibrary = async (params: {
  q?: string;
  business_type?: string;
  framework?: string;
  status?: string;
  archived?: boolean;
  page?: number;
}): Promise<{ data: TemplateLibraryCard[]; meta: { current_page: number; last_page: number; total: number } }> => {
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

export const fetchBuilderData = async (id: number): Promise<{ data: TemplateBuilderData }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/builder`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const saveDraft = async (
  id: number,
  payload: {
    project_data?: unknown;
    pages?: TemplatePageItem[];
    code_files?: TemplateCodeFile[];
    body?: Record<string, unknown>;
  },
): Promise<{ message: string; data: { saved_at: string; has_draft: boolean } }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/draft`, {
    method: "PUT",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const syncCode = async (
  id: number,
  codeFiles: TemplateCodeFile[],
): Promise<{ message: string; data: TemplateBuilderData }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/sync-code`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ code_files: codeFiles }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const fetchVersionDiff = async (
  id: number,
  fromVersion: string | number,
  toVersion: string | number,
): Promise<{ data: VersionDiffPayload }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/versions/diff`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ from_version: fromVersion, to_version: toVersion }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const rollbackVersion = async (
  id: number,
  versionId: number,
): Promise<{ message: string; data: TemplateBuilderData }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/versions/${versionId}/rollback`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const cloneTemplate = async (
  id: number,
  name?: string,
): Promise<{ message: string; data: TemplateLibraryCard }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/${id}/clone`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const getTemplateExportUrl = (id: number): string => {
  return `${getBackendApiRoot()}/landing-templates/${id}/export`;
};

export const fetchAssets = async (templateId?: number, tenantId?: string): Promise<{ data: TemplateAsset[] }> => {
  const query = new URLSearchParams();
  if (tenantId) query.set("tenant_id", tenantId);
  const endpoint = templateId
    ? `${getBackendApiRoot()}/landing-templates/${templateId}/assets?${query.toString()}`
    : `${getBackendApiRoot()}/landing-templates/assets?${query.toString()}`;

  const response = await fetch(endpoint, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const uploadAsset = async (
  file: File,
  templateId?: number,
  altText?: string,
  tenantId?: string,
): Promise<{ message: string; data: TemplateAsset }> => {
  const form = new FormData();
  form.append("file", file);
  if (altText) form.append("alt_text", altText);
  if (tenantId) form.append("tenant_id", tenantId);

  const endpoint = templateId
    ? `${getBackendApiRoot()}/landing-templates/${templateId}/assets`
    : `${getBackendApiRoot()}/landing-templates/assets`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
};

export const deleteAsset = async (assetId: number): Promise<{ message: string }> => {
  const response = await fetch(`${getBackendApiRoot()}/landing-templates/assets/${assetId}`, {
    method: "DELETE",
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
  source_framework?: string;
  template_type?: string;
  is_premium?: boolean;
  body: Record<string, unknown>;
  project_data?: Record<string, unknown>;
  pages?: TemplatePageItem[];
  code_files?: TemplateCodeFile[];
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
    body?: Record<string, unknown>;
    project_data?: unknown;
    pages?: TemplatePageItem[];
    code_files?: TemplateCodeFile[];
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
