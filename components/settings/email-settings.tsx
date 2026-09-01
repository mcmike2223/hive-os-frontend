"use client";

import React, { useState, useEffect } from "react";
import { Server, Shield, Loader2, Send, ExternalLink, Info, Key, Cpu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";
import { getBackendApiRoot, getAuthHeaders, getTenantId, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { SettingsPanelSkeleton } from "@/components/ui/loading-states";
import { getErrorMessage } from "@/lib/errors";

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}
  );
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "API Request Failed");
  }
  return res.json();
};

export function EmailSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceScope = getWorkspaceScopeKey();

  const [formData, setFormData] = useState({
    mail_driver: "mailpit",
    mail_host: "mailpit",
    mail_port: 1025,
    mail_username: "",
    mail_password: "",
    mail_password_configured: false,
    mail_encryption: "null",
    mail_from_address: "noreply@hive-os.com",
    mail_from_name: "HIVE.OS Mailer",
    mail_storage_quota_central_users: 1024,
    mail_storage_quota_tenant_default: 5120,
    mail_storage_quota_tenant_users: 1024,
  });
  const [testRecipient, setTestRecipient] = useState("");

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["emailSettings", workspaceScope],
    queryFn: () => apiFetch("/settings/email"),
  });

  useEffect(() => {
    if (settingsData?.data) {
      const sanitizedData = { ...settingsData.data };
      Object.keys(sanitizedData).forEach((k) => {
        if (sanitizedData[k] === null) sanitizedData[k] = "";
        if (k === "mail_port" && sanitizedData[k]) sanitizedData[k] = parseInt(sanitizedData[k], 10);
      });
      setFormData((prev) => ({ ...prev, ...sanitizedData }));
    }
  }, [settingsData]);

  const saveMut = useMutation({
    mutationFn: () => apiFetch("/settings/email", { method: "POST", body: JSON.stringify(formData) }),
    onSuccess: () => {
      toast.success(t("settings.email_updated", "Email Server Configurations Synchronized!"));
      queryClient.invalidateQueries({ queryKey: ["emailSettings"] });
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, "Something went wrong saving settings!")),
  });

  const testMut = useMutation({
    mutationFn: () =>
      apiFetch("/settings/email/test", {
        method: "POST",
        body: JSON.stringify({ recipient: testRecipient || undefined }),
      }),
    onSuccess: (result) => {
      const driver = result?.data?.driver || formData.mail_driver;
      toast.success(
        result.message ||
          (driver === "mailpit"
            ? "Test email dispatched to Mailpit sandbox!"
            : "Test email sent successfully.")
      );
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, "The test email could not be sent.")),
  });

  const selectDriver = (driver: string) => {
    setFormData((previous) => {
      if (driver === "mailpit") {
        return {
          ...previous,
          mail_driver: driver,
          mail_host: "mailpit",
          mail_port: 1025,
          mail_username: "",
          mail_password: "",
          mail_encryption: "null",
        };
      }
      if (driver === "smtp") {
        return {
          ...previous,
          mail_driver: driver,
          mail_host: previous.mail_host === "mailpit" ? "smtp.mailgun.org" : previous.mail_host,
          mail_port: previous.mail_port === 1025 ? 587 : previous.mail_port,
          mail_encryption: "tls",
        };
      }
      if (driver === "ses") {
        return {
          ...previous,
          mail_driver: driver,
          mail_host: "us-east-1",
        };
      }
      if (driver === "sendmail") {
        return {
          ...previous,
          mail_driver: driver,
          mail_host: "/usr/sbin/sendmail -bs -i",
        };
      }
      return { ...previous, mail_driver: driver };
    });
  };

  if (isLoading) return <SettingsPanelSkeleton />;

  const isMailpit = formData.mail_driver === "mailpit";
  const isSmtp = formData.mail_driver === "smtp";
  const isResend = formData.mail_driver === "resend";
  const isPostmark = formData.mail_driver === "postmark";
  const isSes = formData.mail_driver === "ses";
  const isSendmail = formData.mail_driver === "sendmail";
  const isLogOrArray = formData.mail_driver === "log" || formData.mail_driver === "array";
  const isPool = formData.mail_driver === "failover" || formData.mail_driver === "roundrobin";

  return (
    <div className="pb-28 space-y-6 transition-all animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* 🌐 DRIVER SELECTION */}
      <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-xl shadow-sm hover:shadow-md hover:bg-card/60 transition-all duration-300">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl flex items-center justify-center text-indigo-500 shadow-inner">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-space font-black tracking-tight text-foreground">
                {t("settings.email_server", "Mail Transport Driver")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("settings.email_server_desc", "Select the outbound email transport and connection profile.")}
              </p>
            </div>
          </div>
          {isMailpit && (
            <a
              href="http://localhost:8085"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Mailpit Web UI (8085)
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2 md:col-span-3">
            <Label id="mail-driver-label" className="text-[11px] font-black uppercase text-muted-foreground">
              {t("settings.mail_driver", "Active Transport Driver")}
            </Label>
            <Select value={formData.mail_driver} onValueChange={selectDriver}>
              <SelectTrigger aria-labelledby="mail-driver-label" className="bg-muted/30 h-12 rounded-xl font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mailpit">📮 Mailpit (Local Sandbox & Testing)</SelectItem>
                <SelectItem value="smtp">🌐 SMTP (Standard / Relay Server)</SelectItem>
                <SelectItem value="resend">⚡ Resend (Transactional API)</SelectItem>
                <SelectItem value="postmark">📨 Postmark (Transactional API)</SelectItem>
                <SelectItem value="ses">☁️ Amazon SES (AWS Cloud Mail)</SelectItem>
                <SelectItem value="sendmail">🐧 Sendmail (Local Unix Daemon)</SelectItem>
                <SelectItem value="log">📝 Log Only (Developer Logs)</SelectItem>
                <SelectItem value="array">🧪 Array (Automated Tests)</SelectItem>
                <SelectItem value="failover">🛡️ Failover Pool</SelectItem>
                <SelectItem value="roundrobin">🔄 Round Robin Pool</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── DRIVER-SPECIFIC ADAPTIVE PANELS ── */}

        {/* 1. MAILPIT */}
        {isMailpit && (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 text-foreground/90">
                <p className="font-bold">Mailpit Sandbox Mode Active</p>
                <p className="text-muted-foreground leading-relaxed">
                  All emails sent by Hive (welcome emails, password resets, workflow alerts, order invoices) are safely intercepted and captured locally. No real external emails will be sent.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">Mailpit SMTP Host</Label>
                <Input
                  value={formData.mail_host}
                  onChange={(e) => setFormData((p) => ({ ...p, mail_host: e.target.value }))}
                  className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                  placeholder="mailpit"
                />
                <p className="text-[11px] text-muted-foreground">Docker internal hostname: <code>mailpit</code> (or <code>127.0.0.1</code>)</p>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">Mailpit SMTP Port</Label>
                <Input
                  type="number"
                  value={formData.mail_port}
                  onChange={(e) => setFormData((p) => ({ ...p, mail_port: parseInt(e.target.value) || 1025 }))}
                  className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                  placeholder="1025"
                />
                <p className="text-[11px] text-muted-foreground">Default internal SMTP port is <code>1025</code></p>
              </div>
            </div>
          </div>
        )}

        {/* 2. SMTP */}
        {isSmtp && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">SMTP Host</Label>
                <Input
                  value={formData.mail_host}
                  onChange={(e) => setFormData((p) => ({ ...p, mail_host: e.target.value }))}
                  className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                  placeholder="smtp.mailgun.org"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">SMTP Port</Label>
                <Input
                  type="number"
                  value={formData.mail_port}
                  onChange={(e) => setFormData((p) => ({ ...p, mail_port: parseInt(e.target.value) || 587 }))}
                  className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                  placeholder="587"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">Encryption</Label>
                <Select value={formData.mail_encryption} onValueChange={(v) => setFormData((p) => ({ ...p, mail_encryption: v }))}>
                  <SelectTrigger className="bg-muted/30 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">TLS (STARTTLS / Port 587)</SelectItem>
                    <SelectItem value="ssl">SSL / SMTPS (Port 465)</SelectItem>
                    <SelectItem value="null">None (Unencrypted)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">SMTP Username</Label>
                <Input
                  autoComplete="username"
                  value={formData.mail_username}
                  onChange={(e) => setFormData((p) => ({ ...p, mail_username: e.target.value }))}
                  className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                  placeholder="smtp-user or api key"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">SMTP Password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={formData.mail_password}
                  onChange={(e) => setFormData((p) => ({ ...p, mail_password: e.target.value }))}
                  className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                  placeholder={formData.mail_password_configured ? "Saved (leave empty to keep)" : "Enter SMTP password"}
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. RESEND */}
        {isResend && (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-3">
              <Key className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 text-foreground/90">
                <p className="font-bold">Resend API Authentication</p>
                <p className="text-muted-foreground">
                  Provide your API key generated from <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="underline font-semibold">Resend Dashboard</a>. Ensure your sending domain is verified.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">Resend API Key</Label>
              <Input
                type="password"
                value={formData.mail_password}
                onChange={(e) => setFormData((p) => ({ ...p, mail_password: e.target.value }))}
                className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                placeholder={formData.mail_password_configured ? "Saved (leave empty to keep)" : "re_123456789abcdef..."}
              />
            </div>
          </div>
        )}

        {/* 4. POSTMARK */}
        {isPostmark && (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <Key className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 text-foreground/90">
                <p className="font-bold">Postmark Server API Token</p>
                <p className="text-muted-foreground">
                  Provide the Server API Token from your Postmark server credentials. Your From Address below must match an approved Sender Signature.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">Postmark Server Token</Label>
              <Input
                type="password"
                value={formData.mail_password}
                onChange={(e) => setFormData((p) => ({ ...p, mail_password: e.target.value }))}
                className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                placeholder={formData.mail_password_configured ? "Saved (leave empty to keep)" : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
              />
            </div>
          </div>
        )}

        {/* 5. AMAZON SES */}
        {isSes && (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
              <Cpu className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 text-foreground/90">
                <p className="font-bold">Amazon Simple Email Service (SES)</p>
                <p className="text-muted-foreground">
                  Provide your AWS IAM Access Key credentials and region. Ensure the sender email identity is verified in AWS SES.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">AWS Region</Label>
                <Input
                  value={formData.mail_host}
                  onChange={(e) => setFormData((p) => ({ ...p, mail_host: e.target.value }))}
                  className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                  placeholder="us-east-1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">AWS Access Key ID</Label>
                <Input
                  value={formData.mail_username}
                  onChange={(e) => setFormData((p) => ({ ...p, mail_username: e.target.value }))}
                  className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">AWS Secret Access Key</Label>
                <Input
                  type="password"
                  value={formData.mail_password}
                  onChange={(e) => setFormData((p) => ({ ...p, mail_password: e.target.value }))}
                  className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                  placeholder={formData.mail_password_configured ? "Saved (leave empty to keep)" : "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"}
                />
              </div>
            </div>
          </div>
        )}

        {/* 6. SENDMAIL */}
        {isSendmail && (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">Sendmail Binary Path</Label>
              <Input
                value={formData.mail_host}
                onChange={(e) => setFormData((p) => ({ ...p, mail_host: e.target.value }))}
                className="bg-muted/30 h-11 rounded-xl font-mono text-sm"
                placeholder="/usr/sbin/sendmail -bs -i"
              />
              <p className="text-[11px] text-muted-foreground">Path to sendmail command with execution flags.</p>
            </div>
          </div>
        )}

        {/* 7. LOG / ARRAY / POOL */}
        {isLogOrArray && (
          <div className="mt-6 p-4 rounded-2xl bg-muted/40 border border-border/40 flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 text-foreground/90">
              <p className="font-bold">{formData.mail_driver === "log" ? "Log Driver Active" : "Array Driver Active"}</p>
              <p className="text-muted-foreground">
                {formData.mail_driver === "log"
                  ? "All outgoing email messages will be rendered and appended to local Laravel log files without sending network requests."
                  : "Emails will be stored in an in-memory array for automated unit and feature test assertions."}
              </p>
            </div>
          </div>
        )}

        {isPool && (
          <div className="mt-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
            <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 text-foreground/90">
              <p className="font-bold">Multi-Transport Pool Configured</p>
              <p className="text-muted-foreground">
                Dispatches across pool mailers configured in environment files with automatic fallback handling.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 📨 ENVELOPE SENDER */}
      <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-card/60 transition-all duration-300">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center text-emerald-500 shadow-inner">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-space font-black tracking-tight text-foreground">
              {t("settings.email_envelope", "Envelope Addresses")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("settings.email_envelope_desc", "Global fallback sender name and address for system dispatches.")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">
              {t("settings.mail_from_address", "From Address")}
            </Label>
            <Input
              value={formData.mail_from_address}
              onChange={(e) => setFormData((p) => ({ ...p, mail_from_address: e.target.value }))}
              className="bg-muted/30 h-12 rounded-xl"
              placeholder="noreply@hive-os.com"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">
              {t("settings.mail_from_name", "From Name")}
            </Label>
            <Input
              value={formData.mail_from_name}
              onChange={(e) => setFormData((p) => ({ ...p, mail_from_name: e.target.value }))}
              className="bg-muted/30 h-12 rounded-xl"
              placeholder="HIVE.OS Mailer"
            />
          </div>
        </div>
      </div>

      {/* 💾 STORAGE QUOTAS */}
      <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-card/60 transition-all duration-300">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-rose-500/20 to-pink-500/20 rounded-xl flex items-center justify-center text-rose-500 shadow-inner">
            <Server className="h-5 w-5 opacity-80" />
          </div>
          <div>
            <h2 className="text-2xl font-space font-black tracking-tight text-foreground">
              {t("settings.storage_quotas", "Storage Quota Allocations")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("settings.storage_quotas_desc", "Quotas are derived from subscription plan. Override any plan below (in MB).")}
            </p>
          </div>
        </div>

        {!getTenantId() ? (
          /* ── Central Super Admin View ── */
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">
                {t("settings.mail_storage_quota_central_users", "Central User Mailbox Quota (MB)")}
              </Label>
              <Input
                type="number"
                value={formData.mail_storage_quota_central_users}
                onChange={(e) => setFormData((p) => ({ ...p, mail_storage_quota_central_users: parseInt(e.target.value) || 0 }))}
                className="bg-muted/30 h-12 rounded-xl"
                placeholder="1024"
              />
              <p className="text-xs text-muted-foreground">Per-user limit for users on the central node.</p>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Tenant Org Quota by Plan (MB)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: "mail_storage_quota_tenant_larva", plan: "Larva", default: 512, color: "text-slate-500", bg: "bg-slate-500/10" },
                  { key: "mail_storage_quota_tenant_startup", plan: "Startup", default: 2048, color: "text-sky-500", bg: "bg-sky-500/10" },
                  { key: "mail_storage_quota_tenant_business", plan: "Business", default: 10240, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                  { key: "mail_storage_quota_tenant_enterprise", plan: "Enterprise", default: 51200, color: "text-violet-500", bg: "bg-violet-500/10" },
                  { key: "mail_storage_quota_tenant_overlord", plan: "Overlord", default: 204800, color: "text-amber-500", bg: "bg-amber-500/10" },
                ].map(({ key, plan, default: def, color, bg }) => (
                  <div key={key} className={`p-4 rounded-2xl border border-border/40 ${bg} space-y-2`}>
                    <div className="flex items-center justify-between">
                      <Label className={`text-[11px] font-black uppercase tracking-wide ${color}`}>{plan}</Label>
                      <span className="text-[11px] text-muted-foreground/60">default: {def.toLocaleString()} MB</span>
                    </div>
                    <Input
                      type="number"
                      value={(formData as Record<string, number | string | boolean>)[key] as number | string || ""}
                      onChange={(e) => setFormData((p) => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                      className="bg-white/50 dark:bg-background/50 h-11 rounded-xl font-mono text-sm"
                      placeholder={`${def} MB (plan default)`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Tenant Admin View ── */
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">
              {t("settings.mail_storage_quota_tenant_users", "Per-User Mailbox Quota (MB)")}
            </Label>
            <Input
              type="number"
              value={formData.mail_storage_quota_tenant_users}
              onChange={(e) => setFormData((p) => ({ ...p, mail_storage_quota_tenant_users: parseInt(e.target.value) || 0 }))}
              className="bg-muted/30 h-12 rounded-xl"
              placeholder="1024"
            />
            <p className="text-xs text-muted-foreground">
              Maximum mailbox size per user in your organization. Cannot exceed your plan&apos;s total org quota.
            </p>
          </div>
        )}
      </div>

      {/* 🚀 FLOATING ACTION & TEST BAR */}
      <div className="fixed bottom-6 right-6 left-6 md:left-[320px] flex flex-col gap-3 p-4 rounded-[2rem] bg-card/90 backdrop-blur-xl border border-border/50 shadow-2xl z-50 sm:flex-row sm:items-end sm:justify-end">
        <div className="w-full space-y-1 sm:max-w-xs">
          <Label htmlFor="test-email-recipient" className="text-xs font-semibold">Test recipient (optional)</Label>
          <Input
            id="test-email-recipient"
            type="email"
            autoComplete="email"
            value={testRecipient}
            onChange={(event) => setTestRecipient(event.target.value)}
            placeholder="Defaults to your account email"
            className="h-10 rounded-xl"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => testMut.mutate()}
          disabled={testMut.isPending}
          className="h-10 rounded-xl px-5 font-bold border-border/60 hover:bg-muted/60"
        >
          {testMut.isPending ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="mr-2 h-4 w-4 text-emerald-500" />}
          Send test email
        </Button>
        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="rounded-xl px-8 font-bold bg-primary text-primary-foreground h-10 hover:scale-105 transition-all shadow-md"
        >
          {saveMut.isPending ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : t("settings.commit_configs", "Commit Configurations")}
        </Button>
      </div>
    </div>
  );
}
