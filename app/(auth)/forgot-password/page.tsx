"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  Cpu,
  Terminal,
  Activity,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useTranslation } from "@/store/use-translation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import {
  getBackendApiRoot,
  getPublicServeUrl,
  getTenantHeaders,
  getTenantId,
  getWorkspaceScopeKey,
  isTenantHost,
} from "@/lib/runtime-context";

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

export default function ForgotPasswordPage() {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [portalName, setPortalName] = useState(t("auth.login.central_portal", "HIVE.OS CENTRAL"));
  const [isTenant, setIsTenant] = useState(false);

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
    const host = window.location.hostname;
    if (isTenantHost(host)) {
      const tenantLabel = (getTenantId() || host).toUpperCase();
      setPortalName(`${tenantLabel} ${t("auth.login.node_label", "NODE")}`);
      setIsTenant(true);
    }
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const host = window.location.hostname;
    const endpoint = isTenantHost(host)
      ? "/tenant/forgot-password"
      : "/forgot-password";
    const apiUrl = `${getBackendApiRoot()}${endpoint}`;

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getTenantHeaders(),
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.errors?.email?.[0] ||
          data?.message ||
          "Unable to process password reset request"
        );
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const message = getErrorMessage(
        err,
        "Failed to send reset link. Please verify your connection."
      );
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background text-foreground overflow-hidden relative selection:bg-primary/30">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3 bg-background/50 backdrop-blur-md p-1.5 rounded-full border border-border/50 shadow-xl">
        <LanguageSwitcher />
        <div className="w-px h-4 bg-border mx-1" />
        <ThemeToggle />
      </div>

      <div className="relative flex flex-col justify-center px-8 sm:px-20 py-12 z-10">
        <Link
          href="/sign-in"
          aria-label={`${displayPortalName} sign in`}
          className="absolute top-8 left-8 sm:left-20 flex max-w-[calc(100vw-8rem)] items-center font-space text-2xl font-bold tracking-tight group"
        >
          {activeLogoUrl ? (
            <img
              src={activeLogoUrl}
              alt={`${displayPortalName} logo`}
              className="h-auto max-h-24 w-auto max-w-[min(320px,calc(100vw-8rem))] object-contain"
            />
          ) : (
            <span className="flex items-center gap-3">
              <span className="relative">
                <Globe
                  aria-hidden="true"
                  className="text-primary h-7 w-7 transition-transform duration-700 group-hover:rotate-180"
                />
                <span className="absolute inset-0 bg-primary blur-lg opacity-20 group-hover:opacity-50 transition-opacity" />
              </span>
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent uppercase tracking-tighter">
                {displayPortalName}
              </span>
            </span>
          )}
        </Link>

        <div className="w-full max-w-sm mx-auto space-y-8 mt-12 lg:mt-0">
          <div className="space-y-3">
            <Badge
              variant="outline"
              className="font-mono text-[11px] tracking-widest border-primary/30 text-primary bg-primary/5 px-3"
            >
              {t("auth.forgot.badge", "RECOVERY PROTOCOL")}
            </Badge>
            <h1 className="text-4xl font-space font-black tracking-tighter sm:text-5xl">
              {t("auth.forgot.title", "Recover")}{" "}
              <span className="text-primary">
                {t("auth.forgot.access", "Access")}
              </span>
            </h1>
            <p className="text-muted-foreground font-inter text-sm max-w-[320px]">
              {t(
                "auth.forgot.description",
                "Enter your system identifier and we will send a secure link to reset your encryption key."
              )}
            </p>
          </div>

          {error && (
            <Alert
              variant="destructive"
              className="bg-destructive/5 border-destructive/20 text-destructive animate-in slide-in-from-top-4 duration-500"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {submitted ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 flex items-start gap-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    {t("auth.forgot.sent_title", "Recovery link dispatched")}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                    {t(
                      "auth.forgot.sent_description",
                      "If an account exists for that identifier, check your inbox for a secure recovery link. The link expires in 60 minutes."
                    )}
                  </p>
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                className="w-full h-12 font-mono text-xs uppercase tracking-widest"
              >
                <Link href="/sign-in">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("auth.forgot.back_to_sign_in", "Back to Sign In")}
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-2">
                <Label
                  htmlFor="email"
                  className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground ml-1"
                >
                  {t("auth.login.system_identifier", "System Identifier")}
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(
                      "auth.login.identifier_placeholder",
                      "user@hive.corp"
                    )}
                    disabled={loading}
                    className="pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50 transition-all font-mono text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-primary text-primary-foreground font-space font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all h-14 group"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                    {t("auth.forgot.sending", "TRANSMITTING...")}
                  </>
                ) : (
                  <span className="flex items-center gap-2">
                    {t("auth.forgot.send_link", "Send Recovery Link")}
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>

              <Button
                asChild
                variant="ghost"
                className="w-full font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                <Link href="/sign-in">
                  <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                  {t("auth.forgot.back_to_sign_in", "Back to Sign In")}
                </Link>
              </Button>
            </form>
          )}
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
        <div className="relative z-10 flex items-center justify-between font-mono text-[11px] text-muted-foreground uppercase tracking-[0.3em] opacity-60">
        </div>
        <div className="relative z-10 m-auto w-full max-w-sm">
          <div className="absolute inset-[-40px] bg-primary/10 blur-[100px] rounded-full animate-pulse" />
          <div className="relative bg-card/40 backdrop-blur-xl border border-primary/20 p-1 rounded-3xl shadow-2xl overflow-hidden group">
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
                  <div className="absolute inset-0 bg-primary blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                  <div className="relative w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
                    <KeyRound className="w-10 h-10 text-primary animate-pulse" />
                  </div>
                </div>
              )}
              <h3 className="font-space font-bold text-xl tracking-tight mb-2 uppercase">
                {isTenant ? "Tenant Recovery Channel" : "Master Recovery Channel"}
              </h3>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed mb-4">
                {displayPortalName}
              </p>
              <div className="flex items-center gap-4 text-muted-foreground font-mono text-[11px] uppercase tracking-widest mb-6">
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-3 w-3" /> ARMv8
                </span>
                <div className="w-1 h-1 bg-border rounded-full" />
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3 w-3" /> TLS 1.3
                </span>
              </div>
              <div className="w-full bg-muted/30 rounded-xl p-3 border border-border/50 text-xs text-muted-foreground font-mono">
                Recovery links are single-use and expire after 60 minutes for your security.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
