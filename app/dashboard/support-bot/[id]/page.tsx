"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Workflow,
  BookOpen,
  Headphones,
  Code2,
  Settings,
  ArrowLeft,
  Play,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supportBotApi } from "@/modules/support-bot/api/support-bot-api";
import { SupportBot } from "@/modules/support-bot/types";
import { VisualFlowBuilder } from "@/modules/support-bot/components/flow-builder/visual-flow-builder";
import { KnowledgeBaseHub } from "@/modules/support-bot/components/knowledge-base/knowledge-base-hub";
import { LiveSupportInbox } from "@/modules/support-bot/components/live-inbox/live-support-inbox";
import { WidgetCustomizer } from "@/modules/support-bot/components/widget-customizer/widget-customizer";
import { SupportBotAnalyticsView } from "@/modules/support-bot/components/analytics/support-bot-analytics-view";
import { BotTestSimulator } from "@/modules/support-bot/components/simulator/bot-test-simulator";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function SupportBotDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const botId = Number(params.id);

  const [bot, setBot] = React.useState<SupportBot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("flows");
  const [simOpen, setSimOpen] = React.useState(false);

  const loadBot = async () => {
    try {
      setLoading(true);
      const data = await supportBotApi.getBot(botId);
      setBot(data);
    } catch (e) {
      console.error("Failed to load bot", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (botId) loadBot();
  }, [botId]);

  if (loading || !bot) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Bot Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/support-bot">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: bot.primary_color || "#3b82f6" }}
          >
            <Bot className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{bot.name}</h1>
              <Badge variant={bot.is_active ? "default" : "secondary"} className="text-[10px]">
                {bot.is_active ? "Active" : "Disabled"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{bot.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setSimOpen(true)}
            variant="outline"
            className="gap-1.5 text-xs text-primary border-primary/40 bg-primary/5 hover:bg-primary/10 shadow-sm"
          >
            <Play className="h-3.5 w-3.5 fill-primary" />
            Test Live Simulator
          </Button>

          <Link href={`/dashboard/support-bot/${bot.id}/settings`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Studio Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="flows" className="gap-1.5 text-xs rounded-lg">
            <Workflow className="h-3.5 w-3.5 text-blue-500" />
            Visual Flow Studio
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1.5 text-xs rounded-lg">
            <BookOpen className="h-3.5 w-3.5 text-amber-500" />
            RAG Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-1.5 text-xs rounded-lg">
            <Headphones className="h-3.5 w-3.5 text-rose-500" />
            Live Support Inbox
          </TabsTrigger>
          <TabsTrigger value="widget" className="gap-1.5 text-xs rounded-lg">
            <Code2 className="h-3.5 w-3.5 text-emerald-500" />
            Embed Webchat
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs rounded-lg">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            Analytics & Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="m-0">
          <VisualFlowBuilder bot={bot} onOpenSimulator={() => setSimOpen(true)} />
        </TabsContent>

        <TabsContent value="knowledge" className="m-0">
          <KnowledgeBaseHub bot={bot} onRefresh={loadBot} />
        </TabsContent>

        <TabsContent value="inbox" className="m-0">
          <LiveSupportInbox bot={bot} />
        </TabsContent>

        <TabsContent value="widget" className="m-0">
          <WidgetCustomizer bot={bot} onRefresh={loadBot} />
        </TabsContent>

        <TabsContent value="analytics" className="m-0">
          <SupportBotAnalyticsView bot={bot} />
        </TabsContent>
      </Tabs>

      {/* Simulator Modal */}
      {simOpen && (
        <Dialog open={simOpen} onOpenChange={setSimOpen}>
          <DialogContent className="sm:max-w-md h-[600px] p-0 overflow-hidden">
            <BotTestSimulator bot={bot} onClose={() => setSimOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
