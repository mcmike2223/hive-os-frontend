import api from "@/modules/shared/api/http";
import {
  SupportBot,
  SupportBotFlow,
  SupportBotKnowledgeBase,
  SupportBotConversation,
  SupportBotMessage,
  SupportBotAnalyticsSummary,
} from "../types";

export interface PublicSupportSessionCredentials {
  session_id: string;
  session_token: string;
}

export interface PublicSupportVisitor {
  name?: string;
  email?: string;
  phone?: string;
}

export const supportBotApi = {
  // Bots
  getBots: async (): Promise<SupportBot[]> => {
    const res = await api.get("/support-bot/bots");
    return res.data?.data || [];
  },

  getBot: async (id: number): Promise<SupportBot> => {
    const res = await api.get(`/support-bot/bots/${id}`);
    return res.data?.data;
  },

  createBot: async (payload: Partial<SupportBot>): Promise<SupportBot> => {
    const res = await api.post("/support-bot/bots", payload);
    return res.data?.data;
  },

  updateBot: async (id: number, payload: Partial<SupportBot>): Promise<SupportBot> => {
    const res = await api.put(`/support-bot/bots/${id}`, payload);
    return res.data?.data;
  },

  deleteBot: async (id: number): Promise<void> => {
    await api.delete(`/support-bot/bots/${id}`);
  },

  duplicateBot: async (id: number): Promise<SupportBot> => {
    const res = await api.post(`/support-bot/bots/${id}/duplicate`);
    return res.data?.data;
  },

  // Flows
  getFlows: async (botId: number): Promise<SupportBotFlow[]> => {
    const res = await api.get(`/support-bot/bots/${botId}/flows`);
    return res.data?.data || [];
  },

  getFlow: async (botId: number, flowId: number): Promise<SupportBotFlow> => {
    const res = await api.get(`/support-bot/bots/${botId}/flows/${flowId}`);
    return res.data?.data;
  },

  saveFlow: async (
    botId: number,
    flowId: number,
    payload: Partial<SupportBotFlow>
  ): Promise<SupportBotFlow> => {
    const res = await api.put(`/support-bot/bots/${botId}/flows/${flowId}`, payload);
    return res.data?.data;
  },

  createFlow: async (botId: number, payload: Partial<SupportBotFlow>): Promise<SupportBotFlow> => {
    const res = await api.post(`/support-bot/bots/${botId}/flows`, payload);
    return res.data?.data;
  },

  deleteFlow: async (botId: number, flowId: number): Promise<void> => {
    await api.delete(`/support-bot/bots/${botId}/flows/${flowId}`);
  },

  // Knowledge Base
  getKnowledgeBases: async (botId: number): Promise<SupportBotKnowledgeBase[]> => {
    const res = await api.get(`/support-bot/bots/${botId}/knowledge`);
    return res.data?.data || [];
  },

  createKnowledgeEntry: async (
    botId: number,
    payload: Partial<SupportBotKnowledgeBase>
  ): Promise<SupportBotKnowledgeBase> => {
    const res = await api.post(`/support-bot/bots/${botId}/knowledge`, payload);
    return res.data?.data;
  },

  updateKnowledgeEntry: async (
    botId: number,
    id: number,
    payload: Partial<SupportBotKnowledgeBase>
  ): Promise<SupportBotKnowledgeBase> => {
    const res = await api.put(`/support-bot/bots/${botId}/knowledge/${id}`, payload);
    return res.data?.data;
  },

  deleteKnowledgeEntry: async (botId: number, id: number): Promise<void> => {
    await api.delete(`/support-bot/bots/${botId}/knowledge/${id}`);
  },

  syncErpCatalog: async (botId: number): Promise<{ message: string; synced_count: number }> => {
    const res = await api.post(`/support-bot/bots/${botId}/knowledge/sync-erp`);
    return res.data;
  },

  // Conversations & Live Inbox
  getConversations: async (
    botId: number,
    params?: { status?: string; channel?: string; page?: number }
  ): Promise<{ data: SupportBotConversation[]; total: number; current_page: number }> => {
    const res = await api.get(`/support-bot/bots/${botId}/conversations`, { params });
    return res.data;
  },

  getConversation: async (botId: number, conversationId: number): Promise<SupportBotConversation> => {
    const res = await api.get(`/support-bot/bots/${botId}/conversations/${conversationId}`);
    return res.data?.data;
  },

  /**
   * Tells the visitor an agent is composing. Fire-and-forget: a failed typing
   * ping must never interrupt the agent's actual reply.
   */
  sendTyping: async (botId: number, conversationId: number): Promise<void> => {
    await api
      .post(`/support-bot/bots/${botId}/conversations/${conversationId}/typing`)
      .catch(() => undefined);
  },

  sendAgentMessage: async (
    botId: number,
    conversationId: number,
    content: string
  ): Promise<SupportBotMessage> => {
    const res = await api.post(
      `/support-bot/bots/${botId}/conversations/${conversationId}/messages`,
      { content }
    );
    return res.data?.data;
  },

  updateConversationStatus: async (
    botId: number,
    conversationId: number,
    status: 'active' | 'escalated' | 'resolved' | 'closed'
  ): Promise<SupportBotConversation> => {
    const res = await api.post(
      `/support-bot/bots/${botId}/conversations/${conversationId}/status`,
      { status }
    );
    return res.data?.data;
  },

  // Analytics
  getAnalyticsSummary: async (botId: number): Promise<SupportBotAnalyticsSummary> => {
    const res = await api.get(`/support-bot/bots/${botId}/analytics/summary`);
    return res.data?.data;
  },

  // Public Simulator/Widget Endpoints
  publicGetConfig: async (slug: string) => {
    const res = await api.get(`/public/support-bot/${slug}/config`);
    return res.data?.data;
  },

  publicInitSession: async (
    identifier: string,
    credentials?: Partial<PublicSupportSessionCredentials>,
    visitor?: PublicSupportVisitor
  ) => {
    const res = await api.post(`/public/support-bot/${identifier}/session`, {
      session_id: credentials?.session_id,
      session_token: credentials?.session_token,
      visitor,
    });
    return res.data?.data;
  },

  publicSendMessage: async (
    identifier: string,
    credentials: PublicSupportSessionCredentials,
    message: string,
    visitor?: PublicSupportVisitor
  ) => {
    const res = await api.post(`/public/support-bot/${identifier}/chat`, {
      ...credentials,
      message,
      visitor,
    });
    return res.data?.data;
  },
};
