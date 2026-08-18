"use client";

import * as React from "react";
import { TrialBanner } from "@/modules/subscription/components/trial-banner";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { useQuery } from "@tanstack/react-query";
import { fetchCurrentTenantSubscriptions } from "@/modules/subscription/api";
import { isTenantSession } from "@/lib/runtime-context";

export function TrialBannerWrapper() {
  const { moduleAccess } = useTenantModuleAccess();
  const plan = moduleAccess?.plan;
  const isTenant = isTenantSession();
  
  const { data } = useQuery({
    queryKey: ["tenant-current-subscriptions"],
    queryFn: fetchCurrentTenantSubscriptions,
    enabled: isTenant,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const subscription = data?.data?.subscription;
  const daysUntilExpiration = subscription?.days_until_expiration ?? null;
  const isExpiringSoon = subscription?.is_expiring_soon ?? false;
  const needsRenewal = subscription?.needs_renewal ?? false;

  const handleUpgrade = () => {
    // Navigate to subscriptions page
    window.location.href = "/dashboard/subscriptions";
  };

  if (plan?.toLowerCase() !== "larva" && plan?.toLowerCase() !== "startup") {
    return null;
  }

  return (
    <TrialBanner
      plan={plan}
      daysUntilExpiration={daysUntilExpiration}
      isExpiringSoon={isExpiringSoon}
      needsRenewal={needsRenewal}
      onUpgrade={handleUpgrade}
    />
  );
}
