// app/dashboard/profile/_components/security-tab-client.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  KeyRound,
  Copy,
  Check,
  QrCode,
  Smartphone,
  Scan,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { logFrontendAction } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/store/use-translation";
import { getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TwoFactorData = {
  enabled?: boolean;
  secret?: string;
  qr_code_url?: string;
  confirmed_at?: string | null;
  message?: string;
};

type UserProfile = {
  id?: number;
  name?: string;
  email?: string;
  two_factor_enabled?: boolean;
};

export function SecurityTabClient() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const scopeKey = getWorkspaceScopeKey();

  const { hasAnyPermission, hasPermission } = usePermissions();
  const canViewProfile = hasAnyPermission(["view_profile", "edit_profile"]);
  const canEditProfile = hasPermission("edit_profile");

  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [setupQrUrl, setSetupQrUrl] = useState("");
  const [setupSecretKey, setSetupSecretKey] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [hasCopiedCodes, setHasCopiedCodes] = useState(false);
  const [hasCopiedSecret, setHasCopiedSecret] = useState(false);
  const [showQrCode, setShowQrCode] = useState(true);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [pendingAction, setPendingAction] = useState<"enable" | "disable" | "reconfigure" | null>(null);

  // 1. Fetch 2FA Status & Barcode Details via React Query
  const {
    data: twoFactorData,
    isLoading: isFetching2FA,
    refetch: refetch2FA,
  } = useQuery<TwoFactorData>({
    queryKey: ["twoFactorDetails", scopeKey],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/2fa/qr`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 404 || res.status === 400) {
          return { enabled: false };
        }
        throw new Error("Failed to load 2FA details");
      }
      return res.json();
    },
    staleTime: 30000,
    retry: 1,
    enabled: canViewProfile,
  });

  // 2. Fetch User Profile for Two-Factor Enabled Flag
  const { data: userProfile, isLoading: isFetchingUser } = useQuery<UserProfile>({
    queryKey: ["authUserProfile", scopeKey],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/user`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    staleTime: 30000,
    enabled: canViewProfile,
  });

  const is2FAActive = Boolean(twoFactorData?.enabled || userProfile?.two_factor_enabled);
  const activeQrUrl = setupQrUrl || twoFactorData?.qr_code_url || "";
  const activeSecretKey = setupSecretKey || twoFactorData?.secret || "";

  // 3. Password Verification & Action Execution Mutation
  const executeAuthActionMut = useMutation({
    mutationFn: async ({
      action,
      password,
    }: {
      action: "enable" | "disable" | "reconfigure";
      password?: string;
    }) => {
      if (action === "reconfigure") {
        await fetch(`${getBackendApiRoot()}/2fa/disable`, {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ password }),
        });
      }

      if (action === "enable" || action === "reconfigure") {
        const res = await fetch(`${getBackendApiRoot()}/2fa/enable`, {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to generate 2FA");
        return { action, ...data };
      } else {
        const res = await fetch(`${getBackendApiRoot()}/2fa/disable`, {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to disable 2FA");
        return { action, ...data };
      }
    },
    onSuccess: (data) => {
      setIsPasswordModalOpen(false);
      setPasswordInput("");

      if (data.action === "enable" || data.action === "reconfigure") {
        setSetupQrUrl(data.qr_code_url);
        setSetupSecretKey(data.secret);
        setIsSettingUp2FA(true);
        setShowQrCode(true);
        logFrontendAction({
          module: "Profile Settings",
          action: "updated",
          description: "Operator initiated 2FA setup sequence.",
        }).catch(() => {});
        toast.success(
          t("profile.security.protocol_initiated", "Protocol Initiated: Scan the barcode using your authenticator app.")
        );
      } else {
        setIsSettingUp2FA(false);
        setSetupQrUrl("");
        setSetupSecretKey("");
        setRecoveryCodes([]);
        queryClient.invalidateQueries({ queryKey: ["twoFactorDetails"] });
        queryClient.invalidateQueries({ queryKey: ["authUserProfile"] });
        logFrontendAction({
          module: "Profile Settings",
          action: "updated",
          description: "Operator deactivated Two-Factor Authentication.",
        }).catch(() => {});
        toast.success(
          t("profile.security.deactivated_success", "Two-Factor Authentication deactivated successfully.")
        );
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("global.error", "Action Failed")));
    },
  });

  // 4. Confirm 2FA Code Mutation
  const confirm2FAMut = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`${getBackendApiRoot()}/2fa/confirm`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || t("auth.2fa.invalid_code", "Invalid authentication code"));
      }
      return data;
    },
    onSuccess: async (data) => {
      setRecoveryCodes(data.recovery_codes || []);
      setIsSettingUp2FA(false);
      setVerificationCode("");
      setSetupQrUrl("");
      setSetupSecretKey("");
      setShowQrCode(true);

      await queryClient.invalidateQueries({ queryKey: ["twoFactorDetails"] });
      await queryClient.invalidateQueries({ queryKey: ["authUserProfile"] });
      await refetch2FA();

      logFrontendAction({
        module: "Profile Settings",
        action: "updated",
        description: "Operator successfully activated and locked Two-Factor Authentication.",
      }).catch(() => {});
      toast.success(
        t("profile.security.activated_success", "Security Upgraded! Two-Factor Authentication is now active.")
      );
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("global.error", "Verification Failed")));
    },
  });

  const handleToggleClick = () => {
    if (!canEditProfile) {
      toast.error(
        t("global.lacks_permission", "Your role can view 2FA status, but changing it requires the edit_profile permission.")
      );
      return;
    }

    setPendingAction(is2FAActive ? "disable" : "enable");
    setPasswordInput("");
    setIsPasswordModalOpen(true);
  };

  const handleReconfigureClick = () => {
    if (!canEditProfile) {
      toast.error(t("global.lacks_permission", "Your role cannot reconfigure 2FA settings."));
      return;
    }
    setPendingAction("reconfigure");
    setPasswordInput("");
    setIsPasswordModalOpen(true);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction || !canEditProfile) return;
    executeAuthActionMut.mutate({ action: pendingAction, password: passwordInput });
  };

  const handleConfirm2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProfile) return;
    if (verificationCode.length !== 6) {
      toast.error(t("profile.security.code_length_error", "Please enter a valid 6-digit code."));
      return;
    }
    confirm2FAMut.mutate(verificationCode);
  };

  const copyRecoveryCodesToClipboard = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setHasCopiedCodes(true);
    logFrontendAction({
      module: "Profile Settings",
      action: "copied",
      description: "Operator copied 2FA recovery codes to clipboard.",
    }).catch(() => {});
    toast.success(t("profile.security.recovery_codes_copied", "Recovery codes saved to your clipboard."));
    setTimeout(() => setHasCopiedCodes(false), 3000);
  };

  const copySecretToClipboard = () => {
    if (!activeSecretKey) return;
    navigator.clipboard.writeText(activeSecretKey);
    setHasCopiedSecret(true);
    logFrontendAction({
      module: "Profile Settings",
      action: "copied",
      description: "Operator copied 2FA manual secret key to clipboard.",
    }).catch(() => {});
    toast.success(t("profile.security.manual_secret_key", "Secret key copied to clipboard."));
    setTimeout(() => setHasCopiedSecret(false), 3000);
  };

  const isGlobalLoading = isFetching2FA || isFetchingUser;

  if (isGlobalLoading && !twoFactorData) {
    return (
      <Card className="bg-card/40 backdrop-blur-md border-border/50 overflow-hidden shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <Skeleton className="h-6 w-48 rounded-xl" />
          <Skeleton className="h-6 w-24 rounded-xl" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* PASSWORD AUTHORIZATION MODAL */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-space">
              <KeyRound className="h-5 w-5 text-primary" />
              {t("profile.security.security_auth", "Security Authorization")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "profile.security.enter_password_desc",
                "Enter your current account encryption key (password) to authorize this action."
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder={t("profile.security.password_placeholder", "Enter current account password")}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                disabled={!canEditProfile || executeAuthActionMut.isPending}
                className="bg-muted/30 h-12 rounded-xl transition-all focus-visible:ring-primary font-mono"
              />
            </div>
            <DialogFooter className="pt-2 flex sm:justify-between items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                {t("global.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                className="rounded-xl px-8 shadow-lg font-bold"
                disabled={!canEditProfile || executeAuthActionMut.isPending || !passwordInput}
              >
                {executeAuthActionMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("profile.security.authorize_action", "Authorize Action")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MAIN 2FA CARD */}
      <Card id="tour-profile-2fa" className="bg-card/40 backdrop-blur-md border-border/50 overflow-hidden shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-space font-bold flex items-center gap-2">
                {t("profile.security.title", "Two-Factor Authentication (2FA)")}
              </CardTitle>
              {is2FAActive ? (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[11px] font-mono tracking-wider">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />{" "}
                  {t("profile.security.active_secured", "ACTIVE & SECURED")}
                </Badge>
              ) : isSettingUp2FA ? (
                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[11px] font-mono tracking-wider">
                  <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />{" "}
                  {t("profile.security.configuring", "CONFIGURING")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground border-border/60 text-[11px] font-mono tracking-wider">
                  <ShieldAlert className="h-3.5 w-3.5 mr-1 text-destructive" />{" "}
                  {t("profile.security.not_configured", "NOT CONFIGURED")}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              {t(
                "profile.security.desc",
                "Cryptographically secures your operator identity using Time-Based One-Time Passwords (TOTP)."
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={is2FAActive || isSettingUp2FA}
              onCheckedChange={handleToggleClick}
              disabled={!canEditProfile || executeAuthActionMut.isPending}
            />
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* INITIAL DISABLED STATE BANNER */}
          {!is2FAActive && !isSettingUp2FA && recoveryCodes.length === 0 && (
            <div id="tour-profile-2fa-setup" className="p-6 bg-muted/30 rounded-2xl border border-border/50 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
              <div className="space-y-1.5 max-w-xl">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />{" "}
                  {t("profile.security.step1_title", "Protect your node with Hardware / App Authenticator")}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t(
                    "profile.security.desc",
                    "When 2FA is active, signing in requires your password plus a rotating 6-digit cryptographic passcode from an authenticator app."
                  )}
                </p>
              </div>
              <Button
                onClick={handleToggleClick}
                disabled={!canEditProfile || executeAuthActionMut.isPending}
                className="rounded-xl px-6 font-space font-bold shadow-md uppercase tracking-wider text-xs whitespace-nowrap"
              >
                {t("profile.security.verify_activate", "Enable 2FA Now")}
              </Button>
            </div>
          )}

          {/* ACTIVE 2FA: PERSISTENT QR BARCODE & SECRET KEY SECTION */}
          {is2FAActive && (
            <div id="tour-profile-2fa-setup" className="space-y-6 animate-in fade-in duration-500">
              <div className="p-6 bg-gradient-to-br from-emerald-500/5 via-muted/20 to-background rounded-2xl border border-emerald-500/20 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
                  <div className="space-y-1">
                    <h3 className="font-space font-bold text-base flex items-center gap-2 text-foreground">
                      <QrCode className="h-5 w-5 text-emerald-500" />
                      {t("profile.security.barcode_title", "Authenticator Barcode & Binding Key")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "profile.security.barcode_desc",
                        "Your active barcode is always accessible here. You can scan it into additional devices or backup authenticators."
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQrCode(!showQrCode)}
                      className="rounded-xl text-xs font-mono h-9 border-border/60 bg-background/80"
                    >
                      {showQrCode ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />{" "}
                          {t("profile.security.hide_barcode", "Hide Barcode")}
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />{" "}
                          {t("profile.security.reveal_barcode", "Reveal Barcode")}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleReconfigureClick}
                      disabled={!canEditProfile || executeAuthActionMut.isPending}
                      className="rounded-xl text-xs font-mono h-9 text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />{" "}
                      {t("profile.security.reconfigure", "Reconfigure")}
                    </Button>
                  </div>
                </div>

                {showQrCode && (
                  <div className="grid md:grid-cols-12 gap-6 items-center">
                    {/* QR Code Container */}
                    <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-background/80 rounded-2xl border border-border/60 shadow-inner">
                      <div className="bg-white p-3 rounded-xl shadow-md border border-gray-200">
                        {activeQrUrl ? (
                          <QRCodeSVG value={activeQrUrl} size={150} level="M" includeMargin={false} />
                        ) : isFetching2FA ? (
                          <div className="h-[150px] w-[150px] flex items-center justify-center bg-gray-50 rounded-lg">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="h-[150px] w-[150px] flex items-center justify-center bg-gray-50 rounded-lg text-xs text-muted-foreground text-center p-2">
                            {t("profile.security.barcode_unavailable", "Barcode unavailable")}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground mt-2 tracking-wider flex items-center gap-1">
                        <Scan className="h-3 w-3 text-emerald-500" />{" "}
                        {t("profile.security.scan_with_app", "SCAN WITH APP")}
                      </span>
                    </div>

                    {/* Manual Secret Key & Details */}
                    <div className="md:col-span-8 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5 text-primary" />{" "}
                          {t("profile.security.manual_secret_key", "Manual Secret Key")}
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-xs sm:text-sm bg-background px-3.5 py-2.5 rounded-xl border border-border/70 flex-1 select-all tracking-wider text-foreground font-semibold shadow-inner truncate">
                            {activeSecretKey || (isFetching2FA ? t("profile.security.fetching_key", "FETCHING...") : "••••••••••••••••••••••••••••••••")}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={copySecretToClipboard}
                            disabled={!activeSecretKey}
                            className="h-10 w-10 rounded-xl shrink-0 bg-background hover:bg-muted"
                            title={t("profile.security.copy_secret_tooltip", "Copy secret key to clipboard")}
                          >
                            {hasCopiedSecret ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t(
                          "profile.security.manual_secret_desc",
                          "If your device camera cannot scan the barcode, enter this key manually in your authenticator app under Type: Time-Based (TOTP)."
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETUP IN PROGRESS CARD (WHEN INITIATING OR RECONFIGURING) */}
          {isSettingUp2FA && (
            <div className="p-6 bg-gradient-to-br from-primary/5 via-muted/20 to-background rounded-2xl border border-primary/20 shadow-sm space-y-6 animate-in slide-in-from-top-4 duration-300">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                {/* QR Code Presentation */}
                <div className="flex flex-col items-center justify-center p-6 bg-background/60 rounded-2xl border border-border/60 shadow-inner">
                  <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-200 mb-3">
                    {activeQrUrl ? (
                      <QRCodeSVG value={activeQrUrl} size={170} level="M" includeMargin={false} />
                    ) : (
                      <div className="h-[170px] w-[170px] flex items-center justify-center bg-gray-50 rounded-lg">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono font-medium text-foreground tracking-wider mb-2">
                    {t("profile.security.scan_qr_prompt", "1. Scan the QR Code")}
                  </span>
                  <p className="text-[11px] text-muted-foreground text-center">
                    {t(
                      "profile.security.scan_qr_prompt_desc",
                      "Open your authenticator app and scan the image, or manually enter the secret key shown."
                    )}
                  </p>
                </div>

                {/* Verification Form */}
                <form onSubmit={handleConfirm2FA} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("profile.security.manual_secret_key", "Manual Secret Key")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs bg-muted/40 px-3 py-2 rounded-xl border border-border/70 flex-1 select-all tracking-wider text-primary font-bold">
                        {activeSecretKey || t("profile.security.generating_key", "GENERATING...")}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copySecretToClipboard}
                        disabled={!activeSecretKey}
                        className="h-9 w-9 rounded-xl shrink-0"
                      >
                        {hasCopiedSecret ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("profile.security.enter_code_prompt", "2. Enter 6-Digit Code")}
                    </Label>
                    <Input
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      className="font-mono text-center tracking-[0.5em] text-2xl h-14 bg-background rounded-xl border-border focus-visible:ring-primary shadow-inner"
                      disabled={!canEditProfile || confirm2FAMut.isPending}
                      autoFocus
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full rounded-xl h-12 font-space font-bold uppercase tracking-wider shadow-lg"
                    disabled={!canEditProfile || verificationCode.length !== 6 || confirm2FAMut.isPending}
                  >
                    {confirm2FAMut.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                        {t("auth.2fa.decrypting", "Verifying Code...")}
                      </>
                    ) : (
                      <span className="flex items-center gap-2">
                        {t("profile.security.verify_activate", "Verify & Activate Security")}{" "}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* RECOVERY CODES MODAL / NOTICE */}
          {recoveryCodes.length > 0 && (
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl animate-in slide-in-from-top-4 duration-500 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
                <h4 className="text-emerald-500 font-bold text-lg font-space">
                  {t("profile.security.recovery_codes_title", "2FA Activated & Recovery Codes Generated")}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(
                  "profile.security.recovery_codes_desc",
                  "Save these emergency recovery codes in a secure password vault. This is the only time they will be shown."
                )}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                {recoveryCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="bg-background/90 py-2.5 px-3 text-center rounded-xl border border-border/50 font-bold tracking-widest shadow-sm select-all"
                  >
                    {code}
                  </div>
                ))}
              </div>

              <Button
                onClick={copyRecoveryCodesToClipboard}
                variant="outline"
                className="w-full rounded-xl bg-background hover:bg-muted font-mono text-xs h-11"
              >
                {hasCopiedCodes ? (
                  <Check className="mr-2 h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {hasCopiedCodes
                  ? t("profile.security.recovery_codes_copied", "Recovery Codes Copied to Clipboard!")
                  : t("profile.security.copy_recovery_codes", "Copy All Recovery Codes")}
              </Button>
            </div>
          )}

          {/* STEP-BY-STEP USER GUIDE: HOW TO READ & SCAN THE BARCODE */}
          <div id="tour-profile-guide" className="pt-4 border-t border-border/40 space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <h3 className="font-space font-bold text-base text-foreground">
                {t("profile.security.guide_title", "Step-by-Step Guide: How to Read & Scan the Barcode")}
              </h3>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Step 1 */}
              <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
                    STEP 01
                  </Badge>
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                </div>
                <h4 className="font-semibold text-xs text-foreground">
                  {t("profile.security.step1_title", "Get Authenticator App")}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t("profile.security.step1_desc", "Install any standard TOTP authenticator app on your smartphone:")}
                </p>
                <div className="pt-1 flex flex-wrap gap-1 text-[10px] font-mono text-muted-foreground">
                  <span className="bg-background px-2 py-0.5 rounded border border-border/50">• Google Authenticator</span>
                  <span className="bg-background px-2 py-0.5 rounded border border-border/50">• Microsoft Authenticator</span>
                  <span className="bg-background px-2 py-0.5 rounded border border-border/50">• Apple Passwords (iOS)</span>
                  <span className="bg-background px-2 py-0.5 rounded border border-border/50">• 1Password / Bitwarden</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
                    STEP 02
                  </Badge>
                  <Scan className="h-4 w-4 text-muted-foreground" />
                </div>
                <h4 className="font-semibold text-xs text-foreground">
                  {t("profile.security.step2_title", "Scan the Barcode")}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    "profile.security.step2_desc",
                    "Open your app, tap Add Account (+), choose Scan a QR Code, and point your camera at the barcode on screen."
                  )}
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
                    STEP 03
                  </Badge>
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                </div>
                <h4 className="font-semibold text-xs text-foreground">
                  {t("profile.security.step3_title", "Manual Setup (Alternative)")}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    "profile.security.step3_desc",
                    "If camera is unavailable, choose Enter Key Manually: Account: Hive OS, Key: Paste Secret Key, Type: Time-Based (TOTP)."
                  )}
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    STEP 04
                  </Badge>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </div>
                <h4 className="font-semibold text-xs text-foreground">
                  {t("profile.security.step4_title", "Generate & Login")}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    "profile.security.step4_desc",
                    "Your app generates a fresh 6-digit code every 30 seconds. Enter this code whenever signing into Hive OS."
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
