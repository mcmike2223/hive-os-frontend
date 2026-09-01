import api from "@/modules/shared/api/http";

/**
 * Client for the authenticated ERP Copilot.
 *
 * Every decision — which tool to run, whether the user may run it, what still
 * needs asking — is made server-side. This module only carries the conversation
 * back and forth; it deliberately holds no intent parsing and issues no writes
 * of its own, so nothing here can reach the ERP outside the Copilot's
 * permission and confirmation checks.
 */

export type CopilotMode =
  | "information"
  | "guidance"
  | "navigation"
  | "search"
  | "analytics"
  | "action"
  | "troubleshooting";

export interface CopilotMissingField {
  name: string;
  label: string;
  type: string;
  options: string[];
  description?: string | null;
}

export interface CopilotConfirmation {
  token: string;
  tool: string;
  module: string;
  risk: "low" | "elevated" | "critical";
  summary: string;
  parameters: Record<string, unknown>;
}

export interface CopilotNavigationLink {
  label: string;
  href: string;
  module: string;
}

export interface CopilotSource {
  title: string;
  kind: string;
  module: string;
  href: string | null;
}

/** Slots gathered so far; echoed back verbatim on the next turn. */
export interface CopilotState {
  pending_tool?: string;
  slots?: Record<string, string | number | boolean>;
  awaiting_input?: string[];
}

export interface CopilotPayload {
  tool?: string;
  module?: string;
  confirmation?: CopilotConfirmation;
  navigation?: CopilotNavigationLink[];
  sources?: CopilotSource[];
  records?: Array<Record<string, unknown>>;
  total?: number;
  missing_fields?: CopilotMissingField[];
  awaiting_input?: string[];
  state?: CopilotState;
  follow_ups?: string[];
  validation_errors?: Record<string, string[]>;
  denied?: boolean;
  failed?: boolean;
  unsupported?: boolean;
  pending_approval?: boolean;
  capabilities?: Record<string, string[]>;
  diagnosis?: string;
  required_permissions?: string[];
}

export interface CopilotReply {
  content: string;
  mode: CopilotMode;
  payload: CopilotPayload;
  context: { tenant_id: string; page: string | null };
}

export interface CopilotPageContext {
  route?: string;
  module?: string;
  record_type?: string;
  record_id?: number;
}

export interface CopilotCapabilities {
  modules: Array<{
    module: string;
    tools: Array<{
      name: string;
      submodule: string | null;
      description: string;
      risk: string;
      requires_confirmation: boolean;
      is_write: boolean;
      examples: string[];
    }>;
  }>;
  suggestions: string[];
  total_tools: number;
}

export const sendCopilotMessage = async (payload: {
  message: string;
  state?: CopilotState;
  page_context?: CopilotPageContext;
  conversation_id?: number;
}): Promise<CopilotReply> => (await api.post<CopilotReply>("/copilot/chat", payload)).data;

export const confirmCopilotAction = async (token: string): Promise<CopilotReply> =>
  (await api.post<CopilotReply>("/copilot/confirm", { token })).data;

export const cancelCopilotAction = async (token: string): Promise<CopilotReply> =>
  (await api.post<CopilotReply>("/copilot/cancel", { token })).data;

export const fetchCopilotCapabilities = async (): Promise<CopilotCapabilities> =>
  (await api.get<{ data: CopilotCapabilities }>("/copilot/capabilities")).data.data;

/* -------------------------------------------------------------------------- */
/*  Settings                                                                    */
/* -------------------------------------------------------------------------- */

export type CopilotProvider =
  | "gemini"
  | "groq"
  | "ollama"
  | "openrouter"
  | "openai"
  | "anthropic";

export interface CopilotFeatureFlags {
  tax_calculator: boolean;
  erp_navigation: boolean;
  voice_input: boolean;
  human_escalation: boolean;
  autonomous_actions: boolean;
  llm_phrasing: boolean;
}

export interface CopilotKnowledgeStatus {
  documents: number;
  tools: number;
  available_tools: number;
  modules: number;
  operations: number;
  fingerprint: string;
  indexed_fingerprint: string | null;
  up_to_date: boolean;
  manifest_stale: boolean;
  last_synced_at: string | null;
}

/**
 * Note what is absent: there is no `api_key`. The credential is write-only
 * across this boundary — the server reports whether one exists and what it
 * ends with, and never sends the value back.
 */
export interface CopilotSettings {
  bot_id: number;
  provider: CopilotProvider;
  model: string | null;
  base_url: string | null;
  temperature: number;
  max_tokens: number;
  system_prompt: string | null;
  features: CopilotFeatureFlags;
  has_api_key: boolean;
  api_key_source: "bot" | "environment" | "none";
  api_key_hint: string | null;
  knowledge: CopilotKnowledgeStatus;
}

export interface CopilotSettingsUpdate {
  provider?: CopilotProvider;
  model?: string | null;
  /** Omit to keep the stored key; empty string clears it. */
  api_key?: string;
  base_url?: string | null;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string | null;
  features?: Partial<CopilotFeatureFlags>;
}

export const fetchCopilotSettings = async (): Promise<CopilotSettings> =>
  (await api.get<{ data: CopilotSettings }>("/copilot/settings")).data.data;

export const saveCopilotSettings = async (
  payload: CopilotSettingsUpdate,
): Promise<CopilotSettings> =>
  (await api.put<{ data: CopilotSettings }>("/copilot/settings", payload)).data.data;

export interface CopilotConnectionTest {
  ok: boolean;
  message: string;
  sample: string | null;
}

/** Runs on the server: a key never has to reach a browser to be verified. */
export const testCopilotConnection = async (payload: {
  provider?: CopilotProvider;
  model?: string | null;
  api_key?: string;
  base_url?: string | null;
}): Promise<CopilotConnectionTest> =>
  (await api.post<{ data: CopilotConnectionTest }>("/copilot/settings/test", payload)).data.data;

export interface CopilotModelOption {
  value: string;
  label: string;
}

/** The models the configured credential can actually use, read live. */
export const fetchCopilotModels = async (params: {
  provider?: CopilotProvider;
  api_key?: string;
  base_url?: string | null;
}): Promise<{ provider: string; models: CopilotModelOption[]; error: string | null }> =>
  (
    await api.get<{
      data: { provider: string; models: CopilotModelOption[]; error: string | null };
    }>("/copilot/settings/models", { params })
  ).data.data;

export const reindexCopilotKnowledge = async (): Promise<{
  ok: boolean;
  documents: number;
  output: string;
}> =>
  (
    await api.post<{ data: { ok: boolean; documents: number; output: string } }>(
      "/copilot/settings/reindex",
    )
  ).data.data;
