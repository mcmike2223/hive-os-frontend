"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle, Globe, Loader2, Lock, ShieldCheck, ChevronRight, 
  Terminal, Activity, Cpu, KeyRound, Eye, EyeOff, CheckCircle2, Circle
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge"; 
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { logFrontendAction } from "@/lib/api"; // 🚀 Added Telemetry
import { cn } from "@/lib/utils";
import { getBackendApiRoot, getTenantHeaders, getTenantId, isTenantHost } from "@/lib/runtime-context";
type PasswordPolicy = {
  min_length?: number;
  require_mixed_case?: boolean;
  require_numbers?: boolean;
  require_symbols?: boolean;
};
function ResetPasswordForm({ isTenant }: { isTenant: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const viewLogged = useRef(false);

  useEffect(() => {
    // 🚀 TELEMETRY: Log page access
    if (!viewLogged.current && email) {
      viewLogged.current = true;
      logFrontendAction({ module: 'Auth - Recovery', action: 'viewed', description: `Accessed password reset portal for identity: ${email}` }).catch(()=>{});
    }

    const fallbackPolicy = { min_length: 8, require_mixed_case: true, require_numbers: true, require_symbols: true };

    const fetchPolicy = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const host = window.location.hostname;
        const endpoint = isTenantHost(host) ? "/tenant/password-policy" : "/password-policy";
        const res = await fetch(`${getBackendApiRoot()}${endpoint}`, {
          signal: controller.signal,
          headers: {
            "Accept": "application/json",
            ...getTenantHeaders({ allowUnsigned: true }),
          },
        });
        
        if (res.ok) setPolicy(await res.json());
        else setPolicy(fallbackPolicy);
      } catch (err: unknown) {
        setPolicy(fallbackPolicy);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    fetchPolicy();
  }, [isTenant, email]);

  const rules = React.useMemo(() => {
    if (!policy) return []; 
    const dynamicRules = [];
    if (policy.min_length) dynamicRules.push({ label: `At least ${policy.min_length} characters`, met: password.length >= policy.min_length });
    if (policy.require_mixed_case) dynamicRules.push({ label: "Contains uppercase & lowercase", met: /[A-Z]/.test(password) && /[a-z]/.test(password) });
    if (policy.require_numbers) dynamicRules.push({ label: "Contains a number", met: /[0-9]/.test(password) });
    if (policy.require_symbols) dynamicRules.push({ label: "Contains a special symbol", met: /[^A-Za-z0-9]/.test(password) });
    return dynamicRules;
  }, [password, policy]);

  const keysMatch = password.length > 0 && password === passwordConfirmation;
  const isReadyToSubmit = rules.length > 0 && rules.every((r) => r.met) && keysMatch;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token || !email) {
      setError("Missing security tokens. Please use the exact link from your email.");
      return;
    }
    if (!isReadyToSubmit) {
      setError("Key does not meet network security requirements.");
      return;
    }

    setLoading(true);
    const host = window.location.hostname;
    const endpoint = isTenantHost(host) ? "/tenant/reset-password" : "/reset-password";

    try {
      const res = await fetch(`${getBackendApiRoot()}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...getTenantHeaders({ allowUnsigned: true }),
        },
        body: JSON.stringify({ email, token, password, password_confirmation: passwordConfirmation }),
      });

      const data = await res.json();
      
      if (res.status === 422) throw new Error(data.message || data.errors?.password?.[0] || "Validation failed.");
      if (!res.ok) throw new Error(data.message || "Failed to initialize access.");

      // 🚀 TELEMETRY: Success
      await logFrontendAction({ module: 'Auth - Recovery', action: 'password_reset', description: `Successfully established new encryption key for identity: ${email}` }).catch(()=>{});

      toast.success("Node access established successfully.");
      setTimeout(() => router.push("/sign-in"), 2000);
    } catch (err: unknown) {
      // 🚀 TELEMETRY: Failure
      const errMessage = err instanceof Error ? err.message : String(err);
      await logFrontendAction({ module: 'Auth - Recovery', action: 'reset_failed', description: `Key reset failed: ${errMessage}` }).catch(()=>{});
      setError(errMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-8 mt-12 lg:mt-0">
      <div className="space-y-3">
        <Badge variant="outline" className="font-mono text-[10px] tracking-widest border-primary/30 text-primary bg-primary/5 px-3">SECURITY PROTOCOL INITIATED</Badge>
        <h1 className="text-4xl font-space font-black tracking-tighter sm:text-5xl">Initialize <span className="text-primary">Access</span></h1>
        <p className="text-muted-foreground font-inter text-sm max-w-[300px]">Establish your permanent encryption key to secure your node identity.</p>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive animate-in slide-in-from-top-4 duration-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {email && (
        <div className="bg-muted/30 border border-border rounded-xl p-3 flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg"><KeyRound className="h-4 w-4 text-primary" /></div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Target Identity</span>
            <span className="text-sm font-semibold text-foreground truncate">{email}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleReset} className="space-y-6">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground ml-1">New Secure Key</Label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Generate a strong key..." disabled={loading || !policy}
                className="pl-10 pr-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50 transition-all font-mono text-sm"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {policy ? (
            <div className="bg-background/50 rounded-xl border border-border/50 p-4 space-y-2 animate-in fade-in duration-500">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 flex justify-between">
                <span>Encryption Requirements</span><span className="text-primary/70">SYNCED</span>
              </div>
              <ul className="space-y-2.5">
                {rules.map((rule, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-xs font-mono">
                    {rule.met ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                    <span className={cn("transition-colors duration-300", rule.met ? "text-foreground" : "text-muted-foreground/60")}>{rule.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
             <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase p-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Fetching Network Security Policy...
             </div>
          )}
          
          <div className="grid gap-2 pt-2">
            <Label htmlFor="password_confirmation" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground ml-1 flex justify-between">
              <span>Verify Secure Key</span>
              {passwordConfirmation.length > 0 && <span className={keysMatch ? "text-emerald-500" : "text-destructive"}>{keysMatch ? "[ MATCH ]" : "[ MISMATCH ]"}</span>}
            </Label>
            <div className="relative group">
              <ShieldCheck className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors", keysMatch ? "text-emerald-500" : "text-muted-foreground group-focus-within:text-primary")} />
              <Input 
                id="password_confirmation" type={showPassword ? "text" : "password"} required value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="Re-enter your key" disabled={loading || !policy}
                className={cn("pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50 transition-all font-mono text-sm", passwordConfirmation.length > 0 && (keysMatch ? "border-emerald-500/50 focus:ring-emerald-500/50" : "border-destructive/50 focus:ring-destructive/50"))}
              />
            </div>
          </div>
        </div>

        <Button type="submit" disabled={loading || !isReadyToSubmit} className={cn("w-full font-space font-bold uppercase tracking-widest shadow-xl transition-all h-14 group", isReadyToSubmit ? "bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]" : "bg-muted text-muted-foreground shadow-none opacity-80 cursor-not-allowed")}>
          {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> ENCRYPTING...</> : <span className="flex items-center gap-2">{isReadyToSubmit ? "Apply Encryption" : "Awaiting Input"} <ChevronRight className={cn("h-4 w-4 transition-transform", isReadyToSubmit && "group-hover:translate-x-1")} /></span>}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [portalName, setPortalName] = useState("HIVE.OS CENTRAL");
  const [isTenant, setIsTenant] = useState(false);

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
        <LanguageSwitcher /><div className="w-px h-4 bg-border mx-1" /><ThemeToggle />
      </div>

      <div className="relative flex flex-col justify-center px-8 sm:px-20 py-12 z-10">
        <Link href="/sign-in" className="absolute top-8 left-8 sm:left-20 flex items-center gap-3 font-space text-2xl font-bold tracking-tight group">
          <div className="relative"><Globe className="text-primary h-7 w-7 transition-transform duration-700 group-hover:rotate-180" /><div className="absolute inset-0 bg-primary blur-lg opacity-20 group-hover:opacity-50 transition-opacity" /></div>
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent uppercase tracking-tighter">{portalName}</span>
        </Link>
        <Suspense fallback={<div className="flex flex-col items-center justify-center mt-32 space-y-4"><Loader2 className="h-8 w-8 text-primary animate-spin" /><span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Awaiting Transmission...</span></div>}>
          <ResetPasswordForm isTenant={isTenant} />
        </Suspense>
      </div>

      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-muted/5 border-l border-border overflow-hidden">
        <div className="tech-grid absolute inset-0 z-0 opacity-30" />
        <div className="relative z-10 flex items-center justify-between font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] opacity-60"><div className="flex items-center gap-2"><Activity className="h-3 w-3" /> System Heartbeat: Optimal</div><div>Uptime: 242:12:04</div></div>
        <div className="relative z-10 m-auto w-full max-w-sm">
           <div className="absolute inset-[-40px] bg-primary/10 blur-[100px] rounded-full animate-pulse" />
           <div className="relative bg-card/40 backdrop-blur-xl border border-primary/20 p-1 rounded-3xl shadow-2xl overflow-hidden group">
              <div className="bg-background/80 rounded-[22px] p-8 border border-border/50 flex flex-col items-center text-center">
                <div className="relative mb-6">
                   <div className="absolute inset-0 bg-primary blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                   <div className="relative w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner"><ShieldCheck className="w-10 h-10 text-primary animate-pulse" /></div>
                   <div className="absolute -top-2 -right-2"><div className="w-4 h-4 bg-green-500 rounded-full border-4 border-background animate-pulse" /></div>
                </div>
                <h3 className="font-space font-bold text-xl tracking-tight mb-2 uppercase">{isTenant ? "Tenant Node Key Exchange" : "Master Key Exchange"}</h3>
                <div className="flex items-center gap-4 text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-6">
                  <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> ARMv8</span><div className="w-1 h-1 bg-border rounded-full" /><span className="flex items-center gap-1.5"><Terminal className="h-3 w-3" /> TLS 1.3</span>
                </div>
                <div className="w-full bg-muted/30 rounded-xl p-4 border border-border/50 space-y-2">
                   <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden relative"><div className="absolute inset-y-0 left-0 bg-primary w-[30%] shadow-[0_0_10px_hsl(var(--primary))] animate-[pulse_2s_ease-in-out_infinite]" /></div>
                   <div className="flex justify-between font-mono text-[9px] uppercase tracking-tighter opacity-50"><span>Encryption Status</span><span className="text-primary">Awaiting Input...</span></div>
                </div>
              </div>
           </div>
        </div>
        <div className="relative z-10 space-y-2 font-mono text-[10px] text-muted-foreground select-none">
          <div className="flex justify-between group cursor-default"><span className="group-hover:text-primary transition-colors">/root/system/handshake_v3.sh</span><span className="text-green-500/50">[EXECUTED]</span></div>
          <div className="flex justify-between group cursor-default"><span className="group-hover:text-primary transition-colors">/root/network/mtls_check.cert</span><span className="text-green-500/50">[VALIDATED]</span></div>
          <div className="flex justify-between group cursor-default"><span className="group-hover:text-primary transition-colors">/root/auth/key_generation</span><span className="text-yellow-500/50 animate-pulse">[PENDING]</span></div>
        </div>
      </div>
    </div>
  );
}
