"use client";

import * as React from "react";
import { use } from "react";

import { SupportWebchatWidget } from "@/components/support-bot/support-webchat-widget";

/**
 * The assistant, standalone, for embedding on a tenant's own site.
 *
 * Rendered inside an iframe by the loader served from
 * `/api/v1/public/support-bot/{slug}/embed.js`. The iframe cannot size itself
 * on the host page, so open/closed transitions are posted to the parent and the
 * loader resizes the frame — which is why this page reports the widget's state
 * rather than assuming a fixed box.
 */
export default function SupportBotEmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const notifyParent = React.useCallback(
    (open: boolean) => {
      if (typeof window === "undefined" || window.parent === window) return;

      window.parent.postMessage(
        { channel: "hive-support-bot", type: "resize", slug, open },
        "*",
      );
    },
    [slug],
  );

  // The host page's own background shows through; the widget paints its own.
  React.useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
  }, []);

  return (
    <div className="h-screen w-screen bg-transparent">
      <SupportWebchatWidget botSlug={slug} embedded onOpenChange={notifyParent} />
    </div>
  );
}
