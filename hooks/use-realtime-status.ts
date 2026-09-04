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
    const token = getAccessToken() || localStorage.getItem("token");

    if (!token) {
      setStatus("unavailable");
      return;
    }

    const echo = initEcho(token);
    if (!echo) {
      setStatus("unavailable");
      return;
    }

    return subscribeToRealtimeStatus(echo, setStatus);
  }, []);

  return status;
}
