import { getAccessToken, getBackendApiRoot, getTenantHeaders, isTenantSession } from "./runtime-context";
import { clearSessionActivity } from "./session-activity";
import { clearOfflineState } from "@/lib/offline/storage";

export const isImpersonatingSession = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("hive_original_token"));
};

export const startImpersonationSession = (impersonationData: {
  token: string;
  user?: any;
  context?: string | null;
  context_signature?: string | null;
}) => {
  if (typeof window === "undefined") return;

  const currentToken = localStorage.getItem("hive_token");
  const currentUser = localStorage.getItem("hive_user");
  const currentContext = localStorage.getItem("hive_context");
  const currentSignature = localStorage.getItem("hive_context_signature");

  // Save the original super admin session only once (prevent nested overwriting)
  if (currentToken && !localStorage.getItem("hive_original_token")) {
    localStorage.setItem("hive_original_token", currentToken);
    if (currentUser) localStorage.setItem("hive_original_user", currentUser);
    if (currentContext) localStorage.setItem("hive_original_context", currentContext);
    if (currentSignature) localStorage.setItem("hive_original_context_signature", currentSignature);
  }

  localStorage.setItem("hive_token", impersonationData.token);
  if (impersonationData.user) {
    localStorage.setItem("hive_user", JSON.stringify(impersonationData.user));
  } else {
    localStorage.removeItem("hive_user");
  }

  if (impersonationData.context && impersonationData.context !== "central") {
    localStorage.setItem("hive_context", impersonationData.context);
  } else {
    localStorage.removeItem("hive_context");
  }

  if (impersonationData.context_signature && impersonationData.context !== "central") {
    localStorage.setItem("hive_context_signature", impersonationData.context_signature);
  } else {
    localStorage.removeItem("hive_context_signature");
  }

  clearOfflineState();

  window.dispatchEvent(new Event("hive_session_changed"));
  window.dispatchEvent(new Event("hive_security_cleared"));
};

export const stopImpersonation = async (targetRedirectUrl = "/dashboard") => {
  if (typeof window === "undefined") return;

  const originalToken = localStorage.getItem("hive_original_token");
  const originalUser = localStorage.getItem("hive_original_user");
  const originalContext = localStorage.getItem("hive_original_context");
  const originalSignature = localStorage.getItem("hive_original_context_signature");

  if (originalToken) {
    localStorage.setItem("hive_token", originalToken);

    if (originalUser) {
      localStorage.setItem("hive_user", originalUser);
    } else {
      localStorage.removeItem("hive_user");
    }

    if (originalContext && originalContext !== "central") {
      localStorage.setItem("hive_context", originalContext);
    } else {
      localStorage.removeItem("hive_context");
    }

    if (originalSignature && originalContext !== "central") {
      localStorage.setItem("hive_context_signature", originalSignature);
    } else {
      localStorage.removeItem("hive_context_signature");
    }

    localStorage.removeItem("hive_original_token");
    localStorage.removeItem("hive_original_user");
    localStorage.removeItem("hive_original_context");
    localStorage.removeItem("hive_original_context_signature");

    clearOfflineState();

    // Fetch fresh Super Admin profile before redirecting to guarantee complete state restoration
    try {
      const baseUrl = getBackendApiRoot();
      const endpoint = originalContext && originalContext !== "central" ? "/tenant/user" : "/user";
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${originalToken}`,
      };
      if (originalContext && originalContext !== "central") {
        headers["X-Tenant-ID"] = originalContext;
      }
      const res = await fetch(`${baseUrl}${endpoint}?t=${Date.now()}`, { headers });
      if (res.ok) {
        const freshSuperAdmin = await res.json();
        if (freshSuperAdmin) {
          localStorage.setItem("hive_user", JSON.stringify(freshSuperAdmin));
        }
      }
    } catch (e) {
      console.warn("Could not pre-fetch super admin user on stop impersonation", e);
    }

    window.dispatchEvent(new Event("hive_session_changed"));
    window.dispatchEvent(new Event("hive_security_cleared"));

    window.location.href = targetRedirectUrl;
  }
};

export const clearHiveSession = (ejectReason?: string) => {
  if (typeof window === "undefined") return;

  clearOfflineState();
  localStorage.removeItem("hive_token");
  localStorage.removeItem("hive_user");
  localStorage.removeItem("hive_context");
  localStorage.removeItem("hive_context_signature");
  localStorage.removeItem("hive_original_token");
  localStorage.removeItem("hive_original_user");
  localStorage.removeItem("hive_original_context");
  localStorage.removeItem("hive_original_context_signature");
  clearSessionActivity();
  window.dispatchEvent(new Event("hive_session_cleared"));
  window.dispatchEvent(new Event("hive_session_changed"));

  if (ejectReason) {
    sessionStorage.setItem("hive_eject_reason", ejectReason);
  }
};

export const notifySessionChanged = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("hive_session_changed"));
};

export const handleAuthFailureResponse = async (response: Response): Promise<boolean> => {
  const isUnauthorized = response.status === 401;

  let payload: any = null;

  try {
    payload = await response.clone().json();
  } catch {}

  const message = String(payload?.message || "");
  const code = String(payload?.code || "");
  const isEjected = response.status === 403 && message.includes("CRITICAL:");
  const isTenantContextInvalid = code === "TENANT_CONTEXT_INVALID";
  const isTenantNotFound = response.status === 404 && code === "TENANT_NOT_FOUND" && isTenantSession();

  if (!isUnauthorized && !isEjected && !isTenantContextInvalid && !isTenantNotFound) {
    return false;
  }

  const ejectReason = isEjected
    ? message.replace("CRITICAL: ", "")
    : code === "SESSION_EXPIRED"
      || code === "TENANT_CONTEXT_INVALID"
      || code === "TENANT_CONTEXT_SIGNATURE_INVALID"
      ? message
      : undefined;

  clearHiveSession(ejectReason);

  if (typeof window !== "undefined" && !window.location.pathname.includes("/sign-in")) {
    window.location.replace("/sign-in");
  }

  return true;
};

export const syncUserSession = async () => {
  try {
    if (typeof window === "undefined") return;

    const token = getAccessToken();
    if (!token) return;

    const endpoint = isTenantSession() ? "/tenant/user" : "/user";

    const response = await fetch(
      `${getBackendApiRoot()}${endpoint}?t=${Date.now()}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...getTenantHeaders(),
        },
      }
    );

    if (await handleAuthFailureResponse(response)) {
      return;
    }

    if (!response.ok) {
      return;
    }

    const freshUserData = await response.json();
    const localUserStr = localStorage.getItem("hive_user");

    if (freshUserData) {
      const localUser = localUserStr ? JSON.parse(localUserStr) : {};

      const updatedUser = {
        ...localUser,
        ...freshUserData,
        roles: freshUserData.roles || localUser.roles,
        permissions: freshUserData.permissions || localUser.permissions,
        module_access: freshUserData.module_access || localUser.module_access,
      };

      // 🚀 Save the fresh data and ALWAYS dispatch the event
      localStorage.setItem("hive_user", JSON.stringify(updatedUser));
      window.dispatchEvent(new Event("hive_security_cleared"));
    }
  } catch (error) {
    console.error("Failed to sync security session with Hive Control", error);
  }
};
