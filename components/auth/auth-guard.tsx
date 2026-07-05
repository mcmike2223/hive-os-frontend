"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSystemSettings } from "@/components/providers/settings-provider";
import { handleAuthFailureResponse } from "@/lib/auth-sync";
import { canAccessDashboardPath } from "@/lib/dashboard-access";
import {
  getAccessToken,
  getBackendApiRoot,
  getTenantHeaders,
  isTenantSession,
} from "@/lib/runtime-context";
import { FullScreenPlaceholder } from "@/components/ui/loading-states";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading: settingsLoading } = useSystemSettings();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setCheckingAuth(true);

    const validateSession = async () => {
      const token = getAccessToken();

      if (!token) {
        if (!isMounted) return;
        setIsAuthorized(false);

        if (pathname !== "/sign-in") {
          router.replace("/sign-in");
        }

        setCheckingAuth(false);
        return;
      }

      try {
        const endpoint = isTenantSession() ? "/tenant/user" : "/user";

        const response = await fetch(`${getBackendApiRoot()}${endpoint}`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...getTenantHeaders(),
          },
        });

        if (await handleAuthFailureResponse(response)) {
          if (isMounted) {
            setIsAuthorized(false);
            setCheckingAuth(false);
          }
          return;
        }

        if (response.ok) {
          const freshUser = await response.json();
          localStorage.setItem("hive_user", JSON.stringify(freshUser));
          window.dispatchEvent(new Event("hive_security_cleared"));

          if (
            pathname.startsWith("/dashboard") &&
            pathname !== "/dashboard/subscription-required" &&
            !canAccessDashboardPath(pathname, freshUser)
          ) {
            router.replace(
              `/dashboard/subscription-required?from=${encodeURIComponent(pathname)}`,
            );
            if (isMounted) {
              setIsAuthorized(false);
              setCheckingAuth(false);
            }
            return;
          }
        }

        if (!isMounted) return;

        setIsAuthorized(true);
        setCheckingAuth(false);
      } catch {
        if (!isMounted) return;
        setIsAuthorized(true);
        setCheckingAuth(false);
      }
    };

    validateSession();

    return () => {
      isMounted = false;
    };
  }, [router, pathname]);

  if (checkingAuth || settingsLoading) {
    return (
      <FullScreenPlaceholder
        label="Verifying session integrity"
        detail="Checking your token, tenant context, and secure dashboard access."
      />
    );
  }

  if (!isAuthorized) return null;

  return <>{children}</>;
}
