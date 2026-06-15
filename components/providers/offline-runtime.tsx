"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useOfflineStatus } from "@/hooks/use-offline-status";
import { processOfflineMutationQueue } from "@/lib/offline/mutation-queue";
import { installAxiosOfflineInterceptor, uninstallAxiosOfflineInterceptor } from "@/lib/offline/axios-offline-interceptor";
import { installFetchOfflineInterceptor, uninstallFetchOfflineInterceptor } from "@/lib/offline/fetch-offline-interceptor";
import { ensureOfflineMutationDefinitionsRegistered } from "@/modules/shared/offline-mutations";
import { OfflineQueueToastListener } from "@/components/offline/offline-queue-toast-listener";

export function OfflineRuntime() {
  const queryClient = useQueryClient();
  const { isOnline } = useOfflineStatus();

  React.useEffect(() => {
    ensureOfflineMutationDefinitionsRegistered();
  }, []);

  React.useEffect(() => {
    installAxiosOfflineInterceptor();
    installFetchOfflineInterceptor();
    return () => {
      uninstallAxiosOfflineInterceptor();
      uninstallFetchOfflineInterceptor();
    };
  }, []);

  React.useEffect(() => {
    if (!isOnline) {
      return;
    }
    void processOfflineMutationQueue(queryClient);
  }, [isOnline, queryClient]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "hidden") return;
      void processOfflineMutationQueue(queryClient);
    };

    const handleOnline = () => {
      void processOfflineMutationQueue(queryClient);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    const initialHandle = window.setTimeout(handleVisibilityOrFocus, 500);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.clearTimeout(initialHandle);
    };
  }, [queryClient]);

  return (
    <>
      <OfflineQueueToastListener />
    </>
  );
}
