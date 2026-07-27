"use client";

import { useEffect, useState } from "react";
import {
  getAccessToken,
  getAuthHeaders,
  getBackendApiRoot,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";

function getFallback(name?: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name ?? "Operator")}&color=7F9CF5&background=EBF4FF`;
}

export function useAvatarUrl(
  user: { avatar_path?: string | null; name?: string } | null,
  refreshTrigger: number | string = 0,
) {
  const [avatarSrc, setAvatarSrc] = useState("");
  const scopeKey = getWorkspaceScopeKey();

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const load = async () => {
      if (!user?.avatar_path || !getAccessToken()) {
        if (active) setAvatarSrc(getFallback(user?.name));
        return;
      }

      try {
        const response = await fetch(
          `${getBackendApiRoot()}/profile/avatar?cb=${encodeURIComponent(String(refreshTrigger))}`,
          { headers: getAuthHeaders() },
        );

        if (!response.ok) {
          throw new Error(`Avatar request failed with ${response.status}.`);
        }

        const blob = await response.blob();
        if (!blob.type.startsWith("image/") || blob.size === 0) {
          throw new Error("Avatar response was not an image.");
        }

        objectUrl = URL.createObjectURL(blob);
        if (active) setAvatarSrc(objectUrl);
      } catch {
        if (active) setAvatarSrc(getFallback(user?.name));
      }
    };

    void load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [scopeKey, user?.avatar_path, user?.name, refreshTrigger]);

  return avatarSrc;
}
