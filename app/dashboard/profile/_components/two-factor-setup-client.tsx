"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, ShieldAlert, Loader2, KeyRound, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { logFrontendAction } from "@/lib/api"; 
import { getAccessToken, getBackendApiRoot } from "@/lib/runtime-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TwoFactorSetupClient() {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [hasCopied, setHasCopied] = useState(false);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [pendingAction, setPendingAction] = useState<"enable" | "disable" | null>(null);

  const getApiUrl = () => {
    return getBackendApiRoot();
  };

  const getHeaders = () => ({
    "Authorization": `Bearer ${getAccessToken()}`,
    "Accept": "application/json",
    "Content-Type": "application/json"
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/user`, { headers: getHeaders() });
        const data = await res.json();
        if (data.two_factor_enabled) {
          setIs2FAEnabled(true);
        }
      } catch (error) {
        console.error("Failed to load profile data.");
      }
    };
    fetchProfile();
  }, []);

  const handleToggleClick = () => {
    setPendingAction(is2FAEnabled ? "disable" : "enable");
    setPasswordInput("");
    setIsPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (pendingAction === "enable") {
        const res = await fetch(`${getApiUrl()}/2fa/enable`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ password: passwordInput })
        });
        
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.message || "Failed to generate 2FA");

        setQrCodeUrl(data.qr_code_url);
        setSecretKey(data.secret);
        setIsSettingUp2FA(true);
        
        logFrontendAction({ module: 'Profile Settings', action: 'updated', description: 'Operator initiated 2FA setup sequence and generated QR code.' }).catch(()=>{});
        toast.success("Protocol Initiated: Scan the QR code to continue.");

      } else if (pendingAction === "disable") {
        const res = await fetch(`${getApiUrl()}/2fa/disable`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ password: passwordInput })
        });
        
        if (!res.ok) throw new Error("Failed to disable 2FA");

        setIs2FAEnabled(false);
        setIsSettingUp2FA(false);
        setRecoveryCodes([]);
        
        logFrontendAction({ module: 'Profile Settings', action: 'updated', description: 'Operator completely disabled Two-Factor Authentication.' }).catch(()=>{});
        toast.warning("Security Downgraded: Two-Factor Authentication has been disabled.");
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Authorization Failed"));
    } finally {
      setIsLoading(false);
      setIsPasswordModalOpen(false);
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/2fa/confirm`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ code: verificationCode })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Invalid authentication code.");

      setRecoveryCodes(data.recovery_codes);
      setIsSettingUp2FA(false);
      setIs2FAEnabled(true);
      setVerificationCode("");

      logFrontendAction({ module: 'Profile Settings', action: 'updated', description: 'Operator successfully activated and locked Two-Factor Authentication.' }).catch(()=>{});
      toast.success("Security Upgraded! Two-Factor Authentication is now active.");

    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Verification Failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setHasCopied(true);
    logFrontendAction({ module: 'Profile Settings', action: 'copied', description: 'Operator copied 2FA recovery codes to system clipboard.' }).catch(()=>{});
    toast.success("Recovery codes saved to your clipboard.");
    setTimeout(() => setHasCopied(false), 3000);
  };

  return (
    <div className="space-y-6">
      
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5 text-primary" />
              Security Authorization
            </DialogTitle>
            <DialogDescription>
              Enter your current encryption key (password) to {pendingAction} Two-Factor Authentication.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Input 
                type="password" 
                placeholder="Enter current password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                className="bg-muted/30 h-11 transition-all focus-visible:ring-primary"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsPasswordModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="rounded-xl px-8 shadow-lg font-bold" disabled={isLoading || !passwordInput}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Authorize
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card id="tour-profile-2fa" className="bg-card/40 backdrop-blur-md border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              Two-Factor Authentication (2FA)
              {is2FAEnabled ? <ShieldCheck className="h-5 w-5 text-emerald-500" /> : <ShieldAlert className="h-5 w-5 text-destructive" />}
            </CardTitle>
            <CardDescription>Add an extra layer of security to your node connection.</CardDescription>
          </div>
          <Switch checked={is2FAEnabled || isSettingUp2FA} onCheckedChange={handleToggleClick} />
        </CardHeader>
        
        <CardContent>
          {!is2FAEnabled && !isSettingUp2FA && recoveryCodes.length === 0 && (
             <div className="text-sm text-muted-foreground mt-2 bg-muted/50 p-4 rounded-xl border border-border/50">
               When 2FA is enabled, you will be prompted for a secure, random 6-digit code during authentication.
             </div>
          )}

          {isSettingUp2FA && (
            <div className="mt-4 p-6 bg-background/50 rounded-2xl border border-border/50 flex flex-col md:flex-row gap-8 items-center animate-in fade-in duration-500">
              <div className="flex flex-col items-center space-y-3">
                <div className="bg-white p-3 rounded-xl shadow-md border border-gray-100">
                  {qrCodeUrl ? <QRCodeSVG value={qrCodeUrl} size={140} level="M" includeMargin={false} /> : <div className="h-[140px] w-[140px] bg-gray-100 animate-pulse rounded-lg" />}
                </div>
                <span className="text-xs font-mono bg-muted px-3 py-1.5 rounded-md tracking-wider border border-border/50 shadow-sm">
                  {secretKey || "GENERATING..."}
                </span>
              </div>
              
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <h4 className="font-semibold text-sm">1. Scan the QR Code</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    Open your authenticator app and scan the image, or manually enter the secret key shown.
                  </p>
                </div>
                <form onSubmit={handleConfirm2FA} className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">2. Enter 6-Digit Code</Label>
                    <Input 
                      placeholder="000 000" 
                      maxLength={6} 
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      className="font-mono text-center tracking-[0.5em] text-xl h-12 bg-background" 
                      required 
                    />
                  </div>
                  <Button type="submit" className="w-full rounded-xl" disabled={verificationCode.length !== 6 || isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify & Activate Security
                  </Button>
                </form>
              </div>
            </div>
          )}

          {recoveryCodes.length > 0 && (
            <div className="mt-6 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
                <h4 className="text-emerald-500 font-bold text-lg">2FA Activated Successfully!</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Please copy these recovery codes and store them in a secure location. 
                <strong className="text-foreground ml-1">This is the ONLY time they will be shown.</strong>
              </p>
              
              <div className="grid grid-cols-2 gap-3 font-mono text-sm mb-5">
                {recoveryCodes.map((code, idx) => (
                  <div key={idx} className="bg-background/80 py-2 text-center rounded-lg border border-border/50 font-bold tracking-widest shadow-sm">
                    {code}
                  </div>
                ))}
              </div>

              <Button onClick={copyToClipboard} variant="outline" className="w-full rounded-xl bg-background hover:bg-muted">
                {hasCopied ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
                {hasCopied ? "Copied!" : "Copy Recovery Codes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
