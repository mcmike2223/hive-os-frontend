import {
  Bot,
  MessageSquare,
  BookOpen,
  BarChart3,
} from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "support_bot" as const,
  subscriptionSlug: "support_bot",
  placement: "primary" as const,
};

export const supportBotModule: FrontendModuleDefinition = {
  id: "support_bot",
  name: "AI Customer Support Bot Studio",
  description:
    "Build, train, and deploy Botpress-like intelligent conversational AI assistants with visual flow builder, RAG knowledge base, ERP catalog sync, live human handover, and embeddable webchat widgets.",
  backendModule: "Modules\\SupportBot",
  routePrefixes: [
    "/dashboard/support-bot",
    "/dashboard/support-bot/inbox",
    "/dashboard/support-bot/knowledge",
    "/dashboard/support-bot/analytics",
  ],
  navItems: [
    {
      ...common,
      translationKey: "nav.support_bot_overview",
      fallbackLabel: "AI Bot Studio",
      href: "/dashboard/support-bot",
      icon: Bot,
      permissions: ["view_support_bots", "manage_support_bots"],
    },
    {
      ...common,
      translationKey: "nav.support_bot_conversations",
      fallbackLabel: "Live Conversations",
      href: "/dashboard/support-bot/inbox",
      icon: MessageSquare,
      permissions: ["view_support_bots", "manage_support_bots"],
    },
    {
      ...common,
      translationKey: "nav.support_bot_knowledge",
      fallbackLabel: "Knowledge Base & RAG",
      href: "/dashboard/support-bot/knowledge",
      icon: BookOpen,
      permissions: ["view_support_bots", "manage_support_bots"],
    },
    {
      ...common,
      translationKey: "nav.support_bot_analytics",
      fallbackLabel: "Bot Analytics",
      href: "/dashboard/support-bot/analytics",
      icon: BarChart3,
      permissions: ["view_support_bots", "manage_support_bots"],
    },
  ],
};
