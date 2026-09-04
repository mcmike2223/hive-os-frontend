"use client";

import { useEffect, useState } from "react";
import { Mail, MessageSquare, Radio, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCommunicationBrand } from "@/hooks/use-communication-brand";
import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import { cn } from "@/lib/utils";

type CommunicationWorkspaceHeaderProps = {
  kind: "chat" | "mail";
  onlineCount: number;
  unreadCount: number;
};

const statusCopy = {
  connected: "Reverb connected",
  connecting: "Reverb connecting",
  disconnected: "Reverb reconnecting",
  unavailable: "Realtime unavailable",
} as const;

export function CommunicationBrandMark({ compact = false }: { compact?: boolean }) {
  const { appTitle, iconUrl, logoUrl } = useCommunicationBrand();
  const [imageFailed, setImageFailed] = useState(false);
  const source = compact ? iconUrl || logoUrl : logoUrl || iconUrl;

  useEffect(() => setImageFailed(false), [source]);

  if (source && !imageFailed) {
    return (
      <img
        src={source}
        alt={`${appTitle} logo`}
        className={cn("object-contain", compact ? "size-9" : "h-10 max-w-36")}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span
      aria-label={`${appTitle} logo`}
      className="flex size-10 items-center justify-center rounded-xl bg-primary font-black text-primary-foreground shadow-sm"
    >
      {appTitle.charAt(0).toUpperCase()}
    </span>
  );
}

export function CommunicationWorkspaceHeader({
  kind,
  onlineCount,
  unreadCount,
}: CommunicationWorkspaceHeaderProps) {
  const { appTitle } = useCommunicationBrand();
  const realtimeStatus = useRealtimeStatus();
  const Icon = kind === "chat" ? MessageSquare : Mail;
  const title = kind === "chat" ? "Team chat" : "Workspace mail";
  const description = kind === "chat"
    ? "Fast conversations, shared files, and presence in one secure workspace."
    : "Focused internal mail with live delivery, drafts, and synchronized actions.";

  useEffect(() => {
    document.title = `${title} | ${appTitle}`;
  }, [appTitle, title]);

  return (
    <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-16 items-center justify-center rounded-xl border border-border/60 bg-background/70 px-2 py-1.5 shadow-xs">
            <CommunicationBrandMark />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon aria-hidden="true" className="size-5 text-primary" />
              <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
                {title}
              </h1>
            </div>
            <p className="mt-0.5 hidden max-w-2xl truncate text-xs text-muted-foreground md:block">
              {description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label={`${title} status`}>
          <Badge variant="outline" className="gap-1.5 bg-background/70" role="status" aria-live="polite">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                realtimeStatus === "connected" && "bg-primary motion-safe:animate-pulse",
                realtimeStatus === "connecting" && "bg-muted-foreground motion-safe:animate-pulse",
                (realtimeStatus === "disconnected" || realtimeStatus === "unavailable") && "bg-destructive",
              )}
            />
            <Radio aria-hidden="true" />
            {statusCopy[realtimeStatus]}
          </Badge>
          <Badge variant="secondary">
            <Users aria-hidden="true" />
            {onlineCount} online
          </Badge>
          <Badge variant={unreadCount > 0 ? "default" : "outline"}>
            <Mail aria-hidden="true" />
            {unreadCount} unread
          </Badge>
        </div>
      </div>
    </header>
  );
}
