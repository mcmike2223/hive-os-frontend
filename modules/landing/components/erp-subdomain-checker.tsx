"use client";

import * as React from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Building,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTranslation } from "@/store/use-translation";

export function ErpSubdomainChecker() {
  const { t } = useTranslation();
  const [subdomain, setSubdomain] = useState("ethio-logistics");
  const [copied, setCopied] = useState(false);

  const cleanSubdomain = subdomain
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");

  const fullDomain = `${cleanSubdomain || "your-company"}.hive.et`;

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border border-primary/30 bg-gradient-to-b from-card/90 via-card/70 to-card/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/20 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-emerald-500/15 blur-[80px]" />

      <div className="relative z-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-space text-lg font-bold text-foreground">
                Claim Your Enterprise ERP Portal
              </h4>
              <p className="font-mono text-xs text-muted-foreground">
                Instant DNS provisioning with dedicated SSL and isolated tenant database
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Instant Activation
          </span>
        </div>

        {/* Input & Subdomain Preview */}
        <div className="space-y-3">
          <label className="block font-space text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Enter Your Company / Organization Name
          </label>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1 flex items-center rounded-2xl border border-border/80 bg-background px-4 py-3 shadow-inner focus-within:border-primary">
              <span className="font-mono text-xs text-muted-foreground mr-1">https://</span>
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="acme-industries"
                className="flex-1 bg-transparent font-space text-base font-bold text-foreground focus:outline-none placeholder:text-muted-foreground/50"
              />
              <span className="font-space text-sm font-bold text-primary">.hive.et</span>
            </div>

            <Link href={`/auth/signup?slug=${cleanSubdomain || "my-company"}`}>
              <Button className="h-full w-full sm:w-auto px-6 py-3.5 rounded-2xl font-space text-sm font-bold uppercase tracking-wider shadow-lg shadow-primary/25">
                Claim Portal <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Live Validation & Status Card */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 font-mono text-xs">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              <strong>{fullDomain}</strong> is available for instant deployment
            </span>
          </div>

          <div className="flex items-center gap-4 text-muted-foreground text-[11px]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> PostgreSQL Schema Isolated
            </span>
            <span className="hidden md:flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-primary" /> Auto-Let&apos;s Encrypt SSL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
