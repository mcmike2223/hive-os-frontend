"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { OfflineStatusBanner } from "@/components/offline/offline-status-banner";
import { OfflineQueueInspector } from "@/components/offline/queue-inspector";
import { OfflineRuntime } from "@/components/providers/offline-runtime";
import { useTranslation } from "@/store/use-translation";
import {
  restorePersistedQueryCache,
  subscribeToPersistedQueryCache,
} from "@/lib/offline/query-persistence";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: false,
        networkMode: "online",
      },
      mutations: {
        retry: false,
        // Run mutations even when offline so the global axios offline
        // interceptor can queue them. The interceptor returns a 202
        // synthetic success to React Query, so `onSuccess` still fires.
        networkMode: "always",
      },
    },
  });

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [isRestored, setIsRestored] = useState(false);
  const { initLocale } = useTranslation();

  useEffect(() => {
    initLocale();
  }, [initLocale]);

  useEffect(() => {
    restorePersistedQueryCache(queryClient);
    setIsRestored(true);
  }, [queryClient]);

  useEffect(() => {
    if (!isRestored) {
      return;
    }

    return subscribeToPersistedQueryCache(queryClient);
  }, [queryClient, isRestored]);

  useEffect(() => {
    const handleSessionCleared = () => {
      queryClient.clear();
    };

    const handleSessionChanged = () => {
      // Re-hydrate the persisted cache for the new user/context so they
      // don't briefly see the previous session's cached rows.
      restorePersistedQueryCache(queryClient);
    };

    window.addEventListener("hive_session_cleared", handleSessionCleared);
    window.addEventListener("hive_session_changed", handleSessionChanged);
    return () => {
      window.removeEventListener("hive_session_cleared", handleSessionCleared);
      window.removeEventListener("hive_session_changed", handleSessionChanged);
    };
  }, [queryClient]);

  const pathname = usePathname() ?? "";

  /**
   * The assistant's embed iframe renders on sites Hive does not control, and
   * must contain the assistant and nothing else — not a status banner about
   * Hive's own sync state, and certainly not a debug tool.
   */
  const isEmbedFrame = pathname.startsWith("/embed/");

  /**
   * Where the offline *queue inspector* belongs: inside the signed-in
   * application.
   *
   * It is a debug panel for staff doing work that must survive a dropped
   * connection — a POS terminal, a stock count — and all of that lives under
   * /dashboard. It was rendering on every page instead, including the public
   * marketing site, pinned in the bottom-right corner at z-130. The assistant's
   * launcher sits at z-50, so it had been shunted 96px inboard to avoid being
   * covered, which left it stranded mid-page beside a debug button where no
   * visitor would ever look for it.
   *
   * The banner is deliberately not scoped the same way. It is a thin, transient
   * "you are offline" notice rather than a persistent control, and the sign-in
   * and LMS login pages both queue requests offline — telling somebody why
   * their login is not going through is worth more there than tidiness.
   */
  const showQueueInspector = pathname.startsWith("/dashboard");

  if (!isRestored) {
    return <div className="h-screen w-screen bg-background" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineRuntime />

      {!isEmbedFrame && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[120] flex flex-col">
          <div className="pointer-events-auto">
            <OfflineStatusBanner />
          </div>
        </div>
      )}

      {showQueueInspector && <OfflineQueueInspector />}

      {children}
    </QueryClientProvider>
  );
}
