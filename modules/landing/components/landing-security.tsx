"use client";

import * as React from "react";
import {
  Fingerprint,
  KeyRound,
  Lock,
  ScrollText,
  ServerCog,
  ShieldCheck,
} from "lucide-react";

import { useTranslation } from "@/store/use-translation";
import { RevealGroup, RevealItem, SpotlightCard } from "./reveal";
import { IconPlate, SectionHeading, SectionShell, WindowChrome } from "./section";

/**
 * Security & data-residency section.
 *
 * Isolation, audit trails and where the data physically lives are the three
 * questions every Ethiopian enterprise buyer asks before the pricing question,
 * and they were previously answered only by a single 8-word bento tile.
 */
export function LandingSecurity() {
  const { t } = useTranslation();

  const controls = [
    {
      icon: ServerCog,
      title: t("landing.security.isolation_title", "Schema-level isolation"),
      desc: t(
        "landing.security.isolation_desc",
        "Every tenant gets its own database schema. There is no shared table a bad query could cross, and no row-level filter to forget.",
      ),
    },
    {
      icon: KeyRound,
      title: t("landing.security.rbac_title", "Role-based access control"),
      desc: t(
        "landing.security.rbac_desc",
        "Permissions are granted per role and per module, so a branch cashier never sees the consolidated ledger.",
      ),
    },
    {
      icon: ScrollText,
      title: t("landing.security.audit_title", "Immutable audit trail"),
      desc: t(
        "landing.security.audit_desc",
        "Every write is attributed to a user, a device and a timestamp — the record auditors ask for, without a manual log.",
      ),
    },
    {
      icon: Fingerprint,
      title: t("landing.security.identity_title", "Biometric attendance"),
      desc: t(
        "landing.security.identity_desc",
        "Enrol fingerprint devices directly against employee records so payroll hours cannot be edited after the fact.",
      ),
    },
    {
      icon: Lock,
      title: t("landing.security.transit_title", "Encrypted end to end"),
      desc: t(
        "landing.security.transit_desc",
        "TLS in transit and encryption at rest, with secrets held outside the application image.",
      ),
    },
    {
      icon: ShieldCheck,
      title: t("landing.security.residency_title", "Your choice of residency"),
      desc: t(
        "landing.security.residency_desc",
        "Run on our INSA-aligned hosting, or containerise the whole stack inside your own data centre.",
      ),
    },
  ];

  return (
    <SectionShell id="security" tone="raised" glow="cool">
      <SectionHeading
        eyebrow={t("landing.security.eyebrow", "Trust & Governance")}
        title={t("landing.security.title", "Built to survive an")}
        accent={t("landing.security.title_accent", "audit")}
        description={t(
          "landing.security.desc",
          "Isolation, attribution and data residency are architectural decisions, not settings you switch on later. Here is how Hive answers each one.",
        )}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <RevealGroup step={0.07} className="grid gap-4 sm:grid-cols-2">
          {controls.map(({ icon: Icon, title, desc }) => (
            <RevealItem key={title} variant="scale">
              <SpotlightCard className="h-full rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm transition-colors hover:border-sky-500/40">
                <IconPlate accent="cool" className="mb-4">
                  <Icon className="h-5 w-5" />
                </IconPlate>
                <h3 className="mb-2 font-space text-base font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </SpotlightCard>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* Audit-log product shot — shows the attribution claim rather than asserting it. */}
        <RevealGroup step={0.1}>
          <RevealItem variant="scale">
            <div className="sticky top-28 overflow-hidden rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm">
              <WindowChrome
                label={t("landing.security.log_label", "Audit log")}
                status={t("landing.security.log_status", "Live")}
                accent="cool"
              />
              <ul className="divide-y divide-border/60">
                {[
                  {
                    actor: "H. Bekele",
                    action: t("landing.security.log_1", "Approved purchase order #4471"),
                    meta: "10:42 · 10.4.2.19",
                  },
                  {
                    actor: "S. Alemu",
                    action: t("landing.security.log_2", "Edited payroll run — May"),
                    meta: "10:31 · POS-03",
                  },
                  {
                    actor: "system",
                    action: t("landing.security.log_3", "Telebirr settlement reconciled"),
                    meta: "10:15 · scheduler",
                  },
                  {
                    actor: "M. Tadesse",
                    action: t("landing.security.log_4", "Role changed: Cashier → Supervisor"),
                    meta: "09:58 · 10.4.2.7",
                  },
                  {
                    actor: "D. Girma",
                    action: t("landing.security.log_5", "Exported VAT declaration"),
                    meta: "09:20 · 10.4.2.31",
                  },
                ].map((row) => (
                  <li key={row.action} className="flex gap-3 px-4 py-3.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500/70" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {row.action}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {row.actor} · {row.meta}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border/60 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {t("landing.security.log_footer", "Entries are append-only")}
              </p>
            </div>
          </RevealItem>
        </RevealGroup>
      </div>
    </SectionShell>
  );
}
