import { hrFetch, type Paginated } from "@/modules/humanresources/api";

export const IDENTITY_CARD_FIELDS = [
  "organization_name",
  "organization_logo",
  "photo",
  "primary_name",
  "preferred_name",
  "employee_number",
  "work_email",
  "phone",
  "position",
  "organization_unit",
  "hired_on",
  "issued_on",
  "expires_on",
  "card_number",
  "qr_code",
  "verification_instructions",
] as const;

export type IdentityCardField = (typeof IDENTITY_CARD_FIELDS)[number];

export type IdentityCardTemplate = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  card_type: "employee" | "contractor" | "visitor" | "badge";
  orientation: "landscape" | "portrait";
  width_mm: number;
  height_mm: number;
  primary_color: string;
  accent_color: string;
  text_color: string;
  front_fields: IdentityCardField[];
  back_fields: IdentityCardField[];
  validity_months: number;
  is_default: boolean;
  is_active: boolean;
  cards_count?: number;
};

export type IdentityCardEmployee = {
  id: number;
  employee_number: string;
  primary_name: string;
  preferred_name: string | null;
  work_email: string | null;
  profile_photo_path: string | null;
  employment_status: string;
  primary_assignment: {
    organization_unit: { id: number; name: string } | null;
    position: { id: number; title: string } | null;
  } | null;
};

export type EmployeeIdentityCard = {
  id: number;
  public_id: string;
  card_number: string;
  employee_id: number;
  template_id: number;
  parent_card_id: number | null;
  batch_reference: string | null;
  status: "active" | "expired" | "revoked" | "replaced";
  effective_status: "active" | "expired" | "revoked" | "replaced";
  issued_on: string;
  expires_on: string | null;
  activated_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  snapshot: Record<string, string | null>;
  notes: string | null;
  verification_path: string;
  employee?: IdentityCardEmployee;
  template?: IdentityCardTemplate;
};

export type EligibleIdentityEmployee = {
  id: number;
  employee_number: string;
  primary_name: string;
  work_email: string | null;
  profile_photo_path: string | null;
  employment_status: string;
  organization_unit: string | null;
  position: string | null;
  active_card: EmployeeIdentityCard | null;
};

export type IdentityCardWorkspace = {
  summary: {
    active: number;
    expiring_soon: number;
    expired: number;
    revoked: number;
    unissued_employees: number;
    total_history: number;
  };
  templates: IdentityCardTemplate[];
  recent_cards: EmployeeIdentityCard[];
};

export type IdentityCardVerification = {
  is_valid: boolean;
  checked_at: string;
  card: {
    public_id: string;
    card_number: string;
    effective_status: EmployeeIdentityCard["effective_status"];
    issued_on: string;
    expires_on: string | null;
    employee: {
      employee_number: string | null;
      primary_name: string | null;
      employment_status: string | null;
      organization_unit: string | null;
      position: string | null;
    };
    template_name: string | null;
  };
};

export type IdentityCardTemplatePayload = Omit<
  IdentityCardTemplate,
  "id" | "cards_count"
>;

export function fetchIdentityCardWorkspace(): Promise<{ data: IdentityCardWorkspace }> {
  return hrFetch("/identity-cards/workspace");
}

export function fetchIdentityCards(params: {
  search?: string;
  status?: string;
  page?: number;
}): Promise<Paginated<EmployeeIdentityCard>> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  query.set("per_page", "50");
  return hrFetch(`/identity-cards?${query.toString()}`);
}

export function fetchEligibleIdentityEmployees(
  search = "",
): Promise<{ data: EligibleIdentityEmployee[] }> {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  return hrFetch(`/identity-cards/eligible-employees?${query.toString()}`);
}

export function issueIdentityCards(payload: {
  employee_ids: number[];
  template_id: number;
  issued_on: string;
  expires_on?: string;
  notes?: string;
}): Promise<{ data: EmployeeIdentityCard[]; message?: string }> {
  return hrFetch("/identity-cards/issue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function revokeIdentityCard(
  id: number,
  reason: string,
): Promise<EmployeeIdentityCard> {
  return hrFetch(`/identity-cards/${id}/revoke`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function renewIdentityCard(
  id: number,
  payload: {
    template_id?: number;
    issued_on: string;
    expires_on?: string;
    reason?: string;
    notes?: string;
  },
): Promise<EmployeeIdentityCard> {
  return hrFetch(`/identity-cards/${id}/renew`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyIdentityCard(
  publicId: string,
): Promise<{ data: IdentityCardVerification }> {
  return hrFetch(`/identity-cards/verify/${encodeURIComponent(publicId)}`);
}

export function fetchIdentityCardTemplates(): Promise<{
  data: IdentityCardTemplate[];
}> {
  return hrFetch("/identity-card-templates");
}

export function saveIdentityCardTemplate(
  payload: IdentityCardTemplatePayload,
  id?: number,
): Promise<IdentityCardTemplate> {
  return hrFetch(
    id ? `/identity-card-templates/${id}` : "/identity-card-templates",
    {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function duplicateIdentityCardTemplate(
  id: number,
  payload: { code: string; name: string },
): Promise<IdentityCardTemplate> {
  return hrFetch(`/identity-card-templates/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteIdentityCardTemplate(id: number): Promise<void> {
  return hrFetch(`/identity-card-templates/${id}`, { method: "DELETE" });
}
