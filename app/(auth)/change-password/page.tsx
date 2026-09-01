"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import api from "@/modules/shared/api/http";
import {
  getBackendApiRoot,
  getPublicServeUrl,
  getTenantHeaders,
  getWorkspaceScopeKey,
  isTenantHost,
} from "@/lib/runtime-context";

/**
 * Forced password change.
 *
 * Reached when the API answers PASSWORD_CHANGE_REQUIRED, which it does for
 * every route until the user replaces a password somebody else chose. The
 * checklist below is presentation only: the same rules are enforced server
 * side, and a client that skips them gets a 422 rather than a saved password.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);

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
  const activeLogoPath =
    resolvedTheme === "dark"
      ? brandSettings?.logo_dark || brandSettings?.logo_light
      : brandSettings?.logo_light || brandSettings?.logo_dark;
  const activeLogoUrl = getPublicServeUrl(activeLogoPath);

  // Resolved in an effect rather than at render: isTenantHost reads the
  // hostname, which does not exist during server rendering.
  const [endpoint, setEndpoint] = useState("/change-password");
  const [intended, setIntended] = useState("/dashboard");

  useEffect(() => {
    setEndpoint(
      isTenantHost(window.location.hostname)
        ? "/tenant/change-password"
        : "/change-password"
    );
  }, []);

  useEffect(() => {
    // Stashed by the interceptor before it routed here, so a user who deep
    // linked into a report lands back on that report rather than the root.
    const stored = sessionStorage.getItem("hive_password_change_intended");
    if (stored) {
      setIntended(stored);
    }

    // Impersonating admins should not be prompted or allowed to change the
    // impersonated user's password.
    setIsImpersonating(Boolean(localStorage.getItem("hive_original_token")));
  }, []);

  const handleReturnToAdmin = () => {
    const originalToken = localStorage.getItem("hive_original_token");
    if (!originalToken) return;

    localStorage.setItem("hive_token", originalToken);
    const originalContext = localStorage.getItem("hive_original_context");
    const originalSignature = localStorage.getItem(
      "hive_original_context_signature"
    );
    if (originalContext) localStorage.setItem("hive_context", originalContext);
    else localStorage.removeItem("hive_context");
    if (originalSignature)
      localStorage.setItem("hive_context_signature", originalSignature);
    else localStorage.removeItem("hive_context_signature");
    localStorage.removeItem("hive_original_token");
    localStorage.removeItem("hive_original_context");
    localStorage.removeItem("hive_original_context_signature");
    sessionStorage.removeItem("hive_password_change_intended");
    window.dispatchEvent(new Event("hive_session_changed"));
    window.location.href = "/dashboard";
  };

  const rules = useMemo(
    () => [
      { key: "length", label: "At least 8 characters", met: password.length >= 8 },
      {
        key: "upper",
        label: "At least one uppercase letter",
        met: /[A-Z]/.test(password),
      },
      {
        key: "lower",
        label: "At least one lowercase letter",
        met: /[a-z]/.test(password),
      },
      {
        key: "number",
        label: "At least one number",
        met: /[0-9]/.test(password),
      },
      {
        key: "symbol",
        label: "At least one special character",
        met: /[^A-Za-z0-9]/.test(password),
      },
      {
        key: "different",
        label: "Different from your current password",
        met: password.length > 0 && password !== currentPassword,
      },
      {
        key: "match",
        label: "Both entries match",
        met: password.length > 0 && password === passwordConfirmation,
      },
    ],
    [password, passwordConfirmation, currentPassword]
  );

  const isReadyToSubmit =
    currentPassword.length > 0 && rules.every((rule) => rule.met);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!isReadyToSubmit) return;

    setLoading(true);

    try {
      await api.post(endpoint, {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });

      sessionStorage.removeItem("hive_password_change_intended");
      toast.success("Password updated.");
      window.location.href = intended;
    } catch (requestError: any) {
      const response = requestError?.response?.data;
      const firstFieldError = response?.errors
        ? String(Object.values(response.errors)[0])
        : null;

      setError(
        firstFieldError ||
          response?.message ||
          "Could not update the password."
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3 text-center flex flex-col items-center">
          {activeLogoUrl ? (
            <img
              src={activeLogoUrl}
              alt="Brand logo"
              className="h-12 w-auto object-contain mb-2"
            />
          ) : (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-background/60">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
          )}
          <h1 className="text-2xl font-black tracking-tight">
            Set your own password
          </h1>
          <p className="text-sm text-muted-foreground">
            This account is still using a password that was issued to you. Choose
            your own to continue.
          </p>
        </div>

        {isImpersonating && (
          <Alert className="border-primary/30 bg-primary/5">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                You are viewing this account as an administrator. Do not change
                the user&apos;s password.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReturnToAdmin}
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Return to Admin
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" data-testid="change-password-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          data-testid="change-password-form"
        >
          <div className="space-y-2">
            <Label htmlFor="current_password">Current password</Label>
            <Input
              id="current_password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              data-testid="current-password-input"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                data-testid="new-password-input"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password_confirmation">Confirm new password</Label>
            <Input
              id="password_confirmation"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) =>
                setPasswordConfirmation(event.target.value)
              }
              data-testid="confirm-password-input"
              required
            />
          </div>

          <div
            className="space-y-2 rounded-xl border border-border/50 bg-background/50 p-4"
            data-testid="password-rules"
          >
            <ul className="space-y-2.5">
              {rules.map((rule) => (
                <li
                  key={rule.key}
                  className="flex items-center gap-2.5 text-xs"
                  data-testid={`rule-${rule.key}`}
                  data-met={rule.met ? "true" : "false"}
                >
                  {rule.met ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  )}
                  <span
                    className={cn(
                      "transition-colors duration-300",
                      rule.met ? "text-foreground" : "text-muted-foreground/60"
                    )}
                  >
                    {rule.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!isReadyToSubmit || loading}
            data-testid="change-password-submit"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
