"use client";

import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  getBackendApiRoot,
  getPublicServeUrl,
  getTenantHeaders,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";

type CommunicationBrandSettings = {
  app_title?: string | null;
  logo_light?: string | null;
  logo_dark?: string | null;
  sidebar_icon?: string | null;
};

type CommunicationBrandResponse = {
  data?: CommunicationBrandSettings | null;
};

export function useCommunicationBrand() {
  const workspaceScope = getWorkspaceScopeKey();
  const { resolvedTheme } = useTheme();

  const { data } = useQuery<CommunicationBrandResponse | null>({
    queryKey: ["publicBrandSettings", workspaceScope],
    queryFn: async () => {
      const response = await fetch(`${getBackendApiRoot()}/settings/brand/public`, {
        headers: {
          Accept: "application/json",
          ...getTenantHeaders(),
        },
      });

      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 600000,
    retry: 1,
  });

  const settings = data?.data;
  const isDark = resolvedTheme === "dark";
  const logoPath = isDark
    ? settings?.logo_dark || settings?.logo_light
    : settings?.logo_light || settings?.logo_dark;

  return {
    appTitle: settings?.app_title?.trim() || "HIVE.OS",
    logoUrl: getPublicServeUrl(logoPath),
    iconUrl: getPublicServeUrl(settings?.sidebar_icon || logoPath),
  };
}
