"use client";

import React, { useEffect, useState } from "react";
import {
  Bell,
  Phone,
  Send,
  Mail,
  MessageSquare,
  ExternalLink,
  Shield,
  Loader2,
  CheckCircle2,
  Sparkles,
  Zap,
  RefreshCw,
  AlertCircle,
  Smartphone,
  Radio,
  Layers,
  Check,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { logFrontendAction } from "@/lib/api";
import {
  getAuthHeaders,
  getBackendApiRoot,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import { getErrorMessage } from "@/lib/errors";
import { useTranslation } from "@/store/use-translation";
import { cn } from "@/lib/utils";

type UserProfile = {
  id?: number;
  name?: string;
  email?: string;
  phone_number?: string | null;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  notification_preferences?: {
    default_channel?: string;
    channels?: {
      email?: boolean;
      sms?: boolean;
      telegram?: boolean;
    };
  } | null;
};

type TestResults = {
  email?: { status: string; target?: string; message: string; details?: any };
  sms?: { status: string; target?: string; message: string; details?: any };
  telegram?: { status: string; target?: string; message: string; details?: any };
};

export function NotificationsTabClient() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const scopeKey = getWorkspaceScopeKey();
  const { hasPermission } = usePermissions();
  const canEditProfile = hasPermission("edit_profile");

  // Selected Channel View (Sub-Tab)
  const [selectedChannelTab, setSelectedChannelTab] = useState<"overview" | "sms" | "telegram" | "email">("overview");

  // Form Fields & State
  const [phoneNumber, setPhoneNumber] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [defaultChannel, setDefaultChannel] = useState<"email" | "sms" | "telegram">("email");
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelSms, setChannelSms] = useState(true);
  const [channelTelegram, setChannelTelegram] = useState(true);

  // Testing feedback state
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [lastTestResults, setLastTestResults] = useState<{
    timestamp: string;
    results: TestResults;
  } | null>(null);

  const { data: user, isLoading: isFetchingUser } = useQuery({
    queryKey: ["authUserProfile", scopeKey],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/user`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch user profile");
      return res.json() as Promise<UserProfile>;
    },
  });

  const { data: telegramConnectData } = useQuery({
    queryKey: ["telegramMyConnectLink", scopeKey],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/telegram/my-connect-link`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (!user) return;
    setPhoneNumber(user.phone_number || "");
    setTelegramChatId(user.telegram_chat_id || "");
    const prefs = user.notification_preferences || {};
    setDefaultChannel((prefs.default_channel as "email" | "sms" | "telegram") || "email");
    setChannelEmail(prefs.channels?.email ?? true);
    setChannelSms(prefs.channels?.sms ?? true);
    setChannelTelegram(prefs.channels?.telegram ?? true);
  }, [user]);

  const updatePreferencesMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/profile/update`, {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({
          name: user?.name,
          email: user?.email,
          phone_number: phoneNumber.trim(),
          telegram_chat_id: telegramChatId.trim(),
          notification_preferences: {
            default_channel: defaultChannel,
            channels: {
              email: channelEmail,
              sms: channelSms,
              telegram: channelTelegram,
            },
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update notification preferences");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success(t("notifications.saved_success", "Notification preferences saved successfully!"));
      queryClient.invalidateQueries({ queryKey: ["authUserProfile"] });
      logFrontendAction({
        module: "Notification Settings",
        action: "updated",
        description: `Updated notification channels (default: ${defaultChannel}).`,
      }).catch(() => {});
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, t("notifications.saved_error", "Failed to save notification preferences")));
    },
  });

  const sendTestNotificationMut = useMutation({
    mutationFn: async (channel: string | null) => {
      setTestingChannel(channel || "all");
      const res = await fetch(`${getBackendApiRoot()}/profile/test-notification`, {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({ channel }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to dispatch test notification");
      }

      return res.json() as Promise<{ status: string; message: string; results: TestResults }>;
    },
    onSuccess: (data) => {
      const results = data.results || {};
      setLastTestResults({
        timestamp: new Date().toLocaleTimeString(),
        results,
      });

      const channelsTested = Object.keys(results);

      channelsTested.forEach((ch) => {
        const res = results[ch as keyof TestResults];
        if (res?.status === "sent") {
          toast.success(`[${ch.toUpperCase()}]: ${res.message}`);
        } else if (res?.status === "skipped") {
          toast.warning(`[${ch.toUpperCase()}]: ${res.message}`);
        } else if (res?.status === "failed") {
          toast.error(`[${ch.toUpperCase()}]: ${res.message}`);
        }
      });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, t("notifications.test_failed", "Test dispatch failed")));
    },
    onSettled: () => {
      setTestingChannel(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProfile) return;
    updatePreferencesMut.mutate();
  };

  const isTelegramConnected = Boolean(
    (telegramChatId && telegramChatId.trim().length > 0) ||
    telegramConnectData?.data?.is_connected
  );

  if (isFetchingUser) {
    return (
      <div className="space-y-6">
        <Card className="border-border/50 bg-card/40 p-8 shadow-sm">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="h-4 w-96 rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-6">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 gap-6 pt-6">
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card id="tour-profile-channels" className="relative overflow-hidden border-border/50 bg-card/40 shadow-sm backdrop-blur-xl">

        {/* Card Header */}
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit text-xs font-bold tracking-widest uppercase mb-2">
                <Bell className="h-3.5 w-3.5" /> {t("notifications.badge", "Channel Orchestration")}
              </div>
              <CardTitle className="text-2xl font-black tracking-tight">
                {t("notifications.title", "Notification Channels & Alert Routing")}
              </CardTitle>
              <CardDescription className="text-sm">
                {t("notifications.subtitle", "Switch between channels to inspect, configure, and test real-time SMS, Telegram Bot, and Email alerts.")}
              </CardDescription>
            </div>

            {telegramConnectData?.data?.deep_link && (
              <a
                href={telegramConnectData.data.deep_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 transition-all shadow-sm shrink-0"
              >
                <Send className="h-4 w-4" />
                <span>{t("notifications.telegram_connect", "1-Click Connect Telegram")}</span>
                <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </a>
            )}
          </div>

          {/* Sub-Tabs / Channel View Selector */}
          <div className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-1.5 rounded-2xl border border-border/60">

              <button
                type="button"
                onClick={() => setSelectedChannelTab("overview")}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  selectedChannelTab === "overview"
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
              >
                <Layers className="h-4 w-4" />
                <span>{t("channels.overview", "All Channels")}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedChannelTab("sms")}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  selectedChannelTab === "sms"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-[1.02]"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
              >
                <Smartphone className="h-4 w-4" />
                <span>{t("channels.sms_tab", "Cellular SMS")}</span>
                {channelSms && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedChannelTab("telegram")}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  selectedChannelTab === "telegram"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-[1.02]"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
              >
                <Send className="h-4 w-4" />
                <span>{t("channels.telegram_tab", "Telegram Bot")}</span>
                {isTelegramConnected && <span className="h-2 w-2 rounded-full bg-sky-300" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedChannelTab("email")}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  selectedChannelTab === "email"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
              >
                <Mail className="h-4 w-4" />
                <span>{t("channels.email_tab", "Email Alerts")}</span>
                {channelEmail && <span className="h-2 w-2 rounded-full bg-indigo-300" />}
              </button>

            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* VIEW 1: ALL CHANNELS OVERVIEW */}
            {selectedChannelTab === "overview" && (
              <div className="space-y-6 animate-in fade-in-50 duration-300">
                {/* Primary Default Selector */}
                <div id="tour-profile-primary-channel" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("notifications.primary_channel_label", "Primary / Default Dispatch Channel")}
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      {t("notifications.primary_channel_hint", "Used for single-dispatch alerts & critical OTPs")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(["email", "sms", "telegram"] as const).map((channel) => {
                      const isSelected = defaultChannel === channel;
                      return (
                        <button
                          key={channel}
                          type="button"
                          onClick={() => setDefaultChannel(channel)}
                          disabled={!canEditProfile}
                          className={cn(
                            "group relative flex items-center justify-between p-4 rounded-2xl border text-xs font-bold transition-all text-left cursor-pointer",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.01]"
                              : "bg-card/60 text-muted-foreground hover:bg-muted/80 border-border/60 hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-9 w-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105",
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : "bg-muted text-foreground"
                              )}
                            >
                              {channel === "email" && <Mail className="h-4 w-4" />}
                              {channel === "sms" && <MessageSquare className="h-4 w-4" />}
                              {channel === "telegram" && <Send className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="capitalize font-bold text-sm">
                                {channel === "email" ? t("channels.email", "Email") : channel === "sms" ? t("channels.sms", "Cellular SMS") : t("channels.telegram", "Telegram Bot")}
                              </div>
                              <div
                                className={cn(
                                  "text-[10px] font-normal",
                                  isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                                )}
                              >
                                {channel === "email" && t("channels.email_sub", "Encrypted Inbox")}
                                {channel === "sms" && t("channels.sms_sub", "Direct Cellular")}
                                {channel === "telegram" && t("channels.telegram_sub", "@hive_erpbot")}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-primary-foreground animate-in zoom-in-50 duration-200" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Summary Cards of Channels */}
                <div id="tour-profile-channel-config" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* SMS Quick Card */}
                  <div
                    onClick={() => setSelectedChannelTab("sms")}
                    className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-emerald-500" />
                        <span className="font-bold text-sm text-foreground">Cellular SMS</span>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", channelSms ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-muted text-muted-foreground border-border")}>
                        {channelSms ? "Active" : "Muted"}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-foreground truncate">
                      {phoneNumber.trim() || <span className="text-muted-foreground italic">No phone set</span>}
                    </p>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline flex items-center gap-1">
                      <span>Configure & Test SMS</span> →
                    </div>
                  </div>

                  {/* Telegram Quick Card */}
                  <div
                    onClick={() => setSelectedChannelTab("telegram")}
                    className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/20 hover:border-sky-500/40 transition-all cursor-pointer space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4 text-sky-500" />
                        <span className="font-bold text-sm text-foreground">Telegram Bot</span>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", isTelegramConnected ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30")}>
                        {isTelegramConnected ? "Linked" : "Unlinked"}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-foreground truncate">
                      Chat ID: {telegramChatId.trim() || <span className="text-muted-foreground italic">Not set</span>}
                    </p>
                    <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold group-hover:underline flex items-center gap-1">
                      <span>Configure & Test Telegram</span> →
                    </div>
                  </div>

                  {/* Email Quick Card */}
                  <div
                    onClick={() => setSelectedChannelTab("email")}
                    className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-indigo-500" />
                        <span className="font-bold text-sm text-foreground">Email Alerts</span>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", channelEmail ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" : "bg-muted text-muted-foreground border-border")}>
                        {channelEmail ? "Active" : "Muted"}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-foreground truncate">
                      {user?.email || "sys@hive.os"}
                    </p>
                    <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline flex items-center gap-1">
                      <span>Inspect & Test Email</span> →
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: CELLULAR SMS CONFIGURATION */}
            {selectedChannelTab === "sms" && (
              <div className="space-y-6 p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 animate-in fade-in-50 duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-500/10">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Smartphone className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-foreground">Cellular SMS Configuration</h4>
                      <p className="text-xs text-muted-foreground">
                        Direct cellular dispatch via Android Gateway, AfroMessage, or SMS Ethiopia.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-xl border border-border/60">
                      <span className="text-xs font-semibold text-muted-foreground">Channel Status:</span>
                      <span className={cn("text-xs font-bold", channelSms ? "text-emerald-600" : "text-muted-foreground")}>
                        {channelSms ? "Active" : "Muted"}
                      </span>
                      <Switch
                        checked={channelSms}
                        onCheckedChange={setChannelSms}
                        disabled={!canEditProfile}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setDefaultChannel("sms")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                        defaultChannel === "sms"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-background/80 text-muted-foreground hover:text-foreground border-border/60"
                      )}
                    >
                      {defaultChannel === "sms" ? "✓ Primary Channel" : "Make Primary"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="sms_phone_input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Operator Cellular Number
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="sms_phone_input"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 0943488880 or +251911223344"
                      disabled={!canEditProfile}
                      className="h-12 rounded-xl bg-background/90 font-mono text-base border-border/60 flex-1"
                    />

                    <Button
                      type="button"
                      onClick={() => sendTestNotificationMut.mutate("sms")}
                      disabled={sendTestNotificationMut.isPending || !phoneNumber.trim()}
                      className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 cursor-pointer shrink-0"
                    >
                      {sendTestNotificationMut.isPending && testingChannel === "sms" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="mr-2 h-4 w-4" />
                      )}
                      Send Test SMS
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Supports local Ethiopian formats (<code>09...</code>, <code>07...</code>) and international format (<code>+2519...</code>).
                  </p>
                </div>
              </div>
            )}

            {/* VIEW 3: TELEGRAM BOT CONFIGURATION */}
            {selectedChannelTab === "telegram" && (
              <div className="space-y-6 p-6 rounded-2xl bg-sky-500/5 border border-sky-500/20 animate-in fade-in-50 duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <Send className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-lg text-foreground">Telegram Bot Configuration</h4>
                        {isTelegramConnected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                            Linked {user?.telegram_username ? `(${user.telegram_username})` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                            Unlinked
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Instant encrypted bot messages dispatched via <b>@hive_erpbot</b>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-xl border border-border/60">
                      <span className="text-xs font-semibold text-muted-foreground">Channel Status:</span>
                      <span className={cn("text-xs font-bold", channelTelegram ? "text-sky-600" : "text-muted-foreground")}>
                        {channelTelegram ? "Active" : "Muted"}
                      </span>
                      <Switch
                        checked={channelTelegram}
                        onCheckedChange={setChannelTelegram}
                        disabled={!canEditProfile}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setDefaultChannel("telegram")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                        defaultChannel === "telegram"
                          ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                          : "bg-background/80 text-muted-foreground hover:text-foreground border-border/60"
                      )}
                    >
                      {defaultChannel === "telegram" ? "✓ Primary Channel" : "Make Primary"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="telegram_id_input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Telegram Chat ID
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="telegram_id_input"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="e.g. 734736898"
                      disabled={!canEditProfile}
                      className="h-12 rounded-xl bg-background/90 font-mono text-base border-border/60 flex-1"
                    />

                    <Button
                      type="button"
                      onClick={() => sendTestNotificationMut.mutate("telegram")}
                      disabled={sendTestNotificationMut.isPending || !telegramChatId.trim()}
                      className="h-12 px-6 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md shadow-sky-600/20 cursor-pointer shrink-0"
                    >
                      {sendTestNotificationMut.isPending && testingChannel === "telegram" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send Test Telegram
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                      Find your numeric Telegram Chat ID by chatting with{" "}
                      <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">
                        @userinfobot
                      </a>
                    </span>

                    {telegramConnectData?.data?.deep_link && (
                      <a
                        href={telegramConnectData.data.deep_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-600 dark:text-sky-400 font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Auto-Pair Account with 1-Click Connect
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: EMAIL CONFIGURATION */}
            {selectedChannelTab === "email" && (
              <div className="space-y-6 p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 animate-in fade-in-50 duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-500/10">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-foreground">Email Alert Routing</h4>
                      <p className="text-xs text-muted-foreground">
                        Standard transactional security alerts & daily digests.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-xl border border-border/60">
                      <span className="text-xs font-semibold text-muted-foreground">Channel Status:</span>
                      <span className={cn("text-xs font-bold", channelEmail ? "text-indigo-600" : "text-muted-foreground")}>
                        {channelEmail ? "Active" : "Muted"}
                      </span>
                      <Switch
                        checked={channelEmail}
                        onCheckedChange={setChannelEmail}
                        disabled={!canEditProfile}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setDefaultChannel("email")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                        defaultChannel === "email"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-background/80 text-muted-foreground hover:text-foreground border-border/60"
                      )}
                    >
                      {defaultChannel === "email" ? "✓ Primary Channel" : "Make Primary"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Registered Operator Inbox
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      value={user?.email || "sys@hive.os"}
                      disabled
                      className="h-12 rounded-xl bg-background/50 font-mono text-base border-border/60 flex-1 text-muted-foreground"
                    />

                    <Button
                      type="button"
                      onClick={() => sendTestNotificationMut.mutate("email")}
                      disabled={sendTestNotificationMut.isPending || !user?.email}
                      className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 cursor-pointer shrink-0"
                    >
                      {sendTestNotificationMut.isPending && testingChannel === "email" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="mr-2 h-4 w-4" />
                      )}
                      Send Test Email
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    To modify your login email, navigate to the <b>Account Details</b> tab.
                  </p>
                </div>
              </div>
            )}

            {/* LIVE TEST RESULTS SUMMARY (When test is performed) */}
            {lastTestResults && (
              <div className="p-5 rounded-2xl bg-muted/40 border border-border/70 space-y-3 animate-in slide-in-from-top-3 duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" /> Live Test Verification Ledger ({lastTestResults.timestamp})
                  </span>
                  <button
                    type="button"
                    onClick={() => setLastTestResults(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-bold"
                  >
                    Clear Ledger
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Email Result */}
                  {lastTestResults.results.email && (
                    <div className="p-3 rounded-xl bg-background/80 border border-border/60 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-indigo-500" /> Email
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase", lastTestResults.results.email.status === "sent" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                          {lastTestResults.results.email.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{lastTestResults.results.email.message}</p>
                    </div>
                  )}

                  {/* SMS Result */}
                  {lastTestResults.results.sms && (
                    <div className="p-3 rounded-xl bg-background/80 border border-border/60 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5 text-emerald-500" /> SMS
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase", lastTestResults.results.sms.status === "sent" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                          {lastTestResults.results.sms.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{lastTestResults.results.sms.message}</p>
                    </div>
                  )}

                  {/* Telegram Result */}
                  {lastTestResults.results.telegram && (
                    <div className="p-3 rounded-xl bg-background/80 border border-border/60 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          <Send className="h-3.5 w-3.5 text-sky-500" /> Telegram
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase", lastTestResults.results.telegram.status === "sent" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                          {lastTestResults.results.telegram.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{lastTestResults.results.telegram.message}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form Actions Footer */}
            <div id="tour-profile-actions" className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/40 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => sendTestNotificationMut.mutate(null)}
                disabled={sendTestNotificationMut.isPending || !canEditProfile}
                className="w-full sm:w-auto h-12 rounded-xl border-border/60 font-bold hover:bg-muted/80 cursor-pointer"
              >
                {sendTestNotificationMut.isPending && testingChannel === "all" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Radio className="mr-2 h-4 w-4 text-primary" />
                )}
                {t("notifications.test_all_btn", "Broadcast Test (All Channels)")}
              </Button>

              <Button
                type="submit"
                disabled={updatePreferencesMut.isPending || !canEditProfile}
                className="w-full sm:w-auto h-12 rounded-xl bg-primary px-8 font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)_/_0.3)] transition-all hover:scale-[1.02] hover:bg-primary/90 cursor-pointer"
              >
                {updatePreferencesMut.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Shield className="mr-2 h-5 w-5" />
                )}
                {t("notifications.save_btn", "Save Preferences")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}