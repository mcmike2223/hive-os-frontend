export interface ApprovalRole {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  users?: Array<{
    id: number;
    name: string;
    email: string;
    avatar_url?: string;
    avatar_path?: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowApprovalSubject {
  name?: string;
  subtitle?: string;
  title?: string;
  document_number?: string;
  payload?: Record<string, unknown>;
}

export interface WorkflowApproval {
  id: number;
  approvable_type: string;
  approvable_id: number | string;
  approvable?: WorkflowApprovalSubject | null;
  workflow_definition_id?: number | null;
  trigger_event?: string;
  status: "pending" | "approved" | "rejected";
  notes?: string | null;
  signature_hash?: string | null;
  signed_at?: string | null;
  actioned_at?: string | null;
  action_metadata?: Record<string, unknown> | null;
}
