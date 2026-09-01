"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { SupportBotAnalyticsView } from "@/modules/support-bot/components/analytics/support-bot-analytics-view";
import { NoBotConfigured } from "@/modules/support-bot/components/no-bot-configured";
import { supportBotApi } from "@/modules/support-bot/api/support-bot-api";
import { SupportBot } from "@/modules/support-bot/types/index";

export default function SupportBotAnalyticsPage() {
  const [selectedBot, setSelectedBot] = React.useState<SupportBot | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    supportBotApi
      .getBots()
      .then((data: SupportBot[]) => {
        if (data.length > 0) setSelectedBot(data[0]);
      })
      .catch((e: unknown) => console.error("Failed to load bots", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading analytics...</span>
      </div>
    );
  }

  if (!selectedBot) {
    return (
      <div className="p-6">
        <NoBotConfigured area="Assistant analytics" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <SupportBotAnalyticsView bot={selectedBot} />
    </div>
  );
}
