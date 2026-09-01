"use client";

import Link from "next/link";
import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown when the workspace has no assistant yet.
 *
 * These pages used to invent one — a hardcoded `{ id: 1, tenant_id: "central" }`
 * — and render their full interface against it. Every action then targeted a bot
 * that either did not exist or belonged to someone else, so the user met
 * unexplained failures instead of an empty state.
 */
export function NoBotConfigured({ area }: { area: string }) {
  return (
    <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Bot className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium">No assistant configured yet</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {area} becomes available once this workspace has an assistant. Set one up in AI
          settings — it takes a provider and a key.
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard/settings?tab=ai-assistant">Open AI settings</Link>
      </Button>
    </div>
  );
}

export default NoBotConfigured;
