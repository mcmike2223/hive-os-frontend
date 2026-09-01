// app/(auth)/sign-in/2fa/TwoFactorClient.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  Terminal,
  Activity,
  ScanLine,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useTranslation } from "@/store/use-translation";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { logFrontendAction } from "@/lib/api";
import { clearHiveSession } from "@/lib/auth-sync";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import {
  getBackendApiRoot,
  getPublicServeUrl,
  getTenantHeaders,
  getTenantId,
  getWorkspaceScopeKey,
  isTenantHost,
  persistHiveContext,
} from "@/lib/runtime-context";
import { initializeSessionActivity } from "@/lib/session-activity";

const POST_LOGIN_REDIRECT_STORAGE_KEY = "hive_post_login_redirect";

const resolveStoredPostLoginRedirect = () => {
  if (typeof window === "undefined") {
    return "/dashboard";
  }

  const redirect = sessionStorage.getItem(POST_LOGIN_REDIRECT_STORAGE_KEY)?.trim();

  if (
    !redirect ||
    !redirect.startsWith("/") ||
    redirect.startsWith("//") ||
    redirect.includes("\\")
  ) {
    return "/dashboard";
  }

  return redirect;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

export default function TwoFactorClient() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [portalName, setPortalName] = useState(t("auth.login.central_portal", "HIVE.OS CENTRAL"));
  const [isTenant, setIsTenant] = useState(false);

  // 🚀 FORCED SETUP STATE
  const [setupQr, setSetupQr] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);

  const viewLogged = useRef(false);
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
  const authBackgroundUrl = getPublicServeUrl(brandSettings?.auth_background_image);
  const displayPortalName = brandSettings?.app_title || portalName;
  const activeLogoPath =
    resolvedTheme === "dark"
      ? brandSettings?.logo_dark || brandSettings?.logo_light
      : brandSettings?.logo_light || brandSettings?.logo_dark;
  const activeLogoUrl = getPublicServeUrl(activeLogoPath);

  useEffect(() => {
    const email = sessionStorage.getItem("hive_pending_email");
    if (!email && !sessionStorage.getItem("hive_2fa_token")) {
      router.push("/sign-in");
      return;
    }

    if (!viewLogged.current) {
      viewLogged.current = true;
      logFrontendAction({
        module: "Auth - 2FA",
        action: "viewed",
        description: "2FA checkpoint accessed.",
      }).catch(() => {});
    }

    const host = window.location.hostname;
    if (isTenantHost(host)) {
      const tenantLabel = (getTenantId() || host).toUpperCase();
      setPortalName(`${tenantLabel} ${t("auth.login.node_label", "NODE")}`);
      setIsTenant(true);
    }

    // Check if we arrived here because the server requires 2FA Setup
    const qr = sessionStorage.getItem("hive_2fa_setup_qr");
    const secret = sessionStorage.getItem("hive_2fa_setup_secret");
    if (qr && secret) {
      setSetupQr(qr);
      setSetupSecret(secret);
    }
  }, [router, t]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;

    setLoading(true);
    setError("");

    const host = window.location.hostname;
    const isSetup = Boolean(setupQr);
    let endpoint = isSetup ? "/2fa/confirm-setup" : "/2fa/verify";
    if (isTenantHost(host)) {
      endpoint = `/tenant${endpoint}`;
    }

    const apiUrl = `${getBackendApiRoot()}${endpoint}`;

    try {
      const pendingToken = sessionStorage.getItem("hive_2fa_token") || "";
      const pendingEmail = sessionStorage.getItem("hive_pending_email") || "";

      const payload = {
        code: code.trim(),
        two_factor_token: pendingToken,
        temp_token: pendingToken,
        email: pendingEmail,
      };

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getTenantHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || (!data.success && !data?.data?.token)) {
        throw new Error(data.message || t("auth.2fa.invalid_code", "Invalid authentication code."));
      }

      sessionStorage.removeItem("hive_2fa_token");
      sessionStorage.removeItem("hive_pending_email");
      sessionStorage.removeItem("hive_2fa_setup_qr");
      sessionStorage.removeItem("hive_2fa_setup_secret");

      clearHiveSession();
      localStorage.removeItem("hive_original_token");
      localStorage.setItem("hive_token", data.data.token);
      localStorage.setItem("hive_user", JSON.stringify(data.data.user));
      persistHiveContext(
        data.data.context,
        data.data.context_signature ?? null
      );
      initializeSessionActivity();
      sessionStorage.removeItem("hive_eject_reason");

      await logFrontendAction({
        module: "Auth - 2FA",
        action: "login_success",
        description: `2FA verification passed.`,
      }).catch(() => {});
      const redirectPath = resolveStoredPostLoginRedirect();
      sessionStorage.removeItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
      window.location.href = redirectPath;
    } catch (err: unknown) {
      const message = getErrorMessage(err, t("auth.2fa.invalid_code", "Invalid authentication code."));
      logFrontendAction({
        module: "Auth - 2FA",
        action: "login_failed",
        description: `2FA verification failed: ${message}`,
      }).catch(() => {});
      setError(message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = () => {
    logFrontendAction({
      module: "Auth - 2FA",
      action: "aborted",
      description: "Operator manually aborted the 2FA handshake.",
    }).catch(() => {});
    sessionStorage.clear();
    router.push("/sign-in");
  };

  let validationStatus = "neutral";
  let validationMessage = "AWAITING 6-DIGIT CODE";
  let ValidationIcon = Activity;

  if (error) {
    validationStatus = "error";
    validationMessage = error.toUpperCase();
    ValidationIcon = AlertCircle;
  } else if (code.length === 0) {
    validationStatus = "neutral";
    validationMessage = t("auth.2fa.awaiting_input", "AWAITING 6-DIGIT CODE");
    ValidationIcon = Activity;
  } else if (code.length < 6) {
    validationStatus = "warning";
    validationMessage = `ENTERED ${code.length}/6 DIGITS`;
    ValidationIcon = Activity;
  } else if (code.length === 6) {
    validationStatus = "success";
    validationMessage = "CODE ENTERED - READY TO VERIFY";
    ValidationIcon = ShieldCheck;
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background text-foreground overflow-hidden relative selection:bg-primary/30">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="absolute top-6 right-6 z-50 flex items-center gap-3 bg-background/50 backdrop-blur-md p-1.5 rounded-full border border-border/50 shadow-xl">
        <LanguageSwitcher />
        <div className="w-px h-4 bg-border mx-1" />
        <ThemeToggle />
      </div>

      <div className="relative flex flex-col justify-center px-8 sm:px-20 py-12 z-10">
        <div className="absolute top-8 left-8 sm:left-20 flex items-center gap-4">
          <button
            onClick={handleAbort}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft className="h-4 w-4" /> {t("auth.2fa.abort_btn", "Abort Auth")}
          </button>
        </div>

        <div className="w-full max-w-sm mx-auto space-y-8 mt-12 lg:mt-0">
          {activeLogoUrl && (
            <div className="mb-2">
              <img
                src={activeLogoUrl}
                alt={`${displayPortalName} logo`}
                className="h-auto max-h-16 w-auto max-w-[240px] object-contain"
              />
            </div>
          )}

          <div className="space-y-3">
            <Badge
              variant="outline"
              className="font-mono text-[11px] tracking-widest border-amber-500/30 text-amber-500 bg-amber-500/5 px-3"
            >
              {setupQr
                ? t("auth.2fa.badge_enforced", "SYSTEM ENFORCED PROTOCOL")
                : t("auth.2fa.badge_required", "SECURITY CLEARANCE REQUIRED")}
            </Badge>
            <h1 className="text-4xl font-space font-black tracking-tighter sm:text-5xl">
              {t("auth.2fa.title", "Verify Identity")}
            </h1>
            <p className="text-muted-foreground font-inter text-sm">
              {setupQr
                ? t("auth.2fa.enforced_desc", "The system administrator has enforced Global 2FA. You must configure your authenticator app to proceed.")
                : t("auth.2fa.description", "Open your authenticator app and enter the 6-digit cryptographic code.")}
            </p>
          </div>

          {/* FORCED SETUP UI RENDERS HERE IF NEEDED */}
          {setupQr && (
            <div className="bg-muted/30 border border-border/50 p-6 rounded-2xl flex flex-col items-center text-center animate-in zoom-in duration-500">
              <div className="bg-white p-3 rounded-xl shadow-md border border-gray-100 mb-4">
                <QRCodeSVG
                  value={setupQr}
                  size={130}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                {t("auth.2fa.manual_secret", "Manual Secret Key")}
              </Label>
              <span className="text-xs font-mono bg-background px-3 py-1.5 rounded-md tracking-wider border border-border/50 shadow-sm text-foreground">
                {setupSecret}
              </span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-3">
              <div className="grid gap-2 text-center relative">
                <Label
                  htmlFor="code"
                  className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1"
                >
                  {t("auth.2fa.protocol_label", "Authentication Protocol")}
                </Label>
                <Input
                  id="code"
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    if (error) setError("");
                  }}
                  placeholder="000 000"
                  disabled={loading}
                  className={cn(
                    "h-16 text-3xl tracking-[0.5em] text-center bg-muted/30 border-border focus:ring-2 transition-all font-mono shadow-inner rounded-2xl",
                    validationStatus === "error"
                      ? "border-destructive focus:ring-destructive/50 text-destructive"
                      : "focus:ring-primary/50"
                  )}
                />
                <div
                  className={cn(
                    "flex items-center justify-center gap-1.5 mt-2 font-mono text-[11px] uppercase tracking-widest transition-colors duration-300",
                    validationStatus === "neutral" && "text-muted-foreground",
                    validationStatus === "warning" && "text-amber-500",
                    validationStatus === "success" && "text-emerald-500",
                    validationStatus === "error" && "text-destructive"
                  )}
                >
                  <ValidationIcon className="h-3.5 w-3.5" />
                  {validationMessage}
                </div>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-primary text-primary-foreground font-space font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 transition-all h-14 group rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                  {t("auth.2fa.decrypting", "DECRYPTING...")}
                </>
              ) : (
                <span className="flex items-center gap-2">
                  {setupQr ? t("auth.2fa.bind_btn", "Bind Authenticator") : t("auth.2fa.confirm_btn", "Confirm Access")}{" "}
                  <ShieldAlert className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>

      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-muted/5 border-l border-border overflow-hidden">
        {authBackgroundUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${authBackgroundUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/75 to-background/95" />
        <div className="tech-grid absolute inset-0 z-0 opacity-30" />
        <div className="relative z-10 m-auto w-full max-w-sm">
          <div className="absolute inset-[-40px] bg-amber-500/10 blur-[100px] rounded-full animate-pulse" />
          <div className="relative bg-card/40 backdrop-blur-xl border border-amber-500/20 p-1 rounded-3xl shadow-2xl overflow-hidden group">
            <div className="bg-background/80 rounded-[22px] p-8 border border-border/50 flex flex-col items-center text-center">
              {activeLogoUrl ? (
                <div className="relative mb-6">
                  <img
                    src={activeLogoUrl}
                    alt={`${displayPortalName} logo`}
                    className="h-16 w-auto max-w-[200px] object-contain"
                  />
                </div>
              ) : (
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                  <div className="relative w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-inner">
                    {setupQr ? (
                      <ScanLine className="w-10 h-10 text-amber-500 animate-pulse" />
                    ) : (
                      <ShieldAlert className="w-10 h-10 text-amber-500 animate-pulse" />
                    )}
                  </div>
                </div>
              )}
              <h3 className="font-space font-bold text-xl tracking-tight mb-2 uppercase">
                {isTenant ? t("auth.2fa.tenant_gateway", "Tenant Node Gateway") : t("auth.2fa.master_gateway", "Master Cluster Gateway")}
              </h3>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                {displayPortalName}
              </p>
              <div className="flex items-center justify-center gap-2 text-amber-500/70 font-mono text-[11px] uppercase tracking-widest mb-6 border border-amber-500/20 bg-amber-500/5 px-3 py-1 rounded-full">
                <Terminal className="h-3 w-3" />{" "}
                {setupQr ? t("auth.2fa.enforcing_protocol", "Enforcing Protocol") : t("auth.2fa.awaiting_input", "Awaiting Input")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
