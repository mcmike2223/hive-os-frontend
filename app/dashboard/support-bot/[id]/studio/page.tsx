"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supportBotApi } from "@/modules/support-bot/api/support-bot-api";
import { SupportBot } from "@/modules/support-bot/types";
import { VisualFlowBuilder } from "@/modules/support-bot/components/flow-builder/visual-flow-builder";
import { BotTestSimulator } from "@/modules/support-bot/components/simulator/bot-test-simulator";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function StudioPage() {
  const params = useParams();
  const botId = Number(params.id);
  const [bot, setBot] = React.useState<SupportBot | null>(null);
  const [simOpen, setSimOpen] = React.useState(false);

  React.useEffect(() => {
    if (botId) {
      supportBotApi.getBot(botId).then(setBot);
    }
  }, [botId]);

  if (!bot) return <div className="p-6 text-sm text-muted-foreground">Loading Flow Studio...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/support-bot/${bot.id}`}>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Visual Conversational Flow Studio</h1>
          <p className="text-xs text-muted-foreground">Configuring flows for {bot.name}</p>
        </div>
      </div>

      <VisualFlowBuilder bot={bot} onOpenSimulator={() => setSimOpen(true)} />

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
