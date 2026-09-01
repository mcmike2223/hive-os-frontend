"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  Loader2,
  ExternalLink,
  Info,
  Key,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  Lock,
  Bot,
  Users,
  ShieldCheck,
  Radio,
  FileCode,
  MessageCircle,
  RefreshCw,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";
import {
  getBackendApiRoot,
  getAuthHeaders,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import { SettingsPanelSkeleton } from "@/components/ui/loading-states";

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string"
      ? { "Content-Type": "application/json" }
      : {},
  );
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "API Request Failed");
  }
  return res.json();
};

const MESSAGE_TEMPLATES = [
  {
    name: "General Alert",
    body: "🚀 <b>Hive ERP System Alert</b>\n\nYour Telegram Bot is properly configured and communicating with Hive ERP!",
  },
  {
    name: "New Order Notice",
    body: "🛒 <b>New Sales Order #1042</b>\n\n<b>Customer:</b> Abebe Kebede\n<b>Total:</b> 4,500.00 ETB\n<b>Status:</b> Paid via Telebirr\n\n<i>Generated automatically by Hive ERP</i>",
  },
  {
    name: "Security OTP Code",
    body: "🔐 <b>Hive ERP Security Verification</b>\n\nYour 2FA verification code is: <code>849-204</code>\n\n<i>Valid for 5 minutes. Do not share this code with anyone.</i>",
  },
];

export function TelegramSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceScope = getWorkspaceScopeKey();

  const [formData, setFormData] = useState({
    telegram_enabled: false,
    telegram_bot_token: "",
    telegram_bot_token_configured: false,
    telegram_default_chat_id: "",
    telegram_parse_mode: "HTML",
  });

  const [showToken, setShowToken] = useState(false);
  const [testChatId, setTestChatId] = useState("");
  const [testMessage, setTestMessage] = useState(MESSAGE_TEMPLATES[0].body);
  const [lastTestResult, setLastTestResult] = useState<any>(null);
  const [verifiedBotInfo, setVerifiedBotInfo] = useState<any>(null);
  const [isVerifyingBot, setIsVerifyingBot] = useState(false);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["telegramSettings", workspaceScope],
    queryFn: () => apiFetch("/settings/telegram"),
  });

  useEffect(() => {
    if (settingsData?.data) {
      const sanitized = { ...settingsData.data };
      setFormData({
        telegram_enabled: Boolean(sanitized.telegram_enabled),
        telegram_bot_token: "",
        telegram_bot_token_configured: Boolean(sanitized.telegram_bot_token_configured),
        telegram_default_chat_id: sanitized.telegram_default_chat_id || "",
        telegram_parse_mode: sanitized.telegram_parse_mode || "HTML",
      });

      if (sanitized.telegram_default_chat_id && !testChatId) {
        setTestChatId(sanitized.telegram_default_chat_id);
      }
    }
  }, [settingsData]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        telegram_enabled: formData.telegram_enabled,
        telegram_default_chat_id: formData.telegram_default_chat_id,
        telegram_parse_mode: formData.telegram_parse_mode,
      };

      if (formData.telegram_bot_token.trim()) {
        payload.telegram_bot_token = formData.telegram_bot_token.trim();
      }

      return apiFetch("/settings/telegram", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      toast.success(
        t("settings.telegram_saved", "Telegram settings and encrypted credentials saved!"),
      );
      queryClient.invalidateQueries({ queryKey: ["telegramSettings", workspaceScope] });
      setFormData((prev) => ({
        ...prev,
        telegram_bot_token: "",
        telegram_bot_token_configured: Boolean(
          data?.data?.telegram_bot_token_configured ?? prev.telegram_bot_token_configured,
        ),
      }));
    },
    onError: (err: Error) => {
      toast.error(
        err.message ||
          t("settings.telegram_save_failed", "Failed to update Telegram settings."),
      );
    },
  });

  const verifyBot = async () => {
    setIsVerifyingBot(true);
    try {
      const payload: Record<string, any> = {};
      if (formData.telegram_bot_token.trim()) {
        payload.bot_token = formData.telegram_bot_token.trim();
      }

      const res = await apiFetch("/settings/telegram/verify-bot", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.status === "success" && res.data) {
        setVerifiedBotInfo(res.data);
        toast.success(`Verified: @${res.data.username} (${res.data.first_name})`);
      } else {
        toast.error(res.message || "Failed to verify bot.");
      }
    } catch (err: any) {
      toast.error(err.message || "Could not verify bot token.");
    } finally {
      setIsVerifyingBot(false);
    }
  };

  const testMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        chat_id: testChatId.trim(),
        message: testMessage.trim(),
      };

      if (formData.telegram_bot_token.trim()) {
        payload.bot_token = formData.telegram_bot_token.trim();
      }

      return apiFetch("/settings/telegram/test", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      setLastTestResult({
        success: true,
        data,
        timestamp: new Date().toLocaleTimeString(),
      });
      toast.success(
        data.message || "Test Telegram message delivered successfully!",
      );
    },
    onError: (err: Error) => {
      setLastTestResult({
        success: false,
        error: err.message,
        timestamp: new Date().toLocaleTimeString(),
      });
      toast.error(err.message || "Failed to send test Telegram message.");
    },
  });

  if (isLoading) {
    return <SettingsPanelSkeleton />;
  }

  return (
    <div className="space-y-8 pb-32">
      {/* 🚀 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-8 border border-border/50 rounded-[2.5rem] bg-gradient-to-br from-card/80 via-card/40 to-sky-500/5 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-gradient-to-br from-sky-500/20 via-blue-500/20 to-indigo-500/20 border border-sky-500/30 rounded-2xl flex items-center justify-center text-sky-500 shadow-inner">
            <Send className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-space font-black tracking-tight text-foreground">
                {t("settings.telegram_title", "Telegram Notifications")}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  formData.telegram_enabled
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    formData.telegram_enabled ? "bg-sky-500 animate-pulse" : "bg-muted-foreground/50"
                  }`}
                />
                {formData.telegram_enabled ? "Active" : "Disabled"}
              </span>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Lock className="h-2.5 w-2.5" /> AES-256 & TLS 1.3 Encrypted
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Send instant automated sales notifications, PDF invoices, low-stock warnings, and OTP security codes directly to your Telegram or company group chats for $0.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-2xl border border-border/60">
          <Label htmlFor="telegram-toggle" className="text-xs font-bold cursor-pointer">
            {formData.telegram_enabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id="telegram-toggle"
            checked={formData.telegram_enabled}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, telegram_enabled: checked }))
            }
          />
        </div>
      </div>

      {/* 🚀 2. STEP-BY-STEP SETUP GUIDE */}
      <div className="p-8 border border-sky-500/20 rounded-[2.5rem] bg-gradient-to-br from-sky-500/5 via-blue-500/5 to-transparent backdrop-blur-md shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-sky-500/20 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-space font-bold tracking-tight">
              How to Create your Telegram Bot (Takes 30 seconds)
            </h3>
            <p className="text-xs text-muted-foreground">
              Follow these simple steps on Telegram:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-card/60 border border-border/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-500">Step 1: Get Bot Token</span>
              <Bot className="h-4 w-4 text-sky-500" />
            </div>
            <p className="text-xs text-muted-foreground">
              Open <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary font-bold underline">@BotFather</a> on Telegram and send <code>/newbot</code>. Copy the HTTP API token it gives you.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-card/60 border border-border/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-500">Step 2: Get Your Chat ID</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground">
              Open <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-primary font-bold underline">@userinfobot</a> and tap Start to get your personal User ID (e.g. <code>123456789</code>).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-card/60 border border-border/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-500">Step 3: (Optional) Team Group</span>
              <MessageCircle className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-xs text-muted-foreground">
              For group notifications, add your bot to your Telegram team group as an Admin and enter the Group ID (e.g. <code>-1001987654321</code>).
            </p>
          </div>
        </div>
      </div>

      {/* 🚀 3. BOT CREDENTIALS & VALIDATION CARD */}
      <div className="p-8 border border-border/50 rounded-[2.5rem] bg-card/40 backdrop-blur-md shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-500">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-space font-bold tracking-tight">
                Bot Connection & Security Parameters
              </h3>
              <p className="text-xs text-muted-foreground">
                All credentials are encrypted using AES-256 in the database and transmitted over TLS 1.3 HTTPS.
              </p>
            </div>
          </div>

          {/* Verification Status Pill */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={verifyBot}
              disabled={isVerifyingBot || (!formData.telegram_bot_token_configured && !formData.telegram_bot_token.trim())}
              className="h-10 rounded-xl font-bold border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-all text-xs px-4"
            >
              {isVerifyingBot ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-sky-500" />
              )}
              Verify Bot Connection
            </Button>

            {verifiedBotInfo && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <Check className="h-3.5 w-3.5" /> @{verifiedBotInfo.username}
              </span>
            )}
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bot Token */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Telegram Bot Token
              </Label>
              {formData.telegram_bot_token_configured && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" /> Configured & Encrypted (AES-256)
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={formData.telegram_bot_token}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, telegram_bot_token: e.target.value }))
                }
                placeholder={
                  formData.telegram_bot_token_configured
                    ? "••••••••••••••••••••••••••••••••"
                    : "Paste HTTP token from @BotFather"
                }
                className="bg-muted/30 h-12 rounded-xl font-mono text-sm pr-12 border-border/60"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The HTTP API token provided by @BotFather.
            </p>
          </div>

          {/* Default Chat ID */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Default Target Chat / Group ID
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                e.g. 123456789 or -100123456789
              </span>
            </div>
            <Input
              value={formData.telegram_default_chat_id}
              onChange={(e) =>
                setFormData((p) => ({ ...p, telegram_default_chat_id: e.target.value }))
              }
              placeholder="e.g. 123456789 or -1001987654321"
              className="bg-muted/30 h-12 rounded-xl font-mono text-sm border-border/60"
            />
            <p className="text-[11px] text-muted-foreground">
              Where system notifications and business alerts will be sent by default.
            </p>
          </div>

          {/* Parse Mode */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Message Formatting Style
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Controls formatting tags allowed in notifications
              </span>
            </div>
            <Select
              value={formData.telegram_parse_mode}
              onValueChange={(val) =>
                setFormData((p) => ({ ...p, telegram_parse_mode: val }))
              }
            >
              <SelectTrigger className="bg-muted/30 h-12 rounded-xl text-sm border-border/60 max-w-md">
                <SelectValue placeholder="Select Formatting Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HTML">HTML (Recommended — &lt;b&gt;bold&lt;/b&gt;, &lt;code&gt;code&lt;/code&gt;, &lt;a href="..."&gt;links&lt;/a&gt;)</SelectItem>
                <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                <SelectItem value="Markdown">Standard Markdown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 🚀 4. LIVE TEST CONSOLE */}
      <div className="p-8 border border-border/50 rounded-[2.5rem] bg-card/40 backdrop-blur-md shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-space font-bold tracking-tight">
                Live Telegram Test Console
              </h3>
              <p className="text-xs text-muted-foreground">
                Send an instant test message to verify your bot delivers correctly.
              </p>
            </div>
          </div>

          {/* Preset Template Chips */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-bold mr-1">Templates:</span>
            {MESSAGE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                type="button"
                onClick={() => setTestMessage(tmpl.body)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-primary/10 hover:text-primary transition-all border border-border/60 font-medium"
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Test Chat ID
            </Label>
            <Input
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
              placeholder="e.g. 123456789 or @your_channel"
              className="bg-muted/30 h-12 rounded-xl font-mono text-sm border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Test Message Body (HTML supported)
            </Label>
            <Input
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Message body"
              className="bg-muted/30 h-12 rounded-xl text-sm border-border/60 font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !testChatId.trim()}
            className="h-11 rounded-xl px-6 font-bold border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-all"
          >
            {testMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4 text-sky-500 fill-sky-500/20" />
            )}
            Send Test Message
          </Button>

          {lastTestResult && (
            <div
              className={`text-xs font-medium px-3.5 py-2 rounded-xl border flex items-center gap-2 ${
                lastTestResult.success
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-destructive/10 text-destructive border-destructive/30"
              }`}
            >
              {lastTestResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span>
                {lastTestResult.success
                  ? `Delivered to Telegram at ${lastTestResult.timestamp}`
                  : `Failed: ${lastTestResult.error}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 🚀 5. FLOATING ACTION BAR */}
      <div className="fixed bottom-6 right-6 left-6 md:left-[320px] flex items-center justify-between p-4 rounded-[2rem] bg-card/90 backdrop-blur-xl border border-border/50 shadow-2xl z-50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2 hidden sm:flex">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span>Telegram credentials are stored using AES-256 encryption. Messages are transmitted via TLS 1.3.</span>
        </div>

        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="rounded-xl px-8 font-bold bg-primary text-primary-foreground h-11 hover:scale-105 transition-all shadow-md ml-auto"
        >
          {saveMut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            t("settings.commit_configs", "Commit Configurations")
          )}
        </Button>
      </div>
    </div>
  );
}
