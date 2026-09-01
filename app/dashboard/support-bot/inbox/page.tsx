"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { LiveSupportInbox } from "@/modules/support-bot/components/live-inbox/live-support-inbox";
import { NoBotConfigured } from "@/modules/support-bot/components/no-bot-configured";
import { supportBotApi } from "@/modules/support-bot/api/support-bot-api";
import { SupportBot } from "@/modules/support-bot/types/index";

export default function SupportBotInboxPage() {
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
        <span className="text-sm font-medium">Loading Support Inbox...</span>
      </div>
    );
  }

  if (!selectedBot) {
    return (
      <div className="p-6">
        <NoBotConfigured area="The support inbox" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <LiveSupportInbox bot={selectedBot} />
    </div>
  );
}
