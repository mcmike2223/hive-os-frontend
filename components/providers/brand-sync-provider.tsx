// components/providers/brand-sync-provider.tsx
"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken, getAuthHeaders, getBackendApiRoot, getBackendStorageUrl, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { applyBrandRuntime } from "@/lib/brand-theme";
import { handleAuthFailureResponse } from "@/lib/auth-sync";
import { formatDocumentTitle } from "@/lib/document-title";

export function BrandSyncProvider() {
    const workspaceScope = getWorkspaceScopeKey();

    // 🚀 FETCH PROTECTED BRAND SETTINGS FOR METADATA SYNC
    const { data: brandData } = useQuery({
      queryKey: ['brandSettings', 'protected', workspaceScope],
      queryFn: async () => {
          const token = getAccessToken();
          if (!token) return null;

          const res = await fetch(`${getBackendApiRoot()}/settings/brand`, {
              headers: getAuthHeaders(),
          });

          if (await handleAuthFailureResponse(res)) {
              return null;
          }
          
          if (!res.ok) throw new Error("Failed to fetch brand settings");
          return res.json();
      },
      staleTime: 600000 // Cache for 10 minutes to prevent spamming the backend
    });

    const brandSettings = brandData?.data;

    // 🌍 BROWSER METADATA SYNC (Favicon & Title)
    useEffect(() => {
      if (brandSettings) {
          applyBrandRuntime(brandSettings);
      }

      // Safely apply Favicon
      if (brandSettings?.favicon) {
        const favUrl = getBackendStorageUrl(brandSettings.favicon);
        if (favUrl) {
            let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = favUrl;
        }
      }
      
      // Safely apply Document Title
      if (brandSettings?.app_title) {
          // This ensures it overrides the default metadata title set in layout.tsx
          document.title = formatDocumentTitle("Dashboard", brandSettings.app_title);
      }
    }, [brandSettings]);

    return null; // This component doesn't render any UI, it just manages the DOM!
}
