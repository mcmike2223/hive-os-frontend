"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supportBotApi } from "@/modules/support-bot/api/support-bot-api";
import { SupportBot } from "@/modules/support-bot/types";
import { KnowledgeBaseHub } from "@/modules/support-bot/components/knowledge-base/knowledge-base-hub";

export default function KnowledgePage() {
  const params = useParams();
  const botId = Number(params.id);
  const [bot, setBot] = React.useState<SupportBot | null>(null);

  React.useEffect(() => {
    if (botId) {
      supportBotApi.getBot(botId).then(setBot);
    }
  }, [botId]);

  if (!bot) return <div className="p-6 text-sm text-muted-foreground">Loading Knowledge Base...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/support-bot/${bot.id}`}>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Knowledge Base & RAG Training</h1>
          <p className="text-xs text-muted-foreground">Manage training documents & ERP sync for {bot.name}</p>
        </div>
      </div>

      <KnowledgeBaseHub bot={bot} />
    </div>
  );
}
