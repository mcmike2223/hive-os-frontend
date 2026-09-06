"use client";

import { useEffect, useState } from "react";
import {
  initEcho,
  subscribeToRealtimeStatus,
  type RealtimeConnectionStatus,
} from "@/lib/echo";
import { getAccessToken } from "@/lib/runtime-context";

export function useRealtimeStatus(): RealtimeConnectionStatus {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("connecting");

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | undefined;
    let unsubscribe: () => void = () => undefined;

    const connect = () => {
      if (disposed) return;
      window.clearTimeout(retryTimer);
      unsubscribe();

      const token = getAccessToken() || localStorage.getItem("token");
      if (!token) {
        setStatus("unavailable");
        retryTimer = window.setTimeout(connect, 1_000);
        return;
      }

      const echo = initEcho(token);
      if (!echo) {
        setStatus("unavailable");
        retryTimer = window.setTimeout(connect, 2_000);
        return;
      }

      unsubscribe = subscribeToRealtimeStatus(echo, setStatus);
    };

    const reconnectWhenVisible = () => {
      if (document.visibilityState === "visible") connect();
    };

    connect();
    window.addEventListener("online", connect);
    window.addEventListener("storage", connect);
    document.addEventListener("visibilitychange", reconnectWhenVisible);

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      unsubscribe();
      window.removeEventListener("online", connect);
      window.removeEventListener("storage", connect);
      document.removeEventListener("visibilitychange", reconnectWhenVisible);
    };
  }, []);

  return status;
}
