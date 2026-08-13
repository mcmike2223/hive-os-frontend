"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle2, Circle, Eye, EyeOff, KeyRound, Loader2, ShieldCheck,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import api from "@/modules/shared/api/http";
import { isTenantHost } from "@/lib/runtime-context";

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

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Resolved in an effect rather than at render: isTenantHost reads the
  // hostname, which does not exist during server rendering.
  const [endpoint, setEndpoint] = useState("/change-password");
  const [intended, setIntended] = useState("/dashboard");

  useEffect(() => {
    setEndpoint(
      isTenantHost(window.location.hostname) ? "/tenant/change-password" : "/change-password",
    );
  }, []);

  useEffect(() => {
    // Stashed by the interceptor before it routed here, so a user who deep
    // linked into a report lands back on that report rather than the root.
    const stored = sessionStorage.getItem("hive_password_change_intended");

    if (stored && !stored.includes("/change-password")) {
      setIntended(stored);
    }
  }, []);

  const rules = useMemo(
    () => [
      { key: "length", label: "At least 8 characters", met: password.length >= 8 },
      { key: "upper", label: "At least one uppercase letter", met: /[A-Z]/.test(password) },
      { key: "lower", label: "At least one lowercase letter", met: /[a-z]/.test(password) },
      { key: "number", label: "At least one number", met: /[0-9]/.test(password) },
      { key: "symbol", label: "At least one special character", met: /[^A-Za-z0-9]/.test(password) },
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
    [password, passwordConfirmation, currentPassword],
  );

  const isReadyToSubmit = currentPassword.length > 0 && rules.every((rule) => rule.met);

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
      // Full navigation rather than router.push: the cached user payload still
      // carries must_change_password, and a reload is the simplest way to get
      // a fresh one rather than briefly bouncing off the interceptor again.
      window.location.href = intended;
    } catch (requestError: any) {
      const response = requestError?.response?.data;
      const firstFieldError = response?.errors
        ? String(Object.values(response.errors)[0])
        : null;

      setError(firstFieldError || response?.message || "Could not update the password.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-background/60">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Set your own password</h1>
          <p className="text-sm text-muted-foreground">
            This account is still using a password that was issued to you. Choose your own to
            continue.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" data-testid="change-password-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="change-password-form">
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
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              onChange={(event) => setPasswordConfirmation(event.target.value)}
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
                      rule.met ? "text-foreground" : "text-muted-foreground/60",
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
