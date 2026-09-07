"use client";

import * as React from "react";
import { use } from "react";

import {
  SupportWebchatWidget,
  type WidgetCommand,
} from "@/components/support-bot/support-webchat-widget";

/**
 * Queen Bee, standalone, for embedding on a tenant's own site.
 *
 * Rendered inside an iframe by the loader served from
 * `/api/v1/public/support-bot/{slug}/embed.js`. Two things cross that boundary,
 * both by postMessage:
 *
 *  - upwards: open/closed, so the loader can resize a frame that cannot resize
 *    itself, plus a ping when she says something so the loader can show an
 *    unread badge the clipped 84px frame has no room for;
 *  - downwards: the host page's `HiveAssistant` API — open, close, send,
 *    identify — turned into commands the widget applies.
 *
 * Messages are accepted only from the origin the loader was issued for. Any
 * page can host any iframe and post into it, so an unchecked handler here is an
 * open channel from whatever else is on the host page.
 */
export default function SupportBotEmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [command, setCommand] = React.useState<WidgetCommand | null>(null);

  /**
   * The origin allowed to talk to this frame.
   *
   * Taken from the loader's `?host=` rather than trusted from each message, so
   * there is one decision made once rather than a comparison repeated in a
   * handler somebody may later simplify. Absent — the page opened directly —
   * means no host is talking to it and nothing is accepted.
   */
  const hostOrigin = React.useMemo(() => {
    if (typeof window === "undefined") return null;

    const declared = new URLSearchParams(window.location.search).get("host");

    if (!declared) return null;

    try {
      return new URL(declared).origin;
    } catch {
      return null;
    }
  }, []);

  const post = React.useCallback(
    (message: Record<string, unknown>) => {
      if (typeof window === "undefined" || window.parent === window) return;

      // Targeted at the host's own origin rather than "*": a wildcard target
      // hands the message to whatever happens to be framing this page.
      window.parent.postMessage(
        { channel: "hive-support-bot", slug, ...message },
        hostOrigin ?? "*",
      );
    },
    [slug, hostOrigin],
  );

  const notifyParent = React.useCallback(
    (open: boolean) => post({ type: "resize", open }),
    [post],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let nextId = 1;

    const onMessage = (event: MessageEvent) => {
      if (hostOrigin === null || event.origin !== hostOrigin) return;

      const data = event.data as
        | { channel?: string; slug?: string; type?: string; text?: string; open?: boolean; visitor?: Record<string, string> }
        | null;

      if (!data || data.channel !== "hive-support-bot" || data.slug !== slug) return;

      if (data.type === "set-open") {
        setCommand({ id: nextId++, type: data.open ? "open" : "close" });
        return;
      }

      if (data.type === "send" && typeof data.text === "string") {
        setCommand({ id: nextId++, type: "send", text: data.text });
        return;
      }

      if (data.type === "identify" && data.visitor && typeof data.visitor === "object") {
        setCommand({ id: nextId++, type: "identify", visitor: data.visitor });
      }
    };

    window.addEventListener("message", onMessage);

    return () => window.removeEventListener("message", onMessage);
  }, [slug, hostOrigin]);

  // The host page's own background shows through; the widget paints its own.
  React.useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
  }, []);

  return (
    <div className="h-screen w-screen bg-transparent">
      <SupportWebchatWidget
        botSlug={slug}
        embedded
        command={command}
        onOpenChange={notifyParent}
        onReady={React.useCallback(() => post({ type: "ready" }), [post])}
        onBotMessage={React.useCallback(
          (message: { content: string; sender: string }) =>
            post({ type: "message", message }),
          [post],
        )}
      />
    </div>
  );
}
