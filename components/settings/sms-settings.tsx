"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Shield,
  Loader2,
  Send,
  ExternalLink,
  Info,
  Key,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  Lock,
  User,
  Server,
  Download,
  Globe,
  Webhook,
  Building2,
  ZapIcon,
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

const PROVIDERS = [
  {
    id: "android_sms_gateway",
    name: "Android SMS Gate",
    subtitle: "Self-Hosted / Direct Phone (Uses SIM Card Balance)",
    badge: "Active",
    badgeColor: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    icon: Smartphone,
    color: "text-emerald-500",
  },
  {
    id: "afromessage",
    name: "AfroMessage",
    subtitle: "Ethiopia Fast SMS & OTP Gateway (afromessage.com)",
    badge: "Ethiopia Fast API",
    badgeColor: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    icon: ZapIcon,
    color: "text-blue-500",
  },
  {
    id: "sms_ethiopia",
    name: "SMS Ethiopia",
    subtitle: "Direct Ethio Telecom & Safaricom API (smsethiopia.com)",
    badge: "INSA Licensed",
    badgeColor: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    icon: Building2,
    color: "text-yellow-500",
  },
  {
    id: "httpsms",
    name: "httpSMS",
    subtitle: "Android Cloud Relay via Google FCM Push",
    badge: "Cloud Relay",
    badgeColor: "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
    icon: Radio,
    color: "text-cyan-500",
  },
  {
    id: "africas_talking",
    name: "Africa's Talking",
    subtitle: "Pan-African Telecom Gateway (Ethiopia/Kenya)",
    badge: "Pan-African",
    badgeColor: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    icon: Globe,
    color: "text-amber-500",
  },
  {
    id: "twilio",
    name: "Twilio",
    subtitle: "Global Carrier API (Account SID + Auth Token)",
    badge: "Global",
    badgeColor: "bg-red-500/20 text-red-600 dark:text-red-400",
    icon: Globe,
    color: "text-red-500",
  },
  {
    id: "custom_webhook",
    name: "Custom Webhook / REST",
    subtitle: "Send payload to any internal or external HTTP API",
    badge: "Custom",
    badgeColor: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    icon: Webhook,
    color: "text-purple-500",
  },
];

export function SmsSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceScope = getWorkspaceScopeKey();

  const [formData, setFormData] = useState({
    sms_enabled: false,
    sms_provider: "android_sms_gateway",
    httpsms_base_url: "http://10.16.94.226:8080",
    httpsms_api_key: "",
    httpsms_api_key_configured: false,
    httpsms_from_number: "",
    sms_auth_type: "basic",
    sms_username: "sms",
    sms_password: "",
    sms_password_configured: false,
    sms_sim_slot: 2,
    sms_rate_limit_per_minute: 30,
    sms_test_recipient: "",
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Hive ERP: SMS Gateway live verification test.",
  );
  const [lastTestResult, setLastTestResult] = useState<any>(null);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["smsSettings", workspaceScope],
    queryFn: () => apiFetch("/settings/sms"),
  });

  useEffect(() => {
    if (settingsData?.data) {
      const sanitized = { ...settingsData.data };
      setFormData({
        sms_enabled: Boolean(sanitized.sms_enabled),
        sms_provider: sanitized.sms_provider || "android_sms_gateway",
        httpsms_base_url: sanitized.httpsms_base_url || "http://10.16.94.226:8080",
        httpsms_api_key: "",
        httpsms_api_key_configured: Boolean(sanitized.httpsms_api_key_configured),
        httpsms_from_number: sanitized.httpsms_from_number || "",
        sms_auth_type: sanitized.sms_auth_type || "basic",
        sms_username: sanitized.sms_username || "sms",
        sms_password: "",
        sms_password_configured: Boolean(sanitized.sms_password_configured),
        sms_sim_slot: sanitized.sms_sim_slot ?? 2,
        sms_rate_limit_per_minute: sanitized.sms_rate_limit_per_minute ?? 30,
        sms_test_recipient: sanitized.sms_test_recipient || "",
      });

      if (sanitized.sms_test_recipient && !testRecipient) {
        setTestRecipient(sanitized.sms_test_recipient);
      }
    }
  }, [settingsData]);

  const handleProviderChange = (provider: string) => {
    let defaultUrl = formData.httpsms_base_url;
    if (provider === "afromessage") defaultUrl = "https://api.afromessage.com/api";
    else if (provider === "sms_ethiopia") defaultUrl = "https://smsethiopia.com/api";
    else if (provider === "httpsms") defaultUrl = "https://api.httpsms.com/v1";
    else if (provider === "africas_talking") defaultUrl = "https://api.africastalking.com/version1";
    else if (provider === "twilio") defaultUrl = "https://api.twilio.com/2010-04-01";
    else if (provider === "android_sms_gateway" && defaultUrl.includes("http")) defaultUrl = "http://10.16.94.226:8080";

    setFormData((prev) => ({
      ...prev,
      sms_provider: provider,
      httpsms_base_url: defaultUrl,
    }));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        sms_enabled: formData.sms_enabled,
        sms_provider: formData.sms_provider,
        httpsms_base_url: formData.httpsms_base_url,
        httpsms_from_number: formData.httpsms_from_number,
        sms_auth_type: formData.sms_auth_type,
        sms_username: formData.sms_username,
        sms_sim_slot: Number(formData.sms_sim_slot),
        sms_rate_limit_per_minute: Number(formData.sms_rate_limit_per_minute),
        sms_test_recipient: testRecipient,
      };

      if (formData.httpsms_api_key.trim()) {
        payload.httpsms_api_key = formData.httpsms_api_key.trim();
      }

      if (formData.sms_password.trim()) {
        payload.sms_password = formData.sms_password.trim();
      }

      return apiFetch("/settings/sms", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      toast.success(
        t("settings.sms_saved", "SMS Gateway settings saved successfully!"),
      );
      queryClient.invalidateQueries({ queryKey: ["smsSettings", workspaceScope] });
      setFormData((prev) => ({
        ...prev,
        httpsms_api_key: "",
        sms_password: "",
        httpsms_api_key_configured: Boolean(
          data?.data?.httpsms_api_key_configured ?? prev.httpsms_api_key_configured,
        ),
        sms_password_configured: Boolean(
          data?.data?.sms_password_configured ?? prev.sms_password_configured,
        ),
      }));
    },
    onError: (err: Error) => {
      toast.error(
        err.message ||
          t("settings.sms_save_failed", "Failed to update SMS settings."),
      );
    },
  });

  const testMut = useMutation({
    mutationFn: async () => {
      if (!testRecipient.trim()) {
        throw new Error("Please enter a test recipient phone number.");
      }

      return apiFetch("/settings/sms/test", {
        method: "POST",
        body: JSON.stringify({
          recipient: testRecipient.trim(),
          message: testMessage.trim(),
        }),
      });
    },
    onSuccess: (data) => {
      setLastTestResult({
        success: true,
        data,
        timestamp: new Date().toLocaleTimeString(),
      });
      toast.success(
        data.message || "Test SMS successfully dispatched to gateway!",
      );
    },
    onError: (err: Error) => {
      setLastTestResult({
        success: false,
        error: err.message,
        timestamp: new Date().toLocaleTimeString(),
      });
      toast.error(err.message || "Failed to send test SMS.");
    },
  });

  if (isLoading) {
    return <SettingsPanelSkeleton />;
  }

  const isAndroidSmsGate = formData.sms_provider === "android_sms_gateway";
  const isAfroMessage = formData.sms_provider === "afromessage";
  const isSmsEthiopia = formData.sms_provider === "sms_ethiopia";
  const isTwilio = formData.sms_provider === "twilio";
  const isHttpSms = formData.sms_provider === "httpsms";
  const isAfricasTalking = formData.sms_provider === "africas_talking";
  const isCustomWebhook = formData.sms_provider === "custom_webhook";

  return (
    <div className="space-y-8 pb-32">
      {/* 🚀 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-8 border border-border/50 rounded-[2.5rem] bg-gradient-to-br from-card/80 via-card/40 to-emerald-500/5 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner">
            <MessageSquare className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-space font-black tracking-tight text-foreground">
                {t("settings.sms_gateway_title", "Universal SMS Gateway")}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  formData.sms_enabled
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    formData.sms_enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                  }`}
                />
                {formData.sms_enabled ? "Active" : "Disabled"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Send SMS alerts, order updates, and 2FA codes across Ethio Telecom & Safaricom networks via AfroMessage, SMSEthiopia, Android Phones, Twilio, or Africa's Talking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-2xl border border-border/60">
          <Label htmlFor="sms-toggle" className="text-xs font-bold cursor-pointer">
            {formData.sms_enabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id="sms-toggle"
            checked={formData.sms_enabled}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, sms_enabled: checked }))
            }
          />
        </div>
      </div>

      {/* 🚀 2. MODULAR PROVIDER SELECTOR */}
      <div className="p-8 border border-border/50 rounded-[2.5rem] bg-card/40 backdrop-blur-md shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-border/40">
          <div className="h-9 w-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-space font-bold tracking-tight">
              Select Gateway Provider
            </h3>
            <p className="text-xs text-muted-foreground">
              Choose your active SMS transmission engine.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {PROVIDERS.map((prov) => {
            const isSelected = formData.sms_provider === prov.id;
            const Icon = prov.icon;
            return (
              <div
                key={prov.id}
                onClick={() => handleProviderChange(prov.id)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                    : "border-border/60 bg-muted/20 hover:border-border"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Icon className={`h-4 w-4 ${prov.color}`} />
                      <span>{prov.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prov.badgeColor}`}>
                      {prov.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                    {prov.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Links depending on active provider */}
        {isAndroidSmsGate && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/40 border border-border/60 text-xs">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Download className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Connected App: <strong>SMS Gate (capcom6) on your Android Phone</strong></span>
            </div>
            <a
              href="https://github.com/capcom6/android-sms-gateway/releases"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-primary hover:underline shrink-0"
            >
              Download APK <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {isAfroMessage && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <ZapIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Ethiopian Gateway: <strong>AfroMessage (afromessage.com)</strong></span>
            </div>
            <a
              href="https://www.afromessage.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
            >
              AfroMessage Portal <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {isSmsEthiopia && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-xs">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Building2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
              <span>Official Ethiopian Gateway: <strong>SMSEthiopia (Licensed by INSA)</strong></span>
            </div>
            <a
              href="https://smsethiopia.com/#/landing"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-yellow-600 dark:text-yellow-400 hover:underline shrink-0"
            >
              SMSEthiopia Portal <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* 🚀 3. DYNAMIC CREDENTIALS & ENDPOINT */}
      <div className="p-8 border border-border/50 rounded-[2.5rem] bg-card/40 backdrop-blur-md shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-border/40">
          <div className="h-9 w-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
            <Key className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-space font-bold tracking-tight">
              {isAndroidSmsGate && "Android Gateway Connection"}
              {isAfroMessage && "AfroMessage API Credentials"}
              {isSmsEthiopia && "SMSEthiopia API Credentials"}
              {isTwilio && "Twilio API Configuration"}
              {isHttpSms && "httpSMS Cloud API Configuration"}
              {isAfricasTalking && "Africa's Talking Configuration"}
              {isCustomWebhook && "Custom Webhook Configuration"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure credentials, host addresses, and routing options.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Base URL */}
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              {isAndroidSmsGate ? "Phone Gateway URL" : "API Endpoint / Base URL"}
            </Label>
            <Input
              value={formData.httpsms_base_url}
              onChange={(e) =>
                setFormData((p) => ({ ...p, httpsms_base_url: e.target.value }))
              }
              placeholder={
                isAfroMessage
                  ? "https://api.afromessage.com/api"
                  : isSmsEthiopia
                    ? "https://smsethiopia.com/api"
                    : "http://10.16.94.226:8080"
              }
              className="bg-muted/30 h-12 rounded-xl font-mono text-sm border-border/60"
            />
          </div>

          {/* SIM Slot Selection for Android SMS Gate */}
          {isAndroidSmsGate && (
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Active SIM Slot on Phone
              </Label>
              <Select
                value={String(formData.sms_sim_slot)}
                onValueChange={(val) =>
                  setFormData((p) => ({ ...p, sms_sim_slot: parseInt(val, 10) }))
                }
              >
                <SelectTrigger className="bg-muted/30 h-12 rounded-xl text-sm border-border/60">
                  <SelectValue placeholder="Select SIM Slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">SIM Slot 1</SelectItem>
                  <SelectItem value="2">SIM Slot 2 (Active)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Username / Account SID / Identifier ID */}
          {(isAndroidSmsGate || isTwilio || isAfricasTalking || isAfroMessage) && (
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                {isTwilio
                  ? "Twilio Account SID"
                  : isAfricasTalking
                    ? "Africa's Talking Username"
                    : isAfroMessage
                      ? "System Identifier ID (Optional)"
                      : "Gateway Username"}
              </Label>
              <div className="relative">
                <Input
                  value={formData.sms_username}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, sms_username: e.target.value }))
                  }
                  placeholder={
                    isTwilio
                      ? "ACXXXXXXXXXXXXXXXX"
                      : isAfroMessage
                        ? "Optional identifier"
                        : "sms"
                  }
                  className="bg-muted/30 h-12 rounded-xl text-sm border-border/60 pl-10"
                />
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Password / Auth Token / Secret */}
          {(isAndroidSmsGate || isTwilio) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  {isTwilio ? "Twilio Auth Token" : "Gateway Password"}
                </Label>
                {formData.sms_password_configured && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" /> Encrypted & Saved
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.sms_password}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, sms_password: e.target.value }))
                  }
                  placeholder={formData.sms_password_configured ? "••••••••••••••••" : "Enter password / token"}
                  className="bg-muted/30 h-12 rounded-xl font-mono text-sm pr-12 pl-10 border-border/60"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* API Key (AfroMessage, SMSEthiopia, httpSMS, Africa's Talking, Custom Webhook) */}
          {(isAfroMessage || isSmsEthiopia || isHttpSms || isAfricasTalking || isCustomWebhook) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  {isAfroMessage
                    ? "AfroMessage API Token"
                    : isSmsEthiopia
                      ? "SMSEthiopia API Key"
                      : "API Key / Bearer Token"}
                </Label>
                {formData.httpsms_api_key_configured && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" /> Encrypted & Saved
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={formData.httpsms_api_key}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, httpsms_api_key: e.target.value }))
                  }
                  placeholder={
                    isAfroMessage
                      ? "Paste Bearer token from afromessage.com"
                      : isSmsEthiopia
                        ? "Paste API key from smsethiopia.com"
                        : "Paste API key or secret token"
                  }
                  className="bg-muted/30 h-12 rounded-xl font-mono text-sm pr-12 border-border/60"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Sender ID / From Number */}
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              {isAfroMessage || isSmsEthiopia
                ? "Registered Sender Name / ID (e.g. HIVE_ERP)"
                : "Sender ID / From Number (Optional)"}
            </Label>
            <Input
              value={formData.httpsms_from_number}
              onChange={(e) =>
                setFormData((p) => ({ ...p, httpsms_from_number: e.target.value }))
              }
              placeholder="e.g. HIVE_ERP or +251911223344"
              className="bg-muted/30 h-12 rounded-xl text-sm border-border/60"
            />
          </div>

          {/* Anti-Spam Rate Limit */}
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Anti-Spam Throttle (SMS / Min)
            </Label>
            <Input
              type="number"
              min="1"
              max="600"
              value={formData.sms_rate_limit_per_minute}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  sms_rate_limit_per_minute: parseInt(e.target.value, 10) || 30,
                }))
              }
              className="bg-muted/30 h-12 rounded-xl font-mono text-sm border-border/60"
            />
          </div>
        </div>
      </div>

      {/* 🚀 4. LIVE TEST CONSOLE */}
      <div className="p-8 border border-border/50 rounded-[2.5rem] bg-card/40 backdrop-blur-md shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-border/40">
          <div className="h-9 w-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Send className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-space font-bold tracking-tight">
              Live Gateway Test Console
            </h3>
            <p className="text-xs text-muted-foreground">
              Send a test SMS to confirm instant carrier delivery.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Test Recipient Phone Number
            </Label>
            <Input
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="e.g. 0943488880 or +251943488880"
              className="bg-muted/30 h-12 rounded-xl font-mono text-sm border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Test Message Body
            </Label>
            <Input
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Message body"
              className="bg-muted/30 h-12 rounded-xl text-sm border-border/60"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !testRecipient.trim()}
            className="h-11 rounded-xl px-6 font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all"
          >
            {testMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4 text-emerald-500 fill-emerald-500/20" />
            )}
            Send Test SMS
          </Button>

          {lastTestResult && (
            <div
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                lastTestResult.success
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-destructive/10 text-destructive border-destructive/30"
              }`}
            >
              {lastTestResult.success ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              <span>
                {lastTestResult.success
                  ? `Delivered at ${lastTestResult.timestamp}`
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
          <span>All credentials and API tokens are encrypted with AES-256 in the database.</span>
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
