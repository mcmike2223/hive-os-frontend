"use client";

/**
 * Shared "this template carries its own page code" escape hatch.
 *
 * A landing template can either be `structured` — content JSON rendered by one
 * of the bespoke React components — or `custom_code`/`raw_package`, where the
 * template owns real HTML/CSS/JS. Only TenantBusinessLanding used to honour
 * that distinction, so an imported or ejected template assigned to a
 * restaurant, LMS or B2B tenant silently kept rendering the React design and
 * ignored its own code.
 *
 * Every landing component now calls useCustomLandingHtml() and returns
 * <CustomLandingFrame> when it yields markup, so `rendering.mode` means the
 * same thing everywhere.
 */

import * as React from "react";

import {
  buildTenantLandingPreviewHtml,
  type TenantLandingTemplate,
} from "@/modules/tenancy/landing-template";

type BrandSettings = Record<string, unknown> | null | undefined;

export const useCustomLandingHtml = (
  template: TenantLandingTemplate | null | undefined,
  brandName: string,
  businessLabel: string,
  isDark: boolean,
  brandSettings?: BrandSettings,
): string | null =>
  React.useMemo(() => {
    const mode = template?.rendering?.mode;

    if (
      !template ||
      (mode !== "custom_code" && mode !== "raw_package") ||
      !template.rendering.html?.trim()
    ) {
      return null;
    }

    return buildTenantLandingPreviewHtml(template, brandName, businessLabel, {
      colorMode: isDark ? "dark" : "light",
      branding: brandSettings as never,
    });
  }, [template, brandName, businessLabel, isDark, brandSettings]);

export function CustomLandingFrame({
  html,
  title,
  mode,
}: {
  html: string;
  title: string;
  mode: TenantLandingTemplate["rendering"]["mode"];
}) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      className="block h-screen min-h-screen w-full border-0"
      // Only full packages get to run their own scripts; hand-authored
      // custom_code stays script-less.
      sandbox={
        mode === "raw_package"
          ? "allow-scripts allow-popups allow-top-navigation-by-user-activation"
          : "allow-popups allow-top-navigation-by-user-activation"
      }
    />
  );
}
