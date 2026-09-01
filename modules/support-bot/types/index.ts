export interface SupportBot {
  id: number;
  tenant_id: string;
  name: string;
  slug: string;
  public_id?: string | null;
  description?: string | null;
  avatar_url?: string | null;
  primary_color: string;
  system_prompt?: string | null;
  llm_provider: string;
  model: string;
  temperature: number;
  greeting_message?: string | null;
  fallback_message?: string | null;
  is_active: boolean;
  enable_human_escalation: boolean;
  widget_config?: {
    position?: 'bottom-right' | 'bottom-left';
    title?: string;
    subtitle?: string;
    show_avatar?: boolean;
    header_gradient?: boolean;
  } | null;
  channels_config?: {
    whatsapp_enabled?: boolean;
    telegram_enabled?: boolean;
    webchat_enabled?: boolean;
  } | null;
  conversations_count?: number;
  knowledge_bases_count?: number;
  flows_count?: number;
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'question' | 'condition' | 'knowledge' | 'action' | 'handover';
  position: { x: number; y: number };
  data: {
    label: string;
    message?: string;
    buttons?: string[];
    variable_name?: string;
    condition_type?: string;
    condition_value?: string;
    action_type?: string;
    kb_category?: string;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface SupportBotFlow {
  id: number;
  bot_id: number;
  name: string;
  slug: string;
  description?: string | null;
  trigger_type: 'conversation_start' | 'keyword' | 'intent' | 'custom';
  trigger_keywords?: string[] | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupportBotKnowledgeBase {
  id: number;
  bot_id: number;
  title: string;
  type: 'faq' | 'document' | 'text' | 'erp_catalog';
  question?: string | null;
  answer: string;
  source_url?: string | null;
  category?: string | null;
  tags?: string[] | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupportBotConversation {
  id: number;
  bot_id: number;
  session_id: string;
  visitor_id?: string | null;
  visitor_name?: string | null;
  visitor_email?: string | null;
  visitor_phone?: string | null;
  channel: 'webchat' | 'whatsapp' | 'telegram' | 'api';
  status: 'active' | 'escalated' | 'resolved' | 'closed';
  assigned_agent_id?: number | null;
  assigned_agent?: {
    id: number;
    name: string;
    email: string;
  } | null;
  current_flow_id?: number | null;
  current_node_id?: string | null;
  variables?: Record<string, any> | null;
  rating?: number | null;
  feedback?: string | null;
  last_activity_at?: string | null;
  created_at: string;
  updated_at: string;
  messages?: SupportBotMessage[];
}

export interface SupportBotMessage {
  id: number;
  conversation_id: number;
  sender_type: 'visitor' | 'bot' | 'agent' | 'system';
  sender_name?: string | null;
  message_type: 'text' | 'cards' | 'quick_replies' | 'buttons' | 'form' | 'image';
  content: string;
  payload?: {
    quick_replies?: string[];
    source_kb?: string;
    confidence?: number;
    suggested_followups?: string[];
    node_id?: string;
    escalated?: boolean;
    [key: string]: any;
  } | null;
  tokens_used: number;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupportBotAnalyticsSummary {
  total_conversations: number;
  active_conversations: number;
  escalated_conversations: number;
  resolved_conversations: number;
  deflection_rate: number;
  total_messages: number;
  total_knowledge_articles: number;
  total_flows: number;
}
