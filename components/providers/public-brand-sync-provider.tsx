"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBackendApiRoot, getBackendStorageUrl, getTenantHeaders, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { applyBrandRuntime } from "@/lib/brand-theme";
import { formatDocumentTitle } from "@/lib/document-title";

export function PublicBrandSyncProvider() {
  const workspaceScope = getWorkspaceScopeKey();

  const { data: brandData } = useQuery({
    queryKey: ["publicBrandSettings", workspaceScope],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/settings/brand/public`, {
        headers: {
          Accept: "application/json",
          ...getTenantHeaders(),
        },
      });

      if (!res.ok) throw new Error("Failed to fetch public brand settings");
      return res.json();
    },
    staleTime: 600000,
    retry: 1,
  });

  const brandSettings = brandData?.data;

  useEffect(() => {
    if (!brandSettings) return;

    applyBrandRuntime(brandSettings);

    if (brandSettings?.favicon) {
      const favUrl = getBackendStorageUrl(brandSettings.favicon);
      if (favUrl) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = favUrl;
      }
    }

    if (brandSettings?.app_title && !window.location.pathname.startsWith("/dashboard")) {
      document.title = formatDocumentTitle(brandSettings.app_title);
    }
  }, [brandSettings]);

  return null;
}
