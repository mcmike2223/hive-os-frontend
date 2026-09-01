"use client";

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  Headphones,
  CheckCircle2,
  Bot,
  MessageSquare,
  Sparkles,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supportBotApi } from "../../api/support-bot-api";
import { SupportBot, SupportBotAnalyticsSummary } from "../../types";

interface Props {
  bot: SupportBot;
}

export function SupportBotAnalyticsView({ bot }: Props) {
  const [summary, setSummary] = React.useState<SupportBotAnalyticsSummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await supportBotApi.getAnalyticsSummary(bot.id);
        setSummary(data);
      } catch (e) {
        console.error("Failed to load analytics", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [bot.id]);

  if (loading || !summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-28 animate-pulse rounded-xl bg-muted/60" />
        ))}
      </div>
    );
  }

  const deflection = summary.deflection_rate ?? 100;

  return (
    <div className="space-y-6">
      {/* 4 Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              AI Deflection Rate
            </CardTitle>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{deflection}%</div>
            <p className="text-[11px] text-muted-foreground mt-1">Handled without human escalation</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Conversations
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summary.total_conversations}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{summary.total_messages} total messages</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Live Escalations
            </CardTitle>
            <Headphones className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summary.escalated_conversations}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Transferred to support specialists</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Knowledge Articles
            </CardTitle>
            <BookOpen className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summary.total_knowledge_articles}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{summary.total_flows} interactive flows</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Details */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="border-border/80 shadow-sm lg:col-span-8">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Automated Triage & Resolution Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Performance metrics for {bot.name} over recent customer interactions.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1.5 font-medium">
                <span>Autonomous AI Resolution ({summary.total_conversations - summary.escalated_conversations} chats)</span>
                <span className="text-emerald-600 font-bold">{deflection}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${deflection}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1.5 font-medium">
                <span>Human Escalations ({summary.escalated_conversations} chats)</span>
                <span className="text-rose-600 font-bold">
                  {summary.total_conversations > 0 ? (100 - deflection).toFixed(1) : 0}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${100 - deflection}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm lg:col-span-4">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Autonomous Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>RAG Knowledge Base & FAQ Engine</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>ERP Multi-Warehouse & Item Sync</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Ethiopian VAT & Tax Proclamation QA</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Live Support Handover with Canned Replies</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
