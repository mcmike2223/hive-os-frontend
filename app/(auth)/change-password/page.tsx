"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { isAxiosError } from "axios";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  isImpersonatingSession,
  notifySessionChanged,
  stopImpersonation,
} from "@/lib/auth-sync";
import { cn } from "@/lib/utils";
import api from "@/modules/shared/api/http";
import {
  getAccessToken,
  getBackendApiRoot,
  getPublicServeUrl,
  getTenantHeaders,
  getTenantId,
  getWorkspaceScopeKey,
  isTenantHost,
} from "@/lib/runtime-context";

type PasswordField =
  | "current_password"
  | "password"
  | "password_confirmation";

type FieldErrors = Partial<Record<PasswordField, string>>;

type ApiErrorPayload = {
  message?: unknown;
  errors?: Record<string, unknown>;
};

const resolveSafeIntendedPath = (value: string | null): string => {
  const candidate = value?.trim();

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return "/dashboard";
  }

  const pathname = candidate.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return pathname === "/change-password" || pathname.startsWith("/sign-in")
    ? "/dashboard"
    : candidate;
};

const messageFromUnknown = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!Array.isArray(value)) return null;

  const message = value.find(
    (entry): entry is string =>
      typeof entry === "string" && Boolean(entry.trim()),
  );
  return message?.trim() || null;
};

/**
 * Forced password change.
 *
 * Reached when the API answers PASSWORD_CHANGE_REQUIRED, which it does for
 * every route until the user replaces a password somebody else chose. The
 * checklist below is presentation only: the same rules are enforced server
 * side, and a client that skips them gets a 422 rather than a saved password.
 */
export default function ChangePasswordPage() {
  const { resolvedTheme } = useTheme();

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [portalName, setPortalName] = useState("HIVE.OS CENTRAL");
  const [isTenant, setIsTenant] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmationRef = useRef<HTMLInputElement>(null);
  const generalErrorRef = useRef<HTMLDivElement>(null);

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
  const displayPortalName = brandSettings?.app_title || portalName;
  const authBackgroundUrl = getPublicServeUrl(
    brandSettings?.auth_background_image,
  );
  const activeLogoPath =
    resolvedTheme === "dark"
      ? brandSettings?.logo_dark || brandSettings?.logo_light
      : brandSettings?.logo_light || brandSettings?.logo_dark;
  const activeLogoUrl = getPublicServeUrl(activeLogoPath);
  const showBrandLogo = Boolean(activeLogoUrl && !logoFailed);

  // Resolved in an effect rather than at render: isTenantHost reads the
  // hostname, which does not exist during server rendering.
  const [endpoint, setEndpoint] = useState("/change-password");
  const [intended, setIntended] = useState("/dashboard");

  useEffect(() => {
    setLogoFailed(false);
  }, [activeLogoUrl]);

  useEffect(() => {
    if (!getAccessToken()) {
      sessionStorage.setItem(
        "hive_eject_reason",
        "Sign in before setting a new password.",
      );
      window.location.replace("/sign-in?redirect=%2Fchange-password");
      return;
    }

    const host = window.location.hostname;
    const tenantHost = isTenantHost(host);
    setEndpoint(
      tenantHost ? "/tenant/change-password" : "/change-password",
    );
    setIsTenant(tenantHost);
    if (tenantHost) {
      setPortalName(`${(getTenantId() || host).toUpperCase()} NODE`);
    }

    // Stashed by the interceptor before it routed here, so a user who deep
    // linked into a report lands back on that report rather than the root.
    setIntended(
      resolveSafeIntendedPath(
        sessionStorage.getItem("hive_password_change_intended"),
      ),
    );

    // Impersonating admins should not be prompted or allowed to change the
    // impersonated user's password.
    setIsImpersonating(isImpersonatingSession());
    setSessionReady(true);
  }, []);

  const handleReturnToAdmin = async () => {
    sessionStorage.removeItem("hive_password_change_intended");
    await stopImpersonation("/dashboard");
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
    sessionReady &&
    !isImpersonating &&
    currentPassword.length > 0 &&
    rules.every((rule) => rule.met);

  const clearFieldError = (field: PasswordField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const focusFirstInvalidField = (errors: FieldErrors) => {
    const target = errors.current_password
      ? currentPasswordRef.current
      : errors.password
        ? passwordRef.current
        : errors.password_confirmation
          ? passwordConfirmationRef.current
          : null;

    requestAnimationFrame(() => target?.focus());
  };

  const updateStoredUser = () => {
    const storedUser = localStorage.getItem("hive_user");
    if (!storedUser) return;

    try {
      const user = JSON.parse(storedUser) as Record<string, unknown>;
      localStorage.setItem(
        "hive_user",
        JSON.stringify({ ...user, must_change_password: false }),
      );
      notifySessionChanged();
      window.dispatchEvent(new Event("hive_security_cleared"));
    } catch {
      // A malformed local cache must not undo a successful server update.
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isReadyToSubmit) return;

    setLoading(true);
    setGeneralError("");
    setFieldErrors({});

    try {
      await api.post(endpoint, {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });

      updateStoredUser();
      sessionStorage.removeItem("hive_password_change_intended");
      toast.success("Password updated. Your account is ready.");
      window.location.replace(intended);
    } catch (requestError: unknown) {
      const payload = isAxiosError<ApiErrorPayload>(requestError)
        ? requestError.response?.data
        : undefined;
      const responseErrors = payload?.errors;
      const nextFieldErrors: FieldErrors = {};

      for (const field of [
        "current_password",
        "password",
        "password_confirmation",
      ] as const) {
        const message = messageFromUnknown(responseErrors?.[field]);
        if (message) nextFieldErrors[field] = message;
      }

      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
        focusFirstInvalidField(nextFieldErrors);
      } else {
        const message =
          messageFromUnknown(payload?.message) ||
          (isAxiosError(requestError) && !requestError.response
            ? "The authentication server could not be reached. Check your connection and try again."
            : "The password could not be updated. Try again.");
        setGeneralError(message);
        requestAnimationFrame(() => generalErrorRef.current?.focus());
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen w-full overflow-x-hidden bg-background text-foreground selection:bg-primary/30 lg:grid-cols-2">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]"
      />

      <header className="absolute right-4 top-4 z-50 rounded-full border border-slate-500 bg-background/90 p-1.5 shadow-xl backdrop-blur-md dark:border-slate-400 sm:right-6 sm:top-6">
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex min-w-0 flex-col justify-center px-5 py-10 pt-28 sm:px-12 lg:px-20">
        <div className="absolute left-5 top-7 flex max-w-[calc(100vw-7rem)] items-center sm:left-12 lg:left-20">
          {showBrandLogo ? (
            <img
              src={activeLogoUrl || undefined}
              alt={`${displayPortalName} logo`}
              onError={() => setLogoFailed(true)}
              className="h-auto max-h-20 w-auto max-w-[min(280px,calc(100vw-7rem))] object-contain"
            />
          ) : (
            <span className="font-space text-xl font-bold uppercase tracking-tight">
              {displayPortalName}
            </span>
          )}
        </div>

        <div className="mx-auto w-full max-w-lg space-y-7">
          <div className="space-y-3">
            <Badge
              variant="outline"
              className="border-slate-500 bg-primary/5 px-3 font-mono text-[11px] tracking-widest text-foreground dark:border-slate-400"
            >
              FIRST LOGIN SECURITY
            </Badge>
            <h1 className="font-space text-4xl font-black tracking-tighter sm:text-5xl">
              Create your new{" "}
              <span className="text-foreground">password</span>
          </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Replace the temporary password you received. When it is saved,
              you will continue exactly where you were headed.
            </p>
          </div>

          {!sessionReady ? (
            <div
              role="status"
              className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-slate-500 bg-card text-sm text-muted-foreground dark:border-slate-400"
            >
              <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              Checking your secure session…
            </div>
          ) : isImpersonating ? (
            <Alert className="border-slate-500 bg-primary/5 dark:border-slate-400">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              <AlertDescription>
                <p>
                  You are viewing this account as an administrator. The
                  user&apos;s password cannot be changed from an impersonated
                  session.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReturnToAdmin}
                  className="mt-3 min-h-11 border-slate-500 dark:border-slate-400"
                >
                  <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
                  Return to admin dashboard
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {generalError && (
                <Alert
                  ref={generalErrorRef}
                  role="group"
                  tabIndex={-1}
                  variant="destructive"
                  data-testid="change-password-error"
                  className="border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                >
                  <AlertCircle aria-hidden="true" className="h-4 w-4" />
                  <AlertDescription>{generalError}</AlertDescription>
                </Alert>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
                data-testid="change-password-form"
                noValidate
              >
                <div className="space-y-2">
                  <Label
                    htmlFor="current_password"
                    className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
                  >
                    Current password{" "}
                    <span className="normal-case tracking-normal">(required)</span>
                  </Label>
                  <Input
                    ref={currentPasswordRef}
                    id="current_password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value);
                      clearFieldError("current_password");
                    }}
                    aria-invalid={Boolean(fieldErrors.current_password)}
                    aria-describedby={
                      fieldErrors.current_password
                        ? "current-password-hint current-password-error"
                        : "current-password-hint"
                    }
                    data-testid="current-password-input"
                    required
                    disabled={loading}
                    className="h-12 rounded-xl border-slate-500 bg-background font-mono focus-visible:border-foreground focus-visible:ring-foreground dark:border-slate-400"
                  />
                  <p
                    id="current-password-hint"
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    Enter the temporary or current password used to sign in.
                  </p>
                  {fieldErrors.current_password && (
                    <p
                      id="current-password-error"
                      className="text-sm font-medium text-destructive"
                    >
                      Current password: {fieldErrors.current_password}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
                  >
                    New password{" "}
                    <span className="normal-case tracking-normal">(required)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      ref={passwordRef}
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        clearFieldError("password");
                      }}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={
                        fieldErrors.password
                          ? "password-rules password-error"
                          : "password-rules"
                      }
                      data-testid="new-password-input"
                      required
                      disabled={loading}
                      className="h-12 rounded-xl border-slate-500 bg-background pr-12 font-mono focus-visible:border-foreground focus-visible:ring-foreground dark:border-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground"
                      aria-label={
                        showPassword
                          ? "Hide all password fields"
                          : "Show all password fields"
                      }
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p
                      id="password-error"
                      className="text-sm font-medium text-destructive"
                    >
                      New password: {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password_confirmation"
                    className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
                  >
                    Confirm new password{" "}
                    <span className="normal-case tracking-normal">(required)</span>
                  </Label>
                  <Input
                    ref={passwordConfirmationRef}
                    id="password_confirmation"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(event) => {
                      setPasswordConfirmation(event.target.value);
                      clearFieldError("password_confirmation");
                    }}
                    aria-invalid={
                      (passwordConfirmation.length > 0 &&
                        password !== passwordConfirmation) ||
                      Boolean(fieldErrors.password_confirmation)
                    }
                    aria-describedby={
                      fieldErrors.password_confirmation
                        ? "password-confirmation-hint password-confirmation-error"
                        : "password-confirmation-hint"
                    }
                    data-testid="confirm-password-input"
                    required
                    disabled={loading}
                    className="h-12 rounded-xl border-slate-500 bg-background font-mono focus-visible:border-foreground focus-visible:ring-foreground dark:border-slate-400"
                  />
                  <p
                    id="password-confirmation-hint"
                    className="text-xs text-muted-foreground"
                  >
                    {passwordConfirmation.length > 0 &&
                    password !== passwordConfirmation
                      ? "Confirm new password: the entries do not match."
                      : "Re-enter the new password exactly."}
                  </p>
                  {fieldErrors.password_confirmation && (
                    <p
                      id="password-confirmation-error"
                      className="text-sm font-medium text-destructive"
                    >
                      Confirm new password:{" "}
                      {fieldErrors.password_confirmation}
                    </p>
                  )}
                </div>

                <section
                  id="password-rules"
                  aria-labelledby="password-rules-heading"
                  className="space-y-3 rounded-2xl border border-slate-500 bg-card p-4 dark:border-slate-400"
                  data-testid="password-rules"
                >
                  <h2
                    id="password-rules-heading"
                    className="font-mono text-[11px] font-semibold uppercase tracking-widest"
                  >
                    Password requirements
                  </h2>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {rules.map((rule) => (
                      <li
                        key={rule.key}
                        className="flex items-start gap-2.5 text-xs"
                        data-testid={`rule-${rule.key}`}
                        data-met={rule.met ? "true" : "false"}
                      >
                        {rule.met ? (
                          <CheckCircle2
                            aria-hidden="true"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400"
                          />
                        ) : (
                          <Circle
                            aria-hidden="true"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300"
                          />
                        )}
                        <span
                          className={cn(
                            "leading-relaxed transition-colors duration-300",
                            rule.met
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          <span className="sr-only">
                            {rule.met ? "Met: " : "Not met: "}
                          </span>
                          {rule.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <Button
                  type="submit"
                  className="min-h-14 w-full rounded-xl bg-primary font-space font-bold uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 transition-transform motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.99]"
                  disabled={!isReadyToSubmit || loading}
                  data-testid="change-password-submit"
                >
                  {loading ? (
                    <Loader2
                      aria-hidden="true"
                      className="mr-2 h-5 w-5 animate-spin"
                    />
                  ) : (
                    <KeyRound aria-hidden="true" className="mr-2 h-5 w-5" />
                  )}
                  {loading
                    ? "Saving password…"
                    : "Save password and continue"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>

      <aside
        aria-label="Password setup information"
        className="relative hidden min-w-0 overflow-hidden border-l border-slate-400 bg-muted/20 p-12 lg:flex lg:flex-col lg:justify-center dark:border-slate-500"
      >
        {authBackgroundUrl && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${authBackgroundUrl})` }}
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/75 to-background/95"
        />
        <div aria-hidden="true" className="tech-grid absolute inset-0 opacity-30" />

        <div className="relative z-10 mx-auto w-full max-w-md">
          <div
            aria-hidden="true"
            className="absolute inset-[-48px] rounded-full bg-primary/10 blur-[100px]"
          />
          <div className="relative space-y-7 rounded-3xl border border-slate-400 bg-card/95 p-8 shadow-2xl dark:border-slate-500">
            {showBrandLogo ? (
              <img
                src={activeLogoUrl || undefined}
                alt=""
                onError={() => setLogoFailed(true)}
                className="h-16 w-auto max-w-[220px] object-contain"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-500 bg-primary/10 dark:border-slate-400">
                <ShieldCheck
                  aria-hidden="true"
                  className="h-8 w-8 text-foreground"
                />
              </div>
            )}

            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-foreground">
                {isTenant ? "Tenant workspace" : "Central workspace"}
              </p>
              <h2 className="font-space text-2xl font-bold tracking-tight">
                One secure step before your workspace opens
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your temporary password stops working as soon as the new one is
                saved. Your signed-in session stays active, so there is no
                second login.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-500 bg-background p-4 dark:border-slate-400">
              <p className="text-sm font-semibold">Protected handoff</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                Continue to {intended}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
