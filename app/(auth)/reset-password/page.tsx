"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Globe,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Circle,
  Activity,
  Cpu,
  Terminal,
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
import { cn } from "@/lib/utils";

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special: boolean;
}

function ResetPasswordForm({ isTenant }: { isTenant: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const workspaceScope = getWorkspaceScopeKey();

  const { data: policyData } = useQuery({
    queryKey: ["passwordPolicy", workspaceScope],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/auth/password-policy`, {
        headers: {
          Accept: "application/json",
          ...getTenantHeaders(),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch password policy");
      return res.json();
    },
    staleTime: 300000,
    retry: 1,
  });

  const policy: PasswordPolicy | null = policyData?.data || {
    min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special: true,
  };

  const rules = useMemo(() => {
    if (!policy) return [];
    return [
      {
        key: "length",
        label: `At least ${policy.min_length || 8} characters`,
        met: password.length >= (policy.min_length || 8),
      },
      {
        key: "uppercase",
        label: "At least one uppercase character (A-Z)",
        met: !policy.require_uppercase || /[A-Z]/.test(password),
      },
      {
        key: "lowercase",
        label: "At least one lowercase character (a-z)",
        met: !policy.require_lowercase || /[a-z]/.test(password),
      },
      {
        key: "number",
        label: "At least one numerical digit (0-9)",
        met: !policy.require_numbers || /[0-9]/.test(password),
      },
      {
        key: "special",
        label: "At least one cryptographic symbol (!@#$%...)",
        met: !policy.require_special || /[^A-Za-z0-9]/.test(password),
      },
    ];
  }, [password, policy]);

  const keysMatch =
    password.length > 0 &&
    passwordConfirmation.length > 0 &&
    password === passwordConfirmation;
  const isReadyToSubmit =
    token.length > 0 &&
    email.length > 0 &&
    rules.every((r) => r.met) &&
    keysMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReadyToSubmit) return;

    setLoading(true);
    setError("");

    const host = window.location.hostname;
    const endpoint = isTenantHost(host)
      ? "/tenant/reset-password"
      : "/reset-password";
    const apiUrl = `${getBackendApiRoot()}${endpoint}`;

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getTenantHeaders(),
        },
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.errors?.password?.[0] ||
          data?.message ||
          "Unable to apply encryption key"
        );
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/sign-in");
      }, 2500);
    } catch (err: unknown) {
      const message = getErrorMessage(
        err,
        "Failed to update encryption key. The token may be expired."
      );
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-8 mt-12 lg:mt-0">
      <div className="space-y-3">
        <Badge
          variant="outline"
          className="font-mono text-[11px] tracking-widest border-primary/30 text-primary bg-primary/5 px-3"
        >
          SECURITY CLEARANCE
        </Badge>
        <h1 className="text-4xl font-space font-black tracking-tighter sm:text-5xl">
          Reset <span className="text-primary">Key</span>
        </h1>
        <p className="text-muted-foreground font-inter text-sm max-w-[320px]">
          Establish a new cryptographic key for{" "}
          <span className="font-mono text-foreground font-semibold">
            {email || "your identifier"}
          </span>
          .
        </p>
      </div>

      {(!token || !email) && (
        <Alert
          variant="destructive"
          className="bg-destructive/5 border-destructive/20 text-destructive animate-in slide-in-from-top-4 duration-500"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="font-mono text-xs">
            Invalid or missing security token. Please request a new recovery link.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert
          variant="destructive"
          className="bg-destructive/5 border-destructive/20 text-destructive animate-in slide-in-from-top-4 duration-500"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {success ? (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-base font-bold text-foreground">
              Encryption Key Updated
            </p>
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">
              Your security key has been synchronized across the cluster. Redirecting to Command Access...
            </p>
          </div>
          <Button
            asChild
            className="w-full h-14 bg-primary text-primary-foreground font-space font-bold uppercase tracking-widest shadow-xl shadow-primary/20"
          >
            <Link href="/sign-in">
              Proceed to Sign In <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label
                htmlFor="password"
                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground ml-1"
              >
                New Encryption Key
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={loading || !policy}
                  className="pl-10 pr-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50 transition-all font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {policy ? (
              <div className="bg-background/50 rounded-xl border border-border/50 p-4 space-y-2 animate-in fade-in duration-500">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3 flex justify-between">
                  <span>Encryption Requirements</span>
                  <span className="text-primary/70">SYNCED</span>
                </div>
                <ul className="space-y-2.5">
                  {rules.map((rule, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2.5 text-xs font-mono"
                    >
                      {rule.met ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "transition-colors duration-300",
                          rule.met
                            ? "text-foreground"
                            : "text-muted-foreground/60"
                        )}
                      >
                        {rule.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground uppercase p-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Fetching Network Security Policy...
              </div>
            )}

            <div className="grid gap-2 pt-2">
              <Label
                htmlFor="password_confirmation"
                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground ml-1 flex justify-between"
              >
                <span>Verify Secure Key</span>
                {passwordConfirmation.length > 0 && (
                  <span
                    className={
                      keysMatch ? "text-emerald-500" : "text-destructive"
                    }
                  >
                    {keysMatch ? "[ MATCH ]" : "[ MISMATCH ]"}
                  </span>
                )}
              </Label>
              <div className="relative group">
                <ShieldCheck
                  className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
                    keysMatch
                      ? "text-emerald-500"
                      : "text-muted-foreground group-focus-within:text-primary"
                  )}
                />
                <Input
                  id="password_confirmation"
                  type={showPassword ? "text" : "password"}
                  required
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Re-enter your key"
                  disabled={loading || !policy}
                  className={cn(
                    "pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50 transition-all font-mono text-sm",
                    passwordConfirmation.length > 0 &&
                    (keysMatch
                      ? "border-emerald-500/50 focus:ring-emerald-500/50"
                      : "border-destructive/50 focus:ring-destructive/50")
                  )}
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !isReadyToSubmit}
            className={cn(
              "w-full font-space font-bold uppercase tracking-widest shadow-xl transition-all h-14 group",
              isReadyToSubmit
                ? "bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                : "bg-muted text-muted-foreground shadow-none opacity-80 cursor-not-allowed"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> ENCRYPTING...
              </>
            ) : (
              <span className="flex items-center gap-2">
                {isReadyToSubmit ? "Apply Encryption" : "Awaiting Input"}{" "}
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isReadyToSubmit && "group-hover:translate-x-1"
                  )}
                />
              </span>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const { resolvedTheme } = useTheme();
  const [portalName, setPortalName] = useState("HIVE.OS CENTRAL");
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
      setPortalName(`${tenantLabel} NODE`);
      setIsTenant(true);
    }
  }, []);

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
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center mt-32 space-y-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                Awaiting Transmission...
              </span>
            </div>
          }
        >
          <ResetPasswordForm isTenant={isTenant} />
        </Suspense>
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
                    <ShieldCheck className="w-10 h-10 text-primary animate-pulse" />
                  </div>
                  <div className="absolute -top-2 -right-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full border-4 border-background animate-pulse" />
                  </div>
                </div>
              )}
              <h3 className="font-space font-bold text-xl tracking-tight mb-2 uppercase">
                {isTenant ? "Tenant Node Key Exchange" : "Master Key Exchange"}
              </h3>
              <p className="text-xs text-muted-foreground font-mono mb-4">
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
              <div className="w-full bg-muted/30 rounded-xl p-4 border border-border/50 space-y-2">
                <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 bg-primary w-[30%] shadow-[0_0_10px_hsl(var(--primary))] animate-[pulse_2s_ease-in-out_infinite]" />
                </div>
                <div className="flex justify-between font-mono text-[11px] uppercase tracking-tighter opacity-50">
                  <span>Encryption Status</span>
                  <span className="text-primary">Awaiting Input...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-2 font-mono text-[11px] text-muted-foreground select-none">
          <div className="flex justify-between group cursor-default">
            <span className="group-hover:text-primary transition-colors">
              /root/system/handshake_v3.sh
            </span>
            <span className="text-green-500/50">[EXECUTED]</span>
          </div>
          <div className="flex justify-between group cursor-default">
            <span className="group-hover:text-primary transition-colors">
              /root/network/mtls_check.cert
            </span>
            <span className="text-green-500/50">[VALIDATED]</span>
          </div>
          <div className="flex justify-between group cursor-default">
            <span className="group-hover:text-primary transition-colors">
              /root/auth/key_generation
            </span>
            <span className="text-yellow-500/50 animate-pulse">[PENDING]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
