"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logFrontendAction } from "@/lib/api";
import { clearHiveSession } from "@/lib/auth-sync";
import {
  getBackendApiRoot,
  getTenantHeaders,
  getTenantId,
  isTenantHost,
  persistHiveContext,
} from "@/lib/runtime-context";
import { initializeSessionActivity } from "@/lib/session-activity";
import {
  LMS_MY_LEARNING_PATH,
  LMS_TOKENS,
  LmsSiteFooter,
  LmsSiteHeader,
  REGISTER_HREF,
  useLmsPublicBrand,
} from "@/modules/Lms/components/lms-site";
import { LmsFormShell } from "@/modules/Lms/components/lms-form-panel";

const POST_LOGIN_REDIRECT_STORAGE_KEY = "hive_post_login_redirect";
const AUTH_SERVER_UNAVAILABLE_MESSAGE =
  "Unable to connect to the authentication server. Please confirm the Hive backend is running and try again.";

const resolveSafePostLoginRedirect = (): string => {
  if (typeof window === "undefined") {
    return LMS_MY_LEARNING_PATH;
  }

  const redirect = new URLSearchParams(window.location.search).get("redirect")?.trim();

  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//") || redirect.includes("\\")) {
    return LMS_MY_LEARNING_PATH;
  }

  return redirect;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function LmsStudentLoginPage() {
  const router = useRouter();
  const { brandSettings, brandName } = useLmsPublicBrand();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const host = window.location.hostname;
    const endpoint = isTenantHost(host) ? "/tenant/login" : "/login";
    const apiUrl = `${getBackendApiRoot()}${endpoint}`;

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getTenantHeaders({ allowUnsigned: true }),
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid credentials provided");

      if (data.__offlineQueued) {
        throw new Error(AUTH_SERVER_UNAVAILABLE_MESSAGE);
      }

      // 2FA global intercept — mirrors the platform sign-in flow.
      if (data.requires_2fa || data.global_2fa_enforced) {
        sessionStorage.setItem("hive_pending_email", email);
        sessionStorage.setItem(POST_LOGIN_REDIRECT_STORAGE_KEY, resolveSafePostLoginRedirect());
        if (data.two_factor_token) sessionStorage.setItem("hive_2fa_token", data.two_factor_token);

        if (data.requires_2fa_setup && data.qr_code_url) {
          sessionStorage.setItem("hive_2fa_setup_qr", data.qr_code_url);
          sessionStorage.setItem("hive_2fa_setup_secret", data.secret);
        } else {
          sessionStorage.removeItem("hive_2fa_setup_qr");
          sessionStorage.removeItem("hive_2fa_setup_secret");
        }

        logFrontendAction({ module: "Auth", action: "2fa_required", description: `Identity ${email} requires strict 2FA clearance. Redirecting.` }).catch(() => {});
        router.push("/sign-in/2fa");
        return;
      }

      if (!data?.data?.token) {
        throw new Error(data.message || AUTH_SERVER_UNAVAILABLE_MESSAGE);
      }

      clearHiveSession();
      localStorage.removeItem("hive_original_token");
      localStorage.setItem("hive_token", data.data.token);
      localStorage.setItem("hive_user", JSON.stringify(data.data.user));
      persistHiveContext(data.data.context, data.data.context_signature ?? null);
      initializeSessionActivity();
      sessionStorage.removeItem("hive_eject_reason");

      await logFrontendAction({ module: "Auth", action: "session_initialized", description: `Learner ${email} authenticated.` }).catch(() => {});
      window.location.href = resolveSafePostLoginRedirect();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Invalid credentials provided");
      logFrontendAction({ module: "Auth", action: "login_failed", description: `Failed: ${message}` }).catch(() => {});
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LmsSiteHeader brandSettings={brandSettings} brandName={brandName} />
      <LmsFormShell>
        <div className="w-full max-w-xl rounded-[2rem] border border-black/5 bg-white p-8 shadow-2xl sm:p-12" style={{ boxShadow: "0 30px 60px -20px rgba(20,3,66,0.25)" }}>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-3xl font-bold tracking-tight" style={{ color: LMS_TOKENS.navy }}>
              Login
            </h3>
            <span
              className="hidden rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] sm:inline-flex"
              style={{ backgroundColor: `${LMS_TOKENS.green}1f`, color: LMS_TOKENS.navy }}
            >
              Student portal
            </span>
          </div>
          <p className="mt-2 text-sm text-[#4F547B]">
            Don&apos;t have an account yet?{" "}
            <Link href={REGISTER_HREF} className="font-semibold underline-offset-4 hover:underline" style={{ color: LMS_TOKENS.purple }}>
              Sign up for free
            </Link>
          </p>

          {error ? (
            <Alert variant="destructive" className="mt-6 bg-red-50/80 text-red-700">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="lms-email" className="text-[15px] font-semibold" style={{ color: LMS_TOKENS.navy }}>
                Username Or Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#9AA0C3]" aria-hidden="true" />
                <Input
                  id="lms-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="student@lms-demo.localhost"
                  disabled={loading}
                  className="h-13 rounded-2xl border-[#E4E4F0] bg-white pl-11 text-[15px] focus:ring-2 focus:ring-[#6440FB]/40"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="lms-password" className="text-[15px] font-semibold" style={{ color: LMS_TOKENS.navy }}>
                  Password
                </Label>
                <Link href="/forgot-password" className="text-sm font-medium text-[#9AA0C3] transition hover:text-[#6440FB]">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#9AA0C3]" aria-hidden="true" />
                <Input
                  id="lms-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="h-13 rounded-2xl border-[#E4E4F0] bg-white pl-11 pr-11 text-[15px] focus:ring-2 focus:ring-[#6440FB]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9AA0C3] transition hover:text-[#6440FB]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-13 w-full rounded-2xl text-[16px] font-bold transition hover:brightness-95 active:scale-[0.99]"
              style={{ backgroundColor: LMS_TOKENS.green, color: LMS_TOKENS.navy }}
            >
              {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : "Login"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm font-medium text-[#4F547B]">Or sign in using</div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <button
              type="button"
              className="h-12 rounded-2xl border-2 border-[#3B5998] text-sm font-semibold text-[#3B5998] transition hover:bg-[#3B5998] hover:text-white"
            >
              Log In via Facebook
            </button>
            <button
              type="button"
              className="h-12 rounded-2xl border-2 border-[#EA4335] text-sm font-semibold text-[#EA4335] transition hover:bg-[#EA4335] hover:text-white"
            >
              Log In via Google
            </button>
          </div>

          <p className="mt-6 rounded-2xl px-4 py-3 text-center text-xs leading-5 text-[#4F547B]" style={{ backgroundColor: `${LMS_TOKENS.lavender}80` }}>
            Demo learner: <strong style={{ color: LMS_TOKENS.navy }}>student@lms-demo.localhost</strong> / <strong style={{ color: LMS_TOKENS.navy }}>password</strong> · signed-in students continue in{" "}
            <strong style={{ color: LMS_TOKENS.navy }}>My Learning</strong>.
          </p>
        </div>
      </LmsFormShell>
      <LmsSiteFooter brandSettings={brandSettings} brandName={brandName} />
    </>
  );
}
